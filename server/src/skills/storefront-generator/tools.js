// server/src/skills/storefront-generator/tools.js

import { z } from 'zod';

// ── Input Schema ────────────────────────────────────────────────

export const StorefrontGenerationInput = z.object({
  brandIdentity: z.object({
    name: z.string().min(1),
    tagline: z.string().optional().default(''),
    mission: z.string().optional().default(''),
    vision: z.string().optional().default(''),
    voiceTone: z.string().optional().default('professional yet approachable'),
    personalityTraits: z.array(z.string()).optional().default([]),
    colors: z.array(z.string()).optional().default([]),
    industry: z.string().optional().default(''),
    targetAudience: z.string().optional().default(''),
    products: z.array(z.object({
      name: z.string(),
      category: z.string().optional().default(''),
      description: z.string().optional().default(''),
      retailPrice: z.number().optional(),
    })).optional().default([]),
    logoUrl: z.string().optional().default(''),
  }),
  theme: z.enum(['bold', 'story', 'conversion']).default('conversion'),
});

// ── Output Schema ───────────────────────────────────────────────

const StepSchema = z.object({
  title: z.string(),
  description: z.string(),
});

const ReasonSchema = z.object({
  icon: z.string(),
  title: z.string(),
  description: z.string(),
});

const TrustBadgeSchema = z.object({
  icon: z.string(),
  text: z.string(),
});

const TestimonialSchema = z.object({
  author_name: z.string(),
  author_title: z.string(),
  body: z.string(),
  rating: z.number().int().min(1).max(5),
});

const FaqSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

export const StorefrontGenerationOutput = z.object({
  hero: z.object({
    headline: z.string(),
    subheadline: z.string(),
    ctaText: z.string(),
    ctaUrl: z.string().default('#products'),
  }),
  welcome: z.object({
    title: z.string(),
    body: z.string(),
  }),
  'bundle-grid': z.object({
    title: z.string(),
    subtitle: z.string(),
  }),
  steps: z.object({
    title: z.string(),
    subtitle: z.string(),
    steps: z.array(StepSchema).length(3),
  }),
  'why-bundles': z.object({
    title: z.string(),
    reasons: z.array(ReasonSchema).length(3),
  }),
  quality: z.object({
    title: z.string(),
    body: z.string(),
    badges: z.array(z.string()).min(3).max(4),
  }),
  testimonials: z.array(TestimonialSchema).length(4),
  faq: z.array(FaqSchema).min(6).max(7),
  about: z.object({
    title: z.string(),
    subtitle: z.string(),
    body: z.string(),
    ctaText: z.string(),
    ctaUrl: z.string().default('#products'),
  }),
  contact: z.object({
    title: z.string(),
    subtitle: z.string(),
  }),
  'trust-bar': z.object({
    items: z.array(TrustBadgeSchema).min(3).max(4),
  }),
  products: z.object({
    title: z.string(),
    subtitle: z.string(),
  }),
});
