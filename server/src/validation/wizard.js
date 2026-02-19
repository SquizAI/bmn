// server/src/validation/wizard.js

import { z } from 'zod';

/**
 * POST /api/v1/wizard/start
 */
export const wizardStartSchema = z.object({
  brand_name: z.string().min(1, 'Brand name is required').max(100).optional(),
});

/**
 * PATCH /api/v1/wizard/:brandId/step
 */
export const wizardStepUpdateSchema = z.object({
  step: z.number().int().min(0).max(12),
  data: z.record(z.unknown()),
});

/**
 * POST /api/v1/wizard/:brandId/analyze-social
 */
export const socialHandlesSchema = z.object({
  instagram: z.string().max(100).optional(),
  tiktok: z.string().max(100).optional(),
  facebook: z.string().max(100).optional(),
  twitter: z.string().max(100).optional(),
  youtube: z.string().max(100).optional(),
});

/**
 * POST /api/v1/wizard/resume
 */
export const wizardResumeSchema = z.object({
  token: z.string().min(1, 'Resume token is required'),
});
