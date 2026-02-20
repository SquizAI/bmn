// server/src/skills/product-recommender/tools/suggest-bundles.js

import { z } from 'zod';
import { logger } from '../../../lib/logger.js';
import { randomUUID } from 'node:crypto';

/**
 * Predefined bundle templates keyed by niche.
 * Each template defines a name pattern, required categories, and optional subcategory hints.
 */
const BUNDLE_TEMPLATES = {
  fitness: [
    { name: 'Performance Stack', categories: ['supplements', 'supplements', 'apparel'], description: 'Everything you need for peak performance' },
    { name: 'Morning Starter Pack', categories: ['supplements', 'coffee-tea', 'journals'], description: 'Start your day with intention and energy' },
    { name: 'Recovery Bundle', categories: ['supplements', 'supplements', 'accessories'], description: 'Recover faster, train harder' },
    { name: 'Wellness Essentials', categories: ['supplements', 'skincare', 'journals'], description: 'Holistic wellness from inside out' },
  ],
  beauty: [
    { name: 'Glow Up Kit', categories: ['skincare', 'skincare', 'accessories'], description: 'Your complete glow-up routine' },
    { name: 'Self-Care Bundle', categories: ['skincare', 'home-goods', 'journals'], description: 'Treat yourself to the ultimate self-care experience' },
    { name: 'Beauty Essentials', categories: ['skincare', 'accessories', 'apparel'], description: 'Daily beauty must-haves' },
  ],
  wellness: [
    { name: 'Wellness Essentials', categories: ['supplements', 'skincare', 'journals'], description: 'Foundation for daily wellness' },
    { name: 'Mind & Body Bundle', categories: ['supplements', 'journals', 'coffee-tea'], description: 'Nourish your mind and body' },
    { name: 'Morning Ritual Kit', categories: ['supplements', 'coffee-tea', 'journals'], description: 'A mindful morning routine in a box' },
  ],
  lifestyle: [
    { name: 'Everyday Essentials', categories: ['accessories', 'home-goods', 'coffee-tea'], description: 'Curated essentials for everyday living' },
    { name: 'Creator Kit', categories: ['accessories', 'apparel', 'digital'], description: 'Everything a modern creator needs' },
    { name: 'Cozy Bundle', categories: ['home-goods', 'coffee-tea', 'apparel'], description: 'The ultimate cozy experience' },
  ],
};

const DEFAULT_TEMPLATES = [
  { name: 'Starter Bundle', categories: ['accessories', 'apparel'], description: 'Start your brand journey with the essentials' },
  { name: 'Essential Collection', categories: ['accessories', 'home-goods', 'apparel'], description: 'A curated collection of branded essentials' },
];

export const suggestBundles = {
  name: 'suggestBundles',
  description: 'Suggest 2-4 smart product bundles based on the creator\'s niche and top-recommended products. Bundles offer 10-20% discount vs individual purchase and show estimated bundle revenue.',
  inputSchema: z.object({
    niche: z.string().describe('Creator\'s niche'),
    topProducts: z.array(z.object({
      sku: z.string(),
      name: z.string(),
      category: z.string(),
      suggestedRetail: z.number(),
      nicheMatchScore: z.number(),
      monthlyRevenueConservative: z.number(),
      monthlyRevenueModerate: z.number(),
      monthlyRevenueAggressive: z.number(),
    })).min(2).describe('Top recommended products to build bundles from'),
    discountPercent: z.number().min(5).max(30).default(15).describe('Bundle discount percentage (default 15%)'),
  }),

  /**
   * @param {Object} input
   * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
   */
  async execute({ niche, topProducts, discountPercent = 15 }) {
    logger.info({ msg: 'Suggesting bundles', niche, productCount: topProducts.length, discountPercent });

    const normalizedNiche = niche.toLowerCase().trim();
    const templates = BUNDLE_TEMPLATES[normalizedNiche] || DEFAULT_TEMPLATES;

    // Index products by category for matching
    /** @type {Record<string, typeof topProducts>} */
    const byCategory = {};
    for (const p of topProducts) {
      const cat = p.category.toLowerCase();
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(p);
    }

    const bundles = [];

    for (const template of templates) {
      if (bundles.length >= 4) break;

      // Try to fill each category slot from available products
      /** @type {typeof topProducts} */
      const bundleProducts = [];
      const usedSkus = new Set();

      for (const requiredCategory of template.categories) {
        const available = (byCategory[requiredCategory] || []).filter(
          (p) => !usedSkus.has(p.sku)
        );

        if (available.length > 0) {
          // Pick the best-scoring available product
          const pick = available.sort((a, b) => b.nicheMatchScore - a.nicheMatchScore)[0];
          bundleProducts.push(pick);
          usedSkus.add(pick.sku);
        }
      }

      // Only create bundle if we matched at least 2 products
      if (bundleProducts.length < 2) continue;

      const individualTotal = bundleProducts.reduce((sum, p) => sum + p.suggestedRetail, 0);
      const bundlePrice = Math.round(individualTotal * (1 - discountPercent / 100) * 100) / 100;

      // Revenue estimate for the bundle (based on component revenue, scaled by bundle attractiveness)
      const bundleMultiplier = 0.7; // bundles sell ~70% of best individual product volume
      const conservativeRev = Math.round(
        bundleProducts.reduce((s, p) => s + p.monthlyRevenueConservative, 0) * bundleMultiplier * 100
      ) / 100;
      const moderateRev = Math.round(
        bundleProducts.reduce((s, p) => s + p.monthlyRevenueModerate, 0) * bundleMultiplier * 100
      ) / 100;
      const aggressiveRev = Math.round(
        bundleProducts.reduce((s, p) => s + p.monthlyRevenueAggressive, 0) * bundleMultiplier * 100
      ) / 100;

      bundles.push({
        id: randomUUID(),
        name: template.name,
        description: template.description,
        productSkus: bundleProducts.map((p) => p.sku),
        products: bundleProducts.map((p) => ({ sku: p.sku, name: p.name })),
        individualTotal: Math.round(individualTotal * 100) / 100,
        bundlePrice,
        discountPercent,
        savingsAmount: Math.round((individualTotal - bundlePrice) * 100) / 100,
        estimatedMonthlyRevenue: {
          conservative: conservativeRev,
          moderate: moderateRev,
          aggressive: aggressiveRev,
        },
        reasoning: `${template.description}. Combines ${bundleProducts.map((p) => p.name).join(', ')} at a ${discountPercent}% bundle discount for higher perceived value and increased average order value.`,
      });
    }

    return {
      success: true,
      data: {
        bundles,
        totalBundles: bundles.length,
        averageDiscount: discountPercent,
      },
    };
  },
};
