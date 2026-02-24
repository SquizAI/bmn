// server/src/skills/logo-creator/config.js

/** @type {import('../_shared/types.js').SkillConfig} */
export const config = {
  name: 'logo-creator',
  description: 'Generate brand logos via Recraft V4 (FAL.ai) and handle refinement rounds.',
  model: 'claude-sonnet-4-6',
  maxTurns: 20,
  maxBudgetUsd: 0.80,
  timeoutMs: 180_000,
  retryPolicy: {
    maxRetries: 3,
    backoffMs: 2000,
    backoffMultiplier: 2,
  },
  generation: {
    defaultCount: 4,
    maxRefinements: 3,
    imageSize: 'square_hd',
    recraftModel: 'recraft-v4',
    pollTimeoutMs: 60_000,
  },
};
