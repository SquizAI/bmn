// server/src/routes/api/v1/dashboard/overview.js

import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import { supabaseAdmin } from '../../../../lib/supabase.js';
import { logger } from '../../../../lib/logger.js';
import {
  dashboardOverviewQuerySchema,
} from '../../../../../../shared/schemas/dashboard.js';

export const overviewRoutes = Router();

/**
 * GET /api/v1/dashboard/overview
 * Returns revenue, orders, customer counts, and sparkline data.
 */
overviewRoutes.get(
  '/',
  validate({ query: dashboardOverviewQuerySchema }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { period, brandId } = req.query;

      // Calculate date range
      const now = new Date();
      const periodDays = {
        today: 1,
        '7d': 7,
        '30d': 30,
        '90d': 90,
        all: 365 * 5,
      };
      const days = periodDays[period] || 30;
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);
      const prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - days);

      // Fetch brand IDs owned by user
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
            todayRevenue: 0,
            todayOrders: 0,
            monthRevenue: 0,
            monthOrders: 0,
            monthCustomers: 0,
            revenueChange: 0,
            ordersChange: 0,
            sparkline: [],
          },
        });
      }

      // Query orders for the current period
      const { data: currentOrders } = await supabaseAdmin
        .from('orders')
        .select('id, total_amount, customer_email, created_at')
        .in('brand_id', brandFilter)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      // Query orders for the previous period (for change calculation)
      const { data: prevOrders } = await supabaseAdmin
        .from('orders')
        .select('id, total_amount')
        .in('brand_id', brandFilter)
        .gte('created_at', prevStartDate.toISOString())
        .lt('created_at', startDate.toISOString());

      const orders = currentOrders || [];
      const prev = prevOrders || [];

      // Calculate today's metrics
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayOrders = orders.filter(
        (o) => new Date(o.created_at) >= todayStart
      );
      const todayRevenue = todayOrders.reduce(
        (sum, o) => sum + (o.total_amount || 0),
        0
      );

      // Current period metrics
      const monthRevenue = orders.reduce(
        (sum, o) => sum + (o.total_amount || 0),
        0
      );
      const monthOrders = orders.length;
      const uniqueCustomers = new Set(
        orders.map((o) => o.customer_email).filter(Boolean)
      );

      // Previous period metrics
      const prevRevenue = prev.reduce(
        (sum, o) => sum + (o.total_amount || 0),
        0
      );
      const prevOrderCount = prev.length;

      // Change calculations
      const revenueChange =
        prevRevenue > 0
          ? ((monthRevenue - prevRevenue) / prevRevenue) * 100
          : monthRevenue > 0
            ? 100
            : 0;
      const ordersChange =
        prevOrderCount > 0
          ? ((monthOrders - prevOrderCount) / prevOrderCount) * 100
          : monthOrders > 0
            ? 100
            : 0;

      // Build sparkline (daily revenue for the period)
      const sparklineMap = new Map();
      for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10);
        sparklineMap.set(key, 0);
      }
      for (const order of orders) {
        const key = order.created_at.slice(0, 10);
        sparklineMap.set(key, (sparklineMap.get(key) || 0) + (order.total_amount || 0));
      }
      const sparkline = [...sparklineMap.entries()].map(([date, revenue]) => ({
        date,
        revenue: Math.round(revenue * 100) / 100,
      }));

      res.json({
        success: true,
        data: {
          todayRevenue: Math.round(todayRevenue * 100) / 100,
          todayOrders: todayOrders.length,
          monthRevenue: Math.round(monthRevenue * 100) / 100,
          monthOrders,
          monthCustomers: uniqueCustomers.size,
          revenueChange: Math.round(revenueChange * 10) / 10,
          ordersChange: Math.round(ordersChange * 10) / 10,
          sparkline,
        },
      });
    } catch (err) {
      logger.error({ err, userId: req.user?.id }, 'Dashboard overview failed');
      next(err);
    }
  }
);
