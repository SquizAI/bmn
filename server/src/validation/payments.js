// server/src/validation/payments.js

import { z } from 'zod';

/**
 * POST /api/v1/payments/checkout
 */
export const checkoutSessionSchema = z.object({
  price_id: z.string().min(1, 'Price ID is required'),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
});

/**
 * POST /api/v1/payments/portal
 */
export const portalSessionSchema = z.object({
  return_url: z.string().url().optional(),
});
