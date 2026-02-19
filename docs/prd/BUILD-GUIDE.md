# Brand Me Now v2 -- Build Orchestration Guide

**Created:** February 19, 2026
**Purpose:** Step-by-step cookbook of Claude Code prompts to build every component
**Usage:** Execute each step in order. Copy-paste the prompt into Claude Code. Verify before moving on.

---

## How to Use This Guide

1. **Read the prompt** for each step
2. **Copy-paste it** into a new Claude Code session (or continue an existing one)
3. **Wait for completion** -- each prompt is self-contained
4. **Run the verification commands** before moving to the next step
5. **Do not skip steps** -- each step depends on previous ones being complete

### Conventions

- All prompts reference PRD docs in `docs/prd/` -- these must be accessible in the working directory
- `Verify:` sections contain exact commands to run
- `Depends on:` lists which steps must be completed first
- Time estimates are for a single developer with Claude Code

---

## Pre-Flight Checklist

Before starting any build steps, ensure you have:

- [ ] Node.js 22 LTS installed (`node --version`)
- [ ] Docker Desktop running (`docker --version`)
- [ ] A new Supabase project created (see `docs/prd/07-DATABASE.md` Section 1)
- [ ] Redis running locally or via Docker (`redis-cli ping`)
- [ ] All API keys ready (Anthropic, OpenAI, Google, BFL, Ideogram, Stripe test keys, Apify, Resend, GHL, Sentry DSN, PostHog key)
- [ ] A fresh git repo initialized for the v2 project

---

## Phase 1: Foundation (Week 1)

### Step 1.1: Scaffold Project Structure

**What:** Create the monorepo directory structure, root package.json, and configuration files.
**PRD Reference:** `docs/prd/README.md` (tech stack), `docs/prd/03-SERVER-CORE.md` (Section 1.2 directory structure)
**Depends on:** Nothing (this is the first step)
**Estimated time:** 10 minutes

**Prompt:**
```
Read docs/prd/README.md and docs/prd/03-SERVER-CORE.md (Section 1 "Project Setup").

Create the Brand Me Now v2 project scaffold with the following structure:

brand-me-now-v2/
├── server/                    # Express.js 5 API server
│   ├── src/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── config/
│   │   ├── lib/
│   │   ├── sockets/
│   │   ├── agents/
│   │   ├── skills/
│   │   └── workers/
│   ├── package.json           # Copy exactly from 03-SERVER-CORE.md Section 1.1
│   ├── eslint.config.js       # Copy exactly from Section 1.3
│   ├── .prettierrc            # Copy exactly from Section 1.4
│   ├── jsdoc.config.json      # Copy exactly from Section 1.5
│   ├── Dockerfile             # Copy exactly from Section 1.6
│   ├── docker-compose.yml     # Copy exactly from Section 1.6
│   ├── .dockerignore          # Copy exactly from Section 1.6
│   ├── .env.example           # Copy exactly from Section 1.7
│   └── .gitignore
├── apps/
│   ├── web/                   # React 19 + Vite 7 SPA (created in Phase 5)
│   └── marketing/             # Next.js 15 marketing site (created in Phase 7)
├── packages/
│   └── config/
│       └── tailwind/          # Shared design tokens
├── services/
│   └── ai-worker/             # Python FastAPI image processing worker
├── infra/
│   └── redis/                 # Redis config
├── scripts/
│   └── migrate/               # Migration scripts (Phase 7)
├── docs/                      # Copy existing docs/ folder here
├── .github/
│   └── workflows/             # CI/CD (Phase 7)
├── .gitignore
└── .env.example               # Root-level env template

After creating the structure:
1. Copy the .env.example content from 03-SERVER-CORE.md into server/.env.example
2. Create server/.env from server/.env.example (copy and leave values empty for now)
3. Run `cd server && npm install` to install all dependencies
4. Verify npm install succeeds with zero errors

Do NOT create any source files yet (server.js, app.js, etc.) -- those come in Step 1.2.
```

**Verify:**
```bash
# Directory structure exists
ls server/src/middleware server/src/routes server/src/services server/src/config server/src/lib

# package.json is valid
cd server && node -e "require('./package.json')" && echo "OK"

# Dependencies installed
ls server/node_modules/express server/node_modules/bullmq server/node_modules/socket.io

# ESLint config loads
cd server && npx eslint --print-config src/server.js > /dev/null 2>&1 && echo "ESLint OK"
```

---

### Step 1.2: Server Core -- Express.js 5

**What:** Implement the complete Express.js 5 server with all middleware, routes, health checks, error handling, service clients, and utility libraries.
**PRD Reference:** `docs/prd/03-SERVER-CORE.md` (all sections)
**Depends on:** Step 1.1 (project scaffold + npm install)
**Estimated time:** 45-60 minutes

**Prompt:**
```
Read docs/prd/03-SERVER-CORE.md completely (all sections 1-9).

Implement the complete Express.js 5 server. Create every file listed in the File Manifest
(Section 7). Follow the code examples EXACTLY as written in the spec.

Create files in this order (respecting import dependencies):

1. server/src/config/validate-env.js -- Environment variable validation (crash on missing required vars). For development, only require: NODE_ENV, PORT. All others should warn but not crash.

2. server/src/lib/errors.js -- Custom error classes: AppError (extends Error with statusCode, code, details), ValidationError (400), NotFoundError (404), UnauthorizedError (401), ForbiddenError (403), ConflictError (409)

3. server/src/lib/response.js -- Standardized JSON response helpers: success(res, data, statusCode=200), created(res, data), noContent(res), paginated(res, data, pagination)

4. server/src/lib/yaml-loader.js -- YAML config loader with ${ENV_VAR} interpolation

5. server/src/middleware/helmet.js -- EXACTLY as shown in Section 3.1
6. server/src/middleware/cors.js -- EXACTLY as shown in Section 3.2
7. server/src/middleware/request-id.js -- EXACTLY as shown in Section 3.3
8. server/src/middleware/logger.js -- EXACTLY as shown in Section 3.4 (exports logger + httpLogger)

9. server/src/services/supabase.js -- Supabase admin client using SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Export supabaseAdmin.
10. server/src/services/redis.js -- ioredis connection with retry + event logging. Export redis instance + redisSub + bullRedisConfig + redisHealthCheck().

11. server/src/middleware/auth.js -- EXACTLY as shown in Section 3.5
12. server/src/middleware/tenant.js -- EXACTLY as shown in Section 3.6 (with TIER_LIMITS)
13. server/src/middleware/rate-limit.js -- EXACTLY as shown in Section 3.7 (3 limiters: general, generation, auth)
14. server/src/middleware/validate.js -- EXACTLY as shown in Section 3.8 (Zod validation factory)
15. server/src/middleware/error-handler.js -- EXACTLY as shown in Section 3.9 (errorHandler + notFoundHandler)

16. server/src/routes/health.js -- GET /health (liveness, always 200) + GET /ready (readiness, checks Redis + Supabase). No auth required.
17. server/src/routes/brands.js -- EXACTLY as shown in Section 4.3 (full CRUD with Zod validation, tenant scoping, OpenAPI annotations)
18. server/src/routes/wizard.js -- Stub router: GET /:brandId/state, POST /:brandId/step, POST /:brandId/resume
19. server/src/routes/generation.js -- Stub router: POST /logos, POST /mockups, POST /bundles, GET /jobs/:jobId
20. server/src/routes/products.js -- Stub router: GET / (list), GET /:id, POST / (admin), PATCH /:id (admin), DELETE /:id (admin)
21. server/src/routes/users.js -- Stub router: GET /me, PATCH /me, DELETE /me
22. server/src/routes/webhooks.js -- Stub router: POST /stripe, POST /ghl/callback

23. server/src/routes/index.js -- EXACTLY as shown in Section 4.1 (mountRoutes function)
24. server/src/services/queue.js -- BullMQ queue factory: export createQueue(name) function that returns a new Queue with bullRedisConfig defaults

25. server/src/sockets/index.js -- Socket.io setup: createSocketServer(httpServer). JWT auth in handshake middleware. Stub namespace handlers. Export createSocketServer.

26. server/src/app.js -- EXACTLY as shown in Section 2.2. Wire every middleware in the correct order. Include Swagger/OpenAPI setup for development.
27. server/src/server.js -- EXACTLY as shown in Section 2.1. HTTP server + Socket.io + graceful shutdown.
28. server/src/cluster.js -- EXACTLY as shown in Section 2.3.

29. server/src/config/rate-limits.yaml -- Rate limit config for all endpoints
30. server/src/config/models.yaml -- AI model routing config (model names, providers, cost per token)

IMPORTANT RULES:
- JavaScript only with JSDoc types. No TypeScript.
- ES modules (import/export), not CommonJS.
- Every file must have a JSDoc file-level comment explaining its purpose.
- For stub routes, create the router with documented route definitions but simple placeholder responses like: res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'Coming in Phase X' } })
- The validate-env.js should be lenient in development -- warn on missing optional vars, crash on missing critical vars (NODE_ENV, PORT only).
```

**Verify:**
```bash
# Server starts without crashing (will warn about missing env vars, that's OK)
cd server && NODE_ENV=development PORT=3000 node src/server.js &
SERVER_PID=$!
sleep 3

# Health check returns 200
curl -s http://localhost:3000/health | jq .

# Ready check shows dependency status
curl -s http://localhost:3000/ready | jq .

# 404 for unknown route returns structured JSON
curl -s http://localhost:3000/api/v1/nonexistent | jq .

# Protected route returns 401 without token
curl -s http://localhost:3000/api/v1/brands | jq .status

# Swagger docs accessible in development
curl -s http://localhost:3000/api/docs.json | jq .info.title

# Clean shutdown
kill $SERVER_PID
```

---

### Step 1.3: Database Schema & Migrations

**What:** Create all Supabase SQL migrations, RLS policies, functions, triggers, indexes, storage buckets, and seed data.
**PRD Reference:** `docs/prd/07-DATABASE.md` (all sections 1-12)
**Depends on:** Step 1.1 (project scaffold), Supabase project created
**Estimated time:** 30-45 minutes

**Prompt:**
```
Read docs/prd/07-DATABASE.md completely (all sections).

Create all database migration files in server/supabase/migrations/ (or a top-level supabase/migrations/ directory). Each migration should be a separate .sql file, numbered sequentially, matching the spec exactly.

Create these migration files in order:

1. 001_extensions.sql -- Enable uuid-ossp, pgcrypto, pg_trgm
2. 002_types.sql -- All custom ENUM types (subscription_tier, user_role, brand_status, asset_type, job_status, job_type, credit_type, subscription_status, product_category)
3. 003_profiles.sql -- profiles table with all columns, comments, RLS enabled
4. 004_brands.sql -- brands table with all columns, JSONB fields, comments, RLS enabled
5. 005_brand_assets.sql -- brand_assets table with CASCADE FK to brands
6. 006_generation_jobs.sql -- generation_jobs table with progress tracking
7. 007_products.sql -- products table (admin-managed catalog)
8. 008_brand_products.sql -- brand_products join table with unique constraint
9. 009_bundles.sql -- bundles table with JSONB product_ids
10. 010_subscriptions.sql -- Stripe subscription mirror table
11. 011_generation_credits.sql -- Per-user credit balances with unique constraint
12. 012_audit_log.sql -- Immutable audit trail (REVOKE UPDATE/DELETE)
13. 013_chatbot_conversations.sql -- AI chatbot conversation history
14. 014_rls_helpers.sql -- is_admin() helper function
15. 015_rls_profiles.sql through 025_rls_chatbot_conversations.sql -- All RLS policies (one file per table, exactly matching the spec)
16. 026_indexes.sql -- All performance indexes
17. 027_functions.sql -- handle_new_user() trigger, update_updated_at() trigger, check_generation_credits(), deduct_generation_credit(), refill_generation_credits()
18. 028_storage_buckets.sql -- Documentation of bucket configs (actual bucket creation is done via Supabase Dashboard)
19. 029_storage_policies.sql -- All storage RLS policies
20. 030_seed_data.sql -- Seed data for products table (5-10 sample products across categories: apparel, accessories, home_goods)

Also create:
- supabase/seed.sql -- Master seed file that calls 030_seed_data.sql
- scripts/run-migrations.sh -- Script that runs all migrations against a Supabase project using the Supabase CLI or psql

COPY every SQL statement EXACTLY as written in the PRD. Do not modify column types, constraints, or defaults.

For the seed data (030_seed_data.sql), create realistic products:
- T-Shirt (apparel): SKU APP-TSHIRT-001, base_cost $8.50, retail_price $29.99
- Hoodie (apparel): SKU APP-HOODIE-001, base_cost $15.00, retail_price $49.99
- Baseball Cap (accessories): SKU ACC-CAP-001, base_cost $6.00, retail_price $24.99
- Tote Bag (accessories): SKU ACC-TOTE-001, base_cost $4.50, retail_price $19.99
- Mug (home_goods): SKU HOM-MUG-001, base_cost $3.00, retail_price $16.99
- Phone Case (accessories): SKU ACC-PHONE-001, base_cost $5.00, retail_price $22.99
- Sticker Sheet (accessories): SKU ACC-STICKER-001, base_cost $1.50, retail_price $9.99
```

**Verify:**
```bash
# All migration files exist
ls supabase/migrations/*.sql | wc -l
# Should output: 30 (or close depending on file splits)

# SQL syntax is valid (basic check -- pipe through psql --single-transaction on a test DB)
# If you have Supabase CLI:
supabase db reset --linked
# OR run against Supabase SQL Editor manually

# After running migrations, verify tables exist:
# Run in Supabase SQL Editor:
# SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
# Expected: audit_log, brand_assets, brand_products, brands, bundles, chatbot_conversations,
#           generation_credits, generation_jobs, products, profiles, subscriptions

# Verify RLS is enabled on all tables:
# SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
# All should show rowsecurity = true

# Verify seed data:
# SELECT count(*) FROM products; -- Should return 7
```

---

### Step 1.4: Observability Layer

**What:** Integrate Sentry error tracking, PostHog server-side analytics, pino structured logging, health check endpoints, Bull Board admin UI, and AI cost tracking.
**PRD Reference:** `docs/prd/12-OBSERVABILITY.md` (all sections)
**Depends on:** Step 1.2 (Express server must exist)
**Estimated time:** 45-60 minutes

**Prompt:**
```
Read docs/prd/12-OBSERVABILITY.md completely.

The Express.js server from Step 1.2 already exists. Now integrate the full observability stack.
Create these files following the spec exactly:

1. server/src/lib/sentry.js -- Sentry Node.js SDK initialization with:
   - initSentry() function (MUST be called before any other imports in server.js)
   - nodeProfilingIntegration
   - sentryErrorHandler middleware (register AFTER routes, BEFORE generic error handler)
   - sentryRequestHandler middleware (register BEFORE all routes)
   - setSentryUser(req) -- called from auth middleware after JWT verification
   - setSentryContext(req) -- called from tenant middleware
   - captureWithContext(error, context) -- error capture with brand/job/model tags
   - Redact secrets from error messages
   - Filter noisy errors (ECONNRESET, EPIPE, socket hang up)
   - Trace sample rate: 0.2 production, 1.0 development

2. server/src/lib/posthog.js -- PostHog Node SDK client:
   - initPostHog() function
   - captureEvent(eventName, properties, userId) -- server-side event capture
   - identifyUser(userId, traits) -- user identification
   - isFeatureEnabled(flagName, userId) -- feature flag check
   - Flush on graceful shutdown
   - Skip in test environment

3. server/src/lib/ai-cost-tracker.js -- AI cost tracking module:
   - MODEL_COSTS map with per-token costs for all models (Claude Sonnet 4.6, Haiku 4.5, Gemini Flash/Pro, FLUX.2, GPT Image 1.5, Ideogram v3)
   - trackAICost({ userId, brandId, jobId, model, inputTokens, outputTokens, imageCount, duration }) function
   - Insert cost record into audit_log table
   - Calculate estimated cost in USD
   - Log cost with pino
   - Anomaly detection: alert if single job cost > $1.00 or daily user cost > $10.00

4. server/src/lib/bull-board.js -- Bull Board setup:
   - Import all BullMQ queues (brand-analysis, logo-generation, mockup-generation, bundle-composition, crm-sync, email-send, cleanup, webhook-process)
   - Create Bull Board express adapter
   - Export Express router mounted at /admin/queues

5. server/src/routes/admin.js -- Admin route:
   - Mount Bull Board at /admin/queues
   - Admin auth guard (check req.user.app_metadata.role === 'admin')
   - Return 403 for non-admin users

6. server/src/workers/_shared/job-logger.js -- BullMQ worker logger factory:
   - createJobLogger(jobName, jobId, extra) -- returns pino child logger with job context bound
   - Log job start, progress, completion, failure events

7. Update server/src/app.js to wire Sentry request handler FIRST and Sentry error handler AFTER routes but BEFORE the generic error handler.

8. Update server/src/server.js to call initSentry() and initPostHog() at the very top, before any other imports.

9. Update server/src/middleware/auth.js to call setSentryUser(req) after successful JWT verification.

10. Update server/src/middleware/tenant.js to call setSentryContext(req) after tenant context is established.

IMPORTANT:
- Sentry initialization MUST happen before all other imports in server.js
- PostHog is optional (skip if POSTHOG_API_KEY is not set, just log a warning)
- Bull Board requires admin authentication
- All logging goes through pino (no console.log)
- Health check routes (/health, /ready) are excluded from request logging
```

**Verify:**
```bash
# Server starts with observability warnings (Sentry DSN may be missing, that's OK)
cd server && NODE_ENV=development PORT=3000 node src/server.js &
SERVER_PID=$!
sleep 3

# Health check still works
curl -s http://localhost:3000/health | jq .

# Ready endpoint checks all dependencies
curl -s http://localhost:3000/ready | jq .

# Logs are structured JSON (check terminal output)
# Should see pino JSON output with service, env, and level fields

# Admin routes require auth
curl -s http://localhost:3000/admin/queues | grep -i "unauthorized\|forbidden\|401\|403"

# Generate an error and check it's logged properly
curl -s http://localhost:3000/api/v1/nonexistent | jq .error.requestId
# requestId should be present in error response

kill $SERVER_PID
```

---

## Phase 2: Auth + Real-time (Week 2)

### Step 2.1: Authentication & Security Hardening

**What:** Implement complete Supabase Auth integration, HMAC resume tokens, admin access control, input sanitization, and all security middleware.
**PRD Reference:** `docs/prd/08-AUTH-SECURITY.md` (all sections)
**Depends on:** Step 1.2 (server core), Step 1.3 (database with profiles table)
**Estimated time:** 60-90 minutes

**Prompt:**
```
Read docs/prd/08-AUTH-SECURITY.md completely (all 13 sections).

The Express.js server and database already exist from Phase 1. Now implement the complete
authentication and security system. Create/update these files:

1. server/src/middleware/auth.js -- ENHANCE the existing auth middleware:
   - Keep the Supabase JWT verification from 03-SERVER-CORE
   - Add: webhook route bypass (Stripe signature verification instead of JWT)
   - Add: optional auth mode for routes that work with or without auth
   - Add: admin-only middleware function: requireAdmin(req, res, next)
   - Add: Sentry user context integration (call setSentryUser from lib/sentry.js)

2. server/src/middleware/sanitize.js -- Input sanitization middleware:
   - Use sanitize-html to clean user-provided strings
   - Strip all HTML tags from text inputs
   - Allowlist specific safe tags for rich text fields (b, i, em, strong, a with href)
   - Apply to req.body recursively for all string fields

3. server/src/lib/resume-token.js -- HMAC wizard resume tokens:
   - generateResumeToken(brandId, userId, wizardStep) -- creates an HMAC-SHA256 signed token with 24h expiry
   - verifyResumeToken(token) -- verifies signature and checks expiry
   - Token payload: { brandId, userId, step, exp }
   - Uses RESUME_TOKEN_SECRET env var
   - Used in abandonment emails to let users resume wizard without full login

4. server/src/middleware/credits.js -- Credit enforcement middleware:
   - requireCredits(creditType, quantity) -- middleware factory
   - Calls check_generation_credits() Supabase RPC
   - Returns 402 Payment Required if insufficient credits with upgrade prompt
   - Attaches creditCheck result to req for downstream use

5. server/src/routes/auth.js -- Auth-specific routes (if not using Supabase client-side only):
   - POST /api/v1/auth/signup -- proxy to Supabase auth.signUp (optional, can be client-side)
   - POST /api/v1/auth/login -- proxy to Supabase auth.signInWithPassword
   - POST /api/v1/auth/logout -- revoke session via supabase.auth.admin.signOut
   - POST /api/v1/auth/refresh -- token refresh
   - GET /api/v1/auth/resume/:token -- verify HMAC resume token and return a session

6. Update server/src/routes/index.js -- Mount auth routes (before JWT middleware since auth routes handle their own auth)

7. Update server/src/app.js:
   - Add sanitize middleware after body parsers but before routes
   - Mount auth routes BEFORE the general auth middleware
   - Ensure webhook routes bypass JWT auth

SECURITY REQUIREMENTS:
- PKCE flow enforced for all OAuth (handled by Supabase client config)
- JWT access tokens expire in 1 hour
- Refresh tokens expire in 7 days
- Rate limit auth endpoints: 10 requests per 15 minutes per IP
- Resume tokens expire in 24 hours (HMAC-SHA256, not JWT)
- All user passwords handled by Supabase (never stored in our DB)
- Input sanitization on all POST/PATCH/PUT request bodies
- Helmet security headers (already in place from Step 1.2)
```

**Verify:**
```bash
cd server && NODE_ENV=development PORT=3000 node src/server.js &
SERVER_PID=$!
sleep 3

# Auth endpoints exist
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' | jq .error.code
# Should return AUTH error (not 404)

# Protected route returns 401 without token
curl -s http://localhost:3000/api/v1/brands | jq .error.code
# Should return "AUTH_MISSING_TOKEN"

# Webhook route is accessible without JWT (returns different error)
curl -s -X POST http://localhost:3000/api/v1/webhooks/stripe | jq .error.code
# Should NOT return AUTH_MISSING_TOKEN

# Security headers present
curl -sI http://localhost:3000/health | grep -i "x-content-type\|strict-transport\|x-frame"

# Rate limit headers present on API requests
curl -sI http://localhost:3000/api/v1/brands -H "Authorization: Bearer fake" | grep -i "x-ratelimit"

kill $SERVER_PID
```

---

### Step 2.2: Real-time Engine + Job Queue System

**What:** Implement BullMQ queues, workers, Socket.io namespaces, event handlers, the BullMQ-to-Socket.io progress bridge, and the Redis adapter for multi-process support.
**PRD Reference:** `docs/prd/06-REAL-TIME-JOBS.md` (all sections)
**Depends on:** Step 1.2 (server core with Redis service)
**Estimated time:** 60-90 minutes

**Prompt:**
```
Read docs/prd/06-REAL-TIME-JOBS.md completely (all sections).

The Express.js server with Redis connection already exists. Now implement the complete
real-time and background job system. Create these files:

1. server/src/services/redis.js -- ENHANCE the existing Redis service:
   - Add redisSub (separate connection for Socket.io pub/sub)
   - Add bullRedisConfig export for BullMQ
   - Add redisHealthCheck() and redisShutdown()
   - Follow the exact code from 06-REAL-TIME-JOBS.md Section 2

2. server/src/services/queue.js -- ENHANCE the existing queue factory:
   - createQueue(name, opts) -- creates a BullMQ Queue with defaults
   - Default options: removeOnComplete: { age: 24h, count: 1000 }, removeOnFail: { age: 7d, count: 5000 }
   - Export named queue instances:
     * brandAnalysisQueue ('brand-analysis')
     * logoGenerationQueue ('logo-generation')
     * mockupGenerationQueue ('mockup-generation')
     * bundleCompositionQueue ('bundle-composition')
     * crmSyncQueue ('crm-sync')
     * emailSendQueue ('email-send')
     * cleanupQueue ('cleanup')
     * stripeWebhookQueue ('stripe-webhook')
   - Each queue uses bullRedisConfig

3. server/src/sockets/index.js -- REWRITE with full Socket.io implementation:
   - createSocketServer(httpServer) function
   - Redis adapter (@socket.io/redis-adapter) for multi-process support
   - JWT authentication in connection middleware (verify Supabase token)
   - Namespaces:
     * /wizard -- wizard step events, generation progress
     * /dashboard -- brand status updates, job notifications
     * /admin -- admin metrics, queue stats (admin-only)
   - Connection handler: join user-specific room (user:{userId})
   - Export io instance and helper functions

4. server/src/sockets/wizard-namespace.js -- Wizard namespace handler:
   - Client events: wizard:join (join brand room), wizard:leave, wizard:step-complete
   - Server events: job:progress, job:complete, job:failed, agent:message, agent:complete

5. server/src/sockets/dashboard-namespace.js -- Dashboard namespace handler:
   - Client events: dashboard:subscribe (join user room)
   - Server events: brand:updated, brand:asset-ready, notification

6. server/src/lib/socket-emitter.js -- BullMQ-to-Socket.io bridge:
   - emitJobProgress(io, { jobId, userId, brandId, progress, status, message }) -- emit to job and user rooms
   - emitJobComplete(io, { jobId, userId, brandId, result }) -- emit completion event
   - emitJobFailed(io, { jobId, userId, brandId, error }) -- emit failure event
   - emitBrandUpdate(io, { userId, brandId, changes }) -- emit brand state change
   - All events include requestId/correlationId for tracing

7. server/src/workers/_shared/base-worker.js -- Base BullMQ worker factory:
   - createWorker(queueName, processor, opts) -- creates a Worker with:
     * bullRedisConfig connection
     * Default concurrency: 3
     * Lock duration: 300_000 (5 min)
     * Job-level logging via createJobLogger
     * Progress reporting via emitJobProgress
     * Error handling: log to pino + Sentry, update generation_jobs table status
     * Graceful shutdown: drain current jobs

8. server/src/workers/test-worker.js -- A simple test worker:
   - Processes jobs from a 'test' queue
   - Simulates work with a delay
   - Reports progress at 25%, 50%, 75%, 100%
   - Emits Socket.io events at each progress step
   - Returns a mock result

9. Update server/src/server.js:
   - Pass io instance to app.locals for route access
   - Import and start workers (or start workers in a separate process if preferred)
   - Add worker shutdown to graceful shutdown handler

10. Update server/src/routes/generation.js -- Wire up the logo generation route:
    - POST /api/v1/generation/test -- accepts { brandId }, creates a test job, returns 202 { jobId }
    - This is a test endpoint to verify the full BullMQ -> Worker -> Socket.io pipeline

IMPORTANT:
- BullMQ queues and workers must use separate Redis connections (BullMQ requirement)
- Socket.io MUST use Redis adapter for multi-process support
- All Socket.io namespaces require JWT authentication in handshake
- Admin namespace requires additional admin role check
- Workers must handle graceful shutdown (drain jobs, close connections)
- Use ioredis (already in package.json), NOT the redis package
```

**Verify:**
```bash
cd server && NODE_ENV=development PORT=3000 REDIS_URL=redis://localhost:6379 node src/server.js &
SERVER_PID=$!
sleep 3

# Verify Socket.io is attached
curl -s http://localhost:3000/socket.io/?EIO=4&transport=polling | head -c 100
# Should return Socket.io handshake data (not 404)

# Verify queues are created (check Redis keys)
redis-cli keys "bull:*" | head -5

# Test the full pipeline: enqueue a job via API
curl -s -X POST http://localhost:3000/api/v1/generation/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{"brandId": "test-brand-id"}' | jq .
# Should return 202 with jobId (or 401 if auth is enforced)

# Check worker processes the job (watch logs for progress events)
# Logs should show: job started -> progress 25% -> 50% -> 75% -> 100% -> complete

# Check Redis for job result
redis-cli keys "bull:test:*" | head

kill $SERVER_PID
```

---

## Phase 3: Agent System (Week 3)

### Step 3.1: Agent Framework -- Anthropic Agent SDK

**What:** Implement the Anthropic Agent SDK integration, parent Brand Wizard Agent, subagent registry, tool definitions, lifecycle hooks, and BullMQ integration.
**PRD Reference:** `docs/prd/04-AGENT-SYSTEM.md` (all sections)
**Depends on:** Step 1.2 (server core), Step 2.2 (BullMQ + Socket.io)
**Estimated time:** 90-120 minutes

**Prompt:**
```
Read docs/prd/04-AGENT-SYSTEM.md completely (all sections).

Implement the Anthropic Agent SDK integration for Brand Me Now v2. This is the AI brain
of the platform -- the parent Brand Wizard agent that orchestrates all brand creation.

Create these files:

1. server/src/agents/brand-wizard.js -- The parent Brand Wizard Agent:
   - Import and configure the Anthropic Agent SDK (@anthropic-ai/claude-agent-sdk)
   - BRAND_WIZARD_SYSTEM_PROMPT -- EXACTLY as shown in Section 2.1
   - createBrandWizardAgent(context) function:
     * context = { userId, brandId, wizardStep, sessionId, io }
     * Returns configured Agent instance with:
       - model: 'claude-sonnet-4-6'
       - system prompt with context injected
       - tools: direct tools + subagent tasks
       - maxTurns: 30
       - maxBudgetUsd: 2.00
       - permissionMode: 'bypassPermissions' (server-side, no human confirmation needed)
       - Lifecycle hooks wired for Socket.io events
   - Export createBrandWizardAgent

2. server/src/agents/hooks.js -- Agent lifecycle hooks:
   - onAgentStart(context) -- log agent start, emit agent:started Socket.io event
   - onToolCall(context) -- log tool invocation, emit agent:tool-call event with tool name
   - onToolResult(context) -- log tool result, emit agent:tool-result with sanitized summary
   - onModelMessage(context) -- emit agent:message for streaming UI updates
   - onAgentComplete(context) -- save sessionId to brand, emit agent:complete, log cost
   - onAgentError(context) -- capture in Sentry, emit agent:error, log failure
   - onBudgetExceeded(context) -- alert via Sentry, emit agent:budget-exceeded
   - Each hook receives { agent, event, io, userId, brandId }

3. server/src/agents/tools/index.js -- Tool registry:
   - Import and export all direct tools as an array
   - Export subagent task definitions as an array
   - combinedTools = [...directTools, ...subagentTasks]

4. server/src/agents/tools/save-brand-data.js -- Direct tool:
   - name: 'saveBrandData'
   - description: 'Save or update brand fields in the database'
   - inputSchema: Zod schema for { brandId, fields: Record<string, any> }
   - execute: Supabase upsert to brands table

5. server/src/agents/tools/search-products.js -- Direct tool:
   - name: 'searchProducts'
   - description: 'Search the product catalog by category, name, or SKU'
   - inputSchema: Zod schema for { query?, category?, limit? }
   - execute: Supabase query on products table

6. server/src/agents/tools/validate-input.js -- Direct tool:
   - name: 'validateInput'
   - description: 'Quick validation of user input using Gemini 3.0 Flash'
   - inputSchema: Zod schema for { input, validationType }
   - execute: Call Gemini Flash API for cheap/fast validation

7. server/src/agents/tools/queue-crm-sync.js -- Direct tool:
   - name: 'queueCRMSync'
   - description: 'Dispatch a CRM sync job (non-blocking)'
   - inputSchema: Zod schema for { eventType, brandId, data }
   - execute: Add job to crmSyncQueue

8. server/src/agents/tools/check-credits.js -- Direct tool:
   - name: 'checkCredits'
   - description: 'Check if user has remaining generation credits'
   - inputSchema: Zod schema for { creditType, quantity }
   - execute: Call check_generation_credits() Supabase RPC

9. server/src/agents/tools/deduct-credit.js -- Direct tool:
   - name: 'deductCredit'
   - description: 'Deduct generation credits from user balance'
   - inputSchema: Zod schema for { creditType, quantity }
   - execute: Call deduct_generation_credit() Supabase RPC

10. server/src/agents/subagents/registry.js -- Subagent registry:
    - Import all skill configs from server/src/skills/*/config.js
    - createSubagentTask(skillConfig) -- creates a Task tool definition for the Agent SDK
    - Export array of Task tool definitions for: social-analyzer, brand-generator, logo-creator, mockup-renderer, name-generator, profit-calculator, video-creator
    - Each Task tool references the skill's system prompt, tools, and config

11. server/src/workers/brand-wizard.js -- BullMQ worker for brand wizard:
    - Processes jobs from 'brand-wizard' queue
    - Creates a BrandWizardAgent with job context
    - Runs agent.query() with the user's input
    - Streams messages to Socket.io via lifecycle hooks
    - Updates generation_jobs table with progress and result
    - Handles budget exceeded, max turns, and errors

12. Update server/src/routes/wizard.js -- Wire up wizard routes:
    - POST /api/v1/wizard/:brandId/start -- Start a new wizard session (enqueue brand-wizard job)
    - POST /api/v1/wizard/:brandId/step -- Submit user input for current step
    - POST /api/v1/wizard/:brandId/resume -- Resume a previous session using sessionId
    - GET /api/v1/wizard/:brandId/state -- Get current wizard state from brand record

NOTE: The actual skill implementations (social-analyzer, logo-creator, etc.) come in Phase 4.
For now, create stub skill configs in server/src/skills/{skill-name}/config.js with:
- name, description, model, maxTurns, maxBudgetUsd, timeoutMs
- Empty tools array (filled in Phase 4)

Create stub configs for ALL 7 skills:
- social-analyzer, brand-generator, name-generator, logo-creator, mockup-renderer, profit-calculator, video-creator
```

**Verify:**
```bash
cd server && NODE_ENV=development PORT=3000 REDIS_URL=redis://localhost:6379 \
  ANTHROPIC_API_KEY=test node src/server.js &
SERVER_PID=$!
sleep 3

# Wizard state endpoint works
curl -s http://localhost:3000/api/v1/wizard/test-brand-id/state | jq .

# Skill configs all exist
ls server/src/skills/*/config.js
# Should list 7 skill config files

# Agent tools registry loads without errors
node -e "import('./src/agents/tools/index.js').then(m => console.log('Tools:', Object.keys(m)))"

# Brand wizard worker is importable
node -e "import('./src/workers/brand-wizard.js').then(() => console.log('Worker OK'))"

kill $SERVER_PID
```

---

## Phase 4: AI Skills (Weeks 4-6)

### Step 4.1: Skill -- Social Analyzer

**What:** Implement the social-analyzer subagent that scrapes and analyzes social media profiles via Apify, then synthesizes brand DNA using Gemini Flash and Claude.
**PRD Reference:** `docs/prd/05-SKILL-MODULES.md` (Skill 1: social-analyzer)
**Depends on:** Step 3.1 (agent framework)
**Estimated time:** 60-90 minutes

**Prompt:**
```
Read docs/prd/05-SKILL-MODULES.md, focusing on "Skill 1: social-analyzer" section.

Implement the complete social-analyzer skill subagent. This skill scrapes Instagram,
TikTok, and Facebook profiles via Apify and analyzes them for brand DNA.

Create/update ALL files in server/src/skills/social-analyzer/:

1. config.js -- Skill configuration:
   - name: 'social-analyzer'
   - model: 'claude-sonnet-4-6'
   - maxTurns: 15, maxBudgetUsd: 0.50, timeoutMs: 120_000
   - retryPolicy: { maxRetries: 3, backoffMs: 1000 }

2. prompts.js -- System prompt and analysis templates:
   - SOCIAL_ANALYZER_SYSTEM_PROMPT -- specialized prompt for social analysis
   - ANALYSIS_TEMPLATE -- structured output template for brand DNA extraction
   - Include XML delimiters for prompt injection prevention

3. tools.js -- Tool definitions with Zod schemas:
   - scrapeInstagram: { handle: string } -> SocialProfile
   - scrapeTikTok: { handle: string } -> SocialProfile
   - scrapeFacebook: { pageUrl: string } -> SocialProfile
   - analyzeAesthetic: { imageUrls: string[], platform: string } -> AestheticAnalysis (uses Gemini Flash)
   - synthesizeAnalysis: { platforms: SocialProfile[] } -> BrandDNA (uses Claude)

4. handlers.js -- Tool execution handlers:
   - scrapeInstagramHandler: Apify client -> Instagram profile scraper
   - scrapeTikTokHandler: Apify client -> TikTok profile scraper
   - scrapeFacebookHandler: Apify client -> Facebook page scraper
   - analyzeAestheticHandler: Send image URLs to Gemini 3.0 Flash for visual analysis
   - synthesizeAnalysisHandler: Send all platform data to Claude for brand DNA synthesis
   - All handlers include: retry logic, error handling, fallback to manual input object
   - Apify budget tracking via Redis counter

5. index.js -- Subagent registration:
   - Import config, prompts, tools
   - Export createSocialAnalyzerAgent(context) function
   - Wire tools to handlers
   - Return { config, systemPrompt, tools }

6. tests/handlers.test.js -- Basic handler tests with mocked Apify responses

SocialProfile unified schema (Zod):
{
  platform: 'instagram' | 'tiktok' | 'facebook',
  handle: string,
  displayName: string,
  bio: string,
  followerCount: number,
  followingCount: number,
  postCount: number,
  engagementRate: number,
  topHashtags: string[],
  contentThemes: string[],
  postFrequency: string,
  topPostUrls: string[],
  profileImageUrl: string,
  aestheticSummary: string,
  fallback: boolean  // true if scraped data was unavailable and manual input was used
}

IMPORTANT:
- If Apify scrape fails (private profile, rate limited, budget exceeded), return a fallback object with fallback: true and empty fields. Do NOT throw an error.
- Multi-platform scrapes run in parallel (Promise.allSettled)
- Apify monthly budget tracked in Redis key "apify:monthly-spend"
```

**Verify:**
```bash
# Handler module imports without errors
cd server && node -e "import('./src/skills/social-analyzer/handlers.js').then(() => console.log('OK'))"

# Config is valid
node -e "import('./src/skills/social-analyzer/config.js').then(m => console.log(m.config))"

# Tools have Zod schemas
node -e "import('./src/skills/social-analyzer/tools.js').then(m => console.log(Object.keys(m)))"

# Run unit tests (if vitest is set up)
npx vitest run src/skills/social-analyzer/tests/ --reporter=verbose 2>/dev/null || echo "Tests need vitest setup"
```

---

### Step 4.2: Skill -- Brand Generator

**What:** Implement the brand-generator subagent that creates complete brand identity from social analysis data.
**PRD Reference:** `docs/prd/05-SKILL-MODULES.md` (Skill 2: brand-generator)
**Depends on:** Step 3.1 (agent framework), Step 4.1 (social-analyzer output schema)
**Estimated time:** 45-60 minutes

**Prompt:**
```
Read docs/prd/05-SKILL-MODULES.md, focusing on "Skill 2: brand-generator" section.

Implement the complete brand-generator skill subagent. This skill takes social analysis
data and generates a complete brand identity: vision statement, values, archetype,
color palette, font pairing, and target audience.

Create ALL files in server/src/skills/brand-generator/:

1. config.js -- model: claude-sonnet-4-6, maxTurns: 10, maxBudgetUsd: 0.30
2. prompts.js -- Brand generation system prompt with archetype framework, color theory references
3. tools.js -- Tools:
   - generateBrandVision: { socialData, userPreferences } -> { vision, values, archetype }
   - generateColorPalette: { archetype, industry, mood } -> { colors: [{hex, name, role}] }
   - generateFontPairing: { archetype, industry } -> { primary, secondary, body }
   - generateTargetAudience: { socialData, archetype } -> { demographics, psychographics }
   - saveBrandIdentity: { brandId, identity } -> saves to brands table
4. handlers.js -- All Claude-based generation (no external APIs needed for text generation)
5. index.js -- Subagent registration
6. tests/ -- Basic tests

Output schema for brand identity:
{
  vision: string,
  values: string[] (3-5 values),
  archetype: string (one of 12 brand archetypes),
  colorPalette: [{ hex: string, name: string, role: 'primary'|'secondary'|'accent'|'neutral' }],
  fonts: { primary: string, secondary: string, body: string },
  targetAudience: { demographics: string, psychographics: string, painPoints: string[] },
  tagline: string
}
```

**Verify:**
```bash
cd server && node -e "import('./src/skills/brand-generator/index.js').then(() => console.log('OK'))"
```

---

### Step 4.3: Skill -- Name Generator

**What:** Implement the name-generator subagent that suggests brand names with domain and trademark availability checks.
**PRD Reference:** `docs/prd/05-SKILL-MODULES.md` (Skill 3: name-generator)
**Depends on:** Step 3.1 (agent framework)
**Estimated time:** 30-45 minutes

**Prompt:**
```
Read docs/prd/05-SKILL-MODULES.md, focusing on "Skill 3: name-generator" section.

Implement the name-generator skill subagent. This skill generates brand name suggestions
and checks domain/trademark availability.

Create ALL files in server/src/skills/name-generator/:

1. config.js -- model: claude-sonnet-4-6, maxTurns: 8, maxBudgetUsd: 0.20
2. prompts.js -- Name generation prompt with creative naming strategies
3. tools.js -- Tools:
   - generateNames: { brandVision, archetype, industry, keywords } -> string[] (10-15 names)
   - checkDomainAvailability: { names: string[] } -> [{ name, domain, available }]
   - checkTrademarkConflicts: { names: string[] } -> [{ name, conflicts: string[] }]
   - rankNames: { names, availability, conflicts, brandFit } -> ranked list
4. handlers.js -- Claude for name generation, DNS/WHOIS for domain check (or stub), USPTO API stub for trademark
5. index.js -- Subagent registration
```

**Verify:**
```bash
cd server && node -e "import('./src/skills/name-generator/index.js').then(() => console.log('OK'))"
```

---

### Step 4.4: Skill -- Logo Creator

**What:** Implement the logo-creator subagent that generates logos via FLUX.2 Pro (BFL API) with prompt composition, generation, background removal, and refinement.
**PRD Reference:** `docs/prd/05-SKILL-MODULES.md` (Skill 4: logo-creator)
**Depends on:** Step 3.1 (agent framework), Step 2.2 (BullMQ for job tracking)
**Estimated time:** 60-90 minutes

**Prompt:**
```
Read docs/prd/05-SKILL-MODULES.md, focusing on "Skill 4: logo-creator" section.

Implement the complete logo-creator skill subagent. This is a high-value skill that
generates logos via BFL's FLUX.2 Pro API, handles background removal, uploads to
Supabase Storage, and supports iterative refinement.

Create ALL files in server/src/skills/logo-creator/:

1. config.js -- model: claude-sonnet-4-6, maxTurns: 12, maxBudgetUsd: 0.50, timeoutMs: 180_000

2. prompts.js -- Logo generation system prompt:
   - Instruction to compose detailed FLUX.2 Pro prompts
   - Logo style guidelines (minimal, bold, vintage, modern, playful)
   - Color constraint instructions (match brand palette)
   - Negative prompt patterns (no text, no gradients, etc.)

3. tools.js -- Tools with Zod schemas:
   - composeLogoPrompt: { brandName, archetype, style, colors, keywords } -> { prompt, negativePrompt }
   - generateLogo: { prompt, negativePrompt, width, height, seed } -> { imageUrl, generationId }
     * Calls BFL FLUX.2 Pro API directly (not via Replicate)
     * BFL API: POST https://api.bfl.ml/v1/flux-pro-1.1 with API key auth
   - removeBackground: { imageUrl } -> { transparentUrl }
     * Calls Python AI worker (or a background removal API)
   - uploadAsset: { imageBuffer, brandId, userId, filename } -> { storageUrl, thumbnailUrl }
     * Upload to Supabase Storage bucket 'brand-logos'
     * Path: {userId}/{brandId}/{filename}
   - saveLogo: { brandId, assetUrl, thumbnailUrl, metadata } -> brand_assets row
   - refineLogo: { originalPrompt, feedback, referenceUrl } -> { refinedPrompt }

4. handlers.js -- Tool execution handlers:
   - composeLogoPromptHandler: Claude composes the perfect FLUX.2 Pro prompt
   - generateLogoHandler: HTTP POST to BFL API, poll for result, return image URL
     * BFL API flow: submit job -> poll status -> download result
     * Include retry with exponential backoff
     * Track cost in ai-cost-tracker
   - removeBackgroundHandler: Call Python worker /api/remove-bg endpoint (or stub)
   - uploadAssetHandler: Download image, upload to Supabase Storage
   - saveLogoHandler: Insert into brand_assets table
   - refineLogoHandler: Claude refines the prompt based on user feedback

5. index.js -- Subagent registration

6. tests/handlers.test.js -- Tests with mocked BFL API responses

Generation flow:
1. Agent calls composeLogoPrompt with brand data -> gets optimized prompt
2. Agent calls generateLogo 4 times (4 logo variations) -> gets 4 image URLs
3. Agent calls removeBackground on each -> gets transparent PNGs
4. Agent calls uploadAsset on each -> gets storage URLs
5. Agent calls saveLogo for each -> creates brand_asset records
6. Returns 4 logos to parent agent -> parent sends to frontend for user selection

IMPORTANT:
- FLUX.2 Pro API is async: submit, poll status, download result
- Generate 4 logos per session (configurable via tier limits)
- Each logo generation costs 1 credit (deducted by parent agent before spawning this skill)
- All images uploaded to Supabase Storage under brand-logos/{userId}/{brandId}/
- Cost per logo tracked in audit_log via ai-cost-tracker
```

**Verify:**
```bash
cd server && node -e "import('./src/skills/logo-creator/index.js').then(() => console.log('OK'))"

# Verify BFL API handler structure (with mock)
node -e "
import('./src/skills/logo-creator/handlers.js').then(m => {
  console.log('Handlers:', Object.keys(m));
})"
```

---

### Step 4.5: Skill -- Mockup Renderer

**What:** Implement the mockup-renderer subagent that generates product mockups using GPT Image 1.5, Ideogram v3, and Gemini 3 Pro Image.
**PRD Reference:** `docs/prd/05-SKILL-MODULES.md` (Skill 5: mockup-renderer)
**Depends on:** Step 3.1 (agent framework), Step 4.4 (logo-creator for uploaded logos)
**Estimated time:** 60-90 minutes

**Prompt:**
```
Read docs/prd/05-SKILL-MODULES.md, focusing on "Skill 5: mockup-renderer" section.

Implement the mockup-renderer skill subagent. This skill generates product mockups by
placing the user's selected logo onto product templates using multiple AI models:
- GPT Image 1.5 (OpenAI) for photorealistic product mockups
- Ideogram v3 for text-in-image typography mockups
- Gemini 3 Pro Image for bundle compositions and editing

Create ALL files in server/src/skills/mockup-renderer/:

1. config.js -- model: claude-sonnet-4-6, maxTurns: 20, maxBudgetUsd: 0.80, timeoutMs: 300_000

2. prompts.js -- Mockup generation system prompt:
   - Instructions for composing product mockup prompts per model
   - Product template usage guidelines
   - Logo placement instructions

3. tools.js -- Tools:
   - composeMockupPrompt: { product, logoUrl, brandColors, style } -> { prompt, model }
   - generateMockupGPT: { prompt, productImageUrl, logoUrl, maskUrl } -> { imageUrl }
     * OpenAI GPT Image 1.5 API (image editing/inpainting)
   - generateMockupIdeogram: { prompt, text, style } -> { imageUrl }
     * Ideogram v3 API for text-in-image (brand name on products)
   - generateBundleComposition: { mockupUrls, layout, brandColors } -> { compositeUrl }
     * Gemini 3 Pro Image API for multi-image composition
   - uploadMockup: { imageBuffer, brandId, userId, productId } -> { storageUrl }
   - saveMockup: { brandId, productId, assetUrl, metadata } -> brand_assets row

4. handlers.js -- Multi-model API handlers:
   - GPT Image 1.5: POST to OpenAI images API with edit/inpaint capabilities
   - Ideogram v3: POST to Ideogram API with text rendering
   - Gemini 3 Pro Image: POST to Google API with image editing
   - Each handler includes retry logic, cost tracking, error handling

5. index.js -- Subagent registration
```

**Verify:**
```bash
cd server && node -e "import('./src/skills/mockup-renderer/index.js').then(() => console.log('OK'))"
```

---

### Step 4.6: Skill -- Profit Calculator

**What:** Implement the profit-calculator subagent that computes financial projections (pure math, no AI).
**PRD Reference:** `docs/prd/05-SKILL-MODULES.md` (Skill 6: profit-calculator)
**Depends on:** Step 3.1 (agent framework)
**Estimated time:** 30-45 minutes

**Prompt:**
```
Read docs/prd/05-SKILL-MODULES.md, focusing on "Skill 6: profit-calculator" section.

Implement the profit-calculator skill. This is a PURE MATH module -- no AI API calls.
It calculates margins, revenue projections, and break-even analysis for the user's
selected products at different price points and sales volumes.

Create ALL files in server/src/skills/profit-calculator/:

1. config.js -- model: claude-sonnet-4-6 (for formatting), maxTurns: 5, maxBudgetUsd: 0.10

2. tools.js -- Tools:
   - calculateMargins: { products: [{ baseCost, retailPrice, quantity }] } -> { margins per product, total margin }
   - projectRevenue: { products, salesTiers: [10, 50, 100, 500] } -> { revenue per tier }
   - calculateBreakEven: { fixedCosts, products } -> { breakEvenUnits per product }
   - generatePricingRecommendation: { products, competitors } -> { suggestedPrices }
   - formatFinancialSummary: { margins, revenue, breakEven } -> structured report

3. handlers.js -- Pure calculation functions (no API calls):
   - marginCalc: (retailPrice - baseCost) / retailPrice * 100
   - revenueProjection: sum(retailPrice * quantity) for each sales tier
   - breakEvenCalc: fixedCosts / (retailPrice - baseCost)

4. index.js -- Subagent registration

No external API calls. All math is deterministic.
```

**Verify:**
```bash
cd server && node -e "
import('./src/skills/profit-calculator/handlers.js').then(m => {
  // Test margin calculation
  const result = m.calculateMarginsHandler({
    products: [{ baseCost: 8.50, retailPrice: 29.99, quantity: 100 }]
  });
  console.log('Margin test:', result);
})"
```

---

### Step 4.7: Skill -- Video Creator (Stub)

**What:** Create a stub for the video-creator subagent (Phase 2 feature using Veo 3).
**PRD Reference:** `docs/prd/05-SKILL-MODULES.md` (Skill 7: video-creator)
**Depends on:** Step 3.1 (agent framework)
**Estimated time:** 10 minutes

**Prompt:**
```
Read docs/prd/05-SKILL-MODULES.md, focusing on "Skill 7: video-creator" section.

Create a STUB implementation for the video-creator skill. This skill will use Google's
Veo 3 API to generate product videos in Phase 2. For now, create the file structure
with placeholder implementations that return "Coming in Phase 2" messages.

Create files in server/src/skills/video-creator/:

1. config.js -- name: 'video-creator', model: 'claude-sonnet-4-6', maxTurns: 5, maxBudgetUsd: 1.00
   - Add: enabled: false (feature flagged off)

2. prompts.js -- Stub system prompt: "Video generation is coming in Phase 2."

3. tools.js -- Stub tools:
   - generateProductVideo: returns { error: 'Feature coming in Phase 2', available: false }

4. handlers.js -- Stub handler that returns Phase 2 message

5. index.js -- Subagent registration with enabled: false check
```

**Verify:**
```bash
cd server && node -e "
import('./src/skills/video-creator/config.js').then(m => {
  console.log('Video creator enabled:', m.config.enabled); // Should be false
})"
```

---

## Phase 5: Frontend Application (Weeks 7-10)

### Step 5.1: Frontend Shell -- React 19 + Vite 7

**What:** Create the React 19 application shell with Vite, routing, auth context, Zustand stores, API client, Socket.io client, and Tailwind CSS design system.
**PRD Reference:** `docs/prd/09-FRONTEND-APP.md` (Sections 1-5: Setup, Routing, Stores, API, Design System)
**Depends on:** Step 1.2 (API server running for API calls)
**Estimated time:** 90-120 minutes

**Prompt:**
```
Read docs/prd/09-FRONTEND-APP.md completely (all sections, focusing on Sections 1-5 for this step).

Create the React 19 + Vite 7 frontend application in apps/web/. Follow the package.json
from Section 1.1 EXACTLY.

Create the complete frontend shell:

1. apps/web/package.json -- EXACTLY from Section 1.1
2. apps/web/vite.config.js -- Vite 7 config with React plugin, Tailwind CSS 4 plugin, proxy to API server, resolve aliases (@/ -> src/)
3. apps/web/index.html -- Root HTML with proper meta tags, loading spinner
4. apps/web/tailwind.config.js -- Tailwind 4 config importing shared design tokens
5. apps/web/src/index.css -- Global CSS with design token variables (light + dark mode) from the spec
6. apps/web/src/main.jsx -- App entry point: React 19 createRoot, QueryClient, providers
7. apps/web/eslint.config.js -- ESLint 9 flat config with React hooks + refresh plugins

ROUTING (React Router 7):
8. apps/web/src/router.jsx -- All route definitions:
   - / -> redirect to /dashboard
   - /auth/login, /auth/signup, /auth/forgot-password, /auth/callback
   - /wizard/:brandId/onboarding through /wizard/:brandId/complete (12 steps)
   - /dashboard, /dashboard/brands, /dashboard/brands/:brandId, /dashboard/settings
   - /admin/* (lazy loaded, admin-only)
   - Protected route wrapper (redirect to /auth/login if not authenticated)

PROVIDERS:
9. apps/web/src/providers/AuthProvider.jsx -- Supabase Auth state management:
   - Listen for auth state changes
   - Store session in memory
   - Provide { user, session, loading, signIn, signUp, signOut }
10. apps/web/src/providers/QueryProvider.jsx -- TanStack React Query provider with defaults
11. apps/web/src/providers/SocketProvider.jsx -- Socket.io client connection:
    - Connect with JWT auth token in handshake
    - Reconnect on token refresh
    - Provide { socket, connected } context
12. apps/web/src/providers/PostHogProvider.jsx -- PostHog analytics:
    - Initialize PostHog on mount
    - Track page views on route changes
    - Identify user after login

STORES (Zustand):
13. apps/web/src/stores/wizard-store.js -- Wizard state:
    - brand: { id, name, vision, status, wizardStep, ... }
    - design: { colors, fonts, logoStyle, archetype }
    - assets: { logos: [], mockups: [], bundles: [] }
    - products: { selected: [], pricing: {} }
    - meta: { currentStep, completedSteps, sessionId, isGenerating }
    - Actions: setBrand, updateDesign, addAsset, selectProduct, nextStep, previousStep, reset
    - Persist to localStorage for session survival

14. apps/web/src/stores/auth-store.js -- Auth state:
    - user, session, isAdmin, loading
    - Actions: setUser, clearUser, setSession

15. apps/web/src/stores/ui-store.js -- UI state:
    - theme ('light'|'dark'), sidebarOpen, toastQueue
    - Actions: toggleTheme, toggleSidebar, addToast, removeToast

API CLIENT:
16. apps/web/src/lib/api-client.js -- Fetch wrapper:
    - Base URL from VITE_API_URL env var
    - Auto-attach Supabase JWT to Authorization header
    - Auto-refresh token on 401
    - Structured error handling (parse error.code from response)
    - Methods: get, post, patch, del (all return parsed JSON)

17. apps/web/src/lib/supabase-client.js -- Supabase browser client:
    - createClient with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
    - PKCE flow type, auto refresh, persist session
    - Export supabase instance

18. apps/web/src/hooks/use-socket.js -- Socket.io hook:
    - Connect/disconnect lifecycle
    - Namespace subscription
    - Event listener management with cleanup

19. apps/web/src/hooks/use-generation-progress.js -- Real-time generation tracking:
    - Listen for job:progress, job:complete, job:failed events
    - Return { progress, status, message, result, error }

UI COMPONENTS (create basic shells):
20. apps/web/src/components/ui/ -- Create all UI components listed in Section 3:
    Button, Input, Textarea, Select, Checkbox, Card, Modal, Toast, ToastProvider,
    ProgressBar, Skeleton, Avatar, Badge, Tooltip, Tabs, LoadingSpinner, EmptyState, ErrorBoundary

21. apps/web/src/components/layout/ -- Layout components:
    AppHeader, DashboardSidebar, MobileNav, Footer, ConnectionStatus

Then run: cd apps/web && npm install && npm run dev

IMPORTANT:
- JavaScript + JSDoc only (no TypeScript, but install typescript for checkJs)
- React 19 with the new use() hook and React Server Components preparation
- Tailwind CSS 4 (new @theme syntax, not the old tailwind.config.js exports)
- All API keys read from VITE_* env vars
- Dark mode support via CSS variables and prefers-color-scheme
```

**Verify:**
```bash
# Dependencies install
cd apps/web && npm install

# Vite dev server starts
npm run dev &
VITE_PID=$!
sleep 5

# Dev server responds
curl -s http://localhost:5173 | grep -o "<title>.*</title>"

# Build succeeds
npm run build

# Lint passes
npm run lint

kill $VITE_PID
```

---

### Step 5.2: Wizard Flow -- All 12 Steps

**What:** Implement all 12 wizard step components with navigation, state persistence, Socket.io progress tracking, and real-time AI generation feedback.
**PRD Reference:** `docs/prd/09-FRONTEND-APP.md` (Wizard sections)
**Depends on:** Step 5.1 (frontend shell), Step 2.2 (Socket.io for real-time)
**Estimated time:** 3-5 hours (largest step)

**Prompt:**
```
Read docs/prd/09-FRONTEND-APP.md, focusing on the wizard route components and wizard-specific
UI components.

Implement ALL 12 wizard step pages and their supporting components. Each step is a route
component that reads/writes wizard state from the Zustand wizard-store and communicates
with the API server.

WIZARD LAYOUT:
1. apps/web/src/pages/wizard/layout.jsx -- Wizard shell:
   - WizardProgressBar showing all 12 steps with active/complete/upcoming states
   - Background gradient
   - Back/Next navigation (StepNavigation component)
   - Auto-save wizard state on step change
   - Socket.io connection for real-time events
   - Redirect to /auth/login if not authenticated

STEP PAGES (apps/web/src/pages/wizard/):

2. onboarding.jsx -- Step 1: Welcome screen
   - Brand name input, optional vision textarea
   - "Let's build your brand" CTA
   - Creates a new brand record via POST /api/v1/brands
   - Stores brandId in wizard-store

3. social-analysis.jsx -- Step 2: Social media analysis
   - SocialHandleInput components for Instagram, TikTok, Facebook
   - "Analyze My Socials" button triggers POST /api/v1/wizard/:brandId/start
   - GenerationProgress component shows real-time analysis progress via Socket.io
   - Display analysis results (themes, aesthetic, audience) when complete
   - Skip option for users without social accounts

4. brand-identity.jsx -- Step 3: Review/edit brand identity
   - Display AI-generated: vision, values, archetype, tagline
   - Editable fields (user can modify any AI suggestion)
   - Brand archetype visual selector (12 archetypes with icons)
   - Save changes via PATCH /api/v1/brands/:id

5. customization.jsx -- Step 4: Design customization
   - ColorPalettePicker: AI-suggested colors + custom color picker (react-colorful)
   - FontSelector: Preview fonts with live text
   - LogoStyleSelector: Visual style cards (minimal, bold, vintage, modern, playful)
   - All changes saved to wizard-store and API

6. logo-generation.jsx -- Step 5: Generate logos
   - "Generate 4 Logos" button triggers generation job
   - GenerationProgress with live updates (composing prompt... generating... uploading...)
   - LogoGrid: 4 generated logos in a 2x2 grid
   - Click to select, selected logo highlighted
   - "Regenerate" button for unsatisfied users (costs 1 credit)
   - Credit balance display

7. logo-refinement.jsx -- Step 6: Refine selected logo
   - Display selected logo large
   - LogoRefinementPanel: feedback textarea + refinement options
   - "Refine" generates a new version based on feedback
   - Side-by-side comparison (before/after)
   - "I'm happy with this" to proceed

8. product-selection.jsx -- Step 7: Browse and select products
   - ProductGrid: filterable grid of products from catalog
   - ProductCard: image, name, base price, select toggle
   - Category filter tabs (apparel, accessories, home_goods, etc.)
   - Search bar
   - Selected products counter + list

9. mockup-review.jsx -- Step 8: Review mockups
   - Auto-generates mockups for all selected products
   - GenerationProgress for each product mockup
   - MockupViewer: full-size mockup with approve/reject buttons
   - Carousel or grid layout
   - "Regenerate" for individual mockups

10. bundle-builder.jsx -- Step 9: Create product bundles
    - BundleBuilder: drag-and-drop products into bundles
    - Name each bundle
    - Bundle preview image (generated by AI)
    - Pricing summary per bundle

11. profit-calculator.jsx -- Step 10: Financial projections
    - PricingSlider: interactive retail price adjustment per product
    - ProfitChart: bar/line chart (Recharts) showing revenue at different volume tiers
    - Margin display per product
    - Break-even analysis
    - Total projected monthly/annual revenue

12. checkout.jsx -- Step 11: Subscription selection
    - TierSelector: 4 subscription tier cards (Free, Starter $29, Pro $79, Agency $199)
    - Feature comparison
    - "Subscribe" redirects to Stripe Checkout
    - "Continue Free" proceeds with free tier limits

13. complete.jsx -- Step 12: Celebration
    - CelebrationAnimation (confetti effect via canvas or CSS)
    - BrandSummaryCard: overview of everything created
    - Download all assets button
    - Share buttons (social media)
    - "Go to Dashboard" CTA

WIZARD-SPECIFIC COMPONENTS (apps/web/src/components/wizard/):
14. WizardProgressBar.jsx -- Multi-step indicator with clickable completed steps
15. StepNavigation.jsx -- Back/Next/Skip buttons with loading state
16. GenerationProgress.jsx -- Real-time progress bar + status message from Socket.io
17. SocialHandleInput.jsx -- Input with platform icon, @ prefix, validation
18. ColorPalettePicker.jsx -- 5-color palette with AI suggestion + manual picker
19. FontSelector.jsx -- Font preview cards with Google Fonts
20. LogoStyleSelector.jsx -- Visual style cards with illustrations
21. LogoGrid.jsx -- 2x2 logo grid with selection
22. LogoRefinementPanel.jsx -- Feedback controls
23. ProductGrid.jsx + ProductCard.jsx -- Product catalog grid
24. MockupViewer.jsx -- Full-size mockup with controls
25. BundleBuilder.jsx -- Bundle composition UI
26. ProfitChart.jsx -- Recharts revenue chart
27. PricingSlider.jsx -- Interactive price slider
28. TierSelector.jsx -- Subscription tier cards
29. CelebrationAnimation.jsx -- Confetti effect
30. BrandSummaryCard.jsx -- Final brand overview

IMPORTANT:
- Every step auto-saves to wizard-store (localStorage persistence)
- Every step syncs with API on Next/Back navigation
- Socket.io events update GenerationProgress in real-time
- Credit checks happen before any generation step
- Error boundaries wrap each step (WizardErrorBoundary)
- Loading states use Skeleton components
- All forms use react-hook-form + Zod validation
- Responsive: mobile-first, works on 375px+
```

**Verify:**
```bash
cd apps/web && npm run build
# Build should succeed with no errors

# Dev server shows wizard
npm run dev &
sleep 3
curl -s http://localhost:5173/wizard/test/onboarding | grep -c "html"
kill %1
```

---

### Step 5.3: Dashboard + Brand Management

**What:** Implement the brand dashboard: brand list, brand detail page, asset gallery, downloads, user settings, and admin panel.
**PRD Reference:** `docs/prd/09-FRONTEND-APP.md` (Dashboard + Admin sections)
**Depends on:** Step 5.1 (frontend shell), Step 5.2 (wizard for creating brands)
**Estimated time:** 2-3 hours

**Prompt:**
```
Read docs/prd/09-FRONTEND-APP.md, focusing on dashboard routes, brand components, admin
components, and chat widget.

Implement the dashboard, brand management, settings, and admin pages:

DASHBOARD PAGES (apps/web/src/pages/dashboard/):

1. layout.jsx -- Dashboard shell:
   - DashboardSidebar with navigation links
   - AppHeader with user avatar, dropdown menu
   - Responsive: sidebar collapses on mobile
   - Socket.io connection for live brand updates

2. brands.jsx -- Brand list page:
   - Grid of BrandCard components
   - "New Brand" button (links to /wizard/new/onboarding)
   - Empty state for new users
   - Filter by status (draft, in_progress, complete)
   - Sort by created_at
   - Fetches brands via GET /api/v1/brands with TanStack Query

3. brand-detail.jsx -- Single brand view:
   - BrandDetailHeader: brand name, status badge, edit/delete actions
   - Tabs: Overview, Logos, Mockups, Bundles, Products, Financials
   - AssetGallery: grid of all assets with download buttons
   - ColorPaletteDisplay: read-only palette visualization
   - FontDisplay: typography preview
   - "Continue Wizard" button if brand is incomplete
   - "Download All" button (zip all assets)
   - Share buttons

4. settings.jsx -- User settings page:
   - Profile form: name, email (read-only), phone, avatar upload
   - Subscription card: current tier, credits remaining, upgrade/manage button
   - "Manage Subscription" opens Stripe Customer Portal
   - Danger zone: delete account (with confirmation modal)
   - Theme toggle (light/dark)

BRAND COMPONENTS (apps/web/src/components/brand/):
5. BrandCard.jsx -- Card for brand list: thumbnail, name, status, created date, click to detail
6. BrandStatusBadge.jsx -- Color-coded status pill (draft=gray, in_progress=yellow, complete=green)
7. AssetGallery.jsx -- Masonry-style image gallery with lightbox, download, select
8. ColorPaletteDisplay.jsx -- 5-color palette with hex codes and names
9. FontDisplay.jsx -- Typography preview with heading/body/accent fonts
10. BrandDetailHeader.jsx -- Hero section with brand name and key stats

CHAT WIDGET (apps/web/src/components/chat/):
11. ChatWidget.jsx -- Floating chat button (bottom-right), opens drawer
12. ChatMessage.jsx -- Message bubble (user/assistant), markdown rendering
13. ChatInput.jsx -- Text input with send button, character limit
14. TypingIndicator.jsx -- Animated dots while AI is responding
    - Chat uses POST /api/v1/chat with streaming via Socket.io

ADMIN PAGES (apps/web/src/pages/admin/) -- lazy loaded, admin-only:
15. layout.jsx -- Admin sidebar with separate navigation
16. users.jsx -- User management: table with search, tier filter, edit role
17. products.jsx -- Product catalog CRUD: table + form modal
18. jobs.jsx -- BullMQ job monitor (embed Bull Board or custom view)
19. health.jsx -- System health dashboard: Redis status, queue depths, error rates

Create all pages with real API integration (TanStack Query for data fetching,
mutations for writes). Use optimistic updates where appropriate.
```

**Verify:**
```bash
cd apps/web && npm run build
# Should compile all dashboard routes

npm run dev &
sleep 3
# Dashboard route loads
curl -s http://localhost:5173/dashboard | grep -c "html"
kill %1
```

---

## Phase 6: Business Features (Weeks 11-14)

### Step 6.1: Payments & Billing -- Stripe Integration

**What:** Implement Stripe subscriptions, credit system, webhook handlers, billing UI, and Customer Portal integration.
**PRD Reference:** `docs/prd/10-PAYMENTS-BILLING.md` (all sections)
**Depends on:** Step 1.2 (server), Step 1.3 (database), Step 2.2 (BullMQ), Step 5.1 (frontend)
**Estimated time:** 3-4 hours

**Prompt:**
```
Read docs/prd/10-PAYMENTS-BILLING.md completely (all 11 sections).

Implement the complete Stripe payments and billing system. Follow the development prompt
in Section 10 of the PRD exactly.

SERVER-SIDE (create these files):

1. server/src/services/stripe.js -- Stripe SDK initialization:
   - Initialize with STRIPE_SECRET_KEY
   - Pin API version
   - Export singleton stripe instance

2. server/src/config/tiers.js -- Subscription tier configuration:
   - 4 tiers: free, starter ($29/mo), pro ($79/mo), agency ($199/mo)
   - Each tier: price, brand limit, logo/mockup/video credits, features list, Stripe price ID, BullMQ priority
   - Export: getTierConfig(name), getTierByPriceId(priceId), hasFeature(tier, feature)
   - Annual pricing: 2 months free

3. server/src/services/credits.js -- Credit management service:
   - checkCredits(userId, creditType, quantity) -> { allowed, remaining, needsUpgrade, overageAllowed }
   - deductCredits(userId, creditType, quantity, context) -> Supabase RPC deduct_generation_credit()
   - refundCredits(userId, creditType, quantity, context) -> restore credits on generation failure
   - allocateCredits(userId, tierName) -> upsert generation_credits on subscription creation
   - refillCredits(userId, tierName) -> reset credits monthly (no rollover)
   - getCreditBalances(userId) -> current balances for all credit types

4. server/src/middleware/credits.js -- Credit enforcement middleware:
   - requireCredits(creditType, quantity) middleware factory
   - Returns 402 with { needsUpgrade: true, currentTier, upgradeUrl } if insufficient

5. server/src/routes/billing.js -- Billing API routes:
   - POST /api/v1/billing/checkout-session -- Create Stripe Checkout Session
   - POST /api/v1/billing/portal-session -- Create Stripe Customer Portal session
   - GET /api/v1/billing/subscription -- Get current subscription + credit balances
   - All routes require auth middleware

6. server/src/routes/webhooks.js -- UPDATE existing webhooks route:
   - POST /api/v1/webhooks/stripe -- Stripe webhook handler:
     * Use express.raw() body parser (NOT express.json())
     * Verify signature with stripe.webhooks.constructEvent()
     * Idempotency check against a webhook_events tracking mechanism
     * Enqueue to BullMQ 'stripe-webhook' queue
     * Return 200 immediately (< 100ms)

7. server/src/workers/stripe-webhook.js -- BullMQ worker:
   - Queue: 'stripe-webhook'
   - Handle events:
     * checkout.session.completed -> create subscription, update profile tier, allocate credits
     * customer.subscription.updated -> update tier, re-allocate credits
     * customer.subscription.deleted -> downgrade to free
     * invoice.payment_succeeded -> refill monthly credits
     * invoice.payment_failed -> send warning email, mark past_due
   - Each handler: update DB, adjust credits, emit Socket.io events, queue CRM sync + emails
   - 5 retry attempts with exponential backoff

8. Database migration: server/supabase/migrations/031_webhook_events.sql
   - webhook_events table for idempotency tracking
   - credit_transactions table for immutable credit audit trail

IMPORTANT: Mount the Stripe webhook route BEFORE express.json() in app.js because
Stripe needs the raw body for signature verification.

9. Update server/src/app.js:
   - Mount webhook route with express.raw() BEFORE express.json()
   - Wire billing routes after auth middleware

FRONTEND (create these files):

10. apps/web/src/pages/wizard/checkout.jsx -- ENHANCE the existing checkout step:
    - TierSelector cards with feature comparison
    - Monthly/Annual toggle
    - "Subscribe" button creates checkout session and redirects to Stripe
    - "Continue Free" skips payment

11. apps/web/src/pages/dashboard/settings.jsx -- ENHANCE settings:
    - Subscription card: tier, renewal date, credit balances
    - "Manage Subscription" button opens Stripe Customer Portal
    - "Upgrade" button creates checkout session for higher tier

12. apps/web/src/hooks/use-subscription.js -- Subscription data hook:
    - Fetch subscription + credits via GET /api/v1/billing/subscription
    - Real-time subscription status updates via Socket.io
    - Return { subscription, credits, isActive, tier }

TEST WITH STRIPE TEST MODE:
- Use Stripe test API keys
- Test card: 4242 4242 4242 4242
- Test webhook: stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
```

**Verify:**
```bash
cd server && NODE_ENV=development PORT=3000 \
  STRIPE_SECRET_KEY=sk_test_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  node src/server.js &
SERVER_PID=$!
sleep 3

# Billing endpoint exists (returns 401 without auth)
curl -s http://localhost:3000/api/v1/billing/subscription | jq .error.code

# Webhook endpoint accepts POST
curl -s -X POST http://localhost:3000/api/v1/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
# Should return 400 (bad signature), NOT 404

# Stripe webhook forwarding (run in separate terminal):
# stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
# stripe trigger checkout.session.completed

kill $SERVER_PID
```

---

### Step 6.2: External Integrations -- GHL, Resend, Apify

**What:** Implement GoHighLevel OAuth CRM sync, Resend email templates and workers, and Apify scraping service.
**PRD Reference:** `docs/prd/11-INTEGRATIONS.md` (all sections)
**Depends on:** Step 1.2 (server), Step 2.2 (BullMQ), Step 1.4 (observability)
**Estimated time:** 3-4 hours

**Prompt:**
```
Read docs/prd/11-INTEGRATIONS.md completely (all 6 sections).

Implement all three external integrations. Follow the development prompt in Section 5
of the PRD exactly.

GOHIGHLEVEL CRM (server/src/integrations/ghl/):

1. client.js -- GHL OAuth 2.0 client:
   - OAuth token management (get, refresh, store in Redis)
   - Proactive token refresh (5 min before expiry)
   - Token storage: Redis (primary) + env vars (fallback for first boot)
   - API methods: createContact, updateContact, getContact, validateFields
   - Rate limiter: max 10 API calls/second
   - Retry on 401 (token refresh + retry once)

2. config.js -- Config-driven field mappings:
   - Load from server/src/config/crm-fields.yaml
   - ${ENV_VAR} interpolation
   - Startup validation: confirm all field IDs exist in GHL location
   - Exit FATAL if ALL fields are invalid (wrong location)

3. sanitize.js -- CRM data sanitizer:
   - sanitizeForCRM(data) -- strip blocked fields from every payload
   - BLOCKED_FIELDS: ['password', 'stripe_customer_id', 'refresh_token', 'api_key']
   - Zero passwords or raw credentials ever sent to GHL

4. worker.js -- BullMQ crm-sync worker:
   - Queue: 'crm-sync'
   - Events: wizard.started, brand.completed, wizard.abandoned, subscription.created
   - 3x retry with backoff [1s, 5s, 15s]
   - Dead-letter queue + Sentry alert on final failure

5. server/src/config/crm-fields.yaml -- Field mapping config

RESEND EMAIL (server/src/integrations/email/):

6. client.js -- Resend SDK client:
   - Initialize with RESEND_API_KEY
   - sendEmail(to, templateName, props) function
   - Per-user rate limiting: 5 emails per 60 seconds (Redis counter)

7. templates/ -- 7 React Email templates:
   - welcome.jsx -- Welcome email after signup
   - brand-completion.jsx -- Brand wizard complete
   - wizard-abandonment.jsx -- Abandonment with HMAC resume link (24h expiry)
   - support-request.jsx -- Support ticket confirmation
   - payment-confirmation.jsx -- Stripe payment success
   - subscription-renewal.jsx -- Monthly renewal reminder
   - credit-low-warning.jsx -- Credits running low

8. worker.js -- BullMQ email-send worker:
   - Queue: 'email-send'
   - Template registry: map template name to React Email component
   - HTML sanitization via sanitize-html on all user-provided data
   - 3x retry with exponential backoff
   - Per-user rate limit check before sending

APIFY SCRAPING (server/src/integrations/apify/):

9. client.js -- Apify client wrapper:
   - scrapeInstagram(handle) -> SocialProfile
   - scrapeTikTok(handle) -> SocialProfile
   - scrapeFacebook(pageUrl) -> SocialProfile
   - Monthly budget cap tracked in Redis key "apify:monthly-spend:{YYYY-MM}"
   - Budget check before each scrape
   - Graceful fallback: return { fallback: true, ...emptyProfile } on failure

10. normalizers.js -- Platform-specific data normalizers:
    - normalizeInstagram(rawData) -> SocialProfile
    - normalizeTikTok(rawData) -> SocialProfile
    - normalizeFacebook(rawData) -> SocialProfile
    - Unified SocialProfile schema (Zod validated)

11. scrape-profiles.js -- Orchestrator:
    - scrapeProfiles(handles) -- run all platforms in parallel
    - Promise.allSettled -- one failure doesn't block others
    - Return partial results for successful platforms

Install dependencies: npm install resend @react-email/components react-email apify-client

MOUNT POINTS:
12. Update server/src/routes/index.js -- Add routes for:
    - GET /api/v1/webhooks/ghl/callback -- GHL OAuth callback
    - POST /api/v1/support/contact -- Support form -> email worker

13. Update server/src/agents/tools/queue-crm-sync.js -- Wire to actual GHL worker
```

**Verify:**
```bash
# GHL config loads
cd server && node -e "import('./src/integrations/ghl/config.js').then(m => console.log('GHL config:', m))"

# Email templates render
node -e "import('./src/integrations/email/templates/welcome.jsx').then(() => console.log('Templates OK'))"

# Apify normalizer works
node -e "
import('./src/integrations/apify/normalizers.js').then(m => {
  const result = m.normalizeInstagram({ username: 'test', edge_followed_by: { count: 1000 } });
  console.log('Normalized:', result);
})"

# CRM sanitizer strips passwords
node -e "
import('./src/integrations/ghl/sanitize.js').then(m => {
  const result = m.sanitizeForCRM({ name: 'Test', password: 'secret', email: 'test@test.com' });
  console.log('Has password:', 'password' in result); // Should be false
})"
```

---

## Phase 7: Launch Preparation (Weeks 15-16)

### Step 7.1: Testing Suite

**What:** Write comprehensive tests for all critical paths: unit tests, integration tests, component tests, E2E tests, and load tests.
**PRD Reference:** `docs/prd/14-TESTING.md` (all sections)
**Depends on:** All previous phases (testing the built system)
**Estimated time:** 4-6 hours

**Prompt:**
```
Read docs/prd/14-TESTING.md completely (all sections).

Set up the complete testing infrastructure and write tests for all critical paths.
The testing pyramid: unit (200+), component (80+), integration (50+), E2E (15+), load (5+).

TESTING INFRASTRUCTURE:

1. server/vitest.config.js -- Vitest config for server:
   - Test pattern: src/**/*.test.js
   - Coverage: v8 provider, 80% lines threshold, 75% branches
   - Setup file for test environment
   - MSW for API mocking

2. apps/web/vitest.config.js -- Vitest config for frontend:
   - jsdom environment
   - @testing-library/jest-dom setup
   - MSW browser integration
   - Coverage thresholds

3. Testing utilities:
   - server/src/test/setup.js -- Server test setup (Redis mock, Supabase mock)
   - server/src/test/factories.js -- Test data factories (createUser, createBrand, createJob)
   - server/src/test/mocks/ -- MSW handlers for external APIs (BFL, OpenAI, Google, Stripe)
   - apps/web/src/test/setup.js -- Frontend test setup (RTL, mock providers)
   - apps/web/src/test/render.jsx -- Custom render with all providers

SERVER UNIT TESTS (server/src/**/*.test.js):

4. Middleware tests:
   - middleware/auth.test.js -- JWT verification, missing token, expired token, webhook bypass
   - middleware/validate.test.js -- Zod validation pass/fail, multiple schemas
   - middleware/rate-limit.test.js -- Rate limit enforcement, Redis store
   - middleware/tenant.test.js -- Tier limits, missing user, admin override
   - middleware/credits.test.js -- Credit check, insufficient credits, overage

5. Service tests:
   - services/credits.test.js -- Atomic deduction, refund, allocation, refill
   - config/tiers.test.js -- getTierConfig, getTierByPriceId, hasFeature

6. Skill tests:
   - skills/profit-calculator/handlers.test.js -- Margin calculation, revenue projection
   - skills/social-analyzer/handlers.test.js -- Normalizer functions, budget check
   - skills/logo-creator/handlers.test.js -- BFL API mock, upload flow

7. Integration tests:
   - lib/resume-token.test.js -- Generate, verify, expiry
   - integrations/ghl/sanitize.test.js -- Blocked field stripping
   - integrations/email/templates.test.js -- All 7 templates render valid HTML

SERVER INTEGRATION TESTS:

8. routes/brands.test.js -- Full CRUD lifecycle via supertest:
   - Create brand (201), list brands (200), get brand (200), update (200), delete (200)
   - Auth required (401 without token)
   - Tenant isolation (user A can't see user B's brands)
   - Brand limit enforcement per tier

9. routes/billing.test.js -- Stripe flow:
   - Create checkout session (mock Stripe)
   - Webhook signature verification
   - Idempotency (duplicate event handling)

10. workers/stripe-webhook.test.js -- Webhook processing:
    - checkout.session.completed -> subscription + credits created
    - invoice.payment_failed -> email queued + status updated

FRONTEND COMPONENT TESTS (apps/web/src/**/*.test.jsx):

11. Wizard component tests:
    - components/wizard/LogoGrid.test.jsx -- Render 4 logos, click to select
    - components/wizard/GenerationProgress.test.jsx -- Progress bar updates
    - components/wizard/ColorPalettePicker.test.jsx -- Color selection

12. Store tests:
    - stores/wizard-store.test.js -- State mutations, persistence
    - stores/auth-store.test.js -- Login/logout state

E2E TESTS (e2e/):

13. Install Playwright: npx playwright install
14. e2e/playwright.config.js -- Playwright config
15. e2e/auth.spec.js -- Signup, login, logout flows
16. e2e/wizard.spec.js -- Full wizard walkthrough (mock AI responses)
17. e2e/dashboard.spec.js -- Brand list, detail view, settings

LOAD TESTS (k6/):

18. k6/api-load.js -- k6 load test script:
    - 500 concurrent virtual users
    - Target: API p95 < 200ms
    - Endpoints: /health, /api/v1/brands, /api/v1/products

Add npm scripts to server/package.json and apps/web/package.json:
- test:unit, test:integration, test:component, test:e2e, test:load, test:coverage
```

**Verify:**
```bash
# Server tests pass
cd server && npm test

# Frontend tests pass
cd apps/web && npm test

# Coverage meets thresholds
cd server && npm run test:coverage
cd apps/web && npm run test:coverage

# E2E tests pass (requires running server + frontend)
npx playwright test --reporter=list
```

---

### Step 7.2: Deployment Infrastructure

**What:** Create Docker builds, Kubernetes manifests, CI/CD workflows, Nginx config, and production deployment setup.
**PRD Reference:** `docs/prd/13-DEPLOYMENT-INFRA.md` (all sections)
**Depends on:** All previous phases
**Estimated time:** 3-4 hours

**Prompt:**
```
Read docs/prd/13-DEPLOYMENT-INFRA.md completely (all 11 sections).

Build the complete deployment infrastructure. Follow the development prompt in Section 11
of the PRD exactly.

Create these files IN ORDER:

1. server/Dockerfile -- ENHANCE existing Dockerfile:
   - Multi-stage build (deps -> build -> production)
   - node:22-alpine base
   - Non-root user (appuser:appgroup)
   - dumb-init for PID 1
   - Health check with wget
   - EXPOSE 3000

2. services/ai-worker/Dockerfile -- Python FastAPI worker:
   - Multi-stage, python:3.13-slim
   - Install Pillow dependencies (libjpeg, libpng, zlib)
   - Non-root user
   - Health check
   - EXPOSE 8000

3. services/ai-worker/requirements.txt -- Python dependencies:
   - fastapi, uvicorn[standard], Pillow, httpx, pydantic, sentry-sdk[fastapi], structlog

4. infra/redis/redis.conf -- Production Redis config:
   - maxmemory 512mb, maxmemory-policy allkeys-lru
   - RDB persistence (save 900 1, save 300 10)
   - AOF persistence (appendfsync everysec)
   - 2 databases

5. docker-compose.yml (project root) -- Local development:
   - api: build from server/, hot reload (node --watch), volume mounts, port 3000
   - redis: redis:7-alpine, custom redis.conf, health check, named volume
   - python-worker: build from services/ai-worker/, hot reload (--reload), port 8000
   - redis-commander: debug profile only, port 8081
   - Shared bmn-network bridge
   - .env env_file

6. docker-compose.prod.yml -- Single-droplet production:
   - Pull from registry.digitalocean.com/brandmenow/
   - Resource limits (mem_limit), restart: always
   - JSON-file logging with rotation (max-size: 10m, max-file: 3)
   - Watchtower for auto-pull on image push
   - Ports bound to 127.0.0.1 (Nginx fronts everything)

7. k8s/ directory -- Kubernetes manifests:
   - k8s/namespace.yaml
   - k8s/configmap.yaml (non-secret config)
   - k8s/secret.yaml (template with base64 placeholders)
   - k8s/api-deployment.yaml (2 replicas, liveness/readiness probes, resource limits, envFrom)
   - k8s/api-service.yaml (ClusterIP, session affinity for Socket.io)
   - k8s/redis-statefulset.yaml (PVC on do-block-storage, 10Gi)
   - k8s/redis-configmap.yaml (redis.conf)
   - k8s/redis-service.yaml (ClusterIP)
   - k8s/python-worker-deployment.yaml
   - k8s/python-worker-service.yaml
   - k8s/ingress.yaml (nginx-ingress, cert-manager TLS, WebSocket support, HSTS)
   - k8s/cluster-issuer.yaml (Let's Encrypt)
   - k8s/network-policies.yaml (default deny, API->Redis, API->Python)
   - k8s/hpa.yaml (2-8 pods, CPU 70%, memory 80%)

8. .github/workflows/ci.yml -- CI pipeline:
   - Trigger: PR to main
   - Jobs: lint, typecheck, unit tests, integration tests (with Redis service), Docker build verify, Trivy security scan

9. .github/workflows/deploy-api.yml -- API deployment:
   - Trigger: push to main
   - Build Docker images, push to DO registry
   - Rolling deploy to K8s (kubectl rollout) OR SSH deploy to droplet
   - Rollback on failure (kubectl rollout undo)

10. .github/workflows/deploy-marketing.yml -- Marketing site deployment:
    - Trigger: push to main (apps/marketing/ path)
    - Vercel CLI deploy

11. infra/nginx/brandmenow.conf -- Nginx reverse proxy:
    - HTTPS with Let's Encrypt (certbot)
    - WebSocket upgrade for Socket.io (/socket.io/)
    - Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
    - Proxy to 127.0.0.1:3000 for API
    - Rate limiting at Nginx level (additional layer)

12. .env.example (project root) -- Complete env var template with descriptions

13. scripts/k8s-apply.sh -- Apply all K8s manifests in dependency order:
    namespace -> secrets -> configmaps -> redis -> api -> python-worker -> ingress -> hpa
```

**Verify:**
```bash
# Docker builds succeed
docker compose build

# Docker compose starts all services
docker compose up -d
sleep 10

# Health check through Docker
curl -s http://localhost:3000/health | jq .

# All services running
docker compose ps

# Clean up
docker compose down

# K8s manifests are valid YAML
for f in k8s/*.yaml; do python3 -c "import yaml; yaml.safe_load(open('$f'))" && echo "$f OK"; done

# CI workflow syntax is valid
# (GitHub Actions syntax check is done by GitHub, but we can check YAML)
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "CI workflow OK"
```

---

### Step 7.3: Marketing Site -- Next.js 15

**What:** Build the Next.js 15 marketing site with landing page, pricing, blog, about, contact, and legal pages.
**PRD Reference:** `docs/prd/15-MARKETING-SITE.md` (all sections)
**Depends on:** Nothing (independent from main app, shares design tokens)
**Estimated time:** 3-4 hours

**Prompt:**
```
Read docs/prd/15-MARKETING-SITE.md completely (all 12 sections).

Build the Next.js 15 marketing site in apps/marketing/. This is a separate application
that shares design tokens with the main Brand Builder SPA.

Follow the development prompt in Section 10 of the PRD:

PROJECT SETUP:
1. apps/marketing/package.json -- Next.js 15, React 19, Tailwind CSS 4, MDX, Motion, Lucide, PostHog
2. apps/marketing/next.config.mjs -- App Router, MDX support, image domains, Vercel deployment
3. apps/marketing/tailwind.config.js -- Import shared design tokens from @bmn/config/tailwind

PAGES (App Router, apps/marketing/app/):
4. layout.jsx -- Root layout: Inter font, metadata, PostHog script, shared header/footer
5. page.jsx -- Landing page (SSG):
   - Hero section with headline, subheadline, CTA
   - "How It Works" 3-step process
   - Feature showcase (6 features with icons)
   - Social proof / testimonials
   - FAQ accordion
   - Final CTA section
   - All CTAs link to app.brandmenow.com/signup

6. pricing/page.jsx -- Pricing page (ISR, revalidate 60s):
   - 4 tier cards: Free, Starter ($29), Pro ($79), Agency ($199)
   - Monthly/Annual toggle (annual = 2 months free)
   - Feature comparison table
   - "Most Popular" badge on Pro
   - CTAs pass ?tier= query param

7. blog/page.jsx -- Blog index (SSG):
   - Paginated post cards (12 per page)
   - Tag filtering
   - Search bar

8. blog/[slug]/page.jsx -- Blog post (SSG):
   - MDX rendering with custom components
   - Table of contents from headings
   - Related posts (3 matching tags)
   - BlogPosting JSON-LD structured data

9. about/page.jsx -- About page (SSG):
   - Brand story, team, mission
   - Timeline of company milestones

10. contact/page.jsx -- Contact page (SSG):
    - Contact form: name, email, subject, message
    - Form validation (react-hook-form + Zod)
    - Submit via Next.js API route -> Resend email
    - Honeypot field for bot detection
    - Rate limit: 5 submissions per IP per hour

11. legal/terms/page.jsx -- Terms of Service (SSG)
12. legal/privacy/page.jsx -- Privacy Policy (SSG)

API ROUTES:
13. app/api/contact/route.js -- Contact form submission -> Resend email
14. app/api/revalidate/route.js -- On-demand ISR revalidation webhook

COMPONENTS:
15. components/Header.jsx -- Responsive header with mobile menu
16. components/Footer.jsx -- Footer with links, social icons
17. components/PricingCard.jsx -- Tier pricing card
18. components/FaqAccordion.jsx -- Animated FAQ accordion
19. components/FeatureCard.jsx -- Feature showcase card
20. components/BlogCard.jsx -- Blog post preview card
21. components/ContactForm.jsx -- Contact form with validation

SEO:
22. Every page has unique <title> and <meta name="description">
23. Open Graph tags for social sharing
24. Twitter Card tags
25. JSON-LD structured data (Organization, WebSite, BlogPosting)
26. sitemap.xml generated from all pages + blog posts
27. robots.txt allowing all pages except /api/

BLOG CONTENT:
28. Create 3 sample MDX blog posts in content/blog/:
    - "How AI is Revolutionizing Brand Creation"
    - "5 Steps to Building a Brand from Your Social Media"
    - "The Complete Guide to Product Mockups"

DEPLOYMENT:
29. vercel.json -- Vercel config with redirects (/login -> app.brandmenow.com/login, etc.)
30. Security headers in next.config.mjs

IMPORTANT:
- All pages must be statically generated (SSG) except pricing (ISR)
- No authentication on marketing site -- all auth flows redirect to app.brandmenow.com
- Lighthouse targets: Performance > 95, Accessibility > 95, SEO > 95
- Motion (framer-motion successor) for animations
- Responsive: mobile-first, works at 375px, 768px, 1440px
```

**Verify:**
```bash
cd apps/marketing && npm install && npm run build

# Build succeeds
echo "Build exit code: $?"

# All pages generated
ls .next/server/app/
# Should show: page.js, pricing/, blog/, about/, contact/, legal/

# Dev server starts
npm run dev &
sleep 5
curl -s http://localhost:3001 | grep -o "<title>.*</title>"
kill %1
```

---

### Step 7.4: Data Migration Scripts

**What:** Implement migration scripts to move data from Brand Me Now v1 (old Supabase) to v2 (new Supabase), including asset migration and GHL cleanup.
**PRD Reference:** `docs/prd/16-MIGRATION-GUIDE.md` (all sections)
**Depends on:** Step 1.3 (new database schema), all other phases complete
**Estimated time:** 3-4 hours

**Prompt:**
```
Read docs/prd/16-MIGRATION-GUIDE.md completely (all 11 sections).

Build the complete migration toolkit. Follow the development prompt in Section 9 of the PRD.

Create these scripts in scripts/migrate/:

1. config.js -- Migration configuration:
   - OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_ROLE_KEY
   - NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY
   - R2_ENDPOINT, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET
   - DRY_RUN flag (--dry-run CLI argument)
   - Batch size settings

2. utils.js -- Shared utilities:
   - Progress logger with counts
   - Error handler with context
   - Batch processor (process N records at a time)
   - URL rewriter (old Supabase URL -> new Supabase URL)

3. 01-migrate-auth-users.js -- Migrate auth.users:
   - Export users from old Supabase (admin API)
   - Import into new Supabase (admin API)
   - Verify all users can authenticate
   - Log: migrated count, skipped count, error count

4. 02-migrate-profiles.js -- Migrate profiles table:
   - Read from old profiles table
   - Transform: remove password column, add new columns with defaults
   - Insert into new profiles table
   - Verify record counts match

5. 03-migrate-brands.js -- Migrate brands table:
   - Read from old brands table
   - Transform: convert wizard_step from INT (0-12) to URL path TEXT
     * 0 -> 'onboarding', 1 -> 'social-analysis', 2 -> 'brand-identity', etc.
   - Insert into new brands table
   - Verify record counts + no orphaned brands (all user_ids exist)

6. 04-migrate-brand-assets.js -- Migrate brand_assets + merge brand_mockups:
   - Read from old brand_assets table
   - Read from old brand_mockups table
   - Merge brand_mockups into brand_assets with asset_type = 'mockup'
   - Transform: file_url -> url, is_primary -> is_selected
   - Insert into new brand_assets table

7. 05-migrate-products.js -- Migrate products table:
   - Read from old products table
   - Add new columns (base_cost, retail_price) with NULL defaults
   - Insert into new products table

8. 06-migrate-storage.js -- Migrate Supabase Storage assets:
   - List all files in old storage buckets (brand-logos, brand-mockups, product-images, product-masks)
   - Download each file
   - Upload to new Supabase Storage bucket
   - Optionally upload AI-generated images to Cloudflare R2
   - Rewrite all asset URLs in database to point to new storage

9. 07-initialize-credits.js -- Initialize generation credits:
   - For each user in new profiles table
   - Create generation_credits rows with free tier defaults
   - (4 logos, 4 mockups, 0 videos)

10. 08-cleanup-ghl.js -- GHL security cleanup:
    - For each GHL contact
    - Clear bmn_username field
    - Clear bmn_password field
    - Rate limit: 200ms delay between API calls
    - Log: cleaned count, error count

11. 09-verify-migration.js -- Verification script:
    - Compare record counts between old and new
    - Check for orphaned records (no brands without users, no assets without brands)
    - Validate all JSONB columns contain valid JSON
    - HEAD request every asset URL (check for 404s)
    - Report: pass/fail for each check

12. run-migration.js -- Master migration orchestrator:
    - Runs all scripts in order (01 through 09)
    - Halts on any failure
    - Supports --dry-run flag
    - Supports --step N to run a single step
    - Logs total time and summary

All scripts MUST:
- Support --dry-run flag (log what WOULD happen, write nothing)
- Be idempotent (safe to re-run without duplicating data)
- Use batch processing (never load entire tables into memory)
- Log progress with counts
- Handle errors gracefully (log and continue where possible)
- Use @supabase/supabase-js for database operations
```

**Verify:**
```bash
# Scripts load without errors
cd scripts/migrate && node -e "import('./config.js').then(() => console.log('Config OK'))"

# Dry run works (against old Supabase, reads only)
node run-migration.js --dry-run
# Should log what it WOULD do without writing

# Verify script runs (against new Supabase)
node 09-verify-migration.js
# Should report all checks
```

---

## Quick Reference: Complete Build Order

```
WEEK 1 (Foundation):
  1.1  Scaffold Project          -> dirs + npm install
  1.2  Server Core               -> Express.js 5 + all middleware
  1.3  Database Schema           -> SQL migrations + RLS + seed data
  1.4  Observability             -> Sentry + PostHog + pino + Bull Board

WEEK 2 (Auth + Real-time):
  2.1  Auth & Security           -> Supabase JWT + HMAC tokens + sanitization
  2.2  Real-time + Jobs          -> BullMQ + Socket.io + Redis adapter

WEEK 3 (Agent System):
  3.1  Agent Framework           -> Anthropic SDK + Brand Wizard + tools + hooks

WEEKS 4-6 (Skills):
  4.1  social-analyzer           -> Apify + Gemini Flash + Claude analysis
  4.2  brand-generator           -> Brand identity creation (Claude)
  4.3  name-generator            -> Name suggestions + domain check
  4.4  logo-creator              -> FLUX.2 Pro + background removal + upload
  4.5  mockup-renderer           -> GPT Image 1.5 + Ideogram v3 + Gemini Pro
  4.6  profit-calculator         -> Pure math financial projections
  4.7  video-creator (stub)      -> Phase 2 placeholder

WEEKS 7-10 (Frontend):
  5.1  Frontend Shell            -> React 19 + Vite 7 + stores + design system
  5.2  Wizard Flow               -> All 12 wizard step components
  5.3  Dashboard                 -> Brand management + admin + chat

WEEKS 11-14 (Business):
  6.1  Payments                  -> Stripe subscriptions + credits + webhooks
  6.2  Integrations              -> GHL OAuth + Resend email + Apify scraping

WEEKS 15-16 (Launch):
  7.1  Testing                   -> Unit + integration + E2E + load tests
  7.2  Deployment                -> Docker + K8s + CI/CD + Nginx
  7.3  Marketing Site            -> Next.js 15 SSG site
  7.4  Migration                 -> v1 -> v2 data migration scripts
```

---

## Troubleshooting Common Issues

### Server won't start
```bash
# Check for missing env vars
cd server && node src/config/validate-env.js

# Check Redis connection
redis-cli ping

# Check for port conflicts
lsof -i :3000
```

### Docker build fails
```bash
# Check Docker daemon is running
docker info

# Rebuild without cache
docker compose build --no-cache

# Check for missing files in .dockerignore
```

### Database migration errors
```bash
# Check Supabase connection
curl -s https://YOUR_PROJECT.supabase.co/rest/v1/ \
  -H "apikey: YOUR_ANON_KEY" | jq .

# Run migrations one at a time to find the failing one
psql $SUPABASE_DB_URL -f supabase/migrations/001_extensions.sql
```

### Socket.io connection issues
```bash
# Check Redis pub/sub
redis-cli subscribe "socket.io#*"

# Test Socket.io handshake
curl "http://localhost:3000/socket.io/?EIO=4&transport=polling"
```

### Stripe webhook failures
```bash
# Test with Stripe CLI
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
stripe trigger checkout.session.completed

# Check webhook signature
# Make sure STRIPE_WEBHOOK_SECRET matches the stripe listen output
```

---

## Environment Variable Checklist

Before each phase, ensure these env vars are configured:

### Phase 1 (Foundation)
- [x] `NODE_ENV`, `PORT`
- [ ] `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `REDIS_URL`
- [ ] `SENTRY_DSN` (optional for dev)

### Phase 2 (Auth + Real-time)
- [ ] `RESUME_TOKEN_SECRET` (min 32 chars)
- [ ] `CORS_ORIGINS`

### Phase 3-4 (Agents + Skills)
- [ ] `ANTHROPIC_API_KEY`
- [ ] `GOOGLE_API_KEY`
- [ ] `BFL_API_KEY`
- [ ] `OPENAI_API_KEY`
- [ ] `IDEOGRAM_API_KEY`
- [ ] `APIFY_API_TOKEN`

### Phase 6 (Business)
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- [ ] `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET`, `GHL_LOCATION_ID`
- [ ] `RESEND_API_KEY`

### Phase 7 (Launch)
- [ ] `POSTHOG_API_KEY`, `POSTHOG_HOST`
- [ ] `DO_REGISTRY`, `DO_CLUSTER_NAME`
- [ ] All production URLs: `API_URL`, `APP_URL`, `MARKETING_URL`
