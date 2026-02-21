// server/src/workers/mockup-generation.js

import { Worker } from 'bullmq';
import { redis } from '../lib/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { dispatchJob } from '../queues/dispatch.js';
import { createJobLogger } from './job-logger.js';
import { logger } from '../lib/logger.js';
import { getOpenAIClient, ideogramClient } from '../services/providers.js';

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
 * Generate a product mockup image via OpenAI GPT Image 1.5.
 * Falls back to Ideogram for text-heavy mockups that need legible typography.
 *
 * @param {string} prompt - Generation prompt
 * @param {Object} [options]
 * @param {boolean} [options.useIdeogram=false] - Use Ideogram for text-heavy images
 * @returns {Promise<string>} Image URL
 */
async function generateMockupImage(prompt, { useIdeogram = false } = {}) {
  if (useIdeogram) {
    logger.debug({ prompt: prompt.slice(0, 100) }, 'Generating mockup via Ideogram (text-heavy)');
    const { imageUrl } = await ideogramClient.generate({
      prompt,
      aspectRatio: '1:1',
      model: 'V_3',
    });
    return imageUrl;
  }

  logger.debug({ prompt: prompt.slice(0, 100) }, 'Generating mockup via OpenAI GPT Image');
  const openai = getOpenAIClient();
  const result = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    n: 1,
    size: '1024x1024',
    quality: 'high',
  });
  return result.data[0].url;
}

/**
 * Niche-specific lifestyle contexts for product mockup prompts.
 * A random context is selected to add visual variety across mockups.
 * @type {Record<string, string[]>}
 */
const LIFESTYLE_CONTEXTS = {
  fitness: ['gym bag on a bench', 'kitchen counter with a shaker bottle', 'locker room shelf', 'post-workout scene'],
  beauty: ['vanity mirror setting', 'bathroom shelf arrangement', 'makeup bag flatlay', 'spa-like environment'],
  wellness: ['meditation space', 'bedside nightstand', 'yoga mat setup', 'peaceful morning routine'],
  food: ['kitchen counter scene', 'dining table setting', 'pantry shelf organized', 'meal prep station'],
  apparel: ['model wearing the product', 'flatlay on marble surface', 'wooden hanger on rack', 'lifestyle outdoor setting'],
  supplements: ['gym counter setup', 'kitchen counter morning scene', 'wellness shelf display', 'active lifestyle backdrop'],
  skincare: ['bathroom vanity', 'spa-like shelf', 'travel pouch flatlay', 'morning routine setup'],
};

/**
 * Pick a random lifestyle context for the given product category/niche.
 * Returns a descriptive scene string or a generic default.
 *
 * @param {string} categoryOrNiche - Product category or niche identifier
 * @returns {string}
 */
function pickLifestyleContext(categoryOrNiche) {
  const key = (categoryOrNiche || '').toLowerCase().trim();
  const contexts = LIFESTYLE_CONTEXTS[key];
  if (!contexts || contexts.length === 0) {
    return 'clean product showcase';
  }
  return contexts[Math.floor(Math.random() * contexts.length)];
}

/**
 * Compose a mockup generation prompt.
 * When a packaging template with branding zones is available, builds a structured
 * prompt from the template's ai_prompt_template and zone definitions. Otherwise
 * falls back to the generic free-text prompt.
 *
 * Appends a niche-specific lifestyle context to the prompt for visual variety.
 *
 * @param {Object} params
 * @param {string} params.productName
 * @param {string} params.productCategory
 * @param {string[]} params.colorPalette
 * @param {string} [params.mockupInstructions]
 * @param {Object} [params.template] - Packaging template row (nullable)
 * @param {string} [params.brandName]
 * @param {string} [params.niche] - Product niche for lifestyle context
 * @returns {string}
 */
function composeMockupPrompt({ productName, productCategory, colorPalette, mockupInstructions, template, brandName, niche }) {
  // If template with zones exists, use structured prompt
  if (template && template.branding_zones?.length > 0) {
    let prompt = template.ai_prompt_template || '';

    // Replace template placeholders
    prompt = prompt
      .replace(/\{\{productName\}\}/g, productName)
      .replace(/\{\{brandName\}\}/g, brandName || 'Brand')
      .replace(/\{\{primaryColor\}\}/g, colorPalette[0] || '#000000')
      .replace(/\{\{secondaryColor\}\}/g, colorPalette[1] || colorPalette[0] || '#333333')
      .replace(/\{\{accentColor\}\}/g, colorPalette[2] || colorPalette[0] || '#666666');

    // If no ai_prompt_template, build from zones
    if (!prompt) {
      prompt = `Professional product photo of "${productName}" (${productCategory}). Brand colors: ${colorPalette.join(', ')}. `;
      prompt += 'Clean studio photography, white background, photorealistic. ';

      for (const zone of template.branding_zones) {
        if (zone.type === 'logo') {
          prompt += `The brand logo is placed at the ${zone.label.toLowerCase()} area. `;
        } else if (zone.type === 'text') {
          prompt += `"${brandName || productName}" text appears in the ${zone.label.toLowerCase()} area. `;
        } else if (zone.type === 'color_fill') {
          prompt += `${zone.label}: filled with brand color. `;
        }
      }
    }

    // Append lifestyle context based on niche/category
    const context = pickLifestyleContext(niche || productCategory);
    prompt += ` Place the product in a ${context}.`;

    return prompt;
  }

  // Fallback to existing free-text behavior
  let prompt = `Professional product mockup of a ${productCategory} product called "${productName}". `;
  prompt += `Brand colors: ${colorPalette.join(', ')}. `;
  prompt += 'Clean studio photography style, white or neutral background, photorealistic, high detail. ';
  prompt += 'The logo should be clearly visible on the product. Professional e-commerce product shot.';

  if (mockupInstructions) {
    prompt += ` Additional instructions: ${mockupInstructions}`;
  }

  // Append lifestyle context based on niche/category
  const context = pickLifestyleContext(niche || productCategory);
  prompt += ` Place the product in a ${context}.`;

  return prompt;
}

/**
 * Mockup Generation worker -- generates product mockups via GPT Image 1.5.
 *
 * @param {import('socket.io').Server} io
 * @returns {Worker}
 */
export function initMockupGenerationWorker(io) {
  const queueConfig = QUEUE_CONFIGS['mockup-generation'];

  const worker = new Worker(
    'mockup-generation',
    async (job) => {
      const {
        userId, brandId, productId, productName, productCategory,
        brandName, logoUrl, colorPalette, mockupTemplateUrl, mockupInstructions,
      } = job.data;

      const jobLog = createJobLogger(job, 'mockup-generation');
      const room = `brand:${brandId}`;
      const jobRoom = `job:${job.id}`;

      jobLog.info({ productName }, 'Mockup generation started');

      try {
        // Load product's packaging template if available
        let template = null;
        if (productId) {
          const { data: product } = await supabaseAdmin
            .from('products')
            .select('template_id')
            .eq('id', productId)
            .single();

          if (product?.template_id) {
            const { data: tmpl } = await supabaseAdmin
              .from('packaging_templates')
              .select('*')
              .eq('id', product.template_id)
              .single();
            template = tmpl;
          }
        }

        // Step 1: Compose prompt (10%)
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'composing',
          progress: 10, message: `Designing ${productName} mockup...`, timestamp: Date.now(),
        });
        await job.updateProgress(10);

        const prompt = composeMockupPrompt({
          productName, productCategory, logoUrl, colorPalette,
          mockupTemplateUrl, mockupInstructions, template, brandName,
        });

        // Step 2: Generate via GPT Image 1.5 (or Ideogram for text-heavy products) (10-70%)
        const textHeavyCategories = ['book', 'card', 'packaging', 'label', 'poster', 'flyer'];
        const useIdeogram = textHeavyCategories.some((cat) =>
          productCategory.toLowerCase().includes(cat)
        );

        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'generating',
          progress: 30,
          message: `Generating ${productName} mockup via ${useIdeogram ? 'Ideogram' : 'GPT Image'}...`,
          timestamp: Date.now(),
        });
        await job.updateProgress(30);

        const imageUrl = await generateMockupImage(prompt, { useIdeogram });

        // Step 3: Queue upload (70-90%)
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'uploading',
          progress: 70, message: `Uploading ${productName} mockup...`, timestamp: Date.now(),
        });
        await job.updateProgress(70);

        const uploadResult = await dispatchJob('image-upload', {
          userId, brandId,
          assetType: 'mockup',
          sourceUrl: imageUrl,
          fileName: `mockup-${brandId}-${productId}-${Date.now()}.png`,
          mimeType: 'image/png',
          metadata: { productId, productName, productCategory, prompt },
        });

        // Step 4: Save to brand_assets (90%)
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id, brandId, status: 'saving',
          progress: 90, message: 'Saving mockup...', timestamp: Date.now(),
        });
        await job.updateProgress(90);

        const { data: savedAsset, error: saveError } = await supabaseAdmin
          .from('brand_assets')
          .insert({
            brand_id: brandId,
            asset_type: 'mockup',
            url: imageUrl,
            metadata: {
              product_id: productId,
              product_name: productName,
              product_category: productCategory,
              prompt,
              upload_job_id: uploadResult.jobId,
            },
            is_selected: false,
          })
          .select()
          .single();

        if (saveError) {
          throw new Error(`Failed to save mockup asset: ${saveError.message}`);
        }

        // Step 5: Update generation_jobs (100%)
        await supabaseAdmin.from('generation_jobs').update({
          status: 'complete',
          result: { mockup: savedAsset },
          progress: 100,
          completed_at: new Date().toISOString(),
        }).eq('bullmq_job_id', job.id);

        await job.updateProgress(100);

        io.of('/wizard').to(jobRoom).to(room).emit('job:complete', {
          jobId: job.id,
          brandId,
          status: 'complete',
          progress: 100,
          message: `${productName} mockup generated!`,
          result: { mockup: savedAsset },
          timestamp: Date.now(),
        });

        jobLog.info('Mockup generation complete');
        return { mockup: savedAsset };
      } catch (error) {
        jobLog.error({ err: error }, 'Mockup generation failed');

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
    logger.error({ jobId: job?.id, err }, 'Mockup generation worker: job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Mockup generation worker: error');
  });

  return worker;
}
