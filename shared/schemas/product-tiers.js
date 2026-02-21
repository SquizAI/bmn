// shared/schemas/product-tiers.js
//
// Zod schemas for product tiers (quality/price tiers with subscription gating).
// Shared between client (TypeScript) and server (JavaScript + JSDoc).

import { z } from 'zod';

// ---- Enums ------------------------------------------------------------------

export const MinSubscriptionTierEnum = z.enum(['free', 'starter', 'pro', 'agency']);

// ---- Product Tier -----------------------------------------------------------

export const ProductTierSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  displayName: z.string().min(1).max(200),
  description: z.string().default(''),
  sortOrder: z.number().int().min(0),
  minSubscriptionTier: MinSubscriptionTierEnum,
  marginMultiplier: z.number().positive(),
  badgeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  badgeLabel: z.string().max(50),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

/** @typedef {z.infer<typeof ProductTierSchema>} ProductTier */

// ---- Subscription tier ordering (for gating logic) --------------------------

/** @type {Record<string, number>} */
export const SUBSCRIPTION_TIER_ORDER = {
  free: 0,
  starter: 1,
  pro: 2,
  agency: 3,
};

/**
 * Check if a user's subscription tier meets the minimum required tier.
 * @param {string} userTier - The user's current subscription tier
 * @param {string} requiredTier - The minimum tier required
 * @returns {boolean}
 */
export function meetsSubscriptionTier(userTier, requiredTier) {
  return (SUBSCRIPTION_TIER_ORDER[userTier] ?? -1) >= (SUBSCRIPTION_TIER_ORDER[requiredTier] ?? 0);
}
