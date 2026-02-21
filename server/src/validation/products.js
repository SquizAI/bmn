// server/src/validation/products.js

import { z } from 'zod';

/**
 * GET /api/v1/products (query params)
 */
export const productQuerySchema = z.object({
  category: z.string().max(50).optional(),
  tier: z.string().max(50).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * URL params for product routes
 */
export const productIdParamsSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
});
