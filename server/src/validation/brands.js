// server/src/validation/brands.js

import { z } from 'zod';

/**
 * POST /api/v1/brands
 */
export const brandCreateSchema = z.object({
  name: z.string().min(1, 'Brand name is required').max(100),
  description: z.string().max(500).optional(),
});

/**
 * PATCH /api/v1/brands/:brandId
 */
export const brandUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

/**
 * URL params for brand routes
 */
export const brandIdParamsSchema = z.object({
  brandId: z.string().uuid('Invalid brand ID'),
});
