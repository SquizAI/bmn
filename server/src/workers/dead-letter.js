// server/src/workers/dead-letter.js

import { Worker } from 'bullmq';
import { getBullRedisConfig } from '../lib/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { createJobLogger } from './job-logger.js';
import { logger } from '../lib/logger.js';

/**
 * Dead Letter worker -- processes permanently failed jobs from all queues.
 *
 * When a job exhausts all retry attempts in any queue, it gets forwarded here.
 * This worker:
 *   1. Logs the permanent failure with full context (structured pino logging)
 *   2. Stores the failure in the `dead_letter_jobs` table for inspection
 *   3. Emits a Socket.io event to the admin namespace for real-time alerts
 *
 * @param {import('socket.io').Server} io
 * @returns {Worker}
 */
export function initDeadLetterWorker(io) {
  const queueConfig = QUEUE_CONFIGS['dead-letter'];

  const worker = new Worker(
    'dead-letter',
    async (job) => {
      const {
        originalQueue,
        originalJobId,
        originalJobName,
        originalData,
        errorMessage,
        errorStack,
        attemptsMade,
        maxAttempts,
        firstAttemptAt,
        failedAt,
        userId,
        brandId,
      } = job.data;

      const jobLog = createJobLogger(job, 'dead-letter');

      jobLog.error({
        originalQueue,
        originalJobId,
        originalJobName,
        errorMessage,
        attemptsMade,
        maxAttempts,
        userId,
        brandId,
      }, 'Dead letter: job permanently failed after exhausting all retries');

      // ── Step 1: Store in dead_letter_jobs table ──────────────────────────

      const { data: dlRecord, error: insertError } = await supabaseAdmin
        .from('dead_letter_jobs')
        .insert({
          original_queue: originalQueue,
          original_job_id: originalJobId,
          original_job_name: originalJobName,
          original_data: originalData,
          error_message: errorMessage,
          error_stack: errorStack || null,
          attempts_made: attemptsMade,
          max_attempts: maxAttempts,
          first_attempt_at: firstAttemptAt || null,
          failed_at: failedAt,
          user_id: userId || null,
          brand_id: brandId || null,
          status: 'pending_review',
        })
        .select('id')
        .single();

      if (insertError) {
        jobLog.error({ err: insertError }, 'Failed to insert dead letter record into database');
        // Don't throw -- we still want to emit the Socket.io alert even if the DB write fails
      } else {
        jobLog.info({ deadLetterId: dlRecord.id }, 'Dead letter record saved');
      }

      // ── Step 2: Update generation_jobs if applicable ─────────────────────

      if (originalJobId) {
        await supabaseAdmin
          .from('generation_jobs')
          .update({
            status: 'permanently_failed',
            error: `Permanently failed after ${attemptsMade} attempts: ${errorMessage}`,
          })
          .eq('bullmq_job_id', originalJobId)
          .catch((dbErr) => {
            jobLog.warn({ err: dbErr }, 'Failed to update generation_jobs status (may not exist for this job type)');
          });
      }

      // ── Step 3: Emit real-time alert to admin namespace ──────────────────

      io.to('admin').emit('dead-letter:new', {
        id: dlRecord?.id || null,
        originalQueue,
        originalJobId,
        originalJobName,
        errorMessage,
        attemptsMade,
        maxAttempts,
        userId,
        brandId,
        failedAt,
        timestamp: Date.now(),
      });

      jobLog.info({
        originalQueue,
        originalJobId,
        deadLetterId: dlRecord?.id,
      }, 'Dead letter job processed');

      return {
        deadLetterId: dlRecord?.id || null,
        originalQueue,
        originalJobId,
      };
    },
    {
      connection: getBullRedisConfig(),
      concurrency: queueConfig.concurrency,
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Dead letter worker: job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Dead letter worker: error');
  });

  return worker;
}
