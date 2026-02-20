// server/src/routes/api/v1/dashboard/brand-evolution.js

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../../../middleware/validate.js';
import { supabaseAdmin } from '../../../../lib/supabase.js';
import { logger } from '../../../../lib/logger.js';

export const brandEvolutionRoutes = Router();

const brandEvolutionQuerySchema = z.object({
  brandId: z.string().uuid().optional(),
});

/**
 * Determines the current season based on the month.
 * @param {Date} date
 * @returns {{ season: string, suggestion: string }}
 */
function getSeasonalTip(date) {
  const month = date.getMonth(); // 0-based

  if (month >= 2 && month <= 4) {
    return {
      season: 'Spring',
      suggestion:
        'Fresh greens and pastels are trending. Consider a seasonal product line with lighter colors and nature-inspired themes.',
    };
  }
  if (month >= 5 && month <= 7) {
    return {
      season: 'Summer',
      suggestion:
        'Bold, vibrant colors perform well in summer. Think about limited-edition items with tropical or beach aesthetics.',
    };
  }
  if (month >= 8 && month <= 10) {
    return {
      season: 'Fall',
      suggestion:
        'Warm tones like amber, burgundy, and olive are in season. Consider cozy product bundles and autumn-themed designs.',
    };
  }
  return {
    season: 'Winter',
    suggestion:
      'Rich jewel tones and metallic accents resonate in winter. Holiday gift bundles and premium packaging can boost AOV.',
  };
}

/**
 * Generates evolution suggestions based on brand maturity.
 * @param {number} ageMonths
 * @param {{ productCount: number, hasMultipleCategories: boolean, archetype: string | null }} context
 * @returns {Array<{type: string, title: string, description: string, priority: string, actionLabel: string}>}
 */
function generateSuggestions(ageMonths, context) {
  /** @type {Array<{type: string, title: string, description: string, priority: string, actionLabel: string}>} */
  const suggestions = [];

  if (ageMonths < 3) {
    // Launch phase
    suggestions.push({
      type: 'optimize',
      title: 'Build Brand Consistency',
      description:
        'Use your brand colors, voice, and archetype in every social media post and product listing. Consistency builds recognition.',
      priority: 'high',
      actionLabel: 'View Brand Guide',
    });
    suggestions.push({
      type: 'optimize',
      title: 'Complete Your Product Line',
      description:
        context.productCount < 5
          ? `You have ${context.productCount} products. Aim for at least 5 to give customers options.`
          : 'Your initial catalog looks good. Focus on getting your first 10 sales.',
      priority: context.productCount < 5 ? 'high' : 'medium',
      actionLabel: 'Add Products',
    });
    suggestions.push({
      type: 'expand',
      title: 'Share Your Brand Story',
      description:
        'Customers connect with stories. Post behind-the-scenes content about why you started your brand.',
      priority: 'medium',
      actionLabel: 'Generate Content',
    });
  } else if (ageMonths < 6) {
    // Growth phase
    suggestions.push({
      type: 'expand',
      title: 'Expand Your Catalog',
      description:
        'Your brand is gaining traction. Consider adding 2-3 complementary products to increase average order value.',
      priority: 'high',
      actionLabel: 'Browse Products',
    });
    if (!context.hasMultipleCategories) {
      suggestions.push({
        type: 'expand',
        title: 'Diversify Categories',
        description:
          'All your products are in one category. Adding a second category can attract new customer segments.',
        priority: 'medium',
        actionLabel: 'Explore Categories',
      });
    }
    suggestions.push({
      type: 'optimize',
      title: 'Launch a Bundle',
      description:
        'Product bundles increase perceived value. Create a starter kit or best-seller bundle.',
      priority: 'medium',
      actionLabel: 'Create Bundle',
    });
    suggestions.push({
      type: 'expand',
      title: 'Start A/B Testing Prices',
      description:
        'You have enough traffic to start testing. Try A/B testing your top product at different price points.',
      priority: 'low',
      actionLabel: 'Start A/B Test',
    });
  } else {
    // Established phase (6+ months)
    suggestions.push({
      type: 'refresh',
      title: 'Consider a Seasonal Refresh',
      description:
        'Brands that evolve stay relevant. Update your palette accents, add seasonal products, or refresh your tagline.',
      priority: 'high',
      actionLabel: 'Refresh Brand',
    });
    suggestions.push({
      type: 'expand',
      title: 'Launch a Premium Tier',
      description:
        'Your brand has credibility now. Introduce a premium product line at higher price points.',
      priority: 'medium',
      actionLabel: 'Create Premium Line',
    });
    suggestions.push({
      type: 'optimize',
      title: 'Analyze Competitor Positioning',
      description:
        'Run a competitive analysis to identify gaps in the market you can fill with your brand identity.',
      priority: 'medium',
      actionLabel: 'Run Analysis',
    });
    suggestions.push({
      type: 'refresh',
      title: 'Refresh Your Social Content Strategy',
      description:
        'After 6+ months, your audience may need fresh content formats. Try short-form video or behind-the-scenes content.',
      priority: 'low',
      actionLabel: 'Content Ideas',
    });
  }

  return suggestions;
}

/**
 * GET /api/v1/dashboard/brand-evolution
 * Analyzes brand age, market trends, and audience changes to suggest brand refreshes.
 */
brandEvolutionRoutes.get(
  '/',
  validate({ query: brandEvolutionQuerySchema }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { brandId } = req.query;

      // Fetch the target brand (specific or first)
      let brand = null;
      if (brandId) {
        const { data } = await supabaseAdmin
          .from('brands')
          .select('id, name, created_at, identity, archetype')
          .eq('id', brandId)
          .eq('user_id', userId)
          .is('deleted_at', null)
          .single();
        brand = data;
      } else {
        const { data } = await supabaseAdmin
          .from('brands')
          .select('id, name, created_at, identity, archetype')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1);
        brand = data?.[0] || null;
      }

      if (!brand) {
        return res.json({
          success: true,
          data: {
            brandAge: { months: 0, label: 'No brand yet' },
            maturityStage: 'launch',
            suggestions: [
              {
                type: 'expand',
                title: 'Create Your First Brand',
                description: 'Start the brand wizard to generate your brand identity, products, and strategy.',
                priority: 'high',
                actionLabel: 'Start Wizard',
              },
            ],
            seasonalTip: getSeasonalTip(new Date()),
          },
        });
      }

      // Calculate brand age
      const createdAt = new Date(brand.created_at);
      const now = new Date();
      const ageMs = now.getTime() - createdAt.getTime();
      const ageMonths = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 30.44));
      const ageLabel =
        ageMonths === 0
          ? 'Less than a month'
          : ageMonths === 1
            ? '1 month old'
            : `${ageMonths} months old`;

      // Determine maturity stage
      let maturityStage = 'launch';
      if (ageMonths >= 6) {
        maturityStage = 'established';
      } else if (ageMonths >= 3) {
        maturityStage = 'growth';
      }

      // Fetch product count and category diversity
      let productCount = 0;
      let hasMultipleCategories = false;
      try {
        const { data: products } = await supabaseAdmin
          .from('products')
          .select('id, category')
          .eq('brand_id', brand.id)
          .is('deleted_at', null);

        if (products) {
          productCount = products.length;
          const categories = new Set(products.map((p) => p.category).filter(Boolean));
          hasMultipleCategories = categories.size > 1;
        }
      } catch {
        logger.warn('products table query failed in brand-evolution');
      }

      const archetype = brand.archetype || brand.identity?.archetype || null;

      const suggestions = generateSuggestions(ageMonths, {
        productCount,
        hasMultipleCategories,
        archetype,
      });

      const seasonalTip = getSeasonalTip(now);

      res.json({
        success: true,
        data: {
          brandAge: { months: ageMonths, label: ageLabel },
          maturityStage,
          suggestions,
          seasonalTip,
        },
      });
    } catch (err) {
      logger.error({ err, userId: req.user?.id }, 'Brand evolution failed');
      next(err);
    }
  }
);
