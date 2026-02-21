// server/src/workers/print-export.js

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
 * Print Export worker -- generates high-resolution print-ready artwork.
 * Uses Sharp for image compositing and CMYK conversion.
 *
 * NOTE: Full implementation requires `sharp` and `pdfkit` packages.
 * This is the worker skeleton with Socket.io progress events.
 * The actual image compositing will be implemented once dependencies are installed.
 *
 * @param {import('socket.io').Server} io
 * @returns {Worker}
 */
export function initPrintExportWorker(io) {
  const queueConfig = QUEUE_CONFIGS['print-export'];

  const worker = new Worker(
    'print-export',
    async (job) => {
      const { userId, brandId, productId, templateId, format } = job.data;
      const jobLog = createJobLogger(job, 'print-export');
      const room = `brand:${brandId}`;
      const jobRoom = `job:${job.id}`;

      jobLog.info({ productId, format }, 'Print export started');

      try {
        // Step 1: Load data (10%)
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'loading',
          progress: 10, message: 'Loading brand and template data...', timestamp: Date.now(),
        });
        await job.updateProgress(10);

        // Load template
        const { data: template, error: tmplErr } = await supabaseAdmin
          .from('packaging_templates')
          .select('*')
          .eq('id', templateId)
          .single();

        if (tmplErr || !template) {
          throw new Error('Packaging template not found');
        }

        // Load brand data
        const { data: brand } = await supabaseAdmin
          .from('brands')
          .select('id, name, wizard_state')
          .eq('id', brandId)
          .single();

        if (!brand) throw new Error('Brand not found');

        // Load brand's selected logo
        const { data: logos } = await supabaseAdmin
          .from('brand_assets')
          .select('url, mime_type')
          .eq('brand_id', brandId)
          .eq('asset_type', 'logo')
          .eq('is_selected', true)
          .limit(1);

        const logoUrl = logos?.[0]?.url || null;

        // Load product
        const { data: product } = await supabaseAdmin
          .from('products')
          .select('name, category, metadata')
          .eq('id', productId)
          .single();

        // Step 2: Prepare artwork (30%)
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'preparing',
          progress: 30, message: 'Preparing print artwork...', timestamp: Date.now(),
        });
        await job.updateProgress(30);

        // Extract brand colors from wizard_state
        const identity = brand.wizard_state?.['brand-identity'] || {};
        const colorPalette = identity.colors || identity.colorPalette || [];
        const brandName = brand.name;
        const printSpecs = template.print_specs || { dpi: 300, bleed_mm: 3, color_space: 'CMYK' };

        // Step 3: Composite image (30-80%)
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'compositing',
          progress: 50, message: 'Compositing print-ready artwork...', timestamp: Date.now(),
        });
        await job.updateProgress(50);

        // For now, generate a print-spec metadata record.
        // Full Sharp/pdfkit compositing will be added when dependencies are installed.
        const printMetadata = {
          template_slug: template.slug,
          template_name: template.name,
          product_name: product?.name || 'Unknown Product',
          brand_name: brandName,
          logo_url: logoUrl,
          color_palette: colorPalette,
          branding_zones: template.branding_zones,
          print_specs: printSpecs,
          format,
          status: 'specs_generated',
          note: 'Print-ready compositing requires sharp + pdfkit. Install with: npm i sharp pdfkit',
        };

        // Step 4: Save asset record (90%)
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'saving',
          progress: 90, message: 'Saving print export...', timestamp: Date.now(),
        });
        await job.updateProgress(90);

        const { data: savedAsset, error: saveErr } = await supabaseAdmin
          .from('brand_assets')
          .insert({
            brand_id: brandId,
            asset_type: 'print_ready',
            product_id: productId,
            url: template.template_image_url, // placeholder until actual compositing
            metadata: printMetadata,
            is_selected: false,
          })
          .select()
          .single();

        if (saveErr) {
          throw new Error(`Failed to save print asset: ${saveErr.message}`);
        }

        // Step 5: Update job status (100%)
        await supabaseAdmin.from('generation_jobs').update({
          status: 'complete',
          result: { printAsset: savedAsset },
          progress: 100,
          completed_at: new Date().toISOString(),
        }).eq('bullmq_job_id', job.id);

        await job.updateProgress(100);

        io.of('/wizard').to(jobRoom).to(room).emit('job:complete', {
          jobId: job.id, brandId, status: 'complete',
          progress: 100, message: 'Print export complete!',
          result: { printAsset: savedAsset },
          timestamp: Date.now(),
        });

        jobLog.info('Print export complete');
        return { printAsset: savedAsset };
      } catch (error) {
        jobLog.error({ err: error }, 'Print export failed');

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
    logger.error({ jobId: job?.id, err }, 'Print export worker: job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Print export worker: error');
  });

  return worker;
}
