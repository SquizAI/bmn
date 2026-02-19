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
    : undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});
