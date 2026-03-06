// server/src/workers/storefront-analytics.js

/**
 * Storefront Analytics Worker -- aggregates daily storefront metrics.
 *
 * Job types:
 * - daily-aggregation (repeatable): Ensures analytics rows exist for today for all active storefronts
 * - metric-increment (dispatched from public-store controller): Increments a specific metric
 *   column (page_views, unique_visitors, product_views, add_to_carts, checkouts, revenue_cents)
 *
 * Retry: 3 attempts with exponential backoff [5s, 10s, 20s].
 */

import { Worker } from 'bullmq';
import * as Sentry from '@sentry/node';
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

// ── Allowed Metric Columns ───────────────────────────────────────

/** @type {Set<string>} */
const ALLOWED_METRICS = new Set([
  'page_views',
  'unique_visitors',
  'product_views',
  'add_to_carts',
  'checkouts',
  'revenue_cents',
]);

// ── Worker ───────────────────────────────────────────────────────

/**
 * Storefront Analytics worker -- aggregates daily storefront metrics.
 *
 * @param {import('socket.io').Server} _io - Socket.io server instance (unused -- no real-time emissions needed)
 * @returns {Worker}
 */
export function initStorefrontAnalyticsWorker(_io) {
  const queueConfig = QUEUE_CONFIGS['storefront-analytics'];

  const worker = new Worker(
    'storefront-analytics',
    async (job) => {
      const jobLog = createJobLogger(job, 'storefront-analytics');
      const { type } = job.data;

      // ── Daily Aggregation (repeatable) ──────────────────────────
      if (type === 'daily-aggregation') {
        jobLog.info('Starting daily storefront analytics aggregation');

        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

        // Fetch all active (published) storefronts
        const { data: storefronts, error: fetchError } = await supabaseAdmin
          .from('storefronts')
          .select('id')
          .eq('status', 'published');

        if (fetchError) {
          jobLog.error({ err: fetchError }, 'Failed to fetch active storefronts');
          throw new Error(`Failed to fetch active storefronts: ${fetchError.message}`);
        }

        const activeStorefronts = storefronts || [];

        if (activeStorefronts.length === 0) {
          jobLog.info('No active storefronts found -- skipping aggregation');
          return { processed: true, type, storefrontsProcessed: 0 };
        }

        // Ensure a row exists for today for each storefront (INSERT ON CONFLICT DO NOTHING)
        const rows = activeStorefronts.map((sf) => ({
          storefront_id: sf.id,
          date: today,
          page_views: 0,
          unique_visitors: 0,
          product_views: 0,
          add_to_carts: 0,
          checkouts: 0,
          revenue_cents: 0,
        }));

        const { error: upsertError } = await supabaseAdmin
          .from('storefront_analytics')
          .upsert(rows, { onConflict: 'storefront_id,date', ignoreDuplicates: true });

        if (upsertError) {
          jobLog.error({ err: upsertError }, 'Failed to upsert daily analytics rows');
          throw new Error(`Failed to upsert daily analytics rows: ${upsertError.message}`);
        }

        jobLog.info(
          { storefrontsProcessed: activeStorefronts.length, date: today },
          'Daily storefront analytics aggregation complete'
        );

        return { processed: true, type, storefrontsProcessed: activeStorefronts.length, date: today };
      }

      // ── Individual Metric Increment ─────────────────────────────
      if (type === 'metric-increment') {
        const { storefrontId, date, metric, increment } = job.data;

        if (!storefrontId || !date || !metric || increment == null) {
          jobLog.warn({ storefrontId, date, metric, increment }, 'Missing required fields for metric-increment');
          return { processed: false, reason: 'Missing required fields' };
        }

        if (!ALLOWED_METRICS.has(metric)) {
          jobLog.warn({ metric }, 'Invalid metric column -- rejecting to prevent SQL injection');
          return { processed: false, reason: `Invalid metric: ${metric}` };
        }

        const incrementValue = Number(increment);
        if (!Number.isFinite(incrementValue) || incrementValue <= 0) {
          jobLog.warn({ increment }, 'Invalid increment value');
          return { processed: false, reason: 'Invalid increment value' };
        }

        jobLog.info({ storefrontId, date, metric, increment: incrementValue }, 'Incrementing storefront metric');

        // Upsert the row first (ensure it exists), then increment via raw SQL
        const { error: upsertError } = await supabaseAdmin
          .from('storefront_analytics')
          .upsert(
            {
              storefront_id: storefrontId,
              date,
              page_views: 0,
              unique_visitors: 0,
              product_views: 0,
              add_to_carts: 0,
              checkouts: 0,
              revenue_cents: 0,
            },
            { onConflict: 'storefront_id,date', ignoreDuplicates: true }
          );

        if (upsertError) {
          jobLog.error({ err: upsertError }, 'Failed to ensure analytics row exists');
          throw new Error(`Failed to ensure analytics row: ${upsertError.message}`);
        }

        // Increment the specific metric using raw SQL via Supabase rpc
        const { error: rpcError } = await supabaseAdmin.rpc('increment_storefront_metric', {
          p_storefront_id: storefrontId,
          p_date: date,
          p_metric: metric,
          p_increment: incrementValue,
        });

        // Fallback: if RPC doesn't exist, use a direct update approach
        if (rpcError) {
          jobLog.warn({ err: rpcError }, 'RPC increment_storefront_metric not available, using direct update');

          // Direct update -- safe because metric is validated against ALLOWED_METRICS
          const { data: currentRow, error: selectError } = await supabaseAdmin
            .from('storefront_analytics')
            .select(metric)
            .eq('storefront_id', storefrontId)
            .eq('date', date)
            .single();

          if (selectError) {
            throw new Error(`Failed to read current metric value: ${selectError.message}`);
          }

          const currentValue = currentRow?.[metric] || 0;
          const { error: updateError } = await supabaseAdmin
            .from('storefront_analytics')
            .update({ [metric]: currentValue + incrementValue })
            .eq('storefront_id', storefrontId)
            .eq('date', date);

          if (updateError) {
            throw new Error(`Failed to update metric: ${updateError.message}`);
          }
        }

        jobLog.info({ storefrontId, date, metric, increment: incrementValue }, 'Storefront metric incremented');

        return { processed: true, type, storefrontId, metric, increment: incrementValue };
      }

      jobLog.warn({ type }, 'Unknown storefront-analytics job type');
      return { processed: false, reason: `Unknown type: ${type}` };
    },
    {
      connection: getBullRedisConfig(),
      concurrency: queueConfig.concurrency,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, err, attempts: job?.attemptsMade },
      'Storefront analytics worker: job failed'
    );
    if (job?.attemptsMade >= queueConfig.retry.attempts) {
      Sentry.captureException(err, {
        tags: { queue: 'storefront-analytics' },
        extra: { jobData: job?.data },
      });
    }
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Storefront analytics worker: error');
  });

  return worker;
}
