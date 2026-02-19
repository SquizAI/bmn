// server/src/routes/admin.js

import { Router } from 'express';
import * as adminController from '../controllers/admin.js';
import { validate } from '../middleware/validate.js';
import {
  adminUserQuerySchema,
  adminProductCreateSchema,
  adminProductUpdateSchema,
} from '../validation/admin.js';

export const adminRoutes = Router();

// -- Users --
// GET /api/v1/admin/users -- List all users (paginated)
adminRoutes.get('/users', validate({ query: adminUserQuerySchema }), adminController.listUsers);

// GET /api/v1/admin/users/:userId -- Get user details
adminRoutes.get('/users/:userId', adminController.getUser);

// -- Brands --
// GET /api/v1/admin/brands -- List all brands (paginated, filterable)
adminRoutes.get('/brands', adminController.listAllBrands);

// -- Products (catalog management) --
// POST /api/v1/admin/products -- Create product
adminRoutes.post(
  '/products',
  validate({ body: adminProductCreateSchema }),
  adminController.createProduct
);

// PATCH /api/v1/admin/products/:productId -- Update product
adminRoutes.patch(
  '/products/:productId',
  validate({ body: adminProductUpdateSchema }),
  adminController.updateProduct
);

// DELETE /api/v1/admin/products/:productId -- Disable product
adminRoutes.delete('/products/:productId', adminController.disableProduct);

// -- System --
// GET /api/v1/admin/jobs -- BullMQ job queue status
adminRoutes.get('/jobs', adminController.getJobStatus);

// GET /api/v1/admin/metrics -- System metrics (costs, generation counts)
adminRoutes.get('/metrics', adminController.getMetrics);
