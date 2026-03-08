// server/src/skills/video-creator/handlers.js
//
// Tool handlers for the video-creator skill. Each exported function
// corresponds to a tool in tools.js. Uses native fetch (Node 22) for
// Veo 3 API calls.

import { randomUUID } from 'node:crypto';
import { config as appConfig } from '../../config/index.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { logger as rootLogger } from '../../lib/logger.js';
import { config as skillConfig } from './config.js';

const logger = rootLogger.child({ skill: 'video-creator' });

/**
 * Whether video generation is enabled via feature flag.
 * Checked at call time (not module load) so tests can toggle the env var.
 *
 * @returns {boolean}
 */
function isVideoEnabled() {
  return process.env.VIDEO_GENERATION_ENABLED === 'true';
}

// ── composeVideoPrompt ──────────────────────────────────────────────

/**
 * Compose and validate a Veo 3 prompt for video generation.
 * Pure function -- no API call, no cost.
 *
 * @param {import('zod').infer<import('./tools.js').ComposeVideoPromptInput>} input
 * @returns {Promise<import('zod').infer<import('./tools.js').ComposeVideoPromptOutput>>}
 */
export async function composeVideoPrompt({ videoType, prompt, durationSec, aspectRatio, productName }) {
  logger.info(
    { videoType, promptLength: prompt.length, durationSec, aspectRatio, productName },
    'Composing video prompt'
  );

  // Enforce prompt length guidelines (30-80 words recommended)
  const wordCount = prompt.trim().split(/\s+/).length;
  if (wordCount < 5) {
    return { success: false, videoType, prompt: `Prompt too short (${wordCount} words). Aim for 30-80 words.` };
  }

  return { success: true, videoType, prompt };
}

// ── generateProductVideo ────────────────────────────────────────────

/**
 * Generate a product video via Veo 3 (Google AI direct API).
 *
 * Implements:
 * - Feature flag check (VIDEO_GENERATION_ENABLED)
 * - Retry with exponential backoff (2 retries)
 * - Async operation polling (Veo 3 returns an operation ID)
 * - Graceful error when API is unavailable
 *
 * @param {import('zod').infer<import('./tools.js').GenerateProductVideoInput>} input
 * @returns {Promise<import('zod').infer<import('./tools.js').GenerateProductVideoOutput>>}
 */
export async function generateProductVideo({ prompt, durationSec = 8, aspectRatio = '16:9', resolution = '720p' }) {
  // Feature flag gate
  if (!isVideoEnabled()) {
    logger.info('Video generation disabled (VIDEO_GENERATION_ENABLED != true)');
    return {
      success: false,
      videoUrl: null,
      thumbnailUrl: null,
      durationSec: null,
      model: 'veo-3',
      error: 'Video generation is not available. This is a Phase 2 feature. Set VIDEO_GENERATION_ENABLED=true when ready.',
    };
  }

  logger.info({ durationSec, aspectRatio, resolution }, 'Generating video via Veo 3');

  const { retryPolicy, video } = skillConfig;
  const apiBaseUrl = video.apiBaseUrl;
  let lastError = null;

  // Retry loop
  for (let attempt = 0; attempt <= retryPolicy.maxRetries; attempt++) {
    if (attempt > 0) {
      const backoff = retryPolicy.backoffMs * Math.pow(retryPolicy.backoffMultiplier, attempt - 1);
      logger.info({ attempt, backoffMs: backoff }, 'Retrying Veo 3 generation');
      await sleep(backoff);
    }

    try {
      const response = await fetch(`${apiBaseUrl}/models/veo-3:generateVideo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': appConfig.GOOGLE_API_KEY,
        },
        body: JSON.stringify({
          prompt,
          videoConfig: {
            durationSeconds: durationSec,
            aspectRatio,
            resolution,
            personGeneration: 'dont_allow',
          },
        }),
        signal: AbortSignal.timeout(skillConfig.timeoutMs),
      });

      if (!response.ok) {
        const errBody = await response.text();
        logger.error(
          { status: response.status, body: errBody, attempt },
          'Veo 3 API failed'
        );

        // Content moderation rejection -- adjust prompt and retry once
        if (response.status === 400 && errBody.includes('SAFETY')) {
          lastError = `Veo 3 content moderation rejected the prompt.`;
          continue;
        }

        // Rate limit -- respect backoff
        if (response.status === 429) {
          lastError = `Veo 3 rate limited (429).`;
          continue;
        }

        // Other HTTP errors
        lastError = `Veo 3 API error: ${response.status}`;
        continue;
      }

      const data = await response.json();

      // Veo 3 may return an operation ID for async polling
      if (data.name && !data.video && !data.generatedVideos) {
        const videoResult = await pollVeo3Result(data.name);
        if (!videoResult) {
          lastError = 'Veo 3 generation timed out during polling.';
          continue;
        }
        return {
          success: true,
          videoUrl: videoResult.videoUrl,
          thumbnailUrl: videoResult.thumbnailUrl || null,
          durationSec,
          model: 'veo-3',
          error: null,
        };
      }

      // Direct result (some API versions return the video immediately)
      const videoUrl = data.video?.uri || data.generatedVideos?.[0]?.video?.uri || null;
      const thumbnailUrl = data.video?.thumbnail?.uri || data.generatedVideos?.[0]?.video?.thumbnail?.uri || null;

      if (!videoUrl) {
        lastError = 'Veo 3 returned no video URL in response.';
        continue;
      }

      return {
        success: true,
        videoUrl,
        thumbnailUrl,
        durationSec,
        model: 'veo-3',
        error: null,
      };
    } catch (err) {
      logger.error({ err, attempt }, 'Veo 3 generation failed');

      // AbortError means timeout
      if (err.name === 'AbortError' || err.name === 'TimeoutError') {
        lastError = 'Veo 3 API request timed out.';
      } else {
        lastError = err.message;
      }
    }
  }

  // All retries exhausted
  logger.error({ lastError }, 'Veo 3 generation failed after all retries');
  return {
    success: false,
    videoUrl: null,
    thumbnailUrl: null,
    durationSec: null,
    model: 'veo-3',
    error: lastError || 'Veo 3 generation failed after all retries.',
  };
}

// ── uploadVideoAsset ────────────────────────────────────────────────

/**
 * Download a generated video from a temporary URL and upload it to
 * permanent Supabase Storage.
 *
 * @param {import('zod').infer<import('./tools.js').UploadVideoAssetInput>} input
 * @returns {Promise<import('zod').infer<import('./tools.js').UploadVideoAssetOutput>>}
 */
export async function uploadVideoAsset({ videoUrl, brandId, videoType, metadata: _metadata }) {
  logger.info({ brandId, videoType }, 'Uploading video to storage');

  try {
    // Download the video from the temporary URL
    const response = await fetch(videoUrl, {
      signal: AbortSignal.timeout(60_000), // 60s download timeout
    });

    if (!response.ok) {
      return {
        success: false,
        permanentUrl: null,
        thumbnailUrl: null,
        error: `Failed to download video: HTTP ${response.status}`,
      };
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Validate file size
    if (buffer.length > skillConfig.video.maxFileSize) {
      return {
        success: false,
        permanentUrl: null,
        thumbnailUrl: null,
        error: `Video file too large (${Math.round(buffer.length / 1024 / 1024)}MB). Max: ${Math.round(skillConfig.video.maxFileSize / 1024 / 1024)}MB.`,
      };
    }

    const timestamp = Date.now();
    const filename = `${videoType}-${timestamp}-${randomUUID().slice(0, 8)}.mp4`;
    const storagePath = `${brandId}/videos/${filename}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('brand-assets')
      .upload(storagePath, buffer, {
        contentType: 'video/mp4',
        upsert: false,
      });

    if (uploadError) {
      logger.error({ error: uploadError.message, storagePath }, 'Supabase Storage upload failed');
      return {
        success: false,
        permanentUrl: null,
        thumbnailUrl: null,
        error: `Storage upload failed: ${uploadError.message}`,
      };
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('brand-assets')
      .getPublicUrl(storagePath);

    logger.info({ storagePath, publicUrl: urlData.publicUrl }, 'Video uploaded successfully');

    return {
      success: true,
      permanentUrl: urlData.publicUrl,
      thumbnailUrl: null,
      error: null,
    };
  } catch (err) {
    logger.error({ err }, 'Video upload failed');
    return {
      success: false,
      permanentUrl: null,
      thumbnailUrl: null,
      error: `Video upload failed: ${err.message}`,
    };
  }
}

// ── saveVideoAssets ─────────────────────────────────────────────────

/**
 * Save all generated video assets to the brand_assets table and
 * write an audit log entry.
 *
 * @param {import('zod').infer<import('./tools.js').SaveVideoAssetsInput>} input
 * @returns {Promise<import('zod').infer<import('./tools.js').SaveVideoAssetsOutput>>}
 */
export async function saveVideoAssets({ brandId, userId, videos }) {
  logger.info({ brandId, videoCount: videos.length }, 'Saving video assets');

  try {
    const rows = videos.map((v) => ({
      id: randomUUID(),
      brand_id: brandId,
      asset_type: 'video',
      url: v.url,
      thumbnail_url: v.thumbnailUrl || null,
      is_selected: false,
      metadata: {
        videoType: v.videoType,
        durationSec: v.durationSec,
        prompt: v.prompt,
        model: v.model,
        productName: v.productName,
      },
      created_at: new Date().toISOString(),
    }));

    const { data, error } = await supabaseAdmin
      .from('brand_assets')
      .insert(rows)
      .select('id, url');

    if (error) {
      logger.error({ error: error.message }, 'Failed to save video assets');
      return { success: false, brandId, savedVideos: [], error: error.message };
    }

    // Write audit log entry
    await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      action: 'videos_generated',
      resource_type: 'brand',
      resource_id: brandId,
      metadata: { videoCount: videos.length },
    }).then(({ error: auditError }) => {
      if (auditError) {
        logger.warn({ error: auditError.message }, 'Audit log insert failed (non-fatal)');
      }
    });

    const savedVideos = (data || []).map((r) => ({ assetId: r.id, url: r.url }));

    logger.info({ brandId, savedCount: savedVideos.length }, 'Video assets saved');

    return {
      success: true,
      brandId,
      savedVideos,
      error: null,
    };
  } catch (err) {
    logger.error({ err }, 'Save video assets failed');
    return { success: false, brandId, savedVideos: [], error: err.message };
  }
}

// ── Internal Helpers ────────────────────────────────────────────────

/**
 * Poll Veo 3 for async operation result.
 *
 * Veo 3 returns a long-running operation ID. We poll until the operation
 * is complete or the timeout is reached.
 *
 * @param {string} operationName - The operation resource name from Veo 3
 * @param {number} [maxWaitMs] - Maximum polling time (defaults to config)
 * @returns {Promise<{ videoUrl: string, thumbnailUrl: string|null }|null>}
 */
async function pollVeo3Result(operationName, maxWaitMs) {
  const { video } = skillConfig;
  const maxWait = maxWaitMs || video.pollMaxWaitMs;
  const startTime = Date.now();

  logger.info({ operationName, maxWaitMs: maxWait }, 'Polling Veo 3 operation');

  while (Date.now() - startTime < maxWait) {
    try {
      const response = await fetch(
        `${video.apiBaseUrl}/${operationName}`,
        {
          headers: { 'x-goog-api-key': appConfig.GOOGLE_API_KEY },
          signal: AbortSignal.timeout(15_000),
        }
      );

      if (response.ok) {
        const data = await response.json();

        if (data.done) {
          // Check for errors in the operation result
          if (data.error) {
            logger.error({ error: data.error }, 'Veo 3 operation completed with error');
            return null;
          }

          const generatedVideo = data.response?.generatedVideos?.[0];
          if (generatedVideo?.video?.uri) {
            logger.info({ operationName }, 'Veo 3 operation completed successfully');
            return {
              videoUrl: generatedVideo.video.uri,
              thumbnailUrl: generatedVideo.video.thumbnail?.uri || null,
            };
          }

          logger.warn({ data }, 'Veo 3 operation done but no video URI found');
          return null;
        }

        logger.debug({ operationName, elapsedMs: Date.now() - startTime }, 'Veo 3 operation still in progress');
      } else {
        logger.warn(
          { status: response.status, operationName },
          'Veo 3 poll request returned non-200'
        );
      }
    } catch (err) {
      logger.warn({ err, operationName }, 'Veo 3 poll error');
    }

    await sleep(video.pollIntervalMs);
  }

  logger.warn({ operationName, elapsedMs: Date.now() - startTime }, 'Veo 3 poll timed out');
  return null;
}

/**
 * Sleep utility.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
