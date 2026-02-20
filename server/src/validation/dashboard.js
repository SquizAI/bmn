// server/src/validation/dashboard.js

import { z } from 'zod';

export const dashboardOverviewQuerySchema = z.object({
  brandId: z.string().uuid().optional(),
  period: z.enum(['today', '7d', '30d', '90d', 'all']).default('30d'),
});

export const topProductsQuerySchema = z.object({
  brandId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
