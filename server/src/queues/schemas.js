// server/src/queues/schemas.js

import { z } from 'zod';

/**
 * Brand Wizard job -- runs the full Agent SDK agent loop.
 */
export const BrandWizardJobSchema = z.object({
  userId: z.string().uuid(),
  brandId: z.string().uuid(),
  step: z.enum([
    'social-analysis',
    'brand-identity',
    'customization',
    'logo-generation',
    'logo-refinement',
    'product-selection',
    'mockup-review',
    'bundle-builder',
    'profit-calculator',
  ]),
  sessionId: z.string().optional(),
  input: z.record(z.unknown()),
  creditCost: z.number().int().positive(),
});

/**
 * Logo Generation job -- generates logos via FLUX.2 Pro.
 */
export const LogoGenerationJobSchema = z.object({
  userId: z.string().uuid(),
  brandId: z.string().uuid(),
  brandName: z.string().min(1).max(200),
  logoStyle: z.enum(['minimal', 'bold', 'vintage', 'modern', 'playful']),
  colorPalette: z.array(z.string()).min(1).max(8),
  brandVision: z.string().max(2000),
  archetype: z.string().max(200).optional(),
  count: z.number().int().min(1).max(8).default(4),
  isRefinement: z.boolean().default(false),
  previousLogoUrl: z.string().url().optional(),
  refinementNotes: z.string().max(1000).optional(),
});

/**
 * Mockup Generation job -- generates a product mockup via GPT Image 1.5.
 */
export const MockupGenerationJobSchema = z.object({
  userId: z.string().uuid(),
  brandId: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string(),
  productCategory: z.string(),
  brandName: z.string().optional(),
  logoUrl: z.string().url(),
  colorPalette: z.array(z.string()).min(1).max(8),
  mockupTemplateUrl: z.string().url().optional(),
  mockupInstructions: z.string().max(2000).optional(),
});

/**
 * Bundle Composition job -- composites multiple products via Gemini 3 Pro Image.
 */
export const BundleCompositionJobSchema = z.object({
  userId: z.string().uuid(),
  brandId: z.string().uuid(),
  bundleName: z.string().min(1).max(200),
  productMockupUrls: z.array(z.string().url()).min(2).max(10),
  brandName: z.string(),
  colorPalette: z.array(z.string()).min(1).max(8),
  compositionStyle: z.enum(['grid', 'lifestyle', 'flatlay', 'showcase']).default('showcase'),
});

/**
 * Video Generation job -- generates product video via Veo 3 (Phase 2).
 */
export const VideoGenerationJobSchema = z.object({
  userId: z.string().uuid(),
  brandId: z.string().uuid(),
  productName: z.string(),
  productMockupUrl: z.string().url(),
  logoUrl: z.string().url(),
  brandName: z.string(),
  colorPalette: z.array(z.string()),
  videoStyle: z.enum(['showcase', 'unboxing', 'lifestyle', 'minimal']).default('showcase'),
  durationSeconds: z.number().int().min(5).max(30).default(10),
});

/**
 * CRM Sync job -- syncs user/brand data to GoHighLevel.
 */
export const CRMSyncJobSchema = z.object({
  userId: z.string().uuid(),
  eventType: z.enum([
    'user.created',
    'wizard.started',
    'wizard.step-completed',
    'wizard.abandoned',
    'brand.completed',
    'subscription.created',
    'subscription.cancelled',
    'logo.generated',
    'mockup.generated',
  ]),
  data: z.record(z.unknown()),
});

/**
 * Email Send job -- sends transactional email via Resend.
 */
export const EmailSendJobSchema = z.object({
  to: z.string().email(),
  template: z.enum([
    'welcome',
    'brand-complete',
    'wizard-abandoned',
    'password-reset',
    'subscription-confirmed',
    'subscription-cancelled',
    'generation-failed',
    'support-ticket',
    'support-request',
    'payment-confirmed',
    'subscription-renewal',
    'credit-low-warning',
  ]),
  data: z.record(z.unknown()),
  userId: z.string().uuid().optional(),
});

/**
 * Image Upload job -- uploads generated image to Supabase Storage.
 */
export const ImageUploadJobSchema = z.object({
  userId: z.string().uuid(),
  brandId: z.string().uuid(),
  assetType: z.enum(['logo', 'mockup', 'bundle', 'social_asset', 'video_thumbnail']),
  sourceUrl: z.string().url(),
  fileName: z.string(),
  mimeType: z.string().default('image/png'),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Print Export job -- generates print-ready artwork from a packaging template.
 */
export const PrintExportJobSchema = z.object({
  userId: z.string().uuid(),
  brandId: z.string().uuid(),
  productId: z.string().uuid(),
  templateId: z.string().uuid(),
  format: z.enum(['pdf', 'png_300dpi']).default('pdf'),
});

/**
 * Cleanup job -- periodic maintenance.
 */
export const CleanupJobSchema = z.object({
  type: z.enum(['expired-jobs', 'orphaned-assets', 'stale-sessions', 'temp-files', 'detect-abandonment']),
});

/**
 * Schema registry -- maps queue name to its Zod schema.
 * @type {Record<string, z.ZodType>}
 */
export const JOB_SCHEMAS = {
  'brand-wizard': BrandWizardJobSchema,
  'logo-generation': LogoGenerationJobSchema,
  'mockup-generation': MockupGenerationJobSchema,
  'bundle-composition': BundleCompositionJobSchema,
  'video-generation': VideoGenerationJobSchema,
  'crm-sync': CRMSyncJobSchema,
  'email-send': EmailSendJobSchema,
  'image-upload': ImageUploadJobSchema,
  'print-export': PrintExportJobSchema,
  'cleanup': CleanupJobSchema,
};
