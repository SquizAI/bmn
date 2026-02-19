// server/src/queues/index.js

import { Queue } from 'bullmq';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

/**
 * @typedef {Object} QueueConfig
 * @property {string} name - Queue name (used as Redis key prefix)
 * @property {number} concurrency - Max concurrent jobs per worker
 * @property {number} timeout - Job timeout in milliseconds
 * @property {number} priority - Lower = higher priority (1 = highest)
 * @property {Object} retry - Retry configuration
 * @property {number} retry.attempts - Max retry attempts
 * @property {number} retry.backoffDelay - Initial backoff delay in ms
 * @property {'exponential'|'fixed'} retry.backoffType - Backoff strategy
 * @property {Object} cleanup - Auto-cleanup configuration
 * @property {{count: number, age: number}} cleanup.removeOnComplete - Completed job retention
 * @property {{count: number, age: number}} cleanup.removeOnFail - Failed job retention
 */

/** @type {Record<string, QueueConfig>} */
export const QUEUE_CONFIGS = {
  'brand-wizard': {
    name: 'brand-wizard',
    concurrency: 2,
    timeout: 300_000,       // 5 minutes
    priority: 1,            // Highest -- user is actively waiting
    retry: {
      attempts: 2,
      backoffDelay: 5_000,
      backoffType: 'exponential',
    },
    cleanup: {
      removeOnComplete: { count: 200, age: 86_400 },  // Keep 200 or 24 hours
      removeOnFail: { count: 500, age: 604_800 },     // Keep 500 or 7 days
    },
  },

  'logo-generation': {
    name: 'logo-generation',
    concurrency: 4,
    timeout: 120_000,       // 2 minutes
    priority: 1,
    retry: {
      attempts: 3,
      backoffDelay: 3_000,
      backoffType: 'exponential',
    },
    cleanup: {
      removeOnComplete: { count: 500, age: 86_400 },
      removeOnFail: { count: 500, age: 604_800 },
    },
  },

  'mockup-generation': {
    name: 'mockup-generation',
    concurrency: 4,
    timeout: 120_000,       // 2 minutes
    priority: 1,
    retry: {
      attempts: 3,
      backoffDelay: 3_000,
      backoffType: 'exponential',
    },
    cleanup: {
      removeOnComplete: { count: 500, age: 86_400 },
      removeOnFail: { count: 500, age: 604_800 },
    },
  },

  'bundle-composition': {
    name: 'bundle-composition',
    concurrency: 2,
    timeout: 120_000,       // 2 minutes
    priority: 2,
    retry: {
      attempts: 3,
      backoffDelay: 5_000,
      backoffType: 'exponential',
    },
    cleanup: {
      removeOnComplete: { count: 200, age: 86_400 },
      removeOnFail: { count: 200, age: 604_800 },
    },
  },

  'video-generation': {
    name: 'video-generation',
    concurrency: 1,
    timeout: 300_000,       // 5 minutes
    priority: 2,
    retry: {
      attempts: 2,
      backoffDelay: 10_000,
      backoffType: 'exponential',
    },
    cleanup: {
      removeOnComplete: { count: 100, age: 86_400 },
      removeOnFail: { count: 100, age: 604_800 },
    },
  },

  'crm-sync': {
    name: 'crm-sync',
    concurrency: 5,
    timeout: 30_000,        // 30 seconds
    priority: 5,
    retry: {
      attempts: 5,
      backoffDelay: 10_000,
      backoffType: 'exponential',
    },
    cleanup: {
      removeOnComplete: { count: 1000, age: 86_400 },
      removeOnFail: { count: 1000, age: 604_800 },
    },
  },

  'email-send': {
    name: 'email-send',
    concurrency: 10,
    timeout: 15_000,        // 15 seconds
    priority: 3,
    retry: {
      attempts: 5,
      backoffDelay: 5_000,
      backoffType: 'exponential',
    },
    cleanup: {
      removeOnComplete: { count: 2000, age: 86_400 },
      removeOnFail: { count: 1000, age: 604_800 },
    },
  },

  'image-upload': {
    name: 'image-upload',
    concurrency: 5,
    timeout: 60_000,        // 1 minute
    priority: 2,
    retry: {
      attempts: 3,
      backoffDelay: 3_000,
      backoffType: 'exponential',
    },
    cleanup: {
      removeOnComplete: { count: 500, age: 86_400 },
      removeOnFail: { count: 500, age: 604_800 },
    },
  },

  'cleanup': {
    name: 'cleanup',
    concurrency: 1,
    timeout: 120_000,       // 2 minutes
    priority: 10,           // Lowest priority
    retry: {
      attempts: 1,
      backoffDelay: 60_000,
      backoffType: 'fixed',
    },
    cleanup: {
      removeOnComplete: { count: 50, age: 86_400 },
      removeOnFail: { count: 50, age: 604_800 },
    },
  },
};

/** @type {Map<string, Queue>} */
const queues = new Map();

/**
 * Redis connection config for BullMQ.
 * BullMQ needs the raw config so it can create its own connections.
 * We extract connection options from the existing redis client.
 * @type {import('ioredis').RedisOptions}
 */
function getBullRedisConfig() {
  return {
    host: redis.options.host,
    port: redis.options.port,
    password: redis.options.password,
    db: redis.options.db,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  };
}

/**
 * Initialize all BullMQ queues.
 * Call once at server startup.
 * @returns {Map<string, Queue>}
 */
export function initQueues() {
  const redisConfig = getBullRedisConfig();

  for (const [name, queueConfig] of Object.entries(QUEUE_CONFIGS)) {
    const queue = new Queue(name, {
      connection: redisConfig,
      defaultJobOptions: {
        priority: queueConfig.priority,
        attempts: queueConfig.retry.attempts,
        backoff: {
          type: queueConfig.retry.backoffType,
          delay: queueConfig.retry.backoffDelay,
        },
        removeOnComplete: queueConfig.cleanup.removeOnComplete,
        removeOnFail: queueConfig.cleanup.removeOnFail,
      },
    });

    queue.on('error', (err) => {
      logger.error({ queue: name, err }, 'Queue error');
    });

    queues.set(name, queue);
    logger.info({ queue: name, concurrency: queueConfig.concurrency }, 'Queue initialized');
  }

  // Set up repeatable cleanup job (every 1 hour)
  const cleanupQueue = queues.get('cleanup');
  cleanupQueue.add(
    'expired-job-cleanup',
    { type: 'expired-jobs' },
    {
      repeat: { every: 3_600_000 },
      jobId: 'recurring-cleanup',
    }
  );

  logger.info(`Initialized ${queues.size} queues`);
  return queues;
}

/**
 * Get a queue by name.
 * @param {string} name
 * @returns {Queue}
 */
export function getQueue(name) {
  const queue = queues.get(name);
  if (!queue) {
    throw new Error(`Queue "${name}" not found. Available: ${[...queues.keys()].join(', ')}`);
  }
  return queue;
}

/**
 * Graceful shutdown -- close all queues.
 * @returns {Promise<void>}
 */
export async function shutdownQueues() {
  logger.info('Shutting down all queues');
  const closePromises = [...queues.values()].map((q) => q.close());
  await Promise.allSettled(closePromises);
  queues.clear();
  logger.info('All queues shut down');
}
