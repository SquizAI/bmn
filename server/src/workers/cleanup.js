// server/src/workers/cleanup.js

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
 * Clean up expired BullMQ jobs that haven't been auto-cleaned.
 * @param {import('pino').Logger} jobLog
 * @returns {Promise<{cleaned: number}>}
 */
async function cleanExpiredJobs(jobLog) {
  jobLog.info('Cleaning expired jobs');

  // Update generation_jobs that are stuck in 'processing' for more than 30 minutes
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('generation_jobs')
    .update({ status: 'failed', error: 'Job timed out (stuck in processing)' })
    .eq('status', 'processing')
    .lt('created_at', thirtyMinutesAgo)
    .select('id');

  if (error) {
    jobLog.error({ err: error }, 'Failed to clean expired jobs');
    return { cleaned: 0 };
  }

  const cleaned = data?.length || 0;
  jobLog.info({ cleaned }, 'Expired jobs cleaned');
  return { cleaned };
}

/**
 * Clean up orphaned assets -- brand_assets with no corresponding brand.
 * @param {import('pino').Logger} jobLog
 * @returns {Promise<{cleaned: number}>}
 */
async function cleanOrphanedAssets(jobLog) {
  jobLog.info('Cleaning orphaned assets');

  // Find assets where upload never completed (upload_completed is false or null)
  // and the record is older than 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('brand_assets')
    .delete()
    .lt('created_at', oneDayAgo)
    .is('url', null)
    .select('id');

  if (error) {
    jobLog.error({ err: error }, 'Failed to clean orphaned assets');
    return { cleaned: 0 };
  }

  const cleaned = data?.length || 0;
  jobLog.info({ cleaned }, 'Orphaned assets cleaned');
  return { cleaned };
}

/**
 * Clean up stale wizard sessions that were abandoned.
 * @param {import('pino').Logger} jobLog
 * @returns {Promise<{cleaned: number}>}
 */
async function cleanStaleSessions(jobLog) {
  jobLog.info('Cleaning stale sessions');

  // Mark brands with 'draft' status older than 7 days as abandoned
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('brands')
    .update({ status: 'abandoned' })
    .eq('status', 'draft')
    .lt('updated_at', sevenDaysAgo)
    .select('id');

  if (error) {
    jobLog.error({ err: error }, 'Failed to clean stale sessions');
    return { cleaned: 0 };
  }

  const cleaned = data?.length || 0;
  jobLog.info({ cleaned }, 'Stale sessions cleaned');
  return { cleaned };
}

/**
 * Clean up temporary files from Redis cache.
 * @param {import('pino').Logger} jobLog
 * @returns {Promise<{cleaned: number}>}
 */
async function cleanTempFiles(jobLog) {
  jobLog.info('Cleaning temp files from Redis cache');

  // Clean expired cache keys (cache:* with TTL already expired are auto-removed,
  // but we can proactively clean stale patterns)
  let cleaned = 0;

  try {
    // Scan for cache keys that shouldn't exist anymore
    const stream = redis.scanStream({ match: 'cache:*', count: 100 });
    const keysToCheck = [];

    for await (const keys of stream) {
      keysToCheck.push(...keys);
    }

    // Check TTLs and clean up keys without TTL (shouldn't happen, but safety net)
    for (const key of keysToCheck) {
      const ttl = await redis.ttl(key);
      if (ttl === -1) {
        // Key exists but has no TTL -- set a 1-hour TTL as safety net
        await redis.expire(key, 3600);
        cleaned++;
      }
    }
  } catch (err) {
    jobLog.error({ err }, 'Error during temp file cleanup');
  }

  jobLog.info({ cleaned }, 'Temp files cleaned');
  return { cleaned };
}

/**
 * Map of cleanup types to their handler functions.
 * @type {Record<string, (jobLog: import('pino').Logger) => Promise<{cleaned: number}>>}
 */
const CLEANUP_HANDLERS = {
  'expired-jobs': cleanExpiredJobs,
  'orphaned-assets': cleanOrphanedAssets,
  'stale-sessions': cleanStaleSessions,
  'temp-files': cleanTempFiles,
};

/**
 * Cleanup worker -- periodic maintenance tasks.
 * Runs as a recurring job every hour (configured in queues/index.js).
 *
 * @param {import('socket.io').Server} _io
 * @returns {Worker}
 */
export function initCleanupWorker(_io) {
  const queueConfig = QUEUE_CONFIGS['cleanup'];

  const worker = new Worker(
    'cleanup',
    async (job) => {
      const { type } = job.data;
      const jobLog = createJobLogger(job, 'cleanup');

      jobLog.info({ type }, 'Cleanup job started');

      const handler = CLEANUP_HANDLERS[type];
      if (!handler) {
        jobLog.warn({ type }, 'Unknown cleanup type, running all cleanup tasks');

        // Run all cleanup tasks
        const results = {};
        for (const [cleanupType, cleanupHandler] of Object.entries(CLEANUP_HANDLERS)) {
          try {
            results[cleanupType] = await cleanupHandler(jobLog);
          } catch (err) {
            jobLog.error({ err, cleanupType }, 'Cleanup task failed');
            results[cleanupType] = { cleaned: 0, error: err.message };
          }
        }

        jobLog.info({ results }, 'All cleanup tasks complete');
        return results;
      }

      try {
        const result = await handler(jobLog);
        jobLog.info({ type, result }, 'Cleanup job complete');
        return result;
      } catch (error) {
        jobLog.error({ err: error, type }, 'Cleanup job failed');
        throw error;
      }
    },
    {
      connection: getBullRedisConfig(),
      concurrency: queueConfig.concurrency,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Cleanup worker: job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Cleanup worker: error');
  });

  return worker;
}
