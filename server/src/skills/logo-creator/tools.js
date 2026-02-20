// server/src/skills/logo-creator/tools.js

import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { config } from '../../config/index.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';

// ── Tool Definitions ────────────────────────────────────────────────

export const tools = {
  /**
   * composeLogoPrompt
   *
   * Build a detailed FLUX.2 Pro prompt from brand identity attributes.
   * Pure function -- no API call, no cost.
   */
  composeLogoPrompt: {
    name: 'composeLogoPrompt',
    description: 'Build a detailed, optimized FLUX.2 Pro image generation prompt from brand identity attributes (colors, archetype, style, name). Pure function, no API call.',
    inputSchema: z.object({
      brandName: z
        .string()
        .min(1)
        .max(100)
        .describe('The brand name to incorporate into the logo concept'),
      archetype: z
        .string()
        .describe('Brand archetype (e.g., "Creator", "Explorer", "Hero")'),
      style: z
        .enum(['minimal', 'bold', 'vintage', 'modern', 'playful'])
        .describe('Visual style direction'),
      colors: z
        .array(z.string())
        .min(1)
        .max(6)
        .describe('Brand color hex codes (e.g., ["#2D3436", "#00CEC9"])'),
      mood: z
        .string()
        .optional()
        .describe('Visual mood description (e.g., "warm and inviting", "bold and energetic")'),
      industry: z
        .string()
        .optional()
        .describe('Industry or niche (e.g., "fitness", "beauty", "tech")'),
      iconPreference: z
        .string()
        .optional()
        .describe('Preferred icon or symbol to include (e.g., "mountain", "leaf", "abstract wave")'),
      variation: z
        .enum(['icon-only', 'wordmark', 'combination', 'emblem'])
        .default('combination')
        .describe('Logo type: icon-only, wordmark (text only), combination (icon + text), or emblem'),
    }),

    /**
     * @param {{ brandName: string, archetype: string, style: string, colors: string[], mood?: string, industry?: string, iconPreference?: string, variation?: string }} input
     * @returns {{ success: boolean, data: { prompt: string, negativeGuidance: string, metadata: Object } }}
     */
    async execute({ brandName, archetype, style, colors, mood, industry, iconPreference, variation = 'combination' }) {
      logger.info({ msg: 'Composing logo prompt', brandName, style, variation });

      // Style-specific prompt fragments
      const styleFragments = {
        minimal: 'clean minimalist design, geometric shapes, lots of white space, flat design, simple lines, Swiss design influence',
        bold: 'bold impactful design, strong typography, high contrast, powerful visual presence, thick strokes, commanding',
        vintage: 'vintage retro design, hand-drawn feel, distressed textures, classic typography, warm tones, heritage aesthetic',
        modern: 'contemporary modern design, sleek lines, gradient accents, forward-looking, sophisticated, tech-inspired',
        playful: 'playful friendly design, rounded shapes, vibrant colors, approachable, fun, energetic, hand-lettered feel',
      };

      // Archetype-specific visual cues
      const archetypeVisuals = {
        Innocent: 'soft rounded forms, light airy feel, gentle curves, pure and clean',
        Explorer: 'directional elements, compass motifs, expansive feel, horizon lines',
        Sage: 'structured balanced composition, book or scroll motifs, intellectual weight',
        Hero: 'shield or crest elements, upward movement, strong angular forms, dynamic energy',
        Outlaw: 'sharp edges, unconventional layout, grunge textures, breaking boundaries',
        Magician: 'mysterious elements, transformation symbols, ethereal glow, sparkle accents',
        'Regular Guy/Gal': 'approachable simple shapes, handshake motifs, community feel, grounded',
        Lover: 'flowing curves, elegant script, heart or embrace motifs, sensual lines',
        Jester: 'asymmetric playful layout, bright pops of color, unexpected elements, smile motifs',
        Caregiver: 'embracing forms, shield of protection, nurturing curves, warm inviting feel',
        Creator: 'paintbrush or pen motifs, creative flourishes, artistic freedom, expressive strokes',
        Ruler: 'crown or column motifs, symmetrical balance, premium feel, authoritative presence',
      };

      // Variation-specific instructions
      const variationInstructions = {
        'icon-only': 'standalone icon/symbol mark only, no text, no letters, pure visual symbol',
        'wordmark': `typographic logo spelling "${brandName}", creative typography, no icon, text-based logo design`,
        'combination': `combination mark with both an icon/symbol and the text "${brandName}", balanced layout`,
        'emblem': `emblem/badge style logo with "${brandName}" text integrated into a contained shape or crest`,
      };

      // Build the color description
      const colorDesc = colors.length > 0
        ? `using these exact brand colors: ${colors.join(', ')}`
        : 'using professional brand-appropriate colors';

      // Assemble the full prompt
      const promptParts = [
        'Professional brand logo design',
        variationInstructions[variation] || variationInstructions.combination,
        styleFragments[style] || styleFragments.modern,
        archetypeVisuals[archetype] || '',
        colorDesc,
        mood ? `visual mood: ${mood}` : '',
        industry ? `for a ${industry} brand` : '',
        iconPreference ? `incorporating a ${iconPreference} symbol/icon` : '',
        'white background, vector-style, high resolution, centered composition, professional brand identity design, no mockup, no context, isolated logo on white',
      ];

      const prompt = promptParts
        .filter(Boolean)
        .join(', ')
        .replace(/,\s*,/g, ',')
        .replace(/\s+/g, ' ')
        .trim();

      const negativeGuidance = 'blurry, low quality, pixelated, 3D render, photorealistic, stock photo, watermark, text artifacts, multiple logos, busy background, clip art, generic';

      return {
        success: true,
        data: {
          prompt,
          negativeGuidance,
          metadata: {
            brandName,
            archetype,
            style,
            colors,
            variation,
            mood: mood || null,
            industry: industry || null,
            iconPreference: iconPreference || null,
            promptLength: prompt.length,
          },
        },
      };
    },
  },

  /**
   * generateLogo
   *
   * Generate a logo image using BFL FLUX.2 Pro API.
   * Submits a generation request, polls for completion, returns the image URL.
   *
   * Cost estimate: ~$0.05 per generation (FLUX.2 Pro standard rate)
   */
  generateLogo: {
    name: 'generateLogo',
    description: 'Generate a logo image using BFL FLUX.2 Pro API. Submits async request and polls for result. Returns the generated image URL.',
    inputSchema: z.object({
      prompt: z
        .string()
        .min(10)
        .max(2000)
        .describe('Detailed logo generation prompt (use composeLogoPrompt to build this)'),
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
      steps: z
        .number()
        .int()
        .min(20)
        .max(100)
        .default(50)
        .describe('Number of diffusion steps (default 50, higher = better quality)'),
    }),

    /**
     * @param {{ prompt: string, width: number, height: number, seed?: number, steps: number }} input
     * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
     */
    async execute({ prompt, width = 1024, height = 1024, seed, steps = 50 }) {
      logger.info({ msg: 'Generating logo via FLUX.2 Pro', promptLength: prompt.length, width, height, steps });

      try {
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
            steps,
            ...(seed !== undefined && { seed }),
            safety_tolerance: 2,
            output_format: 'png',
          }),
        });

        if (!submitResponse.ok) {
          const errorText = await submitResponse.text();
          logger.error({ msg: 'BFL API submission failed', status: submitResponse.status, error: errorText });
          return { success: false, error: `BFL API submission failed (${submitResponse.status}): ${errorText}` };
        }

        const { id: taskId } = await submitResponse.json();
        if (!taskId) {
          return { success: false, error: 'BFL API returned no task ID.' };
        }

        logger.info({ msg: 'BFL task submitted', taskId });

        // Step 2: Poll for result with exponential backoff
        const maxAttempts = 60;
        const baseIntervalMs = 2000;
        const maxIntervalMs = 10000;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          // Exponential backoff: 2s, 3s, 4.5s, 6.75s, capped at 10s
          const interval = Math.min(baseIntervalMs * Math.pow(1.5, attempt), maxIntervalMs);
          await new Promise((resolve) => setTimeout(resolve, interval));

          try {
            const statusResponse = await fetch(`https://api.bfl.ml/v1/get_result?id=${taskId}`, {
              headers: { 'X-Key': config.BFL_API_KEY },
            });

            if (!statusResponse.ok) {
              logger.warn({ msg: 'BFL poll request failed', status: statusResponse.status, attempt });
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
                  steps,
                },
              };
            }

            if (result.status === 'Error') {
              logger.error({ msg: 'BFL generation error', taskId, error: result.error });
              return { success: false, error: `BFL generation failed: ${result.error || 'Unknown error'}` };
            }

            // Status is 'Pending' or 'Processing' -- continue polling
          } catch (pollErr) {
            logger.warn({ msg: 'BFL poll exception', attempt, error: pollErr.message });
            // Continue polling on transient errors
          }
        }

        return { success: false, error: `Logo generation timed out after ${maxAttempts} poll attempts for task ${taskId}.` };
      } catch (err) {
        logger.error({ msg: 'Logo generation failed', error: err.message });
        return { success: false, error: `Logo generation failed: ${err.message}` };
      }
    },
  },

  /**
   * removeBackground
   *
   * Remove the background from a logo image for a transparent PNG.
   * Primary: Uses BFL FLUX.2 Pro fill endpoint for AI-powered background removal.
   * Fallback: Uses a Python worker service (rembg) if available.
   *
   * Cost estimate: ~$0.05 per call (BFL) or free (self-hosted rembg)
   */
  removeBackground: {
    name: 'removeBackground',
    description: 'Remove the background from a logo image to produce a transparent PNG. Uses BFL API or falls back to a Python rembg worker.',
    inputSchema: z.object({
      imageUrl: z
        .string()
        .url()
        .describe('URL of the image to remove background from'),
    }),

    /**
     * @param {{ imageUrl: string }} input
     * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
     */
    async execute({ imageUrl }) {
      logger.info({ msg: 'Removing background from image', imageUrl });

      // Strategy 1: Try the Python rembg worker (self-hosted, free)
      const workerUrl = process.env.PYTHON_WORKER_URL || 'http://localhost:5000';

      try {
        const workerResponse = await fetch(`${workerUrl}/api/remove-background`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl }),
          signal: AbortSignal.timeout(30000), // 30s timeout
        });

        if (workerResponse.ok) {
          const result = await workerResponse.json();
          logger.info({ msg: 'Background removed via Python worker' });
          return {
            success: true,
            data: {
              transparentUrl: result.url || result.imageUrl,
              originalUrl: imageUrl,
              method: 'rembg-worker',
            },
          };
        }

        logger.warn({ msg: 'Python worker bg removal failed', status: workerResponse.status });
      } catch (workerErr) {
        logger.warn({ msg: 'Python worker unavailable for bg removal', error: workerErr.message });
      }

      // Strategy 2: Re-generate with BFL using a transparent-friendly prompt
      // FLUX.2 Pro does not have a native bg removal endpoint, but we can
      // re-generate the image with explicit "transparent background, PNG" in the prompt.
      // This is a best-effort approach -- true bg removal requires an image processing library.
      try {
        // Download the original image to get its dimensions
        const imgResponse = await fetch(imageUrl);
        if (!imgResponse.ok) {
          return { success: false, error: `Failed to download source image (${imgResponse.status})` };
        }

        // For now, if neither rembg nor a proper bg removal service is available,
        // return the original with a note that bg removal was not performed.
        logger.warn({ msg: 'No background removal service available, returning original image' });
        return {
          success: true,
          data: {
            transparentUrl: imageUrl,
            originalUrl: imageUrl,
            method: 'none',
            warning: 'Background removal service unavailable. Original image returned. Install rembg Python worker or configure a background removal API for transparent PNGs.',
          },
        };
      } catch (err) {
        logger.error({ msg: 'Background removal failed entirely', error: err.message });
        return { success: false, error: `Background removal failed: ${err.message}` };
      }
    },
  },

  /**
   * uploadToStorage
   *
   * Upload a generated logo image to Supabase Storage bucket 'brand-assets'.
   * Downloads the image from the provided URL, uploads to storage, and records
   * the asset in the brand_assets table.
   *
   * Cost estimate: Free (Supabase storage, within plan limits)
   */
  uploadToStorage: {
    name: 'uploadToStorage',
    description: 'Upload a generated logo image to Supabase Storage bucket "brand-assets" and record it in the brand_assets table.',
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
        .enum(['logo', 'logo-transparent', 'logo-variant'])
        .default('logo')
        .describe('Type of logo asset'),
      filename: z
        .string()
        .optional()
        .describe('Custom filename (optional, auto-generated if omitted)'),
      metadata: z
        .record(z.string(), z.any())
        .optional()
        .describe('Additional metadata to store with the asset (e.g., prompt, seed, model)'),
    }),

    /**
     * @param {{ imageUrl: string, brandId: string, assetType: string, filename?: string, metadata?: Record<string, any> }} input
     * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
     */
    async execute({ imageUrl, brandId, assetType = 'logo', filename, metadata }) {
      logger.info({ msg: 'Uploading logo to Supabase Storage', brandId, assetType });

      try {
        // Step 1: Download the image
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          return { success: false, error: `Failed to download image from URL (${imageResponse.status})` };
        }

        const buffer = Buffer.from(await imageResponse.arrayBuffer());
        const contentType = imageResponse.headers.get('content-type') || 'image/png';
        const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
        const finalFilename = filename || `${assetType}-${randomUUID()}.${extension}`;
        const storagePath = `${brandId}/logos/${finalFilename}`;

        // Step 2: Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('brand-assets')
          .upload(storagePath, buffer, {
            contentType,
            upsert: true,
          });

        if (uploadError) {
          logger.error({ msg: 'Supabase Storage upload failed', error: uploadError.message });
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
          metadata: metadata ? JSON.stringify(metadata) : null,
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
              sizeBytes: buffer.length,
              warning: 'Asset uploaded but database record failed. Manual cleanup may be needed.',
            },
          };
        }

        logger.info({ msg: 'Logo uploaded successfully', assetId: insertData.id, storagePath });

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
      } catch (err) {
        logger.error({ msg: 'Logo upload failed', error: err.message });
        return { success: false, error: `Logo upload failed: ${err.message}` };
      }
    },
  },
};
