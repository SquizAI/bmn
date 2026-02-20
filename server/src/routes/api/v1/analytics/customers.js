// server/src/routes/api/v1/analytics/customers.js

import { Router } from 'express';
import { validate } from '../../../../middleware/validate.js';
import { supabaseAdmin } from '../../../../lib/supabase.js';
import { logger } from '../../../../lib/logger.js';
import { customerAnalyticsQuerySchema } from '../../../../../../shared/schemas/analytics.js';

export const customerRoutes = Router();

/**
 * GET /api/v1/analytics/customers
 * Returns customer demographics, purchase patterns, and referral sources.
 */
customerRoutes.get(
  '/',
  validate({ query: customerAnalyticsQuerySchema }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { period, brandId } = req.query;

      // Calculate date range
      const now = new Date();
      const periodDays = { '7d': 7, '30d': 30, '90d': 90, all: 365 * 5 };
      const days = periodDays[period] || 30;
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - days);

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
          data: {
            demographics: {
              ageGroups: [],
              genderSplit: [],
              topLocations: [],
            },
            patterns: {
              byDayOfWeek: [],
              byTimeOfDay: [],
              repeatPurchaseRate: 0,
              avgOrderValue: 0,
              avgOrderValueTrend: [],
              customerLifetimeValue: 0,
            },
            topReferralSources: [],
          },
        });
      }

      // Fetch orders within period
      const { data: orders } = await supabaseAdmin
        .from('orders')
        .select('id, total_amount, customer_email, customer_location, referral_source, created_at')
        .in('brand_id', brandFilter)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      const orderList = orders || [];

      // Purchase patterns by day of week
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayCounts = new Array(7).fill(0);
      const hourCounts = new Array(24).fill(0);

      for (const order of orderList) {
        const d = new Date(order.created_at);
        dayCounts[d.getUTCDay()]++;
        hourCounts[d.getUTCHours()]++;
      }

      const byDayOfWeek = dayNames.map((day, i) => ({
        day,
        orders: dayCounts[i],
      }));

      const byTimeOfDay = hourCounts.map((count, hour) => ({
        hour,
        orders: count,
      }));

      // Repeat purchase rate
      const customerOrders = new Map();
      for (const order of orderList) {
        if (!order.customer_email) continue;
        const count = customerOrders.get(order.customer_email) || 0;
        customerOrders.set(order.customer_email, count + 1);
      }
      const totalCustomers = customerOrders.size;
      const repeatCustomers = [...customerOrders.values()].filter((c) => c > 1).length;
      const repeatPurchaseRate =
        totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 1000) / 10 : 0;

      // Average order value
      const totalRevenue = orderList.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const avgOrderValue =
        orderList.length > 0
          ? Math.round((totalRevenue / orderList.length) * 100) / 100
          : 0;

      // CLV (simplified: avg revenue per customer)
      const customerLifetimeValue =
        totalCustomers > 0
          ? Math.round((totalRevenue / totalCustomers) * 100) / 100
          : 0;

      // Top locations
      const locationCounts = new Map();
      for (const order of orderList) {
        if (!order.customer_location) continue;
        locationCounts.set(
          order.customer_location,
          (locationCounts.get(order.customer_location) || 0) + 1
        );
      }
      const topLocations = [...locationCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([location, count]) => ({
          location,
          count,
          percentage: totalCustomers > 0
            ? Math.round((count / orderList.length) * 1000) / 10
            : 0,
        }));

      // Top referral sources
      const sourceCounts = new Map();
      for (const order of orderList) {
        const source = order.referral_source || 'Direct';
        sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
      }
      const topReferralSources = [...sourceCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([source, count]) => ({
          source,
          count,
          percentage:
            orderList.length > 0
              ? Math.round((count / orderList.length) * 1000) / 10
              : 0,
        }));

      // AOV trend (daily)
      const aovMap = new Map();
      const aovCountMap = new Map();
      for (const order of orderList) {
        const key = order.created_at.slice(0, 10);
        aovMap.set(key, (aovMap.get(key) || 0) + (order.total_amount || 0));
        aovCountMap.set(key, (aovCountMap.get(key) || 0) + 1);
      }
      const avgOrderValueTrend = [...aovMap.entries()].map(([date, total]) => ({
        date,
        value: Math.round((total / (aovCountMap.get(date) || 1)) * 100) / 100,
      }));

      res.json({
        success: true,
        data: {
          demographics: {
            ageGroups: [], // Requires customer profile data
            genderSplit: [], // Requires customer profile data
            topLocations,
          },
          patterns: {
            byDayOfWeek,
            byTimeOfDay,
            repeatPurchaseRate,
            avgOrderValue,
            avgOrderValueTrend,
            customerLifetimeValue,
          },
          topReferralSources,
        },
      });
    } catch (err) {
      logger.error({ err, userId: req.user?.id }, 'Customer analytics failed');
      next(err);
    }
  }
);
