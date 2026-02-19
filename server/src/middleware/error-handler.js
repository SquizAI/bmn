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
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export function errorHandler(err, req, res, _next) {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details = null;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    code = 'PARSE_ERROR';
    message = 'Invalid JSON in request body';
  } else if (err.message?.includes('CORS')) {
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
        });
        Sentry.captureException(err);
      });
    }
  } else {
    logger.warn(logPayload);
  }

  /** @type {Object} */
  const response = {
    success: false,
    error: {
      code,
      message,
      requestId: req.id,
    },
  };

  if (details) {
    response.error.details = details;
  }

  if (config.isDev && err.stack) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
