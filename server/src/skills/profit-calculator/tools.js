// server/src/skills/profit-calculator/tools.js

import { z } from 'zod';
import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';

// ── Tool Definitions ────────────────────────────────────────────────

export const tools = {
  getProductPricing: {
    name: 'getProductPricing',
    description: 'Fetch product pricing data (base cost and retail price) from the products table by SKU.',
    inputSchema: z.object({
      skus: z
        .array(z.string())
        .min(1)
        .max(20)
        .describe('Array of product SKUs to look up (1-20)'),
    }),

    /** @param {{ skus: string[] }} input */
    async execute({ skus }) {
      logger.info({ msg: 'Fetching product pricing', skuCount: skus.length });

      const { data, error } = await supabaseAdmin
        .from('products')
        .select('sku, name, base_cost, retail_price, category')
        .in('sku', skus);

      if (error) {
        return { success: false, error: `Failed to fetch product pricing: ${error.message}` };
      }

      if (!data || data.length === 0) {
        return { success: false, error: `No products found for SKUs: ${skus.join(', ')}` };
      }

      // Map to camelCase for consistency
      const products = data.map((p) => ({
        sku: p.sku,
        name: p.name,
        baseCost: parseFloat(p.base_cost) || 0,
        retailPrice: parseFloat(p.retail_price) || 0,
        category: p.category,
      }));

      // Report any SKUs that were not found
      const foundSkus = new Set(products.map((p) => p.sku));
      const missingSkus = skus.filter((s) => !foundSkus.has(s));

      return {
        success: true,
        data: {
          products,
          found: products.length,
          requested: skus.length,
          missingSkus: missingSkus.length > 0 ? missingSkus : undefined,
        },
      };
    },
  },

  calculateMargins: {
    name: 'calculateMargins',
    description: 'Calculate profit and margin percentage for each product. Pure computation -- no external API calls.',
    inputSchema: z.object({
      products: z
        .array(
          z.object({
            sku: z.string().describe('Product SKU'),
            baseCost: z.number().min(0).describe('Base cost per unit in USD'),
            retailPrice: z.number().min(0).describe('Retail price per unit in USD'),
          })
        )
        .min(1)
        .describe('Array of products with cost and price data'),
    }),

    /** @param {{ products: Array<{ sku: string, baseCost: number, retailPrice: number }> }} input */
    async execute({ products }) {
      logger.info({ msg: 'Calculating margins', productCount: products.length });

      const results = products.map((product) => {
        const profit = Math.round((product.retailPrice - product.baseCost) * 100) / 100;
        const marginPercent = product.retailPrice > 0
          ? Math.round(((product.retailPrice - product.baseCost) / product.retailPrice) * 10000) / 100
          : 0;

        return {
          sku: product.sku,
          baseCost: product.baseCost,
          retailPrice: product.retailPrice,
          profit,
          marginPercent,
          isHealthy: marginPercent >= 40, // 40%+ margin is healthy for branded products
        };
      });

      // Sort by margin descending for easy analysis
      const sortedByMargin = [...results].sort((a, b) => b.marginPercent - a.marginPercent);

      const averageMargin = results.length > 0
        ? Math.round((results.reduce((sum, r) => sum + r.marginPercent, 0) / results.length) * 100) / 100
        : 0;

      return {
        success: true,
        data: {
          margins: results,
          sortedByMargin,
          averageMargin,
          healthyCount: results.filter((r) => r.isHealthy).length,
          totalProducts: results.length,
        },
      };
    },
  },

  projectRevenue: {
    name: 'projectRevenue',
    description: 'Project monthly and annual revenue/profit at three sales volume tiers. Pure computation -- no external API calls.',
    inputSchema: z.object({
      products: z
        .array(
          z.object({
            sku: z.string().describe('Product SKU'),
            retailPrice: z.number().min(0).describe('Retail price per unit in USD'),
            profit: z.number().describe('Profit per unit in USD'),
          })
        )
        .min(1)
        .describe('Array of products with pricing and profit data'),
      tiers: z
        .object({
          low: z.number().int().min(1).default(10).describe('Conservative units per product per month'),
          mid: z.number().int().min(1).default(50).describe('Moderate units per product per month'),
          high: z.number().int().min(1).default(200).describe('Aggressive units per product per month'),
        })
        .optional()
        .describe('Custom sales volume tiers (optional, defaults: low=10, mid=50, high=200)'),
    }),

    /** @param {{ products: Array<{ sku: string, retailPrice: number, profit: number }>, tiers?: { low: number, mid: number, high: number } }} input */
    async execute({ products, tiers }) {
      const volumeTiers = {
        low: tiers?.low ?? 10,
        mid: tiers?.mid ?? 50,
        high: tiers?.high ?? 200,
      };

      const returnRate = 0.05; // 5% estimated return rate

      logger.info({
        msg: 'Projecting revenue',
        productCount: products.length,
        tiers: volumeTiers,
      });

      /**
       * Calculate projections for a given units-per-product-per-month
       * @param {number} unitsPerProduct
       */
      const calculateTier = (unitsPerProduct) => {
        let monthlyRevenue = 0;
        let monthlyProfit = 0;
        const perProduct = [];

        for (const product of products) {
          const effectiveUnits = Math.round(unitsPerProduct * (1 - returnRate));
          const productRevenue = Math.round(product.retailPrice * effectiveUnits * 100) / 100;
          const productProfit = Math.round(product.profit * effectiveUnits * 100) / 100;

          monthlyRevenue += productRevenue;
          monthlyProfit += productProfit;

          perProduct.push({
            sku: product.sku,
            unitsPerMonth: effectiveUnits,
            monthlyRevenue: productRevenue,
            monthlyProfit: productProfit,
          });
        }

        return {
          unitsPerProductPerMonth: unitsPerProduct,
          effectiveUnitsAfterReturns: Math.round(unitsPerProduct * (1 - returnRate)),
          monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
          monthlyProfit: Math.round(monthlyProfit * 100) / 100,
          annualRevenue: Math.round(monthlyRevenue * 12 * 100) / 100,
          annualProfit: Math.round(monthlyProfit * 12 * 100) / 100,
          perProduct,
        };
      };

      const projections = {
        conservative: calculateTier(volumeTiers.low),
        moderate: calculateTier(volumeTiers.mid),
        aggressive: calculateTier(volumeTiers.high),
      };

      return {
        success: true,
        data: {
          projections,
          assumptions: {
            returnRate,
            returnRatePercent: returnRate * 100,
            tiers: volumeTiers,
            productCount: products.length,
          },
        },
      };
    },
  },
};
