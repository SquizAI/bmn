// server/src/config/tiers.js

import { config } from './index.js';

/**
 * @typedef {Object} TierConfig
 * @property {string} name - Internal tier name
 * @property {string} displayName - Human-readable tier name
 * @property {number} price - Monthly price in USD
 * @property {number} brandLimit - Max active brands (0 = unlimited)
 * @property {number} logoCredits - Logo credits per billing period
 * @property {number} mockupCredits - Mockup credits per billing period
 * @property {number} videoCredits - Video credits per billing period (Phase 2)
 * @property {boolean} creditsRefillMonthly - Whether credits reset on billing cycle
 * @property {boolean} overageEnabled - Whether overage charges are allowed
 * @property {number} overageLogoRate - Dollars per logo overage
 * @property {number} overageMockupRate - Dollars per mockup overage
 * @property {number} overageVideoRate - Dollars per video overage
 * @property {number} generationPriority - BullMQ priority (1 = highest, 10 = lowest)
 * @property {string[]} features - List of feature flags for this tier
 * @property {string|null} stripePriceId - Stripe Price ID (null for free tier)
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
    creditsRefillMonthly: false,
    overageEnabled: false,
    overageLogoRate: 0,
    overageMockupRate: 0,
    overageVideoRate: 0,
    generationPriority: 10,
    features: [
      'basic_wizard',
      'logo_generation',
      'mockup_generation',
      'profit_calculator',
    ],
    stripePriceId: null,
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
    overageEnabled: false,
    overageLogoRate: 0.50,
    overageMockupRate: 0.30,
    overageVideoRate: 0,
    generationPriority: 5,
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
    stripePriceId: config.STRIPE_PRICE_STARTER_MONTHLY,
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
    overageEnabled: true,
    overageLogoRate: 0.40,
    overageMockupRate: 0.25,
    overageVideoRate: 1.00,
    generationPriority: 1,
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
    stripePriceId: config.STRIPE_PRICE_PRO_MONTHLY,
  },

  agency: {
    name: 'agency',
    displayName: 'Agency',
    price: 199,
    brandLimit: 0,
    logoCredits: 200,
    mockupCredits: 500,
    videoCredits: 50,
    creditsRefillMonthly: true,
    overageEnabled: true,
    overageLogoRate: 0.30,
    overageMockupRate: 0.20,
    overageVideoRate: 0.75,
    generationPriority: 1,
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
    stripePriceId: config.STRIPE_PRICE_AGENCY_MONTHLY,
  },
};

/** @type {string[]} */
export const PAID_TIERS = ['starter', 'pro', 'agency'];

/**
 * Get tier config by name.
 * @param {string} tierName
 * @returns {TierConfig}
 * @throws {Error} If tier name is unknown
 */
export function getTierConfig(tierName) {
  const tierConfig = TIER_CONFIG[tierName];
  if (!tierConfig) {
    throw new Error(`Unknown tier: "${tierName}". Valid tiers: ${Object.keys(TIER_CONFIG).join(', ')}`);
  }
  return tierConfig;
}

/**
 * Get tier config by Stripe Price ID (for webhook processing).
 * @param {string} priceId
 * @returns {TierConfig|null}
 */
export function getTierByPriceId(priceId) {
  return Object.values(TIER_CONFIG).find((t) => t.stripePriceId === priceId) || null;
}

/**
 * Check if a feature is available for a tier.
 * @param {string} tierName
 * @param {string} featureName
 * @returns {boolean}
 */
export function hasFeature(tierName, featureName) {
  const tierConfig = TIER_CONFIG[tierName];
  return tierConfig ? tierConfig.features.includes(featureName) : false;
}
