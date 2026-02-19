// server/src/agents/tools/queue-crm-sync.js

import { z } from 'zod';
import { dispatchJob } from '../../queues/dispatch.js';

/** @type {import('@anthropic-ai/claude-agent-sdk').ToolDefinition} */
export const queueCRMSync = {
  name: 'queueCRMSync',
  description:
    'Dispatch a CRM sync job to GoHighLevel. Non-blocking -- the job runs in the background via BullMQ. Use after brand completion, wizard start, or wizard abandonment.',
  inputSchema: z.object({
    userId: z.string().uuid().describe('The user UUID'),
    eventType: z
      .enum([
        'wizard.started',
        'wizard.abandoned',
        'brand.completed',
        'logo.generated',
        'mockup.generated',
        'subscription.created',
      ])
      .describe('The event that triggered the CRM sync'),
    data: z
      .record(z.unknown())
      .optional()
      .describe('Event-specific payload data'),
  }),
  execute: async ({ userId, eventType, data }) => {
    const result = await dispatchJob('crm-sync', {
      userId,
      eventType,
      data: data || {},
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      jobId: result.jobId,
      message: `CRM sync queued: ${eventType}`,
    };
  },
};
