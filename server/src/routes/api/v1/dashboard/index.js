// server/src/routes/api/v1/dashboard/index.js

import { Router } from 'express';
import { overviewRoutes } from './overview.js';
import { productsRoutes } from './products.js';
import { healthScoreRoutes } from './health-score.js';
import { referralStatsRoutes, referralLeaderboardRoutes } from './referrals.js';
import { integrationsRoutes } from './integrations.js';
import { contentRoutes } from './content.js';

export const dashboardRoutes = Router();

dashboardRoutes.use('/overview', overviewRoutes);
dashboardRoutes.use('/top-products', productsRoutes);
dashboardRoutes.use('/health-score', healthScoreRoutes);
dashboardRoutes.use('/referral-stats', referralStatsRoutes);
dashboardRoutes.use('/referral-leaderboard', referralLeaderboardRoutes);
dashboardRoutes.use('/integrations', integrationsRoutes);
dashboardRoutes.use('/content', contentRoutes);
