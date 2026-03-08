// server/src/routes/api/v1/jobs.js

import { Router } from 'express';
import { z } from 'zod';
import { getQueue, QUEUE_CONFIGS } from '../../../queues/index.js';
import { logger } from '../../../lib/logger.js';
import { validate } from '../../../middleware/validate.js';

export const jobRoutes = Router();

/**
 * Known queue names that are user-facing and safe to query.
 * Excludes internal queues like 'cleanup', 'crm-sync', 'analytics'.
 * @type {string[]}
 */
const USER_FACING_QUEUES = [
  'social-analysis',
  'brand-wizard',
  'logo-generation',
  'mockup-generation',
  'bundle-composition',
  'video-generation',
  'content-gen',
  'image-upload',
  'print-export',
  'storefront-generation',
];

const jobIdParamSchema = z.object({
  jobId: z.string().min(1).max(200),
});

const statusQuerySchema = z.object({
  queue: z.string().min(1).max(50).optional(),
});

/**
 * GET /api/v1/jobs/:jobId/status
 *
 * Returns the current status of a BullMQ job. Used as a polling fallback
 * when Socket.io events are missed due to brief disconnections.
 *
 * Query params:
 *   - queue (optional): Narrow the search to a specific queue name.
 *     If omitted, searches all user-facing queues.
 *
 * Response:
 *   { status, progress, result, error }
 */
jobRoutes.get(
  '/:jobId/status',
  validate({ params: jobIdParamSchema, query: statusQuerySchema }),
  async (req, res, next) => {
    try {
      const { jobId } = req.params;
      const { queue: queueName } = req.query;

      // If a specific queue is provided, search only that queue
      if (queueName) {
        if (!QUEUE_CONFIGS[queueName]) {
          return res.status(400).json({
            success: false,
            error: `Unknown queue: "${queueName}"`,
          });
        }

        const job = await findJobInQueue(queueName, jobId);
        if (!job) {
          return res.status(404).json({
            success: false,
            error: 'Job not found',
          });
        }

        return res.json({
          success: true,
          data: job,
        });
      }

      // No queue specified -- search all user-facing queues
      for (const name of USER_FACING_QUEUES) {
        try {
          const job = await findJobInQueue(name, jobId);
          if (job) {
            return res.json({
              success: true,
              data: job,
            });
          }
        } catch {
          // Queue may not be initialized; skip silently
        }
      }

      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    } catch (err) {
      logger.error({ msg: 'Job status lookup failed', jobId: req.params.jobId, error: err.message });
      return next(err);
    }
  },
);

/**
 * Look up a job in a specific queue and return a normalized status object.
 *
 * @param {string} queueName
 * @param {string} jobId
 * @returns {Promise<{status: string, progress: number, result: unknown, error: string|null, queue: string} | null>}
 */
async function findJobInQueue(queueName, jobId) {
  const queue = getQueue(queueName);
  const job = await queue.getJob(jobId);

  if (!job) return null;

  const state = await job.getState();
  const progress = typeof job.progress === 'number' ? job.progress : 0;

  return {
    status: state,       // 'active' | 'waiting' | 'completed' | 'failed' | 'delayed'
    progress,
    result: state === 'completed' ? job.returnvalue : null,
    error: state === 'failed' ? job.failedReason || 'Unknown error' : null,
    queue: queueName,
  };
}
