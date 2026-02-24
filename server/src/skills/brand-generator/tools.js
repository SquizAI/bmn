// server/src/skills/brand-generator/tools.js

import { z } from 'zod';

// ─── Input Schemas ───────────────────────────────────────────────

export const GenerateBrandVisionInput = z.object({
  brandName: z.string().nullable().describe('Brand name if already chosen, or null to skip'),
  vision: z.string().min(10).max(500).describe('Brand vision statement (2-3 sentences)'),
  mission: z.string().min(10).max(300).describe('Brand mission statement (1-2 sentences)'),
  archetype: z.enum([
    'The Innocent', 'The Explorer', 'The Sage', 'The Hero',
    'The Outlaw', 'The Magician', 'The Everyperson', 'The Lover',
    'The Jester', 'The Caregiver', 'The Creator', 'The Ruler',
  ]).describe('Primary brand archetype from 12 Jungian archetypes'),
  secondaryArchetype: z.enum([
    'The Innocent', 'The Explorer', 'The Sage', 'The Hero',
    'The Outlaw', 'The Magician', 'The Everyperson', 'The Lover',
    'The Jester', 'The Caregiver', 'The Creator', 'The Ruler',
  ]).nullable().describe('Optional secondary archetype for nuance'),
  values: z.array(z.string().min(1).max(50)).min(3).max(5).describe('3-5 core brand values'),
  targetAudience: z.string().min(10).max(300).describe('Target audience description'),
  voiceTone: z.string().min(5).max(200).describe('Brand voice and tone description'),
  differentiator: z.string().min(10).max(300).describe('What makes this brand unique'),
});

export const GenerateColorPaletteInput = z.object({
  colors: z.array(z.object({
    hex: z.string().regex(/^#[0-9a-fA-F]{6}$/).describe('Hex color code'),
    name: z.string().describe('Human-readable color name'),
    role: z.enum(['primary', 'secondary', 'accent', 'background', 'surface', 'text']).describe('Color role in the design system'),
  })).length(6).describe('Exactly 6 colors with defined roles'),
  mood: z.string().describe('Color mood description (e.g., "warm and earthy with a vibrant accent")'),
  inspiration: z.string().describe('What inspired this palette (reference to social analysis)'),
});

export const GenerateTypographyInput = z.object({
  primary: z.object({
    fontFamily: z.string().describe('Google Fonts font family name for headings'),
    weight: z.string().describe('Recommended weight (e.g., "700", "Bold")'),
    style: z.string().describe('Font style category (e.g., "serif", "sans-serif", "display")'),
    reason: z.string().describe('Why this font fits the brand'),
  }),
  secondary: z.object({
    fontFamily: z.string().describe('Google Fonts font family name for body text'),
    weight: z.string().describe('Recommended weight (e.g., "400", "Regular")'),
    style: z.string().describe('Font style category'),
    reason: z.string().describe('Why this font complements the primary'),
  }),
  pairingRationale: z.string().describe('Why these two fonts work together'),
});

export const SaveBrandIdentityInput = z.object({
  brandId: z.string().uuid(),
  userId: z.string().uuid(),
  vision: z.any().describe('Complete vision object from generateBrandVision'),
  colorPalette: z.any().describe('Complete palette object from generateColorPalette'),
  typography: z.any().describe('Complete typography object from generateTypography'),
});

// ─── Output Schemas ──────────────────────────────────────────────

export const BrandVisionOutput = z.object({
  success: z.boolean(),
  vision: z.object({
    brandName: z.string().nullable(),
    vision: z.string(),
    mission: z.string(),
    archetype: z.string(),
    secondaryArchetype: z.string().nullable(),
    values: z.array(z.string()),
    targetAudience: z.string(),
    voiceTone: z.string(),
    differentiator: z.string(),
  }),
});

export const ColorPaletteOutput = z.object({
  success: z.boolean(),
  palette: z.object({
    colors: z.array(z.object({
      hex: z.string(),
      name: z.string(),
      role: z.string(),
    })),
    mood: z.string(),
    inspiration: z.string(),
  }),
  contrastWarnings: z.array(z.string()).optional(),
});

export const TypographyOutput = z.object({
  success: z.boolean(),
  typography: z.object({
    primary: z.object({ fontFamily: z.string(), weight: z.string(), style: z.string(), reason: z.string() }),
    secondary: z.object({ fontFamily: z.string(), weight: z.string(), style: z.string(), reason: z.string() }),
    pairingRationale: z.string(),
  }),
  fontWarnings: z.array(z.string()).optional(),
});

export const SaveBrandIdentityOutput = z.object({
  success: z.boolean(),
  brandId: z.string().uuid(),
  identity: z.object({
    vision: z.any(),
    colorPalette: z.any(),
    typography: z.any(),
  }),
  error: z.string().nullable(),
});

// ─── Tool Definitions ────────────────────────────────────────────

/** @type {import('../_shared/types.js').ToolDefinition[]} */
export const tools = [
  {
    name: 'generateBrandVision',
    description: 'Structure and validate the brand vision, mission, archetype, values, and target audience. The AI agent generates the content directly through reasoning — this tool validates the structure and returns it formatted. Call this FIRST.',
    inputSchema: GenerateBrandVisionInput,
    outputSchema: BrandVisionOutput,
  },
  {
    name: 'generateColorPalette',
    description: 'Structure and validate a 6-color brand palette with defined roles (primary, secondary, accent, background, surface, text). Includes WCAG AA contrast validation for text/background combinations. The AI agent selects colors through reasoning based on the social analysis aesthetic. Call this SECOND.',
    inputSchema: GenerateColorPaletteInput,
    outputSchema: ColorPaletteOutput,
  },
  {
    name: 'generateTypography',
    description: 'Structure and validate typography recommendations with primary (heading) and secondary (body) Google Fonts. Validates font availability on Google Fonts. The AI agent selects fonts through reasoning based on the brand archetype and mood. Call this THIRD.',
    inputSchema: GenerateTypographyInput,
    outputSchema: TypographyOutput,
  },
  {
    name: 'saveBrandIdentity',
    description: 'Save the complete brand identity (vision + palette + typography) to Supabase. Call this LAST after all other tools.',
    inputSchema: SaveBrandIdentityInput,
    outputSchema: SaveBrandIdentityOutput,
  },
];
