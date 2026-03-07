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

// GET /api/v1/brands/logo-options -- Available logo styles, variations, and archetypes
brandRoutes.get('/logo-options', brandController.getLogoOptions);

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

// POST /api/v1/brands/:brandId/upload-logo -- Register a user-uploaded logo
brandRoutes.post(
  '/:brandId/upload-logo',
  validate({ params: brandIdParamsSchema }),
  brandController.uploadLogo
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

// POST /api/v1/brands/:brandId/products -- Add a product to brand
brandRoutes.post('/:brandId/products', async (req, res, next) => {
  try {
    const { brandId } = req.params;
    const userId = req.user?.id || req.auth?.userId;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, error: 'productId is required' });
    }

    // Verify brand ownership
    const { data: brand, error: brandErr } = await supabaseAdmin
      .from('brands')
      .select('id')
      .eq('id', brandId)
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .single();

    if (brandErr || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Verify product exists
    const { data: product, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('id', productId)
      .is('deleted_at', null)
      .single();

    if (prodErr || !product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const { error: insertErr } = await supabaseAdmin
      .from('brand_products')
      .insert({ brand_id: brandId, product_id: productId, config: {} });

    if (insertErr) {
      if (insertErr.code === '23505') {
        return res.status(409).json({ success: false, error: 'Product already added to this brand' });
      }
      throw insertErr;
    }

    return res.status(201).json({ success: true, data: { brandId, productId } });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/v1/brands/:brandId/products/:productId -- Remove a product from brand
brandRoutes.delete('/:brandId/products/:productId', async (req, res, next) => {
  try {
    const { brandId, productId } = req.params;
    const userId = req.user?.id || req.auth?.userId;

    // Verify brand ownership
    const { data: brand, error: brandErr } = await supabaseAdmin
      .from('brands')
      .select('id')
      .eq('id', brandId)
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .single();

    if (brandErr || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Try deleting by product_id first, then by product_sku for backward compatibility
    const { error: deleteErr, count } = await supabaseAdmin
      .from('brand_products')
      .delete({ count: 'exact' })
      .eq('brand_id', brandId)
      .eq('product_id', productId);

    if (deleteErr) throw deleteErr;

    if (count === 0) {
      // Fallback: try matching by product_sku (legacy wizard data)
      const { error: skuErr } = await supabaseAdmin
        .from('brand_products')
        .delete()
        .eq('brand_id', brandId)
        .eq('product_sku', productId);

      if (skuErr) throw skuErr;
    }

    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

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

    return res.json({ success: true, data: { jobId: result.jobId } });
  } catch (err) {
    return next(err);
  }
});
