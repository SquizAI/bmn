// server/src/lib/sentry.js
// Sentry MUST be imported before everything else in the entry point.

import * as Sentry from '@sentry/node';
import { config } from '../config/index.js';

/**
 * Initialize Sentry for the Express.js API server.
 * MUST be called before any other imports in server.js.
 */
export function initSentry() {
  if (!config.SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    release: process.env.SENTRY_RELEASE || `bmn-api@${process.env.npm_package_version}`,

    // Performance monitoring
    tracesSampleRate: config.isProd ? 0.2 : 1.0,
    profilesSampleRate: config.isProd ? 0.1 : 1.0,

    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],

    // Filter out noisy errors
    ignoreErrors: [
      'ECONNRESET',
      'EPIPE',
      'socket hang up',
    ],

    // Strip secrets from error messages
    beforeSend(event) {
      if (event.message) {
        event.message = redactSecrets(event.message);
      }
      return event;
    },

    // Redact sensitive headers from HTTP breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'http' && breadcrumb.data?.headers) {
        delete breadcrumb.data.headers.authorization;
        delete breadcrumb.data.headers.cookie;
      }
      return breadcrumb;
    },
  });
}

/**
 * Set up Sentry Express.js error handler on the app.
 * Must be called AFTER all routes, BEFORE the generic error handler.
 *
 * Express 5 uses `Sentry.setupExpressErrorHandler(app)` instead of
 * the legacy `Sentry.Handlers.errorHandler()`.
 *
 * @param {import('express').Express} app
 */
export function setupSentryErrorHandler(app) {
  Sentry.setupExpressErrorHandler(app);
}

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
