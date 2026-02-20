// server/src/app.js

import express from 'express';
import * as Sentry from '@sentry/node';
import { securityHeaders, permissionsPolicy } from './middleware/security-headers.js';
import { corsMiddleware } from './middleware/cors.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { httpLogger } from './middleware/http-logger.js';
import { cookieParserMiddleware } from './middleware/cookie-parser.js';
import { generalLimiter } from './middleware/rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { registerRoutes } from './routes/index.js';

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

  // 1. Security headers (Helmet + Permissions-Policy)
  app.use(securityHeaders());
  app.use(permissionsPolicy);

  // 2. CORS (configurable origins from env)
  app.use(corsMiddleware);

  // 3. Request ID generation (crypto.randomUUID)
  app.use(requestIdMiddleware);

  // 4. Structured HTTP logging (pino-http)
  app.use(httpLogger);

  // 5. Body parsing -- JSON with 10MB limit
  //    IMPORTANT: Skip JSON parsing for Stripe webhook route. Stripe signature
  //    verification requires the raw request body (Buffer). The webhook route
  //    applies express.raw() itself in server/src/routes/webhooks.js.
  app.use((req, res, next) => {
    if (req.originalUrl.startsWith('/api/v1/webhooks/stripe')) {
      return next();
    }
    express.json({ limit: '10mb' })(req, res, next);
  });

  // 6. URL-encoded body parsing
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 7. Cookie parser
  app.use(cookieParserMiddleware);

  // 8. Global rate limiting (Redis-backed, tier-aware)
  app.use(generalLimiter);

  // ──────────────────────────────────────────────
  // ROUTES
  // ──────────────────────────────────────────────
  registerRoutes(app);

  // ──────────────────────────────────────────────
  // ERROR HANDLING (must be after routes)
  // ──────────────────────────────────────────────

  // Sentry error handler (Express 5 -- use setupExpressErrorHandler)
  Sentry.setupExpressErrorHandler(app);

  // 404 handler for unmatched routes
  app.use(notFoundHandler);

  // Global error handler (structured JSON response)
  app.use(errorHandler);

  return app;
}
