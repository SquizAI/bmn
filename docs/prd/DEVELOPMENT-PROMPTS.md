# Brand Me Now v2 -- Development Prompts for Claude Code

**Created:** February 19, 2026
**Purpose:** Ready-to-paste prompts for building every component of Brand Me Now v2.
**Usage:** Copy the prompt inside each code block, paste it into a new Claude Code session. Each prompt is self-contained and references the PRD docs that the agent needs to read.

---

## How to Use

1. Start a new Claude Code session in the `brand-me-now-v2` project root
2. Copy the entire prompt from the code block below
3. Paste it into Claude Code
4. Let the agent read the referenced docs and build the component
5. Verify against the acceptance criteria listed in each prompt

**Build Order (Critical Path):**

```
Phase 1 (Weeks 1-3):  1. Bootstrap -> 2. Server Core -> 3. Database -> 4. Auth -> 5. BullMQ+Socket.io -> 6. Observability
Phase 2 (Weeks 4-6):  7. Agent System -> 8a-8g. Skills (one per skill)
Phase 3 (Weeks 7-10): 9. Frontend Shell -> 10. Wizard Steps
Phase 4 (Weeks 11-14): 11. Payments -> 12. Integrations
Phase 5 (Weeks 15-16): 13. Deployment -> 14. Testing -> 15. Marketing Site -> 16. Migration
```

---

## Table of Contents

| # | Prompt | Phase | Est. Time |
|---|--------|-------|-----------|
| 1 | [Project Bootstrap](#1-project-bootstrap) | Phase 1 | 1-2 hours |
| 2 | [Express Server Core](#2-express-server-core) | Phase 1 | 4-6 hours |
| 3 | [Database Schema](#3-database-schema) | Phase 1 | 3-4 hours |
| 4 | [Auth & Security](#4-auth--security) | Phase 1 | 4-6 hours |
| 5 | [BullMQ + Socket.io](#5-bullmq--socketio) | Phase 1 | 4-6 hours |
| 6 | [Observability](#6-observability) | Phase 1 | 2-3 hours |
| 7 | [Agent System](#7-agent-system) | Phase 2 | 6-8 hours |
| 8a | [Skill: social-analyzer](#8a-skill-social-analyzer) | Phase 2 | 3-4 hours |
| 8b | [Skill: brand-generator](#8b-skill-brand-generator) | Phase 2 | 3-4 hours |
| 8c | [Skill: logo-creator](#8c-skill-logo-creator) | Phase 2 | 3-4 hours |
| 8d | [Skill: mockup-renderer](#8d-skill-mockup-renderer) | Phase 2 | 3-4 hours |
| 8e | [Skill: name-generator](#8e-skill-name-generator) | Phase 2 | 2-3 hours |
| 8f | [Skill: profit-calculator](#8f-skill-profit-calculator) | Phase 2 | 2-3 hours |
| 8g | [Skill: video-creator](#8g-skill-video-creator-phase-2) | Phase 2 | 2-3 hours |
| 9 | [Frontend App Shell](#9-frontend-app-shell) | Phase 3 | 6-8 hours |
| 10 | [Wizard Steps](#10-wizard-steps) | Phase 3 | 8-12 hours |
| 11 | [Payments & Billing](#11-payments--billing) | Phase 4 | 4-6 hours |
| 12 | [Integrations](#12-integrations) | Phase 4 | 4-6 hours |
| 13 | [Deployment & Infrastructure](#13-deployment--infrastructure) | Phase 5 | 4-6 hours |
| 14 | [Testing](#14-testing) | Phase 5 | 6-8 hours |
| 15 | [Marketing Site](#15-marketing-site) | Phase 5 | 4-6 hours |
| 16 | [Data Migration](#16-data-migration) | Phase 5 | 3-4 hours |

---

## 1. Project Bootstrap

```
You are building Brand Me Now v2, a greenfield rebuild of an AI-powered brand creation platform. This is the very first task -- project scaffolding.

READ THESE DOCS FIRST (read every line, they contain exact specs):
- docs/prd/README.md (build order, tech stack, env vars)
- docs/prd/03-SERVER-CORE.md Section 1 (project setup, package.json, directory structure)
- docs/prd/09-FRONTEND-APP.md Section 1 (frontend package.json, Vite config)

TASK: Initialize the monorepo with npm workspaces.

STEP 1 -- Root package.json:
Create the root package.json with:
- "name": "brand-me-now-v2"
- "private": true
- "workspaces": ["server", "web", "marketing", "shared"]
- Scripts: "dev" (concurrently runs server + web), "dev:server", "dev:web", "lint", "test"
- devDependencies: concurrently, prettier

STEP 2 -- Server workspace (server/):
Create server/package.json exactly matching the spec in 03-SERVER-CORE.md Section 1.1.
Install these production dependencies:
  express@5, @supabase/supabase-js, bullmq, socket.io, ioredis, pino, pino-pretty, pino-http,
  helmet, cors, cookie-parser, express-rate-limit, rate-limit-redis, zod, @sentry/node,
  stripe, resend, uuid, js-yaml, swagger-ui-express, swagger-jsdoc, sanitize-html, dotenv
Install these dev dependencies:
  eslint, @eslint/js, eslint-config-prettier, eslint-plugin-jsdoc, prettier, jsdoc, supertest
Create the directory structure from 03-SERVER-CORE.md Section 1.2 (empty files with JSDoc header comments).
Create eslint.config.js from Section 1.3.
Create .prettierrc from Section 1.4.
Create .env.example from Section 1.7 with all env vars listed.

STEP 3 -- Web workspace (web/):
Create web/package.json exactly matching 09-FRONTEND-APP.md Section 1.1.
Install these production dependencies:
  react@19, react-dom@19, react-router@7, zustand@5, @tanstack/react-query@5,
  @tanstack/react-query-devtools@5, react-hook-form, @hookform/resolvers, zod,
  socket.io-client, @supabase/supabase-js, motion, lucide-react, clsx, date-fns,
  react-dropzone, react-colorful, recharts, posthog-js, dompurify,
  @stripe/stripe-js, @stripe/react-stripe-js,
  @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-select,
  @radix-ui/react-checkbox, @radix-ui/react-radio-group, @radix-ui/react-toast,
  @radix-ui/react-progress, @radix-ui/react-tooltip, @radix-ui/react-tabs,
  @radix-ui/react-switch, @radix-ui/react-slider, @radix-ui/react-popover,
  @radix-ui/react-avatar, @radix-ui/react-separator, @radix-ui/react-scroll-area,
  @radix-ui/react-visually-hidden
Install dev dependencies:
  vite@7, @vitejs/plugin-react, tailwindcss@4, @tailwindcss/vite,
  eslint@9, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh,
  globals, prettier, prettier-plugin-tailwindcss,
  vitest@3, @vitest/ui, @vitest/coverage-v8,
  @testing-library/react, @testing-library/jest-dom, @testing-library/user-event,
  jsdom, msw, typescript
Create vite.config.js from Section 1.2 with path aliases and proxy config.
Create the initial src/ directory structure with placeholder files.

STEP 4 -- Shared workspace (shared/):
Create shared/package.json with name "@bmn/shared".
This will hold Zod schemas shared between server and web.
Create shared/src/schemas/ directory with an index.js placeholder.

STEP 5 -- Docker for local dev:
Create server/docker-compose.yml from 03-SERVER-CORE.md Section 1.6 (server + Redis + redis-commander).
Create server/Dockerfile from Section 1.6.
Create server/.dockerignore from Section 1.6.

STEP 6 -- Git setup:
Create a root .gitignore covering node_modules, .env, dist, coverage, .DS_Store, *.log.

VERIFICATION:
- Run: npm install (from root -- should install all workspaces)
- Run: cd server && node -e "import('express').then(e => console.log('Express v' + e.default?.name || '5 loaded'))"
- Run: cd web && npx vite --version (should show Vite 7.x)
- Confirm directory structure matches the specs

Do NOT start building actual application code yet. This prompt is purely scaffolding.
```

---

## 2. Express Server Core

```
You are building the Express.js 5 API server for Brand Me Now v2. The project has already been bootstrapped (packages installed, directory structure created). Now build the actual server code.

READ THIS DOC COMPLETELY (every section, every code block):
- docs/prd/03-SERVER-CORE.md

This document contains COMPLETE implementation code for every file. Your job is to create each file with the exact code shown, adapting only where the doc says "TODO" or leaves a section as a stub.

BUILD THESE FILES IN ORDER:

1. server/src/config/validate-env.js
   - Use the envalid pattern shown in the doc OR use dotenv + manual validation
   - CRASH on missing required vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, REDIS_URL
   - WARN on missing optional vars: SENTRY_DSN, POSTHOG_API_KEY

2. server/src/lib/errors.js
   - AppError class extending Error with: statusCode, code, details properties
   - Subclasses: ValidationError (400), AuthenticationError (401), ForbiddenError (403), NotFoundError (404), RateLimitError (429), InternalError (500)

3. server/src/lib/response.js
   - success(res, data, statusCode=200) -- standard JSON response wrapper
   - created(res, data) -- 201 response
   - noContent(res) -- 204 response
   - All responses follow format: { data: {...}, meta: { requestId } }

4. server/src/lib/yaml-loader.js
   - Load YAML config files with environment variable interpolation (${VAR_NAME} syntax)

5. server/src/services/supabase.js
   - supabaseAdmin client using SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)

6. server/src/services/redis.js
   - EXACTLY as shown in 06-REAL-TIME-JOBS.md Section 2: primary connection, subscriber connection, bullRedisConfig, health check, shutdown

7. server/src/services/queue.js
   - BullMQ queue factory function: createQueue(name, opts) using bullRedisConfig
   - Default options: removeOnComplete 100, removeOnFail 500, attempts 3, backoff exponential 1000ms

8. server/src/middleware/ (ALL files in exact order):
   - helmet.js -- EXACT code from doc Section 3.1
   - cors.js -- EXACT code from doc Section 3.2
   - request-id.js -- EXACT code from doc Section 3.3
   - logger.js -- EXACT code from doc Section 3.4
   - auth.js -- EXACT code from doc Section 3.5
   - tenant.js -- EXACT code from doc Section 3.6 (with TIER_LIMITS object)
   - rate-limit.js -- EXACT code from doc Section 3.7 (generalLimiter, generationLimiter, authLimiter)
   - validate.js -- EXACT code from doc Section 3.8
   - error-handler.js -- EXACT code from doc Section 3.9 (errorHandler + notFoundHandler)

9. server/src/routes/health.js
   - GET /health -- checks Redis ping, Supabase connection, returns { status: 'ok', checks: {...} }
   - GET /ready -- same checks, returns 503 if any check fails
   - NO auth required on these routes

10. server/src/routes/index.js
    - EXACT code from doc Section 4.1: mountRoutes() function
    - Import and mount all route groups (brands, wizard, generation, products, users, webhooks)

11. server/src/routes/brands.js
    - EXACT code from doc Section 4.3: full CRUD with Zod validation, tenant-scoped queries

12. server/src/routes/*.js (stubs for remaining routes)
    - wizard.js, generation.js, products.js, users.js, webhooks.js
    - Each should export a Router with placeholder routes that return 501 Not Implemented
    - Include JSDoc route comments showing the planned endpoints

13. server/src/sockets/index.js
    - createSocketServer(httpServer) function
    - Socket.io server attached to the shared HTTP server
    - JWT handshake authentication via Supabase token
    - Namespaces: /wizard, /admin, /chat (stubs with connection logging)

14. server/src/app.js
    - EXACT code from doc Section 2.2: full middleware chain in correct order
    - Sentry initialization, Swagger docs (dev only)

15. server/src/server.js
    - EXACT code from doc Section 2.1: createServer, attach Socket.io, graceful shutdown

16. server/src/cluster.js
    - EXACT code from doc Section 2.3: multi-core cluster mode

17. Config files:
    - server/config/rate-limits.yaml (per-endpoint rate limit config)
    - server/config/models.yaml (AI model routing: model name -> provider, API key env var, cost per 1k tokens)
    - server/config/crm-fields.yaml (GHL field mappings with env interpolation)

PATTERNS TO FOLLOW:
- "type": "module" -- all imports use ESM (import/export)
- JSDoc on every exported function with @param and @returns
- Structured logging only -- use the pino logger, never console.log
- Errors propagated via next(err) -- never swallow errors silently

VERIFICATION:
1. npm run dev:server (or node --watch src/server.js) starts without errors
2. curl http://localhost:3000/health returns { status: 'ok' } (Redis must be running)
3. curl http://localhost:3000/api/v1/brands returns 401 (auth required)
4. curl http://localhost:3000/nonexistent returns 404 with structured JSON error
5. Sentry DSN warning appears in logs if env var is missing (but server still starts)
```

---

## 3. Database Schema

```
You are creating the complete database schema for Brand Me Now v2 in Supabase (PostgreSQL 17).

READ THIS DOC COMPLETELY:
- docs/prd/07-DATABASE.md

This document contains COMPLETE SQL for every table, every RLS policy, every function, every index, and every storage bucket policy.

TASK: Create SQL migration files in supabase/migrations/ with timestamp-ordered naming.

CREATE THESE MIGRATION FILES (in this exact order):

supabase/migrations/20260219000001_extensions.sql
  - uuid-ossp, pgcrypto, pg_trgm extensions

supabase/migrations/20260219000002_types.sql
  - ALL custom ENUM types from Section 2: subscription_tier, user_role, brand_status, asset_type, job_status, job_type, credit_type, subscription_status, product_category

supabase/migrations/20260219000003_profiles.sql
  - profiles table with all columns exactly as specified
  - Enable RLS

supabase/migrations/20260219000004_brands.sql
  - brands table with JSONB columns for color_palette, fonts, brand_values, social_data, social_handles
  - Enable RLS

supabase/migrations/20260219000005_brand_assets.sql
  - brand_assets table with CASCADE delete from brands
  - Enable RLS

supabase/migrations/20260219000006_generation_jobs.sql
  - generation_jobs table with progress CHECK constraint (0-100)
  - Enable RLS

supabase/migrations/20260219000007_products.sql
  - products table with SKU unique constraint
  - Enable RLS

supabase/migrations/20260219000008_brand_products.sql
  - brand_products join table with UNIQUE (brand_id, product_id)
  - Enable RLS

supabase/migrations/20260219000009_bundles.sql
  - bundles table
  - Enable RLS

supabase/migrations/20260219000010_subscriptions.sql
  - subscriptions table with stripe_subscription_id UNIQUE
  - Enable RLS

supabase/migrations/20260219000011_generation_credits.sql
  - generation_credits table with UNIQUE (user_id, credit_type)
  - Enable RLS

supabase/migrations/20260219000012_audit_log.sql
  - audit_log table (append-only)
  - REVOKE UPDATE, DELETE from authenticated and anon
  - Enable RLS

supabase/migrations/20260219000013_chatbot_conversations.sql
  - chatbot_conversations table
  - Enable RLS

supabase/migrations/20260219000014_rls_helper.sql
  - is_admin() function (SECURITY DEFINER)

supabase/migrations/20260219000015_rls_policies.sql
  - ALL RLS policies from Section 3 for ALL tables (profiles, brands, brand_assets, generation_jobs, products, brand_products, bundles, subscriptions, generation_credits, audit_log, chatbot_conversations)
  - Follow the exact policy names and conditions from the doc

supabase/migrations/20260219000016_indexes.sql
  - ALL indexes from Section 4 (19 indexes total)
  - Include the trigram GIN index on products.name

supabase/migrations/20260219000017_functions.sql
  - handle_new_user() trigger function + trigger on auth.users INSERT
  - update_updated_at() trigger function + triggers on profiles, brands, subscriptions, chatbot_conversations
  - check_generation_credits(user_id, credit_type, amount)
  - deduct_generation_credit(user_id, credit_type, amount) with FOR UPDATE row locking
  - refill_generation_credits(user_id, tier) with UPSERT

supabase/migrations/20260219000018_storage_policies.sql
  - Storage bucket policies for: brand-logos, brand-mockups, brand-bundles, brand-videos, product-images, product-masks
  - All policies from Section 6: public read, authenticated write to own {user_id}/ folder, admin-only for product-images and product-masks

supabase/migrations/20260219000019_seed_data.sql
  - 20+ products across 5 categories (apparel, accessories, home_goods, packaging, digital)
  - Include SKUs, names, base_cost, retail_price, mockup_instructions
  - Products: T-shirt, Hoodie, Tank Top, Sweatshirt, Hat, Phone Case, Tote Bag, Water Bottle, Stickers, Mug, Throw Pillow, Canvas Print, Blanket, Box, Label, Bag, Tissue Paper, Social Media Template, Business Card, Email Header
  - Insert an admin user profile (for testing): admin@brandmenow.com with role='admin'

ALSO CREATE:
- supabase/config.toml -- Supabase CLI config (project ref, API URL)
- A README in supabase/ explaining how to run migrations locally

VERIFICATION:
1. All SQL files parse without syntax errors
2. Tables are created in dependency order (profiles before brands, brands before brand_assets)
3. RLS policies reference correct table relationships
4. Seed data inserts 20+ products
5. Functions compile and can be called: SELECT check_generation_credits('uuid', 'logo', 1)
```

---

## 4. Auth & Security

```
You are implementing the complete authentication and security layer for Brand Me Now v2.

READ THIS DOC COMPLETELY:
- docs/prd/08-AUTH-SECURITY.md

The Express server core already exists (middleware stubs may need to be completed). This prompt fills in all security-related functionality.

BUILD THESE COMPONENTS:

1. SERVER MIDDLEWARE (complete implementations, not stubs):

   server/src/middleware/auth.js (may already exist from server core -- complete it):
   - Extract Bearer token from Authorization header
   - Validate via supabaseAdmin.auth.getUser(token)
   - Attach user to req.user
   - Bypass for webhook routes (they use Stripe signature verification)
   - Return 401 with structured error for invalid/expired tokens

   server/src/middleware/require-admin.js (NEW):
   - Check req.user.app_metadata.role === 'admin' OR check profiles table
   - Return 403 if not admin
   - Used on admin-only routes: product management, user management, Bull Board

   server/src/middleware/require-subscription.js (NEW):
   - Check req.tenant.tier !== 'free' OR check specific tier requirements
   - Factory: requireSubscription('starter') -- requires at least starter tier
   - Return 403 with upgrade message if insufficient tier

   server/src/middleware/credit-check.js (NEW):
   - Factory: creditCheck('logo', 4) -- checks if user has 4 logo credits
   - Calls supabase RPC check_generation_credits()
   - Returns 402 Payment Required if insufficient credits
   - Includes remaining credits in response header X-Credits-Remaining

2. RESUME TOKEN SYSTEM:

   server/src/lib/resume-token.js:
   - generateResumeToken(brandId, wizardStep, userId) -> HMAC-SHA256 signed token
   - validateResumeToken(token) -> { brandId, wizardStep, userId } or throws
   - Token format: base64url(payload) + '.' + base64url(signature)
   - Uses RESUME_TOKEN_SECRET env var (min 32 chars)
   - Tokens expire after 7 days (expiry embedded in payload)
   - Used for magic-link wizard resume URLs: /wizard/resume?token=xxx

3. PROMPT INJECTION PREVENTION:

   server/src/lib/prompt-safety.js:
   - buildSafePrompt(systemPrompt, userInput) -- wraps user input in XML delimiters
   - sanitizeUserInput(input) -- strips known injection patterns
   - detectInjectionAttempt(input) -- returns boolean + confidence score
   - Patterns to detect: "ignore previous instructions", "system:", prompt leaking attempts
   - Log injection attempts to audit_log with action='security.prompt_injection_attempt'

4. INPUT SANITIZATION:

   server/src/middleware/sanitize.js (NEW):
   - Middleware that sanitizes all req.body string fields using sanitize-html
   - Strip HTML tags, script tags, event handlers
   - Applied before validation middleware

5. WEBHOOK AUTH:

   server/src/middleware/stripe-webhook-auth.js (NEW):
   - Verify Stripe webhook signature using stripe.webhooks.constructEvent()
   - Uses raw body (express.raw() for webhook routes)
   - Returns 400 if signature invalid

6. SOCKET.IO AUTH:

   server/src/sockets/auth.js (NEW or complete existing stub):
   - Socket.io middleware that validates JWT on handshake
   - Extract token from socket.handshake.auth.token
   - Validate via Supabase
   - Attach user to socket.data.user
   - Disconnect on invalid token

7. CORS HARDENING (update if needed):
   - Ensure CORS origins are strictly from CORS_ORIGINS env var
   - No wildcard (*) in production
   - Credentials: true

PATTERNS:
- All middleware follows Express 5 async error pattern (errors propagate via next(err))
- All security failures logged at WARN level (not ERROR -- they are expected)
- All security failures return structured JSON errors (never HTML, never stack traces)
- JSDoc types on every function

VERIFICATION:
1. Request without Authorization header -> 401 with AUTH_MISSING_TOKEN
2. Request with expired token -> 401 with AUTH_INVALID_TOKEN
3. Non-admin hitting admin route -> 403 with ADMIN_REQUIRED
4. Free tier user hitting generation -> 402 with CREDITS_EXHAUSTED
5. Resume token round-trip: generate -> validate -> get original payload
6. Prompt with "ignore previous instructions" -> detected by injection checker
7. Stripe webhook with wrong signature -> 400
8. Socket.io connection without token -> disconnected
```

---

## 5. BullMQ + Socket.io

```
You are implementing the complete real-time job processing layer for Brand Me Now v2, using BullMQ for durable background jobs and Socket.io for live progress streaming.

READ THIS DOC COMPLETELY:
- docs/prd/06-REAL-TIME-JOBS.md

IMPORTANT CONTEXT: The Express server, Redis connection, and Socket.io stub already exist. This prompt builds the full queue system and wires it to Socket.io.

BUILD THESE COMPONENTS:

1. REDIS SERVICE (complete/verify):
   server/src/services/redis.js
   - Should already exist from server core. Verify it has:
     - Primary connection (redis), subscriber connection (redisSub)
     - bullRedisConfig exported for BullMQ
     - redisHealthCheck() and redisShutdown() functions

2. QUEUE DEFINITIONS:
   server/src/queues/index.js
   - Define ALL named queues:
     - 'brand-wizard' -- Agent orchestration (parent agent runs)
     - 'logo-generation' -- FLUX.2 Pro logo generation
     - 'mockup-generation' -- GPT Image 1.5 mockup generation
     - 'bundle-composition' -- Gemini 3 Pro Image bundle images
     - 'social-scraping' -- Apify social media scraping
     - 'crm-sync' -- GoHighLevel contact sync
     - 'email-send' -- Resend transactional email
     - 'stripe-webhook' -- Stripe webhook processing (durable)
     - 'video-generation' -- Veo 3 product videos (Phase 2)
   - Each queue created with createQueue() using bullRedisConfig
   - Default job options per queue (priority, attempts, backoff, removeOnComplete)
   - Export all queues as named exports AND as a queues Map

3. WORKER BASE CLASS:
   server/src/workers/base-worker.js
   - BaseWorker class wrapping BullMQ Worker
   - Constructor: (queueName, processor, options)
   - Built-in: progress reporting, error handling, Sentry capture, graceful shutdown
   - emitProgress(job, { status, progress, message }) -- emits to Socket.io room AND updates generation_jobs table
   - emitComplete(job, result) -- emits to Socket.io and updates DB
   - emitFailed(job, error) -- emits to Socket.io, updates DB, logs to Sentry

4. WORKER IMPLEMENTATIONS (each in its own file):

   server/src/workers/logo-generation.worker.js
   - Picks up jobs from 'logo-generation' queue
   - Job data: { brandId, userId, prompt, style, count: 4 }
   - Steps: (1) Compose FLUX.2 Pro prompt, (2) Call BFL API 4 times in parallel, (3) Upload results to Supabase Storage, (4) Create brand_asset records, (5) Emit complete
   - Progress events at each step: 0% queued, 20% composing prompt, 40% generating (1/4), 60% generating (3/4), 80% uploading, 100% complete
   - Retry: 3 attempts, exponential backoff starting at 2s

   server/src/workers/mockup-generation.worker.js
   - Job data: { brandId, userId, productId, logoUrl, mockupInstructions }
   - Calls GPT Image 1.5 API
   - Similar progress pattern

   server/src/workers/bundle-composition.worker.js
   - Job data: { brandId, userId, productIds, mockupUrls, bundleName }
   - Calls Gemini 3 Pro Image API
   - Composes selected mockups into a bundle image

   server/src/workers/social-scraping.worker.js
   - Job data: { brandId, userId, handles: { instagram?, tiktok?, facebook? } }
   - Calls Apify API for each platform
   - Returns unified social profile data

   server/src/workers/crm-sync.worker.js
   - Job data: { userId, contactData, tags }
   - Calls GoHighLevel API to upsert contact
   - Handles OAuth token refresh on 401
   - Dead-letter after 3 failed attempts

   server/src/workers/email-send.worker.js
   - Job data: { template, to, subject, templateData }
   - Calls Resend API with React Email template
   - Templates: welcome, brand-complete, wizard-abandoned, support-ticket, invoice-paid, credits-exhausted, subscription-change

   server/src/workers/stripe-webhook.worker.js
   - Job data: { eventType, eventData, stripeEventId }
   - Switch on event type: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed
   - Idempotency check against webhook_events table
   - Updates subscriptions, generation_credits, profiles tables

   NOTE: Workers that call external AI APIs should have STUB implementations for now (log the call, return mock data). The actual API integrations will be built in the Skills prompts. The worker STRUCTURE and Socket.io wiring must be real.

5. SOCKET.IO SERVER (complete implementation):
   server/src/sockets/index.js
   - createSocketServer(httpServer) function
   - Redis adapter for multi-process support (@socket.io/redis-adapter)
   - JWT authentication middleware (validate Supabase token on handshake)
   - Namespaces:
     - /wizard: clients join room `brand:{brandId}` to receive generation progress
     - /admin: admin-only namespace for Bull Board live events
     - /chat: chatbot conversation streaming
   - Event handlers per namespace (connection, disconnect, join-room, leave-room)

6. SOCKET.IO + BULLMQ BRIDGE:
   server/src/sockets/job-bridge.js
   - Function: bridgeJobToSocket(io, job, namespace, room)
   - Called by workers to emit progress/complete/failed events to the correct Socket.io room
   - Maps BullMQ job events to Socket.io events:
     - job:progress -> { jobId, status, progress (0-100), message }
     - job:complete -> { jobId, result }
     - job:failed -> { jobId, error }

7. BULL BOARD ADMIN UI:
   server/src/admin/bull-board.js
   - Set up @bull-board/express with all queues registered
   - Mount at /admin/queues (protected by requireAdmin middleware)
   - Show job counts, status, retry controls

8. WORKER STARTUP:
   server/src/workers/index.js
   - startAllWorkers() function that initializes all workers
   - Graceful shutdown: close all workers on SIGTERM
   - Called from server.js after HTTP server starts

PATTERNS:
- Every job has a unique UUID (not BullMQ's auto-increment)
- Every job creates a generation_jobs row in the database BEFORE being queued
- Progress updates go to BOTH Socket.io (real-time) and database (persistence)
- Workers are idempotent -- re-running a job produces the same result
- Workers never throw -- they catch errors and emit job:failed events

VERIFICATION:
1. Start server -> all workers initialize without errors
2. POST to a test endpoint that queues a logo-generation job -> job appears in Redis
3. Worker picks up job -> progress events emitted to Socket.io (verify with socket.io-client test script)
4. Bull Board accessible at /admin/queues (with admin auth)
5. Kill and restart server -> pending jobs are picked up by new worker instances
6. Queue a job with invalid data -> job fails, dead-letters, Sentry captures error
```

---

## 6. Observability

```
You are implementing the observability stack for Brand Me Now v2: Sentry error tracking, pino structured logging, PostHog analytics, and Bull Board monitoring.

READ THIS DOC COMPLETELY:
- docs/prd/12-OBSERVABILITY.md

CONTEXT: The Express server exists with pino logging already wired in middleware. This prompt adds Sentry, PostHog, AI cost tracking, and health check enhancements.

BUILD THESE COMPONENTS:

1. SENTRY INITIALIZATION:
   server/src/lib/sentry.js
   - initSentry() called FIRST in server.js (before other imports)
   - Sentry.init with: DSN, environment, release tag, traces sample rate (0.2 prod, 1.0 dev)
   - Express integration via Sentry.setupExpressErrorHandler(app)
   - Node profiling integration
   - Filtered errors: ECONNRESET, EPIPE, rate limit 429s
   - Custom tags: service=bmn-api, deployment region

2. SENTRY CONTEXT HELPERS:
   server/src/lib/sentry-context.js
   - setUserContext(req) -- sets Sentry user from req.user (id, email, tier)
   - setJobContext(job) -- sets Sentry context from BullMQ job (jobId, type, brandId)
   - captureWithContext(error, extra) -- captures exception with additional context
   - breadcrumb(category, message, data) -- adds Sentry breadcrumb

3. POSTHOG SERVER-SIDE ANALYTICS:
   server/src/lib/posthog.js
   - PostHog Node.js client initialization
   - trackEvent(userId, event, properties) -- fire-and-forget
   - trackGenerationEvent(userId, { jobType, model, durationMs, costUsd, success })
   - identifyUser(userId, traits) -- set user properties
   - Events to track: wizard.started, wizard.step.completed, wizard.completed, wizard.abandoned, generation.started, generation.completed, generation.failed, subscription.created, subscription.upgraded, subscription.canceled

4. AI COST TRACKING:
   server/src/lib/cost-tracker.js
   - recordAICost({ userId, brandId, model, inputTokens, outputTokens, costUsd, jobType })
   - Writes to audit_log table with action='ai.cost'
   - Daily aggregation query function: getAICostSummary(startDate, endDate)
   - Alert if single-session cost exceeds $5.00 (Sentry alert)
   - Cost lookup table for all models: Claude Sonnet 4.6, Haiku 4.5, Gemini 3.0 Flash/Pro, FLUX.2 Pro, GPT Image 1.5, Ideogram v3, Gemini 3 Pro Image, Veo 3

5. ENHANCED HEALTH CHECKS:
   server/src/routes/health.js (update existing):
   - GET /health: checks Redis ping, Supabase query, BullMQ queue connectivity
   - GET /ready: same checks + verifies all workers are running
   - GET /health/detailed (admin only): includes queue depths, worker counts, memory usage, uptime
   - Response format: { status: 'ok'|'degraded'|'down', checks: { redis: 'ok', supabase: 'ok', bullmq: 'ok' }, timestamp }

6. REQUEST CORRELATION:
   - Ensure X-Request-ID flows from middleware -> pino logs -> Sentry breadcrumbs -> BullMQ job metadata -> Socket.io events
   - Every log line includes: requestId, userId (if authenticated), service name, environment

VERIFICATION:
1. Sentry captures a test error: throw new Error('test') in a route -> appears in Sentry dashboard
2. PostHog receives a test event: trackEvent(userId, 'test', {}) -> appears in PostHog
3. Health check returns detailed status: curl /health -> { status: 'ok', checks: {...} }
4. AI cost is recorded: recordAICost({...}) -> row appears in audit_log
5. Request ID appears in all log lines, Sentry events, and Socket.io messages
```

---

## 7. Agent System

```
You are implementing the Anthropic Agent SDK integration for Brand Me Now v2. The agent system is the AI brain that orchestrates the entire brand creation workflow.

READ THIS DOC COMPLETELY:
- docs/prd/04-AGENT-SYSTEM.md

IMPORTANT: Read the ENTIRE document including the system prompt, tool definitions, hook implementations, and subagent registry.

BUILD THESE COMPONENTS:

1. AGENT SDK SETUP:
   server/src/agents/setup.js
   - Import and configure @anthropic-ai/claude-agent-sdk
   - ANTHROPIC_API_KEY from env
   - Default model: claude-sonnet-4-6
   - Permission mode: bypassPermissions (server-side autonomous execution)

2. BRAND WIZARD AGENT (Parent):
   server/src/agents/brand-wizard.js
   - Complete system prompt from doc Section 2.1 (copy exactly)
   - Agent configuration: model claude-sonnet-4-6, maxTurns 50, maxBudgetUsd 2.00
   - Direct tools (defined inline):
     - saveBrandData: upsert brand fields in Supabase
     - searchProducts: query products table with filters
     - validateInput: call Gemini 3.0 Flash for quick validation
     - queueCRMSync: add job to crm-sync BullMQ queue
     - sendEmail: add job to email-send BullMQ queue
     - deductCredit: call supabase RPC deduct_generation_credit()
     - checkCredits: call supabase RPC check_generation_credits()
   - Subagent invocations via Task tool (registered from skill modules)

3. TOOL DEFINITION PATTERN:
   server/src/agents/tools/_shared.js
   - createTool(name, description, inputSchema, executeFn) factory
   - Zod schema -> Agent SDK inputSchema conversion
   - Execution wrapper with: try/catch, cost tracking, pino logging, Sentry breadcrumb

4. DIRECT TOOL IMPLEMENTATIONS:
   server/src/agents/tools/save-brand-data.js
   server/src/agents/tools/search-products.js
   server/src/agents/tools/validate-input.js
   server/src/agents/tools/queue-crm-sync.js
   server/src/agents/tools/send-email.js
   server/src/agents/tools/deduct-credit.js
   server/src/agents/tools/check-credits.js
   Each tool: Zod input schema, execute function, error handling, return structured data

5. SUBAGENT REGISTRY:
   server/src/agents/registry.js
   - registerSkill(skillConfig) -- registers a skill module as a Task-invocable subagent
   - getAllSkills() -- returns all registered skills
   - getSkill(name) -- returns a single skill config
   - Each skill config: { name, description, model, maxTurns, maxBudgetUsd, systemPrompt, tools }
   - Skills registered: social-analyzer, brand-generator, logo-creator, mockup-renderer, name-generator, profit-calculator, video-creator

6. AGENT LIFECYCLE HOOKS:
   server/src/agents/hooks.js
   - All 11 SDK lifecycle hooks implemented:
     - onAgentStart: log agent session start, emit Socket.io event
     - onToolStart: log tool call, emit Socket.io progress
     - onToolEnd: log tool result, record AI cost, emit Socket.io progress
     - onAgentEnd: log agent completion, emit Socket.io complete event
     - onError: capture in Sentry, emit Socket.io error, log
     - onBudgetExceeded: log warning, emit Socket.io budget event
     - onMaxTurnsReached: log warning, emit Socket.io event
   - All hooks receive the Socket.io instance and room name for real-time updates

7. SESSION MANAGEMENT:
   server/src/agents/session.js
   - createAgentSession(brandId, userId, wizardStep) -> sessionId
   - resumeAgentSession(sessionId) -> restored agent context
   - saveSessionState(sessionId, state) -> persist to Redis (TTL 7 days)
   - Session ID stored in brands table as agent_session_id

8. MODEL ROUTER:
   server/src/agents/model-router.js
   - Reads config/models.yaml
   - Routes model requests to correct provider:
     - claude-sonnet-4-6 -> Anthropic API
     - claude-haiku-4-5 -> Anthropic API
     - gemini-3-flash -> Google AI API
     - gemini-3-pro -> Google AI API
   - Fallback chains: if Anthropic is down, route text tasks to Gemini 3.0 Pro
   - Cost tracking per model call

9. AGENT API ROUTE:
   server/src/routes/wizard.js (update from stub):
   - POST /api/v1/wizard/start -- create brand + start agent session
   - POST /api/v1/wizard/:brandId/step -- advance wizard step (agent processes)
   - POST /api/v1/wizard/:brandId/resume -- resume from HMAC token
   - GET /api/v1/wizard/:brandId/status -- current step, progress, agent state
   - All routes: auth required, credit checks for generation steps

PATTERNS:
- Agent runs INSIDE BullMQ workers (not in HTTP handlers)
- HTTP handler queues the job, BullMQ worker runs the agent
- Agent results flow back to client via Socket.io (not HTTP response)
- Every agent turn is logged with model, tokens, cost
- Budget isolation: parent $2.00, each subagent $0.20-$0.50

VERIFICATION:
1. Agent session creates successfully with sessionId
2. Agent can call saveBrandData tool -> brand updated in Supabase
3. Agent can call checkCredits tool -> returns credit balance
4. Agent spawns a subagent via Task tool -> subagent runs and returns result
5. Socket.io events emitted for every tool call (progress tracking works)
6. Budget exceeded -> agent stops gracefully with budget_exceeded event
7. Session resume -> agent continues with full prior context
```

---

## 8a. Skill: social-analyzer

```
You are implementing the social-analyzer skill for Brand Me Now v2. This skill scrapes and analyzes social media profiles to extract brand DNA.

READ THESE DOCS:
- docs/prd/05-SKILL-MODULES.md -- Section "Skill 1: social-analyzer" (read the ENTIRE section)
- docs/prd/04-AGENT-SYSTEM.md -- Section on subagent pattern (for context)

BUILD these files following the exact structure in the doc:

server/src/skills/social-analyzer/
  config.js   -- name: 'social-analyzer', model: 'claude-sonnet-4-6', maxTurns: 15, maxBudgetUsd: 0.50
  prompts.js  -- System prompt for social analysis, buildTaskPrompt() function with XML delimiter safety
  tools.js    -- Zod schemas for: scrapeInstagram, scrapeTikTok, scrapeFacebook, analyzeAesthetic, synthesizeAnalysis
  handlers.js -- Tool execution functions:
    - scrapeInstagram: Call Apify Instagram scraper API, return { bio, followers, posts: [...], profileImage }
    - scrapeTikTok: Call Apify TikTok scraper API, return { bio, followers, videos: [...] }
    - scrapeFacebook: Call Apify Facebook scraper API, return { pageInfo, posts: [...] }
    - analyzeAesthetic: Send top 9-12 post images to Gemini 3.0 Flash for visual analysis (dominant colors, mood, style)
    - synthesizeAnalysis: Combine all scraped data + visual analysis into structured SocialAnalysis JSON, save to brands.social_data
  index.js    -- Export complete subagent config for registry registration

OUTPUT SCHEMA (SocialAnalysis):
{
  platforms: { instagram?: {...}, tiktok?: {...}, facebook?: {...} },
  aesthetic: { dominantColors: [], visualMood: '', photographyStyle: '', compositionPatterns: [] },
  contentThemes: [{ theme: '', frequency: '', examples: [] }],
  audienceDemographics: { ageRange: '', gender: '', interests: [] },
  engagementMetrics: { avgLikesPerPost: 0, avgCommentsPerPost: 0, engagementRate: 0 },
  brandSignals: { personality: '', tone: '', values: [], uniqueElements: [] }
}

For now, Apify API calls can be STUBBED with mock data (real integration in Integrations prompt). The Gemini Flash call should be REAL if GOOGLE_API_KEY is available, or stubbed if not.

VERIFICATION:
1. Skill registers in the agent registry: getSkill('social-analyzer') returns config
2. Running the skill with mock handles returns a valid SocialAnalysis JSON
3. Analysis is saved to brands.social_data in Supabase
4. Progress events emitted: scraping (30%), analyzing (60%), synthesizing (90%), complete (100%)
```

---

## 8b. Skill: brand-generator

```
You are implementing the brand-generator skill for Brand Me Now v2. This skill creates complete brand identity from social analysis data.

READ THESE DOCS:
- docs/prd/05-SKILL-MODULES.md -- Section "Skill 2: brand-generator" (read the ENTIRE section)

BUILD these files:

server/src/skills/brand-generator/
  config.js   -- name: 'brand-generator', model: 'claude-sonnet-4-6', maxTurns: 10, maxBudgetUsd: 0.30
  prompts.js  -- System prompt for brand identity creation, includes brand archetypes knowledge
  tools.js    -- Zod schemas for: generateBrandIdentity, suggestColorPalette, suggestTypography, saveBrandIdentity
  handlers.js -- Tool execution functions:
    - generateBrandIdentity: Uses Claude to generate vision, values, archetype, target audience from social analysis
    - suggestColorPalette: Generate 4-6 brand colors with hex codes, names, and roles (primary, secondary, accent, neutral)
    - suggestTypography: Suggest 3 font pairings (primary heading, secondary heading, body) from Google Fonts
    - saveBrandIdentity: Save complete identity to brands table (color_palette, fonts, brand_values, archetype, vision, target_audience)
  index.js    -- Export subagent config

OUTPUT SCHEMA (BrandIdentity):
{
  vision: 'string (2-3 sentences)',
  values: ['Innovation', 'Community', ...],
  archetype: 'The Creator',
  targetAudience: 'string describing ideal customer',
  colorPalette: [{ hex: '#FF5733', name: 'Sunset Orange', role: 'primary' }, ...],
  fonts: { primary: 'Inter', secondary: 'Playfair Display', body: 'Open Sans' },
  logoStyle: 'minimal|bold|vintage|modern|playful',
  moodKeywords: ['energetic', 'modern', ...]
}

VERIFICATION:
1. Skill takes SocialAnalysis input and outputs complete BrandIdentity
2. Color palette contains 4-6 colors with valid hex codes
3. Font suggestions are real Google Fonts names
4. Brand identity saved to brands table
5. Progress events emitted at each step
```

---

## 8c. Skill: logo-creator

```
You are implementing the logo-creator skill for Brand Me Now v2. This skill generates logos via FLUX.2 Pro (BFL direct API).

READ THESE DOCS:
- docs/prd/05-SKILL-MODULES.md -- Section "Skill 3: logo-creator" (read the ENTIRE section)

BUILD these files:

server/src/skills/logo-creator/
  config.js   -- name: 'logo-creator', model: 'claude-sonnet-4-6', maxTurns: 12, maxBudgetUsd: 0.50
  prompts.js  -- System prompt for logo generation, includes prompt engineering for FLUX.2 Pro
  tools.js    -- Zod schemas for: composeLogoPrompt, generateLogo, removeBackground, uploadAsset, selectLogo
  handlers.js -- Tool execution functions:
    - composeLogoPrompt: Claude composes an optimized FLUX.2 Pro prompt from brand identity (colors, style, name)
    - generateLogo: Call BFL FLUX.2 Pro API with composed prompt (POST https://api.bfl.ml/v1/flux-pro-1.1)
      - Generate 4 logos in parallel
      - Each call: poll for result (BFL is async -- submit, then poll status URL)
      - Return image URLs
    - removeBackground: Call Python AI worker or rembg library for transparent PNG
    - uploadAsset: Upload generated image to Supabase Storage brand-logos bucket, create brand_asset record
    - selectLogo: Mark one logo as is_selected=true in brand_assets
  index.js    -- Export subagent config

BFL API PATTERN:
  POST https://api.bfl.ml/v1/flux-pro-1.1
  Headers: { x-key: BFL_API_KEY }
  Body: { prompt, width: 1024, height: 1024, steps: 40, guidance: 7.5 }
  Response: { id: 'task-id', status: 'Pending' }
  Poll: GET https://api.bfl.ml/v1/get_result?id=task-id
  Result: { status: 'Ready', result: { sample: 'image-url' } }

QUEUE INTEGRATION:
  The actual FLUX.2 Pro call runs inside the logo-generation BullMQ worker.
  The agent tool should queue the job and return the jobId.
  The worker emits progress via Socket.io.

VERIFICATION:
1. Agent composes a FLUX.2 Pro prompt from brand identity
2. 4 logo generation jobs queued in parallel
3. Progress events: 0% queued, 25% generating 1/4, 50% generating 2/4, 75% generating 3/4, 100% complete
4. Generated images uploaded to Supabase Storage
5. brand_asset records created for each logo
6. User can select a logo -> is_selected=true
```

---

## 8d. Skill: mockup-renderer

```
You are implementing the mockup-renderer skill for Brand Me Now v2. This skill generates product mockups using GPT Image 1.5 and Ideogram v3.

READ THESE DOCS:
- docs/prd/05-SKILL-MODULES.md -- Section "Skill 4: mockup-renderer" (read the ENTIRE section)

BUILD these files:

server/src/skills/mockup-renderer/
  config.js   -- name: 'mockup-renderer', model: 'claude-sonnet-4-6', maxTurns: 20, maxBudgetUsd: 0.75
  prompts.js  -- System prompt for mockup generation, includes product-specific placement instructions
  tools.js    -- Zod schemas for: composeMockupPrompt, generateMockup, generateTextMockup, uploadMockup, approveMockup
  handlers.js -- Tool execution functions:
    - composeMockupPrompt: Build GPT Image 1.5 prompt using logo URL, product template, brand colors, mockup_instructions from products table
    - generateMockup: Call OpenAI GPT Image 1.5 API (POST https://api.openai.com/v1/images/generations with model: 'gpt-image-1.5')
      - Input: text prompt + reference images (logo, product template)
      - Output: generated mockup image URL
    - generateTextMockup: Call Ideogram v3 API for products that need text overlay (business cards, social media templates)
    - uploadMockup: Upload to Supabase Storage brand-mockups bucket, create brand_asset record, link to brand_products.mockup_asset_id
    - approveMockup: Mark mockup as approved, update brand_products record

QUEUE INTEGRATION:
  Each product mockup is a separate BullMQ job in 'mockup-generation' queue.
  Agent queues one job per selected product.
  Progress is per-product (not aggregate).

VERIFICATION:
1. Agent generates mockup prompts using product-specific instructions
2. One BullMQ job per product, all queued in parallel
3. Mockup images uploaded and linked to brand_products
4. Text-heavy products (business card, social template) routed to Ideogram v3
5. Progress events per mockup: queued -> generating -> uploading -> complete
```

---

## 8e. Skill: name-generator

```
You are implementing the name-generator skill for Brand Me Now v2.

READ THESE DOCS:
- docs/prd/05-SKILL-MODULES.md -- Section "Skill 5: name-generator" (read the ENTIRE section)

BUILD these files:

server/src/skills/name-generator/
  config.js   -- name: 'name-generator', model: 'claude-sonnet-4-6', maxTurns: 8, maxBudgetUsd: 0.20
  prompts.js  -- System prompt for brand name generation with linguistic analysis
  tools.js    -- Zod schemas for: generateNames, checkDomainAvailability, checkTrademarkConflicts, saveBrandName
  handlers.js -- Tool execution functions:
    - generateNames: Claude generates 5-10 brand name options based on brand identity, values, target audience
      - Each name includes: name, tagline, reasoning, linguistic notes (phonetics, memorability)
    - checkDomainAvailability: Check .com/.co/.io availability (use DNS lookup or WHOIS API)
    - checkTrademarkConflicts: Search USPTO TESS database (or stub with disclaimer)
    - saveBrandName: Save selected name to brands.name
  index.js    -- Export subagent config

VERIFICATION:
1. Agent generates 5-10 creative brand names from brand identity
2. Each name includes a tagline and reasoning
3. Domain availability checked for each suggestion
4. Selected name saved to brands table
```

---

## 8f. Skill: profit-calculator

```
You are implementing the profit-calculator skill for Brand Me Now v2. This is a PURE MATH skill -- no AI API calls, no generation credits consumed.

READ THESE DOCS:
- docs/prd/05-SKILL-MODULES.md -- Section "Skill 6: profit-calculator" (read the ENTIRE section)

BUILD these files:

server/src/skills/profit-calculator/
  config.js   -- name: 'profit-calculator', model: 'claude-haiku-4-5', maxTurns: 5, maxBudgetUsd: 0.05
  prompts.js  -- System prompt for financial projection generation
  tools.js    -- Zod schemas for: calculateProductMargins, calculateBundleMargins, projectRevenue, saveProjections
  handlers.js -- Tool execution functions:
    - calculateProductMargins: For each product: base_cost, retail_price, margin = retail - cost, margin_pct = margin/retail
    - calculateBundleMargins: Sum product costs in bundle, apply bundle discount, calculate bundle margin
    - projectRevenue: Project monthly revenue at 3 tiers:
      - Conservative: 10 units/month per product
      - Moderate: 50 units/month per product
      - Aggressive: 200 units/month per product
      - Include: gross revenue, COGS, gross profit, platform fees (5%), net profit
    - saveProjections: Save projection data to brands table or a dedicated projections JSONB column
  index.js    -- Export subagent config

USES Claude Haiku 4.5 (cheapest model) because this is simple math with light formatting.

VERIFICATION:
1. Margin calculations are mathematically correct
2. Revenue projections include all 3 tiers with correct math
3. Bundle pricing accounts for bundle discount
4. Results saved to database
5. No AI generation credits consumed (this is math, not image generation)
```

---

## 8g. Skill: video-creator (Phase 2)

```
You are implementing the video-creator skill STUB for Brand Me Now v2 Phase 2. This skill will generate product videos via Google Veo 3. For now, implement the structure with placeholder implementations.

READ THESE DOCS:
- docs/prd/05-SKILL-MODULES.md -- Section "Skill 7: video-creator" (read the ENTIRE section)

BUILD these files:

server/src/skills/video-creator/
  config.js   -- name: 'video-creator', model: 'claude-sonnet-4-6', maxTurns: 10, maxBudgetUsd: 1.00
  prompts.js  -- System prompt for video generation (product showcase, brand reveal)
  tools.js    -- Zod schemas for: composeVideoPrompt, generateVideo, uploadVideo
  handlers.js -- Tool execution functions (ALL STUBBED):
    - composeVideoPrompt: Return a placeholder prompt for Veo 3
    - generateVideo: Return { status: 'phase2_not_implemented', message: 'Video generation coming in Phase 2' }
    - uploadVideo: Stub
  index.js    -- Export subagent config with phase2: true flag

VERIFICATION:
1. Skill registers in registry but is marked as phase2
2. Calling the skill returns a clear "Phase 2" message
3. No credits are deducted for Phase 2 stubs
```

---

## 9. Frontend App Shell

```
You are building the React 19 SPA shell for Brand Me Now v2. This is the foundation -- routing, auth, stores, layout, design system. NOT the individual page content (that comes in the Wizard Steps prompt).

READ THIS DOC COMPLETELY:
- docs/prd/09-FRONTEND-APP.md

BUILD THESE COMPONENTS:

1. ENTRY POINT:
   web/src/main.jsx -- React 19 createRoot, wrap in providers (QueryClientProvider, AuthProvider)
   web/index.html -- minimal HTML shell with loading spinner

2. SUPABASE CLIENT:
   web/src/lib/supabase.js
   - createClient with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
   - flowType: 'pkce', autoRefreshToken: true, persistSession: true

3. API CLIENT:
   web/src/lib/api.js
   - Axios instance with baseURL /api/v1
   - Request interceptor: attach Supabase JWT as Bearer token
   - Response interceptor: handle 401 (redirect to login), 429 (show rate limit toast)
   - Typed request helpers: api.get(), api.post(), api.patch(), api.delete()

4. SOCKET.IO CLIENT:
   web/src/lib/socket.js
   - createSocket(namespace) factory function
   - Auto-connect with Supabase JWT in auth handshake
   - Reconnection logic with exponential backoff
   - Custom hook: useSocket(namespace) -- returns { socket, isConnected }
   - Custom hook: useJobProgress(jobId) -- returns { status, progress, message, result, error }

5. ZUSTAND STORES:
   web/src/stores/auth-store.js
   - State: user, session, isAuthenticated, isLoading
   - Actions: signIn, signUp, signInWithGoogle, signOut, refreshSession
   - Supabase auth state listener (onAuthStateChange)

   web/src/stores/wizard-store.js
   - State: currentStep, brandId, brandData, socialHandles, selectedProducts, generationJobs
   - Actions: setStep, updateBrandData, addProduct, removeProduct, reset
   - Steps enum: WELCOME, PHONE_TERMS, SOCIAL_INPUT, SOCIAL_ANALYSIS, BRAND_REVIEW, CUSTOMIZATION, LOGO_GENERATION, LOGO_SELECTION, PRODUCT_SELECTION, MOCKUP_GENERATION, BUNDLES_PROJECTIONS, CHECKOUT_COMPLETION

   web/src/stores/brand-store.js
   - State: brands (list), currentBrand, isLoading
   - Actions: fetchBrands, fetchBrand, createBrand, updateBrand, deleteBrand

   web/src/stores/ui-store.js
   - State: sidebarOpen, theme, toasts, modals
   - Actions: toggleSidebar, addToast, removeToast, openModal, closeModal

6. TANSTACK QUERY:
   web/src/lib/query-client.js
   - QueryClient with defaults: staleTime 5min, retry 2, refetchOnWindowFocus false
   - Query key factory: queryKeys.brands.all(), queryKeys.brands.detail(id), etc.

   web/src/hooks/use-brands.js
   - useBrands() -- list brands query
   - useBrand(id) -- single brand query
   - useCreateBrand() -- mutation
   - useUpdateBrand() -- mutation with optimistic update

   web/src/hooks/use-products.js
   - useProducts(category?) -- product catalog query
   - useProduct(id) -- single product query

7. ROUTING:
   web/src/routes/index.jsx
   - React Router 7 with lazy-loaded routes:
     - / -> redirect to /dashboard or /auth/login
     - /auth/login, /auth/signup, /auth/callback -- public routes
     - /wizard/:step -- wizard routes (authenticated, WizardShell layout)
     - /dashboard -- brand list (authenticated, DashboardShell layout)
     - /dashboard/brands/:id -- brand detail
     - /admin/* -- admin routes (admin role required)
   - Route guards: ProtectedRoute (requires auth), AdminRoute (requires admin role)
   - 404 catch-all route

8. LAYOUT COMPONENTS:
   web/src/components/layout/AppShell.jsx -- top-level shell with AuthProvider context
   web/src/components/layout/DashboardShell.jsx -- sidebar + header + main area
   web/src/components/layout/WizardShell.jsx -- progress bar + step content + navigation
   web/src/components/layout/AdminShell.jsx -- admin sidebar + header
   web/src/components/layout/Header.jsx -- logo, user avatar, dropdown menu
   web/src/components/layout/Sidebar.jsx -- nav links, brand list, user info

9. DESIGN SYSTEM:
   web/src/styles/global.css -- Tailwind 4 with @theme tokens (EXACT code from doc Section 1.3)
   web/src/styles/design-tokens.css -- CSS custom properties for colors, spacing, fonts, radii, shadows
   web/src/styles/animations.css -- Keyframe animations for: fadeIn, slideUp, slideDown, scaleIn, spin, pulse

   web/src/components/ui/ -- Radix-based primitives:
   - Button.jsx (variants: primary, secondary, ghost, destructive; sizes: sm, md, lg)
   - Input.jsx (with label, error message, helper text)
   - Card.jsx (with header, body, footer slots)
   - Badge.jsx (variants: default, success, warning, error, info)
   - Progress.jsx (Radix progress with percentage label)
   - Toast.jsx (Radix toast with success/error/warning/info variants)
   - Dialog.jsx (Radix dialog with title, description, actions)
   - Spinner.jsx (loading spinner with size variants)
   - Avatar.jsx (Radix avatar with fallback initials)

10. AUTH PAGES (minimal functional versions):
    web/src/routes/auth/Login.jsx -- email/password form + Google OAuth button
    web/src/routes/auth/Signup.jsx -- email/password/name form + Google OAuth
    web/src/routes/auth/Callback.jsx -- OAuth callback handler (from 08-AUTH-SECURITY.md)

PATTERNS:
- All components use JSX (not TSX -- this is a JSDoc-typed JS project)
- Tailwind 4 utility classes for all styling (no CSS modules, no styled-components)
- Radix UI for all interactive primitives (dialog, dropdown, toast, etc.)
- motion (Framer Motion) for page transitions and micro-interactions
- clsx for conditional class names
- React Hook Form + Zod for all forms

VERIFICATION:
1. npm run dev (from web/) starts Vite dev server on port 5173
2. http://localhost:5173 shows login page
3. Login form validates with Zod (email required, password min 8 chars)
4. After login, redirect to /dashboard with DashboardShell layout
5. /wizard/welcome renders with WizardShell layout and progress bar
6. Design tokens render correctly (brand colors, fonts, spacing)
7. Toast notifications work: click a button -> toast appears
8. Socket.io connects when authenticated (check browser devtools)
```

---

## 10. Wizard Steps

```
You are building all 12 wizard steps for the Brand Me Now v2 brand creation wizard. Each step is a React component with its own form, API calls, Socket.io listeners, and navigation logic.

READ THESE DOCS:
- docs/prd/09-FRONTEND-APP.md -- Wizard section (all step specifications)
- docs/prd/01-PRODUCT-REQUIREMENTS.md -- User stories US-001 through US-062

PREREQUISITES: The frontend app shell (routing, stores, layout, design system) must already be built.

BUILD ALL 12 WIZARD STEPS:

STEP 1 -- Welcome (web/src/routes/wizard/Welcome.jsx):
- Hero section with brand logo, tagline: "Go from social media to branded product line in minutes"
- "Get Started" button -> navigates to step 2
- If returning user: show "Resume Your Brand" button with HMAC resume token
- Animation: fade-in with staggered text reveal

STEP 2 -- Phone & Terms (web/src/routes/wizard/PhoneTerm.jsx):
- Phone number input with formatting (react-hook-form + Zod validation)
- Terms & Conditions checkbox with link to full terms
- On submit: PATCH /api/v1/users/profile { phone, tc_accepted_at: new Date() }
- Queue GHL contact creation (non-blocking, fire-and-forget via API)

STEP 3 -- Social Input (web/src/routes/wizard/SocialInput.jsx):
- Input fields for: Instagram handle, TikTok handle, Facebook page
- At least one handle required (Zod union validation)
- Handle format validation (strip @, validate characters)
- "Analyze My Brand" button -> POST /api/v1/wizard/:brandId/step { step: 'social-analysis', handles }
- Navigate to step 4

STEP 4 -- Social Analysis with Progress (web/src/routes/wizard/SocialAnalysis.jsx):
- Real-time progress bar using useJobProgress(jobId) hook
- Status messages: "Scraping Instagram...", "Analyzing aesthetic...", "Generating brand DNA..."
- Animated progress bar with percentage (0-100%)
- On complete: display analysis results in cards (themes, colors, audience, engagement)
- Error state: retry button, manual entry fallback
- Auto-advance to step 5 on completion

STEP 5 -- Brand Review (web/src/routes/wizard/BrandReview.jsx):
- Display AI-generated brand identity: vision, values, archetype, target audience
- Editable fields for all identity components (inline editing with save)
- "Looks Great" button -> save edits and advance
- "Regenerate" button -> re-run brand-generator skill

STEP 6 -- Customization (web/src/routes/wizard/Customization.jsx):
- Color palette editor:
  - Display AI-suggested colors (4-6 swatches)
  - Click swatch -> react-colorful color picker
  - Add/remove colors
  - Color role labels (primary, secondary, accent, neutral)
- Font selector:
  - Display AI-suggested font pairings (3 options)
  - Live font preview using Google Fonts API (@import URL)
  - Select primary, secondary, body fonts
- Logo style selector:
  - 5 style cards: minimal, bold, vintage, modern, playful
  - Visual examples for each style
  - Single selection (radio group)
- Save all customizations to brand via PATCH /api/v1/brands/:id

STEP 7 -- Logo Generation with Progress (web/src/routes/wizard/LogoGeneration.jsx):
- Credit check display: "You have X logo credits remaining"
- "Generate Logos" button -> POST /api/v1/generation/logos { brandId, style, count: 4 }
- Real-time progress grid:
  - 4 placeholder cards (skeleton loading)
  - Each card fills in as its logo completes
  - Progress bar per logo AND overall progress
  - Status: "Composing prompt...", "Generating 1/4...", "Generating 2/4...", "Uploading...", "Complete!"
- motion animations for each logo reveal (scale-in with spring)
- If generation fails: error message + retry button

STEP 8 -- Logo Selection (web/src/routes/wizard/LogoSelection.jsx):
- Display 4 generated logos in a grid
- Click to select (radio behavior -- one selected at a time)
- Selected logo: glowing border, checkmark overlay
- "Refine" button per logo -> modal with modification instructions -> regenerate that logo
- "Regenerate All" button (costs 1 generation round of credits)
- "Use This Logo" button -> PATCH brand_assets.is_selected = true -> advance

STEP 9 -- Product Selection (web/src/routes/wizard/ProductSelection.jsx):
- Product catalog grid from useProducts() query
- Category tabs: Apparel, Accessories, Home Goods, Packaging, Digital
- Product cards with: image, name, base cost, suggested retail, margin
- Checkbox selection (multi-select)
- Selected products badge count
- "Generate Mockups" button -> advance to step 10
- Credit check: "You have X mockup credits. You selected Y products."

STEP 10 -- Mockup Generation with Progress (web/src/routes/wizard/MockupGeneration.jsx):
- Grid of selected products, each with progress indicator
- POST /api/v1/generation/mockups { brandId, productIds, logoUrl }
- Per-product progress via Socket.io (each product is a separate job)
- Products fill in as mockups complete (masonry grid animation)
- Approve/reject per mockup (checkmark / X overlay)
- Rejected mockups: "Regenerate" button -> re-queue that product

STEP 11 -- Bundles & Projections (web/src/routes/wizard/BundlesProjections.jsx):
- Two sections: Bundle Builder + Profit Projections
- Bundle Builder:
  - Drag-and-drop product cards into bundle slots
  - Name each bundle (inline text input)
  - Bundle composition image generated (Gemini 3 Pro Image) with progress
  - Up to 3 bundles
- Profit Projections:
  - Table: Product | Cost | Retail | Margin | Monthly Revenue (3 tiers)
  - recharts bar chart for visual revenue projections
  - Interactive retail price sliders (react-colorful style) -> real-time margin recalculation

STEP 12 -- Checkout & Completion (web/src/routes/wizard/CheckoutCompletion.jsx):
- Subscription tier selection (4 cards: Free Trial, Starter $29, Pro $79, Agency $199)
- Feature comparison table
- "Subscribe" button -> POST /api/v1/billing/checkout-session -> redirect to Stripe Checkout
- After Stripe redirect: celebration screen
  - Confetti animation (motion + canvas)
  - Brand summary card: name, logo, colors, fonts, product count, bundle count
  - "View Dashboard" button
  - "Share" button (copy link, social share)
- Confirmation email sent (automated via Stripe webhook + email-send worker)

SHARED WIZARD COMPONENTS:
web/src/components/wizard/WizardProgress.jsx -- step indicator bar (numbered circles with labels)
web/src/components/wizard/WizardNav.jsx -- back/next buttons with step validation
web/src/components/wizard/GenerationProgress.jsx -- reusable progress bar with Socket.io integration
web/src/components/wizard/ProductCard.jsx -- product display card with selection state
web/src/components/wizard/LogoCard.jsx -- logo display card with selection/refine
web/src/components/wizard/MockupCard.jsx -- mockup display with approve/reject

NAVIGATION RULES:
- Users can go back to any previous step
- Users cannot skip ahead (steps must be completed in order)
- Wizard state persisted in wizardStore (Zustand) AND database (via API)
- Browser back button works correctly (React Router integration)
- Page refresh resumes at current step (state loaded from API)

VERIFICATION:
1. Navigate through all 12 steps in order (happy path)
2. Social analysis shows real-time progress bar
3. Logo generation shows 4 logos appearing one by one
4. Product selection allows multi-select with category filtering
5. Mockup generation shows per-product progress
6. Bundle builder allows drag-and-drop
7. Checkout redirects to Stripe
8. Celebration screen shows brand summary with confetti
9. Wizard state survives page refresh
10. Back button works on every step
```

---

## 11. Payments & Billing

```
You are implementing the complete Stripe payments and billing system for Brand Me Now v2.

READ THIS DOC COMPLETELY:
- docs/prd/10-PAYMENTS-BILLING.md

BUILD THESE COMPONENTS:

1. STRIPE SERVICE:
   server/src/services/stripe.js
   - Stripe SDK initialization with pinned API version
   - Max network retries: 2, timeout: 10s

2. STRIPE PRODUCT/PRICE SETUP SCRIPT:
   server/scripts/stripe-setup.js
   - Creates Stripe products and prices programmatically (or documents manual setup)
   - Products: Starter ($29/mo), Pro ($79/mo), Agency ($199/mo)
   - Each product: name, description, metadata (tier name, credit allocations)
   - Each price: unit_amount in cents, currency USD, recurring monthly
   - Output: product and price IDs to paste into .env

3. CHECKOUT FLOW:
   server/src/routes/billing.js
   - POST /api/v1/billing/checkout-session
     - Auth required
     - Input: { tier: 'starter'|'pro'|'agency' }
     - Create or retrieve Stripe Customer (stripe.customers.create/retrieve)
     - Store stripe_customer_id in profiles table
     - Create Checkout Session with: line_items (price), success_url, cancel_url, client_reference_id (userId), customer
     - Return { checkoutUrl }
   - POST /api/v1/billing/portal-session
     - Auth required
     - Create Stripe Customer Portal session
     - Return { portalUrl }
   - GET /api/v1/billing/subscription
     - Auth required
     - Return current subscription status, tier, credits remaining, next billing date

4. WEBHOOK HANDLER:
   server/src/routes/webhooks.js (Stripe section):
   - POST /api/v1/webhooks/stripe
   - Uses express.raw() middleware for raw body (Stripe signature verification requires it)
   - Verify signature: stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)
   - Idempotency: check webhook_events table for duplicate event ID
   - Queue BullMQ job: queue 'stripe-webhook' with { eventType, eventData, stripeEventId }
   - Return 200 immediately (< 100ms)

5. STRIPE WEBHOOK WORKER (complete the stub from BullMQ prompt):
   server/src/workers/stripe-webhook.worker.js
   - Handle these Stripe events:
     - checkout.session.completed:
       -> Create subscription record in subscriptions table
       -> Update profiles.subscription_tier
       -> Allocate credits via refill_generation_credits()
       -> Send welcome email via email-send queue
       -> Sync to GHL via crm-sync queue
     - customer.subscription.updated:
       -> Update subscription status and tier
       -> If upgraded: allocate new tier credits immediately
       -> If downgraded: adjust credits at next billing cycle
     - customer.subscription.deleted:
       -> Update subscription status to 'canceled'
       -> Downgrade profile to 'free' tier
       -> Send cancellation email
     - invoice.payment_succeeded:
       -> Refill monthly credits via refill_generation_credits()
       -> Update current_period_start/end
     - invoice.payment_failed:
       -> Send payment failed email
       -> Update subscription status to 'past_due'
       -> Start 7-day grace period

6. CREDIT SYSTEM:
   server/src/services/credits.js
   - checkCredits(userId, creditType, amount) -- calls Supabase RPC
   - deductCredits(userId, creditType, amount) -- calls Supabase RPC with row locking
   - refillCredits(userId, tier) -- calls Supabase RPC
   - getCreditsBalance(userId) -- returns all credit types with remaining/used
   - Overage handling: block by default, allow if user enables in settings

7. FRONTEND COMPONENTS:
   web/src/routes/billing/Pricing.jsx -- tier comparison cards
   web/src/routes/billing/Subscription.jsx -- current plan, usage, manage button
   web/src/components/billing/CreditBalance.jsx -- credit usage bars
   web/src/components/billing/UpgradePrompt.jsx -- shown when credits exhausted

PATTERNS:
- Stripe is source of truth for subscriptions. Our DB is a cache synced via webhooks.
- Webhook handler returns 200 IMMEDIATELY. Processing happens in BullMQ worker.
- Every webhook event is idempotent (checked against webhook_events table).
- Credits are checked BEFORE queuing generation jobs (not inside the worker).

VERIFICATION:
1. POST /api/v1/billing/checkout-session returns a valid Stripe Checkout URL
2. Complete Stripe Checkout (test mode) -> webhook fires -> subscription created
3. Credits allocated based on tier (Starter: 20 logos, 30 mockups)
4. Monthly invoice paid -> credits refilled
5. Subscription canceled -> tier downgraded to free
6. Credit check blocks generation when credits = 0
7. Billing portal accessible for subscription management
```

---

## 12. Integrations

```
You are implementing all third-party integrations for Brand Me Now v2: GoHighLevel CRM, Resend email, and Apify social scraping.

READ THIS DOC COMPLETELY:
- docs/prd/11-INTEGRATIONS.md

ALL integrations are event-driven via BullMQ. No integration call ever blocks the user flow.

BUILD THESE COMPONENTS:

1. GOHIGHLEVEL CRM:

   server/src/services/ghl.js -- GHL OAuth client:
   - Token storage in Redis (key: 'ghl:tokens', encrypted)
   - Automatic token refresh (5 min before expiry)
   - refreshTokens() -- POST to /oauth/token with grant_type=refresh_token
   - apiCall(method, path, data) -- makes authenticated API call with auto-refresh on 401
   - upsertContact(contactData) -- create or update contact by email
   - addContactTags(contactId, tags) -- add tags to contact
   - updateCustomFields(contactId, fields) -- update custom field values

   server/src/workers/crm-sync.worker.js (complete the stub):
   - Job data: { userId, action, contactData, tags, customFields }
   - Actions:
     - 'contact.upsert' -- upsert contact with email, name, phone
     - 'contact.tag' -- add wizard event tags (wizard-started, brand-completed, subscriber)
     - 'contact.update_fields' -- update custom fields (brand_name, brand_status, wizard_step)
   - NEVER send passwords or credentials to GHL
   - On 401: refresh token and retry
   - Dead-letter after 3 failed attempts -> Sentry alert

   server/config/crm-fields.yaml -- field mappings (from doc, with env var interpolation)

2. RESEND EMAIL:

   server/src/services/resend.js -- Resend SDK client:
   - Initialize with RESEND_API_KEY
   - sendEmail({ to, subject, template, data }) -- render template and send

   server/src/emails/ -- React Email templates (7 templates):
   - welcome.jsx -- Welcome to Brand Me Now (after signup)
   - brand-complete.jsx -- Your Brand is Ready! (after wizard completion, includes logo, brand summary)
   - wizard-abandoned.jsx -- Continue Building Your Brand (sent 24h after wizard abandonment)
   - support-ticket.jsx -- Support Request Received (sent to user + support team)
   - invoice-paid.jsx -- Payment Received (monthly invoice confirmation)
   - credits-exhausted.jsx -- Credits Used Up (upgrade prompt)
   - subscription-change.jsx -- Subscription Updated (upgrade/downgrade/cancel)

   Each template: React Email components, responsive design, Brand Me Now branding, unsubscribe link.

   server/src/workers/email-send.worker.js (complete the stub):
   - Job data: { template, to, subject, templateData }
   - Render React Email template to HTML
   - Send via Resend API
   - Rate limit: max 10 emails/second
   - Retry: 3 attempts with exponential backoff

3. APIFY SOCIAL SCRAPING:

   server/src/services/apify.js -- Apify SDK client:
   - Initialize with APIFY_API_TOKEN
   - scrapeInstagram(handle) -- run Instagram scraper actor, return profile + posts
   - scrapeTikTok(handle) -- run TikTok scraper actor, return profile + videos
   - scrapeFacebook(handle) -- run Facebook scraper actor, return page + posts

   server/src/workers/social-scraping.worker.js (complete the stub):
   - Job data: { brandId, userId, platform, handle }
   - Call appropriate Apify scraper
   - Parse results into unified SocialProfile schema
   - Save raw data to brands.social_data
   - Handle: private profiles, blocked profiles, non-existent handles
   - Fallback: if scraping fails, return empty data (wizard offers manual entry)

   Unified SocialProfile schema:
   {
     platform: 'instagram'|'tiktok'|'facebook',
     handle: string,
     bio: string,
     followers: number,
     following: number,
     posts: [{ url, imageUrl, caption, likes, comments, date }],
     profileImage: string,
     isPrivate: boolean,
     scrapedAt: ISO timestamp
   }

4. INTEGRATION HEALTH CHECKS:
   server/src/routes/health.js (update):
   - Add GHL token validity check
   - Add Resend API key validation
   - Add Apify token validation

VERIFICATION:
1. GHL: contact upserted in GHL after wizard start (check GHL dashboard)
2. GHL: OAuth token refreshes automatically when expired
3. Resend: welcome email sent after signup (check Resend dashboard)
4. Resend: all 7 templates render correctly (preview with React Email CLI)
5. Apify: Instagram scrape returns profile data (use test handle)
6. All integrations non-blocking: API endpoints return in < 50ms even if integration is slow
7. Dead-letter queue: failed GHL sync -> job in dead-letter -> Sentry alert
```

---

## 13. Deployment & Infrastructure

```
You are creating the complete deployment infrastructure for Brand Me Now v2 on DigitalOcean.

READ THIS DOC COMPLETELY:
- docs/prd/13-DEPLOYMENT-INFRA.md

BUILD THESE FILES:

1. DOCKERFILES:
   server/Dockerfile -- Multi-stage build from doc (node:22-alpine, dumb-init, non-root user, health check)
   web/Dockerfile -- Multi-stage: build with Vite, serve with nginx:alpine
   marketing/Dockerfile -- Next.js 15 standalone build (if not using Vercel)

2. DOCKER COMPOSE (Local Development):
   docker-compose.yml (root):
   - server: Express API (port 3000), hot reload via volume mount
   - web: Vite dev server (port 5173), hot reload
   - redis: Redis 7 Alpine (port 6379) with data persistence volume
   - redis-commander: Redis GUI (port 8081, debug profile only)
   - All services share a 'bmn-network' bridge network
   - .env file loaded for all services
   - Health checks on redis

3. DOCKER COMPOSE (Production):
   docker-compose.prod.yml:
   - server: production image from DO registry, replicas: 2
   - worker: same image, different CMD (node src/workers/index.js)
   - redis: Redis 7 with AOF persistence, password, maxmemory 512mb
   - nginx: reverse proxy with SSL termination (certbot/Let's Encrypt)
   - All images tagged with git SHA

4. KUBERNETES MANIFESTS (DigitalOcean K8s):
   k8s/namespace.yaml -- 'brandmenow' namespace
   k8s/server-deployment.yaml -- Express API: 2 replicas, resource limits (256Mi/500m), readiness/liveness probes, env from configmap+secrets
   k8s/server-service.yaml -- ClusterIP service on port 3000
   k8s/worker-deployment.yaml -- BullMQ workers: 2 replicas, separate deployment
   k8s/web-deployment.yaml -- Vite static build served by nginx: 1 replica
   k8s/web-service.yaml -- ClusterIP service on port 80
   k8s/ingress.yaml -- nginx ingress controller with:
     - api.brandmenow.com -> server service
     - app.brandmenow.com -> web service
     - SSL via cert-manager (Let's Encrypt)
   k8s/configmap.yaml -- non-secret env vars (NODE_ENV, PORT, API_URL, APP_URL, LOG_LEVEL)
   k8s/secrets.yaml -- template for secrets (SUPABASE keys, API keys, Stripe keys -- actual values NOT committed)
   k8s/redis-statefulset.yaml -- Redis with persistent volume claim
   k8s/hpa.yaml -- Horizontal Pod Autoscaler: min 2, max 8, target CPU 70%

5. GITHUB ACTIONS CI/CD:
   .github/workflows/ci.yml:
   - Trigger: push to main, PRs to main
   - Jobs:
     a. lint -- ESLint + Prettier check
     b. test-server -- Vitest unit + integration (needs Redis service)
     c. test-web -- Vitest component tests
     d. build -- Docker build for server + web (verify images build)

   .github/workflows/deploy.yml:
   - Trigger: push to main (after CI passes)
   - Jobs:
     a. build-and-push:
       - Build Docker images tagged with git SHA + 'latest'
       - Push to DigitalOcean Container Registry (registry.digitalocean.com/brandmenow)
     b. deploy:
       - Install doctl + kubectl
       - Connect to DO K8s cluster
       - Update image tags in deployments
       - kubectl rollout status (wait for success)
       - Slack notification on success/failure

6. ENVIRONMENT FILES:
   .env.example -- complete list of all env vars with descriptions
   .env.production.example -- production-specific overrides
   server/.env.example -- server-specific vars

7. DOCKER IGNORE FILES:
   server/.dockerignore -- node_modules, .env, .git, docs, coverage, tests
   web/.dockerignore -- node_modules, .env, .git, dist

8. NGINX CONFIG (for web static serving):
   web/nginx.conf -- serve /usr/share/nginx/html, SPA fallback (try_files $uri /index.html), gzip, cache headers for static assets

VERIFICATION:
1. docker compose up --build starts all services locally
2. Server accessible at localhost:3000/health
3. Web accessible at localhost:5173
4. Redis accessible at localhost:6379
5. Docker images build successfully: docker build -t bmn-server ./server
6. K8s manifests are valid: kubectl apply --dry-run=client -f k8s/
7. GitHub Actions workflow syntax is valid (act --list or manual check)
```

---

## 14. Testing

```
You are writing the complete test suite for Brand Me Now v2 covering unit tests, integration tests, component tests, E2E tests, and load tests.

READ THIS DOC COMPLETELY:
- docs/prd/14-TESTING.md

BUILD THESE FILES:

1. TEST CONFIGURATION:

   server/vitest.config.js:
   - Test environment: 'node'
   - Include: 'src/**/*.test.js'
   - Coverage provider: v8, thresholds: lines 80%, branches 75%
   - Setup files: 'src/test/setup.js'
   - Test timeout: 10s

   web/vitest.config.js:
   - Test environment: 'jsdom'
   - Include: 'src/**/*.test.{js,jsx}'
   - Coverage provider: v8, thresholds: lines 75%, branches 70%
   - Setup files: 'src/test/setup.js'

   server/src/test/setup.js:
   - Load dotenv for test env vars
   - Mock Redis connection
   - Mock Supabase client
   - Global test helpers: createMockRequest(), createMockResponse(), createMockUser()

   web/src/test/setup.js:
   - Import @testing-library/jest-dom matchers
   - Mock window.matchMedia
   - MSW server setup (beforeAll/afterEach/afterAll)

2. SERVER UNIT TESTS:

   server/src/middleware/auth.test.js:
   - Test: missing Authorization header -> 401
   - Test: malformed Bearer token -> 401
   - Test: expired token -> 401
   - Test: valid token -> req.user set, next() called
   - Test: webhook route bypasses auth

   server/src/middleware/rate-limit.test.js:
   - Test: requests under limit -> 200
   - Test: requests over limit -> 429 with Retry-After header
   - Test: different users have separate limits

   server/src/middleware/validate.test.js:
   - Test: valid body -> next() called, req.body transformed
   - Test: invalid body -> 400 with field-level errors
   - Test: valid query + invalid body -> 400

   server/src/lib/errors.test.js:
   - Test: AppError has statusCode, code, message
   - Test: ValidationError defaults to 400
   - Test: NotFoundError defaults to 404

   server/src/lib/resume-token.test.js:
   - Test: generate + validate round-trip
   - Test: expired token -> throws
   - Test: tampered token -> throws

   server/src/services/credits.test.js:
   - Test: checkCredits with sufficient credits -> { has_credits: true }
   - Test: checkCredits with zero credits -> { has_credits: false }
   - Test: deductCredits decrements remaining, increments used

3. SERVER INTEGRATION TESTS:

   server/src/routes/brands.integration.test.js:
   - Test: GET /api/v1/brands -> 200 with brand list (authenticated)
   - Test: GET /api/v1/brands -> 401 (unauthenticated)
   - Test: POST /api/v1/brands with valid data -> 201 with brand
   - Test: POST /api/v1/brands over limit -> 409
   - Test: PATCH /api/v1/brands/:id -> 200 with updated brand
   - Test: DELETE /api/v1/brands/:id -> 200

   server/src/routes/health.integration.test.js:
   - Test: GET /health -> 200 with checks
   - Test: GET /ready -> 200 when all services up

   server/src/workers/stripe-webhook.integration.test.js:
   - Test: checkout.session.completed -> subscription created + credits allocated
   - Test: invoice.payment_succeeded -> credits refilled
   - Test: customer.subscription.deleted -> downgraded to free

   Use supertest for HTTP tests. Mock Supabase and Redis where needed.

4. CLIENT COMPONENT TESTS:

   web/src/components/ui/Button.test.jsx:
   - Test: renders with text, handles click, shows loading state

   web/src/routes/wizard/Welcome.test.jsx:
   - Test: renders welcome message and CTA button
   - Test: "Get Started" navigates to step 2

   web/src/routes/wizard/SocialInput.test.jsx:
   - Test: requires at least one social handle
   - Test: validates handle format
   - Test: submit calls API with correct data

   web/src/routes/wizard/LogoGeneration.test.jsx:
   - Test: shows credit balance
   - Test: "Generate" button triggers API call
   - Test: progress bar updates from Socket.io events
   - Test: logos appear as they complete

   web/src/routes/wizard/ProductSelection.test.jsx:
   - Test: renders product grid
   - Test: category tabs filter products
   - Test: multi-select works
   - Test: selected count badge updates

   web/src/stores/wizard-store.test.js:
   - Test: setStep updates currentStep
   - Test: updateBrandData merges new data
   - Test: addProduct / removeProduct toggles selection
   - Test: reset clears all state

5. MSW MOCK HANDLERS:

   web/src/test/mocks/handlers.js:
   - GET /api/v1/brands -> mock brand list
   - POST /api/v1/brands -> mock brand creation
   - GET /api/v1/products -> mock product catalog
   - POST /api/v1/wizard/:brandId/step -> mock step progression
   - POST /api/v1/generation/logos -> mock job creation
   - GET /api/v1/billing/subscription -> mock subscription

   web/src/test/mocks/server.js:
   - setupServer(...handlers) from MSW

   web/src/test/mocks/data.js:
   - Factory functions: mockBrand(), mockProduct(), mockUser(), mockGenerationJob()

6. PLAYWRIGHT E2E TESTS:

   e2e/playwright.config.js:
   - Base URL: http://localhost:5173
   - Projects: chromium only (for speed)
   - Web server: start both server and web before tests
   - Timeout: 30s per test

   e2e/tests/auth.spec.js:
   - Test: signup flow (email/password)
   - Test: login flow
   - Test: redirect to wizard after first login
   - Test: redirect to dashboard after subsequent login

   e2e/tests/wizard-flow.spec.js:
   - Test: complete wizard happy path (steps 1-12)
   - Test: wizard state persists on page refresh
   - Test: back button navigates to previous step
   - Test: social analysis shows progress bar

   e2e/tests/dashboard.spec.js:
   - Test: brand list displays after login
   - Test: click brand -> brand detail page
   - Test: "New Brand" button starts wizard

7. K6 LOAD TESTS:

   k6/api-load.js:
   - Scenario: 100 virtual users for 5 minutes
   - Endpoints: GET /health, GET /api/v1/brands, POST /api/v1/brands
   - Thresholds: p95 < 200ms, error rate < 1%

   k6/websocket-load.js:
   - Scenario: 200 concurrent WebSocket connections
   - Each connection: join a room, listen for events
   - Threshold: connection time < 500ms

VERIFICATION:
1. npm test (from root) runs all unit + component tests
2. Coverage report shows >= 80% lines for server
3. Integration tests pass with Redis running
4. Playwright E2E completes wizard happy path
5. k6 load test shows p95 < 200ms for API endpoints
```

---

## 15. Marketing Site

```
You are building the marketing site for Brand Me Now v2 using Next.js 15.

READ THIS DOC COMPLETELY:
- docs/prd/15-MARKETING-SITE.md

BUILD:
1. Next.js 15 project in marketing/ workspace with App Router
2. Pages: Home (/), Pricing (/pricing), Features (/features), About (/about), Blog (/blog)
3. Home page: hero with CTA, feature highlights, testimonials, pricing summary
4. Pricing page: 4-tier pricing table matching PRD subscription tiers
5. Tailwind CSS 4 with brand design tokens matching the web app
6. SEO: metadata, Open Graph tags, structured data (JSON-LD)
7. Responsive design: mobile-first
8. Performance: static generation (SSG) for all pages, image optimization
9. CTA buttons link to app.brandmenow.com/auth/signup

VERIFICATION:
1. npm run dev starts Next.js on port 3001
2. All pages render without errors
3. Lighthouse score > 90 for performance, accessibility, SEO
4. CTA buttons link correctly to the app
```

---

## 16. Data Migration

```
You are building the data migration tooling to move existing Brand Me Now v1 data to the v2 schema.

READ THIS DOC COMPLETELY:
- docs/prd/16-MIGRATION-GUIDE.md

Also reference for current schema:
- docs/03-DATABASE-SCHEMA.md (current v1 schema in Supabase + NocoDB)

BUILD:
1. Migration script: server/scripts/migrate-v1-data.js
   - Connect to both old Supabase instance and new Supabase instance
   - Migrate users: old profiles -> new profiles table
   - Migrate brands: old brand data -> new brands table (map old columns to new)
   - Migrate assets: download from old storage, re-upload to new storage buckets
   - Migrate products: old product catalog -> new products table
   - Handle data format differences (old JSONB structures -> new schema)

2. Validation script: server/scripts/validate-migration.js
   - Count records in old vs new
   - Verify referential integrity
   - Spot-check random records

3. Rollback script: server/scripts/rollback-migration.js
   - Truncate new tables (preserving schema)
   - Re-run migration if needed

4. Migration README: docs/prd/migration-runbook.md
   - Step-by-step runbook for the migration
   - Pre-migration checklist
   - Post-migration validation
   - Rollback procedure

VERIFICATION:
1. Migration script runs without errors against test data
2. Record counts match between old and new
3. Random spot checks pass
4. Rollback script cleanly resets new tables
```

---

## Quick Reference: Environment Variables

All prompts reference env vars. Here is the complete list for copy-pasting into `.env`:

```bash
# === App Config ===
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000
APP_URL=http://localhost:5173
MARKETING_URL=http://localhost:3001
LOG_LEVEL=debug

# === Supabase ===
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# === Redis ===
REDIS_URL=redis://localhost:6379

# === AI Providers ===
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_API_KEY=
BFL_API_KEY=
IDEOGRAM_API_KEY=

# === Payments ===
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# === CRM ===
GHL_CLIENT_ID=
GHL_CLIENT_SECRET=
GHL_LOCATION_ID=

# === Email ===
RESEND_API_KEY=
FROM_EMAIL=hello@brandmenow.com
SUPPORT_EMAIL=support@brandmenow.com

# === Scraping ===
APIFY_API_TOKEN=

# === Observability ===
SENTRY_DSN=
POSTHOG_API_KEY=
POSTHOG_HOST=https://app.posthog.com

# === Security ===
RESUME_TOKEN_SECRET=
CORS_ORIGINS=http://localhost:5173,http://localhost:3001
```

---

## Tips for Claude Code Sessions

1. **One prompt per session.** Each prompt is designed for a fresh Claude Code session. Do not combine prompts.

2. **Read the docs first.** Every prompt starts with "READ THIS DOC COMPLETELY." The agent must read the referenced PRD doc before writing any code.

3. **Follow the build order.** Dependencies matter. Do not build the Agent System before the Server Core and BullMQ are done.

4. **Verify before moving on.** Each prompt ends with VERIFICATION steps. Run them before starting the next prompt.

5. **Commit after each prompt.** After verification passes, commit the work: `git add -A && git commit -m "feat: [component name]"`.

6. **Use stubs where noted.** Some prompts explicitly say to stub external API calls. Real implementations are filled in by later prompts.

7. **Keep the .env updated.** As you build each component, add any new env vars to .env and .env.example.
