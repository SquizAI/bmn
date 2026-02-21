// shared/schemas/packaging-template.js
//
// Zod schemas for packaging templates, branding zones, and print specs.
// Shared between client (TypeScript) and server (JavaScript + JSDoc).

import { z } from 'zod';

// ---- Branding Zone Position -------------------------------------------------

export const BrandingZonePositionSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
});

// ---- Branding Zone ----------------------------------------------------------

export const BrandingZoneSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  type: z.enum(['logo', 'text', 'color_fill', 'pattern']),
  position: BrandingZonePositionSchema,
  constraints: z.record(z.unknown()).default({}),
  style: z.record(z.unknown()).default({}),
});

// ---- Print Specifications ---------------------------------------------------

export const PrintSpecsSchema = z.object({
  dpi: z.number().int().min(72).max(600).default(300),
  bleed_mm: z.number().min(0).max(20).default(3),
  safe_area_mm: z.number().min(0).max(20).default(5),
  color_space: z.enum(['RGB', 'CMYK']).default('CMYK'),
  print_width_mm: z.number().positive().optional(),
  print_height_mm: z.number().positive().optional(),
  label_shape: z.enum(['rectangle', 'circle', 'oval', 'custom']).default('rectangle'),
  dieline_url: z.string().url().nullable().default(null),
  file_formats: z.array(z.enum(['pdf', 'png', 'svg'])).default(['pdf', 'png']),
});

// ---- Packaging Template (full record) ---------------------------------------

export const PackagingTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(50),
  description: z.string().max(1000).optional(),
  template_image_url: z.string().min(1),
  template_width_px: z.number().int().positive().default(1024),
  template_height_px: z.number().int().positive().default(1024),
  branding_zones: z.array(BrandingZoneSchema).min(1).max(20),
  print_specs: PrintSpecsSchema.optional(),
  ai_prompt_template: z.string().max(5000).default(''),
  reference_images: z.array(z.string()).max(5).default([]),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

// ---- Create / Update variants -----------------------------------------------

export const PackagingTemplateCreateSchema = PackagingTemplateSchema.omit({ id: true });

export const PackagingTemplateUpdateSchema = PackagingTemplateSchema.partial().omit({ id: true });
