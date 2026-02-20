// server/src/skills/product-recommender/tools/analyze-niche-product-fit.js

import { z } from 'zod';
import { logger } from '../../../lib/logger.js';

/**
 * Niche-to-category relevance mapping.
 * Scores range from 0.0 (no fit) to 1.0 (perfect fit).
 * Niches not listed default to a baseline score.
 */
const NICHE_CATEGORY_AFFINITY = {
  fitness: {
    supplements: 0.95,
    apparel: 0.90,
    accessories: 0.70,
    'home-goods': 0.30,
    skincare: 0.50,
    digital: 0.80,
    journals: 0.65,
    'coffee-tea': 0.55,
  },
  beauty: {
    supplements: 0.50,
    apparel: 0.55,
    accessories: 0.80,
    'home-goods': 0.45,
    skincare: 0.95,
    digital: 0.70,
    journals: 0.50,
    'coffee-tea': 0.40,
  },
  wellness: {
    supplements: 0.90,
    apparel: 0.55,
    accessories: 0.60,
    'home-goods': 0.70,
    skincare: 0.75,
    digital: 0.80,
    journals: 0.85,
    'coffee-tea': 0.80,
  },
  lifestyle: {
    supplements: 0.50,
    apparel: 0.75,
    accessories: 0.80,
    'home-goods': 0.80,
    skincare: 0.60,
    digital: 0.70,
    journals: 0.70,
    'coffee-tea': 0.75,
  },
  food: {
    supplements: 0.60,
    apparel: 0.50,
    accessories: 0.55,
    'home-goods': 0.75,
    skincare: 0.30,
    digital: 0.65,
    journals: 0.55,
    'coffee-tea': 0.90,
  },
  fashion: {
    supplements: 0.25,
    apparel: 0.95,
    accessories: 0.90,
    'home-goods': 0.50,
    skincare: 0.55,
    digital: 0.60,
    journals: 0.40,
    'coffee-tea': 0.35,
  },
  tech: {
    supplements: 0.20,
    apparel: 0.60,
    accessories: 0.85,
    'home-goods': 0.40,
    skincare: 0.15,
    digital: 0.90,
    journals: 0.45,
    'coffee-tea': 0.50,
  },
  gaming: {
    supplements: 0.40,
    apparel: 0.70,
    accessories: 0.80,
    'home-goods': 0.35,
    skincare: 0.20,
    digital: 0.85,
    journals: 0.30,
    'coffee-tea': 0.55,
  },
  travel: {
    supplements: 0.40,
    apparel: 0.65,
    accessories: 0.85,
    'home-goods': 0.50,
    skincare: 0.55,
    digital: 0.75,
    journals: 0.80,
    'coffee-tea': 0.70,
  },
  business: {
    supplements: 0.35,
    apparel: 0.55,
    accessories: 0.60,
    'home-goods': 0.45,
    skincare: 0.30,
    digital: 0.90,
    journals: 0.85,
    'coffee-tea': 0.70,
  },
  parenting: {
    supplements: 0.55,
    apparel: 0.60,
    accessories: 0.65,
    'home-goods': 0.85,
    skincare: 0.60,
    digital: 0.70,
    journals: 0.80,
    'coffee-tea': 0.55,
  },
  pets: {
    supplements: 0.30,
    apparel: 0.55,
    accessories: 0.75,
    'home-goods': 0.60,
    skincare: 0.20,
    digital: 0.50,
    journals: 0.40,
    'coffee-tea': 0.35,
  },
};

const DEFAULT_BASELINE = 0.40;

/**
 * Audience demographic factors that modify product fit scores.
 */
const AUDIENCE_MODIFIERS = {
  'budget': 0.85,
  'mid-range': 1.0,
  'premium': 1.10,
  'luxury': 1.15,
};

export const analyzeNicheProductFit = {
  name: 'analyzeNicheProductFit',
  description: 'Score how well each product category and individual product aligns with the creator\'s niche, audience demographics, and brand personality. Returns nicheMatchScore and audienceFitScore per product.',
  inputSchema: z.object({
    niche: z.string().describe('Creator\'s detected niche (e.g., "fitness", "beauty", "lifestyle")'),
    audienceDemographics: z.object({
      estimatedAgeRange: z.string().nullable(),
      estimatedGender: z.string().nullable(),
      interests: z.array(z.string()),
      incomeLevel: z.enum(['budget', 'mid-range', 'premium', 'luxury']).nullable(),
    }).describe('Audience demographic data from Creator Dossier'),
    brandPersonality: z.object({
      archetype: z.string(),
      traits: z.array(z.string()),
      values: z.array(z.string()),
    }).describe('Brand personality data'),
    themes: z.array(z.object({
      name: z.string(),
      frequency: z.number(),
    })).describe('Content themes with frequency'),
    products: z.array(z.object({
      sku: z.string(),
      name: z.string(),
      category: z.string(),
      subcategory: z.string().nullable(),
      baseCost: z.number(),
      suggestedRetail: z.number(),
    })).describe('Products to score'),
  }),

  /**
   * @param {Object} input
   * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
   */
  async execute({ niche, audienceDemographics, brandPersonality, themes, products }) {
    logger.info({ msg: 'Analyzing niche-product fit', niche, productCount: products.length });

    const normalizedNiche = niche.toLowerCase().trim();
    const nicheMap = NICHE_CATEGORY_AFFINITY[normalizedNiche] || null;
    const incomeModifier = AUDIENCE_MODIFIERS[audienceDemographics.incomeLevel] || 1.0;

    // Build theme keyword set for bonus matching
    const themeKeywords = new Set(
      themes.flatMap((t) => t.name.toLowerCase().split(/\s+/))
    );

    const scored = products.map((product) => {
      const category = product.category.toLowerCase();

      // Base niche match from the affinity table
      let nicheMatchScore = nicheMap?.[category] ?? DEFAULT_BASELINE;

      // Bonus for theme keyword matches in product name/subcategory
      const productWords = [product.name, product.subcategory || '']
        .join(' ')
        .toLowerCase()
        .split(/\s+/);
      const themeOverlap = productWords.filter((w) => themeKeywords.has(w)).length;
      if (themeOverlap > 0) {
        nicheMatchScore = Math.min(1.0, nicheMatchScore + themeOverlap * 0.05);
      }

      // Audience fit considers demographics + income alignment
      let audienceFitScore = 0.5; // baseline

      // Higher income audiences -> higher-priced products fit better
      if (product.suggestedRetail > 50 && incomeModifier > 1.0) {
        audienceFitScore += 0.15;
      } else if (product.suggestedRetail <= 25 && incomeModifier < 1.0) {
        audienceFitScore += 0.10;
      }

      // Interest alignment
      const interests = audienceDemographics.interests.map((i) => i.toLowerCase());
      const categoryMatchesInterest = interests.some(
        (interest) =>
          interest.includes(category) ||
          category.includes(interest) ||
          product.name.toLowerCase().includes(interest)
      );
      if (categoryMatchesInterest) {
        audienceFitScore += 0.20;
      }

      // Brand personality alignment
      const personalityKeywords = [
        ...brandPersonality.traits,
        ...brandPersonality.values,
      ].map((v) => v.toLowerCase());

      const personalityMatch = personalityKeywords.some(
        (kw) =>
          product.name.toLowerCase().includes(kw) ||
          (product.subcategory || '').toLowerCase().includes(kw)
      );
      if (personalityMatch) {
        audienceFitScore += 0.10;
      }

      // Clamp scores
      nicheMatchScore = Math.round(Math.min(1.0, Math.max(0.0, nicheMatchScore)) * 100) / 100;
      audienceFitScore = Math.round(Math.min(1.0, Math.max(0.0, audienceFitScore)) * 100) / 100;

      // Calculate margin
      const marginPercent = product.suggestedRetail > 0
        ? Math.round(((product.suggestedRetail - product.baseCost) / product.suggestedRetail) * 10000) / 100
        : 0;

      return {
        sku: product.sku,
        name: product.name,
        category: product.category,
        subcategory: product.subcategory,
        nicheMatchScore,
        audienceFitScore,
        marginPercent,
        baseCost: product.baseCost,
        suggestedRetail: product.suggestedRetail,
      };
    });

    // Sort by nicheMatchScore descending
    scored.sort((a, b) => b.nicheMatchScore - a.nicheMatchScore);

    return {
      success: true,
      data: {
        niche: normalizedNiche,
        scoredProducts: scored,
        totalScored: scored.length,
        topCategory: scored.length > 0 ? scored[0].category : null,
      },
    };
  },
};
