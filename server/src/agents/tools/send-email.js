// server/src/agents/tools/send-email.js

import { z } from 'zod';
import { dispatchJob } from '../../queues/dispatch.js';

/** @type {import('@anthropic-ai/claude-agent-sdk').ToolDefinition} */
export const sendEmail = {
  name: 'sendEmail',
  description:
    'Dispatch a transactional email job via BullMQ + Resend. Non-blocking. Use for: brand completion confirmation, wizard abandonment follow-up, welcome emails.',
  inputSchema: z.object({
    userId: z
      .string()
      .uuid()
      .describe(
        'The recipient user UUID (email looked up from profiles table)'
      ),
    templateId: z
      .enum([
        'brand-complete',
        'welcome',
        'wizard-abandoned',
        'logo-ready',
        'mockup-ready',
        'subscription-confirmed',
        'support-ticket',
      ])
      .describe('The email template to use'),
    data: z
      .record(z.unknown())
      .optional()
      .describe(
        'Template-specific merge data (brand name, logo URL, etc.)'
      ),
  }),
  execute: async ({ userId, templateId, data }) => {
    const result = await dispatchJob('email-send', {
      userId,
      templateId,
      data: data || {},
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      jobId: result.jobId,
      message: `Email queued: ${templateId}`,
    };
  },
};
