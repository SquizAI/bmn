// server/src/skills/social-analyzer/config.js

/** @type {import('../_shared/types.js').SkillConfig} */
export const skillConfig = {
  name: 'social-analyzer',
  description: 'Analyze social media profiles to extract brand DNA -- aesthetic, themes, audience, engagement patterns.',
  model: 'claude-sonnet-4-6',
  maxTurns: 15,
  maxBudgetUsd: 0.50,
  timeoutMs: 120_000,
  retryAttempts: 2,
};
