// server/src/workers/storefront-generation.js

import { Worker } from 'bullmq';
import { getBullRedisConfig } from '../lib/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { createJobLogger } from './job-logger.js';
import { logger } from '../lib/logger.js';
import { generateStorefrontContent } from '../skills/storefront-generator/handlers.js';

/**
 * Storefront Generation worker -- AI-powered storefront content creation.
 *
 * Flow:
 *   1. Pick up job from `storefront-generation` queue
 *   2. Call Claude Haiku 4.5 to generate all section content
 *   3. Clear existing sections, testimonials, and FAQs
 *   4. Insert all generated content into the database
 *   5. Update storefront status to published
 *   6. Emit Socket.io events for real-time progress
 *
 * @param {import('socket.io').Server} io
 * @returns {Worker}
 */
export function initStorefrontGenerationWorker(io) {
  const queueConfig = QUEUE_CONFIGS['storefront-generation'];

  const worker = new Worker(
    'storefront-generation',
    async (job) => {
      const { userId, brandId, storefrontId, themeId, brandIdentity, template } = job.data;
      const jobLog = createJobLogger(job, 'storefront-generation');
      const userRoom = `user:${userId}`;

      jobLog.info({ storefrontId, brandId, template }, 'Storefront generation started');

      try {
        // ── Step 1: Generate content via AI (0-50%) ─────────────────

        io.to(userRoom).emit('job:progress', {
          jobId: job.id,
          brandId,
          status: 'generating',
          progress: 20,
          message: 'Generating storefront content...',
          timestamp: Date.now(),
        });
        await job.updateProgress(20);

        const aiContent = await generateStorefrontContent({
          brandIdentity,
          theme: template,
        });

        jobLog.info('AI content generation complete');

        // ── Step 2: Write sections to DB (50-80%) ───────────────────

        io.to(userRoom).emit('job:progress', {
          jobId: job.id,
          brandId,
          status: 'writing',
          progress: 60,
          message: 'Writing sections...',
          timestamp: Date.now(),
        });
        await job.updateProgress(60);

        // Clear existing sections for this storefront
        await supabaseAdmin
          .from('storefront_sections')
          .delete()
          .eq('storefront_id', storefrontId);

        // Build section definitions based on template
        const TEMPLATE_SECTIONS = {
          bold: [
            { type: 'hero', sort_order: 0 },
            { type: 'trust-bar', sort_order: 1 },
            { type: 'products', sort_order: 2 },
            { type: 'steps', sort_order: 3 },
            { type: 'quality', sort_order: 4 },
            { type: 'testimonials', sort_order: 5 },
            { type: 'faq', sort_order: 6 },
            { type: 'contact', sort_order: 7 },
          ],
          story: [
            { type: 'hero', sort_order: 0 },
            { type: 'welcome', sort_order: 1 },
            { type: 'about', sort_order: 2 },
            { type: 'bundle-grid', sort_order: 3 },
            { type: 'why-bundles', sort_order: 4 },
            { type: 'testimonials', sort_order: 5 },
            { type: 'quality', sort_order: 6 },
            { type: 'faq', sort_order: 7 },
            { type: 'products', sort_order: 8 },
            { type: 'contact', sort_order: 9 },
          ],
          conversion: [
            { type: 'hero', sort_order: 0 },
            { type: 'trust-bar', sort_order: 1 },
            { type: 'bundle-grid', sort_order: 2 },
            { type: 'steps', sort_order: 3 },
            { type: 'why-bundles', sort_order: 4 },
            { type: 'quality', sort_order: 5 },
            { type: 'testimonials', sort_order: 6 },
            { type: 'products', sort_order: 7 },
            { type: 'faq', sort_order: 8 },
            { type: 'about', sort_order: 9 },
            { type: 'contact', sort_order: 10 },
          ],
        };

        const sectionDefs = TEMPLATE_SECTIONS[template] || TEMPLATE_SECTIONS.conversion;

        // Map AI content into section rows
        const sectionRows = sectionDefs.map((def) => {
          let content = {};

          // Map AI-generated content to the appropriate section type
          if (def.type === 'hero' && aiContent.hero) {
            content = {
              headline: aiContent.hero.headline,
              subheadline: aiContent.hero.subheadline,
              ctaText: aiContent.hero.ctaText,
              ctaUrl: aiContent.hero.ctaUrl || '#products',
              backgroundImageUrl: '',
              overlayOpacity: 0.4,
            };
          } else if (def.type === 'welcome' && aiContent.welcome) {
            content = {
              title: aiContent.welcome.title,
              body: aiContent.welcome.body,
              imageUrl: brandIdentity.logoUrl || '',
            };
          } else if (def.type === 'bundle-grid' && aiContent['bundle-grid']) {
            content = {
              title: aiContent['bundle-grid'].title,
              subtitle: aiContent['bundle-grid'].subtitle,
              maxItems: 5,
              layout: 'grid',
            };
          } else if (def.type === 'steps' && aiContent.steps) {
            content = {
              title: aiContent.steps.title,
              subtitle: aiContent.steps.subtitle,
              steps: aiContent.steps.steps,
            };
          } else if (def.type === 'why-bundles' && aiContent['why-bundles']) {
            content = {
              title: aiContent['why-bundles'].title,
              reasons: aiContent['why-bundles'].reasons,
            };
          } else if (def.type === 'quality' && aiContent.quality) {
            content = {
              title: aiContent.quality.title,
              body: aiContent.quality.body,
              imageUrl: '',
              badges: aiContent.quality.badges,
            };
          } else if (def.type === 'testimonials') {
            content = {
              title: 'Real People. Real Results.',
            };
          } else if (def.type === 'faq') {
            content = {
              title: 'Frequently Asked Questions',
              subtitle: 'Got questions? We\'ve got answers.',
            };
          } else if (def.type === 'about' && aiContent.about) {
            content = {
              title: aiContent.about.title,
              subtitle: aiContent.about.subtitle,
              body: aiContent.about.body,
              imageUrl: brandIdentity.logoUrl || '',
              ctaText: aiContent.about.ctaText,
              ctaUrl: aiContent.about.ctaUrl || '#products',
            };
          } else if (def.type === 'contact' && aiContent.contact) {
            content = {
              title: aiContent.contact.title,
              subtitle: aiContent.contact.subtitle,
              showPhone: false,
              showEmail: true,
            };
          } else if (def.type === 'trust-bar' && aiContent['trust-bar']) {
            content = {
              items: aiContent['trust-bar'].items,
            };
          } else if (def.type === 'products' && aiContent.products) {
            content = {
              title: aiContent.products.title,
              subtitle: aiContent.products.subtitle,
              categoryFilter: '',
              layout: 'grid',
              maxItems: 50,
            };
          }

          return {
            storefront_id: storefrontId,
            section_type: def.type,
            title: null,
            content,
            sort_order: def.sort_order,
            is_visible: true,
            settings: {},
          };
        });

        // Insert all sections
        const { error: sectErr } = await supabaseAdmin
          .from('storefront_sections')
          .insert(sectionRows);

        if (sectErr) {
          jobLog.error({ err: sectErr }, 'Failed to insert sections');
          throw new Error(`Failed to insert sections: ${sectErr.message}`);
        }

        // ── Step 3: Write testimonials (70%) ────────────────────────

        // Clear existing testimonials
        await supabaseAdmin
          .from('storefront_testimonials')
          .delete()
          .eq('storefront_id', storefrontId);

        // Insert AI-generated testimonials
        if (aiContent.testimonials && Array.isArray(aiContent.testimonials)) {
          const testimonialRows = aiContent.testimonials.map((t, i) => ({
            storefront_id: storefrontId,
            quote: t.body,
            author_name: t.author_name,
            author_title: t.author_title,
            rating: t.rating || 5,
            sort_order: i,
            is_visible: true,
          }));

          const { error: testErr } = await supabaseAdmin
            .from('storefront_testimonials')
            .insert(testimonialRows);

          if (testErr) {
            jobLog.warn({ err: testErr }, 'Failed to insert testimonials');
          }
        }

        // ── Step 4: Write FAQs (75%) ────────────────────────────────

        // Clear existing FAQs
        await supabaseAdmin
          .from('storefront_faqs')
          .delete()
          .eq('storefront_id', storefrontId);

        // Insert AI-generated FAQs
        if (aiContent.faq && Array.isArray(aiContent.faq)) {
          const faqRows = aiContent.faq.map((f, i) => ({
            storefront_id: storefrontId,
            question: f.question,
            answer: f.answer,
            sort_order: i,
            is_visible: true,
          }));

          const { error: faqErr } = await supabaseAdmin
            .from('storefront_faqs')
            .insert(faqRows);

          if (faqErr) {
            jobLog.warn({ err: faqErr }, 'Failed to insert FAQs');
          }
        }

        await job.updateProgress(80);

        // ── Step 5: Publish storefront (80-100%) ────────────────────

        io.to(userRoom).emit('job:progress', {
          jobId: job.id,
          brandId,
          status: 'publishing',
          progress: 90,
          message: 'Publishing storefront...',
          timestamp: Date.now(),
        });
        await job.updateProgress(90);

        // Update storefront status to published
        const { data: updatedStorefront, error: updateErr } = await supabaseAdmin
          .from('storefronts')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            settings: {
              generatedTemplate: template,
              generatedAt: new Date().toISOString(),
              aiGenerated: true,
            },
          })
          .eq('id', storefrontId)
          .select('slug')
          .single();

        if (updateErr) {
          jobLog.error({ err: updateErr }, 'Failed to update storefront status');
          throw new Error(`Failed to publish storefront: ${updateErr.message}`);
        }

        // Update SEO meta from brand data
        await supabaseAdmin
          .from('storefronts')
          .update({
            meta_title: brandIdentity.name,
            meta_description: brandIdentity.tagline || `Shop ${brandIdentity.name} products`,
          })
          .eq('id', storefrontId);

        await job.updateProgress(100);

        // ── Emit completion ─────────────────────────────────────────

        io.to(userRoom).emit('job:complete', {
          jobId: job.id,
          brandId,
          status: 'complete',
          progress: 100,
          message: 'Storefront generated and published!',
          result: {
            storefrontId,
            slug: updatedStorefront?.slug || null,
          },
          timestamp: Date.now(),
        });

        jobLog.info(
          {
            storefrontId,
            slug: updatedStorefront?.slug,
            sectionCount: sectionRows.length,
            testimonialCount: aiContent.testimonials?.length || 0,
            faqCount: aiContent.faq?.length || 0,
          },
          'Storefront generation complete',
        );

        return {
          storefrontId,
          slug: updatedStorefront?.slug,
          sectionCount: sectionRows.length,
        };
      } catch (error) {
        jobLog.error({ err: error }, 'Storefront generation failed');

        io.to(userRoom).emit('job:failed', {
          jobId: job.id,
          brandId,
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
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Storefront generation worker: job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Storefront generation worker: error');
  });

  return worker;
}
