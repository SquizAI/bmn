// server/src/skills/video-creator/tools.js

import { z } from 'zod';
import { logger as rootLogger } from '../../lib/logger.js';
import { config } from '../../config/index.js';

const logger = rootLogger.child({ skill: 'video-creator' });

/**
 * Feature flag for video generation. Set VIDEO_GENERATION_ENABLED=true
 * in environment when Google Veo 3 API access is ready.
 * @type {boolean}
 */
const VIDEO_GENERATION_ENABLED = process.env.VIDEO_GENERATION_ENABLED === 'true';

export const tools = {
  generateProductVideo: {
    name: 'generateProductVideo',
    description: 'Generate a short product showcase video using Google Veo 3. Returns a "coming soon" response until VIDEO_GENERATION_ENABLED=true.',
    inputSchema: z.object({
      brandId: z.string().uuid().describe('Brand ID that owns this product'),
      prompt: z.string().min(10).max(500).describe('Video generation prompt describing the product showcase'),
      duration: z.number().int().min(3).max(30).default(10).describe('Video duration in seconds (3-30)'),
      productImageUrl: z.string().url().describe('URL of the product image to animate'),
      productName: z.string().max(200).optional().describe('Product name for the video'),
      brandName: z.string().max(200).optional().describe('Brand name for overlay text'),
      style: z.enum(['cinematic', 'minimal', 'dynamic', 'editorial']).default('minimal').describe('Video style'),
      colorPalette: z.array(z.string()).max(8).optional().describe('Brand hex colors for video theming'),
    }),

    /**
     * @param {Object} input
     * @param {string} input.brandId
     * @param {string} input.prompt
     * @param {number} input.duration
     * @param {string} input.productImageUrl
     * @param {string} [input.productName]
     * @param {string} [input.brandName]
     * @param {string} input.style
     * @param {string[]} [input.colorPalette]
     */
    async execute({ brandId, prompt, duration, productImageUrl, productName, brandName, style, colorPalette }) {
      // Log every request for analytics regardless of feature status
      logger.info({
        brandId,
        productName: productName || 'unknown',
        prompt: prompt.slice(0, 100),
        duration,
        style,
        enabled: VIDEO_GENERATION_ENABLED,
      }, 'Video generation requested');

      if (!VIDEO_GENERATION_ENABLED) {
        return {
          status: 'not_available',
          message: 'Video generation is coming in Phase 2. This feature will use Google Veo 3 for short product showcase videos.',
          estimatedAvailability: 'Q3 2026',
          requestedParams: {
            brandId,
            productName: productName || null,
            prompt: prompt.slice(0, 100),
            duration,
            style,
          },
        };
      }

      // ── Veo 3 implementation (activated when VIDEO_GENERATION_ENABLED=true) ──
      try {
        const response = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/veo-3:generateVideo',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.GOOGLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              prompt,
              duration,
              image: productImageUrl,
              style,
            }),
            signal: AbortSignal.timeout(120_000),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          logger.error({ brandId, status: response.status, error: errorText }, 'Veo 3 API error');
          return {
            status: 'error',
            message: `Video generation failed: ${response.status}`,
            requestedParams: { brandId, productName, prompt: prompt.slice(0, 100), duration, style },
          };
        }

        const data = await response.json();

        logger.info({ brandId, productName, videoUrl: data.videoUrl }, 'Video generated successfully');

        return {
          status: 'completed',
          videoUrl: data.videoUrl || data.url,
          thumbnailUrl: data.thumbnailUrl || null,
          durationSeconds: duration,
          brandId,
          productName: productName || null,
        };
      } catch (err) {
        logger.error({ brandId, error: err.message }, 'Video generation failed');
        return {
          status: 'error',
          message: `Video generation encountered an error: ${err.message}`,
          requestedParams: { brandId, productName, prompt: prompt.slice(0, 100), duration, style },
        };
      }
    },
  },
};
