// server/src/skills/product-recommender/tools/get-product-catalog.js

import { z } from 'zod';
import { supabaseAdmin } from '../../../lib/supabase.js';
import { logger } from '../../../lib/logger.js';

export const getProductCatalog = {
  name: 'getProductCatalog',
  description: 'Fetch the full active product catalog with categories, pricing, and metadata. Returns all available products for recommendation scoring.',
  inputSchema: z.object({
    categories: z
      .array(z.string())
      .optional()
      .describe('Optional filter by specific categories. Omit to fetch all.'),
  }),

  /**
   * @param {{ categories?: string[] }} input
   * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
   */
  async execute({ categories }) {
    logger.info({ msg: 'Fetching product catalog', categories });

    try {
      let query = supabaseAdmin
        .from('products')
        .select('id, sku, name, category, subcategory, description, base_cost, retail_price, shipping_cost, image_url, mockup_template_url, ingredients, materials, certifications')
        .eq('is_active', true)
        .order('category')
        .order('name');

      if (categories && categories.length > 0) {
        query = query.in('category', categories);
      }

      const { data, error } = await query;

      if (error) {
        return { success: false, error: `Failed to fetch product catalog: ${error.message}` };
      }

      const products = (data || []).map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        subcategory: p.subcategory || null,
        description: p.description,
        baseCost: parseFloat(p.base_cost) || 0,
        suggestedRetail: parseFloat(p.retail_price) || 0,
        shippingCost: parseFloat(p.shipping_cost) || 0,
        imageUrl: p.image_url || null,
        mockupTemplateUrl: p.mockup_template_url || null,
        ingredients: p.ingredients || null,
        materials: p.materials || null,
        certifications: p.certifications || [],
      }));

      // Group by category for easier analysis
      /** @type {Record<string, typeof products>} */
      const byCategory = {};
      for (const product of products) {
        if (!byCategory[product.category]) {
          byCategory[product.category] = [];
        }
        byCategory[product.category].push(product);
      }

      return {
        success: true,
        data: {
          products,
          totalCount: products.length,
          categories: Object.keys(byCategory),
          byCategory,
        },
      };
    } catch (err) {
      logger.error({ msg: 'Product catalog fetch failed', error: err.message });
      return { success: false, error: `Product catalog fetch failed: ${err.message}` };
    }
  },
};
