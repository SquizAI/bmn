// shared/schemas/brand.js
//
// Zod schemas for Brand records.
// Shared between client (TypeScript) and server (JavaScript + JSDoc).

import { z } from 'zod';

// ---- Brand Status -----------------------------------------------------------

export const BrandStatusEnum = z.enum([
  'draft',
  'active',
  'archived',
]);

// ---- Wizard Step ------------------------------------------------------------

export const WizardStepEnum = z.enum([
  'social-analysis',
  'brand-identity',
  'brand-names',
  'product-recommendations',
  'product-selection',
  'logo-generation',
  'mockup-generation',
  'review',
  'complete',
]);

// ---- Brand Record -----------------------------------------------------------

export const BrandSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(200),
  tagline: z.string().max(500).nullable().default(null),
  vision: z.string().max(2000).nullable().default(null),
  status: BrandStatusEnum,
  wizardStep: WizardStepEnum,
  wizardState: z.record(z.string(), z.unknown()).default({}),
  agentSessionId: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ---- Create Brand Request ---------------------------------------------------

export const CreateBrandRequestSchema = z.object({
  name: z.string().min(1).max(200).default('Untitled Brand'),
});

// ---- Update Brand Request ---------------------------------------------------

export const UpdateBrandRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  tagline: z.string().max(500).nullable().optional(),
  vision: z.string().max(2000).nullable().optional(),
  status: BrandStatusEnum.optional(),
});

// ---- Brand List Item (summary for dashboard) --------------------------------

export const BrandListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  tagline: z.string().nullable(),
  status: BrandStatusEnum,
  wizardStep: WizardStepEnum,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
