// server/src/agents/tools/deduct-credit.js

import { z } from 'zod';
import { supabaseAdmin } from '../../lib/supabase.js';

/** @type {import('@anthropic-ai/claude-agent-sdk').ToolDefinition} */
export const deductCredit = {
  name: 'deductCredit',
  description:
    'Deduct generation credits after a successful generation. Call AFTER the generation tool returns successfully, not before.',
  inputSchema: z.object({
    userId: z.string().uuid().describe('The user UUID'),
    amount: z
      .number()
      .int()
      .min(1)
      .describe('Number of credits to deduct'),
    reason: z
      .string()
      .describe('What the credits were used for (e.g., "4 logo generations")'),
    brandId: z
      .string()
      .uuid()
      .describe('The brand UUID for audit trail'),
  }),
  execute: async ({ userId, amount, reason, brandId }) => {
    // Atomic decrement with floor check via Supabase RPC
    const { data, error } = await supabaseAdmin.rpc('deduct_credits', {
      p_user_id: userId,
      p_amount: amount,
    });

    if (error) throw new Error(`Failed to deduct credits: ${error.message}`);

    // Audit log
    await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      action: 'credit_deducted',
      resource_type: 'generation_credits',
      resource_id: brandId,
      metadata: { amount, reason, remaining: data },
    });

    return { success: true, creditsRemaining: data, deducted: amount };
  },
};
