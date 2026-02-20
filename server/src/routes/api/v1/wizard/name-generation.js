// server/src/routes/api/v1/wizard/name-generation.js

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../../../middleware/validate.js';
import { generationLimiter } from '../../../../middleware/rate-limit.js';
import { logger } from '../../../../lib/logger.js';

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
 * Queue a name generation job. Returns jobId for Socket.io tracking.
 */
nameGenerationRoutes.post(
  '/',
  validate({ body: generateNamesSchema }),
  generationLimiter,
  async (req, res, next) => {
    try {
      const { brandId, archetype, traits, industry, targetAudience, style, keywords } = req.body;
      const userId = req.user?.id;

      logger.info({ msg: 'Name generation requested', brandId, userId });

      // In a full implementation, this would dispatch a BullMQ job that
      // runs the name-generator skill. For now, return a jobId placeholder.
      // The actual job dispatch would look like:
      // const job = await nameGenerationQueue.add('generate-names', { brandId, userId, ... });

      const jobId = crypto.randomUUID();

      res.status(202).json({
        success: true,
        data: {
          jobId,
          brandId,
          status: 'queued',
          message: 'Name generation job has been queued.',
        },
      });
    } catch (err) {
      next(err);
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

      res.json({
        success: true,
        data: {
          brandId,
          name,
          isCustom,
          message: 'Brand name saved successfully.',
        },
      });
    } catch (err) {
      next(err);
    }
  }
);
