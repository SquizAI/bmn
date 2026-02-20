// server/src/skills/mockup-renderer/tools.js

import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { config } from '../../config/index.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';

// ── Lazy-load external SDKs ─────────────────────────────────────────

/** @returns {Promise<import('openai').default | null>} */
async function getOpenAIClient() {
  try {
    const { default: OpenAI } = await import('openai');
    return new OpenAI({ apiKey: config.OPENAI_API_KEY });
  } catch {
    logger.warn({ msg: 'openai package not installed -- generateMockup tool will return stubs' });
    return null;
  }
}

/** @returns {Promise<import('@google/generative-ai').GoogleGenerativeAI | null>} */
async function getGoogleAI() {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    return new GoogleGenerativeAI(config.GOOGLE_API_KEY);
  } catch {
    logger.warn({ msg: '@google/generative-ai not installed -- compositeBundle tool will return stubs' });
    return null;
  }
}

// ── Tool Definitions ────────────────────────────────────────────────

export const tools = {
  /**
   * generateMockup
   *
   * Generate a product mockup image using OpenAI GPT Image 1.5.
   * Best for products with logos/branding applied.
   *
   * Cost estimate: ~$0.04-0.08 per image (GPT Image 1.5 HD)
   */
  generateMockup: {
    name: 'generateMockup',
    description: 'Generate a product mockup image using OpenAI GPT Image 1.5. Best for products with logos/branding applied.',
    inputSchema: z.object({
      prompt: z
        .string()
        .min(10)
        .max(1000)
        .describe('Detailed mockup generation prompt (10-1000 characters)'),
      size: z
        .enum(['1024x1024', '1536x1024', '1024x1536'])
        .default('1024x1024')
        .describe('Image dimensions'),
      quality: z
        .enum(['standard', 'hd'])
        .default('hd')
        .describe('Image quality level'),
      style: z
        .enum(['natural', 'vivid'])
        .default('natural')
        .describe('Image style -- natural for product photos, vivid for stylized'),
    }),

    /**
     * @param {{ prompt: string, size: string, quality: string, style: string }} input
     * @returns {Promise<{ success: boolean, data?: Object, error?: string, stub?: boolean }>}
     */
    async execute({ prompt, size = '1024x1024', quality = 'hd', style = 'natural' }) {
      const openai = await getOpenAIClient();
      if (!openai) {
        return {
          success: false,
          error: 'OpenAI SDK not available. Install openai to enable mockup generation.',
          stub: true,
        };
      }

      logger.info({ msg: 'Generating mockup via GPT Image 1.5', promptLength: prompt.length, size, quality, style });

      try {
        const response = await openai.images.generate({
          model: 'gpt-image-1',
          prompt,
          n: 1,
          size,
          quality,
          style,
        });

        const imageUrl = response.data?.[0]?.url;
        if (!imageUrl) {
          return { success: false, error: 'OpenAI returned no image data.' };
        }

        return {
          success: true,
          data: {
            imageUrl,
            size,
            quality,
            style,
            revisedPrompt: response.data[0]?.revised_prompt || null,
          },
        };
      } catch (err) {
        logger.error({ msg: 'Mockup generation failed', error: err.message });
        return { success: false, error: `Mockup generation failed: ${err.message}` };
      }
    },
  },

  /**
   * generateTextOnProduct
   *
   * Generate product images with legible text using Ideogram v3.
   * Best for labels, packaging, cards, and products requiring readable typography.
   *
   * Cost estimate: ~$0.02-0.05 per image (Ideogram v3)
   */
  generateTextOnProduct: {
    name: 'generateTextOnProduct',
    description: 'Generate product images with legible text using Ideogram v3. Best for labels, packaging, cards, and products requiring readable typography.',
    inputSchema: z.object({
      prompt: z
        .string()
        .min(10)
        .max(1000)
        .describe('Detailed generation prompt with text specifications (10-1000 characters)'),
      aspectRatio: z
        .enum(['1:1', '4:3', '3:4', '16:9', '9:16'])
        .default('1:1')
        .describe('Image aspect ratio'),
      model: z
        .enum(['V_3', 'V_3_TURBO'])
        .default('V_3')
        .describe('Ideogram model version (V_3 for quality, V_3_TURBO for speed)'),
      magicPromptOption: z
        .enum(['AUTO', 'ON', 'OFF'])
        .default('AUTO')
        .describe('Whether Ideogram should enhance the prompt automatically'),
    }),

    /**
     * @param {{ prompt: string, aspectRatio: string, model: string, magicPromptOption: string }} input
     * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
     */
    async execute({ prompt, aspectRatio = '1:1', model = 'V_3', magicPromptOption = 'AUTO' }) {
      logger.info({ msg: 'Generating text-on-product via Ideogram v3', promptLength: prompt.length, model, aspectRatio });

      try {
        const response = await fetch('https://api.ideogram.ai/generate', {
          method: 'POST',
          headers: {
            'Api-Key': config.IDEOGRAM_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image_request: {
              prompt,
              aspect_ratio: aspectRatio,
              model,
              magic_prompt_option: magicPromptOption,
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return { success: false, error: `Ideogram API failed (${response.status}): ${errorText}` };
        }

        const result = await response.json();
        const imageData = result.data?.[0];

        if (!imageData?.url) {
          return { success: false, error: 'Ideogram returned no image data.' };
        }

        return {
          success: true,
          data: {
            imageUrl: imageData.url,
            aspectRatio,
            model,
            isImageSafe: imageData.is_image_safe ?? true,
            seed: imageData.seed || null,
          },
        };
      } catch (err) {
        logger.error({ msg: 'Ideogram text-on-product generation failed', error: err.message });
        return { success: false, error: `Text-on-product generation failed: ${err.message}` };
      }
    },
  },

  /**
   * compositeBundle
   *
   * Composite multiple product images into a single bundle/collection shot
   * using Gemini 3 Pro Image.
   *
   * Cost estimate: ~$0.01-0.03 per call (Gemini Pro with image input)
   */
  compositeBundle: {
    name: 'compositeBundle',
    description: 'Composite multiple product images into a single bundle/collection shot using Gemini 3 Pro Image.',
    inputSchema: z.object({
      prompt: z
        .string()
        .min(10)
        .describe('Description of the desired bundle composition layout and style'),
      productImageUrls: z
        .array(z.string().url())
        .min(2)
        .max(8)
        .describe('URLs of product images to composite (2-8)'),
      brandName: z
        .string()
        .describe('Brand name for labeling/branding in the composition'),
      style: z
        .string()
        .describe('Visual style for the composition (e.g., "minimalist flat-lay", "lifestyle scene")'),
    }),

    /**
     * @param {{ prompt: string, productImageUrls: string[], brandName: string, style: string }} input
     * @returns {Promise<{ success: boolean, data?: Object, error?: string, stub?: boolean }>}
     */
    async execute({ prompt, productImageUrls, brandName, style }) {
      const googleAI = await getGoogleAI();
      if (!googleAI) {
        return {
          success: false,
          error: 'Google AI SDK not available. Install @google/generative-ai to enable bundle composition.',
          stub: true,
        };
      }

      logger.info({ msg: 'Compositing bundle via Gemini 3 Pro Image', imageCount: productImageUrls.length, brandName });

      try {
        const model = googleAI.getGenerativeModel({ model: 'gemini-2.0-pro-exp' });

        // Fetch and convert product images to base64
        const imageParts = [];
        for (const url of productImageUrls) {
          try {
            const response = await fetch(url);
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            const mimeType = response.headers.get('content-type') || 'image/png';
            imageParts.push({
              inlineData: { data: base64, mimeType },
            });
          } catch (err) {
            logger.warn({ msg: 'Failed to fetch product image for bundle', url, error: err.message });
          }
        }

        if (imageParts.length < 2) {
          return { success: false, error: 'Could not fetch enough product images for bundle composition (minimum 2 required).' };
        }

        const compositionPrompt = `Create a professional product bundle composition image.

Brand: ${brandName}
Style: ${style}
Layout: ${prompt}

Arrange the ${imageParts.length} provided product images into a cohesive, visually appealing bundle composition. The result should look like a professional e-commerce product collection photo suitable for a brand landing page.

Requirements:
- Professional product photography style
- Clean, white or neutral background
- Products arranged attractively with balanced spacing
- Consistent lighting across all products
- High resolution, e-commerce quality

Generate a single composite image showing all products together.`;

        const result = await model.generateContent([compositionPrompt, ...imageParts]);
        const response = result.response;

        // Check for generated image in response
        const candidates = response.candidates || [];
        let imageUrl = null;

        for (const candidate of candidates) {
          for (const part of candidate.content?.parts || []) {
            if (part.inlineData) {
              // Convert base64 image data to a data URL
              imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
              break;
            }
          }
          if (imageUrl) break;
        }

        if (!imageUrl) {
          return { success: false, error: 'Gemini did not return a generated image for the bundle composition.' };
        }

        return {
          success: true,
          data: {
            imageUrl,
            productCount: imageParts.length,
            brandName,
            style,
          },
        };
      } catch (err) {
        logger.error({ msg: 'Bundle composition failed', error: err.message });
        return { success: false, error: `Bundle composition failed: ${err.message}` };
      }
    },
  },

  /**
   * uploadAsset
   *
   * Upload an image to Supabase Storage and record it in the brand_assets table.
   * Supports both standard URLs and data URLs (base64 from Gemini).
   *
   * Cost estimate: Free (Supabase storage, within plan limits)
   */
  uploadAsset: {
    name: 'uploadAsset',
    description: 'Upload an image to Supabase Storage and record it in the brand_assets table.',
    inputSchema: z.object({
      imageUrl: z
        .string()
        .describe('URL of the image to upload (supports http URLs and data: URLs)'),
      brandId: z
        .string()
        .uuid()
        .describe('Brand record ID'),
      assetType: z
        .enum(['logo', 'mockup', 'bundle', 'social_asset'])
        .describe('Type of brand asset'),
      filename: z
        .string()
        .optional()
        .describe('Custom filename (optional, auto-generated if omitted)'),
      productSku: z
        .string()
        .optional()
        .describe('Product SKU this asset is associated with (optional, for mockups)'),
    }),

    /**
     * @param {{ imageUrl: string, brandId: string, assetType: string, filename?: string, productSku?: string }} input
     * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
     */
    async execute({ imageUrl, brandId, assetType, filename, productSku }) {
      logger.info({ msg: 'Uploading asset to Supabase Storage', brandId, assetType, productSku });

      try {
        // Step 1: Download the image
        let buffer;
        let contentType;

        if (imageUrl.startsWith('data:')) {
          // Handle data URLs (from Gemini bundle composition)
          const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (!matches) {
            return { success: false, error: 'Invalid data URL format.' };
          }
          contentType = matches[1];
          buffer = Buffer.from(matches[2], 'base64');
        } else {
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) {
            return { success: false, error: `Failed to download image from URL (${imageResponse.status})` };
          }
          buffer = Buffer.from(await imageResponse.arrayBuffer());
          contentType = imageResponse.headers.get('content-type') || 'image/png';
        }

        const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
        const finalFilename = filename || `${assetType}-${randomUUID()}.${extension}`;
        const storagePath = `${brandId}/${assetType}/${finalFilename}`;

        // Step 2: Upload to Supabase Storage
        const { error: uploadError } = await supabaseAdmin.storage
          .from('brand-assets')
          .upload(storagePath, buffer, {
            contentType,
            upsert: true,
          });

        if (uploadError) {
          return { success: false, error: `Supabase Storage upload failed: ${uploadError.message}` };
        }

        // Step 3: Get public URL
        const { data: urlData } = supabaseAdmin.storage
          .from('brand-assets')
          .getPublicUrl(storagePath);

        const publicUrl = urlData?.publicUrl;

        // Step 4: Record in brand_assets table
        const assetRecord = {
          id: randomUUID(),
          brand_id: brandId,
          asset_type: assetType,
          storage_path: storagePath,
          public_url: publicUrl,
          filename: finalFilename,
          content_type: contentType,
          size_bytes: buffer.length,
          product_sku: productSku || null,
          created_at: new Date().toISOString(),
        };

        const { data: insertData, error: insertError } = await supabaseAdmin
          .from('brand_assets')
          .insert(assetRecord)
          .select('id')
          .single();

        if (insertError) {
          logger.warn({ msg: 'Failed to record asset in database (upload succeeded)', error: insertError.message });
          return {
            success: true,
            data: {
              assetId: assetRecord.id,
              publicUrl,
              storagePath,
              filename: finalFilename,
              productSku: productSku || null,
              warning: 'Asset uploaded but database record failed.',
            },
          };
        }

        return {
          success: true,
          data: {
            assetId: insertData.id,
            publicUrl,
            storagePath,
            filename: finalFilename,
            sizeBytes: buffer.length,
            productSku: productSku || null,
          },
        };
      } catch (err) {
        logger.error({ msg: 'Asset upload failed', error: err.message });
        return { success: false, error: `Asset upload failed: ${err.message}` };
      }
    },
  },
};
