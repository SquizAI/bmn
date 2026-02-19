// server/src/skills/brand-generator/config.js

/** @type {import('../_shared/types.js').SkillConfig} */
export const skillConfig = {
  name: 'brand-generator',
  description: 'Generate a complete brand identity from social analysis -- vision, archetype, values, color palette, fonts, and logo style.',
  model: 'claude-sonnet-4-6',
  maxTurns: 12,
  maxBudgetUsd: 0.40,
  timeoutMs: 90_000,
  retryAttempts: 1,
};
