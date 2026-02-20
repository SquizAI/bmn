// server/src/workers/logo-generation.js

import { Worker } from 'bullmq';
import { redis } from '../lib/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { dispatchJob } from '../queues/dispatch.js';
import { createJobLogger } from './job-logger.js';
import { logger } from '../lib/logger.js';
import { bflClient } from '../services/providers.js';

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
 * Compose prompts for logo generation based on brand identity.
 * @param {Object} params
 * @param {string} params.brandName
 * @param {string} params.logoStyle
 * @param {string[]} params.colorPalette
 * @param {string} params.brandVision
 * @param {string} [params.archetype]
 * @param {boolean} [params.isRefinement]
 * @param {string} [params.previousLogoUrl]
 * @param {string} [params.refinementNotes]
 * @param {number} params.count
 * @returns {Array<{text: string}>}
 */
function composeLogoPrompts({ brandName, logoStyle, colorPalette, brandVision, archetype, count }) {
  const basePrompt = `Professional brand logo for "${brandName}". Style: ${logoStyle}. Colors: ${colorPalette.join(', ')}. Brand vision: ${brandVision}. ${archetype ? `Brand archetype: ${archetype}.` : ''} Clean vector-style logo on white background, suitable for business use. No text unless the brand name is the logo. High contrast, scalable design.`;

  const variations = [
    'Icon-focused design with abstract symbol',
    'Lettermark design using brand initials',
    'Emblem or badge style',
    'Modern minimalist wordmark',
    'Combination mark (symbol + text)',
    'Geometric abstract logo',
    'Organic hand-drawn feel',
    'Negative space design',
  ];

  return Array.from({ length: count }, (_, i) => ({
    text: `${basePrompt} Variation: ${variations[i % variations.length]}.`,
  }));
}

/**
 * Logo Generation worker -- generates logos via FLUX.2 Pro (BFL direct API).
 * Generates `count` logos in parallel, emitting progress per logo.
 *
 * @param {import('socket.io').Server} io
 * @returns {Worker}
 */
export function initLogoGenerationWorker(io) {
  const queueConfig = QUEUE_CONFIGS['logo-generation'];

  const worker = new Worker(
    'logo-generation',
    async (job) => {
      const {
        userId, brandId, brandName, logoStyle, colorPalette,
        brandVision, archetype, count, isRefinement, previousLogoUrl,
        refinementNotes,
      } = job.data;

      const jobLog = createJobLogger(job, 'logo-generation');
      const room = `brand:${brandId}`;
      const jobRoom = `job:${job.id}`;
      const logos = [];

      jobLog.info({ count, logoStyle }, 'Logo generation started');

      try {
        // Step 1: Compose prompts (5-10%)
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'composing',
          progress: 5, message: 'Composing logo prompts...', timestamp: Date.now(),
        });
        await job.updateProgress(5);

        const prompts = composeLogoPrompts({
          brandName, logoStyle, colorPalette, brandVision, archetype,
          isRefinement, previousLogoUrl, refinementNotes, count,
        });

        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'composing',
          progress: 10, message: 'Prompts ready. Starting generation...', timestamp: Date.now(),
        });
        await job.updateProgress(10);

        // Step 2: Generate logos in parallel via BFL FLUX.2 Pro (10-80%)
        const progressPerLogo = 70 / count;

        const generationResults = await Promise.allSettled(
          prompts.map(async (prompt, index) => {
            const logoNumber = index + 1;

            io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
              jobId: job.id, brandId, status: 'generating',
              progress: Math.round(10 + (index * progressPerLogo)),
              message: `Generating logo ${logoNumber} of ${count}...`,
              timestamp: Date.now(),
            });

            const { taskId } = await bflClient.submit({
              prompt: prompt.text,
              width: 1024,
              height: 1024,
            });
            const { imageUrl } = await bflClient.poll(taskId, 90_000);

            io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
              jobId: job.id, brandId, status: 'generating',
              progress: Math.round(10 + ((index + 1) * progressPerLogo)),
              message: `Logo ${logoNumber} generated!`,
              logoIndex: index,
              timestamp: Date.now(),
            });

            return { index, imageUrl, prompt: prompt.text };
          })
        );

        await job.updateProgress(80);

        // Step 3: Upload to storage (80-90%)
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'uploading',
          progress: 80, message: 'Uploading logos to storage...', timestamp: Date.now(),
        });

        for (const result of generationResults) {
          if (result.status === 'fulfilled') {
            const { index, imageUrl, prompt } = result.value;

            const uploadResult = await dispatchJob('image-upload', {
              userId,
              brandId,
              assetType: 'logo',
              sourceUrl: imageUrl,
              fileName: `logo-${brandId}-${index}-${Date.now()}.png`,
              mimeType: 'image/png',
              metadata: { prompt, logoStyle, index, isRefinement },
            });

            logos.push({
              index,
              tempUrl: imageUrl,
              uploadJobId: uploadResult.jobId,
              prompt,
            });
          } else {
            jobLog.warn({ err: result.reason }, 'Individual logo generation failed');
          }
        }

        await job.updateProgress(90);

        // Step 4: Save to brand_assets (90-95%)
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'saving',
          progress: 90, message: 'Saving logo records...', timestamp: Date.now(),
        });

        const assetRecords = logos.map((logo) => ({
          brand_id: brandId,
          asset_type: 'logo',
          url: logo.tempUrl,
          metadata: {
            prompt: logo.prompt,
            logo_style: logoStyle,
            index: logo.index,
            is_refinement: isRefinement,
            upload_job_id: logo.uploadJobId,
          },
          is_selected: false,
        }));

        const { data: savedAssets, error: saveError } = await supabaseAdmin
          .from('brand_assets')
          .insert(assetRecords)
          .select();

        if (saveError) {
          throw new Error(`Failed to save logo assets: ${saveError.message}`);
        }

        // Step 5: Update generation_jobs (95-100%)
        await supabaseAdmin.from('generation_jobs').update({
          status: 'complete',
          result: { logos: savedAssets, generated: logos.length, requested: count },
          progress: 100,
          completed_at: new Date().toISOString(),
        }).eq('bullmq_job_id', job.id);

        await job.updateProgress(100);

        // Emit: complete
        io.of('/wizard').to(jobRoom).to(room).emit('job:complete', {
          jobId: job.id,
          brandId,
          status: 'complete',
          progress: 100,
          message: `${logos.length} logos generated!`,
          result: { logos: savedAssets },
          timestamp: Date.now(),
        });

        jobLog.info({ generated: logos.length }, 'Logo generation complete');
        return { logos: savedAssets };
      } catch (error) {
        jobLog.error({ err: error }, 'Logo generation failed');

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
    logger.error({ jobId: job?.id, err }, 'Logo generation worker: job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Logo generation worker: error');
  });

  return worker;
}
