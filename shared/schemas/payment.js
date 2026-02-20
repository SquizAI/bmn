// shared/schemas/payment.js
//
// Zod schemas for Payment, Subscription, and Credit records.
// Shared between client (TypeScript) and server (JavaScript + JSDoc).

import { z } from 'zod';

// ---- Subscription Tier (re-exported for convenience) ------------------------

export const SubscriptionTierEnum = z.enum([
  'free',
  'starter',
  'pro',
  'agency',
]);

// ---- Subscription Status ----------------------------------------------------

export const SubscriptionStatusEnum = z.enum([
  'active',
  'trialing',
  'past_due',
  'paused',
  'cancelled',
  'incomplete',
]);

// ---- Currency ---------------------------------------------------------------

export const CurrencyEnum = z.enum(['usd', 'eur', 'gbp']);

// ---- Subscription Record ----------------------------------------------------

export const SubscriptionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  stripeSubscriptionId: z.string(),
  stripePriceId: z.string(),
  tier: SubscriptionTierEnum,
  status: SubscriptionStatusEnum,
  currentPeriodStart: z.string().datetime(),
  currentPeriodEnd: z.string().datetime(),
  cancelAtPeriodEnd: z.boolean().default(false),
  cancelledAt: z.string().datetime().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ---- Payment History Record -------------------------------------------------

export const PaymentHistorySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  stripePaymentId: z.string(),
  stripeInvoiceId: z.string().nullable(),
  amount: z.number().min(0),
  currency: CurrencyEnum.default('usd'),
  status: z.enum(['succeeded', 'failed', 'pending', 'refunded']),
  description: z.string().nullable(),
  receiptUrl: z.string().url().nullable(),
  paidAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

// ---- Credit Summary ---------------------------------------------------------

export const CreditSummarySchema = z.object({
  userId: z.string().uuid(),
  tier: SubscriptionTierEnum,
  logos: z.object({
    used: z.number().int().min(0),
    total: z.number().int().min(0),
    remaining: z.number().int().min(0),
  }),
  mockups: z.object({
    used: z.number().int().min(0),
    total: z.number().int().min(0),
    remaining: z.number().int().min(0),
  }),
  videos: z.object({
    used: z.number().int().min(0),
    total: z.number().int().min(0),
    remaining: z.number().int().min(0),
  }),
  overageEnabled: z.boolean(),
  periodEnd: z.string().datetime().nullable(),
});

// ---- Create Checkout Session Request ----------------------------------------

export const CreateCheckoutRequestSchema = z.object({
  tier: SubscriptionTierEnum.refine((t) => t !== 'free', {
    message: 'Cannot create checkout for free tier',
  }),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

// ---- Billing Portal Request -------------------------------------------------

export const CreateBillingPortalRequestSchema = z.object({
  returnUrl: z.string().url().optional(),
});
