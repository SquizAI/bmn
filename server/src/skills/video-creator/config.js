// server/src/skills/video-creator/config.js

/**
 * Video Creator skill configuration.
 *
 * Phase 2 feature gated by VIDEO_GENERATION_ENABLED environment variable.
 * Uses Veo 3 (Google AI) for video generation; Claude Sonnet 4.6 for reasoning.
 *
 * @type {import('../_shared/types.js').SkillConfig}
 */
export const skillConfig = {
  name: 'video-creator',
  description: 'Generate product showcase videos via Veo 3 (Phase 2 feature).',
  model: 'claude-sonnet-4-6',
  maxTurns: 15,
  maxBudgetUsd: 1.00,
  timeoutMs: 300_000, // 5 minutes -- video generation is slow
  featureFlag: 'VIDEO_GENERATION_ENABLED',
  phase: 2,
  retryPolicy: {
    maxRetries: 2,
    backoffMs: 3000,
    backoffMultiplier: 2,
  },
  video: {
    defaultDurationSec: 8,
    maxDurationSec: 16,
    minDurationSec: 3,
    defaultResolution: '720p',
    defaultAspectRatio: '16:9',
    supportedAspectRatios: ['16:9', '9:16', '1:1'],
    supportedResolutions: ['720p', '1080p'],
    maxFileSize: 100 * 1024 * 1024, // 100MB
    pollIntervalMs: 5000,
    pollMaxWaitMs: 120_000,
    apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
  /** @type {string[]} Subscription tiers that can access video generation */
  allowedTiers: ['pro', 'agency'],
};

// Re-export as both `skillConfig` and `config` for backward compatibility
export const config = skillConfig;
