// server/src/workers/bundle-composition.js

import { Worker } from 'bullmq';
import { redis } from '../lib/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { dispatchJob } from '../queues/dispatch.js';
import { createJobLogger } from './job-logger.js';
import { logger } from '../lib/logger.js';
import { getGoogleAIClient } from '../services/providers.js';

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
 * Download an image from a URL and return it as a base64 data part
 * compatible with the Gemini API.
 * @param {string} url
 * @returns {Promise<{inlineData: {data: string, mimeType: string}}>}
 */
async function fetchImageAsPart(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${url}: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const mimeType = response.headers.get('content-type') || 'image/png';
  return {
    inlineData: {
      data: buffer.toString('base64'),
      mimeType,
    },
  };
}

/**
 * Generate a bundle composition image via Gemini 3 Pro Image.
 * Sends product mockup images as inline data to Gemini for compositing.
 *
 * @param {string} prompt - Composition prompt
 * @param {string[]} productMockupUrls - URLs of product mockups to composite
 * @returns {Promise<string>} Base64 data URL of the composed image
 */
async function generateBundleComposition(prompt, productMockupUrls) {
  logger.debug({ prompt: prompt.slice(0, 100), productCount: productMockupUrls.length }, 'Generating bundle composition via Gemini');

  const genAI = getGoogleAIClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  // Download all product mockup images in parallel
  const imageParts = await Promise.all(
    productMockupUrls.map((url) => fetchImageAsPart(url))
  );

  // Send prompt + images to Gemini for compositing
  const result = await model.generateContent([
    prompt,
    ...imageParts,
  ]);

  const response = result.response;
  const candidates = response.candidates;

  if (!candidates || candidates.length === 0) {
    throw new Error('Gemini returned no candidates for bundle composition');
  }

  // Look for an image part in the response
  for (const part of candidates[0].content.parts) {
    if (part.inlineData) {
      // Return as a data URL that can be uploaded to storage
      const { data, mimeType } = part.inlineData;
      return `data:${mimeType};base64,${data}`;
    }
  }

  // If no image returned, the model may have only returned text
  throw new Error('Gemini did not return an image for bundle composition');
}

/**
 * Bundle Composition worker -- composites multiple product mockups into a bundle image.
 *
 * @param {import('socket.io').Server} io
 * @returns {Worker}
 */
export function initBundleCompositionWorker(io) {
  const queueConfig = QUEUE_CONFIGS['bundle-composition'];

  const worker = new Worker(
    'bundle-composition',
    async (job) => {
      const {
        userId, brandId, bundleName, productMockupUrls,
        brandName, colorPalette, compositionStyle,
      } = job.data;

      const jobLog = createJobLogger(job, 'bundle-composition');
      const room = `brand:${brandId}`;
      const jobRoom = `job:${job.id}`;

      jobLog.info({ bundleName, productCount: productMockupUrls.length, compositionStyle }, 'Bundle composition started');

      try {
        // Step 1: Compose prompt (10%)
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'composing',
          progress: 10, message: `Composing ${bundleName} bundle layout...`, timestamp: Date.now(),
        });
        await job.updateProgress(10);

        const prompt = `Professional product bundle composition for "${brandName}" brand. Bundle name: "${bundleName}". Style: ${compositionStyle}. Brand colors: ${colorPalette.join(', ')}. Arrange ${productMockupUrls.length} products in an attractive ${compositionStyle} layout. Clean, e-commerce ready, studio quality. White or branded background.`;

        // Step 2: Generate composition (10-70%)
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'generating',
          progress: 30, message: `Generating ${bundleName} bundle image...`, timestamp: Date.now(),
        });
        await job.updateProgress(30);

        const imageUrl = await generateBundleComposition(prompt, productMockupUrls);

        // Step 3: Queue upload (70-90%)
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'uploading',
          progress: 70, message: 'Uploading bundle image...', timestamp: Date.now(),
        });
        await job.updateProgress(70);

        const uploadResult = await dispatchJob('image-upload', {
          userId, brandId,
          assetType: 'bundle',
          sourceUrl: imageUrl,
          fileName: `bundle-${brandId}-${Date.now()}.png`,
          mimeType: 'image/png',
          metadata: { bundleName, compositionStyle, productCount: productMockupUrls.length },
        });

        // Step 4: Save to brand_assets (90%)
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'saving',
          progress: 90, message: 'Saving bundle composition...', timestamp: Date.now(),
        });
        await job.updateProgress(90);

        const { data: savedAsset, error: saveError } = await supabaseAdmin
          .from('brand_assets')
          .insert({
            brand_id: brandId,
            asset_type: 'bundle',
            url: imageUrl,
            metadata: {
              bundle_name: bundleName,
              composition_style: compositionStyle,
              product_count: productMockupUrls.length,
              prompt,
              upload_job_id: uploadResult.jobId,
            },
            is_selected: false,
          })
          .select()
          .single();

        if (saveError) {
          throw new Error(`Failed to save bundle asset: ${saveError.message}`);
        }

        // Step 5: Complete (100%)
        await supabaseAdmin.from('generation_jobs').update({
          status: 'complete',
          result: { bundle: savedAsset },
          progress: 100,
          completed_at: new Date().toISOString(),
        }).eq('bullmq_job_id', job.id);

        await job.updateProgress(100);

        io.of('/wizard').to(jobRoom).to(room).emit('job:complete', {
          jobId: job.id,
          brandId,
          status: 'complete',
          progress: 100,
          message: `${bundleName} bundle composed!`,
          result: { bundle: savedAsset },
          timestamp: Date.now(),
        });

        jobLog.info('Bundle composition complete');
        return { bundle: savedAsset };
      } catch (error) {
        jobLog.error({ err: error }, 'Bundle composition failed');

        await supabaseAdmin.from('generation_jobs').update({
          status: 'failed',
          error: error.message,
        }).eq('bullmq_job_id', job.id).catch((dbErr) => {
          jobLog.error({ err: dbErr }, 'Failed to update generation_jobs on failure');
        });

        io.of('/wizard').to(jobRoom).to(room).emit('job:failed', {
          jobId: job.id, brandId,
          error: error.message,
          retriesLeft: (queueConfig.retry.attempts - job.attemptsMade),
          timestamp: Date.now(),
        });

        throw error;
      }
    },
    {
      connection: getBullRedisConfig(),
      concurrency: queueConfig.concurrency,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Bundle composition worker: job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Bundle composition worker: error');
  });

  return worker;
}
