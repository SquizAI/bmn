// server/src/skills/social-analyzer/config.js

/** @type {import('../_shared/types.js').SkillConfig} */
export const skillConfig = {
  name: 'social-analyzer',
  description: 'Analyze social media profiles (Instagram, TikTok, YouTube, X/Twitter, Facebook) to extract brand DNA -- aesthetic, themes, audience demographics, posting frequency, hashtag strategy, content formats, content tone, existing brand detection, niche, readiness score, competitors, and color palette.',
  model: 'claude-sonnet-4-6',
  maxTurns: 30,
  maxBudgetUsd: 1.50,
  timeoutMs: 240_000,
  retryAttempts: 2,
};
