// server/src/workers/content-gen-worker.js

/**
 * Content Generation Worker -- generates social media content using AI.
 *
 * Features:
 * - Generates captions, hashtags, and image prompts for various platforms
 * - Uses brand voice and identity from the user's profile
 * - Emits progress via Socket.io
 * - Retry 2 times with exponential backoff
 */

import { Worker } from 'bullmq';
import * as Sentry from '@sentry/node';
import { redis } from '../lib/redis.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { createJobLogger } from './job-logger.js';
import { logger } from '../lib/logger.js';
import { buildSafePrompt } from '../skills/_shared/prompt-utils.js';

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

// ------ Prompt Templates ------

const PLATFORM_PROMPTS = {
  instagram: {
    post: 'Create an engaging Instagram post caption. Include relevant emoji usage. The caption should be optimized for engagement with a clear call-to-action.',
    story: 'Create compelling Instagram Story text. Keep it short, punchy, and use a conversational tone. Include a poll or question sticker suggestion.',
    reel_script: 'Write a short TikTok/Reels script (15-30 seconds). Include: hook (first 3 seconds), body, and call-to-action. Format as [SCENE] descriptions.',
  },
  tiktok: {
    post: 'Create a TikTok video caption. Keep it under 150 characters. Use trending language and relevant hashtag suggestions.',
    reel_script: 'Write a TikTok script (15-60 seconds). Include: attention-grabbing hook, educational or entertaining body, and a strong CTA. Format as timestamped scenes.',
  },
  twitter: {
    post: 'Create a Twitter/X post. Keep it under 280 characters. Make it shareable and engaging with a conversational tone.',
  },
  general: {
    announcement: 'Create a product announcement post suitable for multiple platforms. Include a headline, body copy, and hashtags.',
    promotional: 'Create promotional content for a sale or special offer. Include urgency elements and a clear value proposition.',
  },
};

/**
 * Build the system prompt for content generation.
 * @param {Object} brandIdentity
 * @param {string} platform
 * @param {string} contentType
 * @param {string} tone
 * @returns {string}
 */
function buildContentPrompt(brandIdentity, platform, contentType, tone) {
  const platformPrompt =
    PLATFORM_PROMPTS[platform]?.[contentType] ||
    PLATFORM_PROMPTS.general?.announcement ||
    'Create engaging social media content.';

  return `You are a social media content expert for the brand "${brandIdentity.name || 'this brand'}".

Brand Voice:
- Vision: ${brandIdentity.vision || 'Not specified'}
- Values: ${(brandIdentity.values || []).join(', ') || 'Not specified'}
- Archetype: ${brandIdentity.archetype || 'Not specified'}
- Tone: ${tone}

${platformPrompt}

Return your response as valid JSON with this exact structure:
{
  "caption": "The main caption text",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
  "imagePrompt": "A description for an AI image generator to create a matching visual (optional)"
}

Only return the JSON object, no other text.`;
}

// ------ Worker ------

/**
 * Content Generation worker -- generates social media content.
 *
 * @param {import('socket.io').Server} io
 * @returns {Worker}
 */
export function initContentGenWorker(io) {
  const worker = new Worker(
    'content-gen',
    async (job) => {
      const { brandId, userId, platform, contentType, topic, tone } = job.data;
      const jobLog = createJobLogger(job, 'content-gen');

      jobLog.info({ brandId, platform, contentType }, 'Content generation started');

      // Emit progress
      if (io) {
        io.to(`user:${userId}`).emit('content:generation:progress', {
          jobId: job.id,
          status: 'generating',
          progress: 10,
        });
      }

      // Fetch brand identity
      const { data: brand } = await supabaseAdmin
        .from('brands')
        .select('name, brand_identities(vision, values, archetype, target_audience)')
        .eq('id', brandId)
        .eq('user_id', userId)
        .single();

      if (!brand) {
        throw new Error(`Brand ${brandId} not found for user ${userId}`);
      }

      const identity = {
        name: brand.name,
        ...(brand.brand_identities || {}),
      };

      // Build prompt
      const systemPrompt = buildContentPrompt(identity, platform, contentType, tone);
      const userInput = topic
        ? `Topic/Context: ${topic}`
        : `Generate content for the ${platform} ${contentType} format.`;

      const safePrompt = buildSafePrompt(systemPrompt, userInput);

      // Emit progress
      if (io) {
        io.to(`user:${userId}`).emit('content:generation:progress', {
          jobId: job.id,
          status: 'generating',
          progress: 40,
        });
      }

      // Call AI model (Claude Haiku for fast/cheap content generation)
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const anthropic = new Anthropic();

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: safePrompt }],
      });

      // Emit progress
      if (io) {
        io.to(`user:${userId}`).emit('content:generation:progress', {
          jobId: job.id,
          status: 'processing',
          progress: 80,
        });
      }

      // Parse response
      const responseText = response.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('');

      let parsedContent;
      try {
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        parsedContent = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);
      } catch {
        jobLog.warn({ responseText }, 'Failed to parse AI response as JSON');
        parsedContent = {
          caption: responseText,
          hashtags: [],
          imagePrompt: null,
        };
      }

      // Store generated content
      const contentRecord = {
        id: crypto.randomUUID(),
        brand_id: brandId,
        user_id: userId,
        platform,
        content_type: contentType,
        caption: parsedContent.caption,
        hashtags: parsedContent.hashtags || [],
        image_prompt: parsedContent.imagePrompt || null,
        tone,
        topic,
        scheduled_for: null,
        created_at: new Date().toISOString(),
      };

      await supabaseAdmin.from('generated_content').insert(contentRecord);

      // Emit completion
      if (io) {
        io.to(`user:${userId}`).emit('content:generation:complete', {
          jobId: job.id,
          content: {
            id: contentRecord.id,
            platform,
            contentType,
            caption: parsedContent.caption,
            hashtags: parsedContent.hashtags || [],
            imagePrompt: parsedContent.imagePrompt || null,
            scheduledFor: null,
            createdAt: contentRecord.created_at,
          },
        });
      }

      jobLog.info({ brandId, contentId: contentRecord.id }, 'Content generated successfully');

      return {
        contentId: contentRecord.id,
        caption: parsedContent.caption,
        hashtags: parsedContent.hashtags,
      };
    },
    {
      connection: getBullRedisConfig(),
      concurrency: 5,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, err, attempts: job?.attemptsMade },
      'Content gen worker: job failed'
    );
    if (job?.attemptsMade >= 2) {
      Sentry.captureException(err, {
        tags: { queue: 'content-gen' },
        extra: { jobData: job?.data },
      });
    }

    // Emit error to user
    const userId = job?.data?.userId;
    if (userId) {
      const io = worker._io;
      if (io) {
        io.to(`user:${userId}`).emit('content:generation:error', {
          jobId: job?.id,
          error: 'Content generation failed. Please try again.',
        });
      }
    }
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Content gen worker: error');
  });

  return worker;
}
