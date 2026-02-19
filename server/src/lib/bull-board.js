// server/src/lib/bull-board.js

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { redis } from './redis.js';

/**
 * Queue names that match the BullMQ workers defined in server/src/workers/.
 * Every queue registered here appears in the Bull Board dashboard.
 */
const QUEUE_NAMES = [
  'brand-analysis',
  'logo-generation',
  'mockup-generation',
  'bundle-composition',
  'social-analysis',
  'brand-identity',
  'email-send',
  'crm-sync',
  'cleanup',
];

/**
 * Create Bull Board Express adapter and register all queues.
 * Returns an Express adapter whose router can be mounted at /admin/queues.
 *
 * Must be behind admin auth -- do NOT expose publicly.
 *
 * @returns {{ serverAdapter: ExpressAdapter, queues: Queue[] }}
 */
export function createBullBoardAdapter() {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  const queues = QUEUE_NAMES.map((name) => new Queue(name, { connection: redis }));

  createBullBoard({
    queues: queues.map((q) => new BullMQAdapter(q)),
    serverAdapter,
    options: {
      uiConfig: {
        boardTitle: 'Brand Me Now — Job Queues',
        boardLogo: { path: '' },
        miscLinks: [
          { text: 'API Health', url: '/health' },
          { text: 'Sentry', url: 'https://brandmenow.sentry.io' },
          { text: 'PostHog', url: 'https://us.posthog.com/project/bmn' },
        ],
      },
    },
  });

  return { serverAdapter, queues };
}
