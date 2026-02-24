// server/src/skills/video-creator/tools.js

import { z } from 'zod';

// ── Input Schemas ──────────────────────────────────────────────────

export const ComposeVideoPromptInput = z.object({
  videoType: z
    .enum(['product-spotlight', 'brand-showcase', 'lifestyle'])
    .describe('Type of video to generate'),
  prompt: z
    .string()
    .min(20)
    .max(500)
    .describe('Veo 3 generation prompt describing the scene'),
  durationSec: z
    .number()
    .int()
    .min(3)
    .max(16)
    .default(8)
    .describe('Video duration in seconds (3-16)'),
  aspectRatio: z
    .enum(['16:9', '9:16', '1:1'])
    .default('16:9')
    .describe('Video aspect ratio'),
  productName: z
    .string()
    .nullable()
    .describe('Product name associated with the video'),
});

export const GenerateProductVideoInput = z.object({
  prompt: z
    .string()
    .min(20)
    .describe('Veo 3 generation prompt (use composeVideoPrompt to build this)'),
  durationSec: z
    .number()
    .int()
    .min(3)
    .max(16)
    .default(8)
    .describe('Video duration in seconds'),
  aspectRatio: z
    .enum(['16:9', '9:16', '1:1'])
    .default('16:9')
    .describe('Video aspect ratio'),
  resolution: z
    .enum(['720p', '1080p'])
    .default('720p')
    .describe('Video resolution'),
});

export const UploadVideoAssetInput = z.object({
  videoUrl: z
    .string()
    .url()
    .describe('URL of the generated video to download and upload to storage'),
  brandId: z
    .string()
    .uuid()
    .describe('Brand ID that owns this video'),
  videoType: z
    .string()
    .describe('Type of video (product-spotlight, brand-showcase, lifestyle)'),
  metadata: z
    .object({
      prompt: z.string(),
      model: z.string(),
      durationSec: z.number(),
      productName: z.string().nullable(),
    })
    .describe('Video generation metadata'),
});

export const SaveVideoAssetsInput = z.object({
  brandId: z
    .string()
    .uuid()
    .describe('Brand ID'),
  userId: z
    .string()
    .uuid()
    .describe('User ID'),
  videos: z
    .array(
      z.object({
        url: z.string().url(),
        thumbnailUrl: z.string().url().nullable(),
        videoType: z.string(),
        durationSec: z.number(),
        prompt: z.string(),
        model: z.string(),
        productName: z.string().nullable(),
      })
    )
    .describe('Array of video assets to save'),
});

// ── Output Schemas ─────────────────────────────────────────────────

export const ComposeVideoPromptOutput = z.object({
  success: z.boolean(),
  videoType: z.string(),
  prompt: z.string(),
});

export const GenerateProductVideoOutput = z.object({
  success: z.boolean(),
  videoUrl: z.string().url().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  durationSec: z.number().nullable(),
  model: z.string(),
  error: z.string().nullable(),
});

export const UploadVideoAssetOutput = z.object({
  success: z.boolean(),
  permanentUrl: z.string().url().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  error: z.string().nullable(),
});

export const SaveVideoAssetsOutput = z.object({
  success: z.boolean(),
  brandId: z.string().uuid(),
  savedVideos: z.array(
    z.object({ assetId: z.string().uuid(), url: z.string().url() })
  ),
  error: z.string().nullable(),
});

// ── Tool Definitions ───────────────────────────────────────────────

/** @type {import('../_shared/types.js').ToolDefinition[]} */
export const toolDefinitions = [
  {
    name: 'composeVideoPrompt',
    description:
      'Compose and validate a Veo 3 prompt for video generation. Pure function, no API call.',
    inputSchema: ComposeVideoPromptInput,
    outputSchema: ComposeVideoPromptOutput,
  },
  {
    name: 'generateProductVideo',
    description:
      'Generate a product showcase video using Veo 3 (Google AI direct API). 3-16 second clips. Cost: ~$0.20-0.50 per video.',
    inputSchema: GenerateProductVideoInput,
    outputSchema: GenerateProductVideoOutput,
  },
  {
    name: 'uploadVideoAsset',
    description:
      'Upload generated video to permanent Supabase Storage.',
    inputSchema: UploadVideoAssetInput,
    outputSchema: UploadVideoAssetOutput,
  },
  {
    name: 'saveVideoAssets',
    description:
      'Save all video assets to the brand_assets table. Call LAST after all videos are uploaded.',
    inputSchema: SaveVideoAssetsInput,
    outputSchema: SaveVideoAssetsOutput,
  },
];
