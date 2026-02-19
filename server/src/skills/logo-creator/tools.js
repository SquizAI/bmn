// server/src/skills/logo-creator/tools.js

import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { config } from '../../config/index.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';

// ── Tool Definitions ────────────────────────────────────────────────

export const tools = {
  generateLogo: {
    name: 'generateLogo',
    description: 'Generate a logo image using BFL FLUX.2 Pro API. Returns the image URL from BFL.',
    inputSchema: z.object({
      prompt: z
        .string()
        .min(10)
        .max(500)
        .describe('Detailed logo generation prompt (10-500 characters)'),
      width: z
        .number()
        .int()
        .default(1024)
        .describe('Image width in pixels (default 1024)'),
      height: z
        .number()
        .int()
        .default(1024)
        .describe('Image height in pixels (default 1024)'),
      seed: z
        .number()
        .int()
        .optional()
        .describe('Random seed for reproducibility (optional)'),
    }),

    /** @param {{ prompt: string, width: number, height: number, seed?: number }} input */
    async execute({ prompt, width = 1024, height = 1024, seed }) {
      logger.info({ msg: 'Generating logo via FLUX.2 Pro', promptLength: prompt.length, width, height });

      // Step 1: Submit generation request
      const submitResponse = await fetch('https://api.bfl.ml/v1/flux-pro-1.1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Key': config.BFL_API_KEY,
        },
        body: JSON.stringify({
          prompt,
          width,
          height,
          ...(seed !== undefined && { seed }),
        }),
      });

      if (!submitResponse.ok) {
        const errorText = await submitResponse.text();
        return { success: false, error: `BFL API submission failed (${submitResponse.status}): ${errorText}` };
      }

      const { id: taskId } = await submitResponse.json();
      if (!taskId) {
        return { success: false, error: 'BFL API returned no task ID.' };
      }

      // Step 2: Poll for result
      const maxAttempts = 60;
      const pollIntervalMs = 3000;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

        const statusResponse = await fetch(`https://api.bfl.ml/v1/get_result?id=${taskId}`, {
          headers: { 'X-Key': config.BFL_API_KEY },
        });

        if (!statusResponse.ok) {
          continue;
        }

        const result = await statusResponse.json();

        if (result.status === 'Ready' && result.result?.sample) {
          logger.info({ msg: 'Logo generation complete', taskId, attempts: attempt + 1 });
          return {
            success: true,
            data: {
              imageUrl: result.result.sample,
              taskId,
              seed: result.result.seed || seed,
              width,
              height,
            },
          };
        }

        if (result.status === 'Error') {
          return { success: false, error: `BFL generation failed: ${result.error || 'Unknown error'}` };
        }

        // Status is 'Pending' or 'Processing' -- continue polling
      }

      return { success: false, error: `Logo generation timed out after ${maxAttempts * pollIntervalMs / 1000} seconds.` };
    },
  },

  removeBackground: {
    name: 'removeBackground',
    description: 'Remove the background from a logo image using the Python worker service. Returns URL of the transparent PNG.',
    inputSchema: z.object({
      imageUrl: z
        .string()
        .url()
        .describe('URL of the image to remove background from'),
    }),

    /** @param {{ imageUrl: string }} input */
    async execute({ imageUrl }) {
      logger.info({ msg: 'Removing background from image', imageUrl });

      const workerUrl = process.env.PYTHON_WORKER_URL || 'http://localhost:5000';

      const response = await fetch(`${workerUrl}/api/remove-background`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Background removal failed (${response.status}): ${errorText}` };
      }

      const result = await response.json();

      return {
        success: true,
        data: {
          transparentUrl: result.url || result.imageUrl,
          originalUrl: imageUrl,
        },
      };
    },
  },

  uploadAsset: {
    name: 'uploadAsset',
    description: 'Upload an image to Supabase Storage and record it in the brand_assets table.',
    inputSchema: z.object({
      imageUrl: z
        .string()
        .url()
        .describe('URL of the image to upload'),
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
    }),

    /** @param {{ imageUrl: string, brandId: string, assetType: string, filename?: string }} input */
    async execute({ imageUrl, brandId, assetType, filename }) {
      logger.info({ msg: 'Uploading asset to Supabase Storage', brandId, assetType });

      // Step 1: Download the image
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        return { success: false, error: `Failed to download image from URL (${imageResponse.status})` };
      }

      const buffer = Buffer.from(await imageResponse.arrayBuffer());
      const contentType = imageResponse.headers.get('content-type') || 'image/png';
      const extension = contentType.includes('png') ? 'png' : 'jpg';
      const finalFilename = filename || `${assetType}-${randomUUID()}.${extension}`;
      const storagePath = `${brandId}/${assetType}/${finalFilename}`;

      // Step 2: Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
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
            warning: 'Asset uploaded but database record failed. Manual cleanup may be needed.',
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
        },
      };
    },
  },
};
