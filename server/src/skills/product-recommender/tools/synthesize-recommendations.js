// server/src/skills/product-recommender/tools/synthesize-recommendations.js

import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase.js';
import { logger } from '../../../lib/logger.js';

export const synthesizeRecommendations = {
  name: 'synthesizeRecommendations',
  description: 'Combine niche fit scores, revenue estimates, and bundle suggestions into a final ranked recommendation list. Saves the result to the brand record. This MUST be called as the final tool to produce the skill output.',
  inputSchema: z.object({
    brandId: z.string().uuid().describe('Brand record ID'),
    userId: z.string().uuid().describe('User ID for scoping'),
    niche: z.string().describe('Creator niche'),
    audienceSize: z.number().int().describe('Total follower count'),
    scoredProducts: z.array(z.object({
      sku: z.string(),
      name: z.string(),
      category: z.string(),
      subcategory: z.string().nullable(),
      imageUrl: z.string().nullable().optional(),
      baseCost: z.number(),
      suggestedRetail: z.number(),
      nicheMatchScore: z.number(),
      audienceFitScore: z.number(),
      marginPercent: z.number(),
      revenue: z.object({
        conversionRate: z.number(),
        tiers: z.array(z.object({
          label: z.string(),
          unitsPerMonth: z.number(),
          monthlyRevenue: z.number(),
          monthlyProfit: z.number(),
          annualRevenue: z.number(),
          annualProfit: z.number(),
        })),
      }),
      reasoning: z.string().describe('AI-generated "Why this product fits" explanation'),
    })).describe('Products with all scoring data'),
    bundles: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      productSkus: z.array(z.string()),
      products: z.array(z.object({ sku: z.string(), name: z.string() })),
      individualTotal: z.number(),
      bundlePrice: z.number(),
      discountPercent: z.number(),
      estimatedMonthlyRevenue: z.object({
        conservative: z.number(),
        moderate: z.number(),
        aggressive: z.number(),
      }),
      reasoning: z.string(),
    })).describe('Suggested bundles'),
  }),

  /**
   * @param {Object} input
   * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
   */
  async execute({ brandId, userId, niche, audienceSize, scoredProducts, bundles }) {
    logger.info({ msg: 'Synthesizing recommendations', brandId, productCount: scoredProducts.length });

    // Calculate composite score and rank products
    // Formula: (nicheMatchScore * 0.4) + (normalizedRevenue * 0.3) + (marginPercent/100 * 0.2) + (audienceFitScore * 0.1)
    const maxModerateRevenue = Math.max(
      1,
      ...scoredProducts.map((p) => {
        const moderateTier = p.revenue.tiers.find((t) => t.label === 'moderate');
        return moderateTier?.monthlyRevenue || 0;
      })
    );

    const ranked = scoredProducts.map((product) => {
      const moderateTier = product.revenue.tiers.find((t) => t.label === 'moderate');
      const normalizedRevenue = (moderateTier?.monthlyRevenue || 0) / maxModerateRevenue;
      const normalizedMargin = Math.min(1.0, product.marginPercent / 100);

      const compositeScore = Math.round(
        (product.nicheMatchScore * 0.4 +
          normalizedRevenue * 0.3 +
          normalizedMargin * 0.2 +
          product.audienceFitScore * 0.1) * 100
      ) / 100;

      // Confidence is based on data quality and fit
      const confidence = Math.round(
        Math.min(100, Math.max(10,
          product.nicheMatchScore * 40 +
          product.audienceFitScore * 25 +
          normalizedRevenue * 20 +
          normalizedMargin * 15
        ))
      );

      return {
        ...product,
        compositeScore,
        confidenceScore: confidence,
      };
    });

    // Sort by composite score descending and assign ranks
    ranked.sort((a, b) => b.compositeScore - a.compositeScore);
    const recommendations = ranked.map((product, index) => ({
      ...product,
      rank: index + 1,
    }));

    // Aggregate revenue summary
    const aggregateRevenue = {
      conservative: 0,
      moderate: 0,
      aggressive: 0,
    };
    for (const rec of recommendations) {
      for (const tier of rec.revenue.tiers) {
        if (aggregateRevenue[tier.label] !== undefined) {
          aggregateRevenue[tier.label] += tier.monthlyRevenue;
        }
      }
    }
    aggregateRevenue.conservative = Math.round(aggregateRevenue.conservative * 100) / 100;
    aggregateRevenue.moderate = Math.round(aggregateRevenue.moderate * 100) / 100;
    aggregateRevenue.aggressive = Math.round(aggregateRevenue.aggressive * 100) / 100;

    const result = {
      brandId,
      recommendations,
      bundles,
      summary: {
        totalRecommended: recommendations.length,
        topCategory: recommendations.length > 0 ? recommendations[0].category : 'unknown',
        estimatedMonthlyRevenue: aggregateRevenue,
        creatorNiche: niche,
        audienceSize,
      },
    };

    // Persist to database
    try {
      const { error } = await supabaseAdmin
        .from('brand_recommendations')
        .upsert({
          brand_id: brandId,
          user_id: userId,
          recommendations: result.recommendations,
          bundles: result.bundles,
          summary: result.summary,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'brand_id' });

      if (error) {
        logger.warn({ msg: 'Failed to persist recommendations', error: error.message });
        // Non-fatal: return results even if persistence fails
      }
    } catch (err) {
      logger.warn({ msg: 'Recommendation persistence error', error: err.message });
    }

    return {
      success: true,
      data: result,
    };
  },
};
