// server/src/workers/image-upload.js

import { Worker } from 'bullmq';
import { redis } from '../lib/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { createJobLogger } from './job-logger.js';
import { logger } from '../lib/logger.js';

/**
 * @returns {import('ioredis').RedisOptions}
 */
function getBullRedisConfig() {
  return {
    host: redis.options.host,
    port: redis.options.port,
    password: redis.options.password,
    db: redis.options.db,
    maxRetriesPerRequest: null,
  };
}

/**
 * Image Upload worker -- downloads images from temporary AI provider URLs
 * and uploads them to Supabase Storage for permanent hosting.
 *
 * Flow:
 * 1. Download image from sourceUrl (temporary URL from BFL, OpenAI, etc.)
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
        // Step 1: Download image from temporary AI provider URL
        jobLog.debug('Downloading image from source URL');
        const response = await fetch(sourceUrl);

        if (!response.ok) {
          throw new Error(`Failed to download image: HTTP ${response.status} from ${sourceUrl}`);
        }

        const imageBuffer = Buffer.from(await response.arrayBuffer());
        jobLog.debug({ size: imageBuffer.length }, 'Image downloaded');

        await job.updateProgress(50);

        // Step 2: Upload to Supabase Storage
        jobLog.debug({ storagePath }, 'Uploading to Supabase Storage');
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
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

        // Find the brand_asset record that has this upload job's ID in metadata
        const { error: updateError } = await supabaseAdmin
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
          })
          .eq('brand_id', brandId)
          .eq('url', sourceUrl);

        if (updateError) {
          jobLog.warn({ err: updateError }, 'Failed to update brand_assets record (may not exist yet)');
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
