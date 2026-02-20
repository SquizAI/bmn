// server/src/routes/api/v1/analytics/sales.js

import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import { supabaseAdmin } from '../../../../lib/supabase.js';
import { logger } from '../../../../lib/logger.js';
import { salesAnalyticsQuerySchema } from '../../../../../../shared/schemas/analytics.js';

export const salesRoutes = Router();

/**
 * GET /api/v1/analytics/sales
 * Returns sales trends, revenue, orders, and conversion rate.
 */
salesRoutes.get(
  '/',
  validate({ query: salesAnalyticsQuerySchema }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { period, brandId } = req.query;

      // Calculate date range
      const now = new Date();
      const periodDays = { '7d': 7, '30d': 30, '90d': 90, '1y': 365, all: 365 * 5 };
      const days = periodDays[period] || 30;
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);

      // Get brand IDs
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
          data: {
            totalRevenue: 0,
            totalOrders: 0,
            totalCustomers: 0,
            revenueTrend: [],
            ordersTrend: [],
            conversionRate: 0,
          },
        });
      }

      // Fetch orders
      const { data: orders } = await supabaseAdmin
        .from('orders')
        .select('id, total_amount, customer_email, created_at')
        .in('brand_id', brandFilter)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      const orderList = orders || [];

      const totalRevenue = orderList.reduce(
        (sum, o) => sum + (o.total_amount || 0),
        0
      );
      const totalOrders = orderList.length;
      const uniqueEmails = new Set(
        orderList.map((o) => o.customer_email).filter(Boolean)
      );
      const totalCustomers = uniqueEmails.size;

      // Build daily trends
      const revenueMap = new Map();
      const ordersMap = new Map();

      for (
        let d = new Date(startDate);
        d <= now;
        d.setDate(d.getDate() + 1)
      ) {
        const key = d.toISOString().slice(0, 10);
        revenueMap.set(key, 0);
        ordersMap.set(key, 0);
      }

      for (const order of orderList) {
        const key = order.created_at.slice(0, 10);
        revenueMap.set(
          key,
          (revenueMap.get(key) || 0) + (order.total_amount || 0)
        );
        ordersMap.set(key, (ordersMap.get(key) || 0) + 1);
      }

      const revenueTrend = [...revenueMap.entries()].map(([date, revenue]) => ({
        date,
        revenue: Math.round(revenue * 100) / 100,
      }));

      const ordersTrend = [...ordersMap.entries()].map(([date, count]) => ({
        date,
        orders: count,
      }));

      // Fetch page views for conversion rate (if tracked)
      const { count: pageViews } = await supabaseAdmin
        .from('page_views')
        .select('id', { count: 'exact', head: true })
        .in('brand_id', brandFilter)
        .gte('created_at', startDate.toISOString());

      const conversionRate =
        pageViews && pageViews > 0
          ? Math.round((totalOrders / pageViews) * 10000) / 100
          : 0;

      res.json({
        success: true,
        data: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalOrders,
          totalCustomers,
          revenueTrend,
          ordersTrend,
          conversionRate,
        },
      });
    } catch (err) {
      logger.error({ err, userId: req.user?.id }, 'Sales analytics failed');
      next(err);
    }
  }
);
