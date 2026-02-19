// server/src/workers/video-generation.js

import { Worker } from 'bullmq';
import { redis } from '../lib/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
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
 * Video Generation worker -- Phase 2 placeholder.
 * Will generate product showcase videos via Veo 3 (Google AI).
 *
 * Currently returns a not_available response since video generation
 * is scheduled for Phase 2 (Months 2-3).
 *
 * @param {import('socket.io').Server} io
 * @returns {Worker}
 */
export function initVideoGenerationWorker(io) {
  const queueConfig = QUEUE_CONFIGS['video-generation'];

  const worker = new Worker(
    'video-generation',
    async (job) => {
      const { userId, brandId, productName } = job.data;
      const jobLog = createJobLogger(job, 'video-generation');
      const room = `brand:${brandId}`;
      const jobRoom = `job:${job.id}`;

      jobLog.info({ productName }, 'Video generation requested (Phase 2 -- not yet available)');

      // Emit not_available event
      io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
        jobId: job.id,
        brandId,
        status: 'not_available',
        progress: 0,
        message: 'Video generation is coming in Phase 2. Stay tuned!',
        timestamp: Date.now(),
      });

      io.of('/wizard').to(jobRoom).to(room).emit('job:complete', {
        jobId: job.id,
        brandId,
        status: 'not_available',
        progress: 100,
        message: 'Video generation is a Phase 2 feature. Check back soon!',
        result: { available: false, phase: 2 },
        timestamp: Date.now(),
      });

      jobLog.info('Video generation job completed (Phase 2 stub)');

      return { available: false, phase: 2, message: 'Video generation coming in Phase 2' };
    },
    {
      connection: getBullRedisConfig(),
      concurrency: queueConfig.concurrency,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Video generation worker: job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Video generation worker: error');
  });

  return worker;
}
