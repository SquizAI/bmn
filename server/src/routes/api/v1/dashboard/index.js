// server/src/routes/api/v1/dashboard/index.js

import { Router } from 'express';
import { overviewRoutes } from './overview.js';
import { productsRoutes } from './products.js';

export const dashboardRoutes = Router();

dashboardRoutes.use('/overview', overviewRoutes);
dashboardRoutes.use('/top-products', productsRoutes);
