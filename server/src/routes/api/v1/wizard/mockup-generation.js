// server/src/routes/api/v1/wizard/mockup-generation.js

import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase.js';
import { logger } from '../../../../lib/logger.js';
import { validate } from '../../../../middleware/validate.js';

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

      // Get selected products for this brand
      const { data: selections, error: selError } = await supabaseAdmin
        .from('brand_products')
        .select('product_sku')
        .eq('brand_id', brandId);

      if (selError || !selections || selections.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No products selected. Select products before generating mockups.',
        });
      }

      // TODO: Queue via BullMQ in production
      // For now, create a generation job record and return the jobId
      const { data: job, error: jobError } = await supabaseAdmin
        .from('generation_jobs')
        .insert({
          brand_id: brandId,
          user_id: userId,
          type: 'mockup-generation',
          status: 'pending',
          input: {
            brandId,
            productSkus: selections.map((s) => s.product_sku),
          },
        })
        .select('id')
        .single();

      if (jobError) {
        logger.error({ msg: 'Failed to create mockup generation job', error: jobError.message });
        return res.status(500).json({ success: false, error: 'Failed to start mockup generation' });
      }

      res.json({
        success: true,
        data: { jobId: job.id },
      });
    } catch (err) {
      logger.error({ msg: 'Mockup generation dispatch failed', error: err.message });
      next(err);
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

      res.json({
        success: true,
        data: {
          brandId,
          updated: results.filter((r) => r.success).length,
          total: results.length,
        },
      });
    } catch (err) {
      logger.error({ msg: 'Mockup approvals save failed', error: err.message });
      next(err);
    }
  }
);
