// server/src/routes/analytics.js
// Stub route -- returns placeholder data until full implementation

import { Router } from 'express';

export const analyticsRoutes = Router();

// GET /api/v1/analytics/customers
analyticsRoutes.get('/customers', async (_req, res) => {
  res.json({
    success: true,
    data: {
      demographics: {
        ageGroups: [
          { range: '18-24', percentage: 25 },
          { range: '25-34', percentage: 40 },
          { range: '35-44', percentage: 20 },
          { range: '45+', percentage: 15 },
        ],
        genderSplit: [
          { gender: 'Female', percentage: 55 },
          { gender: 'Male', percentage: 42 },
          { gender: 'Other', percentage: 3 },
        ],
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
});

// GET /api/v1/analytics/sales
analyticsRoutes.get('/sales', async (_req, res) => {
  res.json({
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
});
