// server/src/routes/api/v1/dashboard/referrals.js
// Stub routes -- returns placeholder data until full implementation

import { Router } from 'express';

export const referralStatsRoutes = Router();
export const referralLeaderboardRoutes = Router();

// GET /api/v1/dashboard/referral-stats
referralStatsRoutes.get('/', async (req, res) => {
  const userId = req.user?.id || 'anonymous';
  res.json({
    success: true,
    data: {
      referralCode: `BMN-${userId.slice(0, 6).toUpperCase()}`,
      referralUrl: `https://app.prznl.com/r/BMN-${userId.slice(0, 6).toUpperCase()}`,
      totalClicks: 0,
      totalSignups: 0,
      totalConversions: 0,
      totalEarnings: 0,
      pendingEarnings: 0,
    },
  });
});

// GET /api/v1/dashboard/referral-leaderboard
referralLeaderboardRoutes.get('/', async (_req, res) => {
  res.json({
    success: true,
    data: { items: [] },
  });
});
