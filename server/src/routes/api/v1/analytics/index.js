// server/src/routes/api/v1/analytics/index.js

import { Router } from 'express';
import { customerRoutes } from './customers.js';
import { salesRoutes } from './sales.js';

export const analyticsRoutes = Router();

analyticsRoutes.use('/customers', customerRoutes);
analyticsRoutes.use('/sales', salesRoutes);
