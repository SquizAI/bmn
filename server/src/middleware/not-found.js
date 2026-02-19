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
