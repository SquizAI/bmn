// server/src/skills/name-generator/config.js

/** @type {import('../_shared/types.js').SkillConfig} */
export const skillConfig = {
  name: 'name-generator',
  description: 'Generate brand name suggestions with domain and trademark availability checks.',
  model: 'claude-sonnet-4-6',
  maxTurns: 12,
  maxBudgetUsd: 0.40,
  timeoutMs: 90_000,
  retryPolicy: {
    maxRetries: 2,
    backoffMs: 1000,
    backoffMultiplier: 2,
  },
  naming: {
    minSuggestions: 5,
    maxSuggestions: 10,
    domainExtensions: ['.com', '.co', '.io', '.shop', '.store'],
  },
};
