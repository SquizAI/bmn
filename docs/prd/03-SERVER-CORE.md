# 03 — Express.js 5 Server Core Specification

**Product:** Brand Me Now v2
**Date:** February 19, 2026
**Author:** Matt Squarzoni
**Status:** Approved for development
**Build Phase:** Phase 1, Week 1 (parallel with 07-DATABASE + 12-OBSERVABILITY)
**Dependencies:** None (this is the foundation)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Server Bootstrap](#2-server-bootstrap)
3. [Middleware Chain](#3-middleware-chain)
4. [Route Structure](#4-route-structure)
5. [Configuration](#5-configuration)
6. [Error Handling](#6-error-handling)
7. [Health Check Endpoint](#7-health-check-endpoint)
8. [Docker Setup](#8-docker-setup)
9. [File Manifest](#9-file-manifest)
10. [Environment Variables](#10-environment-variables)
11. [Development Prompt](#11-development-prompt)
12. [Acceptance Criteria](#12-acceptance-criteria)

---

## 1. Overview

The Express.js 5 API server is the **backbone of Brand Me Now v2**. It is not a thin REST wrapper around a database -- it is the orchestration layer for AI agents, background jobs, real-time events, multi-model routing, payments, CRM sync, and complex business logic.

### Why Express.js 5

Express 5 provides native `async/await` error handling (thrown errors in async route handlers are caught automatically), improved path-matching, and a stable foundation. Combined with Socket.io for real-time communication and BullMQ for durable background jobs, this server handles everything from simple CRUD to multi-minute AI generation pipelines.

### Design Principles

1. **Fail fast** -- Crash immediately on missing configuration. No silent defaults for security-critical variables.
2. **Structured everything** -- JSON logs via pino. JSON error responses. No `console.log` in production.
3. **Middleware-first security** -- Every request passes through Helmet, CORS, auth, rate limiting before reaching a handler.
4. **Request-scoped context** -- Every request gets a unique `requestId` that flows through logs, Sentry breadcrumbs, and downstream services.
5. **Graceful lifecycle** -- Clean startup validation, clean shutdown with connection draining.
6. **JSDoc typed** -- Full IDE intellisense without TypeScript compilation overhead.

### Runtime Requirements

| Requirement | Value |
|-------------|-------|
| Node.js | 22 LTS |
| Language | JavaScript + JSDoc types |
| Package manager | pnpm |
| Port | 3000 (configurable via `PORT` env var) |
| Process model | Single process (PM2 or K8s handles scaling) |

---

## 2. Server Bootstrap

The server boots in a specific order: validate config, initialize Sentry, create Express app with middleware, attach Socket.io, start HTTP listener, then signal readiness.

### 2.1 Entry Point (`server/src/index.js`)

This is the single entry point. It validates the environment, initializes observability, creates the app, starts the server, and handles process lifecycle.

```javascript
// server/src/index.js

// Sentry MUST be imported before everything else
import './lib/sentry.js';

import http from 'node:http';
import { createApp } from './app.js';
import { createSocketServer } from './sockets/index.js';
import { config } from './config/index.js';
import { logger } from './lib/logger.js';
import { redis } from './lib/redis.js';
import { startWorkers } from './workers/index.js';
import * as Sentry from '@sentry/node';

/**
 * Boot the server.
 * Order matters:
 * 1. Config is already validated on import (crashes if invalid)
 * 2. Sentry is already initialized on import
 * 3. Create Express app with full middleware chain
 * 4. Create HTTP server (shared between Express and Socket.io)
 * 5. Attach Socket.io to the HTTP server
 * 6. Start BullMQ workers
 * 7. Listen on configured port
 */
async function main() {
  // Step 1: Create Express application
  const app = createApp();

  // Step 2: Create raw HTTP server (shared with Socket.io)
  const server = http.createServer(app);

  // Step 3: Attach Socket.io to the HTTP server
  const io = createSocketServer(server);

  // Make io accessible to route handlers via app.locals
  app.locals.io = io;

  // Step 4: Start BullMQ workers (logo gen, mockup gen, CRM sync, etc.)
  await startWorkers(io);

  // Step 5: Start listening
  server.listen(config.PORT, () => {
    logger.info({
      msg: 'Server started',
      port: config.PORT,
      env: config.NODE_ENV,
      pid: process.pid,
    });
  });

  // Step 6: Register graceful shutdown
  registerShutdownHandlers(server, io);
}

/**
 * Graceful shutdown handler.
 * Closes connections in reverse order of creation:
 * 1. Stop accepting new connections
 * 2. Close Socket.io connections
 * 3. Close BullMQ workers
 * 4. Close Redis connection
 * 5. Flush Sentry events
 * 6. Exit
 *
 * @param {http.Server} server
 * @param {import('socket.io').Server} io
 */
function registerShutdownHandlers(server, io) {
  /** @type {boolean} */
  let isShuttingDown = false;

  /**
   * @param {string} signal
   */
  async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info({ msg: 'Shutdown initiated', signal });

    // Give in-flight requests 10 seconds to complete
    const forceTimeout = setTimeout(() => {
      logger.error({ msg: 'Forced shutdown after timeout' });
      process.exit(1);
    }, 10_000);

    try {
      // 1. Stop accepting new HTTP connections
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info({ msg: 'HTTP server closed' });

      // 2. Disconnect all Socket.io clients
      io.disconnectSockets(true);
      logger.info({ msg: 'Socket.io connections closed' });

      // 3. Close Redis connection
      await redis.quit();
      logger.info({ msg: 'Redis connection closed' });

      // 4. Flush Sentry events (2-second timeout)
      await Sentry.close(2000);
      logger.info({ msg: 'Sentry flushed' });

      clearTimeout(forceTimeout);
      logger.info({ msg: 'Graceful shutdown complete' });
      process.exit(0);
    } catch (err) {
      logger.error({ msg: 'Shutdown error', error: err.message });
      clearTimeout(forceTimeout);
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Process-level error handlers -- catch anything that slips through
process.on('unhandledRejection', (reason, promise) => {
  logger.error({
    msg: 'Unhandled promise rejection',
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  Sentry.captureException(reason);
});

process.on('uncaughtException', (error) => {
  logger.fatal({
    msg: 'Uncaught exception -- shutting down',
    error: error.message,
    stack: error.stack,
  });
  Sentry.captureException(error);

  // Uncaught exceptions leave the process in an undefined state.
  // Flush Sentry and exit.
  Sentry.close(2000).finally(() => process.exit(1));
});

// Boot
main().catch((err) => {
  logger.fatal({ msg: 'Failed to start server', error: err.message, stack: err.stack });
  process.exit(1);
});
```

### 2.2 Express App Factory (`server/src/app.js`)

The app factory creates the Express application with the full middleware chain and route registration. It is separated from the server so it can be imported independently for testing (supertest).

```javascript
// server/src/app.js

import express from 'express';
import { helmetMiddleware } from './middleware/helmet.js';
import { corsMiddleware } from './middleware/cors.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { httpLogger } from './middleware/http-logger.js';
import { cookieParserMiddleware } from './middleware/cookie-parser.js';
import { generalLimiter } from './middleware/rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { registerRoutes } from './routes/index.js';
import * as Sentry from '@sentry/node';

/**
 * Create and configure the Express application.
 * Middleware is applied in a specific order -- do not rearrange.
 *
 * @returns {import('express').Express}
 */
export function createApp() {
  const app = express();

  // ──────────────────────────────────────────────
  // Trust proxy (required behind load balancer / K8s ingress)
  // ──────────────────────────────────────────────
  app.set('trust proxy', 1);

  // ──────────────────────────────────────────────
  // MIDDLEWARE CHAIN (order matters)
  // ──────────────────────────────────────────────

  // 1. Sentry request handler (must be first middleware)
  app.use(Sentry.Handlers.requestHandler());

  // 2. Security headers (Helmet)
  app.use(helmetMiddleware);

  // 3. CORS (configurable origins from env)
  app.use(corsMiddleware);

  // 4. Request ID generation (crypto.randomUUID)
  app.use(requestIdMiddleware);

  // 5. Structured HTTP logging (pino-http)
  app.use(httpLogger);

  // 6. Body parsing -- JSON with 10MB limit
  app.use(express.json({ limit: '10mb' }));

  // 7. URL-encoded body parsing
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 8. Cookie parser
  app.use(cookieParserMiddleware);

  // 9. Global rate limiting (Redis-backed)
  app.use(generalLimiter);

  // ──────────────────────────────────────────────
  // ROUTES
  // ──────────────────────────────────────────────
  registerRoutes(app);

  // ──────────────────────────────────────────────
  // ERROR HANDLING (must be after routes)
  // ──────────────────────────────────────────────

  // Sentry error handler (captures errors to Sentry)
  app.use(Sentry.Handlers.errorHandler());

  // 404 handler for unmatched routes
  app.use(notFoundHandler);

  // Global error handler (structured JSON response)
  app.use(errorHandler);

  return app;
}
```

---

## 3. Middleware Chain

Every middleware is in its own file under `server/src/middleware/`. The order in `app.js` is critical -- security headers first, then CORS, then request tracking, then parsing, then auth (applied per-route), then error handling last.

### 3.1 Helmet -- Security Headers (`server/src/middleware/helmet.js`)

```javascript
// server/src/middleware/helmet.js

import helmet from 'helmet';
import { config } from '../config/index.js';

/**
 * Security headers middleware.
 *
 * Helmet sets:
 * - Content-Security-Policy (CSP)
 * - Strict-Transport-Security (HSTS)
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - X-XSS-Protection (legacy browsers)
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy
 *
 * CSP is relaxed in development to allow hot-reload and devtools.
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: config.isDev
    ? false // Disable CSP in development for HMR/devtools
    : {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Inline styles for email templates
          imgSrc: ["'self'", 'data:', 'https://*.supabase.co', 'https://*.r2.cloudflarestorage.com'],
          connectSrc: ["'self'", config.APP_URL, 'https://*.supabase.co', 'https://*.posthog.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
  crossOriginEmbedderPolicy: false, // Allow loading cross-origin images (R2, Supabase Storage)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
});
```

### 3.2 CORS -- Configurable Origins (`server/src/middleware/cors.js`)

```javascript
// server/src/middleware/cors.js

import cors from 'cors';
import { config } from '../config/index.js';

/**
 * Parse CORS_ORIGINS env var into an allowlist.
 * In development, also allow localhost origins.
 *
 * @returns {string[]}
 */
function parseOrigins() {
  const origins = config.CORS_ORIGINS
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  if (config.isDev) {
    origins.push('http://localhost:5173'); // Vite dev server
    origins.push('http://localhost:3000'); // API dev
    origins.push('http://localhost:4173'); // Vite preview
  }

  return origins;
}

const allowedOrigins = parseOrigins();

/**
 * CORS middleware.
 *
 * - Strict origin allowlist from CORS_ORIGINS env var
 * - No wildcard (*) in production
 * - Credentials enabled (cookies for marketing site SSR auth)
 * - Preflight cached for 1 hour
 */
export const corsMiddleware = cors({
  /**
   * @param {string | undefined} origin
   * @param {(err: Error | null, allow?: boolean) => void} callback
   */
  origin(origin, callback) {
    // Allow requests with no origin (server-to-server, health checks, curl)
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Workspace-ID'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 3600, // Preflight cache: 1 hour
});
```

### 3.3 Request ID Generation (`server/src/middleware/request-id.js`)

```javascript
// server/src/middleware/request-id.js

import { randomUUID } from 'node:crypto';

/**
 * Generate a unique request ID for every incoming request.
 *
 * - Uses crypto.randomUUID() (CSPRNG, V4 UUID)
 * - Respects incoming X-Request-ID header from load balancer/proxy
 * - Attaches to req.id for downstream use
 * - Sets X-Request-ID response header for client correlation
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requestIdMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || randomUUID();

  // Attach to request for downstream access
  req.id = requestId;

  // Set response header for client-side correlation
  res.setHeader('X-Request-ID', requestId);

  next();
}
```

### 3.4 Structured HTTP Logging (`server/src/middleware/http-logger.js`)

```javascript
// server/src/middleware/http-logger.js

import pinoHttp from 'pino-http';
import { logger } from '../lib/logger.js';
import { config } from '../config/index.js';

/**
 * pino-http middleware for structured request/response logging.
 *
 * Every request logs:
 * - requestId (correlation)
 * - method, url, statusCode
 * - responseTime (ms)
 * - userAgent
 * - userId (if authenticated)
 *
 * Health check requests are logged at 'silent' level to reduce noise.
 */
export const httpLogger = pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/health', // Don't flood logs with health checks
  },
  customProps: (req) => ({
    requestId: req.id,
    userId: req.user?.id || null,
    env: config.NODE_ENV,
  }),
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});
```

### 3.5 Logger Setup (`server/src/lib/logger.js`)

```javascript
// server/src/lib/logger.js

import pino from 'pino';
import { config } from '../config/index.js';

/**
 * Application-wide pino logger.
 *
 * - JSON output in production (machine-parseable for log aggregation)
 * - Pretty-print in development (human-readable)
 * - Redacts sensitive fields (authorization headers, API keys)
 * - Includes service name and environment for log routing
 */
export const logger = pino({
  level: config.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.apiKey',
      '*.secret',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
  base: {
    service: 'bmn-api',
    env: config.NODE_ENV,
  },
  transport: config.isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname,service,env',
        },
      }
    : undefined, // JSON output in production (default)
  timestamp: pino.stdTimeFunctions.isoTime,
});
```

### 3.6 Cookie Parser (`server/src/middleware/cookie-parser.js`)

```javascript
// server/src/middleware/cookie-parser.js

import cookieParser from 'cookie-parser';

/**
 * Cookie parser middleware.
 *
 * Required for:
 * - Supabase SSR auth (marketing site uses httpOnly cookies)
 * - CSRF token validation on cookie-based endpoints
 * - Wizard resume token (set as httpOnly cookie as fallback)
 *
 * The SPA (React app) primarily uses Bearer tokens,
 * but cookies are needed for cross-site auth scenarios.
 */
export const cookieParserMiddleware = cookieParser();
```

### 3.7 Rate Limiting -- Redis-Backed (`server/src/middleware/rate-limit.js`)

```javascript
// server/src/middleware/rate-limit.js

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../lib/redis.js';
import { config } from '../config/index.js';
import { RateLimitError } from '../utils/errors.js';

/**
 * Create a Redis-backed rate limit store.
 * Uses the shared Redis connection for distributed rate limiting
 * across multiple server instances (K8s pods).
 *
 * @returns {RedisStore}
 */
function createRedisStore() {
  return new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: 'bmn:rl:',
  });
}

/**
 * General API rate limiter.
 * 100 requests per minute per user (or per IP if unauthenticated).
 */
export const generalLimiter = rateLimit({
  store: config.isDev ? undefined : createRedisStore(), // In-memory for dev, Redis for prod
  windowMs: 60_000, // 1 minute
  max: 100,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (_req, _res, next) => {
    next(new RateLimitError('Too many requests. Please slow down.'));
  },
  skip: (req) => req.path === '/health', // Never rate-limit health checks
});

/**
 * AI generation rate limiter.
 * 5 requests per minute per user -- AI generation is expensive.
 * Applied to: POST /api/v1/wizard/generate/*, POST /api/v1/brands/:id/generate/*
 */
export const generationLimiter = rateLimit({
  store: config.isDev ? undefined : createRedisStore(),
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (_req, _res, next) => {
    next(new RateLimitError('Generation rate limit exceeded. Please wait before generating again.'));
  },
});

/**
 * Auth endpoint rate limiter.
 * 10 attempts per 15 minutes per IP -- prevents brute force.
 * Applied to: POST /api/v1/auth/login, POST /api/v1/auth/signup
 */
export const authLimiter = rateLimit({
  store: config.isDev ? undefined : createRedisStore(),
  windowMs: 15 * 60_000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (_req, _res, next) => {
    next(new RateLimitError('Too many authentication attempts. Please try again in 15 minutes.'));
  },
});

/**
 * Webhook rate limiter.
 * 200 requests per minute per IP -- Stripe/GHL may burst.
 * Applied to: POST /api/v1/webhooks/*
 */
export const webhookLimiter = rateLimit({
  store: config.isDev ? undefined : createRedisStore(),
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (_req, _res, next) => {
    next(new RateLimitError('Webhook rate limit exceeded.'));
  },
});
```

### 3.8 Supabase Auth Middleware (`server/src/middleware/auth.js`)

This middleware validates Supabase JWTs. It is NOT applied globally -- it is applied per-route group, so public routes (health, webhooks) skip auth.

```javascript
// server/src/middleware/auth.js

import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { AuthError } from '../utils/errors.js';
import { logger } from '../lib/logger.js';

/**
 * Supabase admin client (service role key).
 * Used server-side for JWT verification and admin operations.
 * This client bypasses RLS -- use only for auth verification and admin tasks.
 */
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Authentication middleware.
 *
 * Validates the Supabase JWT from the Authorization header.
 * On success, attaches the user object to req.user.
 * On failure, throws AuthError (caught by error handler).
 *
 * Usage:
 *   router.use(authMiddleware);                      // Protect all routes in group
 *   router.get('/me', authMiddleware, getProfile);   // Protect single route
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError('Missing or malformed Authorization header. Expected: Bearer <token>');
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  if (!token) {
    throw new AuthError('Empty bearer token');
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      logger.warn({
        msg: 'JWT verification failed',
        requestId: req.id,
        error: error.message,
        ip: req.ip,
      });
      throw new AuthError('Invalid or expired token');
    }

    if (!user) {
      throw new AuthError('User not found for token');
    }

    // Attach user to request for downstream handlers
    req.user = user;

    next();
  } catch (err) {
    if (err instanceof AuthError) {
      return next(err);
    }
    // Unexpected errors during auth should not leak details
    logger.error({
      msg: 'Auth middleware unexpected error',
      requestId: req.id,
      error: err.message,
    });
    next(new AuthError('Authentication failed'));
  }
}

/**
 * Admin-only middleware.
 * Must be used AFTER authMiddleware.
 * Checks the user's role in the profiles table or JWT claims.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function adminMiddleware(req, res, next) {
  if (!req.user) {
    throw new AuthError('Authentication required');
  }

  // Check user role from Supabase app_metadata or profiles table
  const role = req.user.app_metadata?.role;

  if (role !== 'admin') {
    throw new AuthError('Admin access required', 403);
  }

  next();
}

/**
 * Optional auth middleware.
 * Attempts to authenticate but does not fail if no token is present.
 * Useful for endpoints that behave differently for authenticated vs anonymous users.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.slice(7);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    req.user = error ? null : user;
  } catch {
    req.user = null;
  }

  next();
}
```

### 3.9 Request Validation Middleware (`server/src/middleware/validate.js`)

```javascript
// server/src/middleware/validate.js

import { ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';

/**
 * Create a Zod validation middleware for request body, query, or params.
 *
 * Usage:
 *   import { brandCreateSchema } from '@bmn/shared/validation/brand.js';
 *   router.post('/', validate({ body: brandCreateSchema }), createBrand);
 *
 * @param {Object} schemas
 * @param {import('zod').ZodType} [schemas.body] - Schema for request body
 * @param {import('zod').ZodType} [schemas.query] - Schema for query params
 * @param {import('zod').ZodType} [schemas.params] - Schema for URL params
 * @returns {import('express').RequestHandler}
 */
export function validate(schemas) {
  return (req, res, next) => {
    /** @type {Array<{field: string, message: string}>} */
    const errors = [];

    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
    } catch (err) {
      if (err instanceof ZodError) {
        errors.push(
          ...err.issues.map((issue) => ({
            field: `body.${issue.path.join('.')}`,
            message: issue.message,
          }))
        );
      }
    }

    try {
      if (schemas.query) {
        req.query = schemas.query.parse(req.query);
      }
    } catch (err) {
      if (err instanceof ZodError) {
        errors.push(
          ...err.issues.map((issue) => ({
            field: `query.${issue.path.join('.')}`,
            message: issue.message,
          }))
        );
      }
    }

    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params);
      }
    } catch (err) {
      if (err instanceof ZodError) {
        errors.push(
          ...err.issues.map((issue) => ({
            field: `params.${issue.path.join('.')}`,
            message: issue.message,
          }))
        );
      }
    }

    if (errors.length > 0) {
      return next(new ValidationError('Request validation failed', errors));
    }

    next();
  };
}
```

### 3.10 404 Not Found Handler (`server/src/middleware/not-found.js`)

```javascript
// server/src/middleware/not-found.js

import { NotFoundError } from '../utils/errors.js';

/**
 * 404 handler for unmatched routes.
 * Must be registered AFTER all routes but BEFORE the error handler.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function notFoundHandler(req, res, next) {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
}
```

---

## 4. Route Structure

Routes are organized by resource domain. Each route file registers its handlers on a Router instance. Auth middleware is applied per-group, not globally, so public endpoints (health checks, webhooks) remain accessible.

### 4.1 Route Registration (`server/src/routes/index.js`)

```javascript
// server/src/routes/index.js

import { authRoutes } from './auth.js';
import { brandRoutes } from './brands.js';
import { wizardRoutes } from './wizard.js';
import { productRoutes } from './products.js';
import { paymentRoutes } from './payments.js';
import { adminRoutes } from './admin.js';
import { webhookRoutes } from './webhooks.js';
import { healthRoute } from './health.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { authLimiter, webhookLimiter } from '../middleware/rate-limit.js';

/**
 * Register all API routes on the Express app.
 *
 * Route groups:
 * - /health           -- Public, no auth (K8s probes, uptime monitors)
 * - /api/v1/auth      -- Public with auth rate limit (login, signup, refresh)
 * - /api/v1/webhooks  -- Public with webhook rate limit (Stripe, GHL)
 * - /api/v1/brands    -- Authenticated (brand CRUD)
 * - /api/v1/wizard    -- Authenticated (wizard flow, AI generation)
 * - /api/v1/products  -- Authenticated (product catalog)
 * - /api/v1/payments  -- Authenticated (subscription management)
 * - /api/v1/admin     -- Authenticated + admin role
 *
 * @param {import('express').Express} app
 */
export function registerRoutes(app) {
  // ── Public routes (no auth) ──────────────────────────────
  app.use('/health', healthRoute);
  app.use('/api/v1/auth', authLimiter, authRoutes);
  app.use('/api/v1/webhooks', webhookLimiter, webhookRoutes);

  // ── Authenticated routes ─────────────────────────────────
  app.use('/api/v1/brands', authMiddleware, brandRoutes);
  app.use('/api/v1/wizard', authMiddleware, wizardRoutes);
  app.use('/api/v1/products', authMiddleware, productRoutes);
  app.use('/api/v1/payments', authMiddleware, paymentRoutes);

  // ── Admin routes (auth + admin role) ─────────────────────
  app.use('/api/v1/admin', authMiddleware, adminMiddleware, adminRoutes);
}
```

### 4.2 Health Route (`server/src/routes/health.js`)

See [Section 7: Health Check Endpoint](#7-health-check-endpoint) for the full implementation.

### 4.3 Auth Routes (`server/src/routes/auth.js`)

```javascript
// server/src/routes/auth.js

import { Router } from 'express';
import * as authController from '../controllers/auth.js';
import { validate } from '../middleware/validate.js';
import { signupSchema, loginSchema, refreshSchema } from '../validation/auth.js';

export const authRoutes = Router();

// POST /api/v1/auth/signup -- Create account
authRoutes.post('/signup', validate({ body: signupSchema }), authController.signup);

// POST /api/v1/auth/login -- Email/password login
authRoutes.post('/login', validate({ body: loginSchema }), authController.login);

// POST /api/v1/auth/refresh -- Refresh access token
authRoutes.post('/refresh', validate({ body: refreshSchema }), authController.refresh);

// POST /api/v1/auth/logout -- Invalidate session
authRoutes.post('/logout', authController.logout);

// GET /api/v1/auth/callback -- OAuth callback (Google, Apple)
authRoutes.get('/callback', authController.oauthCallback);
```

### 4.4 Brand Routes (`server/src/routes/brands.js`)

```javascript
// server/src/routes/brands.js

import { Router } from 'express';
import * as brandController from '../controllers/brands.js';
import { validate } from '../middleware/validate.js';
import { generationLimiter } from '../middleware/rate-limit.js';
import {
  brandCreateSchema,
  brandUpdateSchema,
  brandIdParamsSchema,
} from '../validation/brands.js';

export const brandRoutes = Router();

// GET /api/v1/brands -- List user's brands
brandRoutes.get('/', brandController.listBrands);

// POST /api/v1/brands -- Create a new brand
brandRoutes.post('/', validate({ body: brandCreateSchema }), brandController.createBrand);

// GET /api/v1/brands/:brandId -- Get brand details
brandRoutes.get(
  '/:brandId',
  validate({ params: brandIdParamsSchema }),
  brandController.getBrand
);

// PATCH /api/v1/brands/:brandId -- Update brand
brandRoutes.patch(
  '/:brandId',
  validate({ params: brandIdParamsSchema, body: brandUpdateSchema }),
  brandController.updateBrand
);

// DELETE /api/v1/brands/:brandId -- Delete brand and all assets
brandRoutes.delete(
  '/:brandId',
  validate({ params: brandIdParamsSchema }),
  brandController.deleteBrand
);

// GET /api/v1/brands/:brandId/assets -- List brand assets (logos, mockups, bundles)
brandRoutes.get(
  '/:brandId/assets',
  validate({ params: brandIdParamsSchema }),
  brandController.listBrandAssets
);

// POST /api/v1/brands/:brandId/generate/logos -- Queue logo generation
brandRoutes.post(
  '/:brandId/generate/logos',
  validate({ params: brandIdParamsSchema }),
  generationLimiter,
  brandController.generateLogos
);

// POST /api/v1/brands/:brandId/generate/mockups -- Queue mockup generation
brandRoutes.post(
  '/:brandId/generate/mockups',
  validate({ params: brandIdParamsSchema }),
  generationLimiter,
  brandController.generateMockups
);
```

### 4.5 Wizard Routes (`server/src/routes/wizard.js`)

```javascript
// server/src/routes/wizard.js

import { Router } from 'express';
import * as wizardController from '../controllers/wizard.js';
import { validate } from '../middleware/validate.js';
import { generationLimiter } from '../middleware/rate-limit.js';
import {
  wizardStartSchema,
  wizardStepUpdateSchema,
  socialHandlesSchema,
  wizardResumeSchema,
} from '../validation/wizard.js';

export const wizardRoutes = Router();

// POST /api/v1/wizard/start -- Start a new wizard session
wizardRoutes.post('/start', validate({ body: wizardStartSchema }), wizardController.startWizard);

// GET /api/v1/wizard/:brandId/state -- Get current wizard state
wizardRoutes.get('/:brandId/state', wizardController.getWizardState);

// PATCH /api/v1/wizard/:brandId/step -- Save wizard step data
wizardRoutes.patch(
  '/:brandId/step',
  validate({ body: wizardStepUpdateSchema }),
  wizardController.saveStepData
);

// POST /api/v1/wizard/:brandId/analyze-social -- Queue social media analysis
wizardRoutes.post(
  '/:brandId/analyze-social',
  validate({ body: socialHandlesSchema }),
  generationLimiter,
  wizardController.analyzeSocial
);

// POST /api/v1/wizard/:brandId/generate-identity -- Queue brand identity generation
wizardRoutes.post(
  '/:brandId/generate-identity',
  generationLimiter,
  wizardController.generateIdentity
);

// POST /api/v1/wizard/resume -- Resume wizard from HMAC-signed token
wizardRoutes.post(
  '/resume',
  validate({ body: wizardResumeSchema }),
  wizardController.resumeWizard
);

// POST /api/v1/wizard/:brandId/complete -- Mark wizard as complete
wizardRoutes.post('/:brandId/complete', wizardController.completeWizard);
```

### 4.6 Product Routes (`server/src/routes/products.js`)

```javascript
// server/src/routes/products.js

import { Router } from 'express';
import * as productController from '../controllers/products.js';
import { validate } from '../middleware/validate.js';
import { productQuerySchema, productIdParamsSchema } from '../validation/products.js';

export const productRoutes = Router();

// GET /api/v1/products -- List product catalog (with category filter, search)
productRoutes.get('/', validate({ query: productQuerySchema }), productController.listProducts);

// GET /api/v1/products/:productId -- Get single product details
productRoutes.get(
  '/:productId',
  validate({ params: productIdParamsSchema }),
  productController.getProduct
);

// GET /api/v1/products/categories -- List all product categories
productRoutes.get('/categories', productController.listCategories);
```

### 4.7 Payment Routes (`server/src/routes/payments.js`)

```javascript
// server/src/routes/payments.js

import { Router } from 'express';
import * as paymentController from '../controllers/payments.js';
import { validate } from '../middleware/validate.js';
import {
  checkoutSessionSchema,
  portalSessionSchema,
} from '../validation/payments.js';

export const paymentRoutes = Router();

// POST /api/v1/payments/checkout -- Create Stripe Checkout session
paymentRoutes.post(
  '/checkout',
  validate({ body: checkoutSessionSchema }),
  paymentController.createCheckoutSession
);

// POST /api/v1/payments/portal -- Create Stripe billing portal session
paymentRoutes.post(
  '/portal',
  validate({ body: portalSessionSchema }),
  paymentController.createPortalSession
);

// GET /api/v1/payments/subscription -- Get current subscription details
paymentRoutes.get('/subscription', paymentController.getSubscription);

// GET /api/v1/payments/credits -- Get remaining generation credits
paymentRoutes.get('/credits', paymentController.getCredits);
```

### 4.8 Webhook Routes (`server/src/routes/webhooks.js`)

```javascript
// server/src/routes/webhooks.js

import { Router } from 'express';
import express from 'express';
import * as webhookController from '../controllers/webhooks.js';

export const webhookRoutes = Router();

// Stripe webhooks require raw body for signature verification.
// This route uses express.raw() instead of express.json().
webhookRoutes.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  webhookController.handleStripeWebhook
);

// GoHighLevel webhook (CRM events)
webhookRoutes.post('/ghl', webhookController.handleGHLWebhook);
```

### 4.9 Admin Routes (`server/src/routes/admin.js`)

```javascript
// server/src/routes/admin.js

import { Router } from 'express';
import * as adminController from '../controllers/admin.js';
import { validate } from '../middleware/validate.js';
import {
  adminUserQuerySchema,
  adminProductCreateSchema,
  adminProductUpdateSchema,
} from '../validation/admin.js';

export const adminRoutes = Router();

// ── Users ────────────────────────────────────
// GET /api/v1/admin/users -- List all users (paginated)
adminRoutes.get('/users', validate({ query: adminUserQuerySchema }), adminController.listUsers);

// GET /api/v1/admin/users/:userId -- Get user details
adminRoutes.get('/users/:userId', adminController.getUser);

// ── Brands ───────────────────────────────────
// GET /api/v1/admin/brands -- List all brands (paginated, filterable)
adminRoutes.get('/brands', adminController.listAllBrands);

// ── Products (catalog management) ────────────
// POST /api/v1/admin/products -- Create product
adminRoutes.post(
  '/products',
  validate({ body: adminProductCreateSchema }),
  adminController.createProduct
);

// PATCH /api/v1/admin/products/:productId -- Update product
adminRoutes.patch(
  '/products/:productId',
  validate({ body: adminProductUpdateSchema }),
  adminController.updateProduct
);

// DELETE /api/v1/admin/products/:productId -- Disable product
adminRoutes.delete('/products/:productId', adminController.disableProduct);

// ── System ───────────────────────────────────
// GET /api/v1/admin/jobs -- BullMQ job queue status
adminRoutes.get('/jobs', adminController.getJobStatus);

// GET /api/v1/admin/metrics -- System metrics (costs, generation counts)
adminRoutes.get('/metrics', adminController.getMetrics);
```

### 4.10 Controller Pattern (`server/src/controllers/brands.js` -- example)

Every route handler follows the same pattern: validate (already done by middleware), call service, return structured response.

```javascript
// server/src/controllers/brands.js

import * as brandService from '../services/brand.js';
import { logger } from '../lib/logger.js';

/**
 * GET /api/v1/brands
 * List all brands for the authenticated user.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function listBrands(req, res) {
  const brands = await brandService.listByUserId(req.user.id);

  res.json({
    success: true,
    data: brands,
    meta: { count: brands.length },
  });
}

/**
 * POST /api/v1/brands
 * Create a new brand.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function createBrand(req, res) {
  const brand = await brandService.create(req.user.id, req.body);

  logger.info({
    msg: 'Brand created',
    requestId: req.id,
    userId: req.user.id,
    brandId: brand.id,
  });

  res.status(201).json({ success: true, data: brand });
}

/**
 * GET /api/v1/brands/:brandId
 * Get a single brand by ID (scoped to authenticated user).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function getBrand(req, res) {
  const brand = await brandService.getByIdAndUser(req.params.brandId, req.user.id);
  res.json({ success: true, data: brand });
}

/**
 * PATCH /api/v1/brands/:brandId
 * Update a brand.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function updateBrand(req, res) {
  const brand = await brandService.update(req.params.brandId, req.user.id, req.body);
  res.json({ success: true, data: brand });
}

/**
 * DELETE /api/v1/brands/:brandId
 * Delete a brand and all its assets.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function deleteBrand(req, res) {
  await brandService.remove(req.params.brandId, req.user.id);

  logger.info({
    msg: 'Brand deleted',
    requestId: req.id,
    userId: req.user.id,
    brandId: req.params.brandId,
  });

  res.status(204).end();
}

/**
 * GET /api/v1/brands/:brandId/assets
 * List all assets for a brand.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function listBrandAssets(req, res) {
  const assets = await brandService.listAssets(req.params.brandId, req.user.id);
  res.json({ success: true, data: assets });
}

/**
 * POST /api/v1/brands/:brandId/generate/logos
 * Queue logo generation via BullMQ.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function generateLogos(req, res) {
  const job = await brandService.queueLogoGeneration(
    req.params.brandId,
    req.user.id,
    req.body
  );

  logger.info({
    msg: 'Logo generation queued',
    requestId: req.id,
    userId: req.user.id,
    brandId: req.params.brandId,
    jobId: job.id,
  });

  // Return immediately -- client listens on Socket.io for progress
  res.status(202).json({
    success: true,
    data: { jobId: job.id },
    message: 'Logo generation queued. Listen on Socket.io for progress.',
  });
}

/**
 * POST /api/v1/brands/:brandId/generate/mockups
 * Queue mockup generation via BullMQ.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function generateMockups(req, res) {
  const job = await brandService.queueMockupGeneration(
    req.params.brandId,
    req.user.id,
    req.body
  );

  res.status(202).json({
    success: true,
    data: { jobId: job.id },
    message: 'Mockup generation queued. Listen on Socket.io for progress.',
  });
}
```

---

## 5. Configuration

Configuration is centralized in `server/src/config/index.js` using `envalid`. The server crashes immediately on startup if any required variable is missing -- fail fast, not fail silently.

### 5.1 Config Module (`server/src/config/index.js`)

```javascript
// server/src/config/index.js

import { cleanEnv, str, port, url, num, bool } from 'envalid';

/**
 * Validated, typed environment configuration.
 *
 * envalid validates ALL variables on import. If any required variable is missing
 * or has an invalid type, the process crashes immediately with a clear error message.
 *
 * Usage:
 *   import { config } from '../config/index.js';
 *   console.log(config.PORT); // number, guaranteed to exist
 */
export const config = cleanEnv(process.env, {
  // ── App ────────────────────────────────────────────────────
  NODE_ENV: str({
    choices: ['development', 'staging', 'production', 'test'],
    desc: 'Runtime environment',
  }),
  PORT: port({
    default: 3000,
    desc: 'HTTP server port',
  }),
  API_URL: url({
    devDefault: 'http://localhost:3000',
    desc: 'Public API URL (used in CORS, email links, resume tokens)',
  }),
  APP_URL: url({
    devDefault: 'http://localhost:5173',
    desc: 'Frontend SPA URL (used in CORS, redirects)',
  }),
  MARKETING_URL: url({
    devDefault: 'http://localhost:3001',
    desc: 'Marketing site URL (used in CORS)',
  }),
  LOG_LEVEL: str({
    choices: ['fatal', 'error', 'warn', 'info', 'debug', 'trace'],
    default: 'info',
    desc: 'pino log level',
  }),

  // ── Security ───────────────────────────────────────────────
  CORS_ORIGINS: str({
    devDefault: 'http://localhost:5173,http://localhost:3000',
    desc: 'Comma-separated list of allowed CORS origins',
  }),
  RESUME_TOKEN_SECRET: str({
    devDefault: 'dev-resume-token-secret-change-in-production',
    desc: 'HMAC secret for wizard resume tokens',
  }),

  // ── Supabase ───────────────────────────────────────────────
  SUPABASE_URL: url({
    desc: 'Supabase project URL',
  }),
  SUPABASE_ANON_KEY: str({
    desc: 'Supabase anonymous/public API key',
  }),
  SUPABASE_SERVICE_ROLE_KEY: str({
    desc: 'Supabase service role key (server-side only, bypasses RLS)',
  }),

  // ── Redis ──────────────────────────────────────────────────
  REDIS_URL: url({
    devDefault: 'redis://localhost:6379',
    desc: 'Redis connection URL (used for BullMQ, rate limiting, caching)',
  }),

  // ── AI Providers ───────────────────────────────────────────
  ANTHROPIC_API_KEY: str({
    desc: 'Anthropic API key (Claude models)',
  }),
  OPENAI_API_KEY: str({
    desc: 'OpenAI API key (GPT Image 1.5)',
  }),
  GOOGLE_API_KEY: str({
    desc: 'Google AI API key (Gemini models)',
  }),
  BFL_API_KEY: str({
    desc: 'Black Forest Labs API key (FLUX.2 Pro)',
  }),
  IDEOGRAM_API_KEY: str({
    desc: 'Ideogram API key (Ideogram v3)',
  }),

  // ── Payments ───────────────────────────────────────────────
  STRIPE_SECRET_KEY: str({
    desc: 'Stripe secret API key',
  }),
  STRIPE_PUBLISHABLE_KEY: str({
    desc: 'Stripe publishable key (sent to frontend via config endpoint)',
  }),
  STRIPE_WEBHOOK_SECRET: str({
    desc: 'Stripe webhook signing secret',
  }),

  // ── CRM ────────────────────────────────────────────────────
  GHL_CLIENT_ID: str({
    desc: 'GoHighLevel OAuth client ID',
  }),
  GHL_CLIENT_SECRET: str({
    desc: 'GoHighLevel OAuth client secret',
  }),
  GHL_LOCATION_ID: str({
    desc: 'GoHighLevel location/sub-account ID',
  }),

  // ── Email ──────────────────────────────────────────────────
  RESEND_API_KEY: str({
    desc: 'Resend API key for transactional email',
  }),
  FROM_EMAIL: str({
    default: 'hello@brandmenow.com',
    desc: 'Default sender email address',
  }),
  SUPPORT_EMAIL: str({
    default: 'support@brandmenow.com',
    desc: 'Support team email address',
  }),

  // ── Scraping ───────────────────────────────────────────────
  APIFY_API_TOKEN: str({
    desc: 'Apify API token for social media scraping',
  }),

  // ── Observability ──────────────────────────────────────────
  SENTRY_DSN: str({
    desc: 'Sentry DSN for error tracking and performance monitoring',
  }),
  POSTHOG_API_KEY: str({
    default: '',
    desc: 'PostHog API key for product analytics (optional in dev)',
  }),
  POSTHOG_HOST: url({
    default: 'https://app.posthog.com',
    desc: 'PostHog API host',
  }),

  // ── DigitalOcean ───────────────────────────────────────────
  DO_REGISTRY: str({
    default: 'registry.digitalocean.com/brandmenow',
    desc: 'DigitalOcean container registry URL',
  }),
});

// Convenience booleans (envalid exposes these automatically, but explicit is better)
config.isDev = config.NODE_ENV === 'development';
config.isProd = config.NODE_ENV === 'production';
config.isTest = config.NODE_ENV === 'test';
```

### 5.2 Redis Client (`server/src/lib/redis.js`)

```javascript
// server/src/lib/redis.js

import Redis from 'ioredis';
import { config } from '../config/index.js';
import { logger } from './logger.js';

/**
 * Shared Redis client.
 *
 * Used by:
 * - BullMQ (job queue)
 * - express-rate-limit (distributed rate limiting)
 * - Cache layer (API responses, AI results)
 * - Socket.io adapter (multi-instance pub/sub)
 *
 * Reconnects automatically on connection loss.
 */
export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: true,
  retryStrategy: (times) => {
    if (times > 10) {
      logger.error({ msg: 'Redis connection failed after 10 retries' });
      return null; // Stop retrying
    }
    return Math.min(times * 200, 5000); // Exponential backoff, max 5s
  },
  lazyConnect: false,
});

redis.on('connect', () => {
  logger.info({ msg: 'Redis connected' });
});

redis.on('error', (err) => {
  logger.error({ msg: 'Redis error', error: err.message });
});

redis.on('close', () => {
  logger.warn({ msg: 'Redis connection closed' });
});
```

### 5.3 Supabase Client (`server/src/lib/supabase.js`)

```javascript
// server/src/lib/supabase.js

import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

/**
 * Supabase admin client (service role key).
 *
 * This client bypasses Row Level Security (RLS).
 * Use ONLY for:
 * - Auth token verification (middleware)
 * - Admin operations (user management, data migration)
 * - Server-side operations where RLS is enforced in application code
 *
 * For user-scoped queries, use the scoped client (see below).
 */
export const supabaseAdmin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Create a Supabase client scoped to a specific user's JWT.
 * This client respects RLS policies.
 *
 * Usage:
 *   const supabase = createUserClient(req.headers.authorization.slice(7));
 *   const { data } = await supabase.from('brands').select('*'); // Only user's brands
 *
 * @param {string} accessToken - User's Supabase JWT
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createUserClient(accessToken) {
  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
```

---

## 6. Error Handling

### 6.1 Error Class Hierarchy (`server/src/utils/errors.js`)

All application errors extend a base `AppError` class. Each error type has a specific HTTP status code, error code, and optional details. The global error handler uses these properties to build structured JSON responses.

```javascript
// server/src/utils/errors.js

/**
 * Base application error.
 * All custom errors extend this class.
 *
 * @extends Error
 */
export class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} [statusCode=500] - HTTP status code
   * @param {string} [code='INTERNAL_ERROR'] - Machine-readable error code
   * @param {Object} [details=null] - Additional error details (validation errors, etc.)
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // Distinguishes expected errors from bugs

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 -- Validation error (bad request body, query, or params).
 *
 * @extends AppError
 */
export class ValidationError extends AppError {
  /**
   * @param {string} [message='Validation failed']
   * @param {Array<{field: string, message: string}>} [errors=[]]
   */
  constructor(message = 'Validation failed', errors = []) {
    super(message, 400, 'VALIDATION_ERROR', { errors });
  }
}

/**
 * 401/403 -- Authentication or authorization error.
 *
 * @extends AppError
 */
export class AuthError extends AppError {
  /**
   * @param {string} [message='Authentication required']
   * @param {number} [statusCode=401]
   */
  constructor(message = 'Authentication required', statusCode = 401) {
    super(message, statusCode, statusCode === 403 ? 'FORBIDDEN' : 'UNAUTHORIZED');
  }
}

/**
 * 404 -- Resource not found.
 *
 * @extends AppError
 */
export class NotFoundError extends AppError {
  /**
   * @param {string} [message='Resource not found']
   */
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * 429 -- Rate limit exceeded.
 *
 * @extends AppError
 */
export class RateLimitError extends AppError {
  /**
   * @param {string} [message='Rate limit exceeded']
   */
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

/**
 * 409 -- Conflict (duplicate resource, version mismatch).
 *
 * @extends AppError
 */
export class ConflictError extends AppError {
  /**
   * @param {string} [message='Resource conflict']
   */
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * 402 -- Payment required (insufficient credits, subscription expired).
 *
 * @extends AppError
 */
export class PaymentRequiredError extends AppError {
  /**
   * @param {string} [message='Payment required']
   */
  constructor(message = 'Payment required') {
    super(message, 402, 'PAYMENT_REQUIRED');
  }
}

/**
 * 503 -- Service unavailable (external dependency down).
 *
 * @extends AppError
 */
export class ServiceUnavailableError extends AppError {
  /**
   * @param {string} [message='Service temporarily unavailable']
   */
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}
```

### 6.2 Global Error Handler Middleware (`server/src/middleware/error-handler.js`)

```javascript
// server/src/middleware/error-handler.js

import * as Sentry from '@sentry/node';
import { AppError } from '../utils/errors.js';
import { logger } from '../lib/logger.js';
import { config } from '../config/index.js';

/**
 * Global error handler middleware.
 *
 * Catches all errors that reach the middleware chain and returns
 * a structured JSON response. Reports non-operational errors to Sentry.
 *
 * Express 5 automatically catches errors thrown in async route handlers,
 * so try/catch blocks in controllers are optional.
 *
 * Response format:
 * {
 *   success: false,
 *   error: {
 *     code: 'VALIDATION_ERROR',
 *     message: 'Validation failed',
 *     details: { errors: [...] },
 *     requestId: '550e8400-e29b-41d4-a716-446655440000'
 *   }
 * }
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export function errorHandler(err, req, res, _next) {
  // Default to 500 Internal Server Error
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details = null;

  if (err instanceof AppError) {
    // Known, operational error
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.type === 'entity.parse.failed') {
    // express.json() parse error
    statusCode = 400;
    code = 'PARSE_ERROR';
    message = 'Invalid JSON in request body';
  } else if (err.message?.includes('CORS')) {
    // CORS error from cors middleware
    statusCode = 403;
    code = 'CORS_ERROR';
    message = err.message;
  }

  // Log the error
  const logPayload = {
    msg: 'Request error',
    requestId: req.id,
    statusCode,
    code,
    error: err.message,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id || null,
    ip: req.ip,
  };

  if (statusCode >= 500) {
    // Server errors get full stack trace in logs
    logPayload.stack = err.stack;
    logger.error(logPayload);

    // Report unexpected (non-operational) errors to Sentry
    if (!(err instanceof AppError) || !err.isOperational) {
      Sentry.withScope((scope) => {
        scope.setTag('requestId', req.id);
        scope.setUser({ id: req.user?.id });
        scope.setContext('request', {
          method: req.method,
          url: req.originalUrl,
          query: req.query,
          // Never send body to Sentry -- may contain PII
        });
        Sentry.captureException(err);
      });
    }
  } else {
    // Client errors (4xx) logged at warn level, no stack trace
    logger.warn(logPayload);
  }

  // Build response
  /** @type {Object} */
  const response = {
    success: false,
    error: {
      code,
      message,
      requestId: req.id,
    },
  };

  // Include details for validation errors (field-level errors)
  if (details) {
    response.error.details = details;
  }

  // Include stack trace in development only
  if (config.isDev && err.stack) {
    response.error.stack = err.stack;
  }

  // Send response
  res.status(statusCode).json(response);
}
```

---

## 7. Health Check Endpoint

A comprehensive health check that verifies every critical dependency. Used by Kubernetes liveness/readiness probes, uptime monitors (Betterstack), and internal dashboards.

### 7.1 Implementation (`server/src/routes/health.js`)

```javascript
// server/src/routes/health.js

import { Router } from 'express';
import { redis } from '../lib/redis.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { Queue } from 'bullmq';
import { config } from '../config/index.js';

export const healthRoute = Router();

/**
 * GET /health
 *
 * Comprehensive health check endpoint.
 *
 * Checks:
 * 1. Express server is running (implicit -- if this responds, it's up)
 * 2. Redis is connected (PING)
 * 3. Supabase is accessible (lightweight query)
 * 4. BullMQ queues are accessible (queue connection check)
 *
 * Returns:
 * - 200 OK if all dependencies are healthy
 * - 503 Service Unavailable if any dependency is down
 *
 * Response format:
 * {
 *   status: 'healthy' | 'degraded' | 'unhealthy',
 *   timestamp: '2026-02-19T12:00:00.000Z',
 *   uptime: 3600,
 *   version: '2.0.0',
 *   checks: {
 *     express: { status: 'up', responseTime: 0 },
 *     redis: { status: 'up', responseTime: 2 },
 *     supabase: { status: 'up', responseTime: 15 },
 *     bullmq: { status: 'up', responseTime: 3 }
 *   }
 * }
 */
healthRoute.get('/', async (_req, res) => {
  const startTime = Date.now();
  const checks = {};
  let overallStatus = 'healthy';

  // ── Check 1: Express (implicit -- always up if we reach here) ──
  checks.express = {
    status: 'up',
    responseTime: 0,
  };

  // ── Check 2: Redis ─────────────────────────────────────────────
  try {
    const redisStart = Date.now();
    const pong = await redis.ping();
    checks.redis = {
      status: pong === 'PONG' ? 'up' : 'down',
      responseTime: Date.now() - redisStart,
    };
  } catch (err) {
    checks.redis = {
      status: 'down',
      responseTime: Date.now() - startTime,
      error: err.message,
    };
    overallStatus = 'degraded';
  }

  // ── Check 3: Supabase ─────────────────────────────────────────
  try {
    const supaStart = Date.now();
    // Lightweight query: select 1 from a system view
    const { error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .limit(1)
      .maybeSingle();

    checks.supabase = {
      status: error ? 'down' : 'up',
      responseTime: Date.now() - supaStart,
      ...(error && { error: error.message }),
    };

    if (error) overallStatus = 'degraded';
  } catch (err) {
    checks.supabase = {
      status: 'down',
      responseTime: Date.now() - startTime,
      error: err.message,
    };
    overallStatus = 'unhealthy';
  }

  // ── Check 4: BullMQ Queues ────────────────────────────────────
  try {
    const bullStart = Date.now();
    const testQueue = new Queue('health-check', {
      connection: { url: config.REDIS_URL },
    });

    // Check if the queue can connect (implicitly tests Redis for BullMQ)
    await testQueue.getJobCounts();
    await testQueue.close();

    checks.bullmq = {
      status: 'up',
      responseTime: Date.now() - bullStart,
    };
  } catch (err) {
    checks.bullmq = {
      status: 'down',
      responseTime: Date.now() - startTime,
      error: err.message,
    };
    overallStatus = 'degraded';
  }

  // ── Build response ────────────────────────────────────────────
  const statusCode = overallStatus === 'unhealthy' ? 503 : 200;

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: process.env.npm_package_version || '2.0.0',
    environment: config.NODE_ENV,
    checks,
    totalResponseTime: Date.now() - startTime,
  };

  // Don't log health checks unless something is wrong
  if (overallStatus !== 'healthy') {
    logger.warn({
      msg: 'Health check degraded',
      status: overallStatus,
      checks,
    });
  }

  res.status(statusCode).json(response);
});
```

---

## 8. Docker Setup

### 8.1 Dockerfile -- Multi-Stage Build (`server/Dockerfile`)

```dockerfile
# server/Dockerfile

# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy dependency files only (for layer caching)
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# ============================================
# Stage 2: Build (if needed for future TS/build step)
# ============================================
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source code
COPY src/ ./src/
COPY config/ ./config/

# ============================================
# Stage 3: Production
# ============================================
FROM node:22-alpine AS production

# Security: run as non-root user
RUN addgroup -g 1001 -S bmn && \
    adduser -S bmn -u 1001 -G bmn

WORKDIR /app

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source from build stage
COPY --from=build /app/src ./src
COPY --from=build /app/config ./config
COPY --from=build /app/package.json ./package.json

# Set ownership to non-root user
RUN chown -R bmn:bmn /app

USER bmn

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the server
ENV NODE_ENV=production
CMD ["node", "src/index.js"]
```

### 8.2 Docker Compose -- Local Development (`server/docker-compose.yml`)

```yaml
# server/docker-compose.yml
#
# Local development environment.
# Starts: Express API server + Redis + BullMQ workers
#
# Usage:
#   docker compose up        # Start all services
#   docker compose up -d     # Start in background
#   docker compose logs -f   # Follow logs
#   docker compose down      # Stop and remove containers

version: '3.9'

services:
  # ── Express.js API Server ──────────────────────────────────
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: build  # Use build stage (includes dev dependencies)
    ports:
      - '3000:3000'
    volumes:
      - ./src:/app/src:ro           # Mount source for live reload
      - ./config:/app/config:ro     # Mount config
    env_file:
      - .env
    environment:
      NODE_ENV: development
      REDIS_URL: redis://redis:6379
    depends_on:
      redis:
        condition: service_healthy
    command: ['node', '--watch', 'src/index.js']  # Node.js 22 native watch mode
    restart: unless-stopped
    networks:
      - bmn-network

  # ── Redis (BullMQ + Cache + Rate Limiting) ─────────────────
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data
    command: >
      redis-server
        --appendonly yes
        --maxmemory 256mb
        --maxmemory-policy allkeys-lru
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - bmn-network

  # ── BullMQ Worker (separate process) ───────────────────────
  worker:
    build:
      context: .
      dockerfile: Dockerfile
      target: build
    volumes:
      - ./src:/app/src:ro
      - ./config:/app/config:ro
    env_file:
      - .env
    environment:
      NODE_ENV: development
      REDIS_URL: redis://redis:6379
    depends_on:
      redis:
        condition: service_healthy
    command: ['node', '--watch', 'src/workers/index.js']
    restart: unless-stopped
    networks:
      - bmn-network

volumes:
  redis-data:
    driver: local

networks:
  bmn-network:
    driver: bridge
```

### 8.3 Docker Ignore (`server/.dockerignore`)

```
# server/.dockerignore

node_modules
npm-debug.log
.env
.env.*
.git
.gitignore
.dockerignore
Dockerfile
docker-compose.yml
README.md
docs/
coverage/
.nyc_output/
*.test.js
*.spec.js
__tests__/
tests/
.vscode/
.idea/
*.md
.DS_Store
```

---

## 9. File Manifest

Every file that needs to be created for the server core, organized by directory.

### Server Entry & App

| File | Purpose |
|------|---------|
| `server/src/index.js` | Entry point. Boots server, registers shutdown handlers, process error handlers |
| `server/src/app.js` | Express app factory. Middleware chain + route registration. Exported for testing |

### Configuration

| File | Purpose |
|------|---------|
| `server/src/config/index.js` | Centralized config via envalid. Validates all env vars on import |

### Libraries (shared utilities)

| File | Purpose |
|------|---------|
| `server/src/lib/logger.js` | pino logger instance. JSON in prod, pretty-print in dev. Redacts secrets |
| `server/src/lib/redis.js` | ioredis client. Shared by BullMQ, rate limiter, cache |
| `server/src/lib/supabase.js` | Supabase admin client + user-scoped client factory |
| `server/src/lib/sentry.js` | Sentry SDK initialization (imported first in index.js). See 12-OBSERVABILITY |

### Middleware

| File | Purpose |
|------|---------|
| `server/src/middleware/helmet.js` | Security headers (CSP, HSTS, X-Frame-Options) |
| `server/src/middleware/cors.js` | CORS with configurable origin allowlist from env |
| `server/src/middleware/request-id.js` | crypto.randomUUID per request, set on req.id + response header |
| `server/src/middleware/http-logger.js` | pino-http structured request/response logging |
| `server/src/middleware/cookie-parser.js` | Cookie parsing (SSR auth, resume tokens) |
| `server/src/middleware/rate-limit.js` | Redis-backed rate limiting (general, generation, auth, webhook) |
| `server/src/middleware/auth.js` | Supabase JWT verification. authMiddleware, adminMiddleware, optionalAuthMiddleware |
| `server/src/middleware/validate.js` | Zod schema validation for body, query, params |
| `server/src/middleware/not-found.js` | 404 handler for unmatched routes |
| `server/src/middleware/error-handler.js` | Global error handler. Sentry reporting + structured JSON response |

### Routes

| File | Purpose |
|------|---------|
| `server/src/routes/index.js` | Route registration hub. Maps route groups to paths with middleware |
| `server/src/routes/health.js` | GET /health -- comprehensive dependency health check |
| `server/src/routes/auth.js` | /api/v1/auth -- signup, login, refresh, logout, OAuth callback |
| `server/src/routes/brands.js` | /api/v1/brands -- CRUD + asset listing + generation queueing |
| `server/src/routes/wizard.js` | /api/v1/wizard -- wizard flow, step saving, AI generation, resume |
| `server/src/routes/products.js` | /api/v1/products -- product catalog listing, categories |
| `server/src/routes/payments.js` | /api/v1/payments -- Stripe checkout, portal, subscription, credits |
| `server/src/routes/webhooks.js` | /api/v1/webhooks -- Stripe webhook (raw body), GHL webhook |
| `server/src/routes/admin.js` | /api/v1/admin -- user management, brand listing, product CRUD, jobs, metrics |

### Controllers

| File | Purpose |
|------|---------|
| `server/src/controllers/auth.js` | Auth handlers: signup, login, refresh, logout, oauthCallback |
| `server/src/controllers/brands.js` | Brand handlers: list, create, get, update, delete, assets, generate |
| `server/src/controllers/wizard.js` | Wizard handlers: start, getState, saveStep, analyzeSocial, generateIdentity, resume, complete |
| `server/src/controllers/products.js` | Product handlers: list, get, listCategories |
| `server/src/controllers/payments.js` | Payment handlers: createCheckout, createPortal, getSubscription, getCredits |
| `server/src/controllers/webhooks.js` | Webhook handlers: handleStripeWebhook, handleGHLWebhook |
| `server/src/controllers/admin.js` | Admin handlers: listUsers, getUser, listAllBrands, product CRUD, jobs, metrics |

### Services (business logic)

| File | Purpose |
|------|---------|
| `server/src/services/brand.js` | Brand CRUD, asset management, generation job queueing |
| `server/src/services/wizard.js` | Wizard state management, step validation, resume token generation |
| `server/src/services/auth.js` | Auth operations: Supabase auth calls, profile creation, GHL contact sync |
| `server/src/services/product.js` | Product catalog queries, category listing, search |
| `server/src/services/payment.js` | Stripe checkout, portal, subscription, credit management |
| `server/src/services/admin.js` | Admin operations: user queries, brand queries, metrics aggregation |

### Validation Schemas

| File | Purpose |
|------|---------|
| `server/src/validation/auth.js` | Zod schemas: signupSchema, loginSchema, refreshSchema |
| `server/src/validation/brands.js` | Zod schemas: brandCreateSchema, brandUpdateSchema, brandIdParamsSchema |
| `server/src/validation/wizard.js` | Zod schemas: wizardStartSchema, wizardStepUpdateSchema, socialHandlesSchema, wizardResumeSchema |
| `server/src/validation/products.js` | Zod schemas: productQuerySchema, productIdParamsSchema |
| `server/src/validation/payments.js` | Zod schemas: checkoutSessionSchema, portalSessionSchema |
| `server/src/validation/admin.js` | Zod schemas: adminUserQuerySchema, adminProductCreateSchema, adminProductUpdateSchema |

### Error Utilities

| File | Purpose |
|------|---------|
| `server/src/utils/errors.js` | AppError hierarchy: ValidationError, AuthError, NotFoundError, RateLimitError, ConflictError, PaymentRequiredError, ServiceUnavailableError |

### Socket.io (stubs -- detailed in 06-REAL-TIME-JOBS)

| File | Purpose |
|------|---------|
| `server/src/sockets/index.js` | Socket.io server creation + namespace registration |
| `server/src/sockets/wizard.js` | /wizard namespace -- generation progress events |
| `server/src/sockets/dashboard.js` | /dashboard namespace -- brand update events |
| `server/src/sockets/admin.js` | /admin namespace -- system events |

### Workers (stubs -- detailed in 06-REAL-TIME-JOBS)

| File | Purpose |
|------|---------|
| `server/src/workers/index.js` | Worker startup orchestrator. Imports and starts all workers |

### Docker & Config

| File | Purpose |
|------|---------|
| `server/Dockerfile` | Multi-stage Docker build (deps, build, production) |
| `server/docker-compose.yml` | Local dev: Express + Redis + Worker |
| `server/.dockerignore` | Files excluded from Docker build context |
| `server/package.json` | Dependencies and scripts |
| `server/.env.example` | Template for all required environment variables |

---

## 10. Environment Variables

Complete list of all environment variables required by the server. Copy to `server/.env` for local development.

```bash
# server/.env.example
#
# Copy this file to .env and fill in values.
# The server WILL NOT START if required variables are missing.

# ── App ───────────────────────────────────────────────────────
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000
APP_URL=http://localhost:5173
MARKETING_URL=http://localhost:3001
LOG_LEVEL=debug

# ── Security ─────────────────────────────────────────────────
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:3001
RESUME_TOKEN_SECRET=                   # Generate: openssl rand -hex 32

# ── Supabase ─────────────────────────────────────────────────
SUPABASE_URL=                          # https://xxxx.supabase.co
SUPABASE_ANON_KEY=                     # Supabase dashboard > Settings > API
SUPABASE_SERVICE_ROLE_KEY=             # Supabase dashboard > Settings > API (secret)

# ── Redis ────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379       # Docker: redis://redis:6379

# ── AI Providers ─────────────────────────────────────────────
ANTHROPIC_API_KEY=                     # https://console.anthropic.com
OPENAI_API_KEY=                        # https://platform.openai.com
GOOGLE_API_KEY=                        # https://aistudio.google.dev
BFL_API_KEY=                           # https://docs.bfl.ml
IDEOGRAM_API_KEY=                      # https://ideogram.ai/api

# ── Payments ─────────────────────────────────────────────────
STRIPE_SECRET_KEY=                     # sk_test_... or sk_live_...
STRIPE_PUBLISHABLE_KEY=               # pk_test_... or pk_live_...
STRIPE_WEBHOOK_SECRET=                 # whsec_...

# ── CRM ──────────────────────────────────────────────────────
GHL_CLIENT_ID=                         # GoHighLevel OAuth app
GHL_CLIENT_SECRET=                     # GoHighLevel OAuth app
GHL_LOCATION_ID=                       # GoHighLevel location/sub-account

# ── Email ────────────────────────────────────────────────────
RESEND_API_KEY=                        # https://resend.com
FROM_EMAIL=hello@brandmenow.com
SUPPORT_EMAIL=support@brandmenow.com

# ── Scraping ─────────────────────────────────────────────────
APIFY_API_TOKEN=                       # https://console.apify.com

# ── Observability ────────────────────────────────────────────
SENTRY_DSN=                            # https://sentry.io > Project Settings > DSN
POSTHOG_API_KEY=                       # https://app.posthog.com > Project Settings
POSTHOG_HOST=https://app.posthog.com

# ── DigitalOcean ─────────────────────────────────────────────
DO_REGISTRY=registry.digitalocean.com/brandmenow
```

---

## 11. Development Prompt

Use this prompt with Claude Code to build the server core from scratch:

---

**Prompt:**

```
You are building the Express.js 5 API server for Brand Me Now v2. Read these specification docs for full context:

- docs/prd/01-PRODUCT-REQUIREMENTS.md (PRD)
- docs/prd/03-SERVER-CORE.md (this document -- server spec)
- docs/09-GREENFIELD-REBUILD-BLUEPRINT.md (master blueprint)

Build the server in this order:

1. Initialize the project:
   - mkdir -p server/src/{config,lib,middleware,routes,controllers,services,validation,utils,sockets,workers}
   - cd server && pnpm init
   - Install dependencies:
     pnpm add express@5 helmet cors cookie-parser ioredis bullmq socket.io pino pino-http envalid zod @supabase/supabase-js @sentry/node @sentry/profiling-node express-rate-limit rate-limit-redis
   - Install dev dependencies:
     pnpm add -D pino-pretty vitest supertest

2. Create the configuration module (server/src/config/index.js):
   - Use envalid to validate ALL env vars from the spec
   - Crash on missing required variables
   - Export typed config object

3. Create the library modules:
   - server/src/lib/logger.js (pino with redaction, pretty-print in dev)
   - server/src/lib/redis.js (ioredis with reconnect strategy)
   - server/src/lib/supabase.js (admin client + user-scoped factory)
   - server/src/lib/sentry.js (Sentry init, must be imported first)

4. Create ALL middleware files in exact order from the spec:
   - helmet.js, cors.js, request-id.js, http-logger.js, cookie-parser.js
   - rate-limit.js (4 limiters: general, generation, auth, webhook)
   - auth.js (authMiddleware, adminMiddleware, optionalAuthMiddleware)
   - validate.js (Zod validation factory)
   - not-found.js, error-handler.js

5. Create the error class hierarchy (server/src/utils/errors.js):
   - AppError base class
   - ValidationError, AuthError, NotFoundError, RateLimitError
   - ConflictError, PaymentRequiredError, ServiceUnavailableError

6. Create ALL route files with their controller patterns:
   - routes/index.js (registration hub)
   - routes/health.js (comprehensive health check)
   - routes/auth.js, brands.js, wizard.js, products.js, payments.js, webhooks.js, admin.js
   - Create corresponding controller files with async handlers
   - Create corresponding validation schema files with Zod

7. Create the app factory (server/src/app.js):
   - Apply middleware in exact order from spec
   - Register routes
   - Attach Sentry handlers
   - Export createApp() for testing

8. Create the entry point (server/src/index.js):
   - Import sentry first
   - Create app, HTTP server, Socket.io, workers
   - Register SIGTERM/SIGINT handlers with graceful shutdown
   - Register unhandledRejection/uncaughtException handlers

9. Create Socket.io stubs:
   - sockets/index.js (creates Socket.io server, registers namespaces)
   - sockets/wizard.js, dashboard.js, admin.js (namespace handlers)

10. Create worker stubs:
    - workers/index.js (worker startup orchestrator)

11. Create Docker files:
    - Dockerfile (multi-stage: deps, build, production)
    - docker-compose.yml (api + redis + worker)
    - .dockerignore

12. Create .env.example with all variables from the spec.

13. Add npm scripts to package.json:
    - "dev": "node --watch src/index.js"
    - "start": "node src/index.js"
    - "test": "vitest"
    - "docker:up": "docker compose up"
    - "docker:down": "docker compose down"

Constraints:
- JavaScript only (no TypeScript). Use JSDoc for types.
- Express 5 (native async error handling).
- Every file must have complete, runnable code.
- Follow the exact middleware order from the spec.
- Use the exact error class hierarchy from the spec.
- Use the exact route structure from the spec.
- All code must be production-quality with proper error handling.
```

---

## 12. Acceptance Criteria

A numbered list of testable criteria. The server core is complete when all of these pass.

### Startup & Configuration

1. **AC-01:** Server crashes immediately with a clear error message listing all missing environment variables when any required variable from `config/index.js` is absent.
2. **AC-02:** Server starts successfully on the configured `PORT` (default 3000) when all required environment variables are set.
3. **AC-03:** Server logs a structured JSON message on startup that includes `port`, `env`, and `pid`.
4. **AC-04:** Sentry is initialized before any other module is imported (verified by Sentry transaction appearing for the first request).

### Middleware Chain

5. **AC-05:** All responses include security headers set by Helmet: `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`.
6. **AC-06:** Requests from origins not in the `CORS_ORIGINS` allowlist receive a 403 response with a CORS error message.
7. **AC-07:** Requests from allowed origins receive proper `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials` headers.
8. **AC-08:** Every response includes an `X-Request-ID` header containing a valid UUID.
9. **AC-09:** The same `X-Request-ID` from the response header appears in the corresponding pino log entry for that request.
10. **AC-10:** Request/response logs are structured JSON in production (pino default) and pretty-printed in development.
11. **AC-11:** `GET /health` requests do not appear in pino-http access logs (suppressed to reduce noise).
12. **AC-12:** `express.json()` accepts request bodies up to 10MB and rejects larger payloads with a 413 status.
13. **AC-13:** Malformed JSON in request bodies returns a 400 response with `code: 'PARSE_ERROR'`.
14. **AC-14:** After 100 requests in 60 seconds from the same user/IP, subsequent requests receive a 429 response with `code: 'RATE_LIMIT_EXCEEDED'`.
15. **AC-15:** Rate limiting is backed by Redis in production (verified: rate limits persist across server restarts).
16. **AC-16:** AI generation endpoints return 429 after 5 requests in 60 seconds from the same user.
17. **AC-17:** Auth endpoints return 429 after 10 attempts in 15 minutes from the same IP.

### Authentication

18. **AC-18:** Requests to authenticated routes (`/api/v1/brands`, `/api/v1/wizard`, `/api/v1/products`, `/api/v1/payments`) without an `Authorization` header return 401 with `code: 'UNAUTHORIZED'`.
19. **AC-19:** Requests with an expired or malformed JWT return 401 with `code: 'UNAUTHORIZED'`.
20. **AC-20:** Requests with a valid Supabase JWT have `req.user` populated with the user object in the handler.
21. **AC-21:** Admin routes (`/api/v1/admin/*`) return 403 for non-admin authenticated users.
22. **AC-22:** Public routes (`/health`, `/api/v1/auth/*`, `/api/v1/webhooks/*`) are accessible without authentication.

### Routes

23. **AC-23:** `GET /health` returns a JSON response with `status`, `timestamp`, `uptime`, `version`, and individual `checks` for express, redis, supabase, and bullmq.
24. **AC-24:** `GET /health` returns 200 when all dependencies are healthy and 503 when any dependency is down.
25. **AC-25:** All API routes are prefixed with `/api/v1/`.
26. **AC-26:** `POST /api/v1/auth/signup` with a valid body creates a user and returns 201.
27. **AC-27:** `POST /api/v1/brands` with a valid body and valid auth creates a brand and returns 201.
28. **AC-28:** `POST /api/v1/brands/:brandId/generate/logos` returns 202 with a `jobId` (does not block on generation).
29. **AC-29:** `POST /api/v1/webhooks/stripe` accepts raw body (not JSON-parsed) for Stripe signature verification.
30. **AC-30:** Requests to non-existent routes return 404 with `code: 'NOT_FOUND'` and the attempted path in the message.

### Validation

31. **AC-31:** Requests with invalid body data return 400 with `code: 'VALIDATION_ERROR'` and an `errors` array containing field-level error details.
32. **AC-32:** Zod validation runs on body, query, and params as configured per route.
33. **AC-33:** Valid requests pass through validation middleware without modification (parsed values replace raw input).

### Error Handling

34. **AC-34:** All error responses follow the structured format: `{ success: false, error: { code, message, requestId } }`.
35. **AC-35:** 4xx errors are logged at `warn` level without stack traces.
36. **AC-36:** 5xx errors are logged at `error` level with full stack traces.
37. **AC-37:** Unexpected (non-AppError) 5xx errors are reported to Sentry with request context (method, URL, userId) but no request body.
38. **AC-38:** Stack traces are included in error responses only when `NODE_ENV=development`.
39. **AC-39:** Thrown errors in async route handlers are caught automatically by Express 5 without explicit try/catch.

### Graceful Shutdown

40. **AC-40:** On `SIGTERM`, the server stops accepting new connections, waits up to 10 seconds for in-flight requests, closes Socket.io, closes Redis, flushes Sentry, then exits with code 0.
41. **AC-41:** On `SIGINT` (Ctrl+C), the same graceful shutdown sequence executes.
42. **AC-42:** If shutdown takes longer than 10 seconds, the process force-exits with code 1.
43. **AC-43:** `unhandledRejection` events are logged and reported to Sentry without crashing the server.
44. **AC-44:** `uncaughtException` events are logged, reported to Sentry, and the server shuts down (exit 1).

### Docker

45. **AC-45:** `docker compose up` starts the API server, Redis, and worker containers.
46. **AC-46:** The API server waits for Redis to be healthy before starting (depends_on with health check).
47. **AC-47:** The Docker image runs as a non-root user (`bmn`).
48. **AC-48:** The production Docker image contains only production dependencies (no devDependencies).
49. **AC-49:** Changes to source files in the mounted volume trigger automatic reload in development (Node.js `--watch`).
50. **AC-50:** Docker health check (`wget /health`) passes when the server is running.

---

## Appendix A: package.json

```json
{
  "name": "@bmn/server",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.0.0"
  },
  "scripts": {
    "dev": "node --watch src/index.js",
    "start": "node src/index.js",
    "test": "vitest",
    "test:ci": "vitest run --reporter=verbose",
    "lint": "eslint src/",
    "docker:up": "docker compose up",
    "docker:down": "docker compose down",
    "docker:build": "docker build -t bmn-api ."
  },
  "dependencies": {
    "@sentry/node": "^8.x",
    "@sentry/profiling-node": "^8.x",
    "@supabase/supabase-js": "^2.x",
    "bullmq": "^5.x",
    "cookie-parser": "^1.x",
    "cors": "^2.x",
    "envalid": "^8.x",
    "express": "^5.x",
    "express-rate-limit": "^7.x",
    "helmet": "^8.x",
    "ioredis": "^5.x",
    "pino": "^9.x",
    "pino-http": "^10.x",
    "rate-limit-redis": "^4.x",
    "socket.io": "^4.x",
    "zod": "^3.x"
  },
  "devDependencies": {
    "pino-pretty": "^11.x",
    "supertest": "^7.x",
    "vitest": "^3.x"
  }
}
```

## Appendix B: Socket.io Server Stub

This is a minimal stub for `server/src/sockets/index.js`. The full Socket.io implementation is specified in `06-REAL-TIME-JOBS.md`.

```javascript
// server/src/sockets/index.js

import { Server } from 'socket.io';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';

/**
 * Create and configure the Socket.io server.
 * Shares the HTTP server with Express.
 *
 * Namespaces:
 * - /wizard    -- AI generation progress events
 * - /dashboard -- Brand update events
 * - /admin     -- System events (admin only)
 *
 * @param {import('http').Server} httpServer
 * @returns {Server}
 */
export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.CORS_ORIGINS.split(',').map((o) => o.trim()),
      credentials: true,
    },
    pingTimeout: 60_000,
    pingInterval: 25_000,
  });

  // Connection logging
  io.on('connection', (socket) => {
    logger.debug({
      msg: 'Socket connected',
      socketId: socket.id,
      transport: socket.conn.transport.name,
    });

    socket.on('disconnect', (reason) => {
      logger.debug({
        msg: 'Socket disconnected',
        socketId: socket.id,
        reason,
      });
    });
  });

  // Register namespaces (stubs -- full implementation in 06-REAL-TIME-JOBS)
  io.of('/wizard');
  io.of('/dashboard');
  io.of('/admin');

  logger.info({ msg: 'Socket.io server initialized', namespaces: ['/wizard', '/dashboard', '/admin'] });

  return io;
}
```

## Appendix C: Worker Startup Stub

Minimal stub for `server/src/workers/index.js`. Full worker implementations are specified in `06-REAL-TIME-JOBS.md`.

```javascript
// server/src/workers/index.js

import { logger } from '../lib/logger.js';

/**
 * Start all BullMQ workers.
 *
 * Workers defined in separate files (see 06-REAL-TIME-JOBS.md):
 * - brand-analysis.js
 * - logo-generation.js
 * - mockup-generation.js
 * - bundle-composition.js
 * - crm-sync.js
 * - email-send.js
 * - cleanup.js
 *
 * @param {import('socket.io').Server} io - Socket.io server for emitting progress events
 */
export async function startWorkers(io) {
  logger.info({ msg: 'BullMQ workers starting' });

  // Workers will be registered here as they are built.
  // Each worker imports the shared Redis connection and Socket.io server.

  logger.info({ msg: 'BullMQ workers started' });
}
```
