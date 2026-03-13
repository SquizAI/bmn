// server/src/skills/mockup-renderer/tools.js

import { z } from 'zod';

// ── Input Schemas ────────────────────────────────────────────────

export const GenerateProductMockupInput = z.object({
  prompt: z.string().min(20).max(1000).describe('GPT Image 1.5 prompt for product mockup'),
  productSku: z.string().describe('Product SKU for tracking'),
  productName: z.string().describe('Product display name'),
  logoUrl: z.string().url().describe('URL of the selected logo to reference in prompt'),
  size: z.enum(['1024x1024', '1024x1536', '1536x1024']).default('1024x1024'),
  quality: z.enum(['standard', 'hd']).default('hd'),
});

export const GenerateTextOnProductInput = z.object({
  prompt: z.string().min(20).max(1000).describe('Gemini 3 Pro Image prompt with text in quotes'),
  brandText: z.string().describe('Exact text to render on the product'),
  productSku: z.string(),
  productName: z.string(),
  aspectRatio: z.enum(['1:1', '4:3', '3:4', '16:9', '9:16']).default('1:1'),
  styleType: z.enum(['general', 'realistic', 'design', 'render_3d', 'anime']).default('realistic'),
});

export const ComposeBundleImageInput = z.object({
  prompt: z.string().min(20).max(1000).describe('Gemini 3 Pro Image prompt for bundle composition'),
  bundleName: z.string().describe('Bundle display name'),
  productDescriptions: z.array(z.string()).describe('Description of each product in the bundle'),
  referenceImageUrls: z.array(z.string().url()).describe('URLs of individual product mockups to reference'),
});

export const UploadMockupAssetInput = z.object({
  imageSource: z.union([
    z.string().url().describe('URL to download image from'),
    z.string().describe('Base64-encoded image data'),
  ]),
  brandId: z.string().uuid(),
  assetType: z.enum(['mockup', 'bundle']),
  productSku: z.string().nullable(),
  bundleName: z.string().nullable(),
  metadata: z.object({
    prompt: z.string(),
    model: z.string(),
    productName: z.string().nullable(),
  }),
});

export const SaveMockupAssetsInput = z.object({
  brandId: z.string().uuid(),
  userId: z.string().uuid(),
  mockups: z.array(z.object({
    url: z.string().url(),
    thumbnailUrl: z.string().url().nullable(),
    productSku: z.string().nullable(),
    bundleName: z.string().nullable(),
    assetType: z.enum(['mockup', 'bundle']),
    prompt: z.string(),
    model: z.string(),
    productName: z.string().nullable(),
  })),
});

// ── Output Schemas ───────────────────────────────────────────────

export const GenerateProductMockupOutput = z.object({
  success: z.boolean(),
  imageUrl: z.string().nullable().describe('Generated image URL or base64'),
  revisedPrompt: z.string().nullable().describe('OpenAI may revise the prompt'),
  model: z.string(),
  error: z.string().nullable(),
});

export const GenerateTextOnProductOutput = z.object({
  success: z.boolean(),
  imageUrl: z.string().nullable(),
  model: z.string(),
  error: z.string().nullable(),
});

export const ComposeBundleImageOutput = z.object({
  success: z.boolean(),
  imageBase64: z.string().nullable().describe('Base64-encoded generated image'),
  mimeType: z.string().nullable(),
  model: z.string(),
  error: z.string().nullable(),
});

export const UploadMockupAssetOutput = z.object({
  success: z.boolean(),
  permanentUrl: z.string().url().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  error: z.string().nullable(),
});

export const SaveMockupAssetsOutput = z.object({
  success: z.boolean(),
  brandId: z.string().uuid(),
  savedMockups: z.array(z.object({
    assetId: z.string().uuid(),
    url: z.string().url(),
    productSku: z.string().nullable(),
    assetType: z.string(),
  })),
  error: z.string().nullable(),
});

// ── Tool Definitions ─────────────────────────────────────────────

/** @type {import('../_shared/types.js').ToolDefinition[]} */
export const tools = [
  {
    name: 'generateProductMockup',
    description: 'Generate a product mockup with logo placement using GPT Image 1.5 (OpenAI direct API). Best for apparel, accessories, and home goods where the logo needs to be accurately placed on the product. Cost: ~$0.04-0.08 per image.',
    inputSchema: GenerateProductMockupInput,
    outputSchema: GenerateProductMockupOutput,
  },
  {
    name: 'generateTextOnProduct',
    description: 'Generate text-on-product image using Gemini 3 Pro Image (Google AI direct API). Best for packaging, labels, business cards, and any product where legible brand text is critical. Reliable typography rendering. Cost: ~$0.03-0.06 per image.',
    inputSchema: GenerateTextOnProductInput,
    outputSchema: GenerateTextOnProductOutput,
  },
  {
    name: 'composeBundleImage',
    description: 'Compose a bundle/collection image combining multiple products using Gemini 3 Pro Image (Google AI direct API). Best for marketing images showing a curated set of branded products together. Cost: ~$0.03-0.06 per image.',
    inputSchema: ComposeBundleImageInput,
    outputSchema: ComposeBundleImageOutput,
  },
  {
    name: 'uploadMockupAsset',
    description: 'Upload a generated mockup image to permanent storage (Supabase Storage / R2). Accepts either a URL to download or base64 data.',
    inputSchema: UploadMockupAssetInput,
    outputSchema: UploadMockupAssetOutput,
  },
  {
    name: 'saveMockupAssets',
    description: 'Save all mockup and bundle assets to the brand_assets table. Call LAST after all mockups are generated and uploaded.',
    inputSchema: SaveMockupAssetsInput,
    outputSchema: SaveMockupAssetsOutput,
  },
];
