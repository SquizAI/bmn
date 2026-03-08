// server/src/workers/logo-generation.js

import { Worker } from 'bullmq';
import { redis, getBullRedisConfig } from '../lib/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { dispatchJob } from '../queues/dispatch.js';
import { createJobLogger } from './job-logger.js';
import { logger } from '../lib/logger.js';
import { recraftClient } from '../services/providers.js';
import { resolveLogoTemplate } from '../data/logo-templates.js';

/**
 * Logo Generation worker -- template-driven logo generation via Recraft V4.
 *
 * Flow:
 *   1. Resolve JSON logo template from (archetype, style) pair
 *   2. Build per-variation prompts from template
 *   3. Generate SVG vectors via Recraft V4 text-to-vector
 *   4. For any non-SVG results, vectorize PNG→SVG via Recraft vectorize
 *   5. Upload all assets to Supabase Storage
 *   6. Save brand_assets records with template metadata
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
        brandVision, archetype, count, isRefinement, previousLogoUrl: _previousLogoUrl,
        refinementNotes, industry, variations,
        logoConcept, tagline, personalityTraits, brandVoiceTone, primaryFont,
      } = job.data;

      const jobLog = createJobLogger(job, 'logo-generation');
      const userRoom = `user:${userId}`;
      const logos = [];

      jobLog.info({ count, logoStyle, archetype }, 'Logo generation started');

      try {
        // ── Step 1: Resolve template + compose prompts (5-10%) ──────────

        io.to(userRoom).emit('job:progress', {
          jobId: job.id, brandId, status: 'composing',
          progress: 5, message: 'Building logo templates...', timestamp: Date.now(),
        });
        await job.updateProgress(5);

        const template = resolveLogoTemplate({
          brandName,
          logoStyle,
          archetype,
          brandVision,
          industry,
          colorPalette,
          count,
          variations,
          refinementNotes,
          logoConcept,
          tagline,
          personalityTraits,
          brandVoiceTone,
          primaryFont,
        });

        jobLog.info(
          { variations: template.prompts.map((p) => p.variation), templateVersion: template.metadata.templateVersion },
          'Template resolved'
        );

        io.to(userRoom).emit('job:progress', {
          jobId: job.id, brandId, status: 'composing',
          progress: 10,
          message: `Generating ${template.prompts.length} logo variations: ${template.prompts.map((p) => p.label).join(', ')}`,
          timestamp: Date.now(),
        });
        await job.updateProgress(10);

        // ── Step 2: Generate logos in parallel via Recraft V4 (10-70%) ──

        const progressPerLogo = 60 / template.prompts.length;

        const generationResults = await Promise.allSettled(
          template.prompts.map(async (prompt, index) => {
            const logoNumber = index + 1;

            io.to(userRoom).emit('job:progress', {
              jobId: job.id, brandId, status: 'generating',
              progress: Math.round(10 + (index * progressPerLogo)),
              message: `Generating ${prompt.label} (${logoNumber}/${template.prompts.length})...`,
              timestamp: Date.now(),
            });

            const { imageUrl, contentType } = await recraftClient.generateVector({
              prompt: prompt.text,
              image_size: template.recraftParams.image_size,
              colors: template.recraftParams.colors,
            });

            io.to(userRoom).emit('job:progress', {
              jobId: job.id, brandId, status: 'generating',
              progress: Math.round(10 + ((index + 1) * progressPerLogo)),
              message: `${prompt.label} generated!`,
              logoIndex: index,
              timestamp: Date.now(),
            });

            return { index, imageUrl, contentType, prompt: prompt.text, variation: prompt.variation, label: prompt.label };
          })
        );

        await job.updateProgress(70);

        // ── Step 3: Vectorize any non-SVG results (70-80%) ──────────────

        io.to(userRoom).emit('job:progress', {
          jobId: job.id, brandId, status: 'vectorizing',
          progress: 70, message: 'Converting to vector format...', timestamp: Date.now(),
        });

        const vectorizedResults = [];

        for (const result of generationResults) {
          if (result.status !== 'fulfilled') {
            jobLog.warn({ err: result.reason }, 'Individual logo generation failed');
            continue;
          }

          const { index, imageUrl, contentType, prompt, variation, label } = result.value;
          const isSvg = contentType === 'image/svg+xml' || imageUrl.endsWith('.svg');

          if (isSvg) {
            // Already SVG -- no conversion needed
            vectorizedResults.push({
              index, svgUrl: imageUrl, pngUrl: null, contentType: 'image/svg+xml',
              prompt, variation, label,
            });
          } else {
            // PNG/JPG result -- vectorize to SVG
            try {
              jobLog.info({ index, variation }, 'Vectorizing raster logo to SVG');
              const { svgUrl } = await recraftClient.vectorize({ imageUrl });
              vectorizedResults.push({
                index, svgUrl, pngUrl: imageUrl, contentType: 'image/svg+xml',
                prompt, variation, label,
              });
            } catch (vecErr) {
              jobLog.warn({ err: vecErr, index }, 'Vectorization failed, keeping raster version');
              vectorizedResults.push({
                index, svgUrl: null, pngUrl: imageUrl, contentType: contentType || 'image/png',
                prompt, variation, label,
              });
            }
          }
        }

        await job.updateProgress(80);

        // ── Step 4: Upload to storage (80-90%) ──────────────────────────

        io.to(userRoom).emit('job:progress', {
          jobId: job.id, brandId, status: 'uploading',
          progress: 80, message: 'Uploading logos to storage...', timestamp: Date.now(),
        });

        for (const logo of vectorizedResults) {
          const primaryUrl = logo.svgUrl || logo.pngUrl;
          const isSvg = logo.contentType === 'image/svg+xml';
          const ext = isSvg ? 'svg' : 'png';

          // Upload primary asset (SVG preferred)
          const uploadResult = await dispatchJob('image-upload', {
            userId,
            brandId,
            assetType: 'logo',
            sourceUrl: primaryUrl,
            fileName: `logo-${brandId}-${logo.variation}-${Date.now()}.${ext}`,
            mimeType: logo.contentType,
            metadata: {
              prompt: logo.prompt,
              logoStyle,
              variation: logo.variation,
              label: logo.label,
              index: logo.index,
              isRefinement,
              model: 'recraft-v4',
              templateVersion: template.metadata.templateVersion,
              hasSvg: !!logo.svgUrl,
              hasPng: !!logo.pngUrl,
            },
          });

          // If we have both SVG and PNG, upload the PNG as a secondary asset
          let pngUploadJobId = null;
          if (logo.svgUrl && logo.pngUrl) {
            const pngUpload = await dispatchJob('image-upload', {
              userId,
              brandId,
              assetType: 'logo',
              sourceUrl: logo.pngUrl,
              fileName: `logo-${brandId}-${logo.variation}-raster-${Date.now()}.png`,
              mimeType: 'image/png',
              metadata: {
                prompt: logo.prompt,
                logoStyle,
                variation: logo.variation,
                index: logo.index,
                isRasterCopy: true,
                model: 'recraft-v4',
              },
            });
            pngUploadJobId = pngUpload.jobId;
          }

          logos.push({
            index: logo.index,
            tempUrl: primaryUrl,
            svgUrl: logo.svgUrl,
            pngUrl: logo.pngUrl,
            uploadJobId: uploadResult.jobId,
            pngUploadJobId,
            prompt: logo.prompt,
            variation: logo.variation,
            label: logo.label,
          });
        }

        await job.updateProgress(90);

        // ── Step 5: Save to brand_assets (90-95%) ───────────────────────

        io.to(userRoom).emit('job:progress', {
          jobId: job.id, brandId, status: 'saving',
          progress: 90, message: 'Saving logo records...', timestamp: Date.now(),
        });

        const assetRecords = logos.map((logo) => ({
          brand_id: brandId,
          asset_type: 'logo',
          url: logo.svgUrl || logo.pngUrl,
          metadata: {
            prompt: logo.prompt,
            logo_style: logoStyle,
            variation: logo.variation,
            label: logo.label,
            index: logo.index,
            is_refinement: isRefinement,
            upload_job_id: logo.uploadJobId,
            png_upload_job_id: logo.pngUploadJobId,
            svg_url: logo.svgUrl,
            png_url: logo.pngUrl,
            has_vector: !!logo.svgUrl,
            model: 'recraft-v4',
            template_version: template.metadata.templateVersion,
            archetype,
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

        // ── Step 6: Update generation_jobs (95-100%) ────────────────────

        await supabaseAdmin.from('generation_jobs').update({
          status: 'complete',
          result: {
            logos: savedAssets,
            generated: logos.length,
            requested: count,
            vectorized: logos.filter((l) => l.svgUrl).length,
            template: {
              style: logoStyle,
              archetype,
              version: template.metadata.templateVersion,
              variations: logos.map((l) => l.variation),
            },
          },
          progress: 100,
          completed_at: new Date().toISOString(),
        }).eq('bullmq_job_id', job.id);

        await job.updateProgress(100);

        // Emit: complete
        io.to(userRoom).emit('job:complete', {
          jobId: job.id,
          brandId,
          status: 'complete',
          progress: 100,
          message: `${logos.length} logos generated (${logos.filter((l) => l.svgUrl).length} vectorized)!`,
          result: { logos: savedAssets },
          timestamp: Date.now(),
        });

        jobLog.info({ generated: logos.length, vectorized: logos.filter((l) => l.svgUrl).length }, 'Logo generation complete');
        return { logos: savedAssets };
      } catch (error) {
        jobLog.error({ err: error }, 'Logo generation failed');

        await supabaseAdmin.from('generation_jobs').update({
          status: 'failed',
          error: error.message,
        }).eq('bullmq_job_id', job.id).catch((dbErr) => {
          jobLog.error({ err: dbErr }, 'Failed to update generation_jobs on failure');
        });

        io.to(userRoom).emit('job:failed', {
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
