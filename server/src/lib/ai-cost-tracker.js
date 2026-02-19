// server/src/lib/ai-cost-tracker.js

import { supabaseAdmin } from './supabase.js';
import { logger } from './logger.js';
import { captureEvent } from './posthog.js';
import { Sentry } from './sentry.js';
import { redis } from './redis.js';

/**
 * Model pricing table (per 1M tokens for text, per image for image models).
 * Updated: February 2026.
 *
 * @type {Record<string, { inputPer1M?: number, outputPer1M?: number, perImage?: number, perVideo?: number }>}
 */
const MODEL_PRICING = {
  // Text models (per 1M tokens)
  'claude-sonnet-4-6':   { inputPer1M: 3.00,   outputPer1M: 15.00  },
  'claude-haiku-4-5':    { inputPer1M: 0.80,   outputPer1M: 4.00   },
  'claude-opus-4-6':     { inputPer1M: 15.00,  outputPer1M: 75.00  },
  'gemini-3.0-flash':    { inputPer1M: 0.15,   outputPer1M: 0.60   },
  'gemini-3.0-pro':      { inputPer1M: 1.25,   outputPer1M: 10.00  },

  // Image models (per image)
  'flux-2-pro':          { perImage: 0.06  },
  'flux-2-dev':          { perImage: 0.03  },
  'gpt-image-1.5':       { perImage: 0.06  },
  'ideogram-v3':         { perImage: 0.06  },
  'gemini-3-pro-image':  { perImage: 0.05  },

  // Video models (per video)
  'veo-3':               { perVideo: 0.30  },
};

/** Single job cost threshold -- warn if exceeded */
const SINGLE_JOB_COST_THRESHOLD = 1.00;

/** Daily per-user spend threshold -- warn if exceeded */
const DAILY_USER_SPEND_THRESHOLD = 10.00;

/** Redis key prefix for daily user spend tracking */
const DAILY_SPEND_PREFIX = 'bmn:ai:daily_spend';

/**
 * Calculate the estimated cost of an AI API call.
 *
 * @param {string} model - The model identifier
 * @param {{ inputTokens?: number, outputTokens?: number, imageCount?: number, videoCount?: number }} usage
 * @returns {number} Estimated cost in USD
 */
export function calculateCost(model, usage) {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    logger.warn({ model }, 'Unknown model for cost calculation');
    return 0;
  }

  let cost = 0;

  if (pricing.inputPer1M && usage.inputTokens) {
    cost += (usage.inputTokens / 1_000_000) * pricing.inputPer1M;
  }
  if (pricing.outputPer1M && usage.outputTokens) {
    cost += (usage.outputTokens / 1_000_000) * pricing.outputPer1M;
  }
  if (pricing.perImage && usage.imageCount) {
    cost += usage.imageCount * pricing.perImage;
  }
  if (pricing.perVideo && usage.videoCount) {
    cost += usage.videoCount * pricing.perVideo;
  }

  return Math.round(cost * 1_000_000) / 1_000_000; // 6 decimal places
}

/**
 * Log an AI API call to the ai_cost_logs table and emit PostHog event.
 * Includes anomaly detection for single-job and daily-user thresholds.
 *
 * @param {{
 *   userId: string,
 *   brandId?: string,
 *   model: string,
 *   taskType: string,
 *   inputTokens?: number,
 *   outputTokens?: number,
 *   imageCount?: number,
 *   videoCount?: number,
 *   duration_ms: number,
 *   success: boolean,
 *   error?: string,
 *   jobId?: string,
 * }} params
 */
export async function trackAICost(params) {
  const {
    userId,
    brandId,
    model,
    taskType,
    inputTokens = 0,
    outputTokens = 0,
    imageCount = 0,
    videoCount = 0,
    duration_ms,
    success,
    error,
    jobId,
  } = params;

  const cost = calculateCost(model, { inputTokens, outputTokens, imageCount, videoCount });

  // 1. Log to structured logger
  logger.info({
    event: 'ai_api_call',
    userId,
    brandId,
    model,
    taskType,
    inputTokens,
    outputTokens,
    imageCount,
    videoCount,
    cost,
    duration_ms,
    success,
    jobId,
  }, `AI call: ${model} (${taskType}) - $${cost.toFixed(6)}`);

  // 2. Insert into ai_cost_logs table
  try {
    await supabaseAdmin.from('ai_cost_logs').insert({
      user_id: userId,
      brand_id: brandId || null,
      model,
      task_type: taskType,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      image_count: imageCount,
      video_count: videoCount,
      cost,
      duration_ms,
      success,
      error_message: error || null,
      job_id: jobId || null,
    });
  } catch (dbErr) {
    logger.error({ err: dbErr }, 'Failed to insert AI cost log');
  }

  // 3. Send to PostHog for analytics
  captureEvent(userId, 'ai_api_call', {
    model,
    taskType,
    inputTokens,
    outputTokens,
    imageCount,
    videoCount,
    cost,
    duration_ms,
    success,
  });

  // 4. Anomaly detection
  if (cost > 0) {
    await checkAnomalies(userId, cost);
  }
}

/**
 * Check for cost anomalies: single job exceeding threshold,
 * and daily user spend exceeding threshold.
 *
 * @param {string} userId
 * @param {number} cost
 */
async function checkAnomalies(userId, cost) {
  // Check 1: Single job cost threshold
  if (cost > SINGLE_JOB_COST_THRESHOLD) {
    const message = `AI cost anomaly: single job cost $${cost.toFixed(4)} exceeds threshold $${SINGLE_JOB_COST_THRESHOLD.toFixed(2)}`;
    logger.warn({ userId, cost, threshold: SINGLE_JOB_COST_THRESHOLD }, message);

    Sentry.captureMessage(message, {
      level: 'warning',
      tags: { alert: 'cost-anomaly', anomalyType: 'single-job' },
      contexts: {
        cost: { job_cost: cost, threshold: SINGLE_JOB_COST_THRESHOLD, userId },
      },
    });
  }

  // Check 2: Daily user spend threshold via Redis
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = `${DAILY_SPEND_PREFIX}:${userId}:${today}`;

    // Increment daily spend and get new total
    const dailySpend = await redis.incrbyfloat(key, cost);

    // Set TTL to 48 hours on first write (in case of timezone edge cases)
    const ttl = await redis.ttl(key);
    if (ttl === -1) {
      await redis.expire(key, 172800); // 48 hours
    }

    if (dailySpend > DAILY_USER_SPEND_THRESHOLD) {
      const message = `AI cost anomaly: user ${userId} daily spend $${dailySpend.toFixed(2)} exceeds threshold $${DAILY_USER_SPEND_THRESHOLD.toFixed(2)}`;
      logger.warn({ userId, dailySpend, threshold: DAILY_USER_SPEND_THRESHOLD }, message);

      Sentry.captureMessage(message, {
        level: 'warning',
        tags: { alert: 'cost-anomaly', anomalyType: 'daily-user' },
        contexts: {
          cost: { daily_spend: dailySpend, threshold: DAILY_USER_SPEND_THRESHOLD, userId },
        },
      });
    }
  } catch (err) {
    logger.error({ err }, 'Failed to check daily spend anomaly');
  }
}
