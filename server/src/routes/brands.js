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
import { supabaseAdmin } from '../lib/supabase.js';

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

// POST /api/v1/brands/:brandId/products/:productId/export-print -- Queue print export job
brandRoutes.post('/:brandId/products/:productId/export-print', async (req, res, next) => {
  try {
    const { brandId, productId } = req.params;
    const { format } = req.body;
    const userId = req.user?.id || req.auth?.userId;

    // Load product to get template_id
    const { data: product } = await supabaseAdmin
      .from('products')
      .select('template_id')
      .eq('id', productId)
      .single();

    if (!product?.template_id) {
      return res.status(400).json({ success: false, error: 'Product has no packaging template assigned' });
    }

    // Dispatch print export job
    const { dispatchJob } = await import('../queues/dispatch.js');
    const result = await dispatchJob('print-export', {
      userId: userId || brandId,
      brandId,
      productId,
      templateId: product.template_id,
      format: format || 'pdf',
    });

    res.json({ success: true, data: { jobId: result.jobId } });
  } catch (err) {
    next(err);
  }
});
