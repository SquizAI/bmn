// server/src/skills/logo-creator/tools.js

import { z } from 'zod';

// ── Input Schemas ────────────────────────────────────────────────

export const ComposeLogoPromptInput = z.object({
  variationType: z.enum(['iconMark', 'wordmark', 'combinationMark', 'abstract']).describe('Logo variation type'),
  prompt: z.string().min(20).max(500).describe('Complete Recraft V4 prompt for this logo variation'),
  brandName: z.string().nullable().describe('Brand name (required for wordmark and combinationMark)'),
  colors: z.array(z.string()).min(1).max(6).optional().describe('Brand color hex codes (e.g., ["#2D3436", "#00CEC9"])'),
  designRationale: z.string().describe('Brief explanation of why this design direction fits the brand'),
});

export const GenerateLogoInput = z.object({
  prompt: z.string().min(20).describe('Recraft V4 generation prompt'),
  imageSize: z.enum(['square_hd', 'square', 'landscape_4_3', 'landscape_16_9', 'portrait_4_3', 'portrait_16_9']).default('square_hd').describe('Image size preset (default square_hd for logos)'),
  colors: z.array(z.string()).optional().describe('Brand hex colors to pass to Recraft (e.g. ["#2D3436", "#00CEC9"])'),
});

export const RefineLogoInput = z.object({
  originalPrompt: z.string().describe('Original generation prompt'),
  refinementInstructions: z.string().describe('What to change about the logo'),
  refinementRound: z.number().int().min(1).max(3).describe('Which refinement round (1-3)'),
  imageSize: z.enum(['square_hd', 'square', 'landscape_4_3', 'landscape_16_9', 'portrait_4_3', 'portrait_16_9']).default('square_hd'),
  colors: z.array(z.string()).optional().describe('Brand hex colors'),
});

export const UploadLogoAssetInput = z.object({
  imageUrl: z.string().url().describe('Temporary FAL.ai image URL to download and re-upload'),
  brandId: z.string().uuid(),
  variationType: z.string().describe('Logo variation type for filename'),
  metadata: z.object({
    prompt: z.string(),
    model: z.string(),
    contentType: z.string().optional(),
    refinementRound: z.number().optional(),
  }),
});

export const SaveLogoAssetsInput = z.object({
  brandId: z.string().uuid(),
  userId: z.string().uuid(),
  logos: z.array(z.object({
    url: z.string().url().describe('Permanent storage URL'),
    thumbnailUrl: z.string().url().nullable(),
    variationType: z.string(),
    prompt: z.string(),
    designRationale: z.string(),
    model: z.string(),
    contentType: z.string().optional(),
  })).min(1).max(8),
});

// ── Output Schemas ───────────────────────────────────────────────

export const ComposeLogoPromptOutput = z.object({
  success: z.boolean(),
  variationType: z.string(),
  prompt: z.string(),
  designRationale: z.string(),
});

export const GenerateLogoOutput = z.object({
  success: z.boolean(),
  imageUrl: z.string().url().nullable().describe('Temporary FAL.ai-hosted image URL'),
  contentType: z.string().nullable(),
  model: z.string(),
  error: z.string().nullable(),
});

export const RefineLogoOutput = z.object({
  success: z.boolean(),
  imageUrl: z.string().url().nullable(),
  refinedPrompt: z.string(),
  refinementRound: z.number(),
  contentType: z.string().nullable(),
  model: z.string(),
  error: z.string().nullable(),
});

export const UploadLogoAssetOutput = z.object({
  success: z.boolean(),
  permanentUrl: z.string().url().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  storagePath: z.string().nullable(),
  error: z.string().nullable(),
});

export const SaveLogoAssetsOutput = z.object({
  success: z.boolean(),
  brandId: z.string().uuid(),
  savedLogos: z.array(z.object({
    assetId: z.string().uuid(),
    url: z.string().url(),
    variationType: z.string(),
  })),
  error: z.string().nullable(),
});

// ── Tool Definitions ─────────────────────────────────────────────

/** @type {import('../_shared/types.js').ToolDefinition[]} */
export const tools = [
  {
    name: 'composeLogoPrompt',
    description: 'Compose and validate a Recraft V4 prompt for a specific logo variation. The AI agent crafts the prompt through reasoning -- this tool structures and validates it. Returns the composed prompt ready for generation.',
    inputSchema: ComposeLogoPromptInput,
    outputSchema: ComposeLogoPromptOutput,
  },
  {
    name: 'generateLogo',
    description: 'Generate a logo image using Recraft V4 text-to-vector via FAL.ai queue API. Submits the prompt, polls for completion (up to 60s), and returns a temporary SVG image URL. Cost: ~$0.08 per generation.',
    inputSchema: GenerateLogoInput,
    outputSchema: GenerateLogoOutput,
  },
  {
    name: 'refineLogo',
    description: 'Refine an existing logo by modifying the original prompt and regenerating. Appends refinement instructions to the original prompt. Maximum 3 refinement rounds per logo.',
    inputSchema: RefineLogoInput,
    outputSchema: RefineLogoOutput,
  },
  {
    name: 'uploadLogoAsset',
    description: 'Download a generated logo from its temporary FAL.ai URL and upload it to permanent storage (Supabase Storage). Returns a permanent URL.',
    inputSchema: UploadLogoAssetInput,
    outputSchema: UploadLogoAssetOutput,
  },
  {
    name: 'saveLogoAssets',
    description: 'Save all generated logo assets to the brand_assets table in Supabase. Call this LAST after all logos are generated and uploaded. Updates the brand wizard_step.',
    inputSchema: SaveLogoAssetsInput,
    outputSchema: SaveLogoAssetsOutput,
  },
];
