// server/src/routes/api/v1/wizard/mockup-generation.js

import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase.js';
import { logger } from '../../../../lib/logger.js';
import { validate } from '../../../../middleware/validate.js';
import { dispatchJob } from '../../../../queues/dispatch.js';

export const mockupGenerationRouter = Router();

const dispatchBody = z.object({
  brandId: z.string().uuid(),
});

const approvalsBody = z.object({
  brandId: z.string().uuid(),
  approvals: z.record(z.string(), z.enum(['approved', 'rejected'])),
});

// ---- POST /api/v1/wizard/mockup-generation ----
// Dispatch mockup generation job for a brand's selected products.

mockupGenerationRouter.post(
  '/',
  validate({ body: dispatchBody }),
  async (req, res, next) => {
    try {
      const { brandId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      // Verify brand ownership
      const { data: brand, error: brandError } = await supabaseAdmin
        .from('brands')
        .select('id, user_id')
        .eq('id', brandId)
        .eq('user_id', userId)
        .single();

      if (brandError || !brand) {
        return res.status(404).json({ success: false, error: 'Brand not found' });
      }

      // Get selected products for this brand (with full product data)
      const { data: selections, error: selError } = await supabaseAdmin
        .from('brand_products')
        .select('product_sku, product_id')
        .eq('brand_id', brandId);

      if (selError || !selections || selections.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No products selected. Select products before generating mockups.',
        });
      }

      // Resolve full product data from SKUs (or product_id if available)
      const productSkus = selections.map((s) => s.product_sku).filter(Boolean);
      const productIds = selections.map((s) => s.product_id).filter(Boolean);

      let products = [];
      if (productIds.length > 0) {
        const { data } = await supabaseAdmin
          .from('products')
          .select('id, sku, name, category, base_cost, retail_price, image_url, mockup_instructions, description')
          .in('id', productIds)
          .is('deleted_at', null);
        if (data) products = data;
      }
      // Fallback: resolve by SKU if product_id didn't yield results
      if (products.length === 0 && productSkus.length > 0) {
        const { data } = await supabaseAdmin
          .from('products')
          .select('id, sku, name, category, base_cost, retail_price, image_url, mockup_instructions, description')
          .in('sku', productSkus)
          .is('deleted_at', null);
        if (data) products = data;
      }

      if (products.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Selected products could not be found. Please re-select products.',
        });
      }

      // Fetch brand identity (logo + colors) for the mockup renderer
      const { data: brandAssets } = await supabaseAdmin
        .from('brand_assets')
        .select('url, metadata')
        .eq('brand_id', brandId)
        .eq('asset_type', 'logo')
        .eq('is_selected', true)
        .limit(1);

      const { data: brandRecord } = await supabaseAdmin
        .from('brands')
        .select('name, identity')
        .eq('id', brandId)
        .single();

      const selectedLogo = brandAssets?.[0] || null;
      const brandIdentity = brandRecord?.identity || {};
      const brandName = brandRecord?.name || 'Brand';

      // Dispatch mockup generation via BullMQ (brand-wizard queue, mockup-review step)
      const result = await dispatchJob('brand-wizard', {
        userId,
        brandId,
        step: 'mockup-review',
        input: {
          brandId,
          userId,
          products: products.map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            category: p.category,
            base_cost: p.base_cost,
            retail_price: p.retail_price,
            image_url: p.image_url,
            mockup_instructions: p.mockup_instructions,
          })),
          selectedLogo: selectedLogo ? {
            url: selectedLogo.url,
            variationType: selectedLogo.metadata?.variation_type || 'primary',
            prompt: selectedLogo.metadata?.prompt || '',
          } : { url: '', variationType: 'primary', prompt: '' },
          brandIdentity: {
            brandName,
            archetype: brandIdentity.archetype || '',
            colorPalette: brandIdentity.colorPalette || brandIdentity.color_palette || {},
          },
        },
        creditCost: products.length,
      });

      logger.info({ jobId: result.jobId, brandId, userId, productCount: products.length }, 'Mockup generation job dispatched via BullMQ');

      return res.json({
        success: true,
        data: { jobId: result.jobId, queueName: result.queueName },
      });
    } catch (err) {
      logger.error({ msg: 'Mockup generation dispatch failed', error: err.message });
      return next(err);
    }
  }
);

// ---- PUT /api/v1/wizard/mockup-generation/approvals ----
// Save mockup approval/rejection statuses.

mockupGenerationRouter.put(
  '/approvals',
  validate({ body: approvalsBody }),
  async (req, res, next) => {
    try {
      const { brandId, approvals } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      // Verify brand ownership
      const { data: brand, error: brandError } = await supabaseAdmin
        .from('brands')
        .select('id')
        .eq('id', brandId)
        .eq('user_id', userId)
        .single();

      if (brandError || !brand) {
        return res.status(404).json({ success: false, error: 'Brand not found' });
      }

      // Update each mockup status
      const updates = Object.entries(approvals).map(async ([mockupId, status]) => {
        const { error } = await supabaseAdmin
          .from('mockups')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', mockupId)
          .eq('brand_id', brandId);

        if (error) {
          logger.warn({ msg: 'Failed to update mockup status', mockupId, error: error.message });
        }
        return { mockupId, status, success: !error };
      });

      const results = await Promise.all(updates);

      return res.json({
        success: true,
        data: {
          brandId,
          updated: results.filter((r) => r.success).length,
          total: results.length,
        },
      });
    } catch (err) {
      logger.error({ msg: 'Mockup approvals save failed', error: err.message });
      return next(err);
    }
  }
);
