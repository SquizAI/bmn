// server/src/routes/api/v1/dashboard/restock-alerts.js

import { Router } from 'express';
import { supabaseAdmin } from '../../../../lib/supabase.js';
import { logger } from '../../../../lib/logger.js';

export const restockAlertRoutes = Router();

/**
 * GET /api/v1/dashboard/restock-alerts
 * Returns products that are selling well with suggestions to restock or add complementary items.
 * Queries orders table to find top-selling products, compares with catalog for upsell opportunities.
 */
restockAlertRoutes.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Fetch brand IDs owned by user
    const { data: brands } = await supabaseAdmin
      .from('brands')
      .select('id')
      .eq('user_id', userId)
      .is('deleted_at', null);

    const brandIds = (brands || []).map((b) => b.id);

    if (brandIds.length === 0) {
      return res.json({
        success: true,
        data: { alerts: [] },
      });
    }

    // Calculate 30-day window
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch order items from the last 30 days
    /** @type {Array<{product_sku: string, product_name: string, quantity: number, brand_id: string}>} */
    let orderItems = [];
    try {
      const { data, error } = await supabaseAdmin
        .from('order_items')
        .select('product_sku, product_name, quantity, order:orders!inner(brand_id, created_at)')
        .in('order.brand_id', brandIds)
        .gte('order.created_at', thirtyDaysAgo.toISOString());

      if (!error && data) {
        orderItems = data;
      }
    } catch {
      // order_items table may not exist yet -- fall back gracefully
      logger.warn('order_items table query failed, returning defaults');
    }

    // Aggregate sales by SKU
    /** @type {Map<string, {sku: string, name: string, totalQty: number, brandId: string}>} */
    const skuSales = new Map();
    for (const item of orderItems) {
      const sku = item.product_sku;
      const brandId = item.order?.brand_id;
      if (!sku) continue;
      const existing = skuSales.get(sku);
      if (existing) {
        existing.totalQty += item.quantity || 1;
      } else {
        skuSales.set(sku, {
          sku,
          name: item.product_name || sku,
          totalQty: item.quantity || 1,
          brandId,
        });
      }
    }

    // Sort by quantity descending, take top 10
    const topSellers = [...skuSales.values()]
      .sort((a, b) => b.totalQty - a.totalQty)
      .slice(0, 10);

    // Fetch full product catalog for these brands to find complements
    let catalogProducts = [];
    try {
      const { data, error } = await supabaseAdmin
        .from('products')
        .select('id, name, sku, category, brand_id')
        .in('brand_id', brandIds)
        .is('deleted_at', null);

      if (!error && data) {
        catalogProducts = data;
      }
    } catch {
      logger.warn('products table query failed');
    }

    // Build category map for complement suggestions
    /** @type {Map<string, Array<{name: string, sku: string}>>} */
    const categoryMap = new Map();
    for (const product of catalogProducts) {
      const cat = product.category || 'general';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, []);
      }
      categoryMap.get(cat).push({ name: product.name, sku: product.sku });
    }

    // Generate alerts
    /** @type {Array<{type: string, productName: string, sku: string, message: string, metric: string, suggestion: string, priority: string}>} */
    const alerts = [];

    for (const seller of topSellers) {
      // Top seller alert
      if (seller.totalQty >= 10) {
        alerts.push({
          type: 'top-seller',
          productName: seller.name,
          sku: seller.sku,
          message: `${seller.name} is a top seller this month`,
          metric: `${seller.totalQty} orders this month`,
          suggestion: 'Consider featuring this product in your marketing campaigns',
          priority: seller.totalQty >= 25 ? 'high' : 'medium',
        });
      }

      // Find complementary products in the same category
      const productInCatalog = catalogProducts.find((p) => p.sku === seller.sku);
      if (productInCatalog?.category) {
        const sameCategoryProducts = categoryMap.get(productInCatalog.category) || [];
        const complement = sameCategoryProducts.find((p) => p.sku !== seller.sku);
        if (complement) {
          alerts.push({
            type: 'complement',
            productName: seller.name,
            sku: seller.sku,
            message: `Customers buying ${seller.name} may also want ${complement.name}`,
            metric: `${seller.totalQty} related orders`,
            suggestion: `Bundle ${complement.name} with ${seller.name} for a cross-sell opportunity`,
            priority: 'medium',
          });
        }
      }
    }

    // Add trending alerts for products with rapid growth (compare recent 7 days vs prior 23 days)
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    for (const seller of topSellers.slice(0, 5)) {
      const recentItems = orderItems.filter(
        (item) =>
          item.product_sku === seller.sku &&
          item.order?.created_at &&
          new Date(item.order.created_at) >= sevenDaysAgo
      );
      const recentQty = recentItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
      const olderQty = seller.totalQty - recentQty;

      // If last 7 days account for more than 50% of 30-day sales, it's trending
      if (recentQty > olderQty && seller.totalQty >= 5) {
        alerts.push({
          type: 'trending',
          productName: seller.name,
          sku: seller.sku,
          message: `${seller.name} is trending upward`,
          metric: `${recentQty} orders in the last 7 days`,
          suggestion: 'Increase inventory and promote this item while demand is high',
          priority: 'high',
        });
      }
    }

    // If no real data, provide helpful defaults
    if (alerts.length === 0) {
      alerts.push(
        {
          type: 'trending',
          productName: 'Your Product Catalog',
          sku: '',
          message: 'Start selling to see restock alerts here',
          metric: 'No orders yet',
          suggestion: 'Share your product links on social media to drive your first sales',
          priority: 'low',
        },
      );
    }

    // Sort by priority and limit to 5
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sortedAlerts = alerts
      .sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2))
      .slice(0, 5);

    res.json({
      success: true,
      data: { alerts: sortedAlerts },
    });
  } catch (err) {
    logger.error({ err, userId: req.user?.id }, 'Restock alerts failed');
    next(err);
  }
});
