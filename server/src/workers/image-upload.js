// server/src/workers/image-upload.js

import { Worker } from 'bullmq';
import { redis, getBullRedisConfig } from '../lib/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { createJobLogger } from './job-logger.js';
import { logger } from '../lib/logger.js';

/**
 * Image Upload worker -- downloads images from temporary AI provider URLs
 * and uploads them to Supabase Storage for permanent hosting.
 *
 * Flow:
 * 1. Download image from sourceUrl (temporary URL from FAL.ai, OpenAI, etc.)
 * 2. Upload to Supabase Storage bucket 'brand-assets'
 * 3. Update the brand_assets record with the permanent storage URL
 *
 * @param {import('socket.io').Server} _io - Not actively used for progress, but kept for interface consistency
 * @returns {Worker}
 */
export function initImageUploadWorker(_io) {
  const queueConfig = QUEUE_CONFIGS['image-upload'];

  const worker = new Worker(
    'image-upload',
    async (job) => {
      const { userId, brandId, assetType, sourceUrl, fileName, mimeType, metadata } = job.data;
      const jobLog = createJobLogger(job, 'image-upload');

      const storagePath = `${userId}/${brandId}/${assetType}/${fileName}`;

      jobLog.info({ storagePath, sourceUrl: sourceUrl.slice(0, 80) }, 'Image upload started');

      try {
        // Step 1: Get image buffer (from URL or base64 data URL)
        /** @type {Buffer} */
        let imageBuffer;

        if (sourceUrl.startsWith('data:')) {
          // Handle base64 data URLs (e.g. from Gemini image generation)
          jobLog.debug('Decoding base64 data URL');
          const base64Data = sourceUrl.split(',')[1];
          if (!base64Data) {
            throw new Error('Invalid data URL: missing base64 content');
          }
          imageBuffer = Buffer.from(base64Data, 'base64');
        } else {
          // Download from remote URL
          jobLog.debug('Downloading image from source URL');
          const response = await fetch(sourceUrl);
          if (!response.ok) {
            throw new Error(`Failed to download image: HTTP ${response.status} from ${sourceUrl}`);
          }
          imageBuffer = Buffer.from(await response.arrayBuffer());
        }

        jobLog.debug({ size: imageBuffer.length }, 'Image ready for upload');

        await job.updateProgress(50);

        // Step 2: Upload to Supabase Storage
        jobLog.debug({ storagePath }, 'Uploading to Supabase Storage');
        const { data: _uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('brand-assets')
          .upload(storagePath, imageBuffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Supabase Storage upload failed: ${uploadError.message}`);
        }

        // Get the public URL for the uploaded file
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from('brand-assets')
          .getPublicUrl(storagePath);

        await job.updateProgress(80);

        // Step 3: Update brand_assets record with permanent URL
        jobLog.debug({ publicUrl }, 'Updating brand_assets with permanent URL');

        // Try matching by upload_job_id in metadata (most reliable),
        // then fall back to matching by temporary source URL.
        let updated = false;

        // Primary: match by upload_job_id or png_upload_job_id in brand_assets.metadata
        for (const metaKey of ['upload_job_id', 'png_upload_job_id']) {
          const { error: metaError, count: metaCount } = await supabaseAdmin
            .from('brand_assets')
            .update({
              url: publicUrl,
              metadata: {
                ...metadata,
                storage_path: storagePath,
                original_url: sourceUrl,
                upload_completed: true,
                uploaded_at: new Date().toISOString(),
              },
            }, { count: 'exact' })
            .eq('brand_id', brandId)
            .eq(`metadata->>${metaKey}`, job.id);

          if (!metaError && metaCount > 0) {
            updated = true;
            jobLog.debug({ matchMethod: metaKey }, 'Updated brand_assets via metadata match');
            break;
          }
        }

        // Fallback: match by source URL (for assets saved without upload_job_id)
        if (!updated) {
          const { error: urlError, count: urlCount } = await supabaseAdmin
            .from('brand_assets')
            .update({
              url: publicUrl,
              metadata: {
                ...metadata,
                storage_path: storagePath,
                original_url: sourceUrl,
                upload_completed: true,
                uploaded_at: new Date().toISOString(),
              },
            }, { count: 'exact' })
            .eq('brand_id', brandId)
            .eq('url', sourceUrl);

          if (urlError) {
            jobLog.warn({ err: urlError }, 'Failed to update brand_assets record');
          } else if (urlCount > 0) {
            updated = true;
            jobLog.debug({ matchMethod: 'source_url' }, 'Updated brand_assets via URL match');
          }
        }

        if (!updated) {
          jobLog.warn('No brand_assets record matched for URL replacement (asset may not exist yet)');
        }

        await job.updateProgress(100);

        jobLog.info({ storagePath, publicUrl, size: imageBuffer.length }, 'Image upload complete');

        return {
          uploaded: true,
          storagePath,
          publicUrl,
          size: imageBuffer.length,
        };
      } catch (error) {
        jobLog.error({ err: error, storagePath }, 'Image upload failed');
        throw error;
      }
    },
    {
      connection: getBullRedisConfig(),
      concurrency: queueConfig.concurrency,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err, attempts: job?.attemptsMade }, 'Image upload worker: job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Image upload worker: error');
  });

  return worker;
}
