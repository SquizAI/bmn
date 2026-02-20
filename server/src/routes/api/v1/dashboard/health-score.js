// server/src/routes/api/v1/dashboard/health-score.js
// Stub route -- returns placeholder data until full implementation

import { Router } from 'express';

export const healthScoreRoutes = Router();

healthScoreRoutes.get('/', async (req, res) => {
  res.json({
    success: true,
    data: {
      overall: 72,
      breakdown: {
        salesVelocity: 65,
        customerSatisfaction: 80,
        socialMentions: 55,
        repeatPurchaseRate: 70,
        catalogBreadth: 85,
        revenueGrowth: 78,
      },
      tips: [
        { category: 'Social', message: 'Post more consistently to boost engagement', priority: 'high' },
        { category: 'Products', message: 'Add 2-3 more products to improve catalog breadth', priority: 'medium' },
      ],
      calculatedAt: new Date().toISOString(),
    },
  });
});
