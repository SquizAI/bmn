// server/src/routes/api/v1/dashboard/products.js

import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import { supabaseAdmin } from '../../../../lib/supabase.js';
import { logger } from '../../../../lib/logger.js';
import { topProductsQuerySchema } from '../../../../../../shared/schemas/dashboard.js';

export const productsRoutes = Router();

/**
 * GET /api/v1/dashboard/top-products
 * Returns top-performing products ranked by revenue.
 */
productsRoutes.get(
  '/',
  validate({ query: topProductsQuerySchema }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { brandId, limit } = req.query;

      // Get brand IDs owned by user
      let brandFilter = [];
      if (brandId) {
        brandFilter = [brandId];
      } else {
        const { data: brands } = await supabaseAdmin
          .from('brands')
          .select('id')
          .eq('user_id', userId)
          .is('deleted_at', null);
        brandFilter = (brands || []).map((b) => b.id);
      }

      if (brandFilter.length === 0) {
        return res.json({
          success: true,
          data: { items: [] },
        });
      }

      // Fetch order line items joined with products
      const { data: orderItems } = await supabaseAdmin
        .from('order_items')
        .select(`
          quantity,
          unit_price,
          product_id,
          products (id, name, sku, thumbnail_url),
          orders!inner (brand_id)
        `)
        .in('orders.brand_id', brandFilter);

      // Aggregate by product
      const productMap = new Map();
      for (const item of orderItems || []) {
        const product = item.products;
        if (!product) continue;

        const existing = productMap.get(product.id) || {
          id: product.id,
          name: product.name,
          sku: product.sku,
          thumbnailUrl: product.thumbnail_url,
          totalRevenue: 0,
          totalOrders: 0,
        };

        existing.totalRevenue += (item.unit_price || 0) * (item.quantity || 1);
        existing.totalOrders += 1;
        productMap.set(product.id, existing);
      }

      // Sort by revenue and apply limit
      const sorted = [...productMap.values()]
        .map((p) => ({
          ...p,
          totalRevenue: Math.round(p.totalRevenue * 100) / 100,
          avgOrderValue:
            p.totalOrders > 0
              ? Math.round((p.totalRevenue / p.totalOrders) * 100) / 100
              : 0,
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, limit);

      res.json({
        success: true,
        data: { items: sorted },
      });
    } catch (err) {
      logger.error({ err, userId: req.user?.id }, 'Top products query failed');
      next(err);
    }
  }
);
