// server/src/workers/index.js

import { logger } from '../lib/logger.js';
import { QUEUE_CONFIGS } from '../queues/index.js';
import { dispatchJob } from '../queues/dispatch.js';
import { initBrandWizardWorker } from './brand-wizard.js';
import { initLogoGenerationWorker } from './logo-generation.js';
import { initMockupGenerationWorker } from './mockup-generation.js';
import { initBundleCompositionWorker } from './bundle-composition.js';
import { initVideoGenerationWorker } from './video-generation.js';
import { initCRMSyncWorker } from './crm-sync.js';
import { initEmailSendWorker } from './email-send.js';
import { initImageUploadWorker } from './image-upload.js';
import { initCleanupWorker } from './cleanup.js';
import { initPrintExportWorker } from './print-export.js';
import { initContentGenWorker } from './content-gen-worker.js';
import { initEmailCampaignWorker } from './email-campaign-worker.js';
import { initAnalyticsWorker } from './analytics-worker.js';
import { initSocialAnalysisWorker } from './social-analysis-worker.js';
import { initStorefrontAnalyticsWorker } from './storefront-analytics.js';
import { initStorefrontContactWorker } from './storefront-contact.js';
import { initDeadLetterWorker } from './dead-letter.js';

/** @type {import('bullmq').Worker[]} */
let workers = [];

/**
 * Attach a dead-letter forwarding handler to a worker's `failed` event.
 * When a job exhausts all retry attempts, its data is dispatched to the
 * dead-letter queue for inspection, alerting, and potential manual retry.
 *
 * @param {import('bullmq').Worker} worker - The BullMQ worker instance
 * @param {string} queueName - The queue this worker processes
 */
function attachDeadLetterForwarding(worker, queueName) {
  const queueConfig = QUEUE_CONFIGS[queueName];
  if (!queueConfig) return;

  const maxAttempts = queueConfig.retry.attempts;

  worker.on('failed', async (job, err) => {
    // Only forward to dead-letter if this was the final attempt
    if (!job || job.attemptsMade < maxAttempts) return;

    try {
      await dispatchJob('dead-letter', {
        originalQueue: queueName,
        originalJobId: job.id || 'unknown',
        originalJobName: job.name || queueName,
        originalData: job.data || {},
        errorMessage: err?.message || 'Unknown error',
        errorStack: err?.stack || undefined,
        attemptsMade: job.attemptsMade,
        maxAttempts,
        firstAttemptAt: job.timestamp ? new Date(job.timestamp).toISOString() : undefined,
        failedAt: new Date().toISOString(),
        userId: job.data?.userId || undefined,
        brandId: job.data?.brandId || undefined,
      });

      logger.info({
        originalQueue: queueName,
        originalJobId: job.id,
        attemptsMade: job.attemptsMade,
        maxAttempts,
      }, 'Exhausted job forwarded to dead-letter queue');
    } catch (dlErr) {
      logger.error({
        err: dlErr,
        originalQueue: queueName,
        originalJobId: job.id,
      }, 'Failed to forward exhausted job to dead-letter queue');
    }
  });
}

/**
 * Initialize all BullMQ workers.
 * Each worker processes jobs from its dedicated queue and emits progress
 * events via Socket.io where applicable.
 *
 * Dead-letter forwarding is automatically attached to all workers (except
 * the dead-letter worker itself) so that permanently failed jobs are
 * captured for inspection and alerting.
 *
 * @param {import('socket.io').Server} io - Socket.io server instance (for emitting progress)
 * @returns {import('bullmq').Worker[]}
 */
export function initWorkers(io) {
  // Initialize the dead-letter worker first (it has no dead-letter forwarding itself)
  const deadLetterWorker = initDeadLetterWorker(io);

  // Initialize all other workers and attach dead-letter forwarding
  /** @type {Array<{worker: import('bullmq').Worker, queueName: string}>} */
  const workerEntries = [
    { worker: initBrandWizardWorker(io), queueName: 'brand-wizard' },
    { worker: initLogoGenerationWorker(io), queueName: 'logo-generation' },
    { worker: initMockupGenerationWorker(io), queueName: 'mockup-generation' },
    { worker: initBundleCompositionWorker(io), queueName: 'bundle-composition' },
    { worker: initVideoGenerationWorker(io), queueName: 'video-generation' },
    { worker: initCRMSyncWorker(io), queueName: 'crm-sync' },
    { worker: initEmailSendWorker(io), queueName: 'email-send' },
    { worker: initImageUploadWorker(io), queueName: 'image-upload' },
    { worker: initPrintExportWorker(io), queueName: 'print-export' },
    { worker: initCleanupWorker(io), queueName: 'cleanup' },
    { worker: initContentGenWorker(io), queueName: 'content-gen' },
    { worker: initEmailCampaignWorker(io), queueName: 'email-campaign' },
    { worker: initAnalyticsWorker(io), queueName: 'analytics' },
    { worker: initSocialAnalysisWorker(io), queueName: 'social-analysis' },
    { worker: initStorefrontAnalyticsWorker(io), queueName: 'storefront-analytics' },
    { worker: initStorefrontContactWorker(io), queueName: 'storefront-contact' },
  ];

  // Attach dead-letter forwarding to each worker
  for (const { worker, queueName } of workerEntries) {
    attachDeadLetterForwarding(worker, queueName);
  }

  workers = [deadLetterWorker, ...workerEntries.map((e) => e.worker)];

  logger.info({ count: workers.length }, 'BullMQ workers initialized (with dead-letter forwarding)');
  return workers;
}

/**
 * Graceful shutdown -- close all workers.
 * Waits for active jobs to complete before shutting down.
 * @returns {Promise<void>}
 */
export async function shutdownWorkers() {
  logger.info('Shutting down all workers');
  await Promise.allSettled(workers.map((w) => w.close()));
  workers = [];
  logger.info('All workers shut down');
}
