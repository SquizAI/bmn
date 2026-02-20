// server/src/skills/video-creator/config.js

export const skillConfig = {
  name: 'video-creator',
  description: 'Generate short product showcase videos using Google Veo 3. Phase 2 feature — currently stubbed.',
  model: 'claude-sonnet-4-6',
  maxTurns: 15,
  maxBudgetUsd: 1.50,
  timeoutMs: 300_000, // 5 minutes (video generation is slow)
  retryAttempts: 1,
};
