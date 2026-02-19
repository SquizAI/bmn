// server/src/queues/dispatch.js

import { randomUUID } from 'node:crypto';
import { getQueue, QUEUE_CONFIGS } from './index.js';
import { JOB_SCHEMAS } from './schemas.js';
import { logger } from '../lib/logger.js';

/**
 * @typedef {Object} DispatchResult
 * @property {string} jobId - BullMQ job ID
 * @property {string} queueName - Queue the job was added to
 */

/**
 * Dispatch a job to a BullMQ queue with Zod validation.
 *
 * @param {string} queueName - Target queue name (must exist in QUEUE_CONFIGS)
 * @param {Object} data - Job payload (validated against queue's Zod schema)
 * @param {Object} [options] - BullMQ job options overrides
 * @param {number} [options.priority] - Override default priority
 * @param {number} [options.delay] - Delay in ms before job becomes processable
 * @param {string} [options.jobId] - Custom job ID (for deduplication)
 * @returns {Promise<DispatchResult>}
 * @throws {z.ZodError} If data fails validation
 * @throws {Error} If queue doesn't exist
 */
export async function dispatchJob(queueName, data, options = {}) {
  // 1. Validate the queue exists
  const queueConfig = QUEUE_CONFIGS[queueName];
  if (!queueConfig) {
    throw new Error(`Unknown queue: "${queueName}". Available: ${Object.keys(QUEUE_CONFIGS).join(', ')}`);
  }

  // 2. Validate the job data against the schema
  const schema = JOB_SCHEMAS[queueName];
  if (schema) {
    schema.parse(data);
  }

  // 3. Get the queue
  const queue = getQueue(queueName);

  // 4. Generate a unique job ID
  const jobId = options.jobId || `${queueName}-${randomUUID()}`;

  // 5. Add the job
  const job = await queue.add(queueName, data, {
    jobId,
    priority: options.priority ?? queueConfig.priority,
    delay: options.delay,
  });

  logger.info({
    jobId: job.id,
    queue: queueName,
    userId: data.userId,
    brandId: data.brandId,
  }, 'Job dispatched');

  return {
    jobId: job.id,
    queueName,
  };
}
