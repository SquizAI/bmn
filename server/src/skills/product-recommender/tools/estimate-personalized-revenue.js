// server/src/skills/product-recommender/tools/estimate-personalized-revenue.js

import { z } from 'zod';
import { logger } from '../../../lib/logger.js';

/**
 * Niche-specific base conversion rates.
 * These represent the baseline % of engaged followers who convert to buyers.
 */
const NICHE_CONVERSION_RATES = {
  fitness: 0.025,
  beauty: 0.030,
  wellness: 0.022,
  lifestyle: 0.018,
  food: 0.020,
  fashion: 0.028,
  tech: 0.015,
  gaming: 0.012,
  travel: 0.014,
  business: 0.020,
  parenting: 0.022,
  pets: 0.018,
};

const DEFAULT_CONVERSION_RATE = 0.015;

/**
 * Sales volume multipliers per tier.
 * Conservative: organic only, new brand
 * Moderate: active marketing, some ads
 * Aggressive: scaled marketing, influencer partnerships
 */
const TIER_MULTIPLIERS = {
  conservative: 1.0,
  moderate: 3.5,
  aggressive: 10.0,
};

export const estimatePersonalizedRevenue = {
  name: 'estimatePersonalizedRevenue',
  description: 'Calculate personalized revenue estimates per product using the creator\'s actual follower count, engagement rate, and niche-specific conversion rates. Returns Conservative, Moderate, and Aggressive tier projections.',
  inputSchema: z.object({
    followerCount: z.number().int().min(0).describe('Total follower count across platforms'),
    engagementRate: z.number().min(0).max(1).describe('Average engagement rate as decimal (e.g., 0.035 = 3.5%)'),
    niche: z.string().describe('Creator\'s niche for conversion rate lookup'),
    products: z.array(z.object({
      sku: z.string(),
      name: z.string(),
      baseCost: z.number().min(0),
      suggestedRetail: z.number().min(0),
      nicheMatchScore: z.number().min(0).max(1),
    })).min(1).describe('Products with niche match scores to estimate revenue for'),
  }),

  /**
   * @param {Object} input
   * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
   */
  async execute({ followerCount, engagementRate, niche, products }) {
    logger.info({
      msg: 'Estimating personalized revenue',
      followerCount,
      engagementRate,
      niche,
      productCount: products.length,
    });

    const normalizedNiche = niche.toLowerCase().trim();
    const baseConversionRate = NICHE_CONVERSION_RATES[normalizedNiche] || DEFAULT_CONVERSION_RATE;

    // Scale conversion rate by engagement (higher engagement = better conversion)
    // Average engagement ~3.5% -> 1.0x multiplier
    const engagementMultiplier = Math.max(0.5, Math.min(2.0, engagementRate / 0.035));

    // Low follower count penalty (below 1k = reduced estimates)
    const followerScaleFactor = followerCount < 1000
      ? 0.5
      : followerCount < 5000
        ? 0.75
        : followerCount < 50000
          ? 1.0
          : Math.min(1.5, 1.0 + (Math.log10(followerCount / 50000) * 0.2));

    const returnRate = 0.05;

    const estimates = products.map((product) => {
      const profit = product.suggestedRetail - product.baseCost;
      const marginPercent = product.suggestedRetail > 0
        ? ((product.suggestedRetail - product.baseCost) / product.suggestedRetail) * 100
        : 0;

      // Personalized conversion rate adjusted by niche match
      const adjustedConversion = baseConversionRate
        * engagementMultiplier
        * followerScaleFactor
        * product.nicheMatchScore;

      // Base monthly units = followers * conversion rate (this gives monthly buyer count)
      const baseMonthlyUnits = Math.round(followerCount * adjustedConversion);

      const tiers = Object.entries(TIER_MULTIPLIERS).map(([label, multiplier]) => {
        const rawUnits = Math.round(baseMonthlyUnits * multiplier);
        const effectiveUnits = Math.round(rawUnits * (1 - returnRate));
        const monthlyRevenue = Math.round(product.suggestedRetail * effectiveUnits * 100) / 100;
        const monthlyProfit = Math.round(profit * effectiveUnits * 100) / 100;

        return {
          label,
          unitsPerMonth: effectiveUnits,
          monthlyRevenue,
          monthlyProfit,
          annualRevenue: Math.round(monthlyRevenue * 12 * 100) / 100,
          annualProfit: Math.round(monthlyProfit * 12 * 100) / 100,
        };
      });

      return {
        sku: product.sku,
        name: product.name,
        followerCount,
        engagementRate,
        nicheMatchScore: product.nicheMatchScore,
        conversionRate: Math.round(adjustedConversion * 10000) / 10000,
        averageOrderValue: product.suggestedRetail,
        marginPercent: Math.round(marginPercent * 100) / 100,
        tiers,
      };
    });

    // Aggregate totals per tier
    const aggregated = {
      conservative: { monthlyRevenue: 0, monthlyProfit: 0, annualRevenue: 0, annualProfit: 0 },
      moderate: { monthlyRevenue: 0, monthlyProfit: 0, annualRevenue: 0, annualProfit: 0 },
      aggressive: { monthlyRevenue: 0, monthlyProfit: 0, annualRevenue: 0, annualProfit: 0 },
    };

    for (const est of estimates) {
      for (const tier of est.tiers) {
        aggregated[tier.label].monthlyRevenue += tier.monthlyRevenue;
        aggregated[tier.label].monthlyProfit += tier.monthlyProfit;
        aggregated[tier.label].annualRevenue += tier.annualRevenue;
        aggregated[tier.label].annualProfit += tier.annualProfit;
      }
    }

    // Round aggregated values
    for (const key of Object.keys(aggregated)) {
      aggregated[key].monthlyRevenue = Math.round(aggregated[key].monthlyRevenue * 100) / 100;
      aggregated[key].monthlyProfit = Math.round(aggregated[key].monthlyProfit * 100) / 100;
      aggregated[key].annualRevenue = Math.round(aggregated[key].annualRevenue * 100) / 100;
      aggregated[key].annualProfit = Math.round(aggregated[key].annualProfit * 100) / 100;
    }

    return {
      success: true,
      data: {
        estimates,
        aggregated,
        assumptions: {
          baseConversionRate,
          engagementMultiplier: Math.round(engagementMultiplier * 100) / 100,
          followerScaleFactor: Math.round(followerScaleFactor * 100) / 100,
          returnRate,
          niche: normalizedNiche,
        },
      },
    };
  },
};
