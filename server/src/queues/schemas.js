// server/src/queues/schemas.js

import { z } from 'zod';

/**
 * Social Analysis job -- chunked AI analysis of scraped social data.
 * The controller scrapes data synchronously, then dispatches this job
 * for the heavy AI processing. The worker emits Socket.io progress events.
 */
export const SocialAnalysisJobSchema = z.object({
  userId: z.string().uuid(),
  brandId: z.string().uuid(),
  socialHandles: z.object({
    instagram: z.string().optional(),
    tiktok: z.string().optional(),
    youtube: z.string().optional(),
    twitter: z.string().optional(),
    facebook: z.string().optional(),
    websiteUrl: z.string().optional(),
  }),
  /** Structured profile data from Apify (null if scraper unavailable) */
  scrapedData: z.unknown().nullable(),
  /** Rich page content from Firecrawl (null if unavailable) */
  firecrawlData: z.unknown().nullable(),
  /** Brand name (null if not yet set) */
  brandName: z.string().nullable(),
});

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
 * Logo Generation job -- template-driven generation via Recraft V4.
 * Uses JSON logo templates (archetype × style) for consistent output.
 * All results are vectorized to SVG (PNG fallback auto-vectorized).
 */
export const LogoGenerationJobSchema = z.object({
  userId: z.string().uuid(),
  brandId: z.string().uuid(),
  brandName: z.string().min(1).max(200),
  logoStyle: z.enum(['minimal', 'bold', 'vintage', 'modern', 'playful']),
  colorPalette: z.array(z.string()).min(1).max(8),
  brandVision: z.string().max(2000),
  archetype: z.string().max(200).optional(),
  industry: z.string().max(200).optional(),
  count: z.number().int().min(1).max(8).default(4),
  variations: z.array(z.enum(['icon', 'wordmark', 'combination', 'emblem', 'lettermark', 'abstract'])).min(1).max(6).optional(),
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
    'org-invite',
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
 * Content Generation job -- generates social media content using AI.
 */
export const ContentGenJobSchema = z.object({
  brandId: z.string().uuid(),
  userId: z.string().uuid(),
  platform: z.enum(['instagram', 'tiktok', 'twitter', 'general']),
  contentType: z.enum(['post', 'story', 'reel_script', 'announcement', 'promotional']),
  topic: z.string().max(1000).optional(),
  tone: z.string().max(200),
});

/**
 * Email Campaign job -- handles automated email marketing campaigns.
 */
export const EmailCampaignJobSchema = z.object({
  type: z.enum(['welcome_sequence', 'reengagement', 'promotional']),
  campaignId: z.string().uuid(),
  userId: z.string().uuid(),
  brandId: z.string().uuid().optional(),
  step: z.number().int().min(0).default(0),
});

/**
 * Analytics job -- recalculates Brand Health Score or other analytics tasks.
 */
export const AnalyticsJobSchema = z.object({
  type: z.enum(['brand-health-score', 'health-score-recalculation']),
  brandId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});

/**
 * Storefront Generation job -- AI-powered one-click storefront content creation.
 * Uses Claude Haiku 4.5 to generate all section content, testimonials, and FAQs.
 */
export const StorefrontGenerationJobSchema = z.object({
  userId: z.string().uuid(),
  brandId: z.string().uuid(),
  storefrontId: z.string().uuid(),
  themeId: z.string().uuid().nullable().optional(),
  template: z.enum(['bold', 'story', 'conversion']),
  brandIdentity: z.object({
    name: z.string().min(1),
    tagline: z.string().optional(),
    mission: z.string().optional(),
    vision: z.string().optional(),
    voiceTone: z.string().optional(),
    personalityTraits: z.array(z.string()).optional(),
    colors: z.array(z.string()).optional(),
    industry: z.string().optional(),
    targetAudience: z.string().optional(),
    products: z.array(z.object({
      name: z.string(),
      category: z.string().optional(),
      description: z.string().optional(),
      retailPrice: z.number().optional(),
    })).optional(),
    logoUrl: z.string().optional(),
  }),
});

/**
 * Dead Letter job -- permanently failed jobs forwarded from other queues.
 * Contains the original job data plus failure metadata for inspection and manual retry.
 */
export const DeadLetterJobSchema = z.object({
  /** Original queue the job came from */
  originalQueue: z.string(),
  /** Original BullMQ job ID */
  originalJobId: z.string(),
  /** Original job name */
  originalJobName: z.string(),
  /** Original job payload */
  originalData: z.record(z.unknown()),
  /** Error message from the final failed attempt */
  errorMessage: z.string(),
  /** Error stack trace (if available) */
  errorStack: z.string().optional(),
  /** Total attempts made before exhaustion */
  attemptsMade: z.number().int(),
  /** Max attempts configured for the original queue */
  maxAttempts: z.number().int(),
  /** Timestamp of the first attempt (ISO string) */
  firstAttemptAt: z.string().optional(),
  /** Timestamp of the final failure (ISO string) */
  failedAt: z.string(),
  /** User ID from original job (if present) */
  userId: z.string().uuid().optional(),
  /** Brand ID from original job (if present) */
  brandId: z.string().uuid().optional(),
});

/**
 * Schema registry -- maps queue name to its Zod schema.
 * @type {Record<string, z.ZodType>}
 */
export const JOB_SCHEMAS = {
  'social-analysis': SocialAnalysisJobSchema,
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
  'content-gen': ContentGenJobSchema,
  'email-campaign': EmailCampaignJobSchema,
  'analytics': AnalyticsJobSchema,
  'storefront-generation': StorefrontGenerationJobSchema,
  'dead-letter': DeadLetterJobSchema,
};
