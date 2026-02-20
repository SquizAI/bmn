// server/src/routes/api/v1/dashboard/health-score.js

import { Router } from 'express';
import { supabaseAdmin } from '../../../../lib/supabase.js';
import { logger } from '../../../../lib/logger.js';

export const healthScoreRoutes = Router();

/**
 * GET /api/v1/dashboard/health-score
 * Returns brand health score with breakdown and tips.
 * Checks for a pre-calculated score first, then falls back to on-the-fly calculation.
 */
healthScoreRoutes.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { brandId } = req.query;

    // If brandId provided, use it; otherwise get first brand
    let targetBrandId = brandId;
    if (!targetBrandId) {
      const { data: brands } = await supabaseAdmin
        .from('brands')
        .select('id')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .limit(1);
      targetBrandId = brands?.[0]?.id;
    }

    if (!targetBrandId) {
      return res.json({ success: true, data: null });
    }

    // Check for pre-calculated health score from analytics worker
    // NOTE: brand_health_scores table may not exist yet — query will throw and be caught below
    const { data: cached } = await supabaseAdmin
      .from('brand_health_scores')
      .select('*')
      .eq('brand_id', targetBrandId)
      .order('calculated_at', { ascending: false })
      .limit(1);

    if (cached && cached.length > 0) {
      const score = cached[0];
      return res.json({
        success: true,
        data: {
          overall: score.overall_score,
          breakdown: score.breakdown || {},
          tips: score.tips || [],
          calculatedAt: score.calculated_at,
        },
      });
    }

    // No cached score — calculate a basic one from available data
    // Count products for catalog breadth
    // NOTE: brand_products table may not exist yet — defaults to 0
    const { count: productCount } = await supabaseAdmin
      .from('brand_products')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', targetBrandId);

    // Count orders for sales velocity
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentOrders } = await supabaseAdmin
      .from('orders')
      .select('id, total_amount')
      .eq('brand_id', targetBrandId)
      .gte('created_at', thirtyDaysAgo.toISOString());

    const orderCount = recentOrders?.length || 0;
    const revenue = (recentOrders || []).reduce((sum, o) => sum + (o.total_amount || 0), 0);

    // Calculate basic scores (0-100 scale)
    const catalogBreadth = Math.min(100, (productCount || 0) * 20); // 5 products = 100
    const salesVelocity = Math.min(100, orderCount * 5); // 20 orders/month = 100
    const revenueGrowth = revenue > 0 ? 70 : 30; // Simplified
    const customerSatisfaction = 75; // Default until reviews exist
    const socialMentions = 50; // Default until social tracking
    const repeatPurchaseRate = 50; // Default until customer data

    // Weighted overall
    const overall = Math.round(
      salesVelocity * 0.25 +
      customerSatisfaction * 0.20 +
      socialMentions * 0.15 +
      repeatPurchaseRate * 0.20 +
      catalogBreadth * 0.10 +
      revenueGrowth * 0.10
    );

    // Generate tips based on weak areas
    const tips = [];
    if (catalogBreadth < 60) {
      tips.push({
        category: 'Products',
        message: 'Add more products to improve catalog breadth and revenue potential',
        priority: 'medium',
      });
    }
    if (salesVelocity < 40) {
      tips.push({
        category: 'Sales',
        message: 'Focus on marketing to increase order volume',
        priority: 'high',
      });
    }
    if (orderCount === 0) {
      tips.push({
        category: 'Launch',
        message: 'Share your brand with your audience to get your first sale',
        priority: 'high',
      });
    }

    res.json({
      success: true,
      data: {
        overall,
        breakdown: {
          salesVelocity,
          customerSatisfaction,
          socialMentions,
          repeatPurchaseRate,
          catalogBreadth,
          revenueGrowth,
        },
        tips,
        calculatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error({ err, userId: req.user?.id }, 'Health score fetch failed');
    next(err);
  }
});
