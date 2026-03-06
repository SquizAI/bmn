// server/src/validation/storefronts.js

import { z } from 'zod';

// ── Reusable Primitives ─────────────────────────────────────────────────────

/** Slug: 3-63 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphen */
const slug = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(63, 'Slug must be at most 63 characters')
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/,
    'Slug must be lowercase letters, numbers, and hyphens (no leading/trailing hyphen)',
  );

/** UUID helper with descriptive error */
const uuid = (label = 'ID') => z.string().uuid(`Invalid ${label}`);

/** Hex color: #RGB or #RRGGBB */
const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a valid hex color (e.g. #FF5733)');

// ── Storefront CRUD (authenticated) ─────────────────────────────────────────

/**
 * POST /api/v1/storefronts
 */
export const storefrontCreateSchema = z.object({
  brandId: uuid('brand ID'),
  slug,
  themeId: uuid('theme ID').optional(),
});

/**
 * PATCH /api/v1/storefronts/:storefrontId
 */
export const storefrontUpdateSchema = z.object({
  slug: slug.optional(),
  themeId: uuid('theme ID').optional(),
  settings: z.record(z.unknown()).optional(),
});

/**
 * URL params: storefrontId
 */
export const storefrontIdParamsSchema = z.object({
  storefrontId: uuid('storefront ID'),
});

// ── Section Management ──────────────────────────────────────────────────────

/**
 * POST /api/v1/storefronts/:storefrontId/sections
 */
export const sectionCreateSchema = z.object({
  sectionType: z.string().min(1, 'Section type is required'),
  title: z.string().max(200).optional(),
  content: z.record(z.unknown()).optional(),
});

/**
 * PATCH /api/v1/storefronts/:storefrontId/sections/:sectionId
 */
export const sectionUpdateSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.record(z.unknown()).optional(),
  isVisible: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
});

/**
 * URL params: storefrontId + sectionId
 */
export const sectionIdParamsSchema = z.object({
  storefrontId: uuid('storefront ID'),
  sectionId: uuid('section ID'),
});

/**
 * PATCH /api/v1/storefronts/:storefrontId/sections/reorder
 */
export const reorderSectionsSchema = z.object({
  sectionIds: z.array(uuid('section ID')).min(1, 'At least one section ID is required'),
});

// ── Testimonials ────────────────────────────────────────────────────────────

/**
 * POST /api/v1/storefronts/:storefrontId/testimonials
 */
export const testimonialCreateSchema = z.object({
  quote: z.string().min(1, 'Quote is required').max(2000),
  authorName: z.string().min(1, 'Author name is required').max(200),
  authorTitle: z.string().max(200).optional(),
});

/**
 * PATCH /api/v1/storefronts/:storefrontId/testimonials/:testimonialId
 */
export const testimonialUpdateSchema = z.object({
  quote: z.string().min(1).max(2000).optional(),
  authorName: z.string().min(1).max(200).optional(),
  authorTitle: z.string().max(200).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isVisible: z.boolean().optional(),
});

/**
 * URL params: storefrontId + testimonialId
 */
export const testimonialIdParamsSchema = z.object({
  storefrontId: uuid('storefront ID'),
  testimonialId: uuid('testimonial ID'),
});

// ── FAQs ────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/storefronts/:storefrontId/faqs
 */
export const faqCreateSchema = z.object({
  question: z.string().min(1, 'Question is required').max(500),
  answer: z.string().min(1, 'Answer is required').max(5000),
});

/**
 * PATCH /api/v1/storefronts/:storefrontId/faqs/:faqId
 */
export const faqUpdateSchema = z.object({
  question: z.string().min(1).max(500).optional(),
  answer: z.string().min(1).max(5000).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isVisible: z.boolean().optional(),
});

/**
 * URL params: storefrontId + faqId
 */
export const faqIdParamsSchema = z.object({
  storefrontId: uuid('storefront ID'),
  faqId: uuid('FAQ ID'),
});

// ── Analytics ───────────────────────────────────────────────────────────────

/**
 * GET /api/v1/storefronts/:storefrontId/analytics (query params)
 */
export const analyticsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).optional(),
});

// ── Custom Domain (Agency tier) ─────────────────────────────────────────────

/**
 * POST /api/v1/storefronts/:storefrontId/domain
 */
export const customDomainCreateSchema = z.object({
  domain: z
    .string()
    .min(1, 'Domain is required')
    .max(253)
    .regex(
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i,
      'Must be a valid domain (e.g. store.example.com)',
    ),
});

// ── White-Label Settings (Agency tier) ──────────────────────────────────────

/**
 * PATCH /api/v1/storefronts/:storefrontId/white-label
 */
export const whiteLabelUpdateSchema = z.object({
  logoUrl: z.string().url('Must be a valid URL').optional(),
  faviconUrl: z.string().url('Must be a valid URL').optional(),
  brandName: z.string().min(1).max(100).optional(),
  accentColor: hexColor.optional(),
});

// ══════════════════════════════════════════════════════════════════════════════
// Public Store Schemas (no auth required)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * URL params: slug
 */
export const storeSlugParamsSchema = z.object({
  slug,
});

/**
 * URL params: slug + productId
 */
export const productIdParamsSchema = z.object({
  slug,
  productId: uuid('product ID'),
});

/**
 * URL params: slug + sessionId
 */
export const cartSessionParamsSchema = z.object({
  slug,
  sessionId: z.string().min(1, 'Session ID is required'),
});

/**
 * POST /api/v1/store/:slug/cart
 */
export const cartCreateSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  items: z
    .array(
      z.object({
        productId: uuid('product ID'),
        quantity: z.number().int().min(1, 'Quantity must be at least 1').max(99, 'Quantity cannot exceed 99'),
      }),
    )
    .min(1, 'At least one item is required'),
});

/**
 * POST /api/v1/store/:slug/contact
 */
export const contactCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Must be a valid email address'),
  message: z.string().min(1, 'Message is required').max(5000),
});

/**
 * POST /api/v1/store/:slug/checkout
 */
export const checkoutCreateSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  email: z.string().email('Must be a valid email address'),
});

/**
 * POST /api/v1/store/:slug/analytics/pageview
 */
export const pageviewSchema = z.object({
  page: z.string().min(1, 'Page is required').max(500),
  referrer: z.string().max(2000).optional(),
});

/**
 * GET /api/v1/store/:slug/products (query params)
 */
export const storeProductsQuerySchema = z.object({
  category: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
