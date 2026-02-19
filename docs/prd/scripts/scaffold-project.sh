#!/bin/bash
# ==============================================================================
# Brand Me Now v2 — Project Scaffolding Script
# ==============================================================================
#
# Creates the entire Brand Me Now v2 monorepo directory structure and
# boilerplate files from scratch. Designed to be run once to bootstrap
# a greenfield project, but safe to run multiple times (idempotent).
#
# Usage:
#   chmod +x scaffold-project.sh
#   ./scaffold-project.sh [target-directory]
#
# Arguments:
#   target-directory  Optional. Parent directory where brand-me-now-v2/ will
#                     be created. Defaults to the current working directory.
#
# Reference: docs/prd/README.md — Build Order & Tech Stack
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------------------

PROJECT_NAME="brand-me-now-v2"
TARGET_DIR="${1:-.}"
PROJECT_DIR="${TARGET_DIR}/${PROJECT_NAME}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Counters for the summary
DIRS_CREATED=0
FILES_CREATED=0
FILES_SKIPPED=0

# Terminal colors (disabled if not a TTY)
if [ -t 1 ]; then
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  CYAN='\033[0;36m'
  BOLD='\033[1m'
  RESET='\033[0m'
else
  GREEN='' YELLOW='' BLUE='' CYAN='' BOLD='' RESET=''
fi

# ------------------------------------------------------------------------------
# Helper Functions
# ------------------------------------------------------------------------------

# Print a section header
section() {
  echo ""
  echo -e "${BLUE}==>${RESET} ${BOLD}$1${RESET}"
}

# Print an info message
info() {
  echo -e "    ${CYAN}+${RESET} $1"
}

# Print a skip message
skip() {
  echo -e "    ${YELLOW}-${RESET} $1 (already exists)"
}

# Create a directory if it does not already exist
ensure_dir() {
  local dir="$1"
  if [ ! -d "$dir" ]; then
    mkdir -p "$dir"
    DIRS_CREATED=$((DIRS_CREATED + 1))
  fi
}

# Write a file only if it does not already exist (idempotent)
write_file() {
  local filepath="$1"
  local content="$2"

  ensure_dir "$(dirname "$filepath")"

  if [ -f "$filepath" ]; then
    FILES_SKIPPED=$((FILES_SKIPPED + 1))
    skip "$filepath"
  else
    echo "$content" > "$filepath"
    FILES_CREATED=$((FILES_CREATED + 1))
    info "$filepath"
  fi
}

# Write a file using a heredoc-style approach (for files with special chars)
write_file_raw() {
  local filepath="$1"

  ensure_dir "$(dirname "$filepath")"

  if [ -f "$filepath" ]; then
    FILES_SKIPPED=$((FILES_SKIPPED + 1))
    skip "$filepath"
    return 1
  else
    FILES_CREATED=$((FILES_CREATED + 1))
    info "$filepath"
    return 0
  fi
}

# ==============================================================================
# MAIN SCRIPT
# ==============================================================================

echo ""
echo -e "${BOLD}Brand Me Now v2 — Project Scaffolding${RESET}"
echo "=============================================="
echo "Target: ${PROJECT_DIR}"
echo ""

# ------------------------------------------------------------------------------
# 1. Create project root and initialize git
# ------------------------------------------------------------------------------

section "Creating project root"

ensure_dir "$PROJECT_DIR"

if [ ! -d "${PROJECT_DIR}/.git" ]; then
  git -C "$PROJECT_DIR" init --quiet
  info "Initialized git repository"
else
  skip "Git repository"
fi

# ------------------------------------------------------------------------------
# 2. Create ALL directories in the monorepo structure
# ------------------------------------------------------------------------------

section "Creating directory structure"

# Docs
ensure_dir "${PROJECT_DIR}/docs/prd"

# Server
ensure_dir "${PROJECT_DIR}/server/src/config"
ensure_dir "${PROJECT_DIR}/server/src/middleware"
ensure_dir "${PROJECT_DIR}/server/src/routes"
ensure_dir "${PROJECT_DIR}/server/src/controllers"
ensure_dir "${PROJECT_DIR}/server/src/services"
ensure_dir "${PROJECT_DIR}/server/src/skills/_shared"
ensure_dir "${PROJECT_DIR}/server/src/skills/social-analyzer"
ensure_dir "${PROJECT_DIR}/server/src/skills/brand-generator"
ensure_dir "${PROJECT_DIR}/server/src/skills/logo-creator"
ensure_dir "${PROJECT_DIR}/server/src/skills/mockup-renderer"
ensure_dir "${PROJECT_DIR}/server/src/skills/name-generator"
ensure_dir "${PROJECT_DIR}/server/src/skills/profit-calculator"
ensure_dir "${PROJECT_DIR}/server/src/skills/video-creator"
ensure_dir "${PROJECT_DIR}/server/src/jobs/workers"
ensure_dir "${PROJECT_DIR}/server/src/socket"
ensure_dir "${PROJECT_DIR}/server/src/utils"
ensure_dir "${PROJECT_DIR}/server/src/lib"
ensure_dir "${PROJECT_DIR}/server/config"

# Client
ensure_dir "${PROJECT_DIR}/client/src/routes/auth"
ensure_dir "${PROJECT_DIR}/client/src/routes/wizard"
ensure_dir "${PROJECT_DIR}/client/src/routes/dashboard"
ensure_dir "${PROJECT_DIR}/client/src/routes/admin"
ensure_dir "${PROJECT_DIR}/client/src/components/ui"
ensure_dir "${PROJECT_DIR}/client/src/components/wizard"
ensure_dir "${PROJECT_DIR}/client/src/components/brand"
ensure_dir "${PROJECT_DIR}/client/src/components/layout"
ensure_dir "${PROJECT_DIR}/client/src/stores"
ensure_dir "${PROJECT_DIR}/client/src/hooks"
ensure_dir "${PROJECT_DIR}/client/src/lib"
ensure_dir "${PROJECT_DIR}/client/src/styles"
ensure_dir "${PROJECT_DIR}/client/public"

# Marketing
ensure_dir "${PROJECT_DIR}/marketing/src/app"
ensure_dir "${PROJECT_DIR}/marketing/src/components"
ensure_dir "${PROJECT_DIR}/marketing/public"

# Shared
ensure_dir "${PROJECT_DIR}/shared/schemas"

# Scripts
ensure_dir "${PROJECT_DIR}/scripts/migrate/steps"

# Deploy
ensure_dir "${PROJECT_DIR}/deploy/docker"
ensure_dir "${PROJECT_DIR}/deploy/k8s"

# Infrastructure
ensure_dir "${PROJECT_DIR}/infra/redis"

# GitHub
ensure_dir "${PROJECT_DIR}/.github/workflows"

info "All directories created"

# ------------------------------------------------------------------------------
# 3. Copy PRD documentation
# ------------------------------------------------------------------------------

section "Copying PRD documentation"

if [ -d "$PRD_DIR" ]; then
  # Copy all .md files from the PRD directory
  for md_file in "$PRD_DIR"/*.md; do
    if [ -f "$md_file" ]; then
      basename_file="$(basename "$md_file")"
      dest="${PROJECT_DIR}/docs/prd/${basename_file}"
      if [ ! -f "$dest" ]; then
        cp "$md_file" "$dest"
        FILES_CREATED=$((FILES_CREATED + 1))
        info "docs/prd/${basename_file}"
      else
        FILES_SKIPPED=$((FILES_SKIPPED + 1))
        skip "docs/prd/${basename_file}"
      fi
    fi
  done
else
  echo -e "    ${YELLOW}!${RESET} PRD directory not found at ${PRD_DIR} — skipping copy"
fi

# ------------------------------------------------------------------------------
# 4. Root configuration files
# ------------------------------------------------------------------------------

section "Creating root configuration files"

# --- Root package.json (pnpm workspace) ---
write_file_raw "${PROJECT_DIR}/package.json" && cat > "${PROJECT_DIR}/package.json" << 'ROOTPKG'
{
  "name": "brand-me-now-v2",
  "version": "2.0.0",
  "private": true,
  "description": "Brand Me Now v2 — AI-powered brand creation platform",
  "type": "module",
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=9.0.0"
  },
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "dev": "pnpm --parallel --filter './server' --filter './client' run dev",
    "dev:server": "pnpm --filter './server' run dev",
    "dev:client": "pnpm --filter './client' run dev",
    "dev:marketing": "pnpm --filter './marketing' run dev",
    "build": "pnpm --filter './shared' run build && pnpm --parallel --filter './server' --filter './client' run build",
    "build:server": "pnpm --filter './server' run build",
    "build:client": "pnpm --filter './client' run build",
    "build:marketing": "pnpm --filter './marketing' run build",
    "lint": "pnpm -r run lint",
    "lint:fix": "pnpm -r run lint:fix",
    "format": "pnpm -r run format",
    "test": "pnpm -r run test",
    "test:server": "pnpm --filter './server' run test",
    "test:client": "pnpm --filter './client' run test",
    "clean": "pnpm -r exec rm -rf node_modules dist .turbo && rm -rf node_modules",
    "docker:dev": "docker compose up --build",
    "docker:prod": "docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d",
    "docker:down": "docker compose down",
    "migrate": "node scripts/migrate/index.js",
    "validate:env": "pnpm --filter './server' run validate:env"
  }
}
ROOTPKG

# --- pnpm-workspace.yaml ---
write_file_raw "${PROJECT_DIR}/pnpm-workspace.yaml" && cat > "${PROJECT_DIR}/pnpm-workspace.yaml" << 'PNPMWS'
packages:
  - "server"
  - "client"
  - "marketing"
  - "shared"
PNPMWS

# --- .gitignore ---
write_file_raw "${PROJECT_DIR}/.gitignore" && cat > "${PROJECT_DIR}/.gitignore" << 'GITIGNORE'
# ==============================================================================
# Brand Me Now v2 — .gitignore
# ==============================================================================

# ------------------------------------------------------------------------------
# Dependencies
# ------------------------------------------------------------------------------
node_modules/
.pnpm-store/

# ------------------------------------------------------------------------------
# Environment variables (NEVER commit secrets)
# ------------------------------------------------------------------------------
.env
.env.local
.env.development
.env.production
.env.staging
.env.*.local

# ------------------------------------------------------------------------------
# Build output
# ------------------------------------------------------------------------------
dist/
build/
.next/
.vercel/
out/

# ------------------------------------------------------------------------------
# Logs
# ------------------------------------------------------------------------------
logs/
*.log
npm-debug.log*
pnpm-debug.log*
yarn-debug.log*
yarn-error.log*

# ------------------------------------------------------------------------------
# Runtime & cache
# ------------------------------------------------------------------------------
.cache/
.turbo/
.vite/
*.tsbuildinfo

# ------------------------------------------------------------------------------
# Testing & coverage
# ------------------------------------------------------------------------------
coverage/
.nyc_output/
test-results/
playwright-report/

# ------------------------------------------------------------------------------
# IDE & editor
# ------------------------------------------------------------------------------
.idea/
.vscode/settings.json
.vscode/launch.json
*.swp
*.swo
*~
.project
.classpath

# ------------------------------------------------------------------------------
# OS files
# ------------------------------------------------------------------------------
.DS_Store
Thumbs.db
Desktop.ini

# ------------------------------------------------------------------------------
# Docker
# ------------------------------------------------------------------------------
docker-compose.override.yml

# ------------------------------------------------------------------------------
# Misc
# ------------------------------------------------------------------------------
*.pid
*.seed
*.pid.lock
.eslintcache
*.tgz
.yarn-integrity
GITIGNORE

# --- .env.template ---
write_file_raw "${PROJECT_DIR}/.env.template" && cat > "${PROJECT_DIR}/.env.template" << 'ENVTEMPLATE'
# ==============================================================================
# Brand Me Now v2 — Environment Variables Template
# ==============================================================================
#
# Copy this file to .env.local for local development:
#   cp .env.template .env.local
#
# IMPORTANT: Never commit .env.local or any file containing real secrets.
# ==============================================================================

# ------------------------------------------------------------------------------
# Supabase (create a NEW project at https://supabase.com)
# ------------------------------------------------------------------------------
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...                       # Public anon key (safe for client)
SUPABASE_SERVICE_ROLE_KEY=eyJ...               # Server-only — NEVER expose to client

# ------------------------------------------------------------------------------
# Redis (local: redis://localhost:6379, Docker: redis://redis:6379)
# ------------------------------------------------------------------------------
REDIS_URL=redis://localhost:6379

# ------------------------------------------------------------------------------
# AI Providers — Model API Keys
# ------------------------------------------------------------------------------
ANTHROPIC_API_KEY=sk-ant-...                   # Claude Sonnet 4.6 / Haiku 4.5
OPENAI_API_KEY=sk-...                          # GPT Image 1.5 (mockup generation)
GOOGLE_API_KEY=AI...                           # Gemini 3.0 Flash / Pro / Image / Veo 3
BFL_API_KEY=...                                # FLUX.2 Pro (logo generation via BFL API)
IDEOGRAM_API_KEY=...                           # Ideogram v3 (text-in-image / typography)

# ------------------------------------------------------------------------------
# Payments — Stripe
# ------------------------------------------------------------------------------
STRIPE_SECRET_KEY=sk_test_...                  # Server-only — NEVER expose to client
STRIPE_PUBLISHABLE_KEY=pk_test_...             # Safe for client
STRIPE_WEBHOOK_SECRET=whsec_...                # Webhook signature verification

# ------------------------------------------------------------------------------
# CRM — GoHighLevel
# ------------------------------------------------------------------------------
GHL_CLIENT_ID=...                              # OAuth 2.0 client ID
GHL_CLIENT_SECRET=...                          # OAuth 2.0 client secret
GHL_LOCATION_ID=...                            # GHL location/sub-account ID

# ------------------------------------------------------------------------------
# Email — Resend
# ------------------------------------------------------------------------------
RESEND_API_KEY=re_...                          # Resend transactional email API key
FROM_EMAIL=hello@brandmenow.com                # Default sender address
SUPPORT_EMAIL=support@brandmenow.com           # Support ticket recipient

# ------------------------------------------------------------------------------
# Scraping — Apify
# ------------------------------------------------------------------------------
APIFY_API_TOKEN=apify_api_...                  # Apify social media scraping token

# ------------------------------------------------------------------------------
# Observability — Sentry + PostHog
# ------------------------------------------------------------------------------
SENTRY_DSN=https://...@sentry.io/...           # Sentry error tracking DSN
POSTHOG_API_KEY=phc_...                        # PostHog product analytics key
POSTHOG_HOST=https://app.posthog.com           # PostHog host (cloud or self-hosted)

# ------------------------------------------------------------------------------
# Application Configuration
# ------------------------------------------------------------------------------
NODE_ENV=development                           # development | staging | production
PORT=3000                                      # Express.js API server port
API_URL=http://localhost:3000                   # Full API base URL
APP_URL=http://localhost:5173                   # Client SPA URL (Vite dev server)
MARKETING_URL=http://localhost:3001             # Marketing site URL (Next.js dev)

# ------------------------------------------------------------------------------
# Security
# ------------------------------------------------------------------------------
RESUME_TOKEN_SECRET=change-me-to-random-64     # HMAC secret for wizard resume tokens
CORS_ORIGINS=http://localhost:5173,http://localhost:3001  # Comma-separated allowed origins

# ------------------------------------------------------------------------------
# DigitalOcean (deployment only — not needed for local dev)
# ------------------------------------------------------------------------------
# DO_REGISTRY=registry.digitalocean.com/brandmenow
# DO_CLUSTER_NAME=bmn-k8s
# DO_API_TOKEN=dop_v1_...                      # DigitalOcean personal access token
ENVTEMPLATE

# --- docker-compose.yml (local development) ---
write_file_raw "${PROJECT_DIR}/docker-compose.yml" && cat > "${PROJECT_DIR}/docker-compose.yml" << 'DCOMPOSE'
# ==============================================================================
# Brand Me Now v2 — Docker Compose (Local Development)
# ==============================================================================
#
# Usage:
#   docker compose up              # Start all services
#   docker compose up api redis    # Start specific services
#   docker compose --profile debug up  # Include debug tools
#   docker compose down            # Stop all services
#   docker compose down -v         # Stop and destroy volumes
# ==============================================================================

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
      - ./server/src:/app/src:cached
      - ./server/config:/app/config:cached
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - bmn-network
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
  # Redis 7 — BullMQ job store, cache, rate limiting
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
  # Redis Commander — Web UI for Redis (debug profile only)
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

volumes:
  redis-data:
    driver: local

networks:
  bmn-network:
    driver: bridge
DCOMPOSE

# --- docker-compose.prod.yml ---
write_file_raw "${PROJECT_DIR}/docker-compose.prod.yml" && cat > "${PROJECT_DIR}/docker-compose.prod.yml" << 'DCOMPOSEPROD'
# ==============================================================================
# Brand Me Now v2 — Docker Compose Production Override
# ==============================================================================
#
# Usage:
#   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
#
# Overrides the base docker-compose.yml with production settings:
#   - No volume mounts (source baked into image)
#   - Production NODE_ENV
#   - Resource limits
#   - No debug profiles
# ==============================================================================

services:
  api:
    build:
      context: ./server
      dockerfile: Dockerfile
      target: runtime
    environment:
      - NODE_ENV=production
    volumes: []
    command: ["node", "src/server.js"]
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 1G
        reservations:
          cpus: "0.5"
          memory: 256M

  redis:
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 128M
DCOMPOSEPROD

# ------------------------------------------------------------------------------
# 5. Server package files
# ------------------------------------------------------------------------------

section "Creating server files"

# --- server/package.json ---
write_file_raw "${PROJECT_DIR}/server/package.json" && cat > "${PROJECT_DIR}/server/package.json" << 'SERVERPKG'
{
  "name": "@brandmenow/server",
  "version": "2.0.0",
  "description": "Brand Me Now v2 — Express.js 5 API Server",
  "type": "module",
  "engines": {
    "node": ">=22.0.0"
  },
  "scripts": {
    "dev": "node --watch src/server.js",
    "start": "node src/server.js",
    "start:cluster": "node src/cluster.js",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write 'src/**/*.js'",
    "format:check": "prettier --check 'src/**/*.js'",
    "test": "node --test src/**/*.test.js",
    "test:watch": "node --test --watch src/**/*.test.js",
    "validate:env": "node src/config/validate-env.js",
    "docker:dev": "docker compose up --build",
    "docker:prod": "docker build -t brandmenow-server ."
  },
  "dependencies": {
    "express": "^5.1.0",
    "@supabase/supabase-js": "^2.49.1",
    "bullmq": "^5.34.3",
    "socket.io": "^4.8.1",
    "ioredis": "^5.4.2",
    "helmet": "^8.0.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.5.0",
    "rate-limit-redis": "^4.2.0",
    "zod": "^3.24.2",
    "pino": "^9.6.0",
    "pino-pretty": "^13.0.0",
    "pino-http": "^10.4.0",
    "@sentry/node": "^9.3.0",
    "uuid": "^11.1.0",
    "js-yaml": "^4.1.0",
    "swagger-ui-express": "^5.0.1",
    "swagger-jsdoc": "^6.2.8",
    "sanitize-html": "^2.14.0",
    "dotenv": "^16.4.7"
  },
  "devDependencies": {
    "eslint": "^9.20.0",
    "@eslint/js": "^9.20.0",
    "eslint-config-prettier": "^10.0.1",
    "eslint-plugin-jsdoc": "^50.6.3",
    "prettier": "^3.5.2",
    "jsdoc": "^4.0.4",
    "supertest": "^7.0.0"
  }
}
SERVERPKG

# --- server/src/server.js (Express bootstrap) ---
write_file_raw "${PROJECT_DIR}/server/src/server.js" && cat > "${PROJECT_DIR}/server/src/server.js" << 'SERVERJS'
/**
 * Brand Me Now v2 — HTTP Server Bootstrap
 *
 * Creates the HTTP server, attaches Socket.io, and handles graceful shutdown.
 * Express app configuration lives in app.js — this file only deals with
 * the server lifecycle.
 *
 * @module server
 */

import { createServer } from 'node:http';
import process from 'node:process';
import { app } from './app.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// ---------------------------------------------------------------------------
// Create HTTP server
// ---------------------------------------------------------------------------

const server = createServer(app);

// TODO: Attach Socket.io here (see 06-REAL-TIME-JOBS.md)
// import { attachSocketIO } from './socket/index.js';
// attachSocketIO(server);

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

/** @type {boolean} */
let isShuttingDown = false;

/**
 * Graceful shutdown handler.
 * Stops accepting new connections, then closes existing ones.
 *
 * @param {string} signal - The signal that triggered shutdown
 */
function gracefulShutdown(signal) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  console.info(`[server] ${signal} received — starting graceful shutdown`);

  // Stop accepting new connections
  server.close((err) => {
    if (err) {
      console.error('[server] Error during shutdown:', err);
      process.exit(1);
    }

    console.info('[server] All connections closed — exiting');
    process.exit(0);
  });

  // Force exit after 10 seconds if connections don't close
  setTimeout(() => {
    console.error('[server] Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ---------------------------------------------------------------------------
// Start listening
// ---------------------------------------------------------------------------

server.listen(PORT, HOST, () => {
  console.info(`[server] Brand Me Now v2 API running on http://${HOST}:${PORT}`);
  console.info(`[server] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.info(`[server] Health check: http://${HOST}:${PORT}/health`);
});
SERVERJS

# --- server/src/app.js (Express app) ---
write_file_raw "${PROJECT_DIR}/server/src/app.js" && cat > "${PROJECT_DIR}/server/src/app.js" << 'APPJS'
/**
 * Brand Me Now v2 — Express 5 Application
 *
 * Configures the Express app with the full middleware chain and route mounting.
 * Server lifecycle (listen, shutdown) lives in server.js.
 *
 * @module app
 */

import express from 'express';

const app = express();

// ---------------------------------------------------------------------------
// Core middleware
// ---------------------------------------------------------------------------

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// TODO: Add middleware chain (see 03-SERVER-CORE.md)
// - helmet (security headers)
// - cors (origin allowlist)
// - request-id (UUID correlation)
// - pino-http (structured logging)
// - rate-limit (Redis-backed)

// ---------------------------------------------------------------------------
// Health check (no auth required — used by K8s probes)
// ---------------------------------------------------------------------------

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'brand-me-now-api',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', (_req, res) => {
  // TODO: Check Redis, Supabase, and BullMQ connectivity
  res.json({ status: 'ready' });
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

// TODO: Mount route groups (see 03-SERVER-CORE.md)
// import { registerRoutes } from './routes/index.js';
// registerRoutes(app);

// ---------------------------------------------------------------------------
// 404 handler
// ---------------------------------------------------------------------------

app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource does not exist',
  });
});

// ---------------------------------------------------------------------------
// Global error handler (must be last — 4 args)
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[app] Unhandled error:', err);

  // TODO: Sentry capture (see 12-OBSERVABILITY.md)

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: err.name || 'InternalServerError',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  });
});

export { app };
APPJS

# --- Server route stubs ---
for route_file in auth brands wizard products payments admin health; do
  write_file_raw "${PROJECT_DIR}/server/src/routes/${route_file}.js" && cat > "${PROJECT_DIR}/server/src/routes/${route_file}.js" << ROUTEJS
/**
 * Brand Me Now v2 — ${route_file} routes
 *
 * @module routes/${route_file}
 * @see docs/prd/ for full specification
 */

import { Router } from 'express';

const router = Router();

// TODO: Implement ${route_file} routes

export default router;
ROUTEJS
done

# --- Server route index ---
write_file_raw "${PROJECT_DIR}/server/src/routes/index.js" && cat > "${PROJECT_DIR}/server/src/routes/index.js" << 'ROUTEINDEX'
/**
 * Brand Me Now v2 — Route Registration
 *
 * Mounts all route groups onto the Express app under /api/v1.
 *
 * @module routes
 */

import authRoutes from './auth.js';
import brandsRoutes from './brands.js';
import wizardRoutes from './wizard.js';
import productsRoutes from './products.js';
import paymentsRoutes from './payments.js';
import adminRoutes from './admin.js';
import healthRoutes from './health.js';

/**
 * Register all API route groups.
 *
 * @param {import('express').Express} app - The Express app instance
 */
export function registerRoutes(app) {
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/brands', brandsRoutes);
  app.use('/api/v1/wizard', wizardRoutes);
  app.use('/api/v1/products', productsRoutes);
  app.use('/api/v1/payments', paymentsRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/health', healthRoutes);
}
ROUTEINDEX

# --- server/src/jobs/queues.js ---
write_file_raw "${PROJECT_DIR}/server/src/jobs/queues.js" && cat > "${PROJECT_DIR}/server/src/jobs/queues.js" << 'QUEUESJS'
/**
 * Brand Me Now v2 — BullMQ Queue Definitions
 *
 * Defines named queues for AI generation jobs, email, and CRM sync.
 *
 * @module jobs/queues
 * @see docs/prd/06-REAL-TIME-JOBS.md
 */

// TODO: Import BullMQ and configure queues
// import { Queue } from 'bullmq';
// import { redis } from '../services/redis.js';

// export const logoQueue = new Queue('logo-generation', { connection: redis });
// export const mockupQueue = new Queue('mockup-generation', { connection: redis });
// export const emailQueue = new Queue('email', { connection: redis });
// export const crmQueue = new Queue('crm-sync', { connection: redis });

export {};
QUEUESJS

# --- server/Dockerfile ---
write_file_raw "${PROJECT_DIR}/server/Dockerfile" && cat > "${PROJECT_DIR}/server/Dockerfile" << 'SDOCKERFILE'
# ==============================================================================
# Brand Me Now v2 — Server Dockerfile
# ==============================================================================
# Multi-stage build: deps -> build -> runtime
# Base: node:22-alpine | Non-root user | Health check
# ==============================================================================

# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile --prod

# Stage 2: Build (full source for any build steps)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile
COPY . .

# Stage 3: Production runtime
FROM node:22-alpine AS runtime
RUN apk add --no-cache dumb-init && \
    addgroup -g 1001 -S bmn && \
    adduser -S bmn -u 1001 -G bmn
WORKDIR /app
COPY --from=deps --chown=bmn:bmn /app/node_modules ./node_modules
COPY --from=build --chown=bmn:bmn /app/src ./src
COPY --from=build --chown=bmn:bmn /app/config ./config
COPY --from=build --chown=bmn:bmn /app/package.json ./package.json
USER bmn
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
ENV NODE_ENV=production
ENV PORT=3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
SDOCKERFILE

# --- server/.dockerignore ---
write_file_raw "${PROJECT_DIR}/server/.dockerignore" && cat > "${PROJECT_DIR}/server/.dockerignore" << 'SDOCKERIGNORE'
node_modules
.git
.env*
*.md
docs
tests
coverage
.eslintcache
.DS_Store
SDOCKERIGNORE

# ------------------------------------------------------------------------------
# 6. Client (React 19 + Vite 7) files
# ------------------------------------------------------------------------------

section "Creating client files"

# --- client/package.json ---
write_file_raw "${PROJECT_DIR}/client/package.json" && cat > "${PROJECT_DIR}/client/package.json" << 'CLIENTPKG'
{
  "name": "@brandmenow/client",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write 'src/**/*.{js,jsx,ts,tsx,css,json}'",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router": "^7.3.0",
    "zustand": "^5.0.3",
    "@tanstack/react-query": "^5.68.0",
    "@tanstack/react-query-devtools": "^5.68.0",
    "react-hook-form": "^7.54.2",
    "@hookform/resolvers": "^4.1.3",
    "zod": "^3.24.2",
    "socket.io-client": "^4.8.1",
    "@supabase/supabase-js": "^2.49.1",
    "@radix-ui/react-dialog": "^1.1.6",
    "@radix-ui/react-dropdown-menu": "^2.1.6",
    "@radix-ui/react-select": "^2.1.6",
    "@radix-ui/react-toast": "^1.2.6",
    "@radix-ui/react-progress": "^1.1.2",
    "@radix-ui/react-tooltip": "^1.1.8",
    "@radix-ui/react-tabs": "^1.1.3",
    "@radix-ui/react-switch": "^1.1.3",
    "@radix-ui/react-slider": "^1.2.3",
    "@radix-ui/react-popover": "^1.1.6",
    "@radix-ui/react-avatar": "^1.1.3",
    "@stripe/stripe-js": "^5.5.0",
    "@stripe/react-stripe-js": "^3.5.0",
    "motion": "^12.4.7",
    "lucide-react": "^0.475.0",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "react-colorful": "^5.6.1",
    "recharts": "^2.15.1",
    "posthog-js": "^1.210.0"
  },
  "devDependencies": {
    "vite": "^7.0.0",
    "@vitejs/plugin-react": "^4.4.1",
    "tailwindcss": "^4.0.6",
    "@tailwindcss/vite": "^4.0.6",
    "typescript": "^5.7.3",
    "eslint": "^9.20.0",
    "@eslint/js": "^9.20.0",
    "eslint-plugin-react-hooks": "^5.1.0",
    "eslint-plugin-react-refresh": "^0.4.19",
    "prettier": "^3.5.2",
    "prettier-plugin-tailwindcss": "^0.6.11",
    "vitest": "^3.0.5",
    "@vitest/ui": "^3.0.5",
    "@vitest/coverage-v8": "^3.0.5",
    "@testing-library/react": "^16.2.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^26.0.0",
    "msw": "^2.7.3"
  }
}
CLIENTPKG

# --- client/vite.config.ts ---
write_file_raw "${PROJECT_DIR}/client/vite.config.ts" && cat > "${PROJECT_DIR}/client/vite.config.ts" << 'VITECONFIG'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@routes': resolve(__dirname, 'src/routes'),
      '@stores': resolve(__dirname, 'src/stores'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@lib': resolve(__dirname, 'src/lib'),
      '@styles': resolve(__dirname, 'src/styles'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-toast',
          ],
          'vendor-data': ['zustand', '@tanstack/react-query', 'zod'],
          'vendor-motion': ['motion'],
          'vendor-charts': ['recharts'],
        },
      },
    },
  },
});
VITECONFIG

# --- client/tsconfig.json ---
write_file_raw "${PROJECT_DIR}/client/tsconfig.json" && cat > "${PROJECT_DIR}/client/tsconfig.json" << 'TSCONFIG'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "forceConsistentCasingInFileNames": true,
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@routes/*": ["./src/routes/*"],
      "@stores/*": ["./src/stores/*"],
      "@hooks/*": ["./src/hooks/*"],
      "@lib/*": ["./src/lib/*"],
      "@styles/*": ["./src/styles/*"]
    },
    "baseUrl": "."
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
TSCONFIG

# --- client/tsconfig.node.json ---
write_file_raw "${PROJECT_DIR}/client/tsconfig.node.json" && cat > "${PROJECT_DIR}/client/tsconfig.node.json" << 'TSCONFIGNODE'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
TSCONFIGNODE

# --- client/index.html ---
write_file_raw "${PROJECT_DIR}/client/index.html" && cat > "${PROJECT_DIR}/client/index.html" << 'INDEXHTML'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Brand Me Now — AI-powered brand creation platform. Go from social media presence to branded product line in minutes." />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <title>Brand Me Now</title>
  </head>
  <body class="antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
INDEXHTML

# --- client/src/main.tsx ---
write_file_raw "${PROJECT_DIR}/client/src/main.tsx" && cat > "${PROJECT_DIR}/client/src/main.tsx" << 'MAINTSX'
/**
 * Brand Me Now v2 — Client Entry Point
 *
 * Bootstraps the React 19 application with:
 * - React Router for client-side routing
 * - TanStack Query for server state management
 * - Zustand stores for client state
 * - PostHog analytics
 *
 * @see docs/prd/09-FRONTEND-APP.md
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { App } from './App';
import './styles/global.css';

// ---------------------------------------------------------------------------
// TanStack Query client
// ---------------------------------------------------------------------------

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// ---------------------------------------------------------------------------
// Mount the application
// ---------------------------------------------------------------------------

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found. Check index.html for <div id="root">.');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
MAINTSX

# --- client/src/App.tsx ---
write_file_raw "${PROJECT_DIR}/client/src/App.tsx" && cat > "${PROJECT_DIR}/client/src/App.tsx" << 'APPTSX'
/**
 * Brand Me Now v2 — Root Application Component
 *
 * Defines the top-level route structure and layout.
 */

import { Routes, Route } from 'react-router';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      {/* TODO: Add route groups (see 09-FRONTEND-APP.md) */}
      {/* <Route path="/auth/*" element={<AuthLayout />} /> */}
      {/* <Route path="/wizard/*" element={<WizardLayout />} /> */}
      {/* <Route path="/dashboard/*" element={<DashboardLayout />} /> */}
      {/* <Route path="/admin/*" element={<AdminLayout />} /> */}
    </Routes>
  );
}

function Home() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Brand Me Now v2</h1>
      <p style={{ color: '#666', marginTop: '0.5rem' }}>
        AI-powered brand creation platform
      </p>
      <p style={{ color: '#999', marginTop: '1rem', fontSize: '0.875rem' }}>
        Scaffolding complete. Start building!
      </p>
    </div>
  );
}
APPTSX

# --- client/src/styles/global.css ---
write_file_raw "${PROJECT_DIR}/client/src/styles/global.css" && cat > "${PROJECT_DIR}/client/src/styles/global.css" << 'GLOBALCSS'
@import 'tailwindcss';

/*
 * Brand Me Now v2 — Global Styles
 *
 * Tailwind CSS 4 uses native CSS for configuration.
 * Design tokens and animations will be imported here.
 *
 * @see docs/prd/09-FRONTEND-APP.md — Section 1.3
 */

/* TODO: Import design tokens and animations */
/* @import './design-tokens.css'; */
/* @import './animations.css'; */

@theme {
  /* Brand Colors */
  --color-primary: #6C3CE9;
  --color-secondary: #F97316;
  --color-accent: #06B6D4;

  /* Semantic */
  --color-success: #22C55E;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;

  /* Typography */
  --font-heading: 'Inter', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

/* Base reset additions */
body {
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
GLOBALCSS

# --- client/src/vite-env.d.ts ---
write_file_raw "${PROJECT_DIR}/client/src/vite-env.d.ts" && cat > "${PROJECT_DIR}/client/src/vite-env.d.ts" << 'VITEENVDTS'
/// <reference types="vite/client" />
VITEENVDTS

# ------------------------------------------------------------------------------
# 7. Marketing (Next.js 15) files
# ------------------------------------------------------------------------------

section "Creating marketing site files"

# --- marketing/package.json ---
write_file_raw "${PROJECT_DIR}/marketing/package.json" && cat > "${PROJECT_DIR}/marketing/package.json" << 'MKTPKG'
{
  "name": "@brandmenow/marketing",
  "version": "2.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "format": "prettier --write '**/*.{js,jsx,mdx,css,json}'"
  },
  "dependencies": {
    "next": "^15.2.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "tailwindcss": "^4.0.6",
    "@tailwindcss/postcss": "^4.0.6",
    "eslint": "^9.20.0",
    "eslint-config-next": "^15.2.0",
    "prettier": "^3.5.2"
  }
}
MKTPKG

# --- marketing/next.config.js ---
write_file_raw "${PROJECT_DIR}/marketing/next.config.js" && cat > "${PROJECT_DIR}/marketing/next.config.js" << 'NEXTCONFIG'
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Redirect /app/* to the Brand Builder SPA
  async redirects() {
    return [
      {
        source: '/app/:path*',
        destination: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.brandmenow.com'}/:path*`,
        permanent: false,
      },
    ];
  },

  // Image optimization for marketing assets
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
};

export default nextConfig;
NEXTCONFIG

# --- marketing/src/app/layout.js ---
write_file_raw "${PROJECT_DIR}/marketing/src/app/layout.js" && cat > "${PROJECT_DIR}/marketing/src/app/layout.js" << 'MKTLAYOUT'
import './globals.css';

export const metadata = {
  title: 'Brand Me Now — AI-Powered Brand Creation',
  description:
    'Go from social media presence to branded product line in minutes, not months. AI-powered brand identity, logos, product mockups, and revenue projections.',
  openGraph: {
    title: 'Brand Me Now — AI-Powered Brand Creation',
    description:
      'Go from social media presence to branded product line in minutes.',
    url: 'https://brandmenow.com',
    siteName: 'Brand Me Now',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
MKTLAYOUT

# --- marketing/src/app/globals.css ---
write_file_raw "${PROJECT_DIR}/marketing/src/app/globals.css" && cat > "${PROJECT_DIR}/marketing/src/app/globals.css" << 'MKTCSS'
@import 'tailwindcss';

/* Brand Me Now — Marketing Site Global Styles */
/* TODO: Import shared design tokens from @brandmenow/shared */
MKTCSS

# --- marketing/src/app/page.js ---
write_file_raw "${PROJECT_DIR}/marketing/src/app/page.js" && cat > "${PROJECT_DIR}/marketing/src/app/page.js" << 'MKTPAGE'
export default function HomePage() {
  return (
    <main>
      <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 800 }}>Brand Me Now</h1>
        <p style={{ fontSize: '1.25rem', color: '#666', marginTop: '1rem' }}>
          Go from social media presence to branded product line in minutes.
        </p>
        <a
          href={process.env.NEXT_PUBLIC_APP_URL || 'https://app.brandmenow.com'}
          style={{ marginTop: '2rem', padding: '0.75rem 2rem', backgroundColor: '#6C3CE9', color: '#fff', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 600 }}
        >
          Get Started Free
        </a>
      </section>
    </main>
  );
}
MKTPAGE

# ------------------------------------------------------------------------------
# 8. Shared package
# ------------------------------------------------------------------------------

section "Creating shared package"

write_file_raw "${PROJECT_DIR}/shared/package.json" && cat > "${PROJECT_DIR}/shared/package.json" << 'SHAREDPKG'
{
  "name": "@brandmenow/shared",
  "version": "2.0.0",
  "description": "Shared schemas, types, and utilities for Brand Me Now v2",
  "type": "module",
  "main": "index.js",
  "exports": {
    ".": "./index.js",
    "./schemas": "./schemas/index.js",
    "./schemas/*": "./schemas/*.js"
  },
  "scripts": {
    "lint": "eslint .",
    "test": "node --test **/*.test.js"
  },
  "dependencies": {
    "zod": "^3.24.2"
  }
}
SHAREDPKG

# --- shared/index.js ---
write_file_raw "${PROJECT_DIR}/shared/index.js" && cat > "${PROJECT_DIR}/shared/index.js" << 'SHAREDINDEX'
/**
 * Brand Me Now v2 — Shared Package
 *
 * Re-exports all shared schemas, constants, and utilities.
 * Used by both server and client packages.
 */

export * from './schemas/index.js';
SHAREDINDEX

# --- shared/schemas/index.js ---
write_file_raw "${PROJECT_DIR}/shared/schemas/index.js" && cat > "${PROJECT_DIR}/shared/schemas/index.js" << 'SCHEMASINDEX'
/**
 * Brand Me Now v2 — Shared Zod Schemas
 *
 * Validation schemas shared between server and client.
 * These ensure consistent validation across the entire stack.
 *
 * @see docs/prd/07-DATABASE.md for the full database schema
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Brand schemas
// ---------------------------------------------------------------------------

export const brandStatusEnum = z.enum([
  'intake',
  'analyzing',
  'generating_identity',
  'generating_logos',
  'selecting_products',
  'generating_mockups',
  'building_bundles',
  'projecting_revenue',
  'checkout',
  'complete',
]);

export const brandSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  status: brandStatusEnum,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ---------------------------------------------------------------------------
// Wizard step schema
// ---------------------------------------------------------------------------

export const wizardStepSchema = z.object({
  step: z.number().int().min(0).max(12),
  brandId: z.string().uuid(),
  data: z.record(z.unknown()).optional(),
});

// TODO: Add more shared schemas as features are built
SCHEMASINDEX

# ------------------------------------------------------------------------------
# 9. Deploy files (Dockerfiles)
# ------------------------------------------------------------------------------

section "Creating deploy files"

# --- deploy/docker/Dockerfile.server ---
write_file_raw "${PROJECT_DIR}/deploy/docker/Dockerfile.server" && cat > "${PROJECT_DIR}/deploy/docker/Dockerfile.server" << 'DEPLOYDOCKERSERVER'
# ==============================================================================
# Brand Me Now v2 — Server Production Dockerfile
# ==============================================================================
#
# This is the production-optimized Dockerfile for CI/CD pipelines.
# For local development, use the Dockerfile in server/ directly.
#
# Build from project root:
#   docker build -f deploy/docker/Dockerfile.server -t bmn-server ./server
# ==============================================================================

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile --prod

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile
COPY . .

FROM node:22-alpine AS runtime
RUN apk add --no-cache dumb-init && \
    addgroup -g 1001 -S bmn && \
    adduser -S bmn -u 1001 -G bmn
WORKDIR /app
COPY --from=deps --chown=bmn:bmn /app/node_modules ./node_modules
COPY --from=build --chown=bmn:bmn /app/src ./src
COPY --from=build --chown=bmn:bmn /app/config ./config
COPY --from=build --chown=bmn:bmn /app/package.json ./package.json
USER bmn
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
ENV NODE_ENV=production
ENV PORT=3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
DEPLOYDOCKERSERVER

# --- deploy/docker/Dockerfile.client ---
write_file_raw "${PROJECT_DIR}/deploy/docker/Dockerfile.client" && cat > "${PROJECT_DIR}/deploy/docker/Dockerfile.client" << 'DEPLOYDOCKERCLIENT'
# ==============================================================================
# Brand Me Now v2 — Client Production Dockerfile
# ==============================================================================
#
# Builds the React SPA and serves it with nginx.
#
# Build from project root:
#   docker build -f deploy/docker/Dockerfile.client -t bmn-client ./client
# ==============================================================================

# Stage 1: Build the SPA
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# Stage 2: Serve with nginx
FROM nginx:1.27-alpine AS runtime
RUN addgroup -g 1001 -S bmn && \
    adduser -S bmn -u 1001 -G bmn

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# SPA fallback: all routes serve index.html
COPY <<'NGINX' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Serve static assets with long cache
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health check
    location /health {
        return 200 '{"status":"ok"}';
        add_header Content-Type application/json;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
NGINX

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1
CMD ["nginx", "-g", "daemon off;"]
DEPLOYDOCKERCLIENT

# ------------------------------------------------------------------------------
# 10. Infrastructure files
# ------------------------------------------------------------------------------

section "Creating infrastructure files"

# --- infra/redis/redis.conf ---
write_file_raw "${PROJECT_DIR}/infra/redis/redis.conf" && cat > "${PROJECT_DIR}/infra/redis/redis.conf" << 'REDISCONF'
# ==============================================================================
# Brand Me Now v2 — Redis 7 Configuration
# ==============================================================================
# Used by BullMQ (job queue), caching, rate limiting, and sessions.

# Network
bind 0.0.0.0
port 6379
protected-mode no

# Memory
maxmemory 512mb
maxmemory-policy allkeys-lru

# Persistence: RDB snapshots
save 900 1
save 300 10
save 60 10000
dbfilename dump.rdb
dir /data

# Persistence: AOF
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec

# Logging
loglevel notice
logfile ""

# Performance
tcp-keepalive 300
timeout 0
databases 2
# db0 = BullMQ jobs + cache
# db1 = rate limiting + sessions
REDISCONF

# ------------------------------------------------------------------------------
# 11. GitHub Actions workflow
# ------------------------------------------------------------------------------

section "Creating GitHub Actions workflow"

write_file_raw "${PROJECT_DIR}/.github/workflows/ci.yml" && cat > "${PROJECT_DIR}/.github/workflows/ci.yml" << 'CIYML'
# ==============================================================================
# Brand Me Now v2 — CI Pipeline
# ==============================================================================
# Runs on every push and pull request to main.
# Lints, tests, and builds all packages.

name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-and-test:
    name: Lint & Test
    runs-on: ubuntu-latest
    timeout-minutes: 15

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

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint (all packages)
        run: pnpm lint

      - name: Test server
        run: pnpm test:server
        env:
          REDIS_URL: redis://localhost:6379
          NODE_ENV: test

      - name: Test client
        run: pnpm test:client

      - name: Build
        run: pnpm build

  docker-build:
    name: Docker Build
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: lint-and-test

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Build server image
        run: docker build -t bmn-server ./server

      - name: Build client image
        run: docker build -f deploy/docker/Dockerfile.client -t bmn-client ./client
CIYML

# ------------------------------------------------------------------------------
# 12. Scripts directory
# ------------------------------------------------------------------------------

section "Creating migration scripts placeholder"

write_file_raw "${PROJECT_DIR}/scripts/migrate/index.js" && cat > "${PROJECT_DIR}/scripts/migrate/index.js" << 'MIGRATEJS'
/**
 * Brand Me Now v2 — Data Migration Runner
 *
 * Runs migration steps from v1 to v2 in sequence.
 *
 * Usage:
 *   node scripts/migrate/index.js [--dry-run] [--step <step-name>]
 *
 * @see docs/prd/16-MIGRATION-GUIDE.md
 */

import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const stepsDir = join(__dirname, 'steps');

const isDryRun = process.argv.includes('--dry-run');

async function run() {
  console.info('[migrate] Brand Me Now v2 — Data Migration');
  console.info(`[migrate] Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.info('');

  const stepFiles = readdirSync(stepsDir)
    .filter((f) => f.endsWith('.js'))
    .sort();

  if (stepFiles.length === 0) {
    console.info('[migrate] No migration steps found in steps/');
    return;
  }

  for (const file of stepFiles) {
    console.info(`[migrate] Running: ${file}`);
    const step = await import(join(stepsDir, file));
    await step.default({ dryRun: isDryRun });
    console.info(`[migrate] Completed: ${file}`);
  }

  console.info('');
  console.info('[migrate] All migrations complete.');
}

run().catch((err) => {
  console.error('[migrate] Migration failed:', err);
  process.exit(1);
});
MIGRATEJS

# --- Placeholder .gitkeep files for empty directories ---
section "Adding .gitkeep files for empty directories"

EMPTY_DIRS=(
  "server/src/config"
  "server/src/middleware"
  "server/src/controllers"
  "server/src/services"
  "server/src/skills/_shared"
  "server/src/skills/social-analyzer"
  "server/src/skills/brand-generator"
  "server/src/skills/logo-creator"
  "server/src/skills/mockup-renderer"
  "server/src/skills/name-generator"
  "server/src/skills/profit-calculator"
  "server/src/skills/video-creator"
  "server/src/jobs/workers"
  "server/src/socket"
  "server/src/utils"
  "server/src/lib"
  "server/config"
  "client/src/routes/auth"
  "client/src/routes/wizard"
  "client/src/routes/dashboard"
  "client/src/routes/admin"
  "client/src/components/ui"
  "client/src/components/wizard"
  "client/src/components/brand"
  "client/src/components/layout"
  "client/src/stores"
  "client/src/hooks"
  "client/src/lib"
  "client/public"
  "marketing/src/components"
  "marketing/public"
  "scripts/migrate/steps"
  "deploy/k8s"
)

for dir in "${EMPTY_DIRS[@]}"; do
  gitkeep="${PROJECT_DIR}/${dir}/.gitkeep"
  if [ ! -f "$gitkeep" ] && [ -z "$(ls -A "${PROJECT_DIR}/${dir}" 2>/dev/null)" ]; then
    touch "$gitkeep"
    FILES_CREATED=$((FILES_CREATED + 1))
  fi
done

info "Added .gitkeep to empty directories"

# ==============================================================================
# Summary
# ==============================================================================

echo ""
echo -e "${GREEN}=============================================="
echo -e " Scaffolding Complete!"
echo -e "==============================================${RESET}"
echo ""
echo -e "  Project:          ${BOLD}${PROJECT_DIR}${RESET}"
echo -e "  Directories:      ${CYAN}${DIRS_CREATED} created${RESET}"
echo -e "  Files created:    ${GREEN}${FILES_CREATED}${RESET}"
echo -e "  Files skipped:    ${YELLOW}${FILES_SKIPPED}${RESET} (already existed)"
echo ""
echo -e "${BOLD}Directory Structure:${RESET}"
echo ""

# Print a visual tree (if tree command is available, otherwise use find)
if command -v tree &>/dev/null; then
  tree -L 3 --dirsfirst -I 'node_modules|.git' "$PROJECT_DIR"
else
  # Fallback: simple listing
  find "$PROJECT_DIR" -maxdepth 3 -not -path '*/.git/*' -not -path '*/node_modules/*' | sort | while read -r line; do
    # Calculate depth for indentation
    rel="${line#$PROJECT_DIR}"
    depth=$(echo "$rel" | tr -cd '/' | wc -c)
    indent=""
    for ((i = 0; i < depth; i++)); do
      indent="  ${indent}"
    done
    basename_item=$(basename "$line")
    if [ -d "$line" ]; then
      echo "${indent}${basename_item}/"
    else
      echo "${indent}${basename_item}"
    fi
  done
fi

echo ""
echo -e "${BOLD}Next Steps:${RESET}"
echo ""
echo "  1. cd ${PROJECT_DIR}"
echo "  2. cp .env.template .env.local"
echo "  3. Fill in your API keys in .env.local"
echo "  4. pnpm install"
echo "  5. pnpm dev"
echo ""
echo "  Build order (from docs/prd/README.md):"
echo "    Week 1:  Server Core + Database + Observability"
echo "    Week 2:  Auth + Real-Time Jobs"
echo "    Week 3:  Agent System"
echo "    Week 4-6: Skill Modules (all 7 AI skills)"
echo "    Week 7-10: Frontend App"
echo "    Week 11-14: Payments + Integrations"
echo "    Week 15-16: Deployment + Testing + Marketing + Migration"
echo ""
