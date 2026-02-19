// server/src/validation/admin.js

import { z } from 'zod';

/**
 * GET /api/v1/admin/users (query params)
 */
export const adminUserQuerySchema = z.object({
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * POST /api/v1/admin/products
 */
export const adminProductCreateSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200),
  sku: z.string().min(1, 'SKU is required').max(50),
  category: z.string().min(1, 'Category is required').max(50),
  description: z.string().max(1000).optional(),
  base_cost: z.number().positive('Base cost must be positive'),
  suggested_price: z.number().positive('Suggested price must be positive'),
  mockup_template_url: z.string().url().optional(),
  is_active: z.boolean().default(true),
});

/**
 * PATCH /api/v1/admin/products/:productId
 */
export const adminProductUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sku: z.string().min(1).max(50).optional(),
  category: z.string().min(1).max(50).optional(),
  description: z.string().max(1000).optional(),
  base_cost: z.number().positive().optional(),
  suggested_price: z.number().positive().optional(),
  mockup_template_url: z.string().url().optional(),
  is_active: z.boolean().optional(),
});
