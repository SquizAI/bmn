// server/src/workers/print-export.js

import { Worker } from 'bullmq';
import { redis } from '../lib/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { dispatchJob } from '../queues/dispatch.js';
import { createJobLogger } from './job-logger.js';
import { logger } from '../lib/logger.js';
import { getOpenAIClient } from '../services/providers.js';

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
 * Build a print-ready generation prompt from a packaging template and brand data.
 * Replaces template placeholders ({{brandName}}, {{brandVision}}, {{colorPrimary}},
 * {{colorSecondary}}, {{productName}}) in the template's ai_prompt_template.
 * Falls back to composing from branding_zones and template metadata.
 *
 * @param {Object} params
 * @param {Object} params.template - packaging_templates row
 * @param {Object} params.brand - brands row (with wizard_state)
 * @param {Object|null} params.product - products row
 * @param {string|null} params.logoUrl - URL of the brand's selected logo
 * @param {string} params.format - 'pdf' or 'png_300dpi'
 * @returns {string}
 */
function composePrintPrompt({ template, brand, product, logoUrl: _logoUrl, format: _format }) {
  const identity = brand.wizard_state?.['brand-identity'] || {};
  const colorPalette = identity.colors || identity.colorPalette || [];
  const brandVision = identity.vision || identity.brandVision || '';
  const brandName = brand.name || 'Brand';
  const productName = product?.name || 'Product';
  const colorPrimary = colorPalette[0] || '#000000';
  const colorSecondary = colorPalette[1] || colorPalette[0] || '#333333';
  const printSpecs = template.print_specs || {};
  const dpi = printSpecs.dpi || 300;

  // If template has an ai_prompt_template, use it with placeholder replacement
  if (template.ai_prompt_template) {
    let prompt = template.ai_prompt_template
      .replace(/\{\{brandName\}\}/g, brandName)
      .replace(/\{\{brandVision\}\}/g, brandVision)
      .replace(/\{\{colorPrimary\}\}/g, colorPrimary)
      .replace(/\{\{colorSecondary\}\}/g, colorSecondary)
      .replace(/\{\{productName\}\}/g, productName);

    prompt += ` Print-ready at ${dpi} DPI.`;
    if (printSpecs.bleed_mm) {
      prompt += ` Include ${printSpecs.bleed_mm}mm bleed area.`;
    }
    if (printSpecs.color_space) {
      prompt += ` Optimized for ${printSpecs.color_space} color space.`;
    }
    prompt += ' Ultra-high detail, crisp edges, professional packaging artwork.';

    return prompt;
  }

  // Fallback: compose from branding zones and template metadata
  let prompt = `Professional print-ready packaging artwork for "${productName}" by "${brandName}". `;
  prompt += `Template: ${template.name} (${template.category || 'packaging'}). `;
  prompt += `Brand colors: primary ${colorPrimary}, secondary ${colorSecondary}. `;

  if (brandVision) {
    prompt += `Brand vision: ${brandVision}. `;
  }

  // Describe branding zone placement
  const zones = template.branding_zones || [];
  for (const zone of zones) {
    if (zone.type === 'logo') {
      prompt += `The brand logo is prominently placed in the ${zone.label || 'center'} area. `;
    } else if (zone.type === 'text') {
      prompt += `"${brandName}" text appears in the ${zone.label || 'header'} area with clean typography. `;
    } else if (zone.type === 'color_fill') {
      prompt += `${zone.label || 'Background'} area uses brand color ${colorPrimary}. `;
    } else if (zone.type === 'product_image') {
      prompt += `Product image displayed in the ${zone.label || 'main'} area. `;
    }
  }

  if (template.template_width_px && template.template_height_px) {
    prompt += `Canvas: ${template.template_width_px}x${template.template_height_px}px. `;
  }

  prompt += `Print-ready at ${dpi} DPI.`;
  if (printSpecs.bleed_mm) {
    prompt += ` Include ${printSpecs.bleed_mm}mm bleed area.`;
  }
  if (printSpecs.color_space) {
    prompt += ` Optimized for ${printSpecs.color_space} color space.`;
  }
  prompt += ' Ultra-high detail, crisp edges, photorealistic professional packaging artwork. No text errors.';

  return prompt;
}

/**
 * Determine the GPT Image output size from template dimensions.
 * Maps template aspect ratio to the closest supported OpenAI size.
 * @param {Object} template - packaging_templates row
 * @returns {string} OpenAI image size string
 */
function resolveImageSize(template) {
  const w = template.template_width_px || 1024;
  const h = template.template_height_px || 1024;
  const ratio = w / h;

  if (ratio > 1.2) return '1536x1024';   // landscape
  if (ratio < 0.8) return '1024x1536';   // portrait
  return '1024x1024';                     // square
}

/**
 * Print Export worker -- generates print-ready packaging artwork via GPT Image 1.5.
 *
 * Flow:
 *   1. Fetch brand, product, packaging_template, and selected logo from Supabase
 *   2. Build a print-ready prompt from template's ai_prompt_template + branding zones
 *   3. Generate print-ready artwork via GPT Image 1.5 (OpenAI)
 *   4. Dispatch image-upload job to Supabase Storage
 *   5. Save brand_asset record with asset_type='print_ready' and template metadata
 *   6. Update generation_jobs record
 *   7. Emit Socket.io progress events to user:${userId} room on default namespace
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
      const userRoom = `user:${userId}`;

      jobLog.info({ productId, templateId, format }, 'Print export started');

      try {
        // ── Step 1: Load brand, product, template, logo (0-15%) ─────────

        io.to(userRoom).emit('job:progress', {
          jobId: job.id, brandId, status: 'loading',
          progress: 5, message: 'Loading brand and template data...', timestamp: Date.now(),
        });
        await job.updateProgress(5);

        // Fetch packaging template
        const { data: template, error: tmplErr } = await supabaseAdmin
          .from('packaging_templates')
          .select('*')
          .eq('id', templateId)
          .single();

        if (tmplErr || !template) {
          throw new Error(`Packaging template not found: ${tmplErr?.message || templateId}`);
        }

        // Fetch brand with wizard_state
        const { data: brand, error: brandErr } = await supabaseAdmin
          .from('brands')
          .select('id, name, wizard_state')
          .eq('id', brandId)
          .single();

        if (brandErr || !brand) {
          throw new Error(`Brand not found: ${brandErr?.message || brandId}`);
        }

        // Fetch product
        const { data: product, error: productErr } = await supabaseAdmin
          .from('products')
          .select('id, name, category, metadata')
          .eq('id', productId)
          .single();

        if (productErr || !product) {
          throw new Error(`Product not found: ${productErr?.message || productId}`);
        }

        // Fetch the brand's selected logo
        const { data: logoAssets } = await supabaseAdmin
          .from('brand_assets')
          .select('url')
          .eq('brand_id', brandId)
          .eq('asset_type', 'logo')
          .eq('is_selected', true)
          .limit(1);

        const logoUrl = logoAssets?.[0]?.url || null;

        io.to(userRoom).emit('job:progress', {
          jobId: job.id, brandId, status: 'loading',
          progress: 15, message: 'Brand data loaded, composing print artwork...', timestamp: Date.now(),
        });
        await job.updateProgress(15);

        jobLog.info({
          templateSlug: template.slug,
          productName: product.name,
          brandName: brand.name,
          hasLogo: !!logoUrl,
          format,
        }, 'Data loaded');

        // ── Step 2: Compose print-ready prompt (15-25%) ─────────────────

        io.to(userRoom).emit('job:progress', {
          jobId: job.id, brandId, status: 'composing',
          progress: 20, message: 'Building print-ready artwork prompt...', timestamp: Date.now(),
        });
        await job.updateProgress(20);

        const prompt = composePrintPrompt({ template, brand, product, logoUrl, format });
        const imageSize = resolveImageSize(template);

        jobLog.info({ promptLength: prompt.length, imageSize }, 'Print prompt composed');

        io.to(userRoom).emit('job:progress', {
          jobId: job.id, brandId, status: 'composing',
          progress: 25, message: 'Prompt ready, generating artwork...', timestamp: Date.now(),
        });
        await job.updateProgress(25);

        // ── Step 3: Generate via GPT Image 1.5 (25-65%) ─────────────────

        io.to(userRoom).emit('job:progress', {
          jobId: job.id, brandId, status: 'generating',
          progress: 30,
          message: `Generating print-ready ${product.name} artwork via GPT Image...`,
          timestamp: Date.now(),
        });
        await job.updateProgress(30);

        const openai = getOpenAIClient();
        const result = await openai.images.generate({
          model: 'gpt-image-1',
          prompt,
          n: 1,
          size: imageSize,
          quality: 'high',
        });

        const imageUrl = result.data?.[0]?.url;

        if (!imageUrl) {
          throw new Error('GPT Image returned no image URL');
        }

        jobLog.info({ imageSize }, 'Print artwork generated via GPT Image');

        io.to(userRoom).emit('job:progress', {
          jobId: job.id, brandId, status: 'generating',
          progress: 65, message: 'Artwork generated, uploading...', timestamp: Date.now(),
        });
        await job.updateProgress(65);

        // ── Step 4: Dispatch image-upload to Supabase Storage (65-80%) ──

        io.to(userRoom).emit('job:progress', {
          jobId: job.id, brandId, status: 'uploading',
          progress: 70, message: 'Uploading print-ready artwork to storage...', timestamp: Date.now(),
        });
        await job.updateProgress(70);

        const printSpecs = template.print_specs || {};
        const fileName = `print-${brandId}-${productId}-${template.slug}-${Date.now()}.png`;

        const uploadResult = await dispatchJob('image-upload', {
          userId,
          brandId,
          assetType: 'mockup',
          sourceUrl: imageUrl,
          fileName,
          mimeType: 'image/png',
          metadata: {
            productId,
            productName: product.name,
            templateId,
            templateSlug: template.slug,
            format,
            printSpecs,
            isPrintReady: true,
          },
        });

        jobLog.info({ uploadJobId: uploadResult.jobId }, 'Image upload dispatched');

        io.to(userRoom).emit('job:progress', {
          jobId: job.id, brandId, status: 'uploading',
          progress: 80, message: 'Upload dispatched, saving record...', timestamp: Date.now(),
        });
        await job.updateProgress(80);

        // ── Step 5: Save brand_asset with print_ready type (80-95%) ─────

        io.to(userRoom).emit('job:progress', {
          jobId: job.id, brandId, status: 'saving',
          progress: 85, message: 'Saving print export record...', timestamp: Date.now(),
        });
        await job.updateProgress(85);

        const identity = brand.wizard_state?.['brand-identity'] || {};
        const colorPalette = identity.colors || identity.colorPalette || [];

        const { data: savedAsset, error: saveErr } = await supabaseAdmin
          .from('brand_assets')
          .insert({
            brand_id: brandId,
            asset_type: 'print_ready',
            url: imageUrl,
            metadata: {
              product_id: productId,
              product_name: product.name,
              product_category: product.category,
              template_id: templateId,
              template_slug: template.slug,
              template_name: template.name,
              template_category: template.category,
              branding_zones: template.branding_zones,
              print_specs: printSpecs,
              format,
              image_size: imageSize,
              brand_name: brand.name,
              logo_url: logoUrl,
              color_palette: colorPalette,
              upload_job_id: uploadResult.jobId,
              prompt,
              model: 'gpt-image-1',
            },
            is_selected: false,
          })
          .select()
          .single();

        if (saveErr) {
          throw new Error(`Failed to save print asset: ${saveErr.message}`);
        }

        jobLog.info({ assetId: savedAsset.id }, 'Print asset saved');

        // ── Step 6: Update generation_jobs (95-100%) ────────────────────

        io.to(userRoom).emit('job:progress', {
          jobId: job.id, brandId, status: 'finalizing',
          progress: 95, message: 'Finalizing print export...', timestamp: Date.now(),
        });
        await job.updateProgress(95);

        await supabaseAdmin.from('generation_jobs').update({
          status: 'complete',
          result: {
            printAsset: savedAsset,
            template: {
              id: templateId,
              slug: template.slug,
              name: template.name,
              category: template.category,
            },
            product: {
              id: productId,
              name: product.name,
              category: product.category,
            },
            format,
            imageSize,
            printSpecs,
            uploadJobId: uploadResult.jobId,
          },
          progress: 100,
          completed_at: new Date().toISOString(),
        }).eq('bullmq_job_id', job.id);

        await job.updateProgress(100);

        io.to(userRoom).emit('job:complete', {
          jobId: job.id,
          brandId,
          status: 'complete',
          progress: 100,
          message: `Print-ready ${product.name} artwork generated!`,
          result: { printAsset: savedAsset },
          timestamp: Date.now(),
        });

        jobLog.info({
          assetId: savedAsset.id,
          templateSlug: template.slug,
          format,
        }, 'Print export complete');

        return { printAsset: savedAsset };
      } catch (error) {
        jobLog.error({ err: error }, 'Print export failed');

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
    logger.error({ jobId: job?.id, err }, 'Print export worker: job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Print export worker: error');
  });

  return worker;
}
