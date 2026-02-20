// server/src/workers/brand-wizard.js

import { Worker } from 'bullmq';
import { redis } from '../lib/redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { createJobLogger } from './job-logger.js';
import { logger } from '../lib/logger.js';

/**
 * Build the Redis connection config for BullMQ workers.
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
 * Brand Wizard worker -- runs the Anthropic Agent SDK agent loop.
 * This is the main orchestration worker. It spawns the parent Brand Wizard Agent
 * which in turn invokes subagents (skills) via the Task tool.
 *
 * NOTE: Agent SDK calls are stubbed until the SDK is installed and the agent
 * system is implemented (Phase 1 Week 3 -- 04-AGENT-SYSTEM.md).
 *
 * @param {import('socket.io').Server} io
 * @returns {Worker}
 */
export function initBrandWizardWorker(io) {
  const queueConfig = QUEUE_CONFIGS['brand-wizard'];

  const worker = new Worker(
    'brand-wizard',
    async (job) => {
      const { userId, brandId, step, sessionId, input, creditCost } = job.data;
      const jobLog = createJobLogger(job, 'brand-wizard');
      const room = `brand:${brandId}`;
      const jobRoom = `job:${job.id}`;

      jobLog.info({ step }, 'Brand wizard job started');

      try {
        // Update generation_jobs table to 'processing'
        await supabaseAdmin.from('generation_jobs').update({
          status: 'processing',
          bullmq_job_id: job.id,
        }).eq('brand_id', brandId).eq('status', 'queued');

        // Emit: job started
        io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
          jobId: job.id,
          brandId,
          step,
          status: 'started',
          progress: 0,
          message: 'Starting brand wizard agent...',
          timestamp: Date.now(),
        });

        await job.updateProgress(5);

        // ------------------------------------------------------------------
        // Run the Brand Wizard Agent via the agent system.
        // Falls back to stub simulation if the Agent SDK is not installed.
        // ------------------------------------------------------------------
        let finalResult = null;

        try {
          const { runBrandWizard } = await import('../agents/brand-wizard.js');

          for await (const message of runBrandWizard({
            userId,
            brandId,
            step,
            sessionId,
            input,
            io,
            job,
          })) {
            // SDKAssistantMessage — stream agent text to client
            if (message.type === 'assistant') {
              io.of('/wizard').to(jobRoom).to(room).emit('agent:message', {
                jobId: job.id,
                brandId,
                content: message.message?.content,
                timestamp: Date.now(),
              });
            }
            // SDKResultSuccess — agent completed successfully
            if (message.type === 'result' && message.subtype === 'success') {
              finalResult = {
                result: message.result,
                cost: message.total_cost_usd,
                sessionId: message.session_id,
              };
            }
            // SDKResultError — agent hit an error (budget, turns, etc.)
            if (message.type === 'result' && message.subtype === 'error') {
              jobLog.warn(
                { error: message.error, sessionId: message.session_id },
                'Agent returned error result'
              );
              finalResult = {
                result: message.error || 'Agent error',
                cost: message.total_cost_usd || 0,
                sessionId: message.session_id,
              };
            }
          }
        } catch (sdkError) {
          // SDK not available -- simulate progress for pipeline testing
          jobLog.warn({ err: sdkError.message }, 'Agent SDK not available, running stub simulation');

          const stages = [
            { progress: 20, message: `Analyzing ${step} input...` },
            { progress: 40, message: `Processing ${step} data...` },
            { progress: 60, message: `Generating ${step} results...` },
            { progress: 80, message: `Finalizing ${step}...` },
          ];

          for (const stage of stages) {
            io.of('/wizard').to(jobRoom).to(room).emit('job:progress', {
              jobId: job.id,
              brandId,
              step,
              status: 'processing',
              progress: stage.progress,
              message: stage.message,
              timestamp: Date.now(),
            });
            await job.updateProgress(stage.progress);
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          finalResult = {
            result: { step, status: 'stub', message: `Stub result for ${step}` },
            cost: 0,
            sessionId: null,
          };
        }

        // Update database with result
        await supabaseAdmin.from('generation_jobs').update({
          status: 'complete',
          result: finalResult,
          progress: 100,
          completed_at: new Date().toISOString(),
        }).eq('bullmq_job_id', job.id);

        // Deduct credits
        await supabaseAdmin.rpc('deduct_credits', {
          p_user_id: userId,
          p_amount: creditCost,
        });

        // Emit: job complete
        io.of('/wizard').to(jobRoom).to(room).emit('job:complete', {
          jobId: job.id,
          brandId,
          step,
          result: finalResult,
          timestamp: Date.now(),
        });

        await job.updateProgress(100);

        jobLog.info({ cost: finalResult?.cost }, 'Brand wizard job complete');

        return finalResult;
      } catch (error) {
        jobLog.error({ err: error }, 'Brand wizard job failed');

        // Update database
        await supabaseAdmin.from('generation_jobs').update({
          status: 'failed',
          error: error.message,
        }).eq('bullmq_job_id', job.id).catch((dbErr) => {
          jobLog.error({ err: dbErr }, 'Failed to update generation_jobs on failure');
        });

        // Emit: job failed
        io.of('/wizard').to(jobRoom).to(room).emit('job:failed', {
          jobId: job.id,
          brandId,
          step,
          error: error.message,
          retriesLeft: (queueConfig.retry.attempts - job.attemptsMade),
          timestamp: Date.now(),
        });

        throw error; // BullMQ handles retry
      }
    },
    {
      connection: getBullRedisConfig(),
      concurrency: queueConfig.concurrency,
      limiter: {
        max: queueConfig.concurrency,
        duration: 1000,
      },
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err, attempts: job?.attemptsMade }, 'Brand wizard worker: job failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Brand wizard worker: error');
  });

  return worker;
}
