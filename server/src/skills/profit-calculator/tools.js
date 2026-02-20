// server/src/skills/profit-calculator/tools.js

import { z } from 'zod';
import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';

// ── Tool Definitions ────────────────────────────────────────────────

export const tools = {
  /**
   * getProductPricing
   *
   * Fetch product pricing data from the products table by SKU.
   * Uses Supabase admin client for server-side queries.
   *
   * Cost estimate: Free (Supabase query within plan limits)
   */
  getProductPricing: {
    name: 'getProductPricing',
    description: 'Fetch product pricing data (base cost, retail price, shipping cost) from the products table by SKU.',
    inputSchema: z.object({
      skus: z
        .array(z.string())
        .min(1)
        .max(20)
        .describe('Array of product SKUs to look up (1-20)'),
    }),

    /**
     * @param {{ skus: string[] }} input
     * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
     */
    async execute({ skus }) {
      logger.info({ msg: 'Fetching product pricing', skuCount: skus.length });

      try {
        const { data, error } = await supabaseAdmin
          .from('products')
          .select('sku, name, base_cost, retail_price, shipping_cost, category')
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
          shippingCost: parseFloat(p.shipping_cost) || 0,
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
      } catch (err) {
        logger.error({ msg: 'Product pricing fetch failed', error: err.message });
        return { success: false, error: `Product pricing fetch failed: ${err.message}` };
      }
    },
  },

  /**
   * calculateMargins
   *
   * Calculate profit and margin percentage for each product.
   * Formula: margin = (retailPrice - baseCost - shippingCost) / retailPrice * 100
   *
   * Pure computation -- no external API calls.
   * Cost estimate: Free (pure math)
   */
  calculateMargins: {
    name: 'calculateMargins',
    description: 'Calculate profit and margin percentage for each product. Formula: margin = (retailPrice - baseCost - shippingCost) / retailPrice * 100. Pure computation -- no external API calls.',
    inputSchema: z.object({
      products: z
        .array(
          z.object({
            sku: z.string().describe('Product SKU'),
            baseCost: z.number().min(0).describe('Base cost per unit in USD'),
            retailPrice: z.number().min(0).describe('Retail price per unit in USD'),
            shippingCost: z.number().min(0).default(0).describe('Shipping cost per unit in USD (default 0)'),
          })
        )
        .min(1)
        .describe('Array of products with cost and price data'),
    }),

    /**
     * @param {{ products: Array<{ sku: string, baseCost: number, retailPrice: number, shippingCost?: number }> }} input
     * @returns {Promise<{ success: boolean, data: Object }>}
     */
    async execute({ products }) {
      logger.info({ msg: 'Calculating margins', productCount: products.length });

      const results = products.map((product) => {
        const shippingCost = product.shippingCost || 0;
        const totalCost = product.baseCost + shippingCost;
        const profit = Math.round((product.retailPrice - totalCost) * 100) / 100;
        const marginPercent = product.retailPrice > 0
          ? Math.round(((product.retailPrice - totalCost) / product.retailPrice) * 10000) / 100
          : 0;

        return {
          sku: product.sku,
          baseCost: product.baseCost,
          shippingCost,
          totalCost: Math.round(totalCost * 100) / 100,
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

  /**
   * projectRevenue
   *
   * Project monthly and annual revenue/profit at three configurable sales
   * volume tiers. Accounts for estimated return rate.
   *
   * Pure computation -- no external API calls.
   * Cost estimate: Free (pure math)
   */
  projectRevenue: {
    name: 'projectRevenue',
    description: 'Project monthly and annual revenue/profit at three sales volume tiers (conservative, moderate, aggressive). Accounts for return rate. Pure computation -- no external API calls.',
    inputSchema: z.object({
      products: z
        .array(
          z.object({
            sku: z.string().describe('Product SKU'),
            retailPrice: z.number().min(0).describe('Retail price per unit in USD'),
            profit: z.number().describe('Profit per unit in USD (after all costs)'),
          })
        )
        .min(1)
        .describe('Array of products with pricing and profit data'),
      tiers: z
        .object({
          low: z.number().int().min(1).default(50).describe('Conservative units per product per month'),
          mid: z.number().int().min(1).default(200).describe('Moderate units per product per month'),
          high: z.number().int().min(1).default(500).describe('Aggressive units per product per month'),
        })
        .optional()
        .describe('Custom sales volume tiers (optional, defaults: low=50, mid=200, high=500)'),
      returnRate: z
        .number()
        .min(0)
        .max(0.5)
        .default(0.05)
        .describe('Estimated return rate as decimal (default 0.05 = 5%)'),
    }),

    /**
     * @param {{ products: Array<{ sku: string, retailPrice: number, profit: number }>, tiers?: { low: number, mid: number, high: number }, returnRate?: number }} input
     * @returns {Promise<{ success: boolean, data: Object }>}
     */
    async execute({ products, tiers, returnRate = 0.05 }) {
      const volumeTiers = {
        low: tiers?.low ?? 50,
        mid: tiers?.mid ?? 200,
        high: tiers?.high ?? 500,
      };

      logger.info({
        msg: 'Projecting revenue',
        productCount: products.length,
        tiers: volumeTiers,
        returnRate,
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
            annualRevenue: Math.round(productRevenue * 12 * 100) / 100,
            annualProfit: Math.round(productProfit * 12 * 100) / 100,
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
            returnRatePercent: Math.round(returnRate * 10000) / 100,
            tiers: volumeTiers,
            productCount: products.length,
          },
        },
      };
    },
  },
};
