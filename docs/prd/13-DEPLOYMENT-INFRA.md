# 13 -- Deployment & Infrastructure Specification

**Product:** Brand Me Now v2
**Date:** February 19, 2026
**Author:** Matt Squarzoni
**Status:** Ready for implementation
**Dependencies:** All other PRD docs (03-SERVER-CORE through 12-OBSERVABILITY)

---

## Table of Contents

1. [Docker Setup](#1-docker-setup)
2. [DigitalOcean Kubernetes (Production)](#2-digitalocean-kubernetes-production)
3. [Starter Option (Single Droplet)](#3-starter-option-single-droplet)
4. [CI/CD (GitHub Actions)](#4-cicd-github-actions)
5. [DNS & SSL](#5-dns--ssl)
6. [Image/Asset CDN](#6-imageasset-cdn)
7. [Backup & Disaster Recovery](#7-backup--disaster-recovery)
8. [Monitoring & Alerts](#8-monitoring--alerts)
9. [Environment Management](#9-environment-management)
10. [File Manifest](#10-file-manifest)
11. [Development Prompt & Acceptance Criteria](#11-development-prompt--acceptance-criteria)

---

## Infrastructure Philosophy

**ALL infrastructure runs on DigitalOcean.** No GCP. No AWS. Two exceptions:

1. **Vercel** -- Next.js 15 marketing site (SSG/ISR, preview deploys, edge CDN)
2. **Supabase** -- Cloud-hosted PostgreSQL 17, Auth, Storage, Realtime (managed service)

Everything else -- Express.js API, Redis, BullMQ workers, Python AI worker, container registry, DNS, monitoring, object storage -- lives on DigitalOcean.

The Python AI worker that was originally planned for GCP Cloud Run now runs as a Docker container on the same DO infrastructure. This simplifies networking (no cross-cloud latency), billing (one invoice), and secrets management (one platform).

---

## 1. Docker Setup

### 1.1 Express.js API Server Dockerfile

Multi-stage build. Non-root user. Health check endpoint. Optimized layer caching for `node_modules`.

```dockerfile
# server/Dockerfile

# ============================================================
# Stage 1: Dependencies
# ============================================================
FROM node:22-alpine AS deps

WORKDIR /app

# Copy only package files for layer caching
COPY package.json pnpm-lock.yaml ./

# Install pnpm globally, then install production deps only
RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile --prod

# ============================================================
# Stage 2: Build (copies all source for any build steps)
# ============================================================
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile

# Copy full source
COPY . .

# If there are any build steps (e.g., generating config, compiling shared packages)
# they go here. For a pure JS + JSDoc project, this stage primarily ensures
# the source tree is clean and complete.

# ============================================================
# Stage 3: Production runtime
# ============================================================
FROM node:22-alpine AS runtime

# Security: install dumb-init for proper PID 1 signal handling,
# then create a non-root user
RUN apk add --no-cache dumb-init && \
    addgroup -g 1001 -S bmn && \
    adduser -S bmn -u 1001 -G bmn

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps --chown=bmn:bmn /app/node_modules ./node_modules

# Copy application source from build stage
COPY --from=build --chown=bmn:bmn /app/src ./src
COPY --from=build --chown=bmn:bmn /app/config ./config
COPY --from=build --chown=bmn:bmn /app/package.json ./package.json

# Switch to non-root user
USER bmn

# Expose the API port
EXPOSE 3000

# Health check: hit the /health endpoint every 30s
# Start checking 10s after boot, timeout after 5s, fail after 3 retries
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Environment defaults (overridden by docker-compose / k8s)
ENV NODE_ENV=production
ENV PORT=3000

# Use dumb-init as PID 1 to handle signals correctly (SIGTERM, SIGINT)
ENTRYPOINT ["dumb-init", "--"]

# Start the Express server
CMD ["node", "src/server.js"]
```

**Key decisions:**
- `node:22-alpine` -- minimal image (~180MB vs ~1GB for full Debian). Node 22 LTS.
- Three-stage build separates dependency installation (cached), build (full source), and runtime (minimal).
- `dumb-init` ensures SIGTERM from Kubernetes is forwarded to Node.js, enabling graceful shutdown of Socket.io connections and BullMQ workers.
- Non-root user `bmn` (UID 1001) -- K8s `runAsNonRoot` will pass.
- `wget` for health check instead of `curl` -- `curl` is not in Alpine by default. `wget` is.
- `.dockerignore` must exclude `node_modules`, `.git`, `tests/`, `docs/`, `.env*`.

### 1.2 Python AI Worker Dockerfile

Minimal Python image. Only image manipulation libraries (Pillow, etc). FastAPI + Uvicorn.

```dockerfile
# services/ai-worker/Dockerfile

# ============================================================
# Stage 1: Dependencies
# ============================================================
FROM python:3.13-slim AS deps

WORKDIR /app

# Install system dependencies for Pillow (image processing)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      libjpeg62-turbo-dev \
      libpng-dev \
      libwebp-dev \
      zlib1g-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ============================================================
# Stage 2: Production runtime
# ============================================================
FROM python:3.13-slim AS runtime

# Install only the runtime libraries Pillow needs (not -dev packages)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      libjpeg62-turbo \
      libpng16-16 \
      libwebp7 \
      wget && \
    rm -rf /var/lib/apt/lists/* && \
    addgroup --gid 1001 bmn && \
    adduser --uid 1001 --gid 1001 --disabled-password --gecos "" bmn

WORKDIR /app

# Copy installed Python packages from deps stage
COPY --from=deps /install /usr/local

# Copy application source
COPY --chown=bmn:bmn src/ ./src/

USER bmn

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/health || exit 1

CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

**`services/ai-worker/requirements.txt`:**

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
Pillow==11.1.0
httpx==0.28.1
pydantic==2.10.4
python-multipart==0.0.18
```

### 1.3 Redis Configuration

Redis 7 Alpine with persistence enabled (RDB snapshots + AOF append-only file).

```conf
# infra/redis/redis.conf

# === Network ===
bind 0.0.0.0
port 6379
protected-mode no
# In production (K8s), use NetworkPolicy to restrict access.
# protected-mode is off because auth is handled at the network layer.

# === Memory ===
maxmemory 512mb
maxmemory-policy allkeys-lru

# === Persistence: RDB snapshots ===
# Save if at least 1 key changed in 900 seconds (15 min)
# Save if at least 10 keys changed in 300 seconds (5 min)
# Save if at least 10000 keys changed in 60 seconds (1 min)
save 900 1
save 300 10
save 60 10000
dbfilename dump.rdb
dir /data

# === Persistence: AOF (Append Only File) ===
appendonly yes
appendfilename "appendonly.aof"
# fsync every second -- good balance of durability and performance
# BullMQ jobs will survive Redis restart
appendfsync everysec

# === Logging ===
loglevel notice
logfile ""

# === Performance ===
tcp-keepalive 300
timeout 0
databases 2
# db0 = BullMQ jobs + cache
# db1 = rate limiting + sessions
```

### 1.4 Docker Compose -- Local Development

One command starts the entire stack: `docker compose up`

```yaml
# docker-compose.yml (project root)

name: brand-me-now

services:
  # ============================================================
  # Express.js API Server + BullMQ Workers + Socket.io
  # ============================================================
  api:
    build:
      context: ./server
      dockerfile: Dockerfile
      target: build
    container_name: bmn-api
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    environment:
      - NODE_ENV=development
      - PORT=3000
      - REDIS_URL=redis://redis:6379
    volumes:
      # Hot reload: mount source code into the container
      - ./server/src:/app/src:cached
      - ./server/config:/app/config:cached
      - ./packages/shared:/app/node_modules/@bmn/shared:cached
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - bmn-network
    # In dev, use nodemon for hot reload instead of plain node
    command: >
      sh -c "
        corepack enable pnpm &&
        pnpm add -g nodemon &&
        nodemon --watch src --watch config --ext js,json,yaml src/server.js
      "
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 15s
      timeout: 5s
      start_period: 10s
      retries: 3

  # ============================================================
  # Redis 7 -- BullMQ job store, cache, rate limiting, sessions
  # ============================================================
  redis:
    image: redis:7-alpine
    container_name: bmn-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
      - ./infra/redis/redis.conf:/usr/local/etc/redis/redis.conf:ro
    command: redis-server /usr/local/etc/redis/redis.conf
    networks:
      - bmn-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      start_period: 5s
      retries: 3

  # ============================================================
  # Python AI Worker -- FastAPI (image composition only)
  # ============================================================
  python-worker:
    build:
      context: ./services/ai-worker
      dockerfile: Dockerfile
      target: runtime
    container_name: bmn-python-worker
    restart: unless-stopped
    ports:
      - "8000:8000"
    env_file:
      - .env.local
    environment:
      - PYTHONUNBUFFERED=1
    volumes:
      # Hot reload for Python
      - ./services/ai-worker/src:/app/src:cached
    depends_on:
      api:
        condition: service_healthy
    networks:
      - bmn-network
    # In dev, use uvicorn --reload for hot reload
    command: uvicorn src.api:app --host 0.0.0.0 --port 8000 --reload --reload-dir src
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8000/health"]
      interval: 15s
      timeout: 5s
      start_period: 15s
      retries: 3

  # ============================================================
  # Redis Commander -- Web UI for Redis (dev only)
  # ============================================================
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: bmn-redis-ui
    restart: unless-stopped
    ports:
      - "8081:8081"
    environment:
      - REDIS_HOSTS=local:redis:6379
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - bmn-network
    profiles:
      - debug

  # ============================================================
  # Bull Board -- BullMQ job monitoring UI (dev only)
  # ============================================================
  # Note: Bull Board runs as part of the Express server at /admin/queues
  # No separate container needed. Listed here for documentation.

# ============================================================
# Volumes
# ============================================================
volumes:
  redis-data:
    driver: local

# ============================================================
# Networks
# ============================================================
networks:
  bmn-network:
    driver: bridge
```

**Usage:**

```bash
# Start the full dev stack
docker compose up

# Start with debug tools (Redis Commander)
docker compose --profile debug up

# Start specific services
docker compose up api redis

# Rebuild after Dockerfile changes
docker compose up --build

# View logs
docker compose logs -f api

# Stop and clean up
docker compose down

# Stop and destroy volumes (wipes Redis data)
docker compose down -v
```

### 1.5 .dockerignore

```
# server/.dockerignore

node_modules
npm-debug.log*
.git
.gitignore
.env*
.env.local
.env.production
Dockerfile
docker-compose.yml
README.md
docs/
tests/
*.test.js
*.spec.js
.vscode/
.idea/
coverage/
.nyc_output/
```

```
# services/ai-worker/.dockerignore

__pycache__
*.pyc
.git
.gitignore
.env*
Dockerfile
docker-compose.yml
README.md
tests/
*.test.py
.vscode/
.idea/
.pytest_cache/
.mypy_cache/
```

### 1.6 Environment File Template

```bash
# .env.local (local development -- NEVER commit this file)

# === Supabase ===
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# === Redis ===
REDIS_URL=redis://redis:6379

# === AI Providers ===
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=AIza...
BFL_API_KEY=bfl-...
IDEOGRAM_API_KEY=ideo-...

# === Payments ===
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# === CRM (GoHighLevel) ===
GHL_CLIENT_ID=
GHL_CLIENT_SECRET=
GHL_LOCATION_ID=

# === Email ===
RESEND_API_KEY=re_...
FROM_EMAIL=hello@brandmenow.com
SUPPORT_EMAIL=support@brandmenow.com

# === Scraping ===
APIFY_API_TOKEN=apify_api_...

# === Observability ===
SENTRY_DSN=https://...@sentry.io/...
POSTHOG_API_KEY=phc_...
POSTHOG_HOST=https://app.posthog.com

# === App Config ===
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000
APP_URL=http://localhost:5173
MARKETING_URL=http://localhost:3001
PYTHON_WORKER_URL=http://python-worker:8000

# === Security ===
RESUME_TOKEN_SECRET=dev-secret-change-in-production
CORS_ORIGINS=http://localhost:5173,http://localhost:3001

# === DigitalOcean (not needed locally) ===
# DO_REGISTRY=registry.digitalocean.com/brandmenow
# DO_CLUSTER_NAME=bmn-k8s
```

---

## 2. DigitalOcean Kubernetes (Production)

### 2.1 Cluster Specification

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Region** | `nyc1` (New York) or `sfo3` (San Francisco) | US-based users. Pick closest to majority of users. Supabase cloud region should match. |
| **Kubernetes Version** | 1.31 (latest stable on DO) | Auto-upgrades enabled for patch versions. |
| **Control Plane** | DO Managed ($12/mo) | HA control plane, managed etcd, automatic upgrades. |
| **Node Pool: default** | 2x `s-2vcpu-4gb` ($24/mo each = $48/mo) | 2 vCPU, 4GB RAM per node. Runs API + Redis + Python worker. 2 nodes for HA. |
| **Node Pool: autoscale (future)** | 1-4x `s-2vcpu-4gb` | Enable when traffic justifies. HPA scales pods; cluster autoscaler scales nodes. |
| **Total Launch Cost** | $12 + $48 = **$60/mo** | Control plane + 2 worker nodes. |

**Create the cluster:**

```bash
# Install doctl (DigitalOcean CLI)
brew install doctl
doctl auth init

# Create K8s cluster
doctl kubernetes cluster create bmn-k8s \
  --region nyc1 \
  --version 1.31.1-do.2 \
  --node-pool "name=default;size=s-2vcpu-4gb;count=2;auto-scale=true;min-nodes=2;max-nodes=4" \
  --tag bmn-production

# Save kubeconfig
doctl kubernetes cluster kubeconfig save bmn-k8s

# Verify
kubectl get nodes
```

### 2.2 DigitalOcean Container Registry

```bash
# Create container registry (Basic plan: $5/mo, 5GB storage)
doctl registry create brandmenow --subscription-tier basic

# Login Docker to DO registry
doctl registry login

# The registry URL will be:
# registry.digitalocean.com/brandmenow

# Connect registry to K8s cluster (grants pull access)
doctl registry kubernetes-manifest | kubectl apply -f -
```

### 2.3 Namespace

```yaml
# k8s/namespace.yaml

apiVersion: v1
kind: Namespace
metadata:
  name: bmn-production
  labels:
    app.kubernetes.io/part-of: brand-me-now
    environment: production
```

### 2.4 ConfigMap -- Non-Secret Configuration

```yaml
# k8s/configmap.yaml

apiVersion: v1
kind: ConfigMap
metadata:
  name: bmn-config
  namespace: bmn-production
  labels:
    app.kubernetes.io/part-of: brand-me-now
data:
  NODE_ENV: "production"
  PORT: "3000"
  API_URL: "https://api.brandmenow.com"
  APP_URL: "https://app.brandmenow.com"
  MARKETING_URL: "https://brandmenow.com"
  PYTHON_WORKER_URL: "http://python-worker-service:8000"
  REDIS_URL: "redis://redis-service:6379"
  POSTHOG_HOST: "https://app.posthog.com"
  FROM_EMAIL: "hello@brandmenow.com"
  SUPPORT_EMAIL: "support@brandmenow.com"
  CORS_ORIGINS: "https://app.brandmenow.com,https://brandmenow.com"
  LOG_LEVEL: "info"
```

### 2.5 Secret -- All API Keys and Credentials

```yaml
# k8s/secret.yaml
# IMPORTANT: In production, use `kubectl create secret` or sealed-secrets.
# This file is a TEMPLATE. Never commit actual values to git.

apiVersion: v1
kind: Secret
metadata:
  name: bmn-secrets
  namespace: bmn-production
  labels:
    app.kubernetes.io/part-of: brand-me-now
type: Opaque
stringData:
  # Supabase
  SUPABASE_URL: "REPLACE_ME"
  SUPABASE_ANON_KEY: "REPLACE_ME"
  SUPABASE_SERVICE_ROLE_KEY: "REPLACE_ME"

  # AI Providers
  ANTHROPIC_API_KEY: "REPLACE_ME"
  OPENAI_API_KEY: "REPLACE_ME"
  GOOGLE_API_KEY: "REPLACE_ME"
  BFL_API_KEY: "REPLACE_ME"
  IDEOGRAM_API_KEY: "REPLACE_ME"

  # Payments
  STRIPE_SECRET_KEY: "REPLACE_ME"
  STRIPE_PUBLISHABLE_KEY: "REPLACE_ME"
  STRIPE_WEBHOOK_SECRET: "REPLACE_ME"

  # CRM
  GHL_CLIENT_ID: "REPLACE_ME"
  GHL_CLIENT_SECRET: "REPLACE_ME"
  GHL_LOCATION_ID: "REPLACE_ME"

  # Email
  RESEND_API_KEY: "REPLACE_ME"

  # Scraping
  APIFY_API_TOKEN: "REPLACE_ME"

  # Observability
  SENTRY_DSN: "REPLACE_ME"
  POSTHOG_API_KEY: "REPLACE_ME"

  # Security
  RESUME_TOKEN_SECRET: "REPLACE_ME"
```

**Creating the secret from the command line (preferred):**

```bash
kubectl create secret generic bmn-secrets \
  --namespace bmn-production \
  --from-literal=SUPABASE_URL='https://xxx.supabase.co' \
  --from-literal=SUPABASE_ANON_KEY='eyJ...' \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY='eyJ...' \
  --from-literal=ANTHROPIC_API_KEY='sk-ant-...' \
  --from-literal=OPENAI_API_KEY='sk-...' \
  --from-literal=GOOGLE_API_KEY='AIza...' \
  --from-literal=BFL_API_KEY='bfl-...' \
  --from-literal=IDEOGRAM_API_KEY='ideo-...' \
  --from-literal=STRIPE_SECRET_KEY='sk_live_...' \
  --from-literal=STRIPE_PUBLISHABLE_KEY='pk_live_...' \
  --from-literal=STRIPE_WEBHOOK_SECRET='whsec_...' \
  --from-literal=GHL_CLIENT_ID='...' \
  --from-literal=GHL_CLIENT_SECRET='...' \
  --from-literal=GHL_LOCATION_ID='...' \
  --from-literal=RESEND_API_KEY='re_...' \
  --from-literal=APIFY_API_TOKEN='apify_api_...' \
  --from-literal=SENTRY_DSN='https://...@sentry.io/...' \
  --from-literal=POSTHOG_API_KEY='phc_...' \
  --from-literal=RESUME_TOKEN_SECRET='$(openssl rand -hex 32)'
```

### 2.6 API Deployment

```yaml
# k8s/api-deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: bmn-production
  labels:
    app: api
    app.kubernetes.io/name: api
    app.kubernetes.io/part-of: brand-me-now
    app.kubernetes.io/component: server
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
        app.kubernetes.io/name: api
    spec:
      serviceAccountName: default
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
        fsGroup: 1001
      terminationGracePeriodSeconds: 30
      containers:
        - name: api
          image: registry.digitalocean.com/brandmenow/api:latest
          imagePullPolicy: Always
          ports:
            - name: http
              containerPort: 3000
              protocol: TCP
          envFrom:
            - configMapRef:
                name: bmn-config
            - secretRef:
                name: bmn-secrets
          resources:
            requests:
              cpu: "250m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 15
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 12
          lifecycle:
            preStop:
              exec:
                # Allow in-flight requests and Socket.io connections to drain
                command: ["/bin/sh", "-c", "sleep 5"]
      imagePullSecrets:
        - name: brandmenow
```

### 2.7 API Service

```yaml
# k8s/api-service.yaml

apiVersion: v1
kind: Service
metadata:
  name: api-service
  namespace: bmn-production
  labels:
    app: api
    app.kubernetes.io/name: api
    app.kubernetes.io/part-of: brand-me-now
spec:
  type: ClusterIP
  selector:
    app: api
  ports:
    - name: http
      port: 3000
      targetPort: http
      protocol: TCP
  # Socket.io requires session affinity so WebSocket upgrades
  # hit the same pod that negotiated the handshake.
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 10800
```

### 2.8 Redis StatefulSet

```yaml
# k8s/redis-statefulset.yaml

apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  namespace: bmn-production
  labels:
    app: redis
    app.kubernetes.io/name: redis
    app.kubernetes.io/part-of: brand-me-now
    app.kubernetes.io/component: cache
spec:
  serviceName: redis-service
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
        app.kubernetes.io/name: redis
    spec:
      securityContext:
        runAsUser: 999
        runAsGroup: 999
        fsGroup: 999
      terminationGracePeriodSeconds: 30
      containers:
        - name: redis
          image: redis:7-alpine
          command:
            - redis-server
            - /etc/redis/redis.conf
          ports:
            - name: redis
              containerPort: 6379
              protocol: TCP
          resources:
            requests:
              cpu: "100m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
          livenessProbe:
            exec:
              command:
                - redis-cli
                - ping
            initialDelaySeconds: 10
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            exec:
              command:
                - redis-cli
                - ping
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          volumeMounts:
            - name: redis-data
              mountPath: /data
            - name: redis-config
              mountPath: /etc/redis
              readOnly: true
      volumes:
        - name: redis-config
          configMap:
            name: redis-config
  volumeClaimTemplates:
    - metadata:
        name: redis-data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: do-block-storage
        resources:
          requests:
            storage: 5Gi
```

### 2.9 Redis ConfigMap

```yaml
# k8s/redis-configmap.yaml

apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-config
  namespace: bmn-production
  labels:
    app: redis
    app.kubernetes.io/part-of: brand-me-now
data:
  redis.conf: |
    bind 0.0.0.0
    port 6379
    protected-mode no
    maxmemory 384mb
    maxmemory-policy allkeys-lru
    save 900 1
    save 300 10
    save 60 10000
    dbfilename dump.rdb
    dir /data
    appendonly yes
    appendfilename "appendonly.aof"
    appendfsync everysec
    loglevel notice
    logfile ""
    tcp-keepalive 300
    timeout 0
    databases 2
```

### 2.10 Redis Service

```yaml
# k8s/redis-service.yaml

apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: bmn-production
  labels:
    app: redis
    app.kubernetes.io/name: redis
    app.kubernetes.io/part-of: brand-me-now
spec:
  type: ClusterIP
  selector:
    app: redis
  ports:
    - name: redis
      port: 6379
      targetPort: redis
      protocol: TCP
```

### 2.11 Python Worker Deployment

```yaml
# k8s/python-worker-deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: python-worker
  namespace: bmn-production
  labels:
    app: python-worker
    app.kubernetes.io/name: python-worker
    app.kubernetes.io/part-of: brand-me-now
    app.kubernetes.io/component: worker
spec:
  replicas: 1
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  selector:
    matchLabels:
      app: python-worker
  template:
    metadata:
      labels:
        app: python-worker
        app.kubernetes.io/name: python-worker
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        runAsGroup: 1001
      terminationGracePeriodSeconds: 30
      containers:
        - name: python-worker
          image: registry.digitalocean.com/brandmenow/python-worker:latest
          imagePullPolicy: Always
          ports:
            - name: http
              containerPort: 8000
              protocol: TCP
          envFrom:
            - secretRef:
                name: bmn-secrets
          resources:
            requests:
              cpu: "250m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 15
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
      imagePullSecrets:
        - name: brandmenow
```

### 2.12 Python Worker Service

```yaml
# k8s/python-worker-service.yaml

apiVersion: v1
kind: Service
metadata:
  name: python-worker-service
  namespace: bmn-production
  labels:
    app: python-worker
    app.kubernetes.io/name: python-worker
    app.kubernetes.io/part-of: brand-me-now
spec:
  type: ClusterIP
  selector:
    app: python-worker
  ports:
    - name: http
      port: 8000
      targetPort: http
      protocol: TCP
```

### 2.13 Ingress -- nginx-ingress with TLS

First, install the nginx-ingress controller and cert-manager on the cluster:

```bash
# Install nginx-ingress controller (DigitalOcean marketplace 1-click)
# This creates a DO Load Balancer ($12/mo) automatically
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.0/deploy/static/provider/do/deploy.yaml

# Install cert-manager for automatic Let's Encrypt certificates
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.3/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=Ready pods --all -n cert-manager --timeout=120s
```

**ClusterIssuer for Let's Encrypt:**

```yaml
# k8s/cluster-issuer.yaml

apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-production
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: matt@brandmenow.com
    privateKeySecretRef:
      name: letsencrypt-production-key
    solvers:
      - http01:
          ingress:
            class: nginx
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: matt@brandmenow.com
    privateKeySecretRef:
      name: letsencrypt-staging-key
    solvers:
      - http01:
          ingress:
            class: nginx
```

**Ingress resource:**

```yaml
# k8s/ingress.yaml

apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: bmn-ingress
  namespace: bmn-production
  labels:
    app.kubernetes.io/part-of: brand-me-now
  annotations:
    # cert-manager integration
    cert-manager.io/cluster-issuer: "letsencrypt-production"

    # nginx-ingress configuration
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "120"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "120"

    # WebSocket support for Socket.io
    nginx.ingress.kubernetes.io/proxy-http-version: "1.1"
    nginx.ingress.kubernetes.io/upstream-hash-by: "$remote_addr"
    nginx.ingress.kubernetes.io/configuration-snippet: |
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";

    # Security headers
    nginx.ingress.kubernetes.io/server-snippet: |
      add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
      add_header X-Content-Type-Options "nosniff" always;
      add_header X-Frame-Options "DENY" always;
      add_header X-XSS-Protection "1; mode=block" always;
      add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate limiting at ingress level (defense in depth -- Express also rate-limits)
    nginx.ingress.kubernetes.io/limit-rps: "20"
    nginx.ingress.kubernetes.io/limit-burst-multiplier: "5"

    # Force HTTPS redirect
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.brandmenow.com
      secretName: bmn-api-tls
  rules:
    - host: api.brandmenow.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 3000
```

### 2.14 NetworkPolicy -- Least-Privilege Network Access

```yaml
# k8s/network-policies.yaml

# === Default deny all ingress in the namespace ===
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: bmn-production
spec:
  podSelector: {}
  policyTypes:
    - Ingress

---
# === API: allow ingress from nginx-ingress controller and from within namespace ===
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-ingress
  namespace: bmn-production
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
    - Ingress
  ingress:
    # Allow traffic from nginx-ingress controller (external traffic)
    - from:
        - namespaceSelector:
            matchLabels:
              app.kubernetes.io/name: ingress-nginx
      ports:
        - protocol: TCP
          port: 3000

---
# === Redis: ONLY the api pods can reach Redis ===
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-redis-from-api-only
  namespace: bmn-production
spec:
  podSelector:
    matchLabels:
      app: redis
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api
      ports:
        - protocol: TCP
          port: 6379

---
# === Python Worker: ONLY the api pods can reach the Python worker ===
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-python-worker-from-api-only
  namespace: bmn-production
spec:
  podSelector:
    matchLabels:
      app: python-worker
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api
      ports:
        - protocol: TCP
          port: 8000
```

### 2.15 HorizontalPodAutoscaler

```yaml
# k8s/hpa.yaml

apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
  namespace: bmn-production
  labels:
    app: api
    app.kubernetes.io/part-of: brand-me-now
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 2
  maxReplicas: 8
  metrics:
    # Scale up when average CPU exceeds 70%
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    # Scale up when average memory exceeds 80%
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120
```

**Note:** The DO K8s cluster must have the metrics-server installed for HPA to work. DigitalOcean K8s clusters include it by default.

### 2.16 Domain Configuration

Point `api.brandmenow.com` to the nginx-ingress Load Balancer:

```bash
# Get the Load Balancer external IP assigned by nginx-ingress
kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}'

# Create an A record:
# api.brandmenow.com → <LOAD_BALANCER_IP>
```

### 2.17 Full Cluster Apply Script

```bash
#!/bin/bash
# scripts/k8s-apply.sh -- Apply all K8s manifests in order

set -euo pipefail

NAMESPACE="bmn-production"

echo "=== Applying Brand Me Now K8s manifests ==="

# 1. Namespace
kubectl apply -f k8s/namespace.yaml

# 2. cert-manager issuer
kubectl apply -f k8s/cluster-issuer.yaml

# 3. Config and secrets
kubectl apply -f k8s/configmap.yaml
# Secret should already be created via `kubectl create secret` (see 2.5)

# 4. Redis (must be up before API)
kubectl apply -f k8s/redis-configmap.yaml
kubectl apply -f k8s/redis-statefulset.yaml
kubectl apply -f k8s/redis-service.yaml
echo "Waiting for Redis to be ready..."
kubectl rollout status statefulset/redis -n $NAMESPACE --timeout=120s

# 5. Python worker
kubectl apply -f k8s/python-worker-deployment.yaml
kubectl apply -f k8s/python-worker-service.yaml

# 6. API
kubectl apply -f k8s/api-deployment.yaml
kubectl apply -f k8s/api-service.yaml
echo "Waiting for API to be ready..."
kubectl rollout status deployment/api -n $NAMESPACE --timeout=180s

# 7. Ingress
kubectl apply -f k8s/ingress.yaml

# 8. Network policies
kubectl apply -f k8s/network-policies.yaml

# 9. Autoscaler
kubectl apply -f k8s/hpa.yaml

echo "=== All manifests applied ==="
echo ""
kubectl get all -n $NAMESPACE
```

---

## 3. Starter Option (Single Droplet)

For launch, a single DigitalOcean droplet is simpler and cheaper than a full K8s cluster. Kubernetes adds complexity that is not justified below ~5,000 active users. This is the recommended path for day one.

### 3.1 Droplet Specification

| Parameter | Value |
|-----------|-------|
| **Plan** | Basic (Regular Intel) |
| **Size** | `s-2vcpu-4gb` |
| **Cost** | $24/mo (or $48/mo for `s-4vcpu-8gb` if you want headroom) |
| **Region** | `nyc1` or `sfo3` |
| **Image** | Ubuntu 24.04 LTS |
| **Extras** | Monitoring enabled, backups enabled ($4.80/mo) |

### 3.2 Initial Server Setup

```bash
# SSH into the droplet
ssh root@<DROPLET_IP>

# === System updates ===
apt update && apt upgrade -y

# === Create non-root user ===
adduser bmn
usermod -aG sudo bmn
rsync --archive --chown=bmn:bmn ~/.ssh /home/bmn

# === Firewall ===
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# === Install Docker ===
curl -fsSL https://get.docker.com | sh
usermod -aG docker bmn

# === Install Docker Compose (v2 plugin) ===
apt install docker-compose-plugin -y

# === Install Nginx ===
apt install nginx -y

# === Install Certbot for Let's Encrypt ===
apt install certbot python3-certbot-nginx -y

# Switch to bmn user for all subsequent operations
su - bmn
```

### 3.3 Docker Compose for Production Droplet

```yaml
# /home/bmn/brand-me-now/docker-compose.prod.yml

name: brand-me-now-prod

services:
  api:
    image: registry.digitalocean.com/brandmenow/api:latest
    container_name: bmn-api
    restart: always
    ports:
      - "127.0.0.1:3000:3000"
    env_file:
      - .env.production
    environment:
      - NODE_ENV=production
      - PORT=3000
      - REDIS_URL=redis://redis:6379
      - PYTHON_WORKER_URL=http://python-worker:8000
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - bmn-network
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: "1.0"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      start_period: 15s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  redis:
    image: redis:7-alpine
    container_name: bmn-redis
    restart: always
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis-data:/data
      - ./redis.conf:/usr/local/etc/redis/redis.conf:ro
    command: redis-server /usr/local/etc/redis/redis.conf
    networks:
      - bmn-network
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "0.5"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      start_period: 5s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: "5m"
        max-file: "3"

  python-worker:
    image: registry.digitalocean.com/brandmenow/python-worker:latest
    container_name: bmn-python-worker
    restart: always
    ports:
      - "127.0.0.1:8000:8000"
    env_file:
      - .env.production
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - bmn-network
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "0.5"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8000/health"]
      interval: 30s
      timeout: 5s
      start_period: 15s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: "5m"
        max-file: "3"

  # === Watchtower: auto-pull new images and restart containers ===
  watchtower:
    image: containrrr/watchtower
    container_name: bmn-watchtower
    restart: always
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /home/bmn/.docker/config.json:/config.json:ro
    environment:
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_POLL_INTERVAL=60
      - WATCHTOWER_INCLUDE_STOPPED=false
      - WATCHTOWER_ROLLING_RESTART=true
    networks:
      - bmn-network

volumes:
  redis-data:
    driver: local

networks:
  bmn-network:
    driver: bridge
```

### 3.4 Nginx Reverse Proxy with Let's Encrypt

```nginx
# /etc/nginx/sites-available/api.brandmenow.com

upstream bmn_api {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name api.brandmenow.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.brandmenow.com;

    # SSL certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/api.brandmenow.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.brandmenow.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Request size limit
    client_max_body_size 10M;

    # Proxy timeouts (longer for AI generation endpoints)
    proxy_connect_timeout 10s;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;

    # === API routes ===
    location / {
        proxy_pass http://bmn_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        # CORS is handled by Express, not Nginx
    }

    # === Socket.io WebSocket upgrade ===
    location /socket.io/ {
        proxy_pass http://bmn_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket connections can be long-lived
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Health check (bypass logging)
    location /health {
        proxy_pass http://bmn_api;
        access_log off;
    }
}
```

**Enable the site and get the certificate:**

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/api.brandmenow.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get Let's Encrypt certificate
sudo certbot --nginx -d api.brandmenow.com --email matt@brandmenow.com --agree-tos --non-interactive

# Verify auto-renewal
sudo certbot renew --dry-run
```

### 3.5 Systemd Service for Docker Compose

```ini
# /etc/systemd/system/bmn.service

[Unit]
Description=Brand Me Now Production Stack
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=true
User=bmn
Group=docker
WorkingDirectory=/home/bmn/brand-me-now
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
ExecReload=/usr/bin/docker compose -f docker-compose.prod.yml restart

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable bmn
sudo systemctl start bmn
sudo systemctl status bmn
```

### 3.6 When to Migrate to Kubernetes

Migrate from single droplet to DO K8s when:

| Signal | Threshold |
|--------|-----------|
| Monthly active users | >5,000 |
| Concurrent WebSocket connections | >500 |
| API p95 latency creeping above 500ms under normal load | Consistently |
| Single droplet CPU sustained above 80% | More than 10 min/hour |
| You need zero-downtime deploys | When downtime during deploy is unacceptable |
| You need horizontal autoscaling | When traffic is bursty (marketing campaign, viral moment) |
| Monthly revenue | >$5,000 MRR (can justify $72/mo K8s cost) |

**Migration path:** The Docker images are already built for both environments. Switching from `docker-compose.prod.yml` on a droplet to K8s manifests requires zero code changes -- only infrastructure changes. The same Docker images, same env vars, same health checks.

---

## 4. CI/CD (GitHub Actions)

### 4.1 CI Pipeline -- Run on Every PR

```yaml
# .github/workflows/ci.yml

name: CI

on:
  pull_request:
    branches: [main]
    paths-ignore:
      - "docs/**"
      - "*.md"
      - ".gitignore"

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ===========================================================
  # Lint + Type Check
  # ===========================================================
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: ESLint (server)
        run: pnpm --filter server lint

      - name: ESLint (web app)
        run: pnpm --filter web lint

      - name: Type check with JSDoc (server)
        run: pnpm --filter server typecheck

      - name: Type check with JSDoc (web app)
        run: pnpm --filter web typecheck

  # ===========================================================
  # Test
  # ===========================================================
  test:
    name: Test
    runs-on: ubuntu-latest
    needs: lint
    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run server tests
        run: pnpm --filter server test
        env:
          REDIS_URL: redis://localhost:6379
          NODE_ENV: test

      - name: Run web app tests
        run: pnpm --filter web test

      - name: Run shared package tests
        run: pnpm --filter @bmn/shared test

  # ===========================================================
  # Python Worker Tests
  # ===========================================================
  test-python:
    name: Test Python Worker
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Python 3.13
        uses: actions/setup-python@v5
        with:
          python-version: "3.13"

      - name: Install dependencies
        working-directory: services/ai-worker
        run: |
          pip install -r requirements.txt
          pip install pytest httpx

      - name: Run tests
        working-directory: services/ai-worker
        run: pytest tests/ -v

  # ===========================================================
  # Docker Build (verify images build successfully)
  # ===========================================================
  docker-build:
    name: Docker Build
    runs-on: ubuntu-latest
    needs: [test, test-python]
    strategy:
      matrix:
        include:
          - context: ./server
            image: api
          - context: ./services/ai-worker
            image: python-worker
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build ${{ matrix.image }} image
        uses: docker/build-push-action@v6
        with:
          context: ${{ matrix.context }}
          push: false
          tags: brandmenow/${{ matrix.image }}:ci
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ===========================================================
  # Security: Dependency Audit
  # ===========================================================
  security:
    name: Security Audit
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: npm audit (server)
        run: cd server && pnpm audit --audit-level=critical
        continue-on-error: true

      - name: Trivy scan (API image)
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: "fs"
          scan-ref: "./server"
          severity: "CRITICAL,HIGH"
          exit-code: "1"
```

### 4.2 Deploy API -- On Push to Main

```yaml
# .github/workflows/deploy-api.yml

name: Deploy API

on:
  push:
    branches: [main]
    paths:
      - "server/**"
      - "packages/shared/**"
      - "k8s/**"
      - ".github/workflows/deploy-api.yml"

concurrency:
  group: deploy-api
  cancel-in-progress: false

env:
  REGISTRY: registry.digitalocean.com/brandmenow
  API_IMAGE: registry.digitalocean.com/brandmenow/api
  PYTHON_IMAGE: registry.digitalocean.com/brandmenow/python-worker

jobs:
  # ===========================================================
  # Build & Push API Image
  # ===========================================================
  build-api:
    name: Build & Push API
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.version }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Install doctl
        uses: digitalocean/action-doctl@v2
        with:
          token: ${{ secrets.DO_API_TOKEN }}

      - name: Login to DO Container Registry
        run: doctl registry login --expiry-seconds 600

      - name: Docker meta
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.API_IMAGE }}
          tags: |
            type=sha,prefix=
            type=raw,value=latest

      - name: Build and push API image
        uses: docker/build-push-action@v6
        with:
          context: ./server
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Trivy vulnerability scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: "${{ env.API_IMAGE }}:latest"
          severity: "CRITICAL"
          exit-code: "0"

  # ===========================================================
  # Build & Push Python Worker Image
  # ===========================================================
  build-python:
    name: Build & Push Python Worker
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Install doctl
        uses: digitalocean/action-doctl@v2
        with:
          token: ${{ secrets.DO_API_TOKEN }}

      - name: Login to DO Container Registry
        run: doctl registry login --expiry-seconds 600

      - name: Docker meta
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.PYTHON_IMAGE }}
          tags: |
            type=sha,prefix=
            type=raw,value=latest

      - name: Build and push Python Worker image
        uses: docker/build-push-action@v6
        with:
          context: ./services/ai-worker
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ===========================================================
  # Deploy to Kubernetes (or Droplet via SSH)
  # ===========================================================
  deploy-k8s:
    name: Deploy to K8s
    runs-on: ubuntu-latest
    needs: [build-api, build-python]
    # Only deploy if on main branch
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install doctl
        uses: digitalocean/action-doctl@v2
        with:
          token: ${{ secrets.DO_API_TOKEN }}

      - name: Configure kubectl
        run: doctl kubernetes cluster kubeconfig save bmn-k8s

      - name: Deploy API (rolling update)
        run: |
          kubectl set image deployment/api \
            api=${{ env.API_IMAGE }}:${{ needs.build-api.outputs.image-tag }} \
            -n bmn-production
          kubectl rollout status deployment/api -n bmn-production --timeout=180s

      - name: Deploy Python Worker (rolling update)
        run: |
          kubectl set image deployment/python-worker \
            python-worker=${{ env.PYTHON_IMAGE }}:latest \
            -n bmn-production
          kubectl rollout status deployment/python-worker -n bmn-production --timeout=120s

      - name: Verify deployment health
        run: |
          # Wait 30 seconds for pods to stabilize
          sleep 30
          # Check all pods are running
          kubectl get pods -n bmn-production
          # Check no recent restarts
          RESTARTS=$(kubectl get pods -n bmn-production -o jsonpath='{.items[*].status.containerStatuses[*].restartCount}' | tr ' ' '\n' | awk '{s+=$1} END {print s}')
          echo "Total restarts: $RESTARTS"

      - name: Notify on failure
        if: failure()
        run: |
          echo "::error::Deployment failed! Rolling back..."
          kubectl rollout undo deployment/api -n bmn-production
          kubectl rollout undo deployment/python-worker -n bmn-production

  # ===========================================================
  # Alternative: Deploy to Single Droplet via SSH
  # ===========================================================
  deploy-droplet:
    name: Deploy to Droplet (SSH)
    runs-on: ubuntu-latest
    needs: [build-api, build-python]
    if: false  # Set to true when using droplet instead of K8s
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DROPLET_IP }}
          username: bmn
          key: ${{ secrets.DROPLET_SSH_KEY }}
          script: |
            cd /home/bmn/brand-me-now
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d --remove-orphans
            docker image prune -f
            echo "=== Deployment complete ==="
            docker compose -f docker-compose.prod.yml ps
```

### 4.3 Deploy Marketing Site -- Vercel

```yaml
# .github/workflows/deploy-marketing.yml

name: Deploy Marketing Site

on:
  push:
    branches: [main]
    paths:
      - "apps/marketing/**"
      - ".github/workflows/deploy-marketing.yml"
  workflow_dispatch:

jobs:
  deploy:
    name: Deploy to Vercel
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Install Vercel CLI
        run: pnpm add -g vercel

      - name: Pull Vercel Environment
        run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
        working-directory: apps/marketing

      - name: Build
        run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
        working-directory: apps/marketing

      - name: Deploy
        run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
        working-directory: apps/marketing
```

**Note:** Vercel also auto-deploys on push when connected to the GitHub repo. This workflow is for explicit control or when you need to trigger a marketing deploy independently. Vercel automatically creates preview deployments for PRs that touch `apps/marketing/`.

### 4.4 GitHub Actions Secrets Required

These must be set in the GitHub repository under Settings > Secrets and variables > Actions:

| Secret Name | Description | Where to Get It |
|-------------|-------------|-----------------|
| `DO_API_TOKEN` | DigitalOcean personal access token | DO Control Panel > API > Tokens |
| `DROPLET_IP` | Droplet public IP (starter option only) | DO Control Panel > Droplets |
| `DROPLET_SSH_KEY` | SSH private key for droplet (starter only) | Your SSH key |
| `VERCEL_TOKEN` | Vercel API token | Vercel > Settings > Tokens |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source maps | Sentry > Settings > Auth Tokens |

**All application secrets** (API keys, database URLs) live in K8s Secrets or the `.env.production` file on the droplet -- NOT in GitHub Actions secrets. GitHub Actions only needs infrastructure access tokens.

---

## 5. DNS & SSL

### 5.1 Domain Architecture

| Domain | Points To | Purpose |
|--------|-----------|---------|
| `brandmenow.com` | Vercel | Marketing site (Next.js SSG) |
| `www.brandmenow.com` | Redirect to `brandmenow.com` | SEO canonical |
| `app.brandmenow.com` | Vercel (or Cloudflare Pages) | Brand Builder SPA (React + Vite) |
| `api.brandmenow.com` | DO Load Balancer (K8s Ingress) or Droplet IP | Express.js API + Socket.io |
| `cdn.brandmenow.com` | DO Spaces CDN or Cloudflare R2 | Generated images CDN |

### 5.2 DNS Configuration

Use Cloudflare as DNS provider (free plan) for global anycast DNS, DDoS protection, and automatic HTTPS.

```
# Cloudflare DNS Records

# Marketing site (Vercel)
brandmenow.com          A       76.76.21.21           (Vercel)  Proxied
www.brandmenow.com      CNAME   brandmenow.com                  Proxied (redirect rule)

# Brand Builder SPA (Vercel or Cloudflare Pages)
app.brandmenow.com      CNAME   cname.vercel-dns.com            Proxied

# API Server (DigitalOcean)
api.brandmenow.com      A       <DO_LOAD_BALANCER_IP>           Proxied

# CDN for generated images (DO Spaces)
cdn.brandmenow.com      CNAME   brandmenow.nyc3.cdn.digitaloceanspaces.com    Proxied

# Email (for Resend)
brandmenow.com          MX      feedback-smtp.us-east-1.amazonses.com   (priority 10)
brandmenow.com          TXT     "v=spf1 include:amazonses.com ~all"
resend._domainkey       CNAME   resend._domainkey.brandmenow.com
_dmarc.brandmenow.com   TXT     "v=DMARC1; p=quarantine; rua=mailto:matt@brandmenow.com"
```

### 5.3 TLS Certificates

**On K8s:** cert-manager handles TLS certificates automatically via Let's Encrypt (see section 2.13). Certificates are stored as K8s Secrets and auto-renewed 30 days before expiry.

**On Droplet:** Certbot handles TLS certificates (see section 3.4). Auto-renewal is configured via systemd timer.

**Cloudflare layer:** When Cloudflare proxy is enabled (orange cloud), Cloudflare terminates TLS at the edge and re-encrypts to the origin. This gives you:
- Free universal SSL certificate at the edge
- DDoS protection
- WAF rules (optional)
- HTTP/3 and QUIC

### 5.4 HSTS Configuration

HSTS is configured at two levels:

1. **Cloudflare:** Enable HSTS in Cloudflare dashboard > SSL/TLS > Edge Certificates > HSTS.
   - Max-Age: 12 months (31536000)
   - Include subdomains: Yes
   - Preload: Yes
   - No-Sniff: Yes

2. **Application level:** Express.js Helmet middleware sets the header:
   ```javascript
   app.use(helmet.hsts({
     maxAge: 63072000, // 2 years
     includeSubDomains: true,
     preload: true,
   }));
   ```

3. **Nginx level (droplet):** The `add_header Strict-Transport-Security` directive in the Nginx config (section 3.4).

4. **K8s Ingress level:** The `server-snippet` annotation on the Ingress (section 2.13).

After confirming everything works, submit to the HSTS preload list: https://hstspreload.org/

---

## 6. Image/Asset CDN

### 6.1 Storage Backend: DigitalOcean Spaces

DO Spaces is S3-compatible object storage with a built-in CDN. $5/mo for 250GB storage + 1TB transfer.

```bash
# Create a Space
doctl compute spaces create brandmenow-assets \
  --region nyc3

# The endpoints will be:
# Origin:  brandmenow-assets.nyc3.digitaloceanspaces.com
# CDN:     brandmenow-assets.nyc3.cdn.digitaloceanspaces.com
```

**Enable CDN on the Space:** DO Control Panel > Spaces > brandmenow-assets > Settings > Enable CDN.

Set custom subdomain: `cdn.brandmenow.com` pointing to the Spaces CDN endpoint.

### 6.2 Spaces Access Keys

```bash
# Generate Spaces access keys
# DO Control Panel > API > Spaces Keys > Generate New Key
# Store as environment variables:

DO_SPACES_KEY=<access-key>
DO_SPACES_SECRET=<secret-key>
DO_SPACES_BUCKET=brandmenow-assets
DO_SPACES_REGION=nyc3
DO_SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
DO_SPACES_CDN_URL=https://cdn.brandmenow.com
```

### 6.3 Upload Service (Express.js)

```javascript
// server/src/services/storage.js

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';

const s3 = new S3Client({
  endpoint: process.env.DO_SPACES_ENDPOINT,
  region: process.env.DO_SPACES_REGION,
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
  },
  forcePathStyle: false,
});

/**
 * Upload a generated image to DO Spaces
 * @param {Buffer} imageBuffer - The image data
 * @param {string} brandId - Brand ID for path organization
 * @param {'logo'|'mockup'|'bundle'|'social_asset'} assetType
 * @param {string} [format='png'] - Image format
 * @returns {Promise<{url: string, cdnUrl: string, key: string}>}
 */
export async function uploadGeneratedImage(imageBuffer, brandId, assetType, format = 'png') {
  const key = `brands/${brandId}/${assetType}/${randomUUID()}.${format}`;

  await s3.send(new PutObjectCommand({
    Bucket: process.env.DO_SPACES_BUCKET,
    Key: key,
    Body: imageBuffer,
    ContentType: `image/${format}`,
    ACL: 'public-read',
    CacheControl: 'public, max-age=31536000, immutable',
    Metadata: {
      'brand-id': brandId,
      'asset-type': assetType,
      'generated-at': new Date().toISOString(),
    },
  }));

  return {
    key,
    url: `${process.env.DO_SPACES_ENDPOINT}/${process.env.DO_SPACES_BUCKET}/${key}`,
    cdnUrl: `${process.env.DO_SPACES_CDN_URL}/${key}`,
  };
}
```

### 6.4 Upload Flow: BullMQ Worker to CDN

```
1. User clicks "Generate Logo"
2. Express handler queues BullMQ job
3. BullMQ worker picks up job
4. Worker calls BFL API (FLUX.2 Pro) -- receives image URL or base64
5. Worker downloads/decodes image to Buffer
6. Worker calls uploadGeneratedImage() -- uploads to DO Spaces
7. Worker saves CDN URL to brand_assets table in Supabase
8. Worker emits Socket.io event with CDN URL
9. Client displays image from cdn.brandmenow.com (global CDN)
```

### 6.5 Spaces Directory Structure

```
brandmenow-assets/
  brands/
    {brand-id}/
      logo/
        {uuid}.png
        {uuid}.png
      mockup/
        {uuid}.png
      bundle/
        {uuid}.png
      social_asset/
        {uuid}.png
  templates/
    products/
      tshirt-template.png
      hoodie-template.png
      ...
```

### 6.6 Alternative: Cloudflare R2

If you prefer zero egress fees, Cloudflare R2 is an alternative. The upload service code is identical (R2 is S3-compatible). The only changes:

```bash
# R2 endpoint
DO_SPACES_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
DO_SPACES_BUCKET=brandmenow-assets
DO_SPACES_CDN_URL=https://cdn.brandmenow.com  # Custom domain on R2
```

**Trade-off:** DO Spaces has a simpler setup (same platform as everything else). R2 has zero egress fees but requires a Cloudflare account and separate billing.

---

## 7. Backup & Disaster Recovery

### 7.1 Supabase -- Point-in-Time Recovery (PITR)

Supabase Pro plan includes PITR. No action needed beyond enabling it.

| What | How | RPO | RTO |
|------|-----|-----|-----|
| PostgreSQL database | Supabase PITR (WAL archiving) | ~seconds | ~5-15 minutes |
| Auth data | Part of PostgreSQL | Same | Same |
| Storage objects | Supabase Storage (replicated) | Near-zero | Automatic |

**Recovery:** Supabase dashboard > Settings > Database > Point-in-Time Recovery > Select timestamp.

### 7.2 Redis Persistence

Redis is configured with both RDB snapshots and AOF (see redis.conf in section 1.3).

| Method | Data Loss Window | Recovery |
|--------|-----------------|----------|
| RDB snapshots | Up to 15 minutes (worst case) | Automatic on Redis restart -- loads `dump.rdb` |
| AOF append-only | Up to 1 second (`appendfsync everysec`) | Automatic on Redis restart -- replays `appendonly.aof` |
| Combined (RDB + AOF) | ~1 second | Redis prefers AOF if both exist |

**On K8s:** The PersistentVolumeClaim (PVC) backed by `do-block-storage` persists Redis data across pod restarts. The StatefulSet ensures the same PVC is always attached.

**On Droplet:** The Docker volume `redis-data` persists across container restarts. The DO droplet backup feature ($4.80/mo) creates weekly full-droplet snapshots.

**What if Redis data is lost?** BullMQ jobs in progress will be lost. The application should handle this gracefully:
- In-flight generation jobs: Users see "Generation failed, please retry." The Supabase `generation_jobs` table records the job as `failed`.
- Rate limit counters: Reset (temporarily allowing more requests). Harmless.
- Cache: Regenerated on next request. No data loss.
- Sessions: Users may need to re-authenticate. Minor inconvenience.

### 7.3 DO Spaces / R2 Backup

Generated images on DO Spaces are the primary copy. Supabase Storage can serve as a secondary copy for critical assets (selected logos).

| Strategy | Implementation | Frequency |
|----------|---------------|-----------|
| Cross-region replication | Enable DO Spaces CDN (cached globally) | Real-time |
| Version control | Enable versioning on the Space | On every upload |
| Database URL backup | All CDN URLs stored in `brand_assets` table | On every upload |

**If a Space is deleted:** Restore from Supabase `brand_assets` table URLs (if CDN cache is still warm) or re-generate assets (they are AI-generated, not user-uploaded originals).

### 7.4 Recovery Runbook

```
=================================================================
BRAND ME NOW -- DISASTER RECOVERY RUNBOOK
=================================================================

SCENARIO 1: API pods crashing (K8s)
-----------------------------------------------------------------
1. Check pod status:    kubectl get pods -n bmn-production
2. Check pod logs:      kubectl logs -n bmn-production deployment/api --tail=100
3. Check events:        kubectl describe pod <pod-name> -n bmn-production
4. If OOMKilled:        Increase memory limits in k8s/api-deployment.yaml
5. If CrashLoopBackOff: Check env vars, check Sentry for errors
6. Rollback:            kubectl rollout undo deployment/api -n bmn-production

SCENARIO 2: Redis data loss
-----------------------------------------------------------------
1. Check Redis status:  kubectl exec -it redis-0 -n bmn-production -- redis-cli info persistence
2. If PVC exists:       Redis auto-recovers from RDB/AOF on restart
3. If PVC lost:         BullMQ jobs lost. No user data lost (Supabase is source of truth)
4. Clear stuck jobs:    Connect to Redis, FLUSHDB (only if needed)
5. Monitor:             Watch Sentry for job-related errors for 30 min

SCENARIO 3: Supabase outage
-----------------------------------------------------------------
1. Check status:        https://status.supabase.com/
2. Impact:              Auth fails (users can't login), DB queries fail
3. Mitigation:          Express health check returns 503, frontend shows maintenance page
4. No action needed:    Supabase manages recovery. PITR handles data.
5. After recovery:      Check generation_jobs for stuck 'processing' jobs, re-queue

SCENARIO 4: DO Spaces outage
-----------------------------------------------------------------
1. Impact:              Generated images not loading (CDN down)
2. Check:               curl https://cdn.brandmenow.com/health-check.txt
3. Mitigation:          Images are cached in Cloudflare CDN (if using proxy)
4. Alt:                 Serve from Supabase Storage URLs (stored in brand_assets.metadata)

SCENARIO 5: Full droplet failure (starter option)
-----------------------------------------------------------------
1. Create new droplet from latest backup snapshot
2. Restore Docker volumes (Redis data)
3. Pull latest images:  docker compose -f docker-compose.prod.yml pull
4. Start services:      docker compose -f docker-compose.prod.yml up -d
5. Update DNS:          Point api.brandmenow.com to new droplet IP
6. Verify:              curl https://api.brandmenow.com/health

SCENARIO 6: API key compromised
-----------------------------------------------------------------
1. Identify which key:  Check audit_log for unusual activity
2. Rotate immediately:  Generate new key at provider dashboard
3. Update secret:       kubectl create secret (K8s) or edit .env.production (droplet)
4. Restart pods:        kubectl rollout restart deployment/api -n bmn-production
5. Audit:               Check Sentry for any unauthorized calls during exposure window
6. Notify:              If user data exposed, notify affected users per GDPR
=================================================================
```

---

## 8. Monitoring & Alerts

### 8.1 Monitoring Stack

| Layer | Tool | What It Monitors |
|-------|------|-----------------|
| **Infrastructure** | DO Monitoring (built-in) | Droplet/node CPU, memory, disk, network, bandwidth |
| **K8s Resources** | DO Kubernetes Monitoring (built-in) | Pod status, node status, resource utilization, events |
| **Application Errors** | Sentry | Exceptions, unhandled rejections, error rates, breadcrumbs |
| **Application Performance** | Sentry Performance | Request latency (p50/p95/p99), slow queries, transaction traces |
| **Product Analytics** | PostHog | User funnels, wizard completion, feature usage, session replay |
| **Uptime** | Betterstack (or DO uptime checks) | Synthetic HTTP checks every 60s from global locations |
| **Logging** | pino (Node.js) + structlog (Python) | Structured JSON logs with correlation IDs |

### 8.2 DO Monitoring Alerts

Configure in DO Control Panel > Monitoring > Alerts:

| Alert | Condition | Channel |
|-------|-----------|---------|
| **High CPU** | CPU > 80% for 5 minutes | Email + Slack |
| **High Memory** | Memory > 85% for 5 minutes | Email + Slack |
| **Disk Full** | Disk > 90% used | Email + Slack |
| **Droplet Down** | Droplet unresponsive for 2 minutes | Email + Slack |
| **K8s Node Not Ready** | Node status != Ready for 5 min | Email + Slack |

### 8.3 Application Alert Rules (Sentry)

Configure in Sentry > Alerts:

| Alert | Condition | Action |
|-------|-----------|--------|
| **Error Spike** | >50 errors in 5 minutes | Email + Slack #alerts |
| **Unhandled Exception** | Any unhandled rejection/exception | Email immediately |
| **Slow API** | p95 latency > 500ms for 10 minutes | Email + Slack |
| **Auth Failures** | >10 auth failures in 1 minute | Email immediately (brute force detection) |
| **Generation Failures** | >5 generation job failures in 5 minutes | Email + Slack |
| **Cost Anomaly** | AI generation spend > $10 in 1 hour | Email immediately |

### 8.4 Kubernetes Resource Monitoring

```bash
# Check pod resource usage
kubectl top pods -n bmn-production

# Check node resource usage
kubectl top nodes

# Check HPA status
kubectl get hpa -n bmn-production

# Check recent events (errors, warnings)
kubectl get events -n bmn-production --sort-by='.lastTimestamp' | tail -20

# Check pod restarts
kubectl get pods -n bmn-production -o wide
```

### 8.5 Health Check Endpoints

The Express.js server exposes a health check that verifies all critical dependencies:

```javascript
// server/src/routes/health.js

import { redis } from '../services/redis.js';
import { supabase } from '../services/supabase.js';

/**
 * GET /health -- Used by K8s liveness/readiness probes, Nginx, DO monitoring
 * Returns 200 if all critical services are reachable.
 * Returns 503 with details if any dependency is down.
 */
export async function healthCheck(req, res) {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || 'unknown',
    checks: {},
  };

  // Redis check
  try {
    const start = Date.now();
    await redis.ping();
    checks.checks.redis = { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    checks.checks.redis = { status: 'error', message: err.message };
    checks.status = 'degraded';
  }

  // Supabase check
  try {
    const start = Date.now();
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error) throw error;
    checks.checks.supabase = { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    checks.checks.supabase = { status: 'error', message: err.message };
    checks.status = 'degraded';
  }

  const statusCode = checks.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(checks);
}
```

### 8.6 Log Aggregation

In the K8s environment, pod logs are available via `kubectl logs`. For the droplet, Docker JSON log driver captures logs (configured with size rotation in docker-compose.prod.yml).

For centralized log aggregation (optional, add when needed):
- **Option A:** DO Managed Logs (if available in your region)
- **Option B:** Betterstack Logs (push from pino via HTTP transport)
- **Option C:** Self-hosted Loki + Grafana on the K8s cluster

At launch, `kubectl logs` + Sentry breadcrumbs is sufficient. Add centralized logging when you have >3 services or need cross-service trace correlation.

---

## 9. Environment Management

### 9.1 Environment Overview

| Environment | Infrastructure | Purpose | URL |
|-------------|---------------|---------|-----|
| **Development** | Local Docker Compose | Developer machines. Hot reload. Mock external services. | `localhost:3000` (API), `localhost:5173` (SPA) |
| **Staging** | DO Droplet ($12/mo `s-1vcpu-2gb`) or K8s namespace `bmn-staging` | Pre-production testing. Real external services with test API keys. | `staging-api.brandmenow.com` |
| **Production** | DO K8s cluster or DO Droplet ($24-48/mo) | Live users. Real API keys. Full monitoring. | `api.brandmenow.com` |

### 9.2 Environment Variables Per Environment

| Variable | Development | Staging | Production |
|----------|-------------|---------|-----------|
| `NODE_ENV` | `development` | `staging` | `production` |
| `API_URL` | `http://localhost:3000` | `https://staging-api.brandmenow.com` | `https://api.brandmenow.com` |
| `APP_URL` | `http://localhost:5173` | `https://staging-app.brandmenow.com` | `https://app.brandmenow.com` |
| `REDIS_URL` | `redis://redis:6379` | `redis://redis:6379` | `redis://redis-service:6379` |
| `SUPABASE_URL` | Local or dev project | Staging Supabase project | Production Supabase project |
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_test_...` | `sk_live_...` |
| `ANTHROPIC_API_KEY` | Real key (dev usage) | Real key (test usage) | Real key (production) |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3001` | `https://staging-app.brandmenow.com` | `https://app.brandmenow.com,https://brandmenow.com` |
| `LOG_LEVEL` | `debug` | `info` | `info` |
| `SENTRY_DSN` | Empty (disabled locally) | Staging Sentry project | Production Sentry project |

### 9.3 Environment Variable Storage

| Environment | Storage Method | File/Location |
|-------------|---------------|---------------|
| Development | `.env.local` file (gitignored) | Project root |
| Staging (Droplet) | `.env.staging` file on server | `/home/bmn/brand-me-now/.env.staging` |
| Staging (K8s) | K8s ConfigMap + Secret in `bmn-staging` namespace | `k8s/staging/` |
| Production (Droplet) | `.env.production` file on server | `/home/bmn/brand-me-now/.env.production` |
| Production (K8s) | K8s ConfigMap + Secret in `bmn-production` namespace | `k8s/configmap.yaml` + `k8s/secret.yaml` |
| CI/CD | GitHub Actions Secrets | Repository settings |
| Marketing Site | Vercel Environment Variables | Vercel dashboard |

### 9.4 Secret Rotation Schedule

| Secret | Rotation Frequency | How |
|--------|-------------------|-----|
| AI provider API keys | Quarterly | Regenerate at provider dashboard, update K8s Secret |
| `RESUME_TOKEN_SECRET` | Quarterly | `openssl rand -hex 32`, update K8s Secret |
| `SUPABASE_SERVICE_ROLE_KEY` | On compromise only | Regenerate in Supabase dashboard |
| `STRIPE_SECRET_KEY` | On compromise only | Roll in Stripe dashboard |
| `DO_API_TOKEN` | Annually | Regenerate in DO Control Panel |
| `GHL_CLIENT_SECRET` | On compromise only | Regenerate in GHL developer settings |

### 9.5 Staging Environment Setup

For a lightweight staging environment on a $12/mo droplet:

```bash
# Create staging droplet
doctl compute droplet create bmn-staging \
  --region nyc1 \
  --size s-1vcpu-2gb \
  --image ubuntu-24-04-x64 \
  --ssh-keys <YOUR_KEY_ID> \
  --tag-name bmn-staging \
  --enable-monitoring

# Follow the same setup as section 3.2 (server setup)
# Use .env.staging with test/staging API keys
# Point staging-api.brandmenow.com to this droplet
```

---

## 10. File Manifest

Every file that needs to be created for deployment and infrastructure:

### Docker Files

| File | Path | Description |
|------|------|-------------|
| API Dockerfile | `server/Dockerfile` | Multi-stage Node.js 22 Alpine build |
| API .dockerignore | `server/.dockerignore` | Excludes tests, docs, .env files |
| Python Worker Dockerfile | `services/ai-worker/Dockerfile` | Multi-stage Python 3.13 slim build |
| Python Worker .dockerignore | `services/ai-worker/.dockerignore` | Excludes tests, cache, .env files |
| Python requirements | `services/ai-worker/requirements.txt` | FastAPI, Pillow, uvicorn, httpx |
| Redis config | `infra/redis/redis.conf` | RDB + AOF persistence, memory limits |
| Docker Compose (dev) | `docker-compose.yml` | Full local dev stack |
| Docker Compose (prod) | `docker-compose.prod.yml` | Production droplet stack |

### Kubernetes Manifests

| File | Path | Description |
|------|------|-------------|
| Namespace | `k8s/namespace.yaml` | `bmn-production` namespace |
| ConfigMap | `k8s/configmap.yaml` | Non-secret configuration |
| Secret template | `k8s/secret.yaml` | All API keys (template -- never commit values) |
| API Deployment | `k8s/api-deployment.yaml` | 2 replicas, probes, resource limits |
| API Service | `k8s/api-service.yaml` | ClusterIP, port 3000, session affinity |
| Redis StatefulSet | `k8s/redis-statefulset.yaml` | 1 replica, PVC, persistence |
| Redis ConfigMap | `k8s/redis-configmap.yaml` | Redis server configuration |
| Redis Service | `k8s/redis-service.yaml` | ClusterIP, port 6379 |
| Python Worker Deployment | `k8s/python-worker-deployment.yaml` | 1 replica, resource limits |
| Python Worker Service | `k8s/python-worker-service.yaml` | ClusterIP, port 8000 |
| Ingress | `k8s/ingress.yaml` | nginx-ingress, TLS, WebSocket, HSTS |
| ClusterIssuer | `k8s/cluster-issuer.yaml` | Let's Encrypt cert-manager |
| NetworkPolicies | `k8s/network-policies.yaml` | Default deny, allow API to Redis/Python |
| HPA | `k8s/hpa.yaml` | API autoscale 2-8 pods |
| Apply script | `scripts/k8s-apply.sh` | Apply all manifests in order |

### GitHub Actions Workflows

| File | Path | Description |
|------|------|-------------|
| CI | `.github/workflows/ci.yml` | PR: lint, typecheck, test, Docker build, security audit |
| Deploy API | `.github/workflows/deploy-api.yml` | Push to main: build, push, rolling deploy |
| Deploy Marketing | `.github/workflows/deploy-marketing.yml` | Push to main: Vercel deploy |

### Nginx (Droplet Only)

| File | Path | Description |
|------|------|-------------|
| API reverse proxy | `/etc/nginx/sites-available/api.brandmenow.com` | Nginx config with WebSocket support |

### Systemd (Droplet Only)

| File | Path | Description |
|------|------|-------------|
| BMN service | `/etc/systemd/system/bmn.service` | Docker Compose as systemd service |

### Environment Files

| File | Path | Description |
|------|------|-------------|
| Dev env template | `.env.local` | Local development (gitignored) |
| Env example | `.env.example` | Committed to git, no real values |

---

## 11. Development Prompt & Acceptance Criteria

### Development Prompt

Use the following prompt with Claude Code to build the deployment infrastructure:

```
You are building the deployment infrastructure for Brand Me Now v2, an AI-powered
brand creation platform. Read the following spec and implement everything exactly
as described.

CONTEXT:
- All infrastructure is on DigitalOcean. No GCP, no AWS.
- Exceptions: Vercel for Next.js marketing site, Supabase cloud-hosted.
- API server: Express.js 5 on Node.js 22 (with BullMQ workers + Socket.io)
- Python worker: FastAPI for image manipulation only
- Cache/jobs: Redis 7
- Database: Supabase (cloud-hosted, no self-hosting)

BUILD THE FOLLOWING (in order):

1. Create server/Dockerfile (multi-stage, node:22-alpine, non-root user, dumb-init,
   health check with wget, EXPOSE 3000)

2. Create services/ai-worker/Dockerfile (multi-stage, python:3.13-slim, Pillow deps,
   non-root user, health check, EXPOSE 8000)

3. Create services/ai-worker/requirements.txt (fastapi, uvicorn, Pillow, httpx, pydantic)

4. Create infra/redis/redis.conf (512mb maxmemory, allkeys-lru, RDB + AOF persistence,
   2 databases)

5. Create docker-compose.yml at project root for local development:
   - api service (build from server/, hot reload with nodemon, volume mounts)
   - redis service (redis:7-alpine, redis.conf, health check, named volume)
   - python-worker service (build from services/ai-worker/, hot reload with --reload)
   - redis-commander (debug profile only)
   - Shared bmn-network bridge
   - .env.local env_file

6. Create docker-compose.prod.yml for single-droplet production:
   - Pull from registry.digitalocean.com/brandmenow/
   - Resource limits, restart: always, json-file logging with rotation
   - Watchtower for auto-pull
   - Ports bound to 127.0.0.1 (Nginx fronts everything)

7. Create all k8s/*.yaml manifests:
   - namespace, configmap, secret (template), api-deployment (2 replicas, probes, resource
     limits, envFrom), api-service (ClusterIP, session affinity), redis-statefulset (PVC on
     do-block-storage), redis-configmap, redis-service, python-worker-deployment,
     python-worker-service, ingress (nginx-ingress, cert-manager TLS, WebSocket support,
     HSTS), cluster-issuer (Let's Encrypt), network-policies (default deny, API to Redis,
     API to Python), hpa (2-8 pods, CPU 70%, memory 80%)

8. Create .github/workflows/ci.yml:
   - On PR to main. Lint, typecheck, test (with Redis service container),
     Python tests, Docker build verification, Trivy security scan.

9. Create .github/workflows/deploy-api.yml:
   - On push to main. Build Docker images, push to DO registry, rolling deploy
     to K8s (or SSH deploy to droplet). Rollback on failure.

10. Create .github/workflows/deploy-marketing.yml:
    - On push to main (apps/marketing/ path). Vercel CLI deploy.

11. Create Nginx config for droplet reverse proxy:
    - HTTPS with Let's Encrypt, WebSocket upgrade for Socket.io,
    - Security headers, proxy to 127.0.0.1:3000

12. Create .env.example with all required variables (no real values)

13. Create scripts/k8s-apply.sh to apply all manifests in dependency order

CONSTRAINTS:
- Every Dockerfile must use non-root users
- Every container must have health checks
- Redis must persist data (RDB + AOF)
- K8s NetworkPolicy: only API can reach Redis, only API can reach Python worker
- Ingress must support WebSocket (Socket.io) connections
- All secrets use K8s Secret (never in ConfigMap, never in git)
- Docker images use multi-stage builds for minimal size
- GitHub Actions use pnpm, node 22, and Docker Buildx with GHA cache
```

### Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `docker compose up` starts api, redis, and python-worker with zero errors | Run locally, all 3 containers healthy within 60 seconds |
| AC-2 | API container responds on `localhost:3000/health` with `{"status":"ok"}` | `curl localhost:3000/health` returns 200 |
| AC-3 | Redis container persists data across restarts | Write key, restart redis container, verify key still exists |
| AC-4 | Python worker responds on `localhost:8000/health` | `curl localhost:8000/health` returns 200 |
| AC-5 | Hot reload works: change `server/src/server.js`, API restarts automatically | Modify file, see nodemon restart in logs |
| AC-6 | Hot reload works: change `services/ai-worker/src/api.py`, worker restarts | Modify file, see uvicorn reload in logs |
| AC-7 | API Dockerfile produces image < 300MB | `docker images brandmenow/api` shows size < 300MB |
| AC-8 | Python Worker Dockerfile produces image < 500MB | `docker images brandmenow/python-worker` shows size < 500MB |
| AC-9 | All containers run as non-root | `docker exec bmn-api whoami` returns `bmn` (not root) |
| AC-10 | K8s manifests apply without errors | `kubectl apply -f k8s/ --dry-run=server` succeeds |
| AC-11 | K8s NetworkPolicy blocks direct Redis access from outside API pods | Deploy and verify python-worker cannot reach Redis directly |
| AC-12 | Ingress supports WebSocket connections | Socket.io client connects through ingress without falling back to polling |
| AC-13 | cert-manager issues TLS certificate for `api.brandmenow.com` | `kubectl get certificate -n bmn-production` shows Ready=True |
| AC-14 | HPA scales API pods when CPU exceeds 70% | Load test, verify `kubectl get hpa` shows replicas > 2 |
| AC-15 | CI workflow passes on a clean PR | Create PR, verify all jobs pass (lint, test, Docker build, security) |
| AC-16 | Deploy workflow builds and pushes images to DO registry | Push to main, verify images appear in DO registry |
| AC-17 | Rolling deploy achieves zero-downtime | Deploy during load test, verify no 5xx errors during rollout |
| AC-18 | Nginx (droplet) proxies API and upgrades WebSocket | Connect Socket.io client through Nginx, verify WebSocket transport |
| AC-19 | Let's Encrypt certificate auto-renews | `certbot renew --dry-run` succeeds (droplet) or cert-manager logs show renewal (K8s) |
| AC-20 | `.env.example` lists every required variable with no real values | Diff against `.env.local`, no missing keys |
| AC-21 | DO Spaces upload works from API | Call `uploadGeneratedImage()`, verify file appears on CDN URL |
| AC-22 | Sentry captures errors from both API and Python worker | Throw test error, verify it appears in Sentry dashboard |
| AC-23 | `docker compose down -v && docker compose up` recovers cleanly | Full restart from scratch works without manual intervention |

---

## Cost Summary

### Starter (Single Droplet) -- Launch Day

| Item | Monthly Cost |
|------|-------------|
| DO Droplet (`s-2vcpu-4gb`) | $24 |
| DO Droplet Backups | $4.80 |
| DO Spaces (250GB + 1TB transfer) | $5 |
| DO Container Registry (Basic) | $5 |
| Vercel (Free or Pro) | $0-20 |
| Supabase Pro | $25 |
| Cloudflare DNS (Free) | $0 |
| **Total** | **$63.80 - $83.80/mo** |

### Kubernetes -- Growth Phase (5K+ users)

| Item | Monthly Cost |
|------|-------------|
| DO K8s Control Plane | $12 |
| DO K8s Nodes (2x `s-2vcpu-4gb`) | $48 |
| DO Load Balancer (via nginx-ingress) | $12 |
| DO Spaces (250GB + 1TB) | $5 |
| DO Container Registry (Basic) | $5 |
| DO Block Storage (5GB Redis PVC) | $0.50 |
| Vercel Pro | $20 |
| Supabase Pro | $25 |
| Cloudflare DNS (Free) | $0 |
| **Total** | **$127.50/mo** |

This does not include AI model costs (Anthropic, OpenAI, Google, BFL, Ideogram), Sentry, Resend, or Stripe fees -- those are covered in the cost analysis in the master blueprint (09-GREENFIELD-REBUILD-BLUEPRINT.md).
