// server/src/validation/payments.js

import { z } from 'zod';

/**
 * POST /api/v1/billing/checkout-session
 *
 * Validates the request to create a Stripe Checkout session.
 * Tier must be one of the paid tiers (free has no Stripe product).
 */
export const checkoutSessionSchema = z.object({
  tier: z.enum(['starter', 'pro', 'agency'], {
    required_error: 'Subscription tier is required',
    invalid_type_error: 'Tier must be one of: starter, pro, agency',
  }),
  successUrl: z.string().url('Success URL must be a valid URL').optional(),
  cancelUrl: z.string().url('Cancel URL must be a valid URL').optional(),
});

/**
 * POST /api/v1/billing/portal-session
 *
 * Validates the request to create a Stripe Customer Portal session.
 */
export const portalSessionSchema = z.object({
  returnUrl: z.string().url('Return URL must be a valid URL').optional(),
});
