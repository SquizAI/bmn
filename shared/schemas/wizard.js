// shared/schemas/wizard.js
//
// Zod schemas for Wizard step data and transitions.
// Shared between client (TypeScript) and server (JavaScript + JSDoc).

import { z } from 'zod';

// ---- Wizard Steps -----------------------------------------------------------

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

// ---- Step ordering (used by both client navigation and server validation) ---

/** @type {readonly string[]} */
export const WIZARD_STEP_ORDER = [
  'social-analysis',
  'brand-identity',
  'brand-names',
  'product-recommendations',
  'product-selection',
  'logo-generation',
  'mockup-generation',
  'review',
  'complete',
];

// ---- Save Step Data Request -------------------------------------------------

export const SaveStepDataRequestSchema = z.object({
  step: WizardStepEnum,
  data: z.record(z.string(), z.unknown()),
});

// ---- Wizard State (full state object stored in brands.wizard_state) ----------

export const WizardStateSchema = z.object({
  'social-analysis': z.record(z.string(), z.unknown()).optional(),
  'brand-identity': z.record(z.string(), z.unknown()).optional(),
  'brand-names': z.record(z.string(), z.unknown()).optional(),
  'product-recommendations': z.record(z.string(), z.unknown()).optional(),
  'product-selection': z.record(z.string(), z.unknown()).optional(),
  'logo-generation': z.record(z.string(), z.unknown()).optional(),
  'mockup-generation': z.record(z.string(), z.unknown()).optional(),
  'review': z.record(z.string(), z.unknown()).optional(),
}).passthrough();

// ---- Wizard Progress (sent to client for progress indicator) ----------------

export const WizardProgressSchema = z.object({
  currentStep: WizardStepEnum,
  completedSteps: z.array(WizardStepEnum),
  totalSteps: z.number().int(),
  percentComplete: z.number().min(0).max(100),
});

// ---- Resume Wizard Request --------------------------------------------------

export const ResumeWizardRequestSchema = z.object({
  token: z.string().min(1),
});

// ---- Wizard Job Status (real-time via Socket.io) ----------------------------

export const WizardJobStatusEnum = z.enum([
  'queued',
  'active',
  'completed',
  'failed',
]);

export const WizardJobStatusEventSchema = z.object({
  jobId: z.string(),
  brandId: z.string().uuid(),
  step: WizardStepEnum,
  status: WizardJobStatusEnum,
  progress: z.number().min(0).max(100).optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});
