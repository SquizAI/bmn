// server/src/skills/brand-generator/config.js

/** @type {import('../_shared/types.js').SkillConfig} */
export const config = {
  name: 'brand-generator',
  description: 'Generate a complete brand identity from social analysis data and user preferences.',
  model: 'claude-sonnet-4-6',
  maxTurns: 10,
  maxBudgetUsd: 0.30,
  timeoutMs: 60_000,
  retryPolicy: {
    maxRetries: 2,
    backoffMs: 1000,
    backoffMultiplier: 2,
  },
};
