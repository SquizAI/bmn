// server/src/agents/tools/check-credits.js

import { z } from 'zod';
import { supabaseAdmin } from '../../lib/supabase.js';

/** @type {import('@anthropic-ai/claude-agent-sdk').ToolDefinition} */
export const checkCredits = {
  name: 'checkCredits',
  description:
    'Check if a user has remaining generation credits. MUST be called before any image generation (logos, mockups, bundles). Returns credit balance and whether the requested operation is affordable.',
  inputSchema: z.object({
    userId: z.string().uuid().describe('The user UUID'),
    operationType: z
      .enum(['logo', 'mockup', 'bundle', 'text_image', 'video'])
      .describe('Type of generation to check credits for'),
    quantity: z
      .number()
      .int()
      .min(1)
      .default(1)
      .describe('Number of generations requested'),
  }),
  execute: async ({ userId, operationType, quantity }) => {
    const costs = { logo: 1, mockup: 1, bundle: 2, text_image: 1, video: 5 };
    const requiredCredits = costs[operationType] * quantity;

    const { data, error } = await supabaseAdmin
      .from('generation_credits')
      .select('credits_remaining')
      .eq('user_id', userId)
      .single();

    if (error) throw new Error(`Failed to check credits: ${error.message}`);

    const canAfford = data.credits_remaining >= requiredCredits;
    return {
      creditsRemaining: data.credits_remaining,
      creditsRequired: requiredCredits,
      canAfford,
      message: canAfford
        ? `User has ${data.credits_remaining} credits. This operation costs ${requiredCredits}.`
        : `Insufficient credits. Has ${data.credits_remaining}, needs ${requiredCredits}. Suggest plan upgrade.`,
    };
  },
};
