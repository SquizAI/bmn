// server/src/agents/tools/search-products.js

import { z } from 'zod';
import { supabaseAdmin } from '../../lib/supabase.js';

/** @type {import('@anthropic-ai/claude-agent-sdk').ToolDefinition} */
export const searchProducts = {
  name: 'searchProducts',
  description:
    'Search the product catalog by category, keyword, or retrieve all active products. Returns products with pricing and mockup template info.',
  inputSchema: z.object({
    category: z
      .enum(['apparel', 'accessories', 'home_goods', 'packaging', 'digital'])
      .optional()
      .describe('Filter by product category'),
    keyword: z.string().optional().describe('Full-text search keyword'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe('Max results to return'),
  }),
  execute: async ({ category, keyword, limit }) => {
    let query = supabaseAdmin
      .from('products')
      .select(
        'id, sku, name, category, base_cost, retail_price, image_url, mockup_template_url, metadata'
      )
      .eq('is_active', true)
      .limit(limit);

    if (category) {
      query = query.eq('category', category);
    }
    if (keyword) {
      query = query.textSearch('name', keyword);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Product search failed: ${error.message}`);
    return { products: data, count: data.length };
  },
};
