// server/src/skills/logo-creator/config.js

/** @type {import('../_shared/types.js').SkillConfig} */
export const skillConfig = {
  name: 'logo-creator',
  description: 'Generate logo variations using FLUX.2 Pro, with background removal and Supabase Storage upload.',
  model: 'claude-sonnet-4-6',
  maxTurns: 20,
  maxBudgetUsd: 0.60,
  timeoutMs: 180_000,
  retryAttempts: 2,
};
