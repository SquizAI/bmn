// server/src/skills/social-analyzer/config.js

/** @type {import('../_shared/types.js').SkillConfig} */
export const skillConfig = {
  name: 'social-analyzer',
  description: 'Analyze social media profiles (Instagram, TikTok, YouTube, X/Twitter, Facebook) to extract brand DNA -- aesthetic, themes, audience, niche, readiness score, and color palette.',
  model: 'claude-sonnet-4-6',
  maxTurns: 25,
  maxBudgetUsd: 1.00,
  timeoutMs: 180_000,
  retryAttempts: 2,
};
