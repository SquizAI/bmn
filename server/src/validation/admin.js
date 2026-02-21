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
