# 02 -- Architecture Overview

**Product:** Brand Me Now v2
**Date:** February 19, 2026
**Author:** Matt Squarzoni
**Status:** Approved for development
**Depends on:** [01-PRODUCT-REQUIREMENTS.md](01-PRODUCT-REQUIREMENTS.md)
**Depended on by:** All other docs (03 through 16)

---

## Table of Contents

1. [System Architecture Diagram](#1-system-architecture-diagram)
2. [Container Map](#2-container-map)
3. [API Endpoint Map](#3-api-endpoint-map)
4. [Socket.io Event Map](#4-socketio-event-map)
5. [Data Flow Diagrams](#5-data-flow-diagrams)
6. [Agent Architecture Diagram](#6-agent-architecture-diagram)
7. [Monorepo Structure](#7-monorepo-structure)
8. [Environment Architecture](#8-environment-architecture)
9. [Network Architecture](#9-network-architecture)
10. [Dependencies](#10-dependencies)
11. [Development Prompt](#11-development-prompt)

---

## 1. System Architecture Diagram

### High-Level System Topology

```
                        Internet
                           |
                    +--------------+
                    |  Cloudflare  |
                    |  DNS + CDN   |
                    |  WAF + DDoS  |
                    +--------------+
                           |
            +--------------+--------------+
            |              |              |
  +---------v----+  +------v------+  +----v-----------+
  | brandmenow   |  | app.brand   |  | api.brand      |
  | .com         |  | menow.com   |  | menow.com      |
  | (Marketing)  |  | (SPA)       |  | (API + WS)     |
  +---------+----+  +------+------+  +----+-----------+
            |              |              |
   +--------v-------+     |     +--------v-----------+
   | Vercel          |     |     | DigitalOcean       |
   | Next.js 15 SSG  |     |     | Load Balancer      |
   | Marketing Site   |     |     +--------+-----------+
   +------------------+     |              |
                            |     +--------v-----------+
              +-------------+     |  K8s Ingress       |
              |                   |  (nginx-ingress)    |
   +----------v----------+       +---+------+------+---+
   | Vercel / Cloudflare  |          |      |      |
   | Pages                |          |      |      |
   | React 19 SPA         |     +----v-+ +--v--+ +-v--------+
   | (Static Bundle)      |     |API   | |API  | |API       |
   +-----------------------+     |Pod 1 | |Pod 2| |Pod N     |
                                 +--+---+ +--+--+ +--+-------+
                                    |        |        |
                    +---------------+--------+--------+--------+
                    |               |                           |
           +--------v------+ +------v--------+    +------------v-----------+
           | Redis 7        | | BullMQ Workers |    |  External Services     |
           | (StatefulSet)  | | (Deployment)   |    |                        |
           |                | |                |    |  +-------------------+ |
           | - Job Store    | | - brand-wizard |    |  | Anthropic API     | |
           | - Cache Layer  | | - logo-gen     |    |  | (Claude Sonnet/   | |
           | - Rate Limits  | | - mockup-gen   |    |  |  Haiku/Opus)      | |
           | - Socket.io    | | - crm-sync     |    |  +-------------------+ |
           |   Adapter      | | - email-send   |    |  | OpenAI API        | |
           +----------------+ | - bundle-comp  |    |  | (GPT Image 1.5)   | |
                              | - cleanup       |    |  +-------------------+ |
                              +-----------------+    |  | Google AI API     | |
                                                     |  | (Gemini 3.0/Veo3) | |
           +------------------+                      |  +-------------------+ |
           | Supabase (Cloud) |                      |  | BFL API           | |
           |                  |                      |  | (FLUX.2 Pro)      | |
           | - PostgreSQL 17  |                      |  +-------------------+ |
           | - Auth (JWT)     |                      |  | Ideogram API      | |
           | - Storage        |                      |  | (v3 Typography)   | |
           | - Realtime       |                      |  +-------------------+ |
           | - Edge Functions |                      |  | Stripe            | |
           +------------------+                      |  | (Payments)        | |
                                                     |  +-------------------+ |
           +------------------+                      |  | GoHighLevel       | |
           | Cloudflare R2    |                      |  | (CRM via OAuth)   | |
           | (Object Storage) |                      |  +-------------------+ |
           |                  |                      |  | Resend            | |
           | - Generated      |                      |  | (Transactional    | |
           |   Logos          |                      |  |  Email)           | |
           | - Mockup Images  |                      |  +-------------------+ |
           | - Bundle Comps   |                      |  | Apify             | |
           | - Global CDN     |                      |  | (Social Scraping) | |
           +------------------+                      |  +-------------------+ |
                                                     |  | Sentry            | |
                                                     |  | (Error Tracking)  | |
                                                     |  +-------------------+ |
                                                     |  | PostHog           | |
                                                     |  | (Product          | |
                                                     |  |  Analytics)       | |
                                                     |  +-------------------+ |
                                                     +-------------------------+
```

### Connection Legend

```
+-----------+    HTTPS/REST     +-----------+
| React SPA | ----------------> | Express   |
|           | <--- Socket.io -> | API       |
+-----------+                   +-----+-----+
                                      |
                               +------v------+
                               |   Redis 7   |
                               | (BullMQ +   |
                               |  Cache +    |
                               |  Socket.io  |
                               |  Adapter)   |
                               +------+------+
                                      |
                               +------v------+
                               | BullMQ      |
                               | Workers     |
                               | (same Node  |
                               |  process or |
                               |  separate   |
                               |  pods)      |
                               +------+------+
                                      |
                    +-----------------+------------------+
                    |                 |                   |
             +------v------+  +------v------+  +---------v------+
             | Supabase    |  | AI APIs     |  | Third-Party    |
             | (DB/Auth/   |  | (Anthropic, |  | (Stripe, GHL,  |
             |  Storage)   |  |  OpenAI,    |  |  Resend, Apify)|
             +-------------+  |  Google,    |  +----------------+
                              |  BFL,       |
                              |  Ideogram)  |
                              +-------------+
```

### Internal Process Architecture (Single API Pod)

```
+------------------------------------------------------------------+
|                    Express.js 5 API Server                         |
|                    (Node.js 22 LTS Process)                        |
|                                                                    |
|  +--------------------------------------------------------------+ |
|  |                    Middleware Chain                            | |
|  |  Helmet -> CORS -> Auth -> Tenant -> RateLimit -> Zod -> Err | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  +-------------------+  +------------------+  +----------------+  |
|  | REST API Router   |  | Socket.io Server |  | BullMQ Workers |  |
|  |                   |  |                  |  | (co-located or |  |
|  | /api/v1/auth/*    |  | Namespace:       |  |  separate)     |  |
|  | /api/v1/profiles/*|  |  /wizard         |  |                |  |
|  | /api/v1/brands/*  |  |  /admin          |  | brand-wizard   |  |
|  | /api/v1/wizard/*  |  |  /chat           |  | logo-gen       |  |
|  | /api/v1/logos/*   |  |                  |  | mockup-gen     |  |
|  | /api/v1/mockups/* |  | Auth: JWT        |  | bundle-comp    |  |
|  | /api/v1/products/*|  | handshake        |  | crm-sync       |  |
|  | /api/v1/bundles/* |  |                  |  | email-send     |  |
|  | /api/v1/payments/*|  | Rooms:           |  | cleanup        |  |
|  | /api/v1/admin/*   |  |  user:{id}       |  |                |  |
|  | /api/v1/health/*  |  |  brand:{id}      |  +----------------+  |
|  | /api/v1/webhooks/*|  |  job:{id}        |                      |
|  +-------------------+  |  admin           |  +----------------+  |
|                         +------------------+  | Skill Modules  |  |
|                                               | (Subagent Reg) |  |
|  +------------------------------------------+ |                |  |
|  |          Anthropic Agent SDK              | | social-analyzer|  |
|  |          (Orchestration Brain)            | | brand-generator|  |
|  |                                           | | logo-creator   |  |
|  |  Brand Wizard Agent (Parent)              | | mockup-renderer|  |
|  |   -> Spawns subagents per skill           | | name-generator |  |
|  |   -> Tools call external APIs             | | profit-calc    |  |
|  |   -> Hooks emit Socket.io events          | | video-creator* |  |
|  +------------------------------------------+ +----------------+  |
|                                                   * Phase 2       |
+------------------------------------------------------------------+
              |                    |                    |
     +--------v--------+  +-------v--------+  +-------v---------+
     | Supabase        |  | Redis 7        |  | External APIs   |
     | (PostgreSQL 17) |  | (Job + Cache)  |  | (AI + Business) |
     +-----------------+  +----------------+  +-----------------+
```

---

## 2. Container Map

### Docker Compose Services (Development)

| Service | Image | Port (Host:Container) | Role | Resource Limits |
|---------|-------|-----------------------|------|-----------------|
| `api` | `node:22-alpine` | `3000:3000` | Express.js API server + Socket.io | 1GB RAM, 1 CPU |
| `worker` | `node:22-alpine` | -- | BullMQ workers (all queues) | 1GB RAM, 1 CPU |
| `redis` | `redis:7-alpine` | `6379:6379` | BullMQ job store, cache, rate limits, Socket.io adapter | 512MB RAM, 0.5 CPU |
| `marketing` | `node:22-alpine` | `3001:3000` | Next.js 15 dev server (marketing site) | 512MB RAM, 0.5 CPU |
| `client` | `node:22-alpine` | `5173:5173` | Vite 7 dev server (React SPA) | 512MB RAM, 0.5 CPU |
| `bull-board` | `node:22-alpine` | `3002:3002` | Bull Board UI for job monitoring (dev only) | 256MB RAM, 0.25 CPU |
| `mailpit` | `axllent/mailpit` | `8025:8025`, `1025:1025` | Local email capture (dev only) | 128MB RAM, 0.1 CPU |

### Docker Compose YAML (Development)

```yaml
# docker-compose.yml
version: '3.9'

services:
  api:
    build:
      context: .
      dockerfile: server/Dockerfile
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=development
      - REDIS_URL=redis://redis:6379
    depends_on:
      redis:
        condition: service_healthy
    volumes:
      - ./server:/app/server
      - ./shared:/app/shared
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'

  worker:
    build:
      context: .
      dockerfile: server/Dockerfile.worker
    environment:
      - NODE_ENV=development
      - REDIS_URL=redis://redis:6379
    depends_on:
      redis:
        condition: service_healthy
    volumes:
      - ./server:/app/server
      - ./shared:/app/shared
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'

  client:
    build:
      context: .
      dockerfile: client/Dockerfile.dev
    ports:
      - '5173:5173'
    volumes:
      - ./client:/app/client
      - ./shared:/app/shared
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'

  marketing:
    build:
      context: .
      dockerfile: marketing/Dockerfile.dev
    ports:
      - '3001:3000'
    volumes:
      - ./marketing:/app/marketing
      - ./shared:/app/shared
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'

  bull-board:
    build:
      context: .
      dockerfile: server/Dockerfile.bull-board
    ports:
      - '3002:3002'
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.25'

  mailpit:
    image: axllent/mailpit
    ports:
      - '8025:8025'
      - '1025:1025'
    deploy:
      resources:
        limits:
          memory: 128M
          cpus: '0.1'

volumes:
  redis-data:
```

### Kubernetes Deployments (Production)

| Deployment | Replicas | Image | Port | CPU Request/Limit | Memory Request/Limit | Notes |
|-----------|----------|-------|------|--------------------|----------------------|-------|
| `bmn-api` | 2-5 (HPA) | `registry.digitalocean.com/brandmenow/api:latest` | 3000 | 250m / 1000m | 256Mi / 1Gi | Express + Socket.io |
| `bmn-worker` | 2-4 (HPA) | `registry.digitalocean.com/brandmenow/worker:latest` | -- | 500m / 2000m | 512Mi / 2Gi | BullMQ workers (CPU-intensive AI calls) |
| `bmn-redis` | 1 (StatefulSet) | `redis:7-alpine` | 6379 | 250m / 500m | 256Mi / 512Mi | Persistent volume, no replicas |
| `bmn-bull-board` | 1 | `registry.digitalocean.com/brandmenow/bull-board:latest` | 3002 | 100m / 250m | 128Mi / 256Mi | Internal only, no external ingress |

### K8s Resource Summary

```
Namespace: brandmenow-prod
  +-- Deployment: bmn-api          (2-5 pods, HPA on CPU 70%)
  +-- Deployment: bmn-worker       (2-4 pods, HPA on queue depth)
  +-- StatefulSet: bmn-redis       (1 pod, 10Gi PVC)
  +-- Deployment: bmn-bull-board   (1 pod, internal only)
  +-- Service: bmn-api-svc         (ClusterIP, port 3000)
  +-- Service: bmn-redis-svc       (ClusterIP, port 6379)
  +-- Service: bmn-bull-board-svc  (ClusterIP, port 3002)
  +-- Ingress: bmn-ingress         (api.brandmenow.com -> bmn-api-svc)
  +-- HPA: bmn-api-hpa            (min 2, max 5, CPU 70%)
  +-- HPA: bmn-worker-hpa         (min 2, max 4, custom metric: queue depth)
  +-- Secret: bmn-secrets          (all env vars)
  +-- ConfigMap: bmn-config        (non-secret config)
  +-- NetworkPolicy: bmn-netpol    (restrict Redis access)
  +-- PVC: bmn-redis-pvc          (10Gi, do-block-storage)

Namespace: brandmenow-staging
  +-- (Same structure, min replicas = 1, smaller resource limits)
```

---

## 3. API Endpoint Map

All endpoints are prefixed with `/api/v1`. Authentication is indicated by the `Auth` column: `public` means no token required, `user` means a valid Supabase JWT is required, `admin` means the JWT must have an admin role claim.

### Auth Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `POST` | `/auth/signup` | public | 5/min/IP | Create account (email + password) |
| `POST` | `/auth/login` | public | 10/min/IP | Login, returns Supabase session |
| `POST` | `/auth/logout` | user | 20/min | Invalidate current session |
| `POST` | `/auth/refresh` | public | 30/min/IP | Refresh JWT using refresh token |
| `POST` | `/auth/forgot-password` | public | 3/min/IP | Send password reset email via Supabase |
| `POST` | `/auth/reset-password` | public | 3/min/IP | Reset password with token |
| `GET` | `/auth/oauth/google` | public | 10/min/IP | Initiate Google OAuth PKCE flow |
| `GET` | `/auth/oauth/callback` | public | 10/min/IP | OAuth callback handler |
| `POST` | `/auth/mfa/enroll` | user | 5/min | Enroll TOTP MFA |
| `POST` | `/auth/mfa/verify` | user | 10/min | Verify MFA code |

### Profile Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `GET` | `/profiles/me` | user | 60/min | Get current user profile |
| `PATCH` | `/profiles/me` | user | 20/min | Update profile (name, phone, avatar) |
| `DELETE` | `/profiles/me` | user | 1/min | Delete account (GDPR right to erasure) |
| `GET` | `/profiles/me/subscription` | user | 30/min | Get subscription tier + credit balance |
| `GET` | `/profiles/me/usage` | user | 30/min | Get generation usage stats (current period) |

### Brand Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `GET` | `/brands` | user | 60/min | List all brands for current user |
| `POST` | `/brands` | user | 10/min | Create a new brand (starts wizard) |
| `GET` | `/brands/:brandId` | user | 60/min | Get full brand detail (identity, assets, bundles) |
| `PATCH` | `/brands/:brandId` | user | 30/min | Update brand fields (name, vision, values) |
| `DELETE` | `/brands/:brandId` | user | 5/min | Soft-delete brand and archive assets |
| `GET` | `/brands/:brandId/assets` | user | 60/min | List all generated assets for a brand |
| `GET` | `/brands/:brandId/assets/download` | user | 10/min | Download all assets as ZIP |
| `POST` | `/brands/:brandId/duplicate` | user | 5/min | Duplicate brand with new identity |

### Wizard Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `GET` | `/wizard/:brandId/state` | user | 60/min | Get current wizard state (step, data, progress) |
| `PUT` | `/wizard/:brandId/step/:stepNumber` | user | 30/min | Save wizard step data |
| `POST` | `/wizard/:brandId/resume` | public | 10/min/IP | Resume wizard via HMAC token (no auth required) |
| `POST` | `/wizard/:brandId/complete` | user | 5/min | Mark wizard as complete, trigger email |
| `GET` | `/wizard/:brandId/resume-token` | user | 10/min | Generate HMAC resume token (24h expiry) |

### Logo Generation Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `POST` | `/logos/:brandId/generate` | user | 5/min | Queue logo generation (4 logos via FLUX.2 Pro) |
| `GET` | `/logos/:brandId` | user | 60/min | List all generated logos for a brand |
| `POST` | `/logos/:brandId/:logoId/select` | user | 20/min | Mark a logo as selected/primary |
| `POST` | `/logos/:brandId/:logoId/refine` | user | 5/min | Queue logo refinement with modification prompt |
| `POST` | `/logos/:brandId/regenerate` | user | 3/min | Queue full regeneration (costs 1 credit) |
| `DELETE` | `/logos/:brandId/:logoId` | user | 10/min | Archive a logo (soft delete) |

### Mockup Generation Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `POST` | `/mockups/:brandId/generate` | user | 10/min | Queue mockup generation for selected products |
| `GET` | `/mockups/:brandId` | user | 60/min | List all mockups for a brand |
| `POST` | `/mockups/:brandId/:mockupId/approve` | user | 30/min | Approve a mockup |
| `POST` | `/mockups/:brandId/:mockupId/reject` | user | 10/min | Reject + regenerate a mockup |
| `DELETE` | `/mockups/:brandId/:mockupId` | user | 10/min | Archive a mockup |

### Product Catalog Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `GET` | `/products` | user | 60/min | List all active products (with category filter) |
| `GET` | `/products/:productId` | user | 60/min | Get product detail (SKU, pricing, template info) |
| `GET` | `/products/categories` | user | 60/min | List all product categories |
| `GET` | `/products/search` | user | 60/min | Full-text search products (pg_tsvector) |

### Bundle Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `GET` | `/bundles/:brandId` | user | 60/min | List all bundles for a brand |
| `POST` | `/bundles/:brandId` | user | 10/min | Create a new bundle (name, product IDs) |
| `PATCH` | `/bundles/:brandId/:bundleId` | user | 20/min | Update bundle (name, products, pricing) |
| `DELETE` | `/bundles/:brandId/:bundleId` | user | 10/min | Delete a bundle |
| `POST` | `/bundles/:brandId/:bundleId/compose` | user | 5/min | Queue bundle composition image (Gemini 3 Pro Image) |
| `GET` | `/bundles/:brandId/:bundleId/projections` | user | 30/min | Get profit projections for a bundle |

### Payment Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `POST` | `/payments/checkout` | user | 5/min | Create Stripe Checkout session |
| `GET` | `/payments/subscription` | user | 30/min | Get current subscription details |
| `POST` | `/payments/subscription/cancel` | user | 3/min | Cancel subscription (end of period) |
| `POST` | `/payments/subscription/change` | user | 5/min | Upgrade/downgrade subscription tier |
| `GET` | `/payments/invoices` | user | 30/min | List invoice history |
| `GET` | `/payments/credits` | user | 60/min | Get current credit balance + usage |
| `POST` | `/payments/credits/purchase` | user | 5/min | Purchase additional credits (one-time) |

### Webhook Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `POST` | `/webhooks/stripe` | public* | 100/min/IP | Stripe webhook receiver (*verified via signature) |
| `POST` | `/webhooks/ghl` | public* | 50/min/IP | GoHighLevel webhook receiver (*verified via HMAC) |
| `POST` | `/webhooks/supabase` | public* | 50/min/IP | Supabase database webhook receiver |

### Admin Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `GET` | `/admin/users` | admin | 30/min | List all users (paginated, searchable) |
| `GET` | `/admin/users/:userId` | admin | 30/min | Get user detail + brands + usage |
| `PATCH` | `/admin/users/:userId` | admin | 10/min | Update user (role, subscription override) |
| `DELETE` | `/admin/users/:userId` | admin | 3/min | Delete user + all data |
| `GET` | `/admin/brands` | admin | 30/min | List all brands (paginated, filterable) |
| `GET` | `/admin/brands/:brandId` | admin | 30/min | Get brand detail (bypass RLS) |
| `POST` | `/admin/brands/:brandId/flag` | admin | 20/min | Flag brand for content review |
| `GET` | `/admin/jobs` | admin | 60/min | List BullMQ job queue status |
| `GET` | `/admin/jobs/:queueName` | admin | 60/min | Get queue-specific stats (waiting, active, failed) |
| `POST` | `/admin/jobs/:jobId/retry` | admin | 10/min | Retry a failed job |
| `GET` | `/admin/products` | admin | 30/min | List all products (including disabled) |
| `POST` | `/admin/products` | admin | 10/min | Create a new product |
| `PATCH` | `/admin/products/:productId` | admin | 20/min | Update product (name, price, template, status) |
| `DELETE` | `/admin/products/:productId` | admin | 5/min | Disable/archive a product |
| `GET` | `/admin/moderation` | admin | 30/min | List content moderation queue |
| `POST` | `/admin/moderation/:assetId/approve` | admin | 30/min | Approve moderated content |
| `POST` | `/admin/moderation/:assetId/reject` | admin | 30/min | Reject + remove content |
| `GET` | `/admin/analytics` | admin | 10/min | Get system analytics (users, brands, revenue, costs) |
| `GET` | `/admin/audit-log` | admin | 30/min | Get audit log entries (paginated, filterable) |

### Health Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `GET` | `/health` | public | none | Basic health check (returns 200 OK) |
| `GET` | `/health/ready` | public | none | Readiness probe (DB + Redis connected) |
| `GET` | `/health/live` | public | none | Liveness probe (process alive) |
| `GET` | `/health/metrics` | admin | 10/min | Prometheus-compatible metrics |

### Chatbot Endpoints

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| `POST` | `/chat/message` | user | 10/min | Send chat message, returns AI response (Claude Haiku 4.5) |
| `GET` | `/chat/history` | user | 30/min | Get chat history for current user |
| `POST` | `/chat/escalate` | user | 3/min | Escalate to human support (creates support ticket) |

---

## 4. Socket.io Event Map

### Connection Authentication Flow

```
Client                                     Server
  |                                           |
  |  socket = io('/wizard', {                 |
  |    auth: { token: supabaseJWT }           |
  |  })                                       |
  |                                           |
  |  ---- WebSocket UPGRADE + auth ---------->|
  |                                           |
  |                          Verify JWT via   |
  |                          Supabase Auth    |
  |                          Extract userId   |
  |                                           |
  |  <--- connection_established -------------|
  |       { userId, socketId }                |
  |                                           |
  |  join('user:{userId}')                    |
  |  join('brand:{brandId}') // if active     |
  |                                           |
```

### Namespace: `/wizard`

Purpose: Real-time AI generation progress, wizard step sync, job status updates.

#### Client -> Server Events

| Event | Payload Schema | Description |
|-------|---------------|-------------|
| `wizard:join` | `{ brandId: string }` | Join brand-specific room for generation updates |
| `wizard:leave` | `{ brandId: string }` | Leave brand room |
| `wizard:step-change` | `{ brandId: string, step: number, data: object }` | Notify server of step navigation (for analytics) |
| `wizard:cancel-job` | `{ jobId: string }` | Request cancellation of an in-progress generation job |
| `wizard:request-progress` | `{ jobId: string }` | Request current progress for a specific job (reconnection) |

#### Server -> Client Events

| Event | Payload Schema | Description |
|-------|---------------|-------------|
| `wizard:job-queued` | `{ jobId: string, type: string, position: number }` | Job has been added to the queue |
| `wizard:job-started` | `{ jobId: string, type: string }` | Worker has picked up the job |
| `wizard:job-progress` | `{ jobId: string, type: string, status: string, progress: number, message: string }` | Real-time generation progress (0-100) |
| `wizard:job-complete` | `{ jobId: string, type: string, result: object }` | Job completed successfully with result data |
| `wizard:job-failed` | `{ jobId: string, type: string, error: string, retryable: boolean }` | Job failed with error detail |
| `wizard:job-cancelled` | `{ jobId: string }` | Job was cancelled by user request |
| `agent:tool-complete` | `{ tool: string, progress: number, message: string }` | Agent SDK tool execution completed (granular progress) |
| `agent:tool-error` | `{ tool: string, error: string }` | Agent SDK tool execution failed |
| `agent:message` | `{ content: string }` | Streaming agent text output (for chat-style wizard) |
| `agent:complete` | `{ result: object, cost: number, sessionId: string }` | Agent session completed |

### Namespace: `/admin`

Purpose: System monitoring, job queue status, real-time admin dashboards.

#### Client -> Server Events

| Event | Payload Schema | Description |
|-------|---------------|-------------|
| `admin:join` | `{}` | Join admin monitoring room (requires admin JWT) |
| `admin:subscribe-queue` | `{ queueName: string }` | Subscribe to specific queue updates |
| `admin:unsubscribe-queue` | `{ queueName: string }` | Unsubscribe from queue updates |

#### Server -> Client Events

| Event | Payload Schema | Description |
|-------|---------------|-------------|
| `admin:queue-stats` | `{ queue: string, waiting: number, active: number, completed: number, failed: number }` | Periodic queue statistics (every 5s) |
| `admin:job-event` | `{ queue: string, jobId: string, event: string, data: object }` | Individual job lifecycle event |
| `admin:system-alert` | `{ level: 'info' or 'warn' or 'error', message: string, data: object }` | System alerts (cost spike, error spike, etc.) |
| `admin:user-activity` | `{ activeUsers: number, activeWizards: number, activeJobs: number }` | Real-time platform activity metrics |
| `admin:cost-update` | `{ period: string, totalCost: number, breakdown: object }` | AI cost tracking updates |

### Namespace: `/chat`

Purpose: AI chatbot for user assistance (Claude Haiku 4.5).

#### Client -> Server Events

| Event | Payload Schema | Description |
|-------|---------------|-------------|
| `chat:join` | `{ brandId?: string }` | Join chat room (optionally scoped to a brand) |
| `chat:message` | `{ content: string, brandId?: string }` | Send message to AI chatbot |
| `chat:typing` | `{ isTyping: boolean }` | Typing indicator |
| `chat:escalate` | `{ reason: string }` | Escalate to human support |

#### Server -> Client Events

| Event | Payload Schema | Description |
|-------|---------------|-------------|
| `chat:response-start` | `{ messageId: string }` | AI started generating response |
| `chat:response-chunk` | `{ messageId: string, chunk: string }` | Streaming AI response token |
| `chat:response-end` | `{ messageId: string, fullContent: string }` | AI response complete |
| `chat:escalated` | `{ ticketId: string, message: string }` | Escalation confirmed, support ticket created |
| `chat:error` | `{ error: string }` | Chat error (rate limit, AI failure, etc.) |

### Socket.io Server Configuration

```javascript
// sockets/index.js

import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { verifySupabaseJWT } from '../middleware/auth.js';

export function setupSocketServer(httpServer, redis) {
  const io = new Server(httpServer, {
    cors: {
      origin: [process.env.APP_URL, process.env.MARKETING_URL],
      credentials: true,
    },
    adapter: createAdapter(redis.duplicate(), redis.duplicate()),
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: false,
    },
  });

  // Global auth middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    const user = await verifySupabaseJWT(token);
    if (!user) return next(new Error('Invalid token'));

    socket.user = user;
    socket.join(`user:${user.id}`);
    next();
  });

  // Namespace-specific setup
  setupWizardNamespace(io.of('/wizard'));
  setupAdminNamespace(io.of('/admin'));
  setupChatNamespace(io.of('/chat'));

  return io;
}
```

---

## 5. Data Flow Diagrams

### 5.1 Wizard Flow (End-to-End)

```
User opens app.brandmenow.com/wizard
  |
  v
Step 0: Auth Check
  |-- Authenticated? --> Load existing wizard state from DB
  |-- Not authenticated? --> Redirect to /auth/login
  |
  v
Step 1: Onboarding
  |-- User enters: name, phone, accepts terms
  |-- POST /api/v1/profiles/me (update profile)
  |-- POST /api/v1/brands (create brand record, status: 'draft')
  |-- BullMQ: queue 'crm-sync' job (create GHL contact, non-blocking)
  |-- Socket.io: join room brand:{brandId}
  |
  v
Step 2: Social Analysis
  |-- User enters: Instagram / TikTok / Facebook handles
  |-- POST /api/v1/wizard/{brandId}/step/2 (save handles)
  |-- BullMQ: queue 'brand-wizard' job (step: social-analysis)
  |     |
  |     v
  |   Worker spawns social-analyzer subagent:
  |     |-- Tool: scrapeInstagram() --> Apify API
  |     |-- Tool: scrapeTikTok() --> Apify API
  |     |-- Tool: analyzeAesthetic() --> Gemini 3.0 Flash (cheap image analysis)
  |     |-- Agent reasoning: Claude Sonnet 4.6 synthesizes brand DNA
  |     |-- Each tool emits Socket.io progress events
  |     |-- Result: { aesthetic, themes, audience, engagement, brandDNA }
  |     v
  |   Socket.io: wizard:job-complete --> Client renders analysis
  |
  v
Step 3: Brand Identity
  |-- AI pre-populates: vision, values, archetype from Step 2 analysis
  |-- User reviews and edits fields
  |-- PUT /api/v1/wizard/{brandId}/step/3 (save edits)
  |-- BullMQ: queue 'brand-wizard' job (step: brand-identity)
  |     |
  |     v
  |   Worker spawns brand-generator subagent:
  |     |-- Claude Sonnet 4.6 generates: vision statement, values, archetype
  |     |-- Structured JSON output parsed and saved
  |     v
  |   DB: Update brands table with identity data
  |
  v
Step 4: Customization (Colors, Fonts, Logo Style)
  |-- AI suggests: 4-6 colors, 3-5 font pairs, 5 logo styles
  |-- User selects / customizes
  |-- PUT /api/v1/wizard/{brandId}/step/4 (save selections)
  |-- DB: Update brand_design_config
  |
  v
Step 5: Logo Generation
  |-- User clicks "Generate Logos"
  |-- POST /api/v1/logos/{brandId}/generate
  |-- See: "5.2 Logo Generation Flow" below
  |
  v
Step 6: Logo Refinement
  |-- User selects favorite logo
  |-- POST /api/v1/logos/{brandId}/{logoId}/select
  |-- Optional: POST /api/v1/logos/{brandId}/{logoId}/refine
  |
  v
Step 7: Product Selection
  |-- GET /api/v1/products (load catalog)
  |-- User selects products from grid
  |-- PUT /api/v1/wizard/{brandId}/step/7 (save selections)
  |
  v
Step 8: Mockup Review
  |-- POST /api/v1/mockups/{brandId}/generate
  |-- See: "5.3 Mockup Generation Flow" below
  |-- User approves/rejects each mockup
  |
  v
Step 9: Bundle Builder
  |-- User creates bundles from selected products
  |-- POST /api/v1/bundles/{brandId} (create bundle)
  |-- POST /api/v1/bundles/{brandId}/{bundleId}/compose (queue composition image)
  |
  v
Step 10: Profit Calculator
  |-- GET /api/v1/bundles/{brandId}/{bundleId}/projections
  |-- User adjusts pricing sliders
  |-- Real-time margin recalculation (client-side)
  |
  v
Step 11: Checkout
  |-- POST /api/v1/payments/checkout (create Stripe session)
  |-- Redirect to Stripe Checkout
  |-- See: "5.4 Payment Flow" below
  |
  v
Step 12: Completion
  |-- POST /api/v1/wizard/{brandId}/complete
  |-- BullMQ: queue 'email-send' job (confirmation email)
  |-- BullMQ: queue 'crm-sync' job (update GHL contact with brand status)
  |-- Client: celebration animation + brand summary card
```

### 5.2 Logo Generation Flow

```
Client                   Express API              BullMQ              Worker                BFL API            Storage (R2)         Socket.io
  |                          |                      |                   |                      |                    |                   |
  |  POST /logos/:id/gen     |                      |                   |                      |                    |                   |
  |------------------------->|                      |                   |                      |                    |                   |
  |                          |                      |                   |                      |                    |                   |
  |                          |  Validate credits    |                   |                      |                    |                   |
  |                          |  Validate brand      |                   |                      |                    |                   |
  |                          |  exists + owned      |                   |                      |                    |                   |
  |                          |                      |                   |                      |                    |                   |
  |                          |  Add job to queue    |                   |                      |                    |                   |
  |                          |--------------------->|                   |                      |                    |                   |
  |                          |                      |                   |                      |                    |                   |
  |  { jobId, status:queued }|                      |                   |                      |                    |                   |
  |<-------------------------|                      |                   |                      |                    |                   |
  |                          |                      |                   |                      |                    |                   |
  |  (already on Socket.io)  |                      |  Pick up job      |                      |                    |                   |
  |                          |                      |------------------>|                      |                    |                   |
  |                          |                      |                   |                      |                    |                   |
  |                          |                      |                   |  1. Compose prompt   |                    |                   |
  |                          |                      |                   |  (Claude Sonnet 4.6) |                    |                   |
  |                          |                      |                   |  Brand DNA + style   |                    |                   |
  |                          |                      |                   |  -> logo prompt      |                    |                   |
  |                          |                      |                   |                      |                    |                   |
  |  wizard:job-progress     |                      |                   |                      |                    |                   |
  |  {progress:10,           |<--------------------------------------------------------------------|                   |
  |   status:'composing'}    |                      |                   |                      |                    |                   |
  |                          |                      |                   |                      |                    |                   |
  |                          |                      |                   |  2. Generate 4 logos |                    |                   |
  |                          |                      |                   |  (parallel FLUX.2)   |                    |                   |
  |                          |                      |                   |--------------------->|                    |                   |
  |                          |                      |                   |                      |                    |                   |
  |  wizard:job-progress     |                      |                   |                      |                    |                   |
  |  {progress:25,           |<--------------------------------------------------------------------|                   |
  |   status:'gen 1/4'}      |                      |                   |                      |                    |                   |
  |                          |                      |                   |                      |                    |                   |
  |  wizard:job-progress     |                      |                   |  Receive images      |                    |                   |
  |  {progress:50,           |<--------------------------------------------------------------------|                   |
  |   status:'gen 2/4'}      |                      |                   |<---------------------|                    |                   |
  |                          |                      |                   |                      |                    |                   |
  |  (... 3/4, 4/4)          |                      |                   |                      |                    |                   |
  |                          |                      |                   |  3. Upload to R2     |                    |                   |
  |                          |                      |                   |-------------------------------------------->|                   |
  |                          |                      |                   |                      |                    |                   |
  |  wizard:job-progress     |                      |                   |                      |                    |                   |
  |  {progress:80,           |<--------------------------------------------------------------------|                   |
  |   status:'uploading'}    |                      |                   |                      |                    |                   |
  |                          |                      |                   |  4. Save to DB       |                    |                   |
  |                          |                      |                   |  (brand_assets)      |                    |                   |
  |                          |                      |                   |                      |                    |                   |
  |  wizard:job-progress     |                      |                   |                      |                    |                   |
  |  {progress:90,           |<--------------------------------------------------------------------|                   |
  |   status:'saving'}       |                      |                   |                      |                    |                   |
  |                          |                      |                   |                      |                    |                   |
  |  wizard:job-complete     |                      |                   |  5. Deduct credits   |                    |                   |
  |  {progress:100,          |<--------------------------------------------------------------------|                   |
  |   result:{logos:[...]}}  |                      |                   |                      |                    |                   |
  |                          |                      |                   |                      |                    |                   |
  v                          v                      v                   v                      v                    v                   v
Client renders logo grid with animation
```

### 5.3 Mockup Generation Flow

```
POST /api/v1/mockups/:brandId/generate
  |
  |  Body: { productIds: ['prod_1', 'prod_2', ...], logoId: 'logo_xxx' }
  |
  v
Express Handler:
  |-- Validate: user owns brand, has credits, products exist
  |-- For each productId, create a BullMQ job in 'mockup-generation' queue
  |-- Return: { jobs: [{ jobId, productId, status: 'queued' }] }
  |
  v
BullMQ Worker (mockup-generation) -- one job per product:
  |
  |  Step 1: Load product template + brand design config
  |  Socket.io emit: { progress: 10, status: 'loading template' }
  |
  |  Step 2: Compose mockup prompt
  |  - Product: "White cotton t-shirt, front view, flat lay"
  |  - Logo: URL of selected logo
  |  - Style: "Place logo centered on chest, brand colors as accents"
  |  - Brand: color palette, style preferences
  |  Socket.io emit: { progress: 20, status: 'composing prompt' }
  |
  |  Step 3: Generate mockup via GPT Image 1.5 (OpenAI direct)
  |  - Model: gpt-image-1.5
  |  - Size: 1024x1024
  |  - Prompt: composed in Step 2
  |  Socket.io emit: { progress: 60, status: 'generating mockup' }
  |
  |  Step 4: NSFW check (Google Cloud Vision SafeSearch)
  |  - If flagged: reject, log, notify admin
  |  Socket.io emit: { progress: 75, status: 'safety check' }
  |
  |  Step 5: Upload to Cloudflare R2
  |  Socket.io emit: { progress: 85, status: 'uploading' }
  |
  |  Step 6: Save to brand_assets table
  |  Socket.io emit: { progress: 95, status: 'saving' }
  |
  |  Step 7: Complete
  |  Socket.io emit: { progress: 100, status: 'complete', result: { mockupUrl, ... } }
  |
  v
Client renders each mockup as it completes (waterfall effect)
```

### 5.4 Payment Flow

```
Client                Stripe                  Express API          BullMQ           Supabase
  |                      |                        |                   |                |
  |  POST /payments/     |                        |                   |                |
  |  checkout            |                        |                   |                |
  |--------------------------------------------->|                   |                |
  |                      |                        |                   |                |
  |                      |   Create Stripe        |                   |                |
  |                      |   Checkout Session      |                   |                |
  |                      |<-----------------------|                   |                |
  |                      |                        |                   |                |
  |  Redirect to Stripe  |   { sessionUrl }       |                   |                |
  |  Checkout URL        |                        |                   |                |
  |<---------------------------------------------|                   |                |
  |                      |                        |                   |                |
  |  User enters payment |                        |                   |                |
  |  details on Stripe   |                        |                   |                |
  |--------------------->|                        |                   |                |
  |                      |                        |                   |                |
  |                      |  checkout.session       |                   |                |
  |                      |  .completed webhook     |                   |                |
  |                      |----------------------->|                   |                |
  |                      |                        |                   |                |
  |                      |        Verify webhook  |                   |                |
  |                      |        signature       |                   |                |
  |                      |                        |                   |                |
  |                      |        Queue webhook   |                   |                |
  |                      |        processing job  |                   |                |
  |                      |        Return 200 OK   |                   |                |
  |                      |        (fast, no       |                   |                |
  |                      |         processing)    |                   |                |
  |                      |                        |------------------>|                |
  |                      |                        |                   |                |
  |                      |                        |   Worker picks    |                |
  |                      |                        |   up job:         |                |
  |                      |                        |                   |                |
  |                      |                        |   1. Create or    |                |
  |                      |                        |   update sub      |                |
  |                      |                        |   record          |                |
  |                      |                        |   -------------------------------->|
  |                      |                        |                   |                |
  |                      |                        |   2. Allocate     |                |
  |                      |                        |   credits based   |                |
  |                      |                        |   on tier         |                |
  |                      |                        |   -------------------------------->|
  |                      |                        |                   |                |
  |                      |                        |   3. Queue email  |                |
  |                      |                        |   confirmation    |                |
  |                      |                        |   4. Queue CRM    |                |
  |                      |                        |   sync (GHL)      |                |
  |                      |                        |                   |                |
  |  Stripe redirects    |                        |                   |                |
  |  to success URL      |                        |                   |                |
  |<---------------------|                        |                   |                |
  |                      |                        |                   |                |
  |  Client polls        |                        |                   |                |
  |  GET /payments/      |                        |                   |                |
  |  subscription        |                        |                   |                |
  |  until active        |                        |                   |                |
  |--------------------------------------------->|                   |                |
  |                      |              Query DB  |                   |                |
  |                      |                        |------------------------------>    |
  |                      |                        |                   |                |
  |  { status: 'active', |                        |                   |                |
  |    tier: 'starter',  |                        |                   |                |
  |    credits: 20 }     |                        |                   |                |
  |<---------------------------------------------|                   |                |
```

### 5.5 Auth Flow

```
Client (React SPA)           Express API           Supabase Auth         Supabase DB
  |                               |                      |                    |
  |  1. User clicks "Sign Up"    |                      |                    |
  |  supabase.auth.signUp({      |                      |                    |
  |    email, password            |                      |                    |
  |  })                           |                      |                    |
  |--------------------------------------------->|                    |
  |                               |              |  Create user       |
  |                               |              |  Send confirm email|
  |  { user, session: null }      |              |                    |
  |<---------------------------------------------|                    |
  |                               |                      |                    |
  |  2. User confirms email       |                      |                    |
  |  (clicks link)                |                      |                    |
  |--------------------------------------------->|                    |
  |                               |              |  Verify email      |
  |  { user, session: {          |              |  Issue JWT         |
  |    access_token,              |              |                    |
  |    refresh_token              |              |                    |
  |  }}                           |              |                    |
  |<---------------------------------------------|                    |
  |                               |                      |                    |
  |  3. Client stores session     |                      |                    |
  |  Zustand auth store           |                      |                    |
  |                               |                      |                    |
  |  4. API call with JWT         |                      |                    |
  |  Authorization: Bearer {jwt}  |                      |                    |
  |------------------------------>|                      |                    |
  |                               |                      |                    |
  |                    Auth middleware:                   |                    |
  |                    supabase.auth.getUser(token)       |                    |
  |                               |--------------------->|                    |
  |                               |  { user }            |                    |
  |                               |<---------------------|                    |
  |                               |                      |                    |
  |                    Attach req.user                    |                    |
  |                    Attach req.tenant                  |                    |
  |                               |                      |                    |
  |                    Handler executes:                  |                    |
  |                    scopedQuery('brands', req)         |                    |
  |                               |  SELECT * FROM brands |                   |
  |                               |  WHERE user_id = req.user.id              |
  |                               |------------------------------------------->|
  |                               |  { rows }            |                    |
  |                               |<-------------------------------------------|
  |                               |                      |                    |
  |  { data: brands[] }          |                      |                    |
  |<------------------------------|                      |                    |
  |                               |                      |                    |
  |  5. Token refresh (auto)      |                      |                    |
  |  supabase.auth.refreshSession()|                     |                    |
  |--------------------------------------------->|                    |
  |  { new access_token }         |              |                    |
  |<---------------------------------------------|                    |
  |                               |                      |                    |
  |  6. RLS enforcement           |                      |                    |
  |  (Supabase client-side calls  |                      |                    |
  |   also use RLS policies --    |                      |                    |
  |   user can only see own data) |                      |                    |
```

---

## 6. Agent Architecture Diagram

### Parent-Subagent Hierarchy

```
+======================================================================+
|                     ANTHROPIC AGENT SDK                                |
|                     (Orchestration Layer)                              |
|                                                                       |
|  +================================================================+  |
|  |          BRAND WIZARD AGENT (Parent)                            |  |
|  |          Model: Claude Sonnet 4.6                               |  |
|  |          maxTurns: 50  |  maxBudgetUsd: $2.00                   |  |
|  |          permissionMode: bypassPermissions (server-side)        |  |
|  |                                                                  |  |
|  |  System Prompt:                                                  |  |
|  |  "You are a brand creation specialist. Guide users through      |  |
|  |   building their brand identity, generating logos, creating     |  |
|  |   mockups, and projecting revenue. Use your skills to           |  |
|  |   delegate specialized tasks to subagents."                     |  |
|  |                                                                  |  |
|  |  Direct Tools:                                                   |  |
|  |  +------------------+  +------------------+  +----------------+ |  |
|  |  | saveBrandData()  |  | searchProducts() |  | queueCRMSync() | |  |
|  |  | Supabase upsert  |  | Supabase query   |  | BullMQ dispatch| |  |
|  |  +------------------+  +------------------+  +----------------+ |  |
|  |  +------------------+  +------------------+                     |  |
|  |  | sendEmail()      |  | validateInput()  |                     |  |
|  |  | BullMQ dispatch  |  | Gemini 3.0 Flash |                     |  |
|  |  +------------------+  +------------------+                     |  |
|  |                                                                  |  |
|  |  Subagent Skills (spawned via Task tool):                        |  |
|  |                                                                  |  |
|  |  +------------------------------------------------------------+ |  |
|  |  |  SKILL 1: social-analyzer                                   | |  |
|  |  |  Model: Claude Sonnet 4.6 (extended thinking)               | |  |
|  |  |  Budget: $0.50  |  maxTurns: 15                             | |  |
|  |  |                                                              | |  |
|  |  |  Tools:                                                      | |  |
|  |  |  - scrapeInstagram()  --> Apify API                         | |  |
|  |  |  - scrapeTikTok()     --> Apify API                         | |  |
|  |  |  - scrapeFacebook()   --> Apify API                         | |  |
|  |  |  - analyzeAesthetic() --> Gemini 3.0 Flash (cheap vision)   | |  |
|  |  |                                                              | |  |
|  |  |  Output: { aesthetic, themes, audience, engagement,          | |  |
|  |  |            brandDNA, growthTrajectory }                      | |  |
|  |  +------------------------------------------------------------+ |  |
|  |                                                                  |  |
|  |  +------------------------------------------------------------+ |  |
|  |  |  SKILL 2: brand-generator                                   | |  |
|  |  |  Model: Claude Sonnet 4.6                                   | |  |
|  |  |  Budget: $0.30  |  maxTurns: 10                             | |  |
|  |  |                                                              | |  |
|  |  |  Tools:                                                      | |  |
|  |  |  - generateVision()    --> Claude (native, no external API) | |  |
|  |  |  - generateValues()    --> Claude (native)                  | |  |
|  |  |  - generateArchetype() --> Claude (native)                  | |  |
|  |  |  - suggestColorPalette() --> Claude (native)                | |  |
|  |  |  - suggestTypography()   --> Claude (native)                | |  |
|  |  |                                                              | |  |
|  |  |  Output: { vision, values[], archetype, colorPalette[],     | |  |
|  |  |            typography: { primary, secondary } }              | |  |
|  |  +------------------------------------------------------------+ |  |
|  |                                                                  |  |
|  |  +------------------------------------------------------------+ |  |
|  |  |  SKILL 3: name-generator                                    | |  |
|  |  |  Model: Claude Sonnet 4.6                                   | |  |
|  |  |  Budget: $0.30  |  maxTurns: 10                             | |  |
|  |  |                                                              | |  |
|  |  |  Tools:                                                      | |  |
|  |  |  - suggestNames()    --> Claude (creative generation)       | |  |
|  |  |  - checkDomain()     --> WHOIS API                          | |  |
|  |  |  - checkTrademark()  --> USPTO API / web search             | |  |
|  |  |                                                              | |  |
|  |  |  Output: { names[]: { name, available, domain, conflicts } }| |  |
|  |  +------------------------------------------------------------+ |  |
|  |                                                                  |  |
|  |  +------------------------------------------------------------+ |  |
|  |  |  SKILL 4: logo-creator                                      | |  |
|  |  |  Model: Claude Sonnet 4.6 (for prompt composition)          | |  |
|  |  |  Budget: $0.50  |  maxTurns: 20                             | |  |
|  |  |                                                              | |  |
|  |  |  Tools:                                                      | |  |
|  |  |  - composeLogoPrompt() --> Claude (prompt engineering)      | |  |
|  |  |  - generateLogo()      --> BFL API (FLUX.2 Pro)             | |  |
|  |  |  - refineLogo()        --> BFL API (with modification)      | |  |
|  |  |  - removeBg()          --> remove.bg API or Rembg           | |  |
|  |  |  - uploadAsset()       --> Cloudflare R2                    | |  |
|  |  |                                                              | |  |
|  |  |  Output: { logos[]: { url, thumbnailUrl, prompt, style } }  | |  |
|  |  +------------------------------------------------------------+ |  |
|  |                                                                  |  |
|  |  +------------------------------------------------------------+ |  |
|  |  |  SKILL 5: mockup-renderer                                   | |  |
|  |  |  Model: Claude Sonnet 4.6 (for prompt composition)          | |  |
|  |  |  Budget: $0.50  |  maxTurns: 20                             | |  |
|  |  |                                                              | |  |
|  |  |  Tools:                                                      | |  |
|  |  |  - composeMockupPrompt() --> Claude (prompt engineering)    | |  |
|  |  |  - generateMockup()      --> OpenAI GPT Image 1.5           | |  |
|  |  |  - generateTextImage()   --> Ideogram v3 (typography)       | |  |
|  |  |  - compositeBundle()     --> Google AI Gemini 3 Pro Image   | |  |
|  |  |  - uploadAsset()         --> Cloudflare R2                  | |  |
|  |  |  - nsfwCheck()           --> Google Cloud Vision SafeSearch  | |  |
|  |  |                                                              | |  |
|  |  |  Output: { mockups[]: { url, productId, status, prompt } }  | |  |
|  |  +------------------------------------------------------------+ |  |
|  |                                                                  |  |
|  |  +------------------------------------------------------------+ |  |
|  |  |  SKILL 6: profit-calculator                                  | |  |
|  |  |  Model: None (pure computation -- no AI call needed)         | |  |
|  |  |  Budget: $0.00  |  maxTurns: 5                               | |  |
|  |  |                                                              | |  |
|  |  |  Tools:                                                      | |  |
|  |  |  - calculateMargins()  --> Pure math (cost, price, margin)  | |  |
|  |  |  - projectRevenue()    --> Revenue at 3 sales tiers         | |  |
|  |  |  - compareBundles()    --> Bundle vs individual pricing     | |  |
|  |  |                                                              | |  |
|  |  |  Output: { products[]: { margins, projections },             | |  |
|  |  |            bundles[]: { margins, projections } }             | |  |
|  |  +------------------------------------------------------------+ |  |
|  |                                                                  |  |
|  |  +------------------------------------------------------------+ |  |
|  |  |  SKILL 7: video-creator (Phase 2)                           | |  |
|  |  |  Model: Claude Sonnet 4.6 (for prompt composition)          | |  |
|  |  |  Budget: $1.00  |  maxTurns: 15                             | |  |
|  |  |                                                              | |  |
|  |  |  Tools:                                                      | |  |
|  |  |  - composeVideoPrompt()  --> Claude (storyboard creation)   | |  |
|  |  |  - generateVideo()       --> Google AI Veo 3                | |  |
|  |  |  - uploadVideo()         --> Cloudflare R2                  | |  |
|  |  |                                                              | |  |
|  |  |  Output: { videos[]: { url, duration, prompt } }            | |  |
|  |  +------------------------------------------------------------+ |  |
|  |                                                                  |  |
|  +================================================================+  |
|                                                                       |
|  Lifecycle Hooks (applied to all agents):                             |
|  +---------------------------------------------------------------+   |
|  | PreToolUse:                                                     |   |
|  |   - Log tool call to pino (structured JSON)                    |   |
|  |   - Check rate limits (Redis-backed)                           |   |
|  |   - Check credit balance                                       |   |
|  |                                                                 |   |
|  | PostToolUse:                                                    |   |
|  |   - Emit Socket.io progress event to brand room                |   |
|  |   - Update BullMQ job progress                                 |   |
|  |   - Log tool result + latency                                  |   |
|  |   - Track cost in audit_log                                    |   |
|  |                                                                 |   |
|  | PostToolUseFailure:                                             |   |
|  |   - Log error to Sentry with full context                      |   |
|  |   - Emit Socket.io error event                                 |   |
|  |   - Trigger fallback model if applicable                       |   |
|  |                                                                 |   |
|  | SessionEnd:                                                     |   |
|  |   - Save session ID for resume capability                      |   |
|  |   - Record total cost to audit_log                             |   |
|  |   - Cleanup temporary resources                                |   |
|  +---------------------------------------------------------------+   |
+======================================================================+
```

### BullMQ Integration with Agents

```
API Request
  |
  v
Express Route Handler
  |
  |  Validate request + check credits
  |
  v
BullMQ Queue.add('brand-wizard', {
  userId, brandId, step, sessionId, input
})
  |
  v
Return { jobId } immediately (< 50ms)
  |
  v
                              BullMQ Worker Process
                              +----------------------------------+
                              |                                  |
                              |  new Worker('brand-wizard',      |
                              |    async (job) => {              |
                              |                                  |
                              |    // Run Anthropic Agent SDK    |
                              |    for await (const msg of       |
                              |      query({                     |
                              |        prompt: stepPrompt,       |
                              |        options: {                |
                              |          model: 'claude-sonnet', |
                              |          allowedTools: tools,    |
                              |          resume: sessionId,      |
                              |          maxTurns: 30,           |
                              |          maxBudgetUsd: 2.00,     |
                              |        },                        |
                              |        hooks: {                  |
                              |          PostToolUse: ->          |
                              |            Socket.io emit,       |
                              |          PostToolUseFailure: ->  |
                              |            Sentry.capture,       |
                              |        },                        |
                              |      })) {                       |
                              |                                  |
                              |      // Stream agent output      |
                              |      // to Socket.io room        |
                              |    }                             |
                              |  })                              |
                              +----------------------------------+
```

### Tool Registry Auto-Discovery

```
server/skills/
  |
  v
tool-registry.js at startup:
  |
  |  1. Scan skills/ directory
  |  2. Import each skill/index.js
  |  3. Validate subagent config (Zod schema)
  |  4. Register with Anthropic Agent SDK
  |
  v
Registry Map:
  {
    'social-analyzer':  { prompt, tools, config },
    'brand-generator':  { prompt, tools, config },
    'name-generator':   { prompt, tools, config },
    'logo-creator':     { prompt, tools, config },
    'mockup-renderer':  { prompt, tools, config },
    'profit-calculator':{ prompt, tools, config },
    'video-creator':    { prompt, tools, config },  // Phase 2
  }
  |
  v
Brand Wizard Agent receives registry as available Task targets
  |
  v
Agent autonomously decides which skill to invoke based on user request
```

---

## 7. Monorepo Structure

```
brand-me-now-v2/
|
|-- package.json                      # Root workspace config (npm workspaces)
|-- package-lock.json
|-- .gitignore
|-- .env.example                      # Template with all required env vars
|-- .eslintrc.cjs                     # Shared ESLint config
|-- .prettierrc                       # Shared Prettier config
|-- docker-compose.yml                # Development orchestration
|-- docker-compose.prod.yml           # Production overrides
|-- turbo.json                        # Turborepo config (optional, for build caching)
|-- jsconfig.json                     # Root JSDoc/TS config for IDE support
|
|-- docs/                             # All documentation
|   |-- prd/                          # Product requirements and specs
|   |   |-- README.md                 # Index and build order
|   |   |-- 01-PRODUCT-REQUIREMENTS.md
|   |   |-- 02-ARCHITECTURE-OVERVIEW.md  # <-- THIS DOCUMENT
|   |   |-- 03-SERVER-CORE.md
|   |   |-- 04-AGENT-SYSTEM.md
|   |   |-- 05-SKILL-MODULES.md
|   |   |-- 06-REAL-TIME-JOBS.md
|   |   |-- 07-DATABASE.md
|   |   |-- 08-AUTH-SECURITY.md
|   |   |-- 09-FRONTEND-APP.md
|   |   |-- 10-PAYMENTS-BILLING.md
|   |   |-- 11-INTEGRATIONS.md
|   |   |-- 12-OBSERVABILITY.md
|   |   |-- 13-DEPLOYMENT-INFRA.md
|   |   |-- 14-TESTING.md
|   |   |-- 15-MARKETING-SITE.md
|   |   '-- 16-MIGRATION-GUIDE.md
|   '-- adr/                          # Architecture Decision Records
|       '-- 001-agent-sdk-choice.md
|
|-- server/                           # Express.js API server
|   |-- package.json                  # Server dependencies
|   |-- Dockerfile                    # Production API image
|   |-- Dockerfile.worker             # Production worker image
|   |-- Dockerfile.bull-board         # Bull Board monitoring
|   |
|   |-- src/
|   |   |-- index.js                  # Server entrypoint (boots Express + Socket.io)
|   |   |-- app.js                    # Express app factory (middleware chain)
|   |   |
|   |   |-- config/
|   |   |   |-- index.js              # Centralized config (reads env vars)
|   |   |   |-- validate-env.js       # Startup env var validation (crash if missing)
|   |   |   |-- redis.js              # Redis connection factory
|   |   |   |-- supabase.js           # Supabase client factory
|   |   |   '-- crm-fields.yaml      # GHL field mapping config
|   |   |
|   |   |-- middleware/
|   |   |   |-- auth.js               # JWT verification via Supabase Auth
|   |   |   |-- tenant.js             # Tenant context (userId, orgId, tier, limits)
|   |   |   |-- rate-limit.js         # Redis-backed rate limiting (general + generation)
|   |   |   |-- validate.js           # Zod schema validation middleware factory
|   |   |   |-- error-handler.js      # Global error handler (Sentry + structured response)
|   |   |   '-- admin.js              # Admin role check middleware
|   |   |
|   |   |-- routes/
|   |   |   |-- index.js              # Route aggregator (/api/v1/*)
|   |   |   |-- auth.routes.js        # /auth/*
|   |   |   |-- profiles.routes.js    # /profiles/*
|   |   |   |-- brands.routes.js      # /brands/*
|   |   |   |-- wizard.routes.js      # /wizard/*
|   |   |   |-- logos.routes.js       # /logos/*
|   |   |   |-- mockups.routes.js     # /mockups/*
|   |   |   |-- products.routes.js    # /products/*
|   |   |   |-- bundles.routes.js     # /bundles/*
|   |   |   |-- payments.routes.js    # /payments/*
|   |   |   |-- chat.routes.js        # /chat/*
|   |   |   |-- webhooks.routes.js    # /webhooks/* (Stripe, GHL, Supabase)
|   |   |   |-- admin.routes.js       # /admin/*
|   |   |   '-- health.routes.js      # /health/*
|   |   |
|   |   |-- handlers/
|   |   |   |-- auth.handler.js       # Auth business logic
|   |   |   |-- profiles.handler.js
|   |   |   |-- brands.handler.js
|   |   |   |-- wizard.handler.js
|   |   |   |-- logos.handler.js
|   |   |   |-- mockups.handler.js
|   |   |   |-- products.handler.js
|   |   |   |-- bundles.handler.js
|   |   |   |-- payments.handler.js
|   |   |   |-- chat.handler.js
|   |   |   |-- webhooks.handler.js
|   |   |   '-- admin.handler.js
|   |   |
|   |   |-- services/
|   |   |   |-- ai/
|   |   |   |   |-- model-router.js   # Multi-model routing with fallback chains
|   |   |   |   |-- anthropic.js      # Anthropic SDK client wrapper
|   |   |   |   |-- openai.js         # OpenAI SDK client wrapper
|   |   |   |   |-- google.js         # Google AI SDK client wrapper
|   |   |   |   '-- cost-tracker.js   # Per-request AI cost tracking
|   |   |   |
|   |   |   |-- storage/
|   |   |   |   |-- r2.js             # Cloudflare R2 upload/download
|   |   |   |   '-- supabase-storage.js # Supabase Storage operations
|   |   |   |
|   |   |   |-- payments/
|   |   |   |   |-- stripe.js         # Stripe SDK wrapper
|   |   |   |   |-- credits.js        # Credit allocation + deduction logic
|   |   |   |   '-- webhooks.js       # Stripe webhook event processing
|   |   |   |
|   |   |   |-- crm/
|   |   |   |   |-- ghl.js            # GoHighLevel OAuth + API client
|   |   |   |   '-- field-mapper.js   # Config-driven field mapping
|   |   |   |
|   |   |   |-- email/
|   |   |   |   |-- resend.js         # Resend SDK wrapper
|   |   |   |   '-- templates/        # React Email templates
|   |   |   |       |-- welcome.jsx
|   |   |   |       |-- brand-complete.jsx
|   |   |   |       |-- wizard-abandoned.jsx
|   |   |   |       '-- payment-confirmation.jsx
|   |   |   |
|   |   |   '-- scraping/
|   |   |       '-- apify.js          # Apify client for social scraping
|   |   |
|   |   |-- sockets/
|   |   |   |-- index.js              # Socket.io server setup + Redis adapter
|   |   |   |-- wizard.namespace.js   # /wizard namespace handlers
|   |   |   |-- admin.namespace.js    # /admin namespace handlers
|   |   |   '-- chat.namespace.js     # /chat namespace handlers
|   |   |
|   |   |-- workers/
|   |   |   |-- index.js              # Worker entrypoint (starts all BullMQ workers)
|   |   |   |-- brand-wizard.js       # Brand wizard agent worker
|   |   |   |-- logo-generation.js    # Logo generation worker
|   |   |   |-- mockup-generation.js  # Mockup generation worker
|   |   |   |-- bundle-composition.js # Bundle image composition worker
|   |   |   |-- crm-sync.js           # GoHighLevel sync worker
|   |   |   |-- email-send.js         # Email dispatch worker
|   |   |   '-- cleanup.js            # Expired job/temp file cleanup worker
|   |   |
|   |   |-- skills/
|   |   |   |-- social-analyzer/
|   |   |   |   |-- index.js          # Subagent registration
|   |   |   |   |-- tools.js          # Tool definitions (Zod schemas)
|   |   |   |   |-- prompts.js        # System prompts + templates
|   |   |   |   |-- handlers.js       # Tool execution logic
|   |   |   |   '-- config.js         # Budget, model, timeouts
|   |   |   |
|   |   |   |-- brand-generator/
|   |   |   |   |-- index.js
|   |   |   |   |-- tools.js
|   |   |   |   |-- prompts.js
|   |   |   |   |-- handlers.js
|   |   |   |   '-- config.js
|   |   |   |
|   |   |   |-- name-generator/
|   |   |   |   |-- index.js
|   |   |   |   |-- tools.js
|   |   |   |   |-- prompts.js
|   |   |   |   |-- handlers.js
|   |   |   |   '-- config.js
|   |   |   |
|   |   |   |-- logo-creator/
|   |   |   |   |-- index.js
|   |   |   |   |-- tools.js
|   |   |   |   |-- prompts.js
|   |   |   |   |-- handlers.js
|   |   |   |   '-- config.js
|   |   |   |
|   |   |   |-- mockup-renderer/
|   |   |   |   |-- index.js
|   |   |   |   |-- tools.js
|   |   |   |   |-- prompts.js
|   |   |   |   |-- handlers.js
|   |   |   |   '-- config.js
|   |   |   |
|   |   |   |-- profit-calculator/
|   |   |   |   |-- index.js
|   |   |   |   |-- tools.js
|   |   |   |   |-- handlers.js
|   |   |   |   '-- config.js
|   |   |   |
|   |   |   |-- video-creator/        # Phase 2
|   |   |   |   |-- index.js
|   |   |   |   |-- tools.js
|   |   |   |   |-- prompts.js
|   |   |   |   |-- handlers.js
|   |   |   |   '-- config.js
|   |   |   |
|   |   |   '-- _shared/
|   |   |       |-- tool-registry.js   # Auto-discovers + registers all skills
|   |   |       |-- image-tools.js     # Shared image gen tools (BFL, OpenAI, etc.)
|   |   |       |-- prompt-utils.js    # Safe prompt construction (XML delimiters)
|   |   |       '-- model-router.js    # Multi-model routing with fallbacks
|   |   |
|   |   |-- queues/
|   |   |   |-- index.js              # Queue definitions + connection config
|   |   |   '-- schemas.js            # Zod schemas for all job payloads
|   |   |
|   |   |-- db/
|   |   |   |-- queries/              # Raw SQL query builders
|   |   |   |   |-- brands.queries.js
|   |   |   |   |-- profiles.queries.js
|   |   |   |   |-- products.queries.js
|   |   |   |   |-- assets.queries.js
|   |   |   |   '-- audit.queries.js
|   |   |   '-- migrations/           # SQL migration files
|   |   |       |-- 001_profiles.sql
|   |   |       |-- 002_brands.sql
|   |   |       |-- 003_products.sql
|   |   |       |-- 004_assets.sql
|   |   |       |-- 005_bundles.sql
|   |   |       |-- 006_subscriptions.sql
|   |   |       |-- 007_audit_log.sql
|   |   |       '-- 008_rls_policies.sql
|   |   |
|   |   '-- lib/
|   |       |-- logger.js             # Pino structured logging
|   |       |-- errors.js             # Custom error classes (AppError, etc.)
|   |       '-- resume-token.js       # HMAC-SHA256 wizard resume token utils
|   |
|   '-- tests/
|       |-- setup.js                  # Test setup (MSW, mocks, fixtures)
|       |-- unit/
|       |   |-- middleware/
|       |   |-- handlers/
|       |   |-- services/
|       |   '-- skills/
|       |-- integration/
|       |   |-- auth.test.js
|       |   |-- brands.test.js
|       |   '-- generation.test.js
|       '-- fixtures/
|           |-- users.js
|           |-- brands.js
|           '-- products.js
|
|-- client/                           # React 19 SPA (Vite 7)
|   |-- package.json
|   |-- vite.config.js
|   |-- index.html
|   |-- Dockerfile.dev                # Dev server
|   |-- Dockerfile                    # Production build (static)
|   |
|   |-- public/
|   |   |-- favicon.ico
|   |   '-- fonts/                    # Self-hosted Google Fonts subset
|   |
|   '-- src/
|       |-- App.jsx                   # Router setup + providers
|       |-- main.jsx                  # Vite entrypoint
|       |
|       |-- routes/
|       |   |-- wizard/
|       |   |   |-- layout.jsx        # Wizard shell (progress bar, nav)
|       |   |   |-- onboarding.jsx    # Step 1
|       |   |   |-- social-analysis.jsx    # Step 2
|       |   |   |-- brand-identity.jsx     # Step 3
|       |   |   |-- customization.jsx      # Step 4
|       |   |   |-- logo-generation.jsx    # Step 5
|       |   |   |-- logo-refinement.jsx    # Step 6
|       |   |   |-- product-selection.jsx  # Step 7
|       |   |   |-- mockup-review.jsx      # Step 8
|       |   |   |-- bundle-builder.jsx     # Step 9
|       |   |   |-- profit-calculator.jsx  # Step 10
|       |   |   |-- checkout.jsx           # Step 11
|       |   |   '-- complete.jsx           # Step 12
|       |   |
|       |   |-- dashboard/
|       |   |   |-- layout.jsx
|       |   |   |-- brands.jsx
|       |   |   |-- brand-detail.jsx
|       |   |   '-- settings.jsx
|       |   |
|       |   |-- admin/
|       |   |   |-- layout.jsx
|       |   |   |-- users.jsx
|       |   |   |-- brands.jsx
|       |   |   |-- jobs.jsx
|       |   |   |-- products.jsx
|       |   |   |-- moderation.jsx
|       |   |   '-- analytics.jsx
|       |   |
|       |   '-- auth/
|       |       |-- login.jsx
|       |       '-- signup.jsx
|       |
|       |-- stores/
|       |   |-- wizard-store.js       # Zustand: wizard state (slices)
|       |   |-- auth-store.js         # Zustand: auth state
|       |   '-- ui-store.js           # Zustand: UI preferences (theme, sidebar)
|       |
|       |-- hooks/
|       |   |-- use-wizard-api.js     # TanStack Query: wizard API calls
|       |   |-- use-socket.js         # Socket.io connection management
|       |   |-- use-generation-progress.js  # Real-time generation tracking
|       |   |-- use-brand-data.js     # TanStack Query: brand CRUD
|       |   |-- use-auth.js           # Supabase auth hook
|       |   '-- use-credits.js        # Credit balance + usage hook
|       |
|       |-- components/
|       |   |-- ui/                   # Design system primitives
|       |   |   |-- Button.jsx
|       |   |   |-- Input.jsx
|       |   |   |-- Card.jsx
|       |   |   |-- Modal.jsx
|       |   |   |-- Select.jsx
|       |   |   |-- Spinner.jsx
|       |   |   |-- Toast.jsx
|       |   |   |-- Badge.jsx
|       |   |   '-- Skeleton.jsx
|       |   |
|       |   |-- wizard/
|       |   |   |-- ProgressBar.jsx
|       |   |   |-- StepNavigation.jsx
|       |   |   |-- GenerationProgress.jsx
|       |   |   '-- ChatWidget.jsx
|       |   |
|       |   |-- brand/
|       |   |   |-- LogoGrid.jsx
|       |   |   |-- MockupViewer.jsx
|       |   |   |-- ColorPalette.jsx
|       |   |   |-- FontPreview.jsx
|       |   |   |-- BrandCard.jsx
|       |   |   '-- BundleBuilder.jsx
|       |   |
|       |   '-- layout/
|       |       |-- Header.jsx
|       |       |-- Sidebar.jsx
|       |       |-- Footer.jsx
|       |       '-- ProtectedRoute.jsx
|       |
|       |-- lib/
|       |   |-- api-client.js         # Fetch/Axios wrapper with auth headers
|       |   |-- socket-client.js      # Socket.io client singleton
|       |   |-- supabase-client.js    # Supabase browser client
|       |   '-- validation-schemas.js # Shared Zod schemas (import from shared/)
|       |
|       '-- styles/
|           |-- design-tokens.css     # CSS variables design system
|           |-- global.css            # Tailwind 4 + base styles
|           '-- animations.css        # Shared animation definitions
|
|-- marketing/                        # Next.js 15 Marketing Site
|   |-- package.json
|   |-- next.config.js
|   |-- Dockerfile.dev
|   |-- Dockerfile
|   |
|   '-- src/
|       |-- app/
|       |   |-- layout.jsx           # Root layout
|       |   |-- page.jsx             # Landing page (/)
|       |   |-- pricing/page.jsx     # Pricing page
|       |   |-- features/page.jsx    # Features page
|       |   |-- blog/
|       |   |   |-- page.jsx         # Blog index
|       |   |   '-- [slug]/page.jsx  # Blog post
|       |   '-- terms/page.jsx       # Terms of service
|       |
|       |-- components/
|       |   |-- Header.jsx
|       |   |-- Footer.jsx
|       |   |-- PricingTable.jsx
|       |   |-- Hero.jsx
|       |   |-- FeatureCard.jsx
|       |   '-- CTA.jsx
|       |
|       '-- content/                  # MDX blog posts
|           '-- posts/
|
|-- shared/                           # Shared code (used by server + client)
|   |-- package.json
|   |-- schemas/
|   |   |-- brand.schema.js          # Zod schema for brand data
|   |   |-- profile.schema.js        # Zod schema for profile data
|   |   |-- wizard.schema.js         # Zod schema for wizard step data
|   |   |-- product.schema.js        # Zod schema for product data
|   |   '-- payment.schema.js        # Zod schema for payment data
|   |
|   |-- constants/
|   |   |-- wizard-steps.js          # Step definitions, labels, order
|   |   |-- subscription-tiers.js    # Tier names, limits, pricing
|   |   |-- product-categories.js    # Product category definitions
|   |   '-- brand-archetypes.js      # Brand archetype list + descriptions
|   |
|   '-- utils/
|       |-- format.js                # Currency, date, number formatting
|       '-- validation.js            # Shared validation helpers
|
|-- scripts/                          # Utility scripts
|   |-- seed-products.js             # Seed product catalog to Supabase
|   |-- seed-admin.js                # Create admin user
|   |-- migrate.js                   # Run database migrations
|   |-- generate-resume-token.js     # CLI tool: generate wizard resume token
|   '-- health-check.js             # Production health check script
|
'-- deploy/                           # Deployment configuration
    |-- k8s/
    |   |-- namespace.yaml
    |   |-- api-deployment.yaml
    |   |-- api-service.yaml
    |   |-- api-hpa.yaml
    |   |-- worker-deployment.yaml
    |   |-- worker-hpa.yaml
    |   |-- redis-statefulset.yaml
    |   |-- redis-service.yaml
    |   |-- redis-pvc.yaml
    |   |-- bull-board-deployment.yaml
    |   |-- ingress.yaml
    |   |-- network-policy.yaml
    |   |-- secrets.yaml              # Template (values from CI/CD)
    |   |-- configmap.yaml
    |   '-- cert-manager/
    |       |-- issuer.yaml           # Let's Encrypt ClusterIssuer
    |       '-- certificate.yaml      # TLS cert for *.brandmenow.com
    |
    |-- docker/
    |   |-- nginx.conf                # Nginx config for SPA serving
    |   '-- redis.conf                # Redis production config
    |
    '-- github/
        '-- workflows/
            |-- ci.yml                # Lint + test + type-check on PR
            |-- deploy-staging.yml    # Deploy to staging on merge to develop
            |-- deploy-production.yml # Deploy to production on merge to main
            '-- dependency-scan.yml   # Weekly dependency audit
```

---

## 8. Environment Architecture

### Environment Matrix

| Aspect | Development | Staging | Production |
|--------|-------------|---------|------------|
| **Infrastructure** | Docker Compose (local) | DO Droplet (single node) or K8s namespace | DO K8s cluster (dedicated namespace) |
| **API Replicas** | 1 | 1 | 2-5 (HPA) |
| **Worker Replicas** | 1 | 1 | 2-4 (HPA) |
| **Redis** | Docker container | Docker on same droplet / K8s StatefulSet | K8s StatefulSet with PVC |
| **Database** | Supabase (dev project) | Supabase (staging project) | Supabase (production project) |
| **R2 Storage** | Supabase Storage (dev bucket) | Cloudflare R2 (staging bucket) | Cloudflare R2 (production bucket) |
| **Domain** | localhost:5173 (SPA), localhost:3000 (API) | staging.brandmenow.com, api-staging.brandmenow.com | app.brandmenow.com, api.brandmenow.com |
| **SSL** | None (HTTP) | Let's Encrypt (auto) | Let's Encrypt (auto) via cert-manager |
| **AI Models** | Same models, lower rate limits | Same models, same rate limits | Full rate limits |
| **Stripe** | Test mode (test keys) | Test mode (test keys) | Live mode (production keys) |
| **GHL** | Sandbox account | Staging location | Production location |
| **Email** | Mailpit (local capture) | Resend (staging domain) | Resend (production domain) |
| **Sentry** | Disabled or local | Staging DSN | Production DSN |
| **PostHog** | Disabled | Staging project | Production project |
| **Log Level** | debug | info | info (warn for noisy routes) |
| **CORS Origins** | localhost:* | staging.brandmenow.com | app.brandmenow.com, brandmenow.com |
| **Rate Limits** | Relaxed (high limits) | Same as production | Production limits |
| **Container Registry** | Local Docker images | DO Container Registry (staging tag) | DO Container Registry (latest/versioned tag) |
| **CI/CD Trigger** | Manual / docker-compose up | Auto on merge to `develop` branch | Auto on merge to `main` branch |
| **Hot Reload** | Yes (Vite HMR, nodemon) | No | No |
| **Source Maps** | Inline | Uploaded to Sentry | Uploaded to Sentry |

### Development Setup Commands

```bash
# Clone and setup
git clone git@github.com:brandmenow/brand-me-now-v2.git
cd brand-me-now-v2

# Copy environment template
cp .env.example .env
# Fill in: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
#          ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, BFL_API_KEY

# Start all services
docker compose up -d

# Run migrations
npm run db:migrate

# Seed product catalog
npm run db:seed

# Open in browser
open http://localhost:5173   # SPA
open http://localhost:3001   # Marketing site
open http://localhost:3002   # Bull Board
open http://localhost:8025   # Mailpit (email capture)
```

### Staging Deployment

```bash
# Staging deploys automatically on merge to develop
# Manual trigger:
gh workflow run deploy-staging.yml --ref develop

# Staging URLs:
# SPA:  https://staging.brandmenow.com
# API:  https://api-staging.brandmenow.com
# Jobs: https://jobs-staging.brandmenow.com (internal, VPN only)
```

### Production Deployment

```bash
# Production deploys automatically on merge to main
# Requires:
#   1. All CI checks pass
#   2. Staging smoke tests pass
#   3. Manual approval in GitHub Actions

# Production URLs:
# SPA:        https://app.brandmenow.com
# API:        https://api.brandmenow.com
# Marketing:  https://brandmenow.com
# Jobs:       Internal only (K8s ClusterIP)
```

---

## 9. Network Architecture

### DNS Configuration

```
brandmenow.com (Cloudflare DNS)
|
|-- brandmenow.com          A     -> Vercel (Marketing Site, Next.js SSG)
|-- www.brandmenow.com      CNAME -> brandmenow.com (redirect to apex)
|-- app.brandmenow.com      A     -> Cloudflare Pages / Vercel (React SPA static)
|-- api.brandmenow.com      A     -> DO Load Balancer IP (K8s Ingress)
|-- staging.brandmenow.com  A     -> DO Droplet IP or staging LB
|-- api-staging.brandmenow.com A  -> DO Droplet IP or staging LB
|
|-- MX records               -> Configured for brandmenow.com email
|-- TXT records              -> SPF, DKIM (Resend), DMARC
|-- _dmarc.brandmenow.com   TXT -> DMARC policy
```

### SSL/TLS Configuration

| Component | SSL Method | Certificate Provider | Auto-Renewal |
|-----------|-----------|---------------------|--------------|
| Marketing Site (Vercel) | Automatic | Vercel (Let's Encrypt) | Yes |
| React SPA (Cloudflare Pages) | Automatic | Cloudflare | Yes |
| API (K8s) | cert-manager | Let's Encrypt | Yes (cert-manager controller) |
| Staging API | cert-manager or Caddy | Let's Encrypt | Yes |
| Redis (internal) | None (K8s internal network) | N/A | N/A |
| Supabase | Automatic | Supabase managed | Yes |

### CDN Architecture

```
User Request
  |
  v
Cloudflare Edge (200+ PoPs globally)
  |
  |-- Static assets (JS, CSS, images, fonts)
  |   Cached at edge, Cache-Control: public, max-age=31536000, immutable
  |   Content-hashed filenames (Vite build output)
  |
  |-- Generated images (logos, mockups)
  |   Served from Cloudflare R2 via R2 public access URL
  |   Cache-Control: public, max-age=86400
  |
  |-- API requests (api.brandmenow.com)
  |   Proxied to origin (DO Load Balancer)
  |   Cache-Control: no-cache (dynamic content)
  |   Cloudflare WAF rules applied
  |
  v
Origin Server(s)
```

### Load Balancing

```
Internet
  |
  v
Cloudflare (DNS + Proxy + WAF)
  |
  v
DigitalOcean Load Balancer
  |-- Health check: GET /api/v1/health (every 10s)
  |-- Algorithm: Round Robin
  |-- Sticky sessions: Disabled (JWT is stateless)
  |-- SSL termination: At LB (forwards HTTP to K8s)
  |
  v
K8s Ingress (nginx-ingress-controller)
  |
  |-- Host: api.brandmenow.com
  |   |-- / -> bmn-api-svc:3000
  |   |-- /socket.io -> bmn-api-svc:3000 (WebSocket upgrade)
  |
  v
K8s Service (bmn-api-svc)
  |-- Type: ClusterIP
  |-- Selector: app=bmn-api
  |-- Port: 3000
  |
  v
K8s Pods (bmn-api)
  |-- Pod 1 (Express + Socket.io)
  |-- Pod 2 (Express + Socket.io)
  |-- ... Pod N (scaled by HPA)
```

### Network Security (K8s Network Policies)

```yaml
# deploy/k8s/network-policy.yaml

# Only API and Worker pods can access Redis
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: redis-access
  namespace: brandmenow-prod
spec:
  podSelector:
    matchLabels:
      app: bmn-redis
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: bmn-api
        - podSelector:
            matchLabels:
              app: bmn-worker
      ports:
        - port: 6379

---

# Only API pods accept external traffic (via Ingress)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-ingress
  namespace: brandmenow-prod
spec:
  podSelector:
    matchLabels:
      app: bmn-api
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - port: 3000
```

### Full Network Topology

```
+===========================================================================+
|                           INTERNET                                         |
+===========================================================================+
           |                    |                    |
  +--------v--------+  +-------v--------+  +--------v---------+
  | Cloudflare CDN  |  | Cloudflare CDN |  | Cloudflare CDN   |
  | brandmenow.com  |  | app.brandmenow |  | api.brandmenow   |
  |                 |  | .com           |  | .com              |
  | WAF + DDoS      |  | WAF + DDoS     |  | WAF + DDoS + Rate|
  +---------+-------+  +-------+--------+  +--------+---------+
            |                   |                    |
  +---------v-------+  +-------v--------+  +--------v---------+
  | Vercel Edge     |  | Cloudflare     |  | DO Load Balancer |
  | (Marketing)     |  | Pages / Vercel |  | (TCP passthrough) |
  |                 |  | (SPA static)   |  |                   |
  | Next.js 15 SSG  |  | React 19 SPA   |  | Health: /health   |
  +-----------------+  +----------------+  +--------+---------+
                                                    |
                                           +--------v---------+
                                           | K8s Cluster (DO)  |
                                           |                   |
                                           | +-Ingress-------+ |
                                           | | nginx-ingress | |
                                           | +-------+-------+ |
                                           |         |         |
                                           | +-------v-------+ |
                                           | | bmn-api-svc   | |
                                           | | (ClusterIP)   | |
                                           | +---+---+---+---+ |
                                           |     |   |   |     |
                                           | +---v+ +v-+ +v--+ |
                                           | |API | |API| |API| |
                                           | |Pod1| |Pod| |Pod| |
                                           | +---++ ++-++ ++--+ |
                                           |     |   |    |     |
                                           | +---v---v----v---+ |
                                           | | bmn-redis-svc  | |
                                           | | (ClusterIP)    | |
                                           | +-------+--------+ |
                                           |         |          |
                                           | +-------v--------+ |
                                           | | Redis Pod      | |
                                           | | (StatefulSet)  | |
                                           | | PVC: 10Gi      | |
                                           | +----------------+ |
                                           |                    |
                                           | +-Worker Pods----+ |
                                           | | bmn-worker     | |
                                           | | (Deployment)   | |
                                           | +----------------+ |
                                           +--------------------+
                                                    |
                    +-------------------------------+-------------------+
                    |                   |                               |
           +--------v------+  +--------v--------+  +------------------v---+
           | Supabase      |  | Cloudflare R2   |  | External APIs        |
           | (Cloud-hosted)|  | (Object Storage)|  | Anthropic, OpenAI,   |
           | us-east-1     |  | Global CDN      |  | Google, BFL,         |
           +---------------+  +-----------------+  | Ideogram, Stripe,    |
                                                    | GHL, Resend, Apify,  |
                                                    | Sentry, PostHog      |
                                                    +----------------------+
```

---

## 10. Dependencies

### This Document Depends On

| Document | What It Provides |
|----------|-----------------|
| [01-PRODUCT-REQUIREMENTS.md](01-PRODUCT-REQUIREMENTS.md) | User stories, acceptance criteria, feature scope, subscription tiers, product catalog, non-functional requirements |
| [../09-GREENFIELD-REBUILD-BLUEPRINT.md](../09-GREENFIELD-REBUILD-BLUEPRINT.md) | Tech stack decisions, AI model selections, agent framework choice, security patterns, deployment strategy |

### Documents That Depend On This

| Document | What They Need From This Document |
|----------|----------------------------------|
| [03-SERVER-CORE.md](03-SERVER-CORE.md) | Middleware chain, route structure, Docker config, port assignments |
| [04-AGENT-SYSTEM.md](04-AGENT-SYSTEM.md) | Agent hierarchy diagram, skill registry pattern, BullMQ integration, lifecycle hooks |
| [05-SKILL-MODULES.md](05-SKILL-MODULES.md) | Subagent structure, tool schemas per skill, model assignments, budget limits |
| [06-REAL-TIME-JOBS.md](06-REAL-TIME-JOBS.md) | Socket.io namespaces, event map, BullMQ queue names, worker structure |
| [07-DATABASE.md](07-DATABASE.md) | Data flow diagrams inform table structure, relationships, RLS requirements |
| [08-AUTH-SECURITY.md](08-AUTH-SECURITY.md) | Auth flow diagram, JWT verification pattern, Socket.io auth, rate limit tiers |
| [09-FRONTEND-APP.md](09-FRONTEND-APP.md) | API endpoint map, Socket.io event payloads, monorepo client structure |
| [10-PAYMENTS-BILLING.md](10-PAYMENTS-BILLING.md) | Payment flow diagram, Stripe webhook processing, credit allocation |
| [11-INTEGRATIONS.md](11-INTEGRATIONS.md) | GHL sync flow, Resend email triggers, Apify scraping integration |
| [12-OBSERVABILITY.md](12-OBSERVABILITY.md) | Logging patterns, Sentry integration points, PostHog events |
| [13-DEPLOYMENT-INFRA.md](13-DEPLOYMENT-INFRA.md) | Container map, K8s deployment specs, environment matrix, network architecture |
| [14-TESTING.md](14-TESTING.md) | Monorepo structure, API endpoints for integration tests, Socket.io events for E2E |
| [15-MARKETING-SITE.md](15-MARKETING-SITE.md) | Marketing site structure, shared design tokens |
| [16-MIGRATION-GUIDE.md](16-MIGRATION-GUIDE.md) | Data flow patterns, schema differences, endpoint mapping |

### External Service Dependencies

| Service | Critical? | Fallback | Impact of Outage |
|---------|-----------|----------|-----------------|
| Supabase | Yes | None (primary DB) | Platform fully down |
| Redis | Yes | None (job queue) | No generation, no caching, no rate limiting |
| Anthropic API | Yes | Gemini 3.0 Pro (text tasks) | Degraded wizard experience, slower |
| BFL API (FLUX.2) | Yes | FLUX.2 Dev (lower quality) | Degraded logo quality |
| OpenAI API | Yes | FLUX.2 Pro (mockups) | Degraded mockup quality |
| Google AI API | Partial | Claude Haiku 4.5 (validation) | No bundle composition, use fallback for validation |
| Ideogram API | Partial | GPT Image 1.5 | Degraded text-in-image quality |
| Stripe | Yes | None (payment processor) | No new subscriptions, existing users unaffected |
| GoHighLevel | No | Queue + retry later | CRM sync delayed, user flow unaffected |
| Resend | No | Queue + retry later | Emails delayed, user flow unaffected |
| Apify | Partial | Manual input fallback (user pastes data) | Social analysis unavailable, manual input required |
| Sentry | No | Console logging | No error tracking, errors still logged to stdout |
| PostHog | No | No analytics | No product analytics, platform functions normally |
| Cloudflare | Partial | Direct R2 access, fallback DNS | Slower asset delivery, WAF rules bypassed |

---

## 11. Development Prompt

The following prompt can be given to Claude Code to scaffold the initial project structure based on this architecture document. This prompt should be used after reading `03-SERVER-CORE.md` for detailed implementation instructions.

---

### Scaffold Prompt for Claude Code

```
You are building the initial project scaffold for Brand Me Now v2, a greenfield
AI-powered brand creation platform. Create the complete monorepo structure with
all directories, placeholder files, and configuration.

TECH STACK:
- Monorepo: npm workspaces (root package.json)
- Server: Express.js 5, Node.js 22, JavaScript + JSDoc types
- Client: React 19 + Vite 7, Tailwind CSS 4, Zustand 5, TanStack Query 5
- Marketing: Next.js 15 (App Router)
- Shared: Zod schemas, constants, utilities
- Jobs: BullMQ + Redis 7
- Real-time: Socket.io (Redis adapter for multi-pod)
- Agent: Anthropic Agent SDK (@anthropic-ai/claude-agent-sdk)
- Database: Supabase (PostgreSQL 17) -- external, not containerized
- Storage: Cloudflare R2 (generated images), Supabase Storage (app files)
- Auth: Supabase Auth (JWT verification in Express middleware)
- Payments: Stripe (Checkout + Subscriptions + Webhooks)
- CRM: GoHighLevel (OAuth 2.0)
- Email: Resend + React Email
- Observability: Sentry + PostHog + pino
- Testing: Vitest + MSW + Playwright
- CI/CD: GitHub Actions
- Deploy: Docker + Docker Compose (dev) + DO K8s (prod)

STRUCTURE TO CREATE:

1. Root: package.json (workspaces: server, client, marketing, shared),
   docker-compose.yml, .env.example, .eslintrc.cjs, .prettierrc, .gitignore

2. server/: Express.js 5 with:
   - src/index.js (server entrypoint)
   - src/app.js (Express app factory with full middleware chain)
   - src/config/ (env validation, Redis, Supabase clients)
   - src/middleware/ (auth, tenant, rate-limit, validate, error-handler, admin)
   - src/routes/ (all route files matching API endpoint map from 02-ARCHITECTURE)
   - src/handlers/ (business logic per resource)
   - src/services/ (ai/, storage/, payments/, crm/, email/, scraping/)
   - src/sockets/ (Socket.io server + namespace handlers)
   - src/workers/ (BullMQ worker definitions)
   - src/skills/ (7 skill subagent modules + _shared/)
   - src/queues/ (queue definitions + job payload schemas)
   - src/db/ (queries/ + migrations/)
   - src/lib/ (logger, errors, resume-token)
   - Dockerfile, Dockerfile.worker, Dockerfile.bull-board

3. client/: React 19 SPA with:
   - vite.config.js, index.html
   - src/App.jsx (React Router v7 setup)
   - src/routes/ (wizard/ 12 steps, dashboard/, admin/, auth/)
   - src/stores/ (Zustand stores)
   - src/hooks/ (API hooks, Socket.io hooks, auth hooks)
   - src/components/ (ui/, wizard/, brand/, layout/)
   - src/lib/ (api-client, socket-client, supabase-client)
   - src/styles/ (design-tokens.css, global.css, animations.css)
   - Dockerfile, Dockerfile.dev

4. marketing/: Next.js 15 with:
   - next.config.js
   - src/app/ (landing, pricing, features, blog, terms)
   - src/components/
   - Dockerfile, Dockerfile.dev

5. shared/: Shared code with:
   - schemas/ (Zod schemas for brand, profile, wizard, product, payment)
   - constants/ (wizard-steps, subscription-tiers, product-categories, archetypes)
   - utils/ (format, validation)

6. scripts/: seed-products.js, seed-admin.js, migrate.js, health-check.js

7. deploy/:
   - k8s/ (all YAML manifests from Container Map section)
   - docker/ (nginx.conf, redis.conf)
   - github/workflows/ (ci.yml, deploy-staging.yml, deploy-production.yml)

For each file, include:
- JSDoc type annotations for all functions
- Appropriate imports (even if the dependency is not yet installed)
- TODO comments for business logic that requires other specs
- Export statements so modules are wirable

For Docker files, include:
- Multi-stage builds (node:22-alpine)
- Non-root user
- Proper COPY order for layer caching
- Health check instructions

For docker-compose.yml, include all 7 services from the Container Map.

Do NOT implement business logic -- just structure and wiring. Each file should
have the correct exports, imports, and JSDoc signatures so the codebase compiles
and the team can fill in implementations using the detailed spec documents
(03 through 16).
```

---

## Appendix A: API Response Format

All API responses follow a consistent envelope format:

```json
// Success
{
  "ok": true,
  "data": { },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 47
  }
}

// Error
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": [
      { "field": "email", "message": "Must be a valid email address" }
    ]
  }
}
```

### Standard Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request body/params failed Zod validation |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Valid JWT but insufficient permissions |
| `NOT_FOUND` | 404 | Resource does not exist or user does not own it |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `CREDITS_EXHAUSTED` | 402 | No generation credits remaining |
| `GENERATION_FAILED` | 500 | AI generation failed after retries |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Appendix B: Rate Limit Tiers

| Tier | General API | Generation API | Chat | Webhook |
|------|-------------|----------------|------|---------|
| Free Trial | 60 req/min | 3 req/min | 5 msg/min | N/A |
| Starter | 100 req/min | 5 req/min | 10 msg/min | N/A |
| Pro | 200 req/min | 10 req/min | 20 msg/min | N/A |
| Agency | 500 req/min | 20 req/min | 50 msg/min | N/A |
| Admin | 500 req/min | 50 req/min | Unlimited | N/A |
| Unauthenticated | 20 req/min/IP | N/A | N/A | 100 req/min/IP |

## Appendix C: BullMQ Queue Configuration

| Queue Name | Concurrency | Max Retries | Retry Delay | Timeout | Priority |
|-----------|-------------|-------------|-------------|---------|----------|
| `brand-wizard` | 5 | 3 | Exponential (1s, 4s, 16s) | 5 min | Normal |
| `logo-generation` | 10 | 3 | Exponential (2s, 8s, 32s) | 3 min | High |
| `mockup-generation` | 10 | 3 | Exponential (2s, 8s, 32s) | 2 min | High |
| `bundle-composition` | 5 | 3 | Exponential (2s, 8s, 32s) | 3 min | Normal |
| `crm-sync` | 3 | 5 | Exponential (5s, 25s, 125s) | 30s | Low |
| `email-send` | 5 | 3 | Exponential (2s, 8s, 32s) | 15s | Normal |
| `cleanup` | 1 | 1 | Fixed (60s) | 5 min | Low |
| `webhook-process` | 5 | 5 | Exponential (1s, 4s, 16s) | 30s | High |
