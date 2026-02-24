// server/src/routes/api/v1/wizard/name-generation.js

import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase.js';
import { logger } from '../../../../lib/logger.js';
import { validate } from '../../../../middleware/validate.js';
import { generationLimiter } from '../../../../middleware/rate-limit.js';
import { dispatchJob } from '../../../../queues/dispatch.js';

export const nameGenerationRoutes = Router();

const generateNamesSchema = z.object({
  brandId: z.string().min(1),
  archetype: z.string().optional(),
  traits: z.array(z.string()).optional(),
  industry: z.string().optional(),
  targetAudience: z.string().optional(),
  style: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

const selectNameSchema = z.object({
  brandId: z.string().min(1),
  name: z.string().min(1).max(100),
  isCustom: z.boolean().default(false),
});

/**
 * POST /api/v1/wizard/name-generation
 * Dispatch a name generation job via BullMQ. Returns jobId for Socket.io tracking.
 */
nameGenerationRoutes.post(
  '/',
  validate({ body: generateNamesSchema }),
  generationLimiter,
  async (req, res, next) => {
    try {
      const { brandId, archetype, traits, industry, targetAudience, style, keywords } = req.body;
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

      // Dispatch name generation via BullMQ (brand-wizard queue, brand-identity step)
      const result = await dispatchJob('brand-wizard', {
        userId,
        brandId,
        step: 'brand-identity',
        input: { brandId, archetype, traits, industry, targetAudience, style, keywords },
        creditCost: 1,
      });

      logger.info({ jobId: result.jobId, brandId, userId }, 'Name generation job dispatched via BullMQ');

      return res.status(202).json({
        success: true,
        data: { jobId: result.jobId, queueName: result.queueName },
      });
    } catch (err) {
      logger.error({ msg: 'Name generation dispatch failed', error: err.message });
      return next(err);
    }
  }
);

/**
 * POST /api/v1/wizard/name-generation/select
 * Save the user's selected brand name.
 */
nameGenerationRoutes.post(
  '/select',
  validate({ body: selectNameSchema }),
  async (req, res, next) => {
    try {
      const { brandId, name, isCustom } = req.body;
      const userId = req.user?.id;

      logger.info({ msg: 'Brand name selected', brandId, name, isCustom, userId });

      // In a full implementation, this would update the brand record in Supabase:
      // await supabase.from('brands').update({ name }).eq('id', brandId).eq('user_id', userId);

      return res.json({
        success: true,
        data: {
          brandId,
          name,
          isCustom,
          message: 'Brand name saved successfully.',
        },
      });
    } catch (err) {
      return next(err);
    }
  }
);
