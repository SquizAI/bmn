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

  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
}
