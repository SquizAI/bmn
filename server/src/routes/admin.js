// server/src/routes/admin.js

import { Router } from 'express';
import * as adminController from '../controllers/admin.js';
import { validate } from '../middleware/validate.js';
import {
  adminUserQuerySchema,
  adminProductCreateSchema,
  adminProductUpdateSchema,
  adminTemplateCreateSchema,
  adminTemplateUpdateSchema,
  adminTierCreateSchema,
  adminTierUpdateSchema,
  adminTierAssignSchema,
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

// -- Templates (packaging management) --
// GET /api/v1/admin/templates -- List all templates (paginated, admin sees inactive)
adminRoutes.get('/templates', adminController.listTemplatesAdmin);

// GET /api/v1/admin/templates/:templateId -- Get template details
adminRoutes.get('/templates/:templateId', adminController.getTemplateAdmin);

// POST /api/v1/admin/templates -- Create packaging template
adminRoutes.post(
  '/templates',
  validate({ body: adminTemplateCreateSchema }),
  adminController.createTemplate
);

// PATCH /api/v1/admin/templates/:templateId -- Update packaging template
adminRoutes.patch(
  '/templates/:templateId',
  validate({ body: adminTemplateUpdateSchema }),
  adminController.updateTemplate
);

// DELETE /api/v1/admin/templates/:templateId -- Soft-delete packaging template
adminRoutes.delete('/templates/:templateId', adminController.deleteTemplate);

// -- Product Tiers --
// GET /api/v1/admin/product-tiers -- List all product tiers (with product counts)
adminRoutes.get('/product-tiers', adminController.listProductTiers);

// GET /api/v1/admin/product-tiers/:tierId -- Get tier with assigned products
adminRoutes.get('/product-tiers/:tierId', adminController.getProductTier);

// POST /api/v1/admin/product-tiers -- Create product tier
adminRoutes.post(
  '/product-tiers',
  validate({ body: adminTierCreateSchema }),
  adminController.createProductTier
);

// PATCH /api/v1/admin/product-tiers/:tierId -- Update product tier
adminRoutes.patch(
  '/product-tiers/:tierId',
  validate({ body: adminTierUpdateSchema }),
  adminController.updateProductTier
);

// DELETE /api/v1/admin/product-tiers/:tierId -- Soft-delete product tier
adminRoutes.delete('/product-tiers/:tierId', adminController.deleteProductTier);

// PATCH /api/v1/admin/product-tiers/:tierId/assign -- Bulk assign products to tier
adminRoutes.patch(
  '/product-tiers/:tierId/assign',
  validate({ body: adminTierAssignSchema }),
  adminController.assignProductsToTier
);

// -- System --
// GET /api/v1/admin/jobs -- BullMQ job queue status
adminRoutes.get('/jobs', adminController.getJobStatus);

// GET /api/v1/admin/metrics -- System metrics (costs, generation counts)
adminRoutes.get('/metrics', adminController.getMetrics);
