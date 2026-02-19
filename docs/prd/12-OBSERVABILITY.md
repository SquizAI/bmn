# 12 — Observability Specification

**Product:** Brand Me Now v2
**Date:** February 19, 2026
**Author:** Matt Squarzoni
**Status:** Approved for development
**Build Phase:** Phase 1, Week 1 (parallel with 03-SERVER-CORE + 07-DATABASE)
**Dependencies:** 03-SERVER-CORE (Express.js server must exist)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Sentry Error Tracking & Performance](#2-sentry-error-tracking--performance)
3. [Structured Logging (pino)](#3-structured-logging-pino)
4. [PostHog Product Analytics](#4-posthog-product-analytics)
5. [Bull Board Job Monitoring](#5-bull-board-job-monitoring)
6. [Health Checks](#6-health-checks)
7. [AI Cost Tracking](#7-ai-cost-tracking)
8. [File Manifest](#8-file-manifest)
9. [Environment Variables](#9-environment-variables)
10. [Development Prompt](#10-development-prompt)
11. [Acceptance Criteria](#11-acceptance-criteria)

---

## 1. Overview

Observability is a **day-one requirement**, not a Phase 5 afterthought. The principle from the master blueprint is clear: *"If it's not measured, it doesn't exist."*

This document specifies four observability pillars:

| Pillar | Tool | Purpose |
|--------|------|---------|
| **Error Tracking + APM** | Sentry | Errors, exceptions, request tracing, latency monitoring |
| **Structured Logging** | pino (Node.js) / structlog (Python) | Machine-parseable JSON logs with correlation IDs, shipped to Betterstack |
| **Product Analytics** | PostHog | User behavior, funnels, feature flags, session replay |
| **Job Monitoring** | Bull Board | BullMQ queue dashboards, job inspection, retry, admin-only |

Additionally, this spec covers:
- **Health check endpoints** for Kubernetes liveness/readiness probes
- **AI cost tracking** with audit logging, aggregation, and anomaly alerts

### Hosting

All observability infrastructure runs on **DigitalOcean**. The Express.js API server, Redis, and BullMQ workers run on DO Kubernetes (or a single DO droplet for launch). The Python FastAPI worker runs on GCP Cloud Run. Sentry and PostHog are SaaS (cloud-hosted). Log shipping targets Betterstack (or DigitalOcean Monitoring / Datadog as alternatives).

### Design Principles

1. **Every request gets a correlation ID** (`requestId`) that flows through logs, Sentry breadcrumbs, PostHog events, and BullMQ job metadata.
2. **Every AI call is metered** — model, tokens, cost, duration recorded in `audit_log`.
3. **Never log secrets** — API keys, tokens, passwords are redacted at the pino transport level.
4. **Environment separation** — `development`, `staging`, `production` with different sampling rates and alert thresholds.
5. **Structured JSON everywhere** — no `console.log`, no unstructured text. pino for Node.js, structlog for Python.

---

## 2. Sentry Error Tracking & Performance

### 2.1 Node.js SDK — Express.js Server

Install Sentry's Node.js SDK with profiling support:

```bash
pnpm add @sentry/node @sentry/profiling-node
```

#### Initialization (`server/src/lib/sentry.js`)

Sentry **must** be initialized before any other imports in the server entry point. This file is imported at the very top of `server/src/server.js`.

```javascript
// server/src/lib/sentry.js

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

/**
 * Initialize Sentry for the Express.js API server.
 * MUST be called before any other imports in server.js.
 */
export function initSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || `bmn-api@${process.env.npm_package_version}`,

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    integrations: [
      nodeProfilingIntegration(),
    ],

    // Filter out noisy errors
    ignoreErrors: [
      'ECONNRESET',
      'EPIPE',
      'socket hang up',
    ],

    // Attach custom context to every event
    beforeSend(event, hint) {
      // Strip PII from error messages
      if (event.message) {
        event.message = redactSecrets(event.message);
      }
      return event;
    },

    // Attach breadcrumbs for debugging
    beforeBreadcrumb(breadcrumb) {
      // Redact Authorization headers from HTTP breadcrumbs
      if (breadcrumb.category === 'http' && breadcrumb.data?.headers) {
        delete breadcrumb.data.headers.authorization;
        delete breadcrumb.data.headers.cookie;
      }
      return breadcrumb;
    },
  });
}

/**
 * Sentry Express.js error handler middleware.
 * Must be registered AFTER all routes, BEFORE the generic error handler.
 */
export const sentryErrorHandler = Sentry.Handlers.errorHandler({
  shouldHandleError(error) {
    // Report all 4xx and 5xx errors
    if (error.status) {
      return error.status >= 400;
    }
    return true;
  },
});

/**
 * Sentry request handler middleware.
 * Must be registered BEFORE all routes.
 */
export const sentryRequestHandler = Sentry.Handlers.requestHandler({
  // Include user IP, cookies, and request body in Sentry events
  ip: true,
  request: ['headers', 'method', 'url', 'query_string'],
  user: ['id', 'email'],
});

/**
 * Set Sentry user context from authenticated request.
 * Called from auth middleware after JWT verification.
 * @param {import('express').Request} req
 */
export function setSentryUser(req) {
  if (req.user) {
    Sentry.setUser({
      id: req.user.id,
      email: req.user.email,
    });
  }
}

/**
 * Set Sentry custom context for the current scope.
 * Called from tenant middleware after context is established.
 * @param {import('express').Request} req
 */
export function setSentryContext(req) {
  if (req.tenant) {
    Sentry.setContext('tenant', {
      userId: req.tenant.userId,
      orgId: req.tenant.orgId,
      workspaceId: req.tenant.workspaceId,
      tier: req.tenant.tier,
    });
  }

  if (req.brand) {
    Sentry.setTag('brandId', req.brand.id);
  }

  // Correlation ID from pino logger
  if (req.id) {
    Sentry.setTag('requestId', req.id);
  }
}

/**
 * Capture an exception with brand context attached.
 * Use this instead of Sentry.captureException() when brand context is available.
 * @param {Error} error
 * @param {{ userId?: string, brandId?: string, jobId?: string, model?: string }} context
 */
export function captureWithContext(error, context = {}) {
  Sentry.withScope((scope) => {
    if (context.userId) scope.setUser({ id: context.userId });
    if (context.brandId) scope.setTag('brandId', context.brandId);
    if (context.jobId) scope.setTag('jobId', context.jobId);
    if (context.model) scope.setTag('aiModel', context.model);
    scope.setContext('bmn', context);
    Sentry.captureException(error);
  });
}

/**
 * Redact known secret patterns from strings.
 * @param {string} str
 * @returns {string}
 */
function redactSecrets(str) {
  return str
    .replace(/sk-[a-zA-Z0-9_-]{20,}/g, 'sk-[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/g, 'Bearer [REDACTED]')
    .replace(/key[=:]\s*["']?[a-zA-Z0-9_-]{16,}["']?/gi, 'key=[REDACTED]');
}

export { Sentry };
```

#### Wiring into Express (`server/src/server.js`)

```javascript
// server/src/server.js — TOP OF FILE (before all other imports)

import { initSentry } from './lib/sentry.js';
initSentry(); // MUST be first

import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { sentryRequestHandler, sentryErrorHandler } from './lib/sentry.js';
import { logger } from './lib/logger.js';
import { requestLogger } from './middleware/request-logger.js';
import { authMiddleware } from './middleware/auth.js';
import { tenantContext } from './middleware/tenant.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRoutes } from './routes/health.js';
import { adminRoutes } from './routes/admin.js';

const app = express();

// --- Sentry request handler (FIRST middleware) ---
app.use(sentryRequestHandler);

// --- Other middleware ---
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);
// ... helmet, cors, auth, tenant, rate-limit, etc.

// --- Routes ---
app.use('/health', healthRoutes);
app.use('/ready', healthRoutes);
app.use('/admin', adminRoutes);
// ... API routes ...

// --- Sentry error handler (AFTER routes, BEFORE generic error handler) ---
app.use(sentryErrorHandler);

// --- Generic error handler (LAST) ---
app.use(errorHandler);

const httpServer = createServer(app);
const io = new SocketServer(httpServer, { /* ... */ });

httpServer.listen(process.env.PORT || 3000, () => {
  logger.info({ port: process.env.PORT || 3000 }, 'Server started');
});
```

#### Sentry in Auth Middleware

```javascript
// server/src/middleware/auth.js (relevant addition)

import { setSentryUser } from '../lib/sentry.js';

export async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  req.user = user;

  // Attach user to Sentry scope for all subsequent errors
  setSentryUser(req);

  next();
}
```

#### Sentry in Tenant Middleware

```javascript
// server/src/middleware/tenant.js (relevant addition)

import { setSentryContext } from '../lib/sentry.js';

export function tenantContext(req, res, next) {
  const user = req.user;

  req.tenant = {
    userId: user.id,
    orgId: user.org_id || 'personal',
    workspaceId: req.headers['x-workspace-id'] || 'default',
    tier: user.subscription_tier || 'free',
    limits: getTierLimits(user.subscription_tier),
  };

  // Attach tenant context to Sentry scope
  setSentryContext(req);

  next();
}
```

#### Sentry in BullMQ Workers

Every BullMQ worker wraps its processor in Sentry instrumentation:

```javascript
// server/src/workers/logo-generation.js (pattern for all workers)

import * as Sentry from '@sentry/node';
import { Worker } from 'bullmq';
import { redis } from '../services/redis.js';
import { logger } from '../lib/logger.js';

const logoWorker = new Worker('logo-generation', async (job) => {
  const { userId, brandId, sessionId } = job.data;

  // Create a Sentry transaction for this job
  return Sentry.startSpan(
    {
      op: 'bullmq.process',
      name: `logo-generation:${job.id}`,
      attributes: {
        'bullmq.queue': 'logo-generation',
        'bullmq.job_id': job.id,
        'bmn.user_id': userId,
        'bmn.brand_id': brandId,
      },
    },
    async (span) => {
      try {
        Sentry.setUser({ id: userId });
        Sentry.setTag('brandId', brandId);
        Sentry.setTag('jobId', job.id);

        // ... generation logic ...

        span.setStatus({ code: 1 }); // OK
        return result;
      } catch (error) {
        span.setStatus({ code: 2, message: error.message }); // ERROR
        Sentry.captureException(error, {
          contexts: {
            job: { id: job.id, queue: 'logo-generation', brandId, userId },
          },
        });
        throw error; // Re-throw for BullMQ retry
      }
    }
  );
}, {
  connection: redis,
  concurrency: 3,
});

logoWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err, queue: 'logo-generation' }, 'Logo generation job failed');
});

export { logoWorker };
```

#### Sentry Release Tracking

Tie every Sentry release to the git commit SHA. This enables Sentry to show "introduced in" and "fixed in" annotations on errors.

```javascript
// In sentry.js initialization
release: process.env.SENTRY_RELEASE || `bmn-api@${process.env.npm_package_version}`,
```

The `SENTRY_RELEASE` env var is set in CI/CD:

```yaml
# .github/workflows/deploy.yml (relevant section)
env:
  SENTRY_RELEASE: bmn-api@${{ github.sha }}
```

### 2.2 React SDK — Vite SPA (Frontend)

Install Sentry's React SDK:

```bash
pnpm add @sentry/react
```

#### Initialization (`apps/web/src/lib/sentry.js`)

```javascript
// apps/web/src/lib/sentry.js

import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry for the React SPA.
 * Called once in main.jsx before ReactDOM.createRoot().
 */
export function initSentry() {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE, // 'development' | 'staging' | 'production'
    release: import.meta.env.VITE_SENTRY_RELEASE || 'bmn-web@unknown',

    // Performance monitoring
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.2 : 1.0,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Mask all text for privacy in session replays
        maskAllText: false,
        maskAllInputs: true,
        blockAllMedia: false,
      }),
    ],

    // Session Replay — capture 10% of sessions, 100% on error
    replaysSessionSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 0,
    replaysOnErrorSampleRate: 1.0,

    // Custom tags on every event
    initialScope: {
      tags: {
        app: 'bmn-web',
      },
    },

    beforeSend(event) {
      // Strip auth tokens from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((bc) => {
          if (bc.category === 'fetch' && bc.data?.url) {
            // Don't send full URL if it contains tokens
            bc.data.url = bc.data.url.replace(/token=[^&]+/, 'token=[REDACTED]');
          }
          return bc;
        });
      }
      return event;
    },
  });
}

/**
 * Set Sentry user context after authentication.
 * Call this from the auth store or auth hook when user logs in.
 * @param {{ id: string, email: string }} user
 */
export function setSentryUser(user) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
  });
}

/**
 * Clear Sentry user context on logout.
 */
export function clearSentryUser() {
  Sentry.setUser(null);
}

/**
 * Set brand context for the current Sentry scope.
 * Call this when user enters the wizard or views a brand.
 * @param {string} brandId
 */
export function setSentryBrand(brandId) {
  Sentry.setTag('brandId', brandId);
}

export { Sentry };
```

#### Wiring into React (`apps/web/src/main.jsx`)

```javascript
// apps/web/src/main.jsx

import { initSentry } from './lib/sentry.js';
initSentry(); // MUST be before createRoot

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

#### Error Boundary Component (`apps/web/src/components/ErrorBoundary.jsx`)

A reusable Sentry-integrated error boundary that shows a user-friendly fallback:

```javascript
// apps/web/src/components/ErrorBoundary.jsx

import * as Sentry from '@sentry/react';

/**
 * Fallback UI shown when an error boundary catches an error.
 * @param {{ error: Error, resetError: () => void }} props
 */
function ErrorFallback({ error, resetError }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-full bg-red-100 p-4">
        <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900">Something went wrong</h2>
      <p className="max-w-md text-gray-600">
        We've been notified and are looking into it. You can try refreshing the page or going back.
      </p>
      <div className="flex gap-3">
        <button
          onClick={resetError}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.href = '/'}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Go to dashboard
        </button>
      </div>
      {import.meta.env.DEV && (
        <pre className="mt-4 max-w-lg overflow-auto rounded bg-gray-100 p-3 text-left text-xs text-red-800">
          {error.message}
          {'\n'}
          {error.stack}
        </pre>
      )}
    </div>
  );
}

/**
 * Sentry error boundary wrapper.
 * Wraps children in a Sentry.ErrorBoundary with custom fallback UI.
 * Reports all caught errors to Sentry automatically.
 *
 * Usage:
 *   <SentryErrorBoundary>
 *     <WizardStep />
 *   </SentryErrorBoundary>
 *
 * @param {{ children: React.ReactNode, fallback?: React.ComponentType }} props
 */
export function SentryErrorBoundary({ children, fallback }) {
  return (
    <Sentry.ErrorBoundary
      fallback={fallback || ErrorFallback}
      showDialog={false}
      beforeCapture={(scope) => {
        scope.setTag('boundary', 'react-error-boundary');
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}

/**
 * Wizard-specific error boundary.
 * Includes wizard step context in the Sentry report.
 *
 * @param {{ children: React.ReactNode, step: string }} props
 */
export function WizardErrorBoundary({ children, step }) {
  return (
    <Sentry.ErrorBoundary
      fallback={(props) => <ErrorFallback {...props} />}
      beforeCapture={(scope) => {
        scope.setTag('boundary', 'wizard-error-boundary');
        scope.setTag('wizardStep', step);
        scope.setContext('wizard', { step, timestamp: new Date().toISOString() });
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
```

#### Wrapping Routes with Error Boundaries (`apps/web/src/App.jsx`)

```javascript
// apps/web/src/App.jsx (relevant pattern)

import { SentryErrorBoundary, WizardErrorBoundary } from './components/ErrorBoundary.jsx';

function App() {
  return (
    <SentryErrorBoundary>
      <RouterProvider router={router} />
    </SentryErrorBoundary>
  );
}

// In wizard/layout.jsx:
function WizardLayout() {
  const { currentStep } = useWizardStore((s) => s.meta);

  return (
    <WizardErrorBoundary step={currentStep}>
      <div className="wizard-shell">
        <ProgressBar />
        <Outlet />
      </div>
    </WizardErrorBoundary>
  );
}
```

#### Source Map Uploads in CI/CD

Upload source maps to Sentry during the build step so production errors show original source code, not minified bundles.

```bash
pnpm add -D @sentry/vite-plugin
```

```javascript
// apps/web/vite.config.js

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  build: {
    sourcemap: true, // Required for Sentry source maps
  },
  plugins: [
    react(),
    // Sentry source map upload — only in CI/CD builds
    process.env.SENTRY_AUTH_TOKEN &&
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,           // e.g., 'brandmenow'
        project: process.env.SENTRY_PROJECT,   // e.g., 'bmn-web'
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: {
          name: process.env.VITE_SENTRY_RELEASE,
          setCommits: {
            auto: true, // Associate release with git commits
          },
        },
        sourcemaps: {
          filesToDeleteAfterUpload: '**/*.map', // Don't deploy source maps to CDN
        },
      }),
  ].filter(Boolean),
});
```

GitHub Actions workflow section for source maps:

```yaml
# .github/workflows/deploy-web.yml (relevant section)

jobs:
  build-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Required for Sentry commit tracking

      - uses: pnpm/action-setup@v4

      - name: Build SPA with source maps
        env:
          VITE_SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
          VITE_SENTRY_RELEASE: bmn-web@${{ github.sha }}
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: brandmenow
          SENTRY_PROJECT: bmn-web
        run: pnpm --filter web build

      # Source maps are uploaded during build via sentryVitePlugin
      # and deleted from the output before deploy
```

Server-side source map upload (for the Express.js server):

```yaml
# .github/workflows/deploy-api.yml (relevant section)

      - name: Create Sentry release for API
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: brandmenow
          SENTRY_PROJECT: bmn-api
        run: |
          npx @sentry/cli releases new bmn-api@${{ github.sha }}
          npx @sentry/cli releases set-commits bmn-api@${{ github.sha }} --auto
          npx @sentry/cli releases finalize bmn-api@${{ github.sha }}
```

### 2.3 Python SDK — FastAPI Worker

Install Sentry's Python SDK:

```bash
pip install sentry-sdk[fastapi]
```

#### Initialization (`services/ai-worker/src/sentry_setup.py`)

```python
# services/ai-worker/src/sentry_setup.py

import os
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration


def init_sentry():
    """
    Initialize Sentry for the FastAPI AI worker.
    Must be called before FastAPI app creation.
    """
    sentry_sdk.init(
        dsn=os.environ.get("SENTRY_DSN"),
        environment=os.environ.get("PYTHON_ENV", "development"),
        release=os.environ.get("SENTRY_RELEASE", "bmn-ai-worker@unknown"),
        traces_sample_rate=0.2 if os.environ.get("PYTHON_ENV") == "production" else 1.0,
        profiles_sample_rate=0.1 if os.environ.get("PYTHON_ENV") == "production" else 1.0,
        integrations=[
            FastApiIntegration(),
            StarletteIntegration(),
        ],
        before_send=_before_send,
    )


def _before_send(event, hint):
    """Strip secrets from Sentry events."""
    if "exception" in event:
        for exc in event["exception"].get("values", []):
            if exc.get("value"):
                exc["value"] = _redact_secrets(exc["value"])
    return event


def _redact_secrets(text: str) -> str:
    """Redact API keys and tokens from error messages."""
    import re
    text = re.sub(r"sk-[a-zA-Z0-9_-]{20,}", "sk-[REDACTED]", text)
    text = re.sub(r"Bearer\s+[a-zA-Z0-9._-]+", "Bearer [REDACTED]", text)
    return text


def set_user_context(user_id: str, brand_id: str = None):
    """Set Sentry user and brand context for the current scope."""
    sentry_sdk.set_user({"id": user_id})
    if brand_id:
        sentry_sdk.set_tag("brandId", brand_id)


def capture_ai_error(error: Exception, model: str, user_id: str = None, brand_id: str = None):
    """Capture an AI-related exception with model context."""
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("aiModel", model)
        scope.set_tag("service", "ai-worker")
        if user_id:
            scope.set_user({"id": user_id})
        if brand_id:
            scope.set_tag("brandId", brand_id)
        sentry_sdk.capture_exception(error)
```

#### Wiring into FastAPI (`services/ai-worker/src/api.py`)

```python
# services/ai-worker/src/api.py

from sentry_setup import init_sentry
init_sentry()  # Must be before FastAPI()

from fastapi import FastAPI, Request
import sentry_sdk

app = FastAPI(title="BMN AI Worker", version="2.0.0")


@app.middleware("http")
async def sentry_context_middleware(request: Request, call_next):
    """Attach request context to Sentry for every request."""
    user_id = request.headers.get("x-user-id")
    brand_id = request.headers.get("x-brand-id")
    request_id = request.headers.get("x-request-id")

    if user_id:
        sentry_sdk.set_user({"id": user_id})
    if brand_id:
        sentry_sdk.set_tag("brandId", brand_id)
    if request_id:
        sentry_sdk.set_tag("requestId", request_id)

    response = await call_next(request)
    return response
```

### 2.4 Sentry Alert Rules

Configure these alerts in the Sentry dashboard (or via Sentry's API/Terraform):

| Alert | Condition | Action | Severity |
|-------|-----------|--------|----------|
| **Error Spike** | > 10 errors in 1 minute (any project) | Slack #alerts + PagerDuty | Critical |
| **New Error Type** | First occurrence of a new error fingerprint | Slack #alerts | Warning |
| **p95 Latency > 500ms** | Transaction p95 > 500ms for 5 minutes | Slack #alerts | Warning |
| **p95 Latency > 2s** | Transaction p95 > 2000ms for 5 minutes | Slack #alerts + PagerDuty | Critical |
| **Generation Failure Rate > 10%** | > 10% of `bullmq.process` transactions fail in 10 minutes | Slack #alerts + PagerDuty | Critical |
| **Unhandled Rejection** | Unhandled promise rejection (Node.js) | Slack #alerts | Warning |
| **Auth Failure Spike** | > 10 `401` errors in 1 minute from same IP | Slack #security | Critical |

#### Alert Rule Configuration (Sentry API)

```javascript
// scripts/sentry-setup.js — Run once to configure alert rules via Sentry API

const SENTRY_API = 'https://sentry.io/api/0';
const ORG = 'brandmenow';
const headers = {
  Authorization: `Bearer ${process.env.SENTRY_AUTH_TOKEN}`,
  'Content-Type': 'application/json',
};

const alertRules = [
  {
    name: 'Error Spike (>10/min)',
    dataset: 'events',
    query: 'is:unresolved',
    aggregate: 'count()',
    timeWindow: 1,
    thresholdType: 0,
    triggers: [
      { label: 'critical', alertThreshold: 10, actions: [{ type: 'slack', targetIdentifier: '#alerts' }] },
    ],
  },
  {
    name: 'API p95 Latency >500ms',
    dataset: 'transactions',
    query: 'transaction.op:http.server',
    aggregate: 'p95(transaction.duration)',
    timeWindow: 5,
    thresholdType: 0,
    triggers: [
      { label: 'warning', alertThreshold: 500, actions: [{ type: 'slack', targetIdentifier: '#alerts' }] },
      { label: 'critical', alertThreshold: 2000, actions: [{ type: 'slack', targetIdentifier: '#alerts' }] },
    ],
  },
  {
    name: 'Generation Failure Rate >10%',
    dataset: 'transactions',
    query: 'transaction.op:bullmq.process',
    aggregate: 'failure_rate()',
    timeWindow: 10,
    thresholdType: 0,
    triggers: [
      { label: 'critical', alertThreshold: 0.1, actions: [{ type: 'slack', targetIdentifier: '#alerts' }] },
    ],
  },
];
```

### 2.5 Environment Separation

| Setting | Development | Staging | Production |
|---------|------------|---------|-----------|
| `tracesSampleRate` | 1.0 (100%) | 0.5 (50%) | 0.2 (20%) |
| `profilesSampleRate` | 1.0 | 0.5 | 0.1 (10%) |
| `replaysSessionSampleRate` | 0 | 0.5 | 0.1 (10%) |
| `replaysOnErrorSampleRate` | 0 | 1.0 | 1.0 (100%) |
| Alert notifications | None | Slack only | Slack + PagerDuty |
| Source maps uploaded | No | Yes | Yes |

---

## 3. Structured Logging (pino)

### 3.1 pino Setup for Express.js

Install pino and transports:

```bash
pnpm add pino pino-http pino-pretty uuid
```

#### Logger Factory (`server/src/lib/logger.js`)

```javascript
// server/src/lib/logger.js

import pino from 'pino';

/**
 * Paths to redact from log output.
 * These JSONPath expressions match against the entire log object.
 * Any matching value is replaced with '[REDACTED]'.
 */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'accessToken',
  'refreshToken',
  'stripe_secret_key',
  'sentry_dsn',
  'creditCard',
  'ssn',
];

/**
 * Create the root pino logger.
 *
 * - Development: pino-pretty for human-readable colored output
 * - Production: raw JSON to stdout, shipped by log collector (Betterstack, Datadog, DO Monitoring)
 *
 * @returns {import('pino').Logger}
 */
function createLogger() {
  const isDev = process.env.NODE_ENV !== 'production';

  /** @type {import('pino').LoggerOptions} */
  const options = {
    level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),

    // Redact sensitive fields
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]',
    },

    // Add service metadata to every log line
    base: {
      service: 'bmn-api',
      env: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || 'unknown',
    },

    // ISO timestamp for log aggregation compatibility
    timestamp: pino.stdTimeFunctions.isoTime,

    // Custom serializers for common objects
    serializers: {
      err: pino.stdSerializers.err,
      req: (req) => ({
        method: req.method,
        url: req.url,
        remoteAddress: req.remoteAddress,
        userAgent: req.headers?.['user-agent'],
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
    },

    // Format level as string in production JSON (not integer)
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  };

  // Development: pretty-print to terminal
  if (isDev) {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname,service,env,version',
          messageFormat: '{msg}',
        },
      },
    });
  }

  // Production: raw JSON to stdout
  // Log shipping handled by container runtime / Betterstack agent / DO log drain
  return pino(options);
}

export const logger = createLogger();

/**
 * Create a child logger with additional context bound.
 * Used to create per-request or per-job loggers that inherit the correlation ID.
 *
 * @param {Object} bindings - Key-value pairs to attach to every log from this child
 * @returns {import('pino').Logger}
 *
 * @example
 * const reqLogger = createChildLogger({ requestId: req.id, userId: req.user?.id });
 * reqLogger.info('Processing request');
 * // Output: { requestId: "abc-123", userId: "user-456", msg: "Processing request", ... }
 */
export function createChildLogger(bindings) {
  return logger.child(bindings);
}
```

### 3.2 Request/Response Logging Middleware

Every HTTP request is logged with a unique correlation ID (`requestId`) that flows through the entire request lifecycle.

```javascript
// server/src/middleware/request-logger.js

import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import { logger } from '../lib/logger.js';

/**
 * pino-http middleware for Express.js.
 *
 * - Generates a unique requestId per request (UUID v4)
 * - Logs request start and response completion
 * - Attaches a child logger to req.log with requestId bound
 * - Measures request duration automatically
 * - Includes userId after auth middleware runs
 *
 * Log output fields:
 *   requestId, method, url, statusCode, responseTime, userId, userAgent, contentLength
 */
export const requestLogger = pinoHttp({
  logger,

  // Generate unique request ID
  genReqId: (req) => {
    // Use incoming request ID header (from load balancer / CDN) or generate new
    const id = req.headers['x-request-id'] || randomUUID();
    req.id = id;
    return id;
  },

  // Customize the log level based on response status code
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    if (res.statusCode >= 300) return 'silent'; // Don't log redirects
    return 'info';
  },

  // What to include in the request log
  customProps: (req) => ({
    userId: req.user?.id || null,
    tenantId: req.tenant?.orgId || null,
    brandId: req.params?.brandId || req.body?.brandId || null,
  }),

  // Custom success message
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },

  // Custom error message
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
  },

  // Fields to include in the serialized request object
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
      remoteAddress: req.remoteAddress,
      userAgent: req.headers['user-agent'],
      contentLength: req.headers['content-length'],
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      contentLength: res.getHeader?.('content-length'),
    }),
  },

  // Don't log these paths (health checks, static assets)
  autoLogging: {
    ignore: (req) => {
      const ignorePaths = ['/health', '/ready', '/favicon.ico'];
      return ignorePaths.some((p) => req.url.startsWith(p));
    },
  },

  // Attach the request ID to the response header
  customResponseHeader: (req) => ({
    'X-Request-Id': req.id,
  }),
});
```

### 3.3 Child Loggers per Request

After the request-logger middleware runs, `req.log` is a child logger with `requestId` already bound. Use `req.log` in route handlers to get automatic correlation:

```javascript
// server/src/routes/brands.js (example usage)

import { Router } from 'express';

const router = Router();

router.get('/:brandId', async (req, res) => {
  const { brandId } = req.params;

  // req.log is a pino child logger with requestId + userId already bound
  req.log.info({ brandId }, 'Fetching brand details');

  try {
    const brand = await getBrand(brandId, req.tenant.userId);
    req.log.debug({ brandId, status: brand.status }, 'Brand fetched successfully');
    res.json(brand);
  } catch (err) {
    req.log.error({ brandId, err }, 'Failed to fetch brand');
    throw err;
  }
});

export { router as brandsRouter };
```

### 3.4 Child Logger for BullMQ Workers

BullMQ workers don't have `req.log`. Create a child logger per job:

```javascript
// server/src/workers/_shared/job-logger.js

import { createChildLogger } from '../lib/logger.js';

/**
 * Create a child logger for a BullMQ job.
 * Binds jobId, queue, userId, and brandId to every log line from this job.
 *
 * @param {import('bullmq').Job} job
 * @param {string} queueName
 * @returns {import('pino').Logger}
 */
export function createJobLogger(job, queueName) {
  return createChildLogger({
    jobId: job.id,
    queue: queueName,
    userId: job.data.userId,
    brandId: job.data.brandId,
    attempt: job.attemptsMade + 1,
  });
}
```

Usage in a worker:

```javascript
// server/src/workers/logo-generation.js (with logging)

import { Worker } from 'bullmq';
import { createJobLogger } from './_shared/job-logger.js';

const logoWorker = new Worker('logo-generation', async (job) => {
  const log = createJobLogger(job, 'logo-generation');

  log.info('Starting logo generation');
  log.debug({ prompt: job.data.prompt, style: job.data.style }, 'Job parameters');

  try {
    // Step 1: Compose prompt
    log.info({ step: 'compose-prompt' }, 'Composing prompt with Claude');
    const prompt = await composePrompt(job.data);

    // Step 2: Generate logo
    log.info({ step: 'generate', model: 'flux-2-pro' }, 'Generating logo with FLUX.2 Pro');
    const result = await generateLogo(prompt);

    // Step 3: Upload
    log.info({ step: 'upload', size: result.size }, 'Uploading to storage');
    const url = await uploadToStorage(result.buffer);

    log.info({ step: 'complete', url }, 'Logo generation complete');
    return { url, metadata: result.metadata };
  } catch (err) {
    log.error({ err, step: 'failed' }, 'Logo generation failed');
    throw err;
  }
}, { connection: redis });
```

### 3.5 Log Levels Usage Guide

| Level | When to Use | Example |
|-------|------------|---------|
| `fatal` | Process is crashing. Unrecoverable. | `logger.fatal({ err }, 'Redis connection lost, shutting down')` |
| `error` | Operation failed. Needs attention. | `req.log.error({ err, brandId }, 'Logo generation failed')` |
| `warn` | Degraded operation. Fallback used. | `log.warn({ primary: 'flux-2-pro', fallback: 'flux-2-dev' }, 'Primary model failed, using fallback')` |
| `info` | Normal operation. Business events. | `log.info({ brandId, step: 'complete' }, 'Brand wizard completed')` |
| `debug` | Detailed operational data. Dev use. | `log.debug({ prompt, tokens: 1523 }, 'AI prompt composed')` |
| `trace` | Very verbose. Function-level tracing. | `log.trace({ fn: 'composePrompt', input }, 'Entering composePrompt')` |

Production default: `info`. Set `LOG_LEVEL=debug` temporarily for troubleshooting.

### 3.6 Log Redaction Rules

The pino redact configuration (in `logger.js`) ensures these fields are **never** written to logs:

| Field Path | What It Catches |
|------------|----------------|
| `req.headers.authorization` | Bearer tokens in request logs |
| `req.headers.cookie` | Session cookies |
| `req.headers["x-api-key"]` | API keys in headers |
| `password` | Any field named "password" at any depth |
| `token` | Any field named "token" at any depth |
| `secret` | Any field named "secret" at any depth |
| `apiKey`, `api_key` | API keys passed in request body or context |
| `accessToken`, `refreshToken` | OAuth tokens |

If a developer accidentally logs `{ password: 'hunter2' }`, pino outputs `{ password: '[REDACTED]' }`.

### 3.7 Log Shipping to Betterstack

In production, pino writes JSON to stdout. The container runtime (Docker / K8s) captures stdout. Log shipping is handled by one of these methods:

**Option A: Betterstack (recommended for simplicity)**

Install the Betterstack log drain agent on the DO K8s cluster:

```yaml
# k8s/betterstack-agent.yml

apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: betterstack-logs
  namespace: logging
spec:
  selector:
    matchLabels:
      app: betterstack-logs
  template:
    metadata:
      labels:
        app: betterstack-logs
    spec:
      containers:
        - name: vector
          image: timberio/vector:0.41-alpine
          env:
            - name: BETTERSTACK_SOURCE_TOKEN
              valueFrom:
                secretKeyRef:
                  name: betterstack-credentials
                  key: source-token
          volumeMounts:
            - name: varlog
              mountPath: /var/log
              readOnly: true
      volumes:
        - name: varlog
          hostPath:
            path: /var/log
```

**Option B: pino transport (if not using a log agent)**

For non-K8s deployments (single droplet), use a pino transport to ship logs directly:

```bash
pnpm add pino-transport-http
```

```javascript
// server/src/lib/logger.js (production transport alternative)

// Only if NOT using a K8s log agent:
if (process.env.BETTERSTACK_SOURCE_TOKEN) {
  return pino({
    ...options,
    transport: {
      targets: [
        {
          target: 'pino/file',        // Also write to stdout for K8s
          options: { destination: 1 }, // fd 1 = stdout
          level: 'info',
        },
        {
          target: 'pino-transport-http',
          options: {
            url: 'https://in.logs.betterstack.com',
            headers: {
              Authorization: `Bearer ${process.env.BETTERSTACK_SOURCE_TOKEN}`,
            },
            batchSize: 100,
            interval: 5000, // Flush every 5 seconds
          },
          level: 'info',
        },
      ],
    },
  });
}
```

**Option C: DigitalOcean Monitoring**

If using DO K8s, enable the DO Monitoring integration which captures container stdout automatically. No additional agent needed — just enable the DO Monitoring add-on on the cluster.

### 3.8 Python: structlog for FastAPI Worker

Install structlog:

```bash
pip install structlog
```

#### structlog Setup (`services/ai-worker/src/logging_setup.py`)

```python
# services/ai-worker/src/logging_setup.py

import os
import logging
import structlog


def setup_logging():
    """
    Configure structlog for the FastAPI AI worker.
    - Development: colored console output
    - Production: JSON to stdout (shipped by container runtime)
    """
    is_dev = os.environ.get("PYTHON_ENV", "development") != "production"

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
        _redact_secrets,
        _add_service_info,
    ]

    if is_dev:
        # Colored console output for development
        structlog.configure(
            processors=shared_processors + [
                structlog.dev.ConsoleRenderer(colors=True),
            ],
            wrapper_class=structlog.stdlib.BoundLogger,
            context_class=dict,
            logger_factory=structlog.PrintLoggerFactory(),
            cache_logger_on_first_use=True,
        )
    else:
        # JSON output for production
        structlog.configure(
            processors=shared_processors + [
                structlog.processors.format_exc_info,
                structlog.processors.JSONRenderer(),
            ],
            wrapper_class=structlog.stdlib.BoundLogger,
            context_class=dict,
            logger_factory=structlog.PrintLoggerFactory(),
            cache_logger_on_first_use=True,
        )

    # Set stdlib logging level
    logging.basicConfig(
        format="%(message)s",
        level=logging.DEBUG if is_dev else logging.INFO,
    )


def _redact_secrets(logger, method_name, event_dict):
    """Redact known secret patterns from log events."""
    import re
    for key, value in list(event_dict.items()):
        if isinstance(value, str):
            if key.lower() in ("password", "token", "secret", "api_key", "apikey", "authorization"):
                event_dict[key] = "[REDACTED]"
            else:
                event_dict[key] = re.sub(r"sk-[a-zA-Z0-9_-]{20,}", "sk-[REDACTED]", value)
    return event_dict


def _add_service_info(logger, method_name, event_dict):
    """Add service metadata to every log entry."""
    event_dict["service"] = "bmn-ai-worker"
    event_dict["env"] = os.environ.get("PYTHON_ENV", "development")
    return event_dict


def get_logger(name: str = None, **initial_bindings):
    """
    Get a structlog logger with optional initial bindings.

    Usage:
        log = get_logger("image-compose", user_id="abc", brand_id="def")
        log.info("composing image", width=1024, height=1024)
    """
    log = structlog.get_logger(name)
    if initial_bindings:
        log = log.bind(**initial_bindings)
    return log
```

#### Usage in FastAPI routes:

```python
# services/ai-worker/src/api.py

from logging_setup import setup_logging, get_logger

setup_logging()  # Call once at startup

log = get_logger("api")


@app.post("/compose")
async def compose_image(request: ComposeRequest):
    """Compose multiple product images into a bundle image."""
    req_log = get_logger(
        "compose",
        user_id=request.user_id,
        brand_id=request.brand_id,
        request_id=request.request_id,
    )

    req_log.info("starting image composition", image_count=len(request.images))

    try:
        result = await run_composition(request)
        req_log.info("composition complete", output_size=result.size)
        return result
    except Exception as e:
        req_log.error("composition failed", error=str(e))
        raise
```

---

## 4. PostHog Product Analytics

### 4.1 PostHog JS SDK — React SPA

Install the PostHog JS SDK:

```bash
pnpm add posthog-js
```

#### Initialization (`apps/web/src/lib/posthog.js`)

```javascript
// apps/web/src/lib/posthog.js

import posthog from 'posthog-js';

/**
 * Initialize PostHog for the React SPA.
 * Called once in main.jsx after Sentry init.
 */
export function initPostHog() {
  if (!import.meta.env.VITE_POSTHOG_API_KEY) {
    console.warn('[PostHog] No API key found. Analytics disabled.');
    return;
  }

  posthog.init(import.meta.env.VITE_POSTHOG_API_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only',

    // Autocapture settings
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,

    // Session replay
    disable_session_recording: import.meta.env.MODE === 'development',
    session_recording: {
      maskAllInputs: true,      // Never record input values
      maskTextSelector: '.ph-mask', // Mask elements with this class
    },

    // Feature flags
    bootstrap: {}, // Pre-loaded feature flags (populated by server on auth)
    advanced_disable_feature_flags: false,

    // Privacy
    respect_dnt: true,          // Honor Do Not Track browser setting
    opt_out_capturing_by_default: false,
    sanitize_properties: (properties) => {
      // Never send these properties to PostHog
      delete properties.$ip;
      return properties;
    },

    // Performance
    loaded: (ph) => {
      // In development, enable debug mode
      if (import.meta.env.DEV) {
        ph.debug();
      }
    },
  });
}

/**
 * Identify a user after authentication.
 * Links anonymous events to the authenticated user.
 *
 * @param {{ id: string, email: string, subscription_tier?: string, created_at?: string }} user
 */
export function identifyUser(user) {
  posthog.identify(user.id, {
    email: user.email,
    subscription_tier: user.subscription_tier || 'free',
    created_at: user.created_at,
  });
}

/**
 * Reset PostHog identity on logout.
 * Future events will be anonymous until next identify().
 */
export function resetIdentity() {
  posthog.reset();
}

/**
 * Track a custom event.
 *
 * @param {string} eventName - The event name (e.g., 'wizard_step_completed')
 * @param {Object} [properties] - Additional properties
 */
export function trackEvent(eventName, properties = {}) {
  posthog.capture(eventName, properties);
}

/**
 * Check if a feature flag is enabled.
 *
 * @param {string} flagKey - The feature flag key
 * @returns {boolean}
 */
export function isFeatureEnabled(flagKey) {
  return posthog.isFeatureEnabled(flagKey);
}

/**
 * Get a feature flag's payload (for multivariate flags).
 *
 * @param {string} flagKey
 * @returns {*}
 */
export function getFeatureFlagPayload(flagKey) {
  return posthog.getFeatureFlagPayload(flagKey);
}

export { posthog };
```

#### PostHog React Provider (`apps/web/src/providers/PostHogProvider.jsx`)

```javascript
// apps/web/src/providers/PostHogProvider.jsx

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { posthog } from '../lib/posthog.js';

/**
 * PostHog page view tracker.
 * Wraps the app to capture page views on route changes.
 * React Router v7 doesn't trigger native page loads on navigation,
 * so we need to capture page views manually.
 *
 * @param {{ children: React.ReactNode }} props
 */
export function PostHogProvider({ children }) {
  const location = useLocation();

  useEffect(() => {
    // Capture page view on every route change
    posthog.capture('$pageview', {
      $current_url: window.location.href,
      path: location.pathname,
    });
  }, [location.pathname]);

  return children;
}
```

#### Wiring into React App (`apps/web/src/main.jsx`)

```javascript
// apps/web/src/main.jsx

import { initSentry } from './lib/sentry.js';
initSentry();

import { initPostHog } from './lib/posthog.js';
initPostHog();

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

```javascript
// apps/web/src/App.jsx (relevant structure)

import { PostHogProvider } from './providers/PostHogProvider.jsx';

function App() {
  return (
    <BrowserRouter>
      <PostHogProvider>
        <SentryErrorBoundary>
          <Routes>
            {/* ... */}
          </Routes>
        </SentryErrorBoundary>
      </PostHogProvider>
    </BrowserRouter>
  );
}
```

### 4.2 Events to Track

Every event follows the naming convention: `{noun}_{past_tense_verb}` (e.g., `wizard_started`, `logo_generated`).

#### Onboarding & Authentication Events

| Event | Properties | Where Captured |
|-------|-----------|----------------|
| `signup_completed` | `{ method: 'email' \| 'google', referrer }` | Frontend (auth callback) |
| `login_completed` | `{ method: 'email' \| 'google' }` | Frontend (auth callback) |
| `phone_submitted` | `{}` | Frontend (onboarding step) |
| `tc_accepted` | `{ timestamp }` | Frontend (onboarding step) |

#### Wizard Events

| Event | Properties | Where Captured |
|-------|-----------|----------------|
| `wizard_started` | `{ brandId }` | Frontend (wizard entry) |
| `wizard_step_completed` | `{ brandId, step, stepName, duration_ms }` | Frontend (step transition) |
| `wizard_step_viewed` | `{ brandId, step, stepName }` | Frontend (step mount) |
| `wizard_abandoned` | `{ brandId, lastStep, lastStepName, totalDuration_ms }` | Server (cron / session timeout) |
| `wizard_completed` | `{ brandId, totalDuration_ms, stepsCompleted }` | Frontend (completion screen) |
| `wizard_resumed` | `{ brandId, resumeStep }` | Frontend (resume token used) |

#### Generation Events

| Event | Properties | Where Captured |
|-------|-----------|----------------|
| `logo_generation_started` | `{ brandId, jobId, style }` | Server (job queued) |
| `logo_generated` | `{ brandId, jobId, model, duration_ms, cost }` | Server (job complete) |
| `logo_selected` | `{ brandId, logoId, position }` | Frontend (user selection) |
| `logo_regenerated` | `{ brandId, jobId, round }` | Server (regeneration job) |
| `mockup_generation_started` | `{ brandId, jobId, productSku }` | Server (job queued) |
| `mockup_generated` | `{ brandId, jobId, productSku, model, duration_ms, cost }` | Server (job complete) |
| `mockup_approved` | `{ brandId, mockupId, productSku }` | Frontend (user approval) |
| `mockup_rejected` | `{ brandId, mockupId, productSku }` | Frontend (user rejection) |
| `bundle_created` | `{ brandId, bundleId, productCount }` | Frontend (bundle builder) |

#### Business Events

| Event | Properties | Where Captured |
|-------|-----------|----------------|
| `checkout_started` | `{ brandId, tier }` | Frontend (Stripe redirect) |
| `subscription_created` | `{ userId, tier, mrr, stripeId }` | Server (Stripe webhook) |
| `subscription_upgraded` | `{ userId, fromTier, toTier, mrr }` | Server (Stripe webhook) |
| `subscription_cancelled` | `{ userId, tier, reason }` | Server (Stripe webhook) |
| `credits_exhausted` | `{ userId, tier, creditType }` | Server (credit check) |

#### Engagement Events

| Event | Properties | Where Captured |
|-------|-----------|----------------|
| `chatbot_message_sent` | `{ brandId, messageLength, isFirstMessage }` | Frontend (chat widget) |
| `chatbot_response_received` | `{ brandId, model, duration_ms, tokens }` | Server (chat handler) |
| `support_requested` | `{ brandId, source: 'chatbot' \| 'dashboard' }` | Frontend (support button) |
| `asset_downloaded` | `{ brandId, assetType, format }` | Frontend (download click) |
| `brand_shared` | `{ brandId, shareMethod }` | Frontend (share button) |

#### Implementation in Wizard Steps

```javascript
// apps/web/src/routes/wizard/logo-generation.jsx (example)

import { trackEvent } from '../../lib/posthog.js';
import { useWizardStore } from '../../stores/wizard-store.js';

export default function LogoGeneration() {
  const { brandId } = useWizardStore((s) => s.meta);
  const [generationStart, setGenerationStart] = useState(null);

  // Track step view
  useEffect(() => {
    trackEvent('wizard_step_viewed', {
      brandId,
      step: 5,
      stepName: 'logo-generation',
    });
  }, [brandId]);

  async function handleGenerate(style) {
    setGenerationStart(Date.now());

    trackEvent('logo_generation_started', {
      brandId,
      style,
    });

    const { jobId } = await api.post('/api/v1/generation/logos', { brandId, style });
    // Socket.io handles progress updates...
  }

  function handleLogoSelect(logoId, position) {
    trackEvent('logo_selected', {
      brandId,
      logoId,
      position, // Which of the 4 logos was selected (1-4)
    });
  }

  function handleStepComplete() {
    trackEvent('wizard_step_completed', {
      brandId,
      step: 5,
      stepName: 'logo-generation',
      duration_ms: Date.now() - generationStart,
    });

    navigate('/wizard/logo-refinement');
  }

  // ... render ...
}
```

### 4.3 Server-Side Event Capture — PostHog Node SDK

Install the PostHog Node SDK for server-side event tracking:

```bash
pnpm add posthog-node
```

#### PostHog Server Client (`server/src/lib/posthog.js`)

```javascript
// server/src/lib/posthog.js

import { PostHog } from 'posthog-node';
import { logger } from './logger.js';

/** @type {PostHog | null} */
let posthogClient = null;

/**
 * Initialize the PostHog Node.js client.
 * Call once at server startup.
 */
export function initPostHog() {
  if (!process.env.POSTHOG_API_KEY) {
    logger.warn('PostHog API key not set. Server-side analytics disabled.');
    return;
  }

  posthogClient = new PostHog(process.env.POSTHOG_API_KEY, {
    host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
    flushAt: 20,       // Flush after 20 events
    flushInterval: 10000, // Or every 10 seconds
  });

  logger.info('PostHog server-side client initialized');
}

/**
 * Capture a server-side event.
 * Used for events that happen on the server (webhook processing, job completion, etc.)
 *
 * @param {string} userId - The user ID (distinctId in PostHog)
 * @param {string} eventName - Event name
 * @param {Object} [properties] - Event properties
 */
export function captureEvent(userId, eventName, properties = {}) {
  if (!posthogClient) return;

  posthogClient.capture({
    distinctId: userId,
    event: eventName,
    properties: {
      ...properties,
      $lib: 'posthog-node',
      source: 'server',
    },
  });
}

/**
 * Check if a feature flag is enabled for a user.
 * Server-side feature flag evaluation.
 *
 * @param {string} userId
 * @param {string} flagKey
 * @returns {Promise<boolean>}
 */
export async function isFeatureEnabled(userId, flagKey) {
  if (!posthogClient) return false;
  return posthogClient.isFeatureEnabled(flagKey, userId);
}

/**
 * Flush all pending events. Call on server shutdown.
 */
export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}

export { posthogClient };
```

#### Server-Side Event Capture in Workers

```javascript
// server/src/workers/logo-generation.js (PostHog integration)

import { captureEvent } from '../lib/posthog.js';

// Inside the worker processor, after generation completes:
captureEvent(userId, 'logo_generated', {
  brandId,
  jobId: job.id,
  model: 'flux-2-pro',
  duration_ms: Date.now() - startTime,
  cost: generationCost,
  logoCount: 4,
});
```

```javascript
// server/src/routes/webhooks.js (Stripe webhook handler)

import { captureEvent } from '../lib/posthog.js';

// After processing a subscription creation webhook:
captureEvent(userId, 'subscription_created', {
  tier: subscription.tier,
  mrr: subscription.amount / 100,
  stripeId: subscription.id,
});
```

### 4.4 User Identification (Anonymous to Authenticated)

PostHog must link anonymous browsing events to the authenticated user identity. This is handled by the `identify()` call after login:

```javascript
// apps/web/src/stores/auth-store.js (relevant snippet)

import { identifyUser, resetIdentity } from '../lib/posthog.js';
import { setSentryUser, clearSentryUser } from '../lib/sentry.js';

export const useAuthStore = create((set) => ({
  user: null,

  setUser: (user) => {
    set({ user });

    if (user) {
      // Link anonymous PostHog events to this user
      identifyUser({
        id: user.id,
        email: user.email,
        subscription_tier: user.subscription_tier,
        created_at: user.created_at,
      });

      // Set Sentry user context
      setSentryUser(user);
    }
  },

  logout: () => {
    set({ user: null });
    resetIdentity();       // PostHog: reset anonymous ID
    clearSentryUser();     // Sentry: clear user context
  },
}));
```

### 4.5 Feature Flags

PostHog feature flags control gradual rollouts and A/B tests:

| Flag Key | Type | Purpose |
|----------|------|---------|
| `video-generation` | Boolean | Phase 2: Enable Veo 3 video generation for Pro+ users |
| `new-logo-model` | Boolean | Test FLUX.2 Pro vs FLUX.2 Dev for logo generation |
| `wizard-v2-ui` | Boolean | A/B test redesigned wizard step UI |
| `ideogram-text` | Boolean | Enable Ideogram v3 for text-in-image generation |
| `chatbot-model` | Multivariate | `haiku-4-5` vs `gemini-3-flash` for chatbot responses |

Usage in React:

```javascript
// apps/web/src/routes/wizard/product-selection.jsx

import { isFeatureEnabled } from '../../lib/posthog.js';

export default function ProductSelection() {
  const showVideoProducts = isFeatureEnabled('video-generation');

  return (
    <div>
      <ProductGrid categories={['apparel', 'accessories', 'home-goods']} />
      {showVideoProducts && (
        <ProductGrid categories={['video-showcase']} label="NEW: Video Products" />
      )}
    </div>
  );
}
```

Usage on the server:

```javascript
// server/src/workers/logo-generation.js

import { isFeatureEnabled } from '../lib/posthog.js';

// Inside worker processor:
const useFlux2Dev = await isFeatureEnabled(userId, 'new-logo-model');
const model = useFlux2Dev ? 'flux-2-dev' : 'flux-2-pro';
```

### 4.6 Session Replay Configuration

PostHog Session Replay records user sessions for debugging and UX analysis. Configuration (already in `initPostHog()`):

- **Enabled:** Production and staging only (disabled in development)
- **Privacy:** All input values masked. Elements with `.ph-mask` class have text masked.
- **Sampling:** Record 10% of normal sessions, 100% of sessions that contain an error.
- **Retention:** 30 days (PostHog default)

Mark sensitive UI elements:

```javascript
// apps/web/src/components/ui/Input.jsx

export function SensitiveInput({ ...props }) {
  return <input className="ph-mask" type="password" {...props} />;
}
```

### 4.7 Funnel Definitions

Define these funnels in the PostHog dashboard:

#### Primary Funnel: Signup to Paid Conversion

```
signup_completed
  → wizard_started
  → wizard_step_completed (step: 'social-analysis')
  → wizard_step_completed (step: 'brand-identity')
  → wizard_step_completed (step: 'logo-generation')
  → wizard_step_completed (step: 'product-selection')
  → wizard_step_completed (step: 'mockup-review')
  → wizard_completed
  → checkout_started
  → subscription_created
```

#### Generation Quality Funnel

```
logo_generation_started
  → logo_generated
  → logo_selected (first_round = true)    // Did they pick one without regenerating?
  OR
  → logo_regenerated                       // Did they need to regenerate?
  → logo_selected (first_round = false)
```

#### Engagement Funnel

```
wizard_completed
  → chatbot_message_sent (within 7 days)
  → asset_downloaded (within 7 days)
  → brand_shared (within 7 days)
```

### 4.8 Custom Dashboards

Create these PostHog dashboards:

#### Dashboard: Wizard Performance

| Widget | Type | Metric |
|--------|------|--------|
| Wizard starts per day | Trend | `wizard_started` count |
| Wizard completion rate | Funnel | `wizard_started` → `wizard_completed` |
| Average wizard duration | Trend | `wizard_completed.totalDuration_ms` avg |
| Drop-off by step | Funnel | Step-by-step breakdown |
| Logo satisfaction (no regen) | Trend | `logo_selected` where `round = 1` / total |

#### Dashboard: Revenue

| Widget | Type | Metric |
|--------|------|--------|
| New subscriptions per day | Trend | `subscription_created` count |
| MRR by tier | Breakdown | `subscription_created.mrr` by tier |
| Trial to paid conversion | Funnel | `signup_completed` → `subscription_created` |
| Churn rate | Trend | `subscription_cancelled` / active subscriptions |

#### Dashboard: AI Generation

| Widget | Type | Metric |
|--------|------|--------|
| Generations per day | Trend | `logo_generated` + `mockup_generated` count |
| Generation success rate | Trend | succeeded / (succeeded + failed) |
| Avg generation time | Trend | `logo_generated.duration_ms` avg |
| Cost per brand | Trend | Sum of generation costs per brandId |
| Model usage breakdown | Breakdown | Generation events by model |

---

## 5. Bull Board Job Monitoring

### 5.1 Bull Board Express Middleware

Install Bull Board:

```bash
pnpm add @bull-board/express @bull-board/api @bull-board/ui
```

#### Setup (`server/src/lib/bull-board.js`)

```javascript
// server/src/lib/bull-board.js

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { redis } from '../services/redis.js';

/**
 * Queue names that match the BullMQ workers defined in server/src/workers/.
 * Every queue registered here appears in the Bull Board dashboard.
 */
const QUEUE_NAMES = [
  'brand-analysis',
  'logo-generation',
  'mockup-generation',
  'bundle-composition',
  'crm-sync',
  'email-send',
  'cleanup',
  'webhook-process',
];

/**
 * Create Bull Board Express adapter and register all queues.
 * Returns an Express adapter that can be mounted as middleware.
 *
 * @returns {{ serverAdapter: ExpressAdapter, queues: Queue[] }}
 */
export function createBullBoardAdapter() {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  const queues = QUEUE_NAMES.map((name) => new Queue(name, { connection: redis }));

  createBullBoard({
    queues: queues.map((q) => new BullMQAdapter(q)),
    serverAdapter,
    options: {
      uiConfig: {
        boardTitle: 'Brand Me Now — Job Queues',
        boardLogo: { path: '' },
        miscLinks: [
          { text: 'API Health', url: '/health' },
          { text: 'Sentry', url: 'https://brandmenow.sentry.io' },
          { text: 'PostHog', url: 'https://us.posthog.com/project/bmn' },
        ],
      },
    },
  });

  return { serverAdapter, queues };
}
```

### 5.2 Mounting at `/admin/queues` with Admin Auth

Bull Board is mounted behind admin-only authentication. Only users with `role: 'admin'` in Supabase can access it.

```javascript
// server/src/routes/admin.js

import { Router } from 'express';
import { createBullBoardAdapter } from '../lib/bull-board.js';
import { authMiddleware } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';

const router = Router();

// Admin-only middleware
async function requireAdmin(req, res, next) {
  // authMiddleware already ran and set req.user
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Check admin role in Supabase user metadata or profiles table
  const isAdmin = req.user.app_metadata?.role === 'admin'
    || req.user.user_metadata?.role === 'admin';

  if (!isAdmin) {
    logger.warn({ userId: req.user.id, path: req.path }, 'Non-admin attempted to access admin route');
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

// Mount Bull Board at /admin/queues
const { serverAdapter } = createBullBoardAdapter();

router.use('/queues', authMiddleware, requireAdmin, serverAdapter.getRouter());

export { router as adminRoutes };
```

### 5.3 Queue Dashboard Capabilities

Bull Board provides these capabilities per queue:

| Capability | Description |
|-----------|-------------|
| **View all jobs** | See waiting, active, completed, failed, delayed, paused jobs |
| **Job details** | View job data payload, return value, error stack, progress, timestamps |
| **Retry failed jobs** | Click to retry individual failed jobs |
| **Remove jobs** | Delete completed or failed jobs manually |
| **Promote delayed** | Promote a delayed job to immediate execution |
| **Pause/Resume** | Pause or resume an entire queue |
| **Clean old jobs** | Bulk remove completed jobs older than N days |

### 5.4 Queue Health Metrics

In addition to Bull Board UI, expose queue metrics via the health endpoint for monitoring:

```javascript
// server/src/routes/health.js (queue health section)

import { Queue } from 'bullmq';
import { redis } from '../services/redis.js';

const QUEUE_NAMES = [
  'brand-analysis', 'logo-generation', 'mockup-generation',
  'bundle-composition', 'crm-sync', 'email-send', 'cleanup',
];

/**
 * Get queue health metrics for all BullMQ queues.
 * Used by the /ready endpoint and admin monitoring.
 */
export async function getQueueMetrics() {
  const metrics = {};

  for (const name of QUEUE_NAMES) {
    const queue = new Queue(name, { connection: redis });
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    metrics[name] = { waiting, active, completed, failed, delayed };
    await queue.close();
  }

  return metrics;
}
```

---

## 6. Health Checks

### 6.1 Liveness Probe (`/health`)

Returns `200 OK` if the Express.js process is running and can respond to HTTP requests. This is the simplest possible check — no external dependencies.

```javascript
// server/src/routes/health.js

import { Router } from 'express';
import { redis } from '../services/redis.js';
import { supabase } from '../services/supabase.js';
import { getQueueMetrics } from './health.js';

const router = Router();

/**
 * GET /health — Liveness probe.
 * Returns 200 if Express is responding. Does NOT check external dependencies.
 * K8s uses this for livenessProbe — if it fails, the pod is restarted.
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || 'unknown',
  });
});

/**
 * GET /ready — Readiness probe.
 * Returns 200 only if ALL external dependencies are connected and responsive.
 * K8s uses this for readinessProbe — if it fails, the pod is removed from the Service
 * (no traffic routed to it) but NOT restarted.
 *
 * Checks:
 * 1. Redis is connected (BullMQ, cache, rate limiting depend on it)
 * 2. Supabase is reachable (database, auth)
 * 3. Sentry is initialized (error tracking)
 */
router.get('/ready', async (req, res) => {
  const checks = {};
  let allHealthy = true;

  // Check 1: Redis
  try {
    const start = Date.now();
    await redis.ping();
    checks.redis = { status: 'ok', latency_ms: Date.now() - start };
  } catch (err) {
    checks.redis = { status: 'error', error: err.message };
    allHealthy = false;
  }

  // Check 2: Supabase
  try {
    const start = Date.now();
    const { error } = await supabase.from('profiles').select('id').limit(1);
    if (error) throw error;
    checks.supabase = { status: 'ok', latency_ms: Date.now() - start };
  } catch (err) {
    checks.supabase = { status: 'error', error: err.message };
    allHealthy = false;
  }

  // Check 3: Sentry
  try {
    const Sentry = await import('@sentry/node');
    const client = Sentry.getClient();
    checks.sentry = { status: client ? 'ok' : 'not_initialized' };
    if (!client) allHealthy = false;
  } catch (err) {
    checks.sentry = { status: 'error', error: err.message };
    allHealthy = false;
  }

  // Check 4: Queue metrics (informational, doesn't affect readiness)
  try {
    checks.queues = await getQueueMetrics();
  } catch (err) {
    checks.queues = { status: 'error', error: err.message };
    // Don't fail readiness for queue metrics — queues work if Redis is up
  }

  const status = allHealthy ? 200 : 503;
  res.status(status).json({
    status: allHealthy ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks,
  });
});

export { router as healthRoutes };
```

### 6.2 Kubernetes Probe Configuration

```yaml
# k8s/api-deployment.yml (relevant section)

apiVersion: apps/v1
kind: Deployment
metadata:
  name: bmn-api
  namespace: brandmenow
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: bmn-api
          image: registry.digitalocean.com/brandmenow/bmn-api:latest
          ports:
            - containerPort: 3000

          # Liveness: Is the process alive?
          # If this fails 3 times, K8s restarts the pod.
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10    # Wait 10s after container start
            periodSeconds: 15          # Check every 15s
            timeoutSeconds: 5          # Timeout after 5s
            failureThreshold: 3        # Restart after 3 consecutive failures
            successThreshold: 1

          # Readiness: Can this pod serve traffic?
          # If this fails, pod is removed from Service endpoints (no traffic).
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 15    # Wait 15s (Redis + Supabase connect)
            periodSeconds: 10          # Check every 10s
            timeoutSeconds: 10         # Timeout after 10s (Supabase query)
            failureThreshold: 3        # Remove from service after 3 failures
            successThreshold: 1

          # Startup: Is the container still starting?
          # Protects slow-starting containers from liveness kills.
          startupProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 12       # Allow up to 60s for startup (12 x 5s)
```

### 6.3 Python FastAPI Worker Health Check

```python
# services/ai-worker/src/api.py

@app.get("/health")
async def health():
    """Liveness probe for Cloud Run."""
    return {"status": "ok", "service": "bmn-ai-worker"}


@app.get("/ready")
async def ready():
    """Readiness probe for Cloud Run."""
    checks = {}

    # Check: Can we import Pillow (required for image composition)
    try:
        from PIL import Image
        checks["pillow"] = {"status": "ok"}
    except ImportError:
        checks["pillow"] = {"status": "error", "error": "Pillow not installed"}

    all_ok = all(c["status"] == "ok" for c in checks.values())
    status_code = 200 if all_ok else 503
    return JSONResponse(
        status_code=status_code,
        content={"status": "ready" if all_ok else "not_ready", "checks": checks},
    )
```

---

## 7. AI Cost Tracking

### 7.1 Cost Tracking Middleware

Every AI API call (text generation, image generation) must log: model, token counts, estimated cost, and duration.

```javascript
// server/src/lib/ai-cost-tracker.js

import { supabase } from '../services/supabase.js';
import { logger } from './logger.js';
import { captureEvent } from './posthog.js';

/**
 * Model pricing table (per 1M tokens for text, per image for image models).
 * Updated: February 2026.
 *
 * @type {Record<string, { inputPer1M?: number, outputPer1M?: number, perImage?: number, perVideo?: number }>}
 */
const MODEL_PRICING = {
  // Text models (per 1M tokens)
  'claude-sonnet-4-6':   { inputPer1M: 3.00,   outputPer1M: 15.00  },
  'claude-haiku-4-5':    { inputPer1M: 0.80,   outputPer1M: 4.00   },
  'claude-opus-4-6':     { inputPer1M: 15.00,  outputPer1M: 75.00  },
  'gemini-3.0-flash':    { inputPer1M: 0.15,   outputPer1M: 0.60   },
  'gemini-3.0-pro':      { inputPer1M: 1.25,   outputPer1M: 10.00  },

  // Image models (per image)
  'flux-2-pro':          { perImage: 0.06  },
  'flux-2-dev':          { perImage: 0.03  },
  'gpt-image-1.5':       { perImage: 0.06  },
  'ideogram-v3':         { perImage: 0.06  },
  'gemini-3-pro-image':  { perImage: 0.05  },

  // Video models (per video)
  'veo-3':               { perVideo: 0.30  },
};

/**
 * Calculate the estimated cost of an AI API call.
 *
 * @param {string} model - The model identifier
 * @param {{ inputTokens?: number, outputTokens?: number, imageCount?: number, videoCount?: number }} usage
 * @returns {number} Estimated cost in USD
 */
export function calculateCost(model, usage) {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    logger.warn({ model }, 'Unknown model for cost calculation');
    return 0;
  }

  let cost = 0;

  if (pricing.inputPer1M && usage.inputTokens) {
    cost += (usage.inputTokens / 1_000_000) * pricing.inputPer1M;
  }
  if (pricing.outputPer1M && usage.outputTokens) {
    cost += (usage.outputTokens / 1_000_000) * pricing.outputPer1M;
  }
  if (pricing.perImage && usage.imageCount) {
    cost += usage.imageCount * pricing.perImage;
  }
  if (pricing.perVideo && usage.videoCount) {
    cost += usage.videoCount * pricing.perVideo;
  }

  return Math.round(cost * 1_000_000) / 1_000_000; // 6 decimal places
}

/**
 * Log an AI API call to the audit_log table and emit PostHog event.
 *
 * @param {{
 *   userId: string,
 *   brandId?: string,
 *   model: string,
 *   taskType: string,
 *   inputTokens?: number,
 *   outputTokens?: number,
 *   imageCount?: number,
 *   videoCount?: number,
 *   duration_ms: number,
 *   success: boolean,
 *   error?: string,
 *   jobId?: string,
 * }} params
 */
export async function trackAICost(params) {
  const {
    userId,
    brandId,
    model,
    taskType,
    inputTokens = 0,
    outputTokens = 0,
    imageCount = 0,
    videoCount = 0,
    duration_ms,
    success,
    error,
    jobId,
  } = params;

  const cost = calculateCost(model, { inputTokens, outputTokens, imageCount, videoCount });

  // 1. Log to structured logger
  logger.info({
    event: 'ai_api_call',
    userId,
    brandId,
    model,
    taskType,
    inputTokens,
    outputTokens,
    imageCount,
    videoCount,
    cost,
    duration_ms,
    success,
    jobId,
  }, `AI call: ${model} (${taskType}) - $${cost.toFixed(6)}`);

  // 2. Insert into audit_log for aggregation and reporting
  try {
    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'ai_api_call',
      resource_type: 'generation',
      resource_id: brandId || null,
      metadata: {
        model,
        taskType,
        inputTokens,
        outputTokens,
        imageCount,
        videoCount,
        cost,
        duration_ms,
        success,
        error: error || null,
        jobId: jobId || null,
      },
    });
  } catch (dbErr) {
    logger.error({ err: dbErr }, 'Failed to insert AI cost audit log');
  }

  // 3. Send to PostHog for analytics
  captureEvent(userId, 'ai_api_call', {
    model,
    taskType,
    inputTokens,
    outputTokens,
    imageCount,
    videoCount,
    cost,
    duration_ms,
    success,
  });
}
```

### 7.2 Wrapping AI SDK Calls

Every call to an AI provider SDK should use a wrapper that automatically tracks cost:

```javascript
// server/src/services/anthropic.js (cost-tracked wrapper)

import Anthropic from '@anthropic-ai/sdk';
import { trackAICost } from '../lib/ai-cost-tracker.js';
import { logger } from '../lib/logger.js';

const client = new Anthropic();

/**
 * Call Claude with automatic cost tracking.
 *
 * @param {{
 *   model: string,
 *   messages: Array,
 *   maxTokens?: number,
 *   system?: string,
 *   userId: string,
 *   brandId?: string,
 *   taskType: string,
 *   jobId?: string,
 * }} params
 * @returns {Promise<import('@anthropic-ai/sdk').Message>}
 */
export async function callClaude(params) {
  const { model, messages, maxTokens = 4096, system, userId, brandId, taskType, jobId } = params;
  const start = Date.now();

  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages,
    });

    await trackAICost({
      userId,
      brandId,
      model,
      taskType,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      duration_ms: Date.now() - start,
      success: true,
      jobId,
    });

    return response;
  } catch (err) {
    await trackAICost({
      userId,
      brandId,
      model,
      taskType,
      duration_ms: Date.now() - start,
      success: false,
      error: err.message,
      jobId,
    });
    throw err;
  }
}
```

```javascript
// server/src/services/bfl.js (FLUX.2 Pro cost-tracked wrapper)

import { trackAICost } from '../lib/ai-cost-tracker.js';
import { logger } from '../lib/logger.js';

/**
 * Generate a logo with FLUX.2 Pro via BFL direct API.
 * Automatically tracks cost in audit_log.
 *
 * @param {{
 *   prompt: string,
 *   width?: number,
 *   height?: number,
 *   userId: string,
 *   brandId?: string,
 *   jobId?: string,
 * }} params
 * @returns {Promise<{ url: string, metadata: Object }>}
 */
export async function generateWithFlux(params) {
  const { prompt, width = 1024, height = 1024, userId, brandId, jobId } = params;
  const start = Date.now();

  try {
    const response = await fetch('https://api.bfl.ml/v1/flux-pro', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.BFL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, width, height }),
    });

    if (!response.ok) {
      throw new Error(`BFL API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    await trackAICost({
      userId,
      brandId,
      model: 'flux-2-pro',
      taskType: 'logo-generation',
      imageCount: 1,
      duration_ms: Date.now() - start,
      success: true,
      jobId,
    });

    return result;
  } catch (err) {
    await trackAICost({
      userId,
      brandId,
      model: 'flux-2-pro',
      taskType: 'logo-generation',
      imageCount: 0,
      duration_ms: Date.now() - start,
      success: false,
      error: err.message,
      jobId,
    });
    throw err;
  }
}
```

### 7.3 Daily/Weekly Cost Reports

A scheduled BullMQ repeatable job aggregates AI costs and sends reports:

```javascript
// server/src/workers/cost-report.js

import { Worker, Queue } from 'bullmq';
import { supabase } from '../services/supabase.js';
import { logger } from '../lib/logger.js';
import { sendEmail } from '../services/resend.js';
import { redis } from '../services/redis.js';

// Register the repeatable job at startup
const costReportQueue = new Queue('cost-report', { connection: redis });

// Daily report at 8:00 AM UTC
await costReportQueue.upsertJobScheduler('daily-cost-report', {
  pattern: '0 8 * * *',  // Cron: every day at 08:00 UTC
}, {
  name: 'daily-cost-report',
  data: { period: 'daily' },
});

// Weekly report on Monday at 8:00 AM UTC
await costReportQueue.upsertJobScheduler('weekly-cost-report', {
  pattern: '0 8 * * 1',  // Cron: every Monday at 08:00 UTC
}, {
  name: 'weekly-cost-report',
  data: { period: 'weekly' },
});

const costReportWorker = new Worker('cost-report', async (job) => {
  const { period } = job.data;

  // Determine time range
  const now = new Date();
  const start = new Date(now);
  if (period === 'daily') {
    start.setDate(start.getDate() - 1);
  } else {
    start.setDate(start.getDate() - 7);
  }

  // Aggregate costs from audit_log
  const { data: rows, error } = await supabase
    .from('audit_log')
    .select('metadata')
    .eq('action', 'ai_api_call')
    .gte('created_at', start.toISOString())
    .lte('created_at', now.toISOString());

  if (error) {
    logger.error({ err: error }, 'Failed to query cost data');
    throw error;
  }

  // Aggregate by model
  const costByModel = {};
  let totalCost = 0;
  let totalCalls = 0;
  let totalTokens = 0;
  let totalImages = 0;
  let failedCalls = 0;

  for (const row of rows || []) {
    const meta = row.metadata;
    const model = meta.model || 'unknown';
    const cost = meta.cost || 0;

    if (!costByModel[model]) {
      costByModel[model] = { cost: 0, calls: 0, inputTokens: 0, outputTokens: 0, images: 0 };
    }

    costByModel[model].cost += cost;
    costByModel[model].calls += 1;
    costByModel[model].inputTokens += meta.inputTokens || 0;
    costByModel[model].outputTokens += meta.outputTokens || 0;
    costByModel[model].images += meta.imageCount || 0;

    totalCost += cost;
    totalCalls += 1;
    totalTokens += (meta.inputTokens || 0) + (meta.outputTokens || 0);
    totalImages += meta.imageCount || 0;
    if (!meta.success) failedCalls += 1;
  }

  const report = {
    period,
    startDate: start.toISOString(),
    endDate: now.toISOString(),
    totalCost: `$${totalCost.toFixed(2)}`,
    totalCalls,
    totalTokens,
    totalImages,
    failedCalls,
    costByModel,
  };

  logger.info({ report }, `AI cost report (${period})`);

  // Send email report to admin
  await sendEmail({
    to: process.env.SUPPORT_EMAIL,
    subject: `[BMN] AI Cost Report (${period}) — $${totalCost.toFixed(2)}`,
    text: JSON.stringify(report, null, 2),
  });

  return report;
}, { connection: redis });
```

### 7.4 Cost Anomaly Alerts

Alert when AI spending exceeds thresholds. This is implemented as a check in the cost tracker:

```javascript
// server/src/lib/ai-cost-tracker.js (addition)

import { Sentry } from './sentry.js';

/**
 * Hourly cost threshold for anomaly detection.
 * If AI spend exceeds this in a rolling 1-hour window, alert.
 */
const HOURLY_COST_ALERT_THRESHOLD = 10.00; // $10/hour

/**
 * Redis key for rolling hourly cost tracking.
 */
const HOURLY_COST_KEY = 'bmn:ai:hourly_cost';

/**
 * Check if AI spending is anomalous and alert if so.
 * Uses a Redis sorted set with timestamp scores to track rolling hourly costs.
 *
 * @param {number} cost - The cost of the current AI call
 */
async function checkCostAnomaly(cost) {
  const now = Date.now();
  const oneHourAgo = now - 3_600_000;

  try {
    // Add this cost to the rolling window
    await redis.zadd(HOURLY_COST_KEY, now, `${now}:${cost}`);

    // Remove entries older than 1 hour
    await redis.zremrangebyscore(HOURLY_COST_KEY, 0, oneHourAgo);

    // Sum all costs in the window
    const entries = await redis.zrangebyscore(HOURLY_COST_KEY, oneHourAgo, now);
    const hourlyCost = entries.reduce((sum, entry) => {
      const entryCost = parseFloat(entry.split(':')[1]);
      return sum + entryCost;
    }, 0);

    if (hourlyCost > HOURLY_COST_ALERT_THRESHOLD) {
      const message = `AI cost anomaly: $${hourlyCost.toFixed(2)} in the last hour (threshold: $${HOURLY_COST_ALERT_THRESHOLD})`;

      logger.error({ hourlyCost, threshold: HOURLY_COST_ALERT_THRESHOLD }, message);

      Sentry.captureMessage(message, {
        level: 'error',
        tags: { alert: 'cost-anomaly' },
        contexts: {
          cost: {
            hourly_cost: hourlyCost,
            threshold: HOURLY_COST_ALERT_THRESHOLD,
            call_count: entries.length,
          },
        },
      });
    }
  } catch (err) {
    logger.error({ err }, 'Failed to check cost anomaly');
  }
}
```

Add the anomaly check call to `trackAICost()`:

```javascript
// In trackAICost(), after calculating cost:
if (cost > 0) {
  await checkCostAnomaly(cost);
}
```

### 7.5 Cost Queries for Admin Dashboard

SQL queries for the admin panel to display cost data:

```sql
-- Total AI cost by day (last 30 days)
SELECT
  DATE(created_at) AS date,
  SUM((metadata->>'cost')::decimal) AS total_cost,
  COUNT(*) AS total_calls,
  SUM(CASE WHEN (metadata->>'success')::boolean = false THEN 1 ELSE 0 END) AS failed_calls
FROM audit_log
WHERE action = 'ai_api_call'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Cost by model (last 7 days)
SELECT
  metadata->>'model' AS model,
  SUM((metadata->>'cost')::decimal) AS total_cost,
  COUNT(*) AS call_count,
  AVG((metadata->>'duration_ms')::integer) AS avg_duration_ms,
  SUM((metadata->>'inputTokens')::integer) AS total_input_tokens,
  SUM((metadata->>'outputTokens')::integer) AS total_output_tokens,
  SUM((metadata->>'imageCount')::integer) AS total_images
FROM audit_log
WHERE action = 'ai_api_call'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY metadata->>'model'
ORDER BY total_cost DESC;

-- Cost per brand (for per-brand profitability analysis)
SELECT
  resource_id AS brand_id,
  SUM((metadata->>'cost')::decimal) AS total_cost,
  COUNT(*) AS generation_count
FROM audit_log
WHERE action = 'ai_api_call'
  AND resource_id IS NOT NULL
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY resource_id
ORDER BY total_cost DESC
LIMIT 50;

-- Top spenders (users with highest AI costs)
SELECT
  user_id,
  SUM((metadata->>'cost')::decimal) AS total_cost,
  COUNT(*) AS call_count
FROM audit_log
WHERE action = 'ai_api_call'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id
ORDER BY total_cost DESC
LIMIT 20;
```

---

## 8. File Manifest

Every file that needs to be created for the observability system:

### Server Files

```
server/src/
├── lib/
│   ├── sentry.js              # Sentry Node.js SDK initialization + helpers
│   ├── logger.js              # pino logger factory + child logger helper
│   ├── posthog.js             # PostHog Node.js SDK client + server-side capture
│   ├── ai-cost-tracker.js     # AI cost calculation, audit logging, anomaly detection
│   └── bull-board.js          # Bull Board adapter + queue registration
│
├── middleware/
│   ├── request-logger.js      # pino-http middleware (requestId, request/response logging)
│   └── error-handler.js       # Generic error handler (Sentry + pino + structured response)
│
├── routes/
│   ├── health.js              # /health (liveness) + /ready (readiness) + queue metrics
│   └── admin.js               # /admin/queues (Bull Board mount with admin auth)
│
├── workers/
│   ├── _shared/
│   │   └── job-logger.js      # BullMQ job child logger factory
│   └── cost-report.js         # Scheduled daily/weekly AI cost report worker
│
└── services/
    ├── anthropic.js           # Cost-tracked Claude SDK wrapper
    ├── bfl.js                 # Cost-tracked FLUX.2 Pro wrapper
    ├── openai.js              # Cost-tracked GPT Image 1.5 wrapper
    ├── google-ai.js           # Cost-tracked Gemini wrapper
    └── ideogram.js            # Cost-tracked Ideogram v3 wrapper
```

### Frontend Files

```
apps/web/src/
├── lib/
│   ├── sentry.js              # Sentry React SDK initialization + helpers
│   └── posthog.js             # PostHog JS SDK initialization + event tracking + feature flags
│
├── components/
│   └── ErrorBoundary.jsx      # SentryErrorBoundary + WizardErrorBoundary components
│
└── providers/
    └── PostHogProvider.jsx    # PostHog page view tracking on route changes
```

### Python Worker Files

```
services/ai-worker/src/
├── sentry_setup.py            # Sentry Python SDK initialization for FastAPI
└── logging_setup.py           # structlog configuration for FastAPI
```

### Infrastructure Files

```
k8s/
├── api-deployment.yml         # K8s deployment with liveness/readiness/startup probes
└── betterstack-agent.yml      # Betterstack log agent DaemonSet (optional)

.github/workflows/
├── deploy-web.yml             # Sentry source map upload for SPA
└── deploy-api.yml             # Sentry release creation for API server
```

### Config Files (additions to existing)

```
apps/web/vite.config.js        # Add sentryVitePlugin for source map upload
server/config/validate-env.js  # Ensure SENTRY_DSN, POSTHOG_API_KEY present
```

---

## 9. Environment Variables

All observability-related environment variables:

```bash
# === Sentry (all services) ===
SENTRY_DSN=https://abc123@o123456.ingest.us.sentry.io/456789
SENTRY_RELEASE=bmn-api@abc123def     # Set in CI/CD to git SHA
SENTRY_AUTH_TOKEN=sntrys_abc123...   # CI/CD only — for source map uploads
SENTRY_ORG=brandmenow               # CI/CD only
SENTRY_PROJECT=bmn-api               # CI/CD only (bmn-api or bmn-web)

# === PostHog ===
POSTHOG_API_KEY=phc_abc123...        # Server-side Node SDK
POSTHOG_HOST=https://us.i.posthog.com

# === PostHog (Frontend — Vite env vars) ===
VITE_SENTRY_DSN=https://xyz789@o123456.ingest.us.sentry.io/789012
VITE_SENTRY_RELEASE=bmn-web@abc123def
VITE_POSTHOG_API_KEY=phc_abc123...
VITE_POSTHOG_HOST=https://us.i.posthog.com

# === Logging ===
LOG_LEVEL=info                       # trace | debug | info | warn | error | fatal
BETTERSTACK_SOURCE_TOKEN=abc123...   # Only if using Betterstack log shipping

# === Python Worker (Sentry) ===
PYTHON_ENV=production
# SENTRY_DSN shared with Node.js (or separate project DSN)
```

---

## 10. Development Prompt

Use this prompt with Claude Code to build the observability system:

```
Build the observability layer for Brand Me Now v2 based on the specification in
docs/prd/12-OBSERVABILITY.md.

The Express.js server (server/src/server.js, server/src/app.js) already exists from 03-SERVER-CORE.

Create these files in this order:

1. server/src/lib/logger.js — pino logger with redaction, child loggers, dev pretty-print
2. server/src/lib/sentry.js — Sentry Node.js SDK init, user/tenant context, worker instrumentation
3. server/src/middleware/request-logger.js — pino-http middleware with requestId, custom log levels
4. server/src/middleware/error-handler.js — Sentry + pino error handler (structured JSON response)
5. server/src/routes/health.js — /health (liveness) + /ready (readiness with Redis + Supabase checks)
6. server/src/lib/posthog.js — PostHog Node SDK client, server-side event capture
7. server/src/lib/ai-cost-tracker.js — cost calculation, audit_log insert, anomaly detection
8. server/src/lib/bull-board.js — Bull Board adapter with all BullMQ queues registered
9. server/src/routes/admin.js — /admin/queues mount with admin auth guard
10. server/src/workers/_shared/job-logger.js — child logger factory for BullMQ workers
11. server/src/workers/cost-report.js — daily/weekly cost aggregation reports
12. apps/web/src/lib/sentry.js — Sentry React SDK init, user context, brand tags
13. apps/web/src/lib/posthog.js — PostHog JS SDK init, identify, track, feature flags
14. apps/web/src/components/ErrorBoundary.jsx — SentryErrorBoundary + WizardErrorBoundary
15. apps/web/src/providers/PostHogProvider.jsx — page view tracking on route changes
16. services/ai-worker/src/sentry_setup.py — Sentry Python SDK for FastAPI
17. services/ai-worker/src/logging_setup.py — structlog setup for FastAPI

Wire Sentry request handler as first middleware, Sentry error handler after routes.
Wire pino-http request logger after Sentry request handler.
Wire Bull Board at /admin/queues behind admin auth.
Add sentryVitePlugin to apps/web/vite.config.js for source map uploads.

Stack: Express.js 5, React 19 + Vite 7, FastAPI, BullMQ, Redis, Supabase, DigitalOcean.
JavaScript with JSDoc types (no TypeScript).

Verify: npm start should show pino logs in dev, /health returns 200, /ready checks dependencies,
/admin/queues shows Bull Board (requires admin JWT).
```

---

## 11. Acceptance Criteria

### Sentry

- [ ] Server: `initSentry()` called before any other imports in `server.js`
- [ ] Server: Every unhandled error in Express routes is captured in Sentry with stack trace
- [ ] Server: Every Sentry event includes `userId`, `brandId` (when available), and `requestId`
- [ ] Server: BullMQ worker failures are captured in Sentry with job context (jobId, queue, brand)
- [ ] Frontend: React errors caught by `SentryErrorBoundary` are captured in Sentry
- [ ] Frontend: `WizardErrorBoundary` includes `wizardStep` tag on captured errors
- [ ] Frontend: Source maps are uploaded to Sentry in CI/CD — production errors show original source
- [ ] Python: FastAPI exceptions are captured in Sentry with `user_id` and `brand_id` context
- [ ] Environments: `development`, `staging`, `production` appear as separate environments in Sentry
- [ ] Releases: Every deployment creates a Sentry release tied to the git commit SHA
- [ ] Alerts: Error spike > 10/min triggers Slack notification
- [ ] Alerts: p95 latency > 500ms for 5 minutes triggers Slack notification

### Structured Logging (pino)

- [ ] Every HTTP request generates a JSON log line with: `requestId`, `method`, `url`, `statusCode`, `responseTime`
- [ ] `req.log` is available in all route handlers as a child logger with `requestId` bound
- [ ] Log redaction: `authorization`, `password`, `token`, `apiKey`, `secret` fields are replaced with `[REDACTED]`
- [ ] `/health` and `/ready` requests are NOT logged (excluded from auto-logging)
- [ ] BullMQ workers use `createJobLogger()` with `jobId`, `queue`, `userId`, `brandId` bound
- [ ] Development: pino-pretty outputs colored, human-readable logs to terminal
- [ ] Production: raw JSON logs written to stdout for container log collection
- [ ] Python worker: structlog outputs JSON in production, colored console in development
- [ ] No `console.log` statements exist in production code (all logging through pino/structlog)

### PostHog

- [ ] Frontend: `posthog.init()` called at app startup with correct API key and host
- [ ] Frontend: `identifyUser()` called after login — links anonymous events to authenticated user
- [ ] Frontend: `resetIdentity()` called on logout
- [ ] Frontend: Page views captured on every route change via `PostHogProvider`
- [ ] Frontend: All wizard events tracked (`wizard_started`, `wizard_step_completed`, `wizard_abandoned`, etc.)
- [ ] Frontend: All generation events tracked (`logo_generation_started`, `logo_selected`, `mockup_approved`, etc.)
- [ ] Server: `captureEvent()` used for server-side events (Stripe webhooks, job completions)
- [ ] Feature flags: `isFeatureEnabled()` works on both frontend and server
- [ ] Session replay: Enabled in production with `maskAllInputs: true`
- [ ] Funnels: Signup-to-paid funnel is definable from tracked events

### Bull Board

- [ ] Bull Board UI accessible at `/admin/queues`
- [ ] Requires admin authentication (non-admin users get 403)
- [ ] All BullMQ queues visible: `brand-analysis`, `logo-generation`, `mockup-generation`, `bundle-composition`, `crm-sync`, `email-send`, `cleanup`, `webhook-process`
- [ ] Can view job details (payload, return value, error, progress, timestamps)
- [ ] Can retry failed jobs from the UI
- [ ] Can remove completed/failed jobs from the UI

### Health Checks

- [ ] `GET /health` returns `200` with `{ status: 'ok', uptime, version }` — no external deps checked
- [ ] `GET /ready` returns `200` only when Redis ping succeeds AND Supabase query succeeds AND Sentry client exists
- [ ] `GET /ready` returns `503` with `{ status: 'not_ready', checks }` when any dependency is down
- [ ] `GET /ready` includes queue metrics (waiting, active, completed, failed counts per queue)
- [ ] K8s `livenessProbe` uses `/health` (restart pod if unresponsive)
- [ ] K8s `readinessProbe` uses `/ready` (remove from service if dependencies down)
- [ ] K8s `startupProbe` allows 60 seconds for container initialization

### AI Cost Tracking

- [ ] Every AI API call (text gen, image gen) logs: `model`, `inputTokens`, `outputTokens`, `imageCount`, `cost`, `duration_ms`, `success`
- [ ] Cost data is inserted into `audit_log` table with `action: 'ai_api_call'`
- [ ] Cost data is sent to PostHog as `ai_api_call` event
- [ ] `calculateCost()` returns correct cost for all models in the pricing table
- [ ] Cost anomaly alert fires when rolling hourly AI spend exceeds $10
- [ ] Daily cost report emails admin at 8:00 AM UTC
- [ ] Weekly cost report emails admin on Monday at 8:00 AM UTC
- [ ] Admin can query cost-by-model and cost-by-brand from `audit_log`
- [ ] All AI service wrappers (`callClaude`, `generateWithFlux`, etc.) use `trackAICost()` for both success and failure

---

## Appendix: Log Output Examples

### Request Log (production JSON)

```json
{
  "level": "info",
  "time": "2026-02-19T14:30:00.123Z",
  "service": "bmn-api",
  "env": "production",
  "version": "2.0.0",
  "requestId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "userId": "user_abc123",
  "tenantId": "personal",
  "req": {
    "method": "POST",
    "url": "/api/v1/generation/logos",
    "userAgent": "Mozilla/5.0..."
  },
  "res": {
    "statusCode": 202
  },
  "responseTime": 45,
  "msg": "POST /api/v1/generation/logos 202"
}
```

### AI Cost Log Entry

```json
{
  "level": "info",
  "time": "2026-02-19T14:30:05.456Z",
  "service": "bmn-api",
  "env": "production",
  "event": "ai_api_call",
  "userId": "user_abc123",
  "brandId": "brand_def456",
  "model": "claude-sonnet-4-6",
  "taskType": "brand-vision",
  "inputTokens": 2500,
  "outputTokens": 1200,
  "imageCount": 0,
  "cost": 0.025500,
  "duration_ms": 3200,
  "success": true,
  "jobId": "job_ghi789",
  "msg": "AI call: claude-sonnet-4-6 (brand-vision) - $0.025500"
}
```

### BullMQ Worker Log

```json
{
  "level": "info",
  "time": "2026-02-19T14:30:10.789Z",
  "service": "bmn-api",
  "env": "production",
  "jobId": "job_ghi789",
  "queue": "logo-generation",
  "userId": "user_abc123",
  "brandId": "brand_def456",
  "attempt": 1,
  "step": "generate",
  "model": "flux-2-pro",
  "msg": "Generating logo with FLUX.2 Pro"
}
```

### Error Log with Redaction

```json
{
  "level": "error",
  "time": "2026-02-19T14:30:15.000Z",
  "service": "bmn-api",
  "env": "production",
  "requestId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "userId": "user_abc123",
  "err": {
    "type": "Error",
    "message": "BFL API error: 429 Too Many Requests",
    "stack": "Error: BFL API error...\n    at generateWithFlux..."
  },
  "authorization": "[REDACTED]",
  "apiKey": "[REDACTED]",
  "msg": "Logo generation failed"
}
```
