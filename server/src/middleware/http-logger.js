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
    ignore: (req) => req.url === '/health',
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
