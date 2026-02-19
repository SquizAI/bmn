// server/src/skills/name-generator/config.js

/** @type {import('../_shared/types.js').SkillConfig} */
export const skillConfig = {
  name: 'name-generator',
  description: 'Generate creative brand name suggestions with domain availability and trademark checking.',
  model: 'claude-sonnet-4-6',
  maxTurns: 10,
  maxBudgetUsd: 0.30,
  timeoutMs: 60_000,
  retryAttempts: 1,
};
