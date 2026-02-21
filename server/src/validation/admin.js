// server/src/validation/admin.js

import { z } from 'zod';

/**
 * GET /api/v1/admin/users (query params)
 */
export const adminUserQuerySchema = z.object({
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * POST /api/v1/admin/products
 */
export const adminProductCreateSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200),
  sku: z.string().min(1, 'SKU is required').max(50),
  category: z.string().min(1, 'Category is required').max(50),
  description: z.string().max(1000).optional(),
  base_cost: z.number().positive('Base cost must be positive'),
  suggested_price: z.number().positive('Suggested price must be positive'),
  mockup_template_url: z.string().url().optional(),
  is_active: z.boolean().default(true),
  tier_id: z.string().uuid().nullable().optional(),
});

/**
 * PATCH /api/v1/admin/products/:productId
 */
export const adminProductUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sku: z.string().min(1).max(50).optional(),
  category: z.string().min(1).max(50).optional(),
  description: z.string().max(1000).optional(),
  base_cost: z.number().positive().optional(),
  suggested_price: z.number().positive().optional(),
  mockup_template_url: z.string().url().optional(),
  is_active: z.boolean().optional(),
  tier_id: z.string().uuid().nullable().optional(),
});

// ── Product Tier Schemas ─────────────────────────────────────────────

const minSubscriptionTierEnum = z.enum(['free', 'starter', 'pro', 'agency']);

/**
 * POST /api/v1/admin/product-tiers
 */
export const adminTierCreateSchema = z.object({
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens only'),
  name: z.string().min(1, 'Tier name is required').max(100),
  display_name: z.string().min(1, 'Display name is required').max(200),
  description: z.string().max(1000).optional(),
  sort_order: z.number().int().min(0).default(0),
  min_subscription_tier: minSubscriptionTierEnum.default('free'),
  margin_multiplier: z.number().positive('Margin multiplier must be positive').default(1.00),
  badge_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a hex color').default('#6B7280'),
  badge_label: z.string().max(50).default(''),
});

/**
 * PATCH /api/v1/admin/product-tiers/:tierId
 */
export const adminTierUpdateSchema = z.object({
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
  name: z.string().min(1).max(100).optional(),
  display_name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  sort_order: z.number().int().min(0).optional(),
  min_subscription_tier: minSubscriptionTierEnum.optional(),
  margin_multiplier: z.number().positive().optional(),
  badge_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  badge_label: z.string().max(50).optional(),
  is_active: z.boolean().optional(),
});

/**
 * PATCH /api/v1/admin/product-tiers/:tierId/assign
 * Bulk assign products to a tier.
 */
export const adminTierAssignSchema = z.object({
  product_ids: z.array(z.string().uuid()).min(1, 'At least one product ID required').max(100),
});

// ── Packaging Template Schemas ─────────────────────────────────────────

/**
 * Branding zone position (percentage-based coordinates within the template).
 */
const brandingZonePositionSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
});

/**
 * Single branding zone definition.
 */
const brandingZoneSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  type: z.enum(['logo', 'text', 'color_fill', 'pattern']),
  position: brandingZonePositionSchema,
  constraints: z.record(z.unknown()).default({}),
  style: z.record(z.unknown()).default({}),
});

/**
 * Print specifications for a packaging template.
 */
const printSpecsSchema = z.object({
  dpi: z.number().int().min(72).max(600).default(300),
  bleed_mm: z.number().min(0).max(20).default(3),
  safe_area_mm: z.number().min(0).max(20).default(5),
  color_space: z.enum(['RGB', 'CMYK']).default('CMYK'),
  print_width_mm: z.number().positive().optional(),
  print_height_mm: z.number().positive().optional(),
}).passthrough();

/**
 * POST /api/v1/admin/templates
 */
export const adminTemplateCreateSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens only'),
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(50),
  description: z.string().max(1000).optional(),
  template_image_url: z.string().url(),
  template_width_px: z.number().int().positive().default(1024),
  template_height_px: z.number().int().positive().default(1024),
  branding_zones: z.array(brandingZoneSchema).min(1).max(20),
  print_specs: printSpecsSchema.optional(),
  ai_prompt_template: z.string().max(5000).optional(),
  reference_images: z.array(z.string().url()).max(5).optional(),
});

/**
 * PATCH /api/v1/admin/templates/:templateId
 */
export const adminTemplateUpdateSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  name: z.string().min(1).max(200).optional(),
  category: z.string().min(1).max(50).optional(),
  description: z.string().max(1000).optional(),
  template_image_url: z.string().url().optional(),
  template_width_px: z.number().int().positive().optional(),
  template_height_px: z.number().int().positive().optional(),
  branding_zones: z.array(brandingZoneSchema).min(1).max(20).optional(),
  print_specs: printSpecsSchema.optional(),
  ai_prompt_template: z.string().max(5000).optional(),
  reference_images: z.array(z.string().url()).max(5).optional(),
  is_active: z.boolean().optional(),
});
