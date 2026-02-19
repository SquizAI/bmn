// server/src/middleware/validate.js

import { ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';

/**
 * Create a Zod validation middleware for request body, query, or params.
 *
 * Usage:
 *   import { brandCreateSchema } from '../validation/brands.js';
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
