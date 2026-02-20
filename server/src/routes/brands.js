// server/src/routes/brands.js

import { Router } from 'express';
import * as brandController from '../controllers/brands.js';
import { validate } from '../middleware/validate.js';
import { generationLimiter } from '../middleware/rate-limit.js';
import {
  brandCreateSchema,
  brandUpdateSchema,
  brandIdParamsSchema,
} from '../validation/brands.js';

export const brandRoutes = Router();

// GET /api/v1/brands -- List user's brands
brandRoutes.get('/', brandController.listBrands);

// POST /api/v1/brands -- Create a new brand
brandRoutes.post('/', validate({ body: brandCreateSchema }), brandController.createBrand);

// GET /api/v1/brands/:brandId -- Get brand details
brandRoutes.get(
  '/:brandId',
  validate({ params: brandIdParamsSchema }),
  brandController.getBrand
);

// PATCH /api/v1/brands/:brandId -- Update brand
brandRoutes.patch(
  '/:brandId',
  validate({ params: brandIdParamsSchema, body: brandUpdateSchema }),
  brandController.updateBrand
);

// DELETE /api/v1/brands/:brandId -- Delete brand and all assets
brandRoutes.delete(
  '/:brandId',
  validate({ params: brandIdParamsSchema }),
  brandController.deleteBrand
);

// GET /api/v1/brands/:brandId/assets -- List brand assets (logos, mockups, bundles)
brandRoutes.get(
  '/:brandId/assets',
  validate({ params: brandIdParamsSchema }),
  brandController.listBrandAssets
);

// POST /api/v1/brands/:brandId/generate/logos -- Queue logo generation
brandRoutes.post(
  '/:brandId/generate/logos',
  validate({ params: brandIdParamsSchema }),
  generationLimiter,
  brandController.generateLogos
);

// POST /api/v1/brands/:brandId/generate/mockups -- Queue mockup generation
brandRoutes.post(
  '/:brandId/generate/mockups',
  validate({ params: brandIdParamsSchema }),
  generationLimiter,
  brandController.generateMockups
);

// GET /api/v1/brands/:brandId/download -- Download brand assets ZIP
brandRoutes.get(
  '/:brandId/download',
  validate({ params: brandIdParamsSchema }),
  brandController.downloadBrandAssets
);
