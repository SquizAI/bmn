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
    origins.push('http://localhost:5173');
    origins.push('http://localhost:4847');
    origins.push('http://localhost:4173');
  }

  return [...new Set(origins)];
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
  maxAge: 3600,
});
