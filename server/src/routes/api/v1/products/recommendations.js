// server/src/routes/api/v1/products/recommendations.js

import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase.js';
import { logger } from '../../../../lib/logger.js';
import { validate } from '../../../../middleware/validate.js';
import { RecommendationRequestSchema } from '../../../../../shared/schemas/products.js';

export const recommendationsRouter = Router();

// ---- Validation schemas ----

const getRecommendationsParams = z.object({
  brandId: z.string().uuid('Invalid brand ID'),
});

// ---- POST /api/v1/products/recommendations ----
// Trigger AI product recommendations for a brand based on dossier data.

recommendationsRouter.post(
  '/',
  validate({ body: RecommendationRequestSchema }),
  async (req, res, next) => {
    try {
      const { brandId, dossier } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      // Verify brand ownership
      const { data: brand, error: brandError } = await supabaseAdmin
        .from('brands')
        .select('id, user_id')
        .eq('id', brandId)
        .eq('user_id', userId)
        .single();

      if (brandError || !brand) {
        return res.status(404).json({ success: false, error: 'Brand not found' });
      }

      // Queue the recommendation job via BullMQ
      // For now, compute synchronously using the skill tools directly
      const { getProductCatalog } = await import('../../../../skills/product-recommender/tools/get-product-catalog.js');
      const { analyzeNicheProductFit } = await import('../../../../skills/product-recommender/tools/analyze-niche-product-fit.js');
      const { estimatePersonalizedRevenue } = await import('../../../../skills/product-recommender/tools/estimate-personalized-revenue.js');
      const { suggestBundles } = await import('../../../../skills/product-recommender/tools/suggest-bundles.js');
      const { synthesizeRecommendations } = await import('../../../../skills/product-recommender/tools/synthesize-recommendations.js');

      // Step 1: Fetch catalog
      const catalogResult = await getProductCatalog.execute({ categories: undefined });
      if (!catalogResult.success) {
        return res.status(500).json({ success: false, error: catalogResult.error });
      }

      const products = catalogResult.data.products;

      // Step 2: Score niche fit
      const fitResult = await analyzeNicheProductFit.execute({
        niche: dossier.niche,
        audienceDemographics: dossier.audienceDemographics,
        brandPersonality: dossier.brandPersonality,
        themes: dossier.themes,
        products: products.map((p) => ({
          sku: p.sku,
          name: p.name,
          category: p.category,
          subcategory: p.subcategory,
          baseCost: p.baseCost,
          suggestedRetail: p.suggestedRetail,
        })),
      });

      if (!fitResult.success) {
        return res.status(500).json({ success: false, error: 'Failed to analyze product fit' });
      }

      // Step 3: Estimate revenue
      const revenueResult = await estimatePersonalizedRevenue.execute({
        followerCount: dossier.audienceSize,
        engagementRate: dossier.engagementRate,
        niche: dossier.niche,
        products: fitResult.data.scoredProducts.map((p) => ({
          sku: p.sku,
          name: p.name,
          baseCost: p.baseCost,
          suggestedRetail: p.suggestedRetail,
          nicheMatchScore: p.nicheMatchScore,
        })),
      });

      if (!revenueResult.success) {
        return res.status(500).json({ success: false, error: 'Failed to estimate revenue' });
      }

      // Step 4: Suggest bundles from top products
      const topProducts = fitResult.data.scoredProducts
        .slice(0, 10)
        .map((p) => {
          const est = revenueResult.data.estimates.find((e) => e.sku === p.sku);
          return {
            sku: p.sku,
            name: p.name,
            category: p.category,
            suggestedRetail: p.suggestedRetail,
            nicheMatchScore: p.nicheMatchScore,
            monthlyRevenueConservative: est?.tiers.find((t) => t.label === 'conservative')?.monthlyRevenue || 0,
            monthlyRevenueModerate: est?.tiers.find((t) => t.label === 'moderate')?.monthlyRevenue || 0,
            monthlyRevenueAggressive: est?.tiers.find((t) => t.label === 'aggressive')?.monthlyRevenue || 0,
          };
        });

      const bundleResult = await suggestBundles.execute({
        niche: dossier.niche,
        topProducts,
        discountPercent: 15,
      });

      // Step 5: Synthesize into final result
      const scoredWithRevenue = fitResult.data.scoredProducts.map((p) => {
        const catalogProduct = products.find((cp) => cp.sku === p.sku);
        const est = revenueResult.data.estimates.find((e) => e.sku === p.sku);
        return {
          sku: p.sku,
          name: p.name,
          category: p.category,
          subcategory: p.subcategory,
          imageUrl: catalogProduct?.imageUrl || null,
          baseCost: p.baseCost,
          suggestedRetail: p.suggestedRetail,
          nicheMatchScore: p.nicheMatchScore,
          audienceFitScore: p.audienceFitScore,
          marginPercent: p.marginPercent,
          revenue: {
            conversionRate: est?.conversionRate || 0,
            tiers: est?.tiers || [],
          },
          reasoning: `Based on your ${dossier.niche} niche and audience profile, ${p.name} has a ${Math.round(p.nicheMatchScore * 100)}% niche match. This product aligns well with your audience's interests and fits within their spending patterns.`,
        };
      });

      const synthesized = await synthesizeRecommendations.execute({
        brandId,
        userId,
        niche: dossier.niche,
        audienceSize: dossier.audienceSize,
        scoredProducts: scoredWithRevenue,
        bundles: bundleResult.data?.bundles || [],
      });

      if (!synthesized.success) {
        return res.status(500).json({ success: false, error: 'Failed to synthesize recommendations' });
      }

      res.json({ success: true, data: synthesized.data });
    } catch (err) {
      logger.error({ msg: 'Recommendation generation failed', error: err.message });
      next(err);
    }
  }
);

// ---- GET /api/v1/products/recommendations/:brandId ----
// Fetch cached recommendations for a brand.

recommendationsRouter.get(
  '/:brandId',
  validate({ params: getRecommendationsParams }),
  async (req, res, next) => {
    try {
      const { brandId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { data, error } = await supabaseAdmin
        .from('brand_recommendations')
        .select('*')
        .eq('brand_id', brandId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return res.status(404).json({
          success: false,
          error: 'No recommendations found. Generate recommendations first.',
        });
      }

      res.json({
        success: true,
        data: {
          brandId: data.brand_id,
          recommendations: data.recommendations,
          bundles: data.bundles,
          summary: data.summary,
          updatedAt: data.updated_at,
        },
      });
    } catch (err) {
      logger.error({ msg: 'Failed to fetch recommendations', error: err.message });
      next(err);
    }
  }
);
