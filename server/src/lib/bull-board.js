// server/src/lib/bull-board.js

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { redis } from './redis.js';
import { QUEUE_CONFIGS } from '../queues/index.js';

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

  const queues = Object.keys(QUEUE_CONFIGS).map(
    (name) => new Queue(name, { connection: redis })
  );

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
