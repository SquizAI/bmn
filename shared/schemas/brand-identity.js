// shared/schemas/brand-identity.js

import { z } from 'zod';

// ── Name Generation Schemas ────────────────────────────────────────

export const NameSuggestionSchema = z.object({
  name: z.string().min(1).max(100),
  technique: z.enum(['coined', 'portmanteau', 'metaphor', 'descriptive', 'abstract', 'compound', 'acronym', 'evocative', 'invented']),
  rationale: z.string(),
  pronunciation: z.string().optional(),
  scores: z.object({
    memorability: z.number().min(1).max(10),
    brandability: z.number().min(1).max(10),
  }),
  domain: z.object({
    com: z.enum(['available', 'taken', 'unchecked']),
    co: z.enum(['available', 'taken', 'unchecked']),
    io: z.enum(['available', 'taken', 'unchecked']),
    bestAvailable: z.string().nullable(),
  }),
  socialHandles: z.object({
    instagram: z.enum(['available', 'taken', 'unchecked']),
    tiktok: z.enum(['available', 'taken', 'unchecked']),
    youtube: z.enum(['available', 'taken', 'unchecked']),
  }).optional(),
  trademark: z.object({
    status: z.enum(['clear', 'potential-conflict', 'conflict-found', 'unchecked']),
    risk: z.enum(['low', 'medium', 'high', 'unchecked']),
    notes: z.string().nullable(),
  }),
});

export const NameGenerationResultSchema = z.object({
  suggestions: z.array(NameSuggestionSchema),
  topRecommendation: z.string().nullable(),
  disclaimer: z.string(),
});

export const GenerateNamesInputSchema = z.object({
  brandId: z.string().min(1),
  archetype: z.string().optional(),
  traits: z.array(z.string()).optional(),
  industry: z.string().optional(),
  targetAudience: z.string().optional(),
  style: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

export const SelectBrandNameSchema = z.object({
  brandId: z.string().min(1),
  name: z.string().min(1).max(100),
  isCustom: z.boolean().default(false),
});

// ── Brand Identity Direction Schemas ────────────────────────────────

export const BrandDirectionSchema = z.object({
  id: z.string(),
  label: z.string(),
  tagline: z.string(),
  archetype: z.object({
    name: z.string(),
    score: z.number().min(0).max(1),
    description: z.string(),
  }),
  vision: z.string(),
  values: z.array(z.string()).min(3).max(5),
  colorPalette: z.array(z.object({
    hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    name: z.string(),
    role: z.string(),
  })).min(4),
  fonts: z.object({
    heading: z.object({ family: z.string(), weight: z.string() }),
    body: z.object({ family: z.string(), weight: z.string() }),
  }),
  voice: z.object({
    tone: z.string(),
    vocabularyLevel: z.enum(['casual', 'conversational', 'professional', 'formal']),
    communicationStyle: z.string(),
  }),
  logoStyle: z.object({
    style: z.enum(['minimal', 'bold', 'vintage', 'modern', 'playful']),
    reasoning: z.string(),
  }),
  narrative: z.string(),
});

export const BrandDirectionsResultSchema = z.object({
  directions: z.array(BrandDirectionSchema).min(1).max(3),
  socialContext: z.string().optional(),
});

// ── Brand Voice Schemas ────────────────────────────────────────────

export const BrandVoiceSamplesSchema = z.object({
  instagramCaption: z.string(),
  productDescription: z.string(),
  emailSubjectLine: z.string(),
  taglines: z.array(z.string()).min(3).max(5),
});

// ── Brand Tone Schemas ─────────────────────────────────────────────

export const BrandToneSchema = z.object({
  casualToFormal: z.number().min(0).max(100).default(50),
  playfulToSerious: z.number().min(0).max(100).default(50),
  boldToSubtle: z.number().min(0).max(100).default(50),
  traditionalToModern: z.number().min(0).max(100).default(50),
});
