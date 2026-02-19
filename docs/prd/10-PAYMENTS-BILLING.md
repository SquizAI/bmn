# 10 — Payments & Billing Specification

**Product:** Brand Me Now v2
**Date:** February 19, 2026
**Author:** Matt Squarzoni
**Status:** Approved for development
**Depends on:** [01-PRODUCT-REQUIREMENTS.md](./01-PRODUCT-REQUIREMENTS.md), [09-GREENFIELD-REBUILD-BLUEPRINT.md](../09-GREENFIELD-REBUILD-BLUEPRINT.md)

---

## Table of Contents

1. [Stripe Integration Architecture](#1-stripe-integration-architecture)
2. [Subscription Tiers (Detailed)](#2-subscription-tiers-detailed)
3. [Credit System](#3-credit-system)
4. [Stripe Checkout Flow](#4-stripe-checkout-flow)
5. [Webhook Handling](#5-webhook-handling)
6. [Stripe Customer Management](#6-stripe-customer-management)
7. [Database Schema (Payments)](#7-database-schema-payments)
8. [Frontend Integration](#8-frontend-integration)
9. [File Manifest](#9-file-manifest)
10. [Development Prompt](#10-development-prompt)
11. [Acceptance Criteria](#11-acceptance-criteria)

---

## 1. Stripe Integration Architecture

### Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| **Checkout method** | Stripe Checkout (hosted) | PCI DSS compliance out of the box. No card data touches our servers. Stripe handles 3D Secure, Apple Pay, Google Pay. Zero PCI scope. |
| **Billing model** | Subscription + credit-based metering | Base subscription for platform access. Credits consumed per AI generation (logo, mockup, video). Credits refill monthly on billing cycle. |
| **Subscription management** | Stripe Customer Portal (hosted) | Users manage payment methods, cancel, upgrade/downgrade without custom UI. Reduces engineering surface. |
| **Webhook processing** | Express route -> BullMQ job queue | Webhook endpoint returns 200 immediately. Durable processing via BullMQ with retries. Prevents Stripe timeout (10s limit). Survives server restarts. |
| **Idempotency** | Stripe event ID stored in `webhook_events` table | Deduplicate webhook retries. Stripe retries up to 3 days. Every handler checks `webhook_events` before processing. |
| **Environment** | Stripe Test Mode for dev/staging, Live Mode for production | Separate API keys per environment. Test clocks for subscription lifecycle testing. |

### Architecture Diagram

```
User clicks "Subscribe"
  |
  v
POST /api/v1/billing/checkout-session
  |
  +-- Auth middleware (Supabase JWT)
  +-- Credit check: does user already have active subscription?
  +-- Create or retrieve Stripe Customer
  +-- Create Stripe Checkout Session (hosted page)
  +-- Return { checkoutUrl }
  |
  v
Client redirects to Stripe Checkout (stripe.com hosted)
  |
  +-- User enters payment info (PCI-compliant, not our servers)
  +-- Stripe processes payment
  |
  v
Stripe redirects to success_url or cancel_url
  |
  v (async, within seconds)
Stripe sends webhook -> POST /api/v1/webhooks/stripe
  |
  +-- Signature verification (stripe.webhooks.constructEvent)
  +-- Idempotency check (webhook_events table)
  +-- Enqueue BullMQ job: "stripe-webhook" queue
  +-- Return 200 immediately (< 100ms)
  |
  v
BullMQ worker picks up job
  |
  +-- checkout.session.completed -> create subscription + allocate credits
  +-- customer.subscription.updated -> update tier + adjust credits
  +-- customer.subscription.deleted -> downgrade to free
  +-- invoice.payment_succeeded -> refill monthly credits
  +-- invoice.payment_failed -> send warning email, start grace period
  |
  v
Database updated (subscriptions, generation_credits, profiles)
Socket.io emits subscription status change to client
```

### Environment Variables

```bash
# .env (NEVER committed — stored in DO K8s Secrets)
STRIPE_SECRET_KEY=sk_live_...              # Live mode secret key
STRIPE_PUBLISHABLE_KEY=pk_live_...         # Client-side publishable key
STRIPE_WEBHOOK_SECRET=whsec_...            # Webhook endpoint signing secret
STRIPE_CUSTOMER_PORTAL_CONFIG=bpc_...      # Customer portal configuration ID

# Stripe Product/Price IDs (created via Stripe Dashboard or API)
STRIPE_PRODUCT_STARTER=prod_...
STRIPE_PRODUCT_PRO=prod_...
STRIPE_PRODUCT_AGENCY=prod_...
STRIPE_PRICE_STARTER_MONTHLY=price_...     # $29/mo
STRIPE_PRICE_PRO_MONTHLY=price_...         # $79/mo
STRIPE_PRICE_AGENCY_MONTHLY=price_...      # $199/mo

# App URLs
APP_URL=https://app.brandmenow.com
MARKETING_URL=https://brandmenow.com
```

### Stripe SDK Setup

```javascript
// server/src/services/stripe.js

import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('FATAL: STRIPE_SECRET_KEY is required');
}

/** @type {Stripe} */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-18.acacia',   // Pin API version for stability
  maxNetworkRetries: 2,               // Automatic retry on network errors
  timeout: 10_000,                    // 10 second timeout
  telemetry: false,                   // Disable Stripe telemetry in prod
});

export default stripe;
```

---

## 2. Subscription Tiers (Detailed)

### Tier Overview

| Tier | Monthly Price | Brand Limit | Logo Credits/mo | Mockup Credits/mo | Video Credits/mo (Phase 2) | Overage Rate |
|------|-------------|-------------|-----------------|-------------------|---------------------------|--------------|
| **Free Trial** | $0 | 1 | 4 (one-time) | 4 (one-time) | 0 | Blocked (must upgrade) |
| **Starter** | $29/mo | 3 | 20 | 30 | 0 | $0.50/logo, $0.30/mockup |
| **Pro** | $79/mo | 10 | 50 | 100 | 10 | $0.40/logo, $0.25/mockup, $1.00/video |
| **Agency** | $199/mo | Unlimited | 200 | 500 | 50 | $0.30/logo, $0.20/mockup, $0.75/video |

### Tier Details

#### Free Trial ($0)

- **Purpose:** Let users experience the full wizard once before committing.
- **Brand limit:** 1 brand total (not per month).
- **Logo credits:** 4 logos (1 generation round of 4 logos). No regeneration. One-time allocation, not monthly.
- **Mockup credits:** 4 mockups (enough for 4 products). One-time allocation.
- **Video credits:** 0 (Phase 2 feature not available on free tier).
- **Features:** Full wizard flow, basic brand identity, logo generation, mockup generation, profit calculator.
- **Restrictions:** No asset download (watermarked preview only). No chatbot. No API access. No priority queue.
- **Conversion trigger:** User completes wizard -> upsell modal: "Download your brand assets by subscribing."
- **Stripe setup:** No Stripe product. Free trial users have no `stripe_subscription_id`. Tier tracked in `profiles.subscription_tier = 'free'`.

#### Starter ($29/mo)

- **Purpose:** Individual creators monetizing their social presence.
- **Brand limit:** 3 brands (active at any time).
- **Logo credits:** 20/month. Refill on billing cycle date. Unused credits do NOT roll over.
- **Mockup credits:** 30/month. Same refill rules.
- **Video credits:** 0 (Phase 2 not included in Starter).
- **Features:**
  - Full wizard flow with regeneration
  - Asset download (PNG, high-res)
  - SVG logo export (where available)
  - Email support
  - Brand dashboard
  - Chatbot (rate limited: 10 messages/min)
- **Stripe setup:**
  - Product: `STRIPE_PRODUCT_STARTER`
  - Price: `STRIPE_PRICE_STARTER_MONTHLY` ($29.00 USD, recurring monthly)
  - Overage: Blocked by default. User sees "Upgrade to Pro for more credits" prompt.

#### Pro ($79/mo)

- **Purpose:** Serious creators and small business owners.
- **Brand limit:** 10 brands (active at any time).
- **Logo credits:** 50/month.
- **Mockup credits:** 100/month.
- **Video credits:** 10/month (Phase 2).
- **Features:**
  - Everything in Starter
  - Priority generation queue (BullMQ priority: 1 vs default 5)
  - Video generation (Phase 2: Veo 3 product videos)
  - Chat support (higher rate limit: 30 messages/min)
  - Bundle composition (Gemini 3 Pro Image)
  - Advanced profit projections
- **Overage handling:** Optional overage charges at per-unit rates. User can enable/disable overage in settings. If disabled, generation blocks at zero credits.
- **Stripe setup:**
  - Product: `STRIPE_PRODUCT_PRO`
  - Price: `STRIPE_PRICE_PRO_MONTHLY` ($79.00 USD, recurring monthly)

#### Agency ($199/mo)

- **Purpose:** Agencies managing multiple client brands.
- **Brand limit:** Unlimited.
- **Logo credits:** 200/month.
- **Mockup credits:** 500/month.
- **Video credits:** 50/month (Phase 2).
- **Features:**
  - Everything in Pro
  - Unlimited brands
  - White-label export (remove Brand Me Now branding)
  - API access (REST API with API key authentication)
  - Phone support
  - Dedicated Slack channel (manual setup)
  - Custom brand templates
  - Bulk generation (queue multiple brands)
- **Overage handling:** Always enabled. Charged at lowest per-unit rates. Invoiced monthly with subscription.
- **Stripe setup:**
  - Product: `STRIPE_PRODUCT_AGENCY`
  - Price: `STRIPE_PRICE_AGENCY_MONTHLY` ($199.00 USD, recurring monthly)

### Tier Configuration (Server-Side)

```javascript
// server/src/config/tiers.js

/**
 * @typedef {Object} TierConfig
 * @property {string} name
 * @property {string} displayName
 * @property {number} price
 * @property {number} brandLimit - 0 = unlimited
 * @property {number} logoCredits
 * @property {number} mockupCredits
 * @property {number} videoCredits
 * @property {boolean} creditsRefillMonthly
 * @property {boolean} overageEnabled
 * @property {number} overageLogoRate - dollars per logo
 * @property {number} overageMockupRate
 * @property {number} overageVideoRate
 * @property {number} generationPriority - BullMQ priority (1 = highest)
 * @property {string[]} features
 * @property {string|null} stripePriceId
 */

/** @type {Record<string, TierConfig>} */
export const TIER_CONFIG = {
  free: {
    name: 'free',
    displayName: 'Free Trial',
    price: 0,
    brandLimit: 1,
    logoCredits: 4,
    mockupCredits: 4,
    videoCredits: 0,
    creditsRefillMonthly: false,        // One-time allocation only
    overageEnabled: false,
    overageLogoRate: 0,
    overageMockupRate: 0,
    overageVideoRate: 0,
    generationPriority: 10,             // Lowest priority
    features: [
      'basic_wizard',
      'logo_generation',
      'mockup_generation',
      'profit_calculator',
    ],
    stripePriceId: null,                // No Stripe product for free tier
  },

  starter: {
    name: 'starter',
    displayName: 'Starter',
    price: 29,
    brandLimit: 3,
    logoCredits: 20,
    mockupCredits: 30,
    videoCredits: 0,
    creditsRefillMonthly: true,
    overageEnabled: false,              // Blocked — must upgrade
    overageLogoRate: 0.50,
    overageMockupRate: 0.30,
    overageVideoRate: 0,
    generationPriority: 5,             // Default priority
    features: [
      'basic_wizard',
      'logo_generation',
      'mockup_generation',
      'profit_calculator',
      'asset_download',
      'svg_export',
      'email_support',
      'chatbot',
      'brand_dashboard',
    ],
    stripePriceId: process.env.STRIPE_PRICE_STARTER_MONTHLY,
  },

  pro: {
    name: 'pro',
    displayName: 'Pro',
    price: 79,
    brandLimit: 10,
    logoCredits: 50,
    mockupCredits: 100,
    videoCredits: 10,
    creditsRefillMonthly: true,
    overageEnabled: true,               // User can toggle on/off
    overageLogoRate: 0.40,
    overageMockupRate: 0.25,
    overageVideoRate: 1.00,
    generationPriority: 1,             // Highest priority
    features: [
      'basic_wizard',
      'logo_generation',
      'mockup_generation',
      'profit_calculator',
      'asset_download',
      'svg_export',
      'email_support',
      'chatbot',
      'brand_dashboard',
      'priority_generation',
      'video_generation',
      'chat_support',
      'bundle_composition',
      'advanced_projections',
    ],
    stripePriceId: process.env.STRIPE_PRICE_PRO_MONTHLY,
  },

  agency: {
    name: 'agency',
    displayName: 'Agency',
    price: 199,
    brandLimit: 0,                     // 0 = unlimited
    logoCredits: 200,
    mockupCredits: 500,
    videoCredits: 50,
    creditsRefillMonthly: true,
    overageEnabled: true,               // Always on, lowest rates
    overageLogoRate: 0.30,
    overageMockupRate: 0.20,
    overageVideoRate: 0.75,
    generationPriority: 1,             // Highest priority
    features: [
      'basic_wizard',
      'logo_generation',
      'mockup_generation',
      'profit_calculator',
      'asset_download',
      'svg_export',
      'email_support',
      'chatbot',
      'brand_dashboard',
      'priority_generation',
      'video_generation',
      'chat_support',
      'bundle_composition',
      'advanced_projections',
      'white_label',
      'api_access',
      'phone_support',
      'bulk_generation',
      'custom_templates',
    ],
    stripePriceId: process.env.STRIPE_PRICE_AGENCY_MONTHLY,
  },
};

/**
 * Get tier config by name
 * @param {string} tierName
 * @returns {TierConfig}
 */
export function getTierConfig(tierName) {
  const config = TIER_CONFIG[tierName];
  if (!config) throw new Error(`Unknown tier: ${tierName}`);
  return config;
}

/**
 * Get tier config by Stripe Price ID (for webhook processing)
 * @param {string} priceId
 * @returns {TierConfig|null}
 */
export function getTierByPriceId(priceId) {
  return Object.values(TIER_CONFIG).find(t => t.stripePriceId === priceId) || null;
}

/**
 * Check if a feature is available for a tier
 * @param {string} tierName
 * @param {string} featureName
 * @returns {boolean}
 */
export function hasFeature(tierName, featureName) {
  const config = TIER_CONFIG[tierName];
  return config ? config.features.includes(featureName) : false;
}
```

### Stripe Product/Price Setup Script

Run this once to create products and prices in Stripe. Save the returned IDs to environment variables.

```javascript
// scripts/setup-stripe-products.js

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function setupProducts() {
  console.log('Creating Stripe products and prices...\n');

  // --- Starter ($29/mo) ---
  const starterProduct = await stripe.products.create({
    name: 'Brand Me Now — Starter',
    description: '3 brands, 20 logos/mo, 30 mockups/mo, asset downloads, email support.',
    metadata: { tier: 'starter' },
  });
  const starterPrice = await stripe.prices.create({
    product: starterProduct.id,
    unit_amount: 2900,        // $29.00 in cents
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { tier: 'starter' },
  });
  console.log(`Starter Product: ${starterProduct.id}`);
  console.log(`Starter Price:   ${starterPrice.id}\n`);

  // --- Pro ($79/mo) ---
  const proProduct = await stripe.products.create({
    name: 'Brand Me Now — Pro',
    description: '10 brands, 50 logos/mo, 100 mockups/mo, priority generation, video (Phase 2).',
    metadata: { tier: 'pro' },
  });
  const proPrice = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 7900,        // $79.00 in cents
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { tier: 'pro' },
  });
  console.log(`Pro Product: ${proProduct.id}`);
  console.log(`Pro Price:   ${proPrice.id}\n`);

  // --- Agency ($199/mo) ---
  const agencyProduct = await stripe.products.create({
    name: 'Brand Me Now — Agency',
    description: 'Unlimited brands, 200 logos/mo, 500 mockups/mo, white-label, API access.',
    metadata: { tier: 'agency' },
  });
  const agencyPrice = await stripe.prices.create({
    product: agencyProduct.id,
    unit_amount: 19900,       // $199.00 in cents
    currency: 'usd',
    recurring: { interval: 'month' },
    metadata: { tier: 'agency' },
  });
  console.log(`Agency Product: ${agencyProduct.id}`);
  console.log(`Agency Price:   ${agencyPrice.id}\n`);

  // --- Customer Portal Configuration ---
  const portalConfig = await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: 'Manage your Brand Me Now subscription',
    },
    features: {
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',                  // Don't cancel immediately
        cancellation_reason: { enabled: true },  // Ask why they're canceling
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],      // Allow tier changes
        proration_behavior: 'create_prorations', // Prorate up/downgrades
        products: [
          {
            product: starterProduct.id,
            prices: [starterPrice.id],
          },
          {
            product: proProduct.id,
            prices: [proPrice.id],
          },
          {
            product: agencyProduct.id,
            prices: [agencyPrice.id],
          },
        ],
      },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
    },
  });
  console.log(`Customer Portal Config: ${portalConfig.id}\n`);

  console.log('=== Add these to your environment variables ===\n');
  console.log(`STRIPE_PRODUCT_STARTER=${starterProduct.id}`);
  console.log(`STRIPE_PRODUCT_PRO=${proProduct.id}`);
  console.log(`STRIPE_PRODUCT_AGENCY=${agencyProduct.id}`);
  console.log(`STRIPE_PRICE_STARTER_MONTHLY=${starterPrice.id}`);
  console.log(`STRIPE_PRICE_PRO_MONTHLY=${proPrice.id}`);
  console.log(`STRIPE_PRICE_AGENCY_MONTHLY=${agencyPrice.id}`);
  console.log(`STRIPE_CUSTOMER_PORTAL_CONFIG=${portalConfig.id}`);
}

setupProducts().catch(console.error);
```

---

## 3. Credit System

### Overview

Credits are the unit of consumption for AI generation. Every paid tier allocates a fixed number of credits per category (logos, mockups, videos) that refill on each billing cycle. Free trial gets a one-time allocation that never refills.

### Credit Types

| Credit Type | Column | Used By | Cost to BMN (approx) |
|-------------|--------|---------|----------------------|
| `logo_credits` | `generation_credits.logo_credits_remaining` | Logo generation (FLUX.2 Pro) | ~$0.06/logo |
| `mockup_credits` | `generation_credits.mockup_credits_remaining` | Mockup generation (GPT Image 1.5) | ~$0.04/mockup |
| `video_credits` | `generation_credits.video_credits_remaining` | Video generation (Veo 3, Phase 2) | ~$0.35/video |

### Credit Lifecycle

```
User subscribes (checkout.session.completed webhook)
  |
  v
allocateCredits(userId, tier)
  |
  +-- Insert/upsert generation_credits row
  +-- Set logo_credits_remaining = tier.logoCredits
  +-- Set mockup_credits_remaining = tier.mockupCredits
  +-- Set video_credits_remaining = tier.videoCredits
  +-- Set period_start, period_end from Stripe subscription
  |
  v
User clicks "Generate Logos"
  |
  v
checkCredits(userId, 'logo', quantity=4)
  |
  +-- SELECT logo_credits_remaining FROM generation_credits WHERE user_id = $1
  +-- If remaining >= quantity -> proceed
  +-- If remaining < quantity AND overageEnabled -> proceed (charge overage later)
  +-- If remaining < quantity AND !overageEnabled -> REJECT with upgrade prompt
  |
  v
deductCredits(userId, 'logo', quantity=4)
  |
  +-- UPDATE generation_credits SET
  |     logo_credits_remaining = logo_credits_remaining - 4,
  |     logo_credits_used = logo_credits_used + 4
  |   WHERE user_id = $1 AND logo_credits_remaining >= 4
  +-- INSERT credit_transactions row (audit trail)
  |
  v
BullMQ logo generation job executes
  |
  +-- If job FAILS after deduction -> refundCredits(userId, 'logo', 4)
  |
  v
Monthly billing cycle (invoice.payment_succeeded webhook)
  |
  v
refillCredits(userId, tier)
  |
  +-- Reset all credits to tier allocation
  +-- Reset all credits_used to 0
  +-- Update period_start, period_end
```

### Credit Database Schema

```sql
-- generation_credits (one row per user — upserted on subscription events)
CREATE TABLE generation_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Logo credits
  logo_credits_remaining INTEGER NOT NULL DEFAULT 0,
  logo_credits_used INTEGER NOT NULL DEFAULT 0,

  -- Mockup credits
  mockup_credits_remaining INTEGER NOT NULL DEFAULT 0,
  mockup_credits_used INTEGER NOT NULL DEFAULT 0,

  -- Video credits (Phase 2)
  video_credits_remaining INTEGER NOT NULL DEFAULT 0,
  video_credits_used INTEGER NOT NULL DEFAULT 0,

  -- Overage tracking (charged on next invoice)
  logo_overage_count INTEGER NOT NULL DEFAULT 0,
  mockup_overage_count INTEGER NOT NULL DEFAULT 0,
  video_overage_count INTEGER NOT NULL DEFAULT 0,

  -- Billing period tracking
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  last_refill_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_credits UNIQUE (user_id)
);

-- Index for fast lookups during generation
CREATE INDEX idx_generation_credits_user ON generation_credits(user_id);

-- credit_transactions (immutable audit log of every credit change)
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  credit_type TEXT NOT NULL,             -- 'logo' | 'mockup' | 'video'
  action TEXT NOT NULL,                  -- 'allocate' | 'deduct' | 'refund' | 'refill' | 'overage'
  quantity INTEGER NOT NULL,             -- Positive for allocate/refill, negative for deduct
  balance_after INTEGER NOT NULL,        -- Credits remaining after this transaction

  -- Context
  generation_job_id UUID,                -- FK to generation_jobs if this was a deduction
  stripe_invoice_id TEXT,                -- Stripe invoice that triggered refill
  reason TEXT,                           -- Human-readable reason
  metadata JSONB,                        -- Extra context

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credit_transactions_user ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_created ON credit_transactions(created_at);
```

### Credit Functions (Server-Side)

```javascript
// server/src/services/credits.js

import { supabase } from './supabase.js';
import { getTierConfig } from '../config/tiers.js';
import { logger } from './logger.js';

/**
 * @typedef {'logo' | 'mockup' | 'video'} CreditType
 */

/**
 * Column mapping for credit types
 * @type {Record<CreditType, { remaining: string, used: string, overage: string }>}
 */
const CREDIT_COLUMNS = {
  logo:   { remaining: 'logo_credits_remaining',   used: 'logo_credits_used',   overage: 'logo_overage_count' },
  mockup: { remaining: 'mockup_credits_remaining', used: 'mockup_credits_used', overage: 'mockup_overage_count' },
  video:  { remaining: 'video_credits_remaining',  used: 'video_credits_used',  overage: 'video_overage_count' },
};

/**
 * Check if a user has sufficient credits for a generation.
 * Returns { allowed, remaining, needsUpgrade, overageAllowed }.
 *
 * @param {string} userId
 * @param {CreditType} creditType
 * @param {number} quantity - Number of credits needed
 * @returns {Promise<{ allowed: boolean, remaining: number, needsUpgrade: boolean, overageAllowed: boolean }>}
 */
export async function checkCredits(userId, creditType, quantity = 1) {
  const cols = CREDIT_COLUMNS[creditType];
  if (!cols) throw new Error(`Invalid credit type: ${creditType}`);

  const { data: credits, error } = await supabase
    .from('generation_credits')
    .select(`${cols.remaining}, user_id`)
    .eq('user_id', userId)
    .single();

  if (error || !credits) {
    logger.warn({ userId, creditType }, 'No credit record found for user');
    return { allowed: false, remaining: 0, needsUpgrade: true, overageAllowed: false };
  }

  const remaining = credits[cols.remaining];

  if (remaining >= quantity) {
    return { allowed: true, remaining, needsUpgrade: false, overageAllowed: false };
  }

  // Check if overage is allowed for this user's tier
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single();

  const tier = getTierConfig(profile?.subscription_tier || 'free');

  if (tier.overageEnabled) {
    return { allowed: true, remaining, needsUpgrade: false, overageAllowed: true };
  }

  return { allowed: false, remaining, needsUpgrade: true, overageAllowed: false };
}

/**
 * Deduct credits from a user's balance. Uses atomic SQL update with
 * a WHERE clause to prevent negative balances (optimistic concurrency).
 *
 * If credits are insufficient but overage is allowed, records overage instead.
 *
 * @param {string} userId
 * @param {CreditType} creditType
 * @param {number} quantity
 * @param {{ generationJobId?: string, reason?: string }} [context]
 * @returns {Promise<{ success: boolean, balanceAfter: number, isOverage: boolean }>}
 */
export async function deductCredits(userId, creditType, quantity = 1, context = {}) {
  const cols = CREDIT_COLUMNS[creditType];
  if (!cols) throw new Error(`Invalid credit type: ${creditType}`);

  // Attempt atomic deduction (only succeeds if remaining >= quantity)
  const { data, error } = await supabase.rpc('deduct_credits', {
    p_user_id: userId,
    p_credit_type: creditType,
    p_quantity: quantity,
  });

  if (error) {
    logger.error({ userId, creditType, quantity, error }, 'Credit deduction RPC failed');
    throw new Error(`Credit deduction failed: ${error.message}`);
  }

  const result = data;
  // result: { success: boolean, balance_after: number, is_overage: boolean }

  if (result.success) {
    // Record transaction in audit log
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      credit_type: creditType,
      action: result.is_overage ? 'overage' : 'deduct',
      quantity: -quantity,
      balance_after: result.balance_after,
      generation_job_id: context.generationJobId || null,
      reason: context.reason || `${creditType} generation`,
    });

    logger.info({
      userId, creditType, quantity,
      balanceAfter: result.balance_after,
      isOverage: result.is_overage,
    }, 'Credits deducted');
  }

  return {
    success: result.success,
    balanceAfter: result.balance_after,
    isOverage: result.is_overage,
  };
}

/**
 * Refund credits back to a user (e.g., generation failed).
 *
 * @param {string} userId
 * @param {CreditType} creditType
 * @param {number} quantity
 * @param {{ generationJobId?: string, reason?: string }} [context]
 * @returns {Promise<{ balanceAfter: number }>}
 */
export async function refundCredits(userId, creditType, quantity = 1, context = {}) {
  const cols = CREDIT_COLUMNS[creditType];

  const { data, error } = await supabase.rpc('refund_credits', {
    p_user_id: userId,
    p_credit_type: creditType,
    p_quantity: quantity,
  });

  if (error) {
    logger.error({ userId, creditType, quantity, error }, 'Credit refund failed');
    throw new Error(`Credit refund failed: ${error.message}`);
  }

  // Record refund transaction
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    credit_type: creditType,
    action: 'refund',
    quantity: quantity,              // Positive — credits returned
    balance_after: data.balance_after,
    generation_job_id: context.generationJobId || null,
    reason: context.reason || `${creditType} generation failed — credits refunded`,
  });

  logger.info({ userId, creditType, quantity, balanceAfter: data.balance_after }, 'Credits refunded');

  return { balanceAfter: data.balance_after };
}

/**
 * Allocate initial credits when a user subscribes or signs up (free trial).
 *
 * @param {string} userId
 * @param {string} tierName
 * @param {{ periodStart?: string, periodEnd?: string, stripeInvoiceId?: string }} [billingContext]
 * @returns {Promise<void>}
 */
export async function allocateCredits(userId, tierName, billingContext = {}) {
  const tier = getTierConfig(tierName);

  const creditData = {
    user_id: userId,
    logo_credits_remaining: tier.logoCredits,
    logo_credits_used: 0,
    mockup_credits_remaining: tier.mockupCredits,
    mockup_credits_used: 0,
    video_credits_remaining: tier.videoCredits,
    video_credits_used: 0,
    logo_overage_count: 0,
    mockup_overage_count: 0,
    video_overage_count: 0,
    period_start: billingContext.periodStart || new Date().toISOString(),
    period_end: billingContext.periodEnd || null,
    last_refill_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Upsert: create if new, replace if existing
  const { error } = await supabase
    .from('generation_credits')
    .upsert(creditData, { onConflict: 'user_id' });

  if (error) {
    logger.error({ userId, tierName, error }, 'Credit allocation failed');
    throw new Error(`Credit allocation failed: ${error.message}`);
  }

  // Record allocation transaction for each credit type
  const transactions = [];
  if (tier.logoCredits > 0) {
    transactions.push({
      user_id: userId,
      credit_type: 'logo',
      action: 'allocate',
      quantity: tier.logoCredits,
      balance_after: tier.logoCredits,
      stripe_invoice_id: billingContext.stripeInvoiceId || null,
      reason: `${tier.displayName} subscription — initial allocation`,
    });
  }
  if (tier.mockupCredits > 0) {
    transactions.push({
      user_id: userId,
      credit_type: 'mockup',
      action: 'allocate',
      quantity: tier.mockupCredits,
      balance_after: tier.mockupCredits,
      stripe_invoice_id: billingContext.stripeInvoiceId || null,
      reason: `${tier.displayName} subscription — initial allocation`,
    });
  }
  if (tier.videoCredits > 0) {
    transactions.push({
      user_id: userId,
      credit_type: 'video',
      action: 'allocate',
      quantity: tier.videoCredits,
      balance_after: tier.videoCredits,
      stripe_invoice_id: billingContext.stripeInvoiceId || null,
      reason: `${tier.displayName} subscription — initial allocation`,
    });
  }

  if (transactions.length > 0) {
    await supabase.from('credit_transactions').insert(transactions);
  }

  logger.info({ userId, tierName, credits: { logo: tier.logoCredits, mockup: tier.mockupCredits, video: tier.videoCredits } }, 'Credits allocated');
}

/**
 * Refill credits on monthly billing cycle (invoice.payment_succeeded).
 * Resets remaining to tier allocation. Resets used to 0.
 * Unused credits do NOT roll over.
 *
 * @param {string} userId
 * @param {string} tierName
 * @param {{ periodStart: string, periodEnd: string, stripeInvoiceId: string }} billingContext
 * @returns {Promise<void>}
 */
export async function refillCredits(userId, tierName, billingContext) {
  const tier = getTierConfig(tierName);

  if (!tier.creditsRefillMonthly) {
    logger.info({ userId, tierName }, 'Tier does not support monthly refill — skipping');
    return;
  }

  // Reset credits to full allocation (no rollover)
  const { error } = await supabase
    .from('generation_credits')
    .update({
      logo_credits_remaining: tier.logoCredits,
      logo_credits_used: 0,
      mockup_credits_remaining: tier.mockupCredits,
      mockup_credits_used: 0,
      video_credits_remaining: tier.videoCredits,
      video_credits_used: 0,
      logo_overage_count: 0,
      mockup_overage_count: 0,
      video_overage_count: 0,
      period_start: billingContext.periodStart,
      period_end: billingContext.periodEnd,
      last_refill_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    logger.error({ userId, tierName, error }, 'Credit refill failed');
    throw new Error(`Credit refill failed: ${error.message}`);
  }

  // Record refill transactions
  const transactions = [
    {
      user_id: userId,
      credit_type: 'logo',
      action: 'refill',
      quantity: tier.logoCredits,
      balance_after: tier.logoCredits,
      stripe_invoice_id: billingContext.stripeInvoiceId,
      reason: `Monthly refill — ${tier.displayName}`,
    },
    {
      user_id: userId,
      credit_type: 'mockup',
      action: 'refill',
      quantity: tier.mockupCredits,
      balance_after: tier.mockupCredits,
      stripe_invoice_id: billingContext.stripeInvoiceId,
      reason: `Monthly refill — ${tier.displayName}`,
    },
  ];

  if (tier.videoCredits > 0) {
    transactions.push({
      user_id: userId,
      credit_type: 'video',
      action: 'refill',
      quantity: tier.videoCredits,
      balance_after: tier.videoCredits,
      stripe_invoice_id: billingContext.stripeInvoiceId,
      reason: `Monthly refill — ${tier.displayName}`,
    });
  }

  await supabase.from('credit_transactions').insert(transactions);

  logger.info({ userId, tierName, stripeInvoiceId: billingContext.stripeInvoiceId }, 'Credits refilled');
}

/**
 * Get current credit balances for a user.
 *
 * @param {string} userId
 * @returns {Promise<Object>}
 */
export async function getCreditBalances(userId) {
  const { data, error } = await supabase
    .from('generation_credits')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return {
      logo: { remaining: 0, used: 0 },
      mockup: { remaining: 0, used: 0 },
      video: { remaining: 0, used: 0 },
      periodEnd: null,
    };
  }

  return {
    logo: {
      remaining: data.logo_credits_remaining,
      used: data.logo_credits_used,
      overage: data.logo_overage_count,
    },
    mockup: {
      remaining: data.mockup_credits_remaining,
      used: data.mockup_credits_used,
      overage: data.mockup_overage_count,
    },
    video: {
      remaining: data.video_credits_remaining,
      used: data.video_credits_used,
      overage: data.video_overage_count,
    },
    periodStart: data.period_start,
    periodEnd: data.period_end,
    lastRefill: data.last_refill_at,
  };
}
```

### Atomic Credit Deduction (Supabase RPC / PostgreSQL Function)

This prevents race conditions where two concurrent generation requests could overdraw credits.

```sql
-- supabase/migrations/20260219000001_credit_functions.sql

-- Atomic credit deduction with overage support
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID,
  p_credit_type TEXT,
  p_quantity INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_remaining INTEGER;
  v_tier TEXT;
  v_overage_enabled BOOLEAN;
  v_col_remaining TEXT;
  v_col_used TEXT;
  v_col_overage TEXT;
  v_result JSONB;
BEGIN
  -- Map credit type to column names
  CASE p_credit_type
    WHEN 'logo' THEN
      v_col_remaining := 'logo_credits_remaining';
      v_col_used := 'logo_credits_used';
      v_col_overage := 'logo_overage_count';
    WHEN 'mockup' THEN
      v_col_remaining := 'mockup_credits_remaining';
      v_col_used := 'mockup_credits_used';
      v_col_overage := 'mockup_overage_count';
    WHEN 'video' THEN
      v_col_remaining := 'video_credits_remaining';
      v_col_used := 'video_credits_used';
      v_col_overage := 'video_overage_count';
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Invalid credit type');
  END CASE;

  -- Lock the row for this user (SELECT FOR UPDATE)
  EXECUTE format(
    'SELECT %I FROM generation_credits WHERE user_id = $1 FOR UPDATE',
    v_col_remaining
  ) INTO v_remaining USING p_user_id;

  IF v_remaining IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No credit record found');
  END IF;

  -- Case 1: Sufficient credits — standard deduction
  IF v_remaining >= p_quantity THEN
    EXECUTE format(
      'UPDATE generation_credits SET %I = %I - $1, %I = %I + $1, updated_at = NOW() WHERE user_id = $2',
      v_col_remaining, v_col_remaining, v_col_used, v_col_used
    ) USING p_quantity, p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'balance_after', v_remaining - p_quantity,
      'is_overage', false
    );
  END IF;

  -- Case 2: Insufficient credits — check overage
  SELECT subscription_tier INTO v_tier
  FROM profiles WHERE id = p_user_id;

  -- Determine if overage is enabled (pro and agency tiers)
  v_overage_enabled := v_tier IN ('pro', 'agency');

  IF v_overage_enabled THEN
    -- Deduct whatever remains, record the rest as overage
    DECLARE
      v_from_balance INTEGER := GREATEST(v_remaining, 0);
      v_overage_qty INTEGER := p_quantity - v_from_balance;
    BEGIN
      EXECUTE format(
        'UPDATE generation_credits SET %I = 0, %I = %I + $1, %I = %I + $2, updated_at = NOW() WHERE user_id = $3',
        v_col_remaining, v_col_used, v_col_used, v_col_overage, v_col_overage
      ) USING p_quantity, v_overage_qty, p_user_id;

      RETURN jsonb_build_object(
        'success', true,
        'balance_after', 0,
        'is_overage', true,
        'overage_quantity', v_overage_qty
      );
    END;
  END IF;

  -- Case 3: Insufficient credits, no overage allowed
  RETURN jsonb_build_object(
    'success', false,
    'balance_after', v_remaining,
    'is_overage', false,
    'error', 'Insufficient credits'
  );
END;
$$;

-- Atomic credit refund
CREATE OR REPLACE FUNCTION refund_credits(
  p_user_id UUID,
  p_credit_type TEXT,
  p_quantity INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_col_remaining TEXT;
  v_col_used TEXT;
  v_balance_after INTEGER;
BEGIN
  CASE p_credit_type
    WHEN 'logo' THEN
      v_col_remaining := 'logo_credits_remaining';
      v_col_used := 'logo_credits_used';
    WHEN 'mockup' THEN
      v_col_remaining := 'mockup_credits_remaining';
      v_col_used := 'mockup_credits_used';
    WHEN 'video' THEN
      v_col_remaining := 'video_credits_remaining';
      v_col_used := 'video_credits_used';
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Invalid credit type');
  END CASE;

  EXECUTE format(
    'UPDATE generation_credits SET %I = %I + $1, %I = GREATEST(%I - $1, 0), updated_at = NOW() WHERE user_id = $2 RETURNING %I',
    v_col_remaining, v_col_remaining, v_col_used, v_col_used, v_col_remaining
  ) INTO v_balance_after USING p_quantity, p_user_id;

  RETURN jsonb_build_object('success', true, 'balance_after', v_balance_after);
END;
$$;
```

### Credit Middleware (Pre-Generation Gate)

```javascript
// server/src/middleware/credits.js

import { checkCredits } from '../services/credits.js';

/**
 * Middleware factory that checks credits before allowing generation.
 * Use on generation endpoints:
 *   router.post('/logos', requireCredits('logo', 4), generateLogos);
 *
 * @param {import('../services/credits.js').CreditType} creditType
 * @param {number} quantity
 * @returns {import('express').RequestHandler}
 */
export function requireCredits(creditType, quantity) {
  return async (req, res, next) => {
    const userId = req.user.id;

    try {
      const result = await checkCredits(userId, creditType, quantity);

      if (!result.allowed) {
        return res.status(402).json({
          error: 'Insufficient credits',
          creditType,
          remaining: result.remaining,
          required: quantity,
          needsUpgrade: result.needsUpgrade,
          upgradeUrl: `${process.env.APP_URL}/settings/billing`,
        });
      }

      // Attach credit info to request for downstream use
      req.creditCheck = {
        creditType,
        quantity,
        remaining: result.remaining,
        overageAllowed: result.overageAllowed,
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}
```

---

## 4. Stripe Checkout Flow

### Complete Flow

```
1. User on wizard Step 11 (checkout.jsx) or dashboard Settings > Billing
2. User selects a subscription tier
3. Client calls POST /api/v1/billing/checkout-session with { tier: 'starter' | 'pro' | 'agency' }
4. Server:
   a. Validates user is authenticated
   b. Checks user doesn't already have an active paid subscription
   c. Creates or retrieves Stripe Customer (linked to profiles.stripe_customer_id)
   d. Creates Stripe Checkout Session with:
      - line_items: [{ price: tier.stripePriceId, quantity: 1 }]
      - mode: 'subscription'
      - success_url: {APP_URL}/wizard/complete?session_id={CHECKOUT_SESSION_ID}
      - cancel_url: {APP_URL}/wizard/checkout?canceled=true
      - customer: stripeCustomerId
      - metadata: { userId, tier }
      - subscription_data.metadata: { userId, tier }
   e. Returns { checkoutUrl: session.url }
5. Client redirects to session.url (Stripe-hosted page)
6. User enters payment info on Stripe (PCI compliant — card data never touches our servers)
7. On success: Stripe redirects to success_url
8. Async (seconds later): Stripe fires checkout.session.completed webhook
9. Webhook handler:
   a. Verifies signature
   b. Enqueues BullMQ job
   c. BullMQ worker creates subscription record, allocates credits, updates profile tier
10. Client on success page polls for subscription status or receives Socket.io event
```

### Checkout Session Creation (API Route)

```javascript
// server/src/routes/billing.js

import { Router } from 'express';
import { z } from 'zod';
import { stripe } from '../services/stripe.js';
import { supabase } from '../services/supabase.js';
import { getTierConfig, TIER_CONFIG } from '../config/tiers.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { logger } from '../services/logger.js';

const router = Router();

// All billing routes require authentication
router.use(authMiddleware);

/**
 * POST /api/v1/billing/checkout-session
 * Create a Stripe Checkout Session for subscription purchase.
 */
const checkoutSchema = z.object({
  tier: z.enum(['starter', 'pro', 'agency']),
});

router.post('/checkout-session', validate(checkoutSchema), async (req, res, next) => {
  try {
    const { tier: tierName } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;
    const tierConfig = getTierConfig(tierName);

    if (!tierConfig.stripePriceId) {
      return res.status(400).json({ error: 'Invalid tier for checkout' });
    }

    // Check for existing active subscription
    const { data: existingSub } = await supabase
      .from('subscriptions')
      .select('id, tier, status')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .single();

    if (existingSub) {
      return res.status(409).json({
        error: 'Active subscription already exists',
        currentTier: existingSub.tier,
        message: 'Use the customer portal to change your plan.',
        portalUrl: `${process.env.APP_URL}/api/v1/billing/portal-session`,
      });
    }

    // Get or create Stripe Customer
    const stripeCustomerId = await getOrCreateStripeCustomer(userId, userEmail);

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: tierConfig.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.APP_URL}/wizard/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/wizard/checkout?canceled=true`,
      metadata: {
        userId,
        tier: tierName,
      },
      subscription_data: {
        metadata: {
          userId,
          tier: tierName,
        },
      },
      allow_promotion_codes: true,           // Enable coupon/promo code field
      billing_address_collection: 'auto',
      tax_id_collection: { enabled: true },  // Collect tax ID for businesses
    });

    logger.info({ userId, tier: tierName, sessionId: session.id }, 'Checkout session created');

    res.json({ checkoutUrl: session.url });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/billing/portal-session
 * Create a Stripe Customer Portal session for subscription management.
 */
router.post('/portal-session', async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get user's Stripe Customer ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!profile?.stripe_customer_id) {
      return res.status(404).json({ error: 'No billing account found. Subscribe first.' });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.APP_URL}/settings/billing`,
      configuration: process.env.STRIPE_CUSTOMER_PORTAL_CONFIG || undefined,
    });

    res.json({ portalUrl: portalSession.url });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/billing/subscription
 * Get current subscription status and credit balances.
 */
router.get('/subscription', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [subscriptionResult, creditsResult] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['active', 'trialing', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('generation_credits')
        .select('*')
        .eq('user_id', userId)
        .single(),
    ]);

    const subscription = subscriptionResult.data;
    const credits = creditsResult.data;

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    const tierConfig = getTierConfig(profile?.subscription_tier || 'free');

    res.json({
      tier: profile?.subscription_tier || 'free',
      tierConfig: {
        displayName: tierConfig.displayName,
        price: tierConfig.price,
        brandLimit: tierConfig.brandLimit,
        features: tierConfig.features,
      },
      subscription: subscription ? {
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      } : null,
      credits: credits ? {
        logo: { remaining: credits.logo_credits_remaining, used: credits.logo_credits_used },
        mockup: { remaining: credits.mockup_credits_remaining, used: credits.mockup_credits_used },
        video: { remaining: credits.video_credits_remaining, used: credits.video_credits_used },
        periodEnd: credits.period_end,
      } : null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get or create a Stripe Customer linked to a BMN user.
 * Stores stripe_customer_id in profiles table.
 *
 * @param {string} userId
 * @param {string} email
 * @returns {Promise<string>} Stripe Customer ID
 */
async function getOrCreateStripeCustomer(userId, email) {
  // Check if user already has a Stripe Customer
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id, full_name')
    .eq('id', userId)
    .single();

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  // Create new Stripe Customer
  const customer = await stripe.customers.create({
    email,
    name: profile?.full_name || undefined,
    metadata: {
      userId,
      source: 'brand-me-now',
    },
  });

  // Save Stripe Customer ID to profile
  await supabase
    .from('profiles')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId);

  logger.info({ userId, stripeCustomerId: customer.id }, 'Stripe customer created');

  return customer.id;
}

export default router;
```

---

## 5. Webhook Handling

### Webhook Endpoint (Express Route)

The webhook endpoint does three things and nothing more:
1. Verifies the Stripe signature.
2. Checks for duplicate delivery (idempotency).
3. Enqueues a BullMQ job for durable processing.

This keeps the endpoint fast (< 100ms response) and prevents Stripe timeouts.

```javascript
// server/src/routes/webhooks.js

import { Router } from 'express';
import express from 'express';
import { stripe } from '../services/stripe.js';
import { supabase } from '../services/supabase.js';
import { stripeWebhookQueue } from '../workers/stripe-webhook.js';
import { logger } from '../services/logger.js';

const router = Router();

/**
 * POST /api/v1/webhooks/stripe
 *
 * IMPORTANT: This route must use express.raw() for the body, NOT express.json().
 * Stripe signature verification requires the raw body bytes.
 * Mount this route BEFORE the global express.json() middleware, or use a route-specific override.
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      logger.warn('Stripe webhook received without signature header');
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    // 1. Verify webhook signature
    /** @type {import('stripe').Stripe.Event} */
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,                              // Raw body (Buffer)
        sig,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      logger.error({ error: err.message }, 'Stripe webhook signature verification failed');
      return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    }

    // 2. Idempotency check — skip if we've already processed this event
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .single();

    if (existingEvent) {
      logger.info({ eventId: event.id, type: event.type }, 'Duplicate webhook event — skipping');
      return res.json({ received: true, duplicate: true });
    }

    // 3. Record the event (mark as received, not yet processed)
    await supabase.from('webhook_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event,
      status: 'received',
    });

    // 4. Enqueue for durable processing via BullMQ
    const HANDLED_EVENTS = [
      'checkout.session.completed',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
    ];

    if (HANDLED_EVENTS.includes(event.type)) {
      await stripeWebhookQueue.add(
        event.type,                            // Job name = event type
        {
          eventId: event.id,
          eventType: event.type,
          data: event.data.object,
          metadata: event.data.object.metadata || {},
        },
        {
          jobId: event.id,                     // Deduplicate at queue level too
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { age: 7 * 24 * 3600 },   // Keep completed jobs 7 days
          removeOnFail: { age: 30 * 24 * 3600 },       // Keep failed jobs 30 days
        },
      );

      logger.info({ eventId: event.id, type: event.type }, 'Stripe webhook enqueued');
    } else {
      logger.info({ eventId: event.id, type: event.type }, 'Stripe webhook received but not handled');
    }

    // 5. Always return 200 immediately — processing is async
    res.json({ received: true });
  },
);

export default router;
```

### Webhook Event Table

```sql
-- supabase/migrations/20260219000002_webhook_events.sql

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',   -- 'received' | 'processing' | 'processed' | 'failed'
  error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_stripe_id ON webhook_events(stripe_event_id);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
```

### BullMQ Webhook Worker (Durable Processing)

```javascript
// server/src/workers/stripe-webhook.js

import { Queue, Worker } from 'bullmq';
import { redis } from '../services/redis.js';
import { stripe } from '../services/stripe.js';
import { supabase } from '../services/supabase.js';
import { allocateCredits, refillCredits } from '../services/credits.js';
import { getTierByPriceId, getTierConfig } from '../config/tiers.js';
import { io } from '../sockets/index.js';
import { logger } from '../services/logger.js';

// --- Queue ---
export const stripeWebhookQueue = new Queue('stripe-webhook', {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
  },
});

// --- Worker ---
const stripeWebhookWorker = new Worker(
  'stripe-webhook',
  async (job) => {
    const { eventId, eventType, data, metadata } = job.data;

    logger.info({ eventId, eventType, jobId: job.id }, 'Processing Stripe webhook');

    // Mark event as processing
    await supabase
      .from('webhook_events')
      .update({ status: 'processing' })
      .eq('stripe_event_id', eventId);

    try {
      switch (eventType) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(data, metadata);
          break;

        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(data, metadata);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(data, metadata);
          break;

        case 'invoice.payment_succeeded':
          await handlePaymentSucceeded(data, metadata);
          break;

        case 'invoice.payment_failed':
          await handlePaymentFailed(data, metadata);
          break;

        default:
          logger.warn({ eventType }, 'Unhandled webhook event type');
      }

      // Mark event as processed
      await supabase
        .from('webhook_events')
        .update({ status: 'processed', processed_at: new Date().toISOString() })
        .eq('stripe_event_id', eventId);

    } catch (err) {
      // Mark event as failed
      await supabase
        .from('webhook_events')
        .update({ status: 'failed', error: err.message })
        .eq('stripe_event_id', eventId);

      throw err; // Re-throw so BullMQ retries
    }
  },
  {
    connection: redis,
    concurrency: 5,
    limiter: { max: 10, duration: 1000 },  // Max 10 jobs/second
  },
);

// --- Event Handlers ---

/**
 * Handle checkout.session.completed
 * Triggered when a user completes Stripe Checkout and pays for a subscription.
 *
 * Actions:
 * 1. Create subscription record in database
 * 2. Update user profile tier
 * 3. Allocate initial credits
 * 4. Emit Socket.io event to client
 * 5. Queue CRM sync
 * 6. Send welcome email
 */
async function handleCheckoutCompleted(session, metadata) {
  const userId = metadata.userId || session.metadata?.userId;
  const tierName = metadata.tier || session.metadata?.tier;

  if (!userId || !tierName) {
    throw new Error(`checkout.session.completed missing metadata: userId=${userId}, tier=${tierName}`);
  }

  // Retrieve the full subscription from Stripe
  const subscription = await stripe.subscriptions.retrieve(session.subscription);

  // 1. Create subscription record
  const { error: subError } = await supabase.from('subscriptions').upsert({
    user_id: userId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: session.customer,
    tier: tierName,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    created_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (subError) throw new Error(`Failed to create subscription: ${subError.message}`);

  // 2. Update user profile tier + Stripe customer ID
  await supabase
    .from('profiles')
    .update({
      subscription_tier: tierName,
      stripe_customer_id: session.customer,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  // 3. Allocate initial credits
  await allocateCredits(userId, tierName, {
    periodStart: new Date(subscription.current_period_start * 1000).toISOString(),
    periodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    stripeInvoiceId: session.invoice,
  });

  // 4. Emit Socket.io event to notify client
  io.to(`user:${userId}`).emit('subscription:activated', {
    tier: tierName,
    status: 'active',
  });

  // 5. Queue CRM sync (non-blocking)
  const { crmSyncQueue } = await import('./crm-sync.js');
  await crmSyncQueue.add('subscription-created', {
    userId,
    eventType: 'subscription.created',
    data: { tier: tierName, amount: getTierConfig(tierName).price },
  });

  // 6. Queue welcome email (non-blocking)
  const { emailQueue } = await import('./email-send.js');
  await emailQueue.add('subscription-welcome', {
    userId,
    template: 'subscription-welcome',
    data: { tier: tierName, tierDisplayName: getTierConfig(tierName).displayName },
  });

  logger.info({ userId, tier: tierName, subscriptionId: subscription.id }, 'Checkout completed — subscription activated');
}

/**
 * Handle customer.subscription.updated
 * Triggered when a subscription changes — tier upgrade/downgrade, payment method change, etc.
 *
 * Actions:
 * 1. Update subscription record
 * 2. If tier changed: update profile + adjust credits
 * 3. Emit Socket.io event
 */
async function handleSubscriptionUpdated(subscription, metadata) {
  // Get userId from subscription metadata or look up by Stripe subscription ID
  let userId = metadata.userId || subscription.metadata?.userId;

  if (!userId) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', subscription.id)
      .single();
    userId = sub?.user_id;
  }

  if (!userId) {
    throw new Error(`subscription.updated: cannot find userId for subscription ${subscription.id}`);
  }

  // Determine new tier from price ID
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const newTier = priceId ? getTierByPriceId(priceId) : null;
  const newTierName = newTier?.name || metadata.tier || subscription.metadata?.tier;

  // Get current tier for comparison
  const { data: currentSub } = await supabase
    .from('subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .single();

  const tierChanged = currentSub && currentSub.tier !== newTierName;

  // 1. Update subscription record
  await supabase
    .from('subscriptions')
    .update({
      tier: newTierName,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    })
    .eq('stripe_subscription_id', subscription.id);

  // 2. If tier changed, update profile and adjust credits
  if (tierChanged && newTierName) {
    await supabase
      .from('profiles')
      .update({ subscription_tier: newTierName, updated_at: new Date().toISOString() })
      .eq('id', userId);

    // Re-allocate credits for new tier
    // On upgrade: immediate new allocation (user gets more credits now)
    // On downgrade: new allocation takes effect (user gets fewer credits now)
    await allocateCredits(userId, newTierName, {
      periodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      periodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
    });

    logger.info({ userId, oldTier: currentSub.tier, newTier: newTierName }, 'Subscription tier changed');
  }

  // 3. Emit Socket.io event
  io.to(`user:${userId}`).emit('subscription:updated', {
    tier: newTierName,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  logger.info({ userId, subscriptionId: subscription.id, status: subscription.status }, 'Subscription updated');
}

/**
 * Handle customer.subscription.deleted
 * Triggered when a subscription is fully canceled (after period end, or immediate).
 *
 * Actions:
 * 1. Update subscription status to 'canceled'
 * 2. Downgrade user to free tier
 * 3. Set credits to free tier allocation
 * 4. Emit Socket.io event
 */
async function handleSubscriptionDeleted(subscription, metadata) {
  let userId = metadata.userId || subscription.metadata?.userId;

  if (!userId) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', subscription.id)
      .single();
    userId = sub?.user_id;
  }

  if (!userId) {
    throw new Error(`subscription.deleted: cannot find userId for subscription ${subscription.id}`);
  }

  // 1. Mark subscription as canceled
  await supabase
    .from('subscriptions')
    .update({ status: 'canceled' })
    .eq('stripe_subscription_id', subscription.id);

  // 2. Downgrade user to free tier
  await supabase
    .from('profiles')
    .update({ subscription_tier: 'free', updated_at: new Date().toISOString() })
    .eq('id', userId);

  // 3. Reset credits to free tier (one-time allocation)
  await allocateCredits(userId, 'free');

  // 4. Emit Socket.io event
  io.to(`user:${userId}`).emit('subscription:canceled', {
    tier: 'free',
    status: 'canceled',
  });

  // 5. Queue CRM update
  const { crmSyncQueue } = await import('./crm-sync.js');
  await crmSyncQueue.add('subscription-canceled', {
    userId,
    eventType: 'subscription.canceled',
    data: {},
  });

  logger.info({ userId, subscriptionId: subscription.id }, 'Subscription canceled — downgraded to free');
}

/**
 * Handle invoice.payment_succeeded
 * Triggered on every successful invoice payment (initial + recurring).
 * For recurring payments, this is where we refill monthly credits.
 *
 * Actions:
 * 1. Determine if this is a renewal (not the first invoice)
 * 2. If renewal: refill credits for the new period
 * 3. Record payment in audit log
 */
async function handlePaymentSucceeded(invoice, metadata) {
  // Skip if this is the first invoice (credits already allocated in checkout.session.completed)
  if (invoice.billing_reason === 'subscription_create') {
    logger.info({ invoiceId: invoice.id }, 'First invoice — credits already allocated at checkout');
    return;
  }

  // This is a renewal — refill credits
  const stripeSubscriptionId = invoice.subscription;

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id, tier')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .single();

  if (!sub) {
    throw new Error(`invoice.payment_succeeded: no subscription found for ${stripeSubscriptionId}`);
  }

  // Retrieve subscription from Stripe for period dates
  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

  // Refill credits for the new billing period
  await refillCredits(sub.user_id, sub.tier, {
    periodStart: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
    periodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
    stripeInvoiceId: invoice.id,
  });

  // Update subscription period dates
  await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
    })
    .eq('stripe_subscription_id', stripeSubscriptionId);

  // Emit Socket.io event
  io.to(`user:${sub.user_id}`).emit('subscription:renewed', {
    tier: sub.tier,
    status: 'active',
  });

  // Record in audit log
  await supabase.from('audit_log').insert({
    user_id: sub.user_id,
    action: 'payment_succeeded',
    resource_type: 'subscription',
    resource_id: sub.user_id,
    metadata: {
      invoiceId: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      billingReason: invoice.billing_reason,
    },
  });

  logger.info({
    userId: sub.user_id,
    tier: sub.tier,
    invoiceId: invoice.id,
    amount: invoice.amount_paid,
  }, 'Payment succeeded — credits refilled');
}

/**
 * Handle invoice.payment_failed
 * Triggered when a recurring payment fails (card declined, expired, etc.).
 *
 * Actions:
 * 1. Update subscription status to 'past_due'
 * 2. Send warning email to user
 * 3. Start grace period (Stripe automatically retries — typically 3 attempts over ~7 days)
 * 4. If all retries fail, Stripe will fire customer.subscription.deleted
 */
async function handlePaymentFailed(invoice, metadata) {
  const stripeSubscriptionId = invoice.subscription;

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('user_id, tier')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .single();

  if (!sub) {
    logger.warn({ invoiceId: invoice.id, subscriptionId: stripeSubscriptionId }, 'Payment failed — no matching subscription');
    return;
  }

  const attemptCount = invoice.attempt_count || 1;

  // 1. Update subscription status
  await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', stripeSubscriptionId);

  // 2. Send warning email
  const { emailQueue } = await import('./email-send.js');
  await emailQueue.add('payment-failed', {
    userId: sub.user_id,
    template: 'payment-failed',
    data: {
      tier: sub.tier,
      tierDisplayName: getTierConfig(sub.tier).displayName,
      attemptCount,
      nextRetryDate: invoice.next_payment_attempt
        ? new Date(invoice.next_payment_attempt * 1000).toISOString()
        : null,
      updatePaymentUrl: `${process.env.APP_URL}/api/v1/billing/portal-session`,
    },
  });

  // 3. Emit Socket.io event (show banner in app)
  io.to(`user:${sub.user_id}`).emit('subscription:payment-failed', {
    tier: sub.tier,
    status: 'past_due',
    attemptCount,
    message: 'Your payment failed. Please update your payment method to continue using Brand Me Now.',
  });

  // 4. Record in audit log
  await supabase.from('audit_log').insert({
    user_id: sub.user_id,
    action: 'payment_failed',
    resource_type: 'subscription',
    resource_id: sub.user_id,
    metadata: {
      invoiceId: invoice.id,
      amount: invoice.amount_due,
      attemptCount,
      nextRetryDate: invoice.next_payment_attempt,
    },
  });

  logger.warn({
    userId: sub.user_id,
    invoiceId: invoice.id,
    attemptCount,
  }, 'Payment failed — user notified');
}

// --- Worker event logging ---
stripeWebhookWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, eventType: job.name }, 'Stripe webhook job completed');
});

stripeWebhookWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, eventType: job?.name, error: err.message }, 'Stripe webhook job failed');
});

export { stripeWebhookWorker };
```

### Mounting the Webhook Route (Important: Raw Body)

The Stripe webhook needs the raw request body for signature verification. This must be configured before `express.json()` parses the body.

```javascript
// server/src/app.js (relevant section)

import express from 'express';
import webhookRoutes from './routes/webhooks.js';
import billingRoutes from './routes/billing.js';

const app = express();

// IMPORTANT: Mount webhook route BEFORE express.json() middleware
// Stripe needs raw body for signature verification
app.use('/api/v1/webhooks', webhookRoutes);

// Now apply JSON parsing for all other routes
app.use(express.json({ limit: '1mb' }));

// Billing routes (require parsed JSON body)
app.use('/api/v1/billing', billingRoutes);

// ... rest of middleware and routes
```

---

## 6. Stripe Customer Management

### Customer Lifecycle

```
User signs up (Supabase Auth)
  |
  v
profiles row created with stripe_customer_id = NULL
  |
  v (lazy creation — only when user initiates checkout)
POST /api/v1/billing/checkout-session
  |
  +-- getOrCreateStripeCustomer(userId, email)
  |   |
  |   +-- Check profiles.stripe_customer_id
  |   +-- If NULL: stripe.customers.create({ email, metadata: { userId } })
  |   +-- Save stripe_customer_id to profiles
  |   +-- Return customerId
  |
  v
Stripe Customer linked to BMN user forever
  |
  v (throughout lifecycle)
All Stripe operations use this customer ID:
  - Checkout Sessions
  - Customer Portal Sessions
  - Subscription queries
  - Invoice lookups
```

### Profiles Table Updates

```sql
-- supabase/migrations/20260219000003_profiles_stripe.sql

-- Add Stripe fields to profiles (if not already present from blueprint schema)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';

-- Index for Stripe customer lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_stripe_customer
  ON profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- Index for tier-based queries (admin dashboard, feature gating)
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier
  ON profiles(subscription_tier);
```

### Subscriptions Table

```sql
-- supabase/migrations/20260219000004_subscriptions.sql

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  tier TEXT NOT NULL,
  status TEXT NOT NULL,                  -- 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

### Customer Portal Integration

The Stripe Customer Portal handles all subscription management UI (upgrade, downgrade, cancel, update payment method, view invoices). We create a portal session and redirect the user.

```javascript
// Usage in frontend (React):

// apps/web/src/hooks/use-billing.js

import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client.js';

/**
 * Hook for billing operations.
 */
export function useBilling() {
  const subscription = useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: () => apiClient.get('/api/v1/billing/subscription').then(r => r.data),
    staleTime: 30_000,
  });

  const createCheckout = useMutation({
    mutationFn: (tier) => apiClient.post('/api/v1/billing/checkout-session', { tier }),
    onSuccess: (data) => {
      // Redirect to Stripe Checkout
      window.location.href = data.checkoutUrl;
    },
  });

  const openPortal = useMutation({
    mutationFn: () => apiClient.post('/api/v1/billing/portal-session'),
    onSuccess: (data) => {
      // Redirect to Stripe Customer Portal
      window.location.href = data.portalUrl;
    },
  });

  return {
    subscription,
    createCheckout,
    openPortal,
    isLoading: subscription.isLoading,
  };
}
```

---

## 7. Database Schema (Payments)

### Complete Migration File

```sql
-- supabase/migrations/20260219000005_payments_full.sql
--
-- Complete payments & billing schema for Brand Me Now v2.
-- Tables: subscriptions, generation_credits, credit_transactions, webhook_events
-- Functions: deduct_credits, refund_credits
-- Indexes and constraints for performance and data integrity.

-- ============================================================
-- 1. Profiles extensions
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_stripe_customer
  ON profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier
  ON profiles(subscription_tier);

-- ============================================================
-- 2. Subscriptions
-- ============================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  tier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ============================================================
-- 3. Generation Credits
-- ============================================================

CREATE TABLE IF NOT EXISTS generation_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  logo_credits_remaining INTEGER NOT NULL DEFAULT 0,
  logo_credits_used INTEGER NOT NULL DEFAULT 0,
  mockup_credits_remaining INTEGER NOT NULL DEFAULT 0,
  mockup_credits_used INTEGER NOT NULL DEFAULT 0,
  video_credits_remaining INTEGER NOT NULL DEFAULT 0,
  video_credits_used INTEGER NOT NULL DEFAULT 0,
  logo_overage_count INTEGER NOT NULL DEFAULT 0,
  mockup_overage_count INTEGER NOT NULL DEFAULT 0,
  video_overage_count INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  last_refill_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_credits UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_generation_credits_user ON generation_credits(user_id);

-- ============================================================
-- 4. Credit Transactions (Audit Trail)
-- ============================================================

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  credit_type TEXT NOT NULL,
  action TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  generation_job_id UUID,
  stripe_invoice_id TEXT,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON credit_transactions(created_at);

-- ============================================================
-- 5. Webhook Events (Idempotency)
-- ============================================================

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_id ON webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);

-- ============================================================
-- 6. PostgreSQL Functions (Atomic Credit Operations)
-- ============================================================

-- Atomic credit deduction with overage support
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID,
  p_credit_type TEXT,
  p_quantity INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_remaining INTEGER;
  v_tier TEXT;
  v_overage_enabled BOOLEAN;
  v_col_remaining TEXT;
  v_col_used TEXT;
  v_col_overage TEXT;
BEGIN
  CASE p_credit_type
    WHEN 'logo' THEN
      v_col_remaining := 'logo_credits_remaining';
      v_col_used := 'logo_credits_used';
      v_col_overage := 'logo_overage_count';
    WHEN 'mockup' THEN
      v_col_remaining := 'mockup_credits_remaining';
      v_col_used := 'mockup_credits_used';
      v_col_overage := 'mockup_overage_count';
    WHEN 'video' THEN
      v_col_remaining := 'video_credits_remaining';
      v_col_used := 'video_credits_used';
      v_col_overage := 'video_overage_count';
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Invalid credit type');
  END CASE;

  -- Lock the row for this user
  EXECUTE format(
    'SELECT %I FROM generation_credits WHERE user_id = $1 FOR UPDATE',
    v_col_remaining
  ) INTO v_remaining USING p_user_id;

  IF v_remaining IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No credit record found');
  END IF;

  -- Sufficient credits
  IF v_remaining >= p_quantity THEN
    EXECUTE format(
      'UPDATE generation_credits SET %I = %I - $1, %I = %I + $1, updated_at = NOW() WHERE user_id = $2',
      v_col_remaining, v_col_remaining, v_col_used, v_col_used
    ) USING p_quantity, p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'balance_after', v_remaining - p_quantity,
      'is_overage', false
    );
  END IF;

  -- Insufficient credits — check overage eligibility
  SELECT subscription_tier INTO v_tier FROM profiles WHERE id = p_user_id;
  v_overage_enabled := v_tier IN ('pro', 'agency');

  IF v_overage_enabled THEN
    DECLARE
      v_from_balance INTEGER := GREATEST(v_remaining, 0);
      v_overage_qty INTEGER := p_quantity - v_from_balance;
    BEGIN
      EXECUTE format(
        'UPDATE generation_credits SET %I = 0, %I = %I + $1, %I = %I + $2, updated_at = NOW() WHERE user_id = $3',
        v_col_remaining, v_col_used, v_col_used, v_col_overage, v_col_overage
      ) USING p_quantity, v_overage_qty, p_user_id;

      RETURN jsonb_build_object(
        'success', true,
        'balance_after', 0,
        'is_overage', true,
        'overage_quantity', v_overage_qty
      );
    END;
  END IF;

  -- No credits, no overage
  RETURN jsonb_build_object(
    'success', false,
    'balance_after', v_remaining,
    'is_overage', false,
    'error', 'Insufficient credits'
  );
END;
$$;

-- Atomic credit refund
CREATE OR REPLACE FUNCTION refund_credits(
  p_user_id UUID,
  p_credit_type TEXT,
  p_quantity INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_col_remaining TEXT;
  v_col_used TEXT;
  v_balance_after INTEGER;
BEGIN
  CASE p_credit_type
    WHEN 'logo' THEN
      v_col_remaining := 'logo_credits_remaining';
      v_col_used := 'logo_credits_used';
    WHEN 'mockup' THEN
      v_col_remaining := 'mockup_credits_remaining';
      v_col_used := 'mockup_credits_used';
    WHEN 'video' THEN
      v_col_remaining := 'video_credits_remaining';
      v_col_used := 'video_credits_used';
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Invalid credit type');
  END CASE;

  EXECUTE format(
    'UPDATE generation_credits SET %I = %I + $1, %I = GREATEST(%I - $1, 0), updated_at = NOW() WHERE user_id = $2 RETURNING %I',
    v_col_remaining, v_col_remaining, v_col_used, v_col_used, v_col_remaining
  ) INTO v_balance_after USING p_quantity, p_user_id;

  RETURN jsonb_build_object('success', true, 'balance_after', v_balance_after);
END;
$$;

-- ============================================================
-- 7. Row Level Security (RLS)
-- ============================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Users can only read their own subscription
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only read their own credits
CREATE POLICY "Users can view own credits"
  ON generation_credits FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only read their own credit transactions
CREATE POLICY "Users can view own credit transactions"
  ON credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Webhook events: server-only (service role key)
-- No user-facing RLS policy — only accessible via service role
CREATE POLICY "Service role only for webhook events"
  ON webhook_events FOR ALL
  USING (false);  -- Block all direct access; use service role key from server

-- Server operations use service_role key which bypasses RLS
```

### Entity Relationship (Payments Subset)

```
profiles (existing)
  |-- stripe_customer_id (TEXT, unique, nullable)
  |-- subscription_tier (TEXT, default 'free')
  |
  |-- 1:1 --> subscriptions
  |             |-- stripe_subscription_id
  |             |-- tier
  |             |-- status
  |             |-- current_period_start/end
  |             |-- cancel_at_period_end
  |
  |-- 1:1 --> generation_credits
  |             |-- logo_credits_remaining/used
  |             |-- mockup_credits_remaining/used
  |             |-- video_credits_remaining/used
  |             |-- *_overage_count
  |             |-- period_start/end
  |
  |-- 1:N --> credit_transactions
                |-- credit_type (logo/mockup/video)
                |-- action (allocate/deduct/refund/refill/overage)
                |-- quantity (+/-)
                |-- balance_after
                |-- generation_job_id (FK, nullable)
                |-- stripe_invoice_id (nullable)

webhook_events (standalone, server-only)
  |-- stripe_event_id (unique)
  |-- event_type
  |-- payload (JSONB)
  |-- status (received/processing/processed/failed)
```

---

## 8. Frontend Integration

### Checkout Page (Wizard Step 11)

```jsx
// apps/web/src/routes/wizard/checkout.jsx

import { useSearchParams, useNavigate } from 'react-router-dom';
import { useBilling } from '../../hooks/use-billing.js';
import { useWizardStore } from '../../stores/wizard-store.js';
import { TIER_CONFIG } from '@brand-me-now/shared/constants/tiers.js';

export default function WizardCheckout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { createCheckout, subscription } = useBilling();
  const canceled = searchParams.get('canceled') === 'true';

  const handleSubscribe = (tier) => {
    createCheckout.mutate(tier);
  };

  // If user already has a paid subscription, skip to completion
  if (subscription.data?.tier && subscription.data.tier !== 'free') {
    navigate('/wizard/complete');
    return null;
  }

  return (
    <div className="wizard-checkout">
      <h1>Choose Your Plan</h1>
      <p>Download your brand assets and unlock ongoing AI generation.</p>

      {canceled && (
        <div className="alert alert-warning">
          Checkout was canceled. Your brand is saved — subscribe when you are ready.
        </div>
      )}

      <div className="tier-grid">
        {['starter', 'pro', 'agency'].map((tierName) => {
          const tier = TIER_CONFIG[tierName];
          return (
            <div key={tierName} className="tier-card">
              <h2>{tier.displayName}</h2>
              <p className="price">${tier.price}/mo</p>
              <ul>
                <li>{tier.brandLimit === 0 ? 'Unlimited' : tier.brandLimit} brands</li>
                <li>{tier.logoCredits} logos/mo</li>
                <li>{tier.mockupCredits} mockups/mo</li>
                {tier.videoCredits > 0 && <li>{tier.videoCredits} videos/mo</li>}
              </ul>
              <button
                onClick={() => handleSubscribe(tierName)}
                disabled={createCheckout.isPending}
              >
                {createCheckout.isPending ? 'Redirecting...' : `Subscribe — $${tier.price}/mo`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Credit Balance Display (Dashboard)

```jsx
// apps/web/src/components/billing/CreditBalanceCard.jsx

import { useBilling } from '../../hooks/use-billing.js';

export function CreditBalanceCard() {
  const { subscription } = useBilling();
  const credits = subscription.data?.credits;

  if (!credits) return null;

  const creditTypes = [
    { key: 'logo', label: 'Logos', icon: 'palette' },
    { key: 'mockup', label: 'Mockups', icon: 'image' },
    { key: 'video', label: 'Videos', icon: 'video' },
  ];

  return (
    <div className="credit-balance-card">
      <h3>Credits This Month</h3>
      {credits.periodEnd && (
        <p className="refill-date">
          Refills {new Date(credits.periodEnd).toLocaleDateString()}
        </p>
      )}
      <div className="credit-bars">
        {creditTypes.map(({ key, label }) => {
          const data = credits[key];
          const total = data.remaining + data.used;
          const pct = total > 0 ? (data.remaining / total) * 100 : 0;

          return (
            <div key={key} className="credit-row">
              <span className="credit-label">{label}</span>
              <div className="credit-bar">
                <div className="credit-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="credit-count">{data.remaining} left</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Socket.io Subscription Events (Client)

```javascript
// apps/web/src/hooks/use-subscription-events.js

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './use-socket.js';
import { useAuthStore } from '../stores/auth-store.js';

/**
 * Listen for real-time subscription events via Socket.io.
 * Automatically invalidates billing queries when subscription changes.
 */
export function useSubscriptionEvents() {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!socket || !userId) return;

    const events = [
      'subscription:activated',
      'subscription:updated',
      'subscription:renewed',
      'subscription:canceled',
      'subscription:payment-failed',
    ];

    const handler = (data) => {
      // Invalidate billing queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['billing'] });
    };

    events.forEach((event) => socket.on(event, handler));

    return () => {
      events.forEach((event) => socket.off(event, handler));
    };
  }, [socket, userId, queryClient]);
}
```

---

## 9. File Manifest

### Server Files (New)

| File | Purpose |
|------|---------|
| `server/src/services/stripe.js` | Stripe SDK initialization and configuration |
| `server/src/services/credits.js` | Credit check, deduct, refund, allocate, refill functions |
| `server/src/config/tiers.js` | Tier configuration (prices, limits, features, Stripe price IDs) |
| `server/src/routes/billing.js` | Billing API routes (checkout session, portal session, subscription status) |
| `server/src/routes/webhooks.js` | Stripe webhook endpoint with signature verification |
| `server/src/workers/stripe-webhook.js` | BullMQ worker for durable webhook event processing |
| `server/src/middleware/credits.js` | `requireCredits()` middleware for generation endpoints |

### Database Migrations (New)

| File | Purpose |
|------|---------|
| `supabase/migrations/20260219000001_credit_functions.sql` | PostgreSQL functions: `deduct_credits()`, `refund_credits()` |
| `supabase/migrations/20260219000002_webhook_events.sql` | `webhook_events` table for idempotent webhook processing |
| `supabase/migrations/20260219000003_profiles_stripe.sql` | Add `stripe_customer_id`, `subscription_tier` to profiles |
| `supabase/migrations/20260219000004_subscriptions.sql` | `subscriptions` table |
| `supabase/migrations/20260219000005_payments_full.sql` | Combined migration with all tables, functions, RLS, indexes |

### Frontend Files (New)

| File | Purpose |
|------|---------|
| `apps/web/src/routes/wizard/checkout.jsx` | Wizard Step 11: tier selection + Stripe Checkout redirect |
| `apps/web/src/hooks/use-billing.js` | TanStack Query hooks for billing API |
| `apps/web/src/hooks/use-subscription-events.js` | Socket.io listener for real-time subscription events |
| `apps/web/src/components/billing/CreditBalanceCard.jsx` | Credit usage display component |

### Scripts

| File | Purpose |
|------|---------|
| `scripts/setup-stripe-products.js` | One-time script to create Stripe products, prices, and portal config |

### Shared Packages

| File | Purpose |
|------|---------|
| `packages/shared/constants/tiers.js` | Tier config shared between frontend and backend (subset: no Stripe IDs) |

---

## 10. Development Prompt

Use this prompt to instruct an AI coding agent to implement the payments system.

```
You are building the payments and billing system for Brand Me Now v2.

## Context
- Stack: Express.js 5 + Supabase (PostgreSQL 17) + BullMQ + Redis + Socket.io
- Language: JavaScript + JSDoc types (NOT TypeScript)
- Hosting: DigitalOcean Kubernetes (API server + Redis) + Supabase (cloud)
- Auth: Supabase Auth (JWT verified in Express middleware)
- Real-time: Socket.io for live subscription status updates

## What to Build

### 1. Stripe Service (`server/src/services/stripe.js`)
- Initialize Stripe SDK with pinned API version
- Export singleton stripe instance

### 2. Tier Config (`server/src/config/tiers.js`)
- Define 4 tiers: free, starter ($29), pro ($79), agency ($199)
- Each tier has: price, brand limit, logo/mockup/video credits, features, Stripe price ID, overage rates, BullMQ priority
- Export: getTierConfig(name), getTierByPriceId(priceId), hasFeature(tier, feature)

### 3. Credit Service (`server/src/services/credits.js`)
- checkCredits(userId, creditType, quantity) -> { allowed, remaining, needsUpgrade, overageAllowed }
- deductCredits(userId, creditType, quantity, context) -> calls Supabase RPC for atomic deduction
- refundCredits(userId, creditType, quantity, context) -> credits returned on generation failure
- allocateCredits(userId, tierName, billingContext) -> upsert generation_credits on subscription create
- refillCredits(userId, tierName, billingContext) -> reset credits on monthly renewal (no rollover)
- getCreditBalances(userId) -> current balances

### 4. Credit Middleware (`server/src/middleware/credits.js`)
- requireCredits(creditType, quantity) middleware factory
- Returns 402 with upgrade prompt if insufficient credits
- Attaches creditCheck to req for downstream handlers

### 5. Billing Routes (`server/src/routes/billing.js`)
- POST /api/v1/billing/checkout-session -> create Stripe Checkout Session
- POST /api/v1/billing/portal-session -> create Stripe Customer Portal session
- GET /api/v1/billing/subscription -> get current subscription + credit balances
- All routes require auth middleware

### 6. Webhook Route (`server/src/routes/webhooks.js`)
- POST /api/v1/webhooks/stripe
- express.raw() for body (NOT express.json())
- Verify signature with stripe.webhooks.constructEvent()
- Idempotency check against webhook_events table
- Enqueue BullMQ job for durable processing
- Return 200 immediately (< 100ms)

### 7. Webhook Worker (`server/src/workers/stripe-webhook.js`)
- BullMQ worker on "stripe-webhook" queue
- Handle: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed
- Each handler: update database, adjust credits, emit Socket.io events, queue CRM sync + emails
- 5 retry attempts with exponential backoff

### 8. Database Migrations
- generation_credits table (per-user credit balances)
- credit_transactions table (immutable audit trail)
- subscriptions table (Stripe subscription mirror)
- webhook_events table (idempotency)
- PostgreSQL functions: deduct_credits(), refund_credits() (atomic with row locking)
- RLS policies: users can only read their own data

### 9. Mount webhook route BEFORE express.json() in app.js

## Rules
- Use JSDoc types everywhere, NOT TypeScript
- Use pino logger (structured JSON) for all log statements
- All database operations use Supabase JS client (service role key on server)
- Credit deduction MUST be atomic (PostgreSQL function with FOR UPDATE)
- Webhook processing MUST be idempotent (check webhook_events before processing)
- Never store card data (Stripe Checkout handles PCI compliance)
- All monetary amounts in Stripe are in cents (e.g., $29.00 = 2900)
- Socket.io events scoped to `user:{userId}` room
- Unused credits do NOT roll over between billing periods
```

---

## 11. Acceptance Criteria

### Checkout Flow

| # | Criteria | Verification |
|---|---------|-------------|
| AC-01 | User can select a subscription tier and be redirected to Stripe Checkout. | POST `/api/v1/billing/checkout-session` returns `{ checkoutUrl }`. Browser redirects to Stripe. |
| AC-02 | User with an existing active subscription cannot create a duplicate. | POST returns 409 with message to use Customer Portal. |
| AC-03 | Successful payment redirects to `/wizard/complete?session_id=...`. | Stripe redirect URL matches. |
| AC-04 | Canceled checkout redirects to `/wizard/checkout?canceled=true`. | Cancel URL matches. Client shows "Checkout was canceled" message. |
| AC-05 | Stripe Customer is created on first checkout and reused for subsequent sessions. | `profiles.stripe_customer_id` is populated after first checkout. Second checkout reuses the same customer. |

### Webhook Processing

| # | Criteria | Verification |
|---|---------|-------------|
| AC-06 | Webhook endpoint verifies Stripe signature. Invalid signatures return 400. | Send request with bad signature -> 400. Send valid Stripe event -> 200. |
| AC-07 | Duplicate webhook events are detected and skipped. | Send same event ID twice -> second returns `{ received: true, duplicate: true }`. |
| AC-08 | `checkout.session.completed` creates subscription record, updates profile tier, allocates credits. | After checkout: `subscriptions` row exists, `profiles.subscription_tier` updated, `generation_credits` row has correct balances. |
| AC-09 | `customer.subscription.updated` updates tier and re-allocates credits on upgrade/downgrade. | Simulate tier change via Stripe -> subscription row updated, credits adjusted, Socket.io event emitted. |
| AC-10 | `customer.subscription.deleted` downgrades user to free tier. | Cancel subscription in Stripe -> profile tier = 'free', credits reset to free allocation. |
| AC-11 | `invoice.payment_succeeded` (renewal) refills credits. | Simulate renewal -> credits reset to tier allocation, `last_refill_at` updated. |
| AC-12 | `invoice.payment_failed` sends warning email and updates status to `past_due`. | Simulate failed payment -> email queued, subscription status = 'past_due', Socket.io event emitted. |
| AC-13 | Webhook processing survives server restart. | Enqueue webhook job, restart server, BullMQ worker resumes processing. |

### Credit System

| # | Criteria | Verification |
|---|---------|-------------|
| AC-14 | Free trial users get one-time credit allocation (4 logos, 4 mockups). | Sign up new user -> `generation_credits` row has correct balances. |
| AC-15 | Credit check rejects generation when insufficient credits (free/starter). | Call `checkCredits('logo', 5)` with 4 remaining on starter -> `{ allowed: false, needsUpgrade: true }`. |
| AC-16 | Credit check allows overage for pro/agency tiers. | Call `checkCredits('logo', 60)` with 50 remaining on pro with overage enabled -> `{ allowed: true, overageAllowed: true }`. |
| AC-17 | Credit deduction is atomic (no race conditions). | Run 10 concurrent `deductCredits()` calls for same user -> total deducted equals sum, no negative balances. |
| AC-18 | Failed generation refunds credits. | Deduct 4 logo credits, simulate generation failure, call `refundCredits()` -> balance restored. |
| AC-19 | Monthly renewal resets credits (no rollover). | User has 15/20 logos remaining. Renewal fires. Credits reset to 20/20, used reset to 0. |
| AC-20 | Credit transactions table records every change with correct `action` and `balance_after`. | After allocate, deduct, refund, refill -> credit_transactions has 4 rows with correct data. |

### Customer Portal

| # | Criteria | Verification |
|---|---------|-------------|
| AC-21 | User can access Stripe Customer Portal to manage subscription. | POST `/api/v1/billing/portal-session` returns `{ portalUrl }`. Portal loads in browser. |
| AC-22 | User can upgrade/downgrade via portal. Tier change reflected in app. | Upgrade starter -> pro via portal -> `customer.subscription.updated` webhook fires -> profile tier = 'pro', credits adjusted. |
| AC-23 | User can cancel subscription via portal. Cancellation takes effect at period end. | Cancel via portal -> `cancel_at_period_end = true`. At period end, `customer.subscription.deleted` fires -> downgrade to free. |
| AC-24 | User can update payment method via portal. | Open portal -> update card -> no webhook needed (Stripe handles internally). |

### API Responses

| # | Criteria | Verification |
|---|---------|-------------|
| AC-25 | GET `/api/v1/billing/subscription` returns tier, subscription status, and credit balances. | Response includes `tier`, `subscription.status`, `credits.logo.remaining`, etc. |
| AC-26 | Generation endpoint returns 402 when credits are insufficient. | POST `/api/v1/generation/logos` with 0 credits -> 402 with `{ error: 'Insufficient credits', needsUpgrade: true }`. |
| AC-27 | All billing endpoints require authentication. Unauthenticated requests return 401. | Call any billing endpoint without Bearer token -> 401. |

### Security

| # | Criteria | Verification |
|---|---------|-------------|
| AC-28 | No card data touches our servers. All payment collection via Stripe Checkout (hosted). | Code review: no card number, CVV, or expiry fields in our frontend or backend. |
| AC-29 | Stripe webhook secret is validated on every webhook request. | Code review: `stripe.webhooks.constructEvent()` called with `STRIPE_WEBHOOK_SECRET`. |
| AC-30 | RLS policies prevent users from viewing other users' subscription data. | Authenticated as user A, query subscriptions for user B via Supabase client -> empty result. |
| AC-31 | Webhook events table is inaccessible via Supabase client (service role only). | Query `webhook_events` via Supabase anon key -> empty result (RLS blocks). |
| AC-32 | Credit deduction SQL function uses `FOR UPDATE` row locking. | Code review: `deduct_credits()` function contains `FOR UPDATE` clause. |

---

## Appendix: Stripe Test Data

### Test Card Numbers

| Card | Number | Behavior |
|------|--------|----------|
| Successful payment | 4242 4242 4242 4242 | Always succeeds |
| Requires authentication | 4000 0025 0000 3155 | Triggers 3D Secure |
| Card declined | 4000 0000 0000 0002 | Always fails |
| Insufficient funds | 4000 0000 0000 9995 | Fails with insufficient_funds |

### Testing Webhook Locally

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe

# The CLI will print a webhook signing secret (whsec_...)
# Use this as STRIPE_WEBHOOK_SECRET in local development

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
```

### Stripe Test Clocks (Subscription Lifecycle Testing)

```bash
# Create a test clock to simulate time-based subscription events
stripe test_clocks create --frozen_time="2026-02-19T00:00:00Z"

# Advance the clock to trigger renewal
stripe test_clocks advance --frozen_time="2026-03-19T00:00:00Z"

# This triggers invoice.payment_succeeded -> credit refill
```
