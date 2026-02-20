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
  websiteUrl: z.string().url().max(2048).optional().or(z.literal('')),
  regenerate: z.boolean().optional(),
});

/**
 * POST /api/v1/wizard/resume
 */
export const wizardResumeSchema = z.object({
  token: z.string().min(1, 'Resume token is required'),
});

/**
 * POST /api/v1/wizard/:brandId/scrape-website
 */
export const scrapeWebsiteSchema = z.object({
  url: z.string().min(1, 'URL is required').max(2048),
});

/**
 * POST /api/v1/wizard/:brandId/custom-product-request
 */
export const customProductRequestSchema = z.object({
  description: z.string().min(5, 'Please describe the product').max(500),
  category: z.string().min(1, 'Category is required').max(100),
  priceRange: z.enum(['$10-25', '$25-50', '$50-100', '$100+']),
});

/**
 * POST /api/v1/wizard/:brandId/personality-quiz
 */
export const personalityQuizSchema = z.object({
  vibe: z.string().min(1, 'Vibe selection is required').max(200),
  brandWords: z.array(z.string().max(50)).min(1, 'At least one brand word is required').max(10),
  dreamCustomer: z.string().min(1, 'Dream customer description is required').max(1000),
  colorPalette: z.array(z.string().max(20)).max(10).optional(),
  contentStyle: z.string().min(1, 'Content style is required').max(500),
});
