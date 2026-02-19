// server/src/workers/job-logger.js

import { logger } from '../lib/logger.js';

/**
 * Create a child logger for a BullMQ job.
 * Binds jobId, queue, userId, brandId, and attempt number to every log line.
 *
 * @param {import('bullmq').Job} job - The BullMQ job instance
 * @param {string} queueName - The queue this job belongs to
 * @returns {import('pino').Logger}
 */
export function createJobLogger(job, queueName) {
  return logger.child({
    jobId: job.id,
    queue: queueName,
    userId: job.data?.userId,
    brandId: job.data?.brandId,
    attempt: job.attemptsMade + 1,
  });
}
