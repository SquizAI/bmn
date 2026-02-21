// server/src/workers/index.js

import { logger } from '../lib/logger.js';
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

/** @type {import('bullmq').Worker[]} */
let workers = [];

/**
 * Initialize all BullMQ workers.
 * Each worker processes jobs from its dedicated queue and emits progress
 * events via Socket.io where applicable.
 *
 * @param {import('socket.io').Server} io - Socket.io server instance (for emitting progress)
 * @returns {import('bullmq').Worker[]}
 */
export function initWorkers(io) {
  workers = [
    initBrandWizardWorker(io),
    initLogoGenerationWorker(io),
    initMockupGenerationWorker(io),
    initBundleCompositionWorker(io),
    initVideoGenerationWorker(io),
    initCRMSyncWorker(io),
    initEmailSendWorker(io),
    initImageUploadWorker(io),
    initPrintExportWorker(io),
    initCleanupWorker(io),
    initContentGenWorker(io),
    initEmailCampaignWorker(io),
    initAnalyticsWorker(io),
  ];

  logger.info({ count: workers.length }, 'BullMQ workers initialized');
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
