// server/src/skills/product-recommender/tools/generate-product-reasoning.js

import { z } from 'zod';
import { logger } from '../../../lib/logger.js';
import { routeModel } from '../../_shared/model-router.js';

export const generateProductReasoning = {
  name: 'generateProductReasoning',
  description: 'Use Claude AI to generate a personalized "Why this product fits" explanation for each recommended product. Takes scored products with niche/audience context and returns human-readable reasoning per product.',
  inputSchema: z.object({
    niche: z.string().describe('Creator niche'),
    brandArchetype: z.string().describe('Selected brand archetype'),
    audienceDescription: z.string().describe('Brief audience description (e.g., "25-34 year old women interested in fitness and wellness")'),
    products: z.array(z.object({
      sku: z.string(),
      name: z.string(),
      category: z.string(),
      subcategory: z.string().nullable(),
      nicheMatchScore: z.number(),
      audienceFitScore: z.number(),
      marginPercent: z.number(),
    })).min(1).max(20).describe('Top products to generate reasoning for (max 20)'),
  }),

  /**
   * @param {Object} input
   * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
   */
  async execute({ niche, brandArchetype, audienceDescription, products }) {
    logger.info({
      msg: 'Generating AI product reasoning',
      niche,
      productCount: products.length,
    });

    const productList = products
      .map((p, i) => `${i + 1}. ${p.name} (${p.category}${p.subcategory ? '/' + p.subcategory : ''}) - niche fit: ${p.nicheMatchScore}, audience fit: ${p.audienceFitScore}, margin: ${p.marginPercent}%`)
      .join('\n');

    const prompt = `You are a product strategist. For each product below, write a 2-3 sentence explanation of WHY it's a good fit for this creator's branded product line. Be specific -- reference the creator's niche, audience, and brand personality.

<creator_context>
Niche: ${niche}
Brand Archetype: ${brandArchetype}
Audience: ${audienceDescription}
</creator_context>

<products>
${productList}
</products>

Return ONLY a valid JSON object:
{
  "reasoning": {
    "SKU_1": "2-3 sentence reasoning for product 1",
    "SKU_2": "2-3 sentence reasoning for product 2"
  }
}

Use the actual product SKU values as keys. Each reasoning should:
- Explain why THIS product fits THIS creator's niche
- Reference the target audience
- Be written in a confident, consultative tone
- Be 2-3 sentences max`;

    try {
      const result = await routeModel('extraction', {
        prompt,
        systemPrompt: 'You are a product strategy expert. Always respond with valid JSON only.',
        maxTokens: 4096,
        temperature: 0.6,
        jsonMode: true,
      });

      let parsed;
      try {
        parsed = JSON.parse(result.text);
      } catch {
        const match = result.text.match(/\{[\s\S]*\}/);
        if (!match) {
          return { success: false, error: 'AI returned non-JSON response for product reasoning.' };
        }
        parsed = JSON.parse(match[0]);
      }

      const reasoning = parsed.reasoning || {};

      logger.info({
        msg: 'Product reasoning generated',
        model: result.model,
        provider: result.provider,
        reasoningCount: Object.keys(reasoning).length,
      });

      return {
        success: true,
        data: {
          reasoning,
          model: result.model,
          provider: result.provider,
        },
      };
    } catch (err) {
      logger.error({ msg: 'Product reasoning generation failed', error: err.message });

      // Fallback: generate simple template-based reasoning
      const fallbackReasoning = {};
      for (const product of products) {
        fallbackReasoning[product.sku] = `As a ${niche} creator with the ${brandArchetype} archetype, ${product.name} aligns well with your audience's interests. With a ${Math.round(product.nicheMatchScore * 100)}% niche match score, this ${product.category} product offers strong potential for your branded product line.`;
      }

      return {
        success: true,
        data: {
          reasoning: fallbackReasoning,
          model: 'template-fallback',
          provider: 'none',
        },
      };
    }
  },
};
