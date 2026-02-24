// server/src/skills/social-analyzer/tests/handlers.test.js
//
// Unit tests for social-analyzer handlers. Verifies that each handler
// delegates to the correct tool execute method and returns the expected
// shape. Mocks external SDKs (Apify, Google AI, model router).

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('../../../config/index.js', () => ({
  config: {
    APIFY_API_TOKEN: 'test-apify-token',
    GOOGLE_API_KEY: 'test-google-key',
    NODE_ENV: 'test',
  },
}));

vi.mock('../../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../_shared/model-router.js', () => ({
  routeModel: vi.fn().mockResolvedValue({
    text: JSON.stringify({
      estimatedAgeRange: '18-34',
      ageBreakdown: [{ range: '18-24', percentage: 40 }, { range: '25-34', percentage: 45 }],
      genderSplit: { male: 45, female: 50, other: 5 },
      geographicIndicators: ['US'],
      primaryInterests: ['fitness'],
      incomeLevel: 'mid-range',
      loyaltySignals: ['high engagement'],
      confidence: 0.8,
      reasoning: 'Test reasoning',
    }),
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    usage: { inputTokens: 100, outputTokens: 200 },
  }),
}));

// ── Import handlers ──────────────────────────────────────────────────

const handlers = await import('../handlers.js');

// ── Test: Handler exports ────────────────────────────────────────────

describe('handlers module exports', () => {
  const PRD_REQUIRED_HANDLERS = [
    'scrapeInstagram',
    'scrapeTikTok',
    'scrapeFacebook',
    'analyzeAesthetic',
  ];

  const EXTENDED_HANDLERS = [
    'scrapeYouTube',
    'scrapeTwitter',
    'extractFeedPalette',
    'detectNiche',
    'calculateReadiness',
    'calculatePostingFrequency',
    'analyzeHashtagStrategy',
    'detectContentFormats',
    'detectCompetitors',
    'estimateAudienceDemographics',
    'analyzePostingFrequency',
    'analyzeHashtagStrategyAI',
    'analyzeContentFormats',
    'analyzeContentTone',
    'detectExistingBrandName',
  ];

  it('exports all PRD-required handler functions', () => {
    for (const name of PRD_REQUIRED_HANDLERS) {
      expect(handlers).toHaveProperty(name);
      expect(typeof handlers[name]).toBe('function');
    }
  });

  it('exports all extended handler functions', () => {
    for (const name of EXTENDED_HANDLERS) {
      expect(handlers).toHaveProperty(name);
      expect(typeof handlers[name]).toBe('function');
    }
  });
});

// ── Test: Scraper handlers return stubs when Apify is not installed ─

describe('scraper handlers without Apify', () => {
  it('scrapeInstagram returns stub when Apify is unavailable', async () => {
    const result = await handlers.scrapeInstagram({ handle: 'testuser' });
    // When apify-client is not installed, tools.js returns a stub response
    expect(result).toHaveProperty('success');
    expect(typeof result.success).toBe('boolean');
  });

  it('scrapeTikTok returns stub when Apify is unavailable', async () => {
    const result = await handlers.scrapeTikTok({ handle: 'testuser' });
    expect(result).toHaveProperty('success');
  });

  it('scrapeFacebook returns stub when Apify is unavailable', async () => {
    const result = await handlers.scrapeFacebook({ handle: 'testpage' });
    expect(result).toHaveProperty('success');
  });

  it('scrapeYouTube returns stub when Apify is unavailable', async () => {
    const result = await handlers.scrapeYouTube({ handle: 'testchannel' });
    expect(result).toHaveProperty('success');
  });

  it('scrapeTwitter returns stub when Apify is unavailable', async () => {
    const result = await handlers.scrapeTwitter({ handle: 'testhandle' });
    expect(result).toHaveProperty('success');
  });
});

// ── Test: Synchronous handler delegation ────────────────────────────

describe('synchronous handler delegation', () => {
  it('detectNiche delegates and returns structured result', async () => {
    const result = await handlers.detectNiche({
      bio: 'Fitness coach and trainer',
      captions: ['Morning workout', 'Gym life'],
      hashtags: ['#fitness', '#gym', '#workout'],
    });
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('primaryNiche');
    expect(result.data).toHaveProperty('secondaryNiches');
    expect(result.data).toHaveProperty('nicheClarity');
  });

  it('calculateReadiness returns score and tier', () => {
    const result = handlers.calculateReadiness({
      followerCount: 25000,
      engagementRate: 0.04,
      postingFrequency: '3-4 times per week',
      consistencyScore: 70,
      nicheClarity: 80,
      aestheticCohesion: 65,
      audienceLoyalty: 60,
    });
    expect(result.success).toBe(true);
    expect(result.data.totalScore).toBeGreaterThan(0);
    expect(['prime', 'ready', 'emerging', 'not-ready']).toContain(result.data.tier);
    expect(result.data.factors).toHaveLength(6);
    expect(result.data.summary).toBeTruthy();
  });

  it('calculatePostingFrequency returns frequency data', () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const result = handlers.calculatePostingFrequency({
      timestamps: [
        new Date(now - 3 * day).toISOString(),
        new Date(now - 2 * day).toISOString(),
        new Date(now - day).toISOString(),
        new Date(now).toISOString(),
      ],
    });
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('postsPerDay');
    expect(result.data).toHaveProperty('postsPerWeek');
    expect(result.data).toHaveProperty('consistencyPct');
  });

  it('detectCompetitors returns competitor data', () => {
    const result = handlers.detectCompetitors({
      niche: 'beauty',
      hashtags: ['#beauty', '#skincare'],
      followerCount: 10000,
    });
    expect(result.success).toBe(true);
    expect(result.data.similarCreators.length).toBeGreaterThan(0);
    expect(result.data.competingBrands.length).toBeGreaterThan(0);
  });

  it('analyzeContentFormats returns format breakdown', () => {
    const result = handlers.analyzeContentFormats({
      posts: [
        { type: 'Reel', likes: 500, comments: 20 },
        { type: 'Image', likes: 200, comments: 10 },
        { type: 'Carousel', likes: 350, comments: 25 },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('breakdown');
    expect(result.data).toHaveProperty('bestFormat');
    expect(result.data.totalPostsAnalyzed).toBe(3);
  });

  it('analyzePostingFrequency returns enhanced frequency data', () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const result = handlers.analyzePostingFrequency({
      timestamps: [
        new Date(now - 7 * day).toISOString(),
        new Date(now - 5 * day).toISOString(),
        new Date(now - 3 * day).toISOString(),
        new Date(now - 1 * day).toISOString(),
        new Date(now).toISOString(),
      ],
    });
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('postsPerWeek');
    expect(result.data).toHaveProperty('consistencyPercent');
    expect(result.data).toHaveProperty('bestDays');
    expect(result.data).toHaveProperty('bestTimes');
  });
});

// ── Test: AI-powered handler delegation ─────────────────────────────

describe('AI-powered handler delegation', () => {
  it('estimateAudienceDemographics calls routeModel and returns demographics', async () => {
    const result = await handlers.estimateAudienceDemographics({
      followers: 50000,
      bio: 'Fitness coach',
      hashtags: ['#fitness', '#gym'],
      captions: ['Working out today'],
      platform: 'instagram',
    });
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('estimatedAgeRange');
    expect(result.data).toHaveProperty('genderSplit');
  });

  it('analyzeContentTone calls routeModel and returns tone data', async () => {
    const { routeModel } = await import('../../_shared/model-router.js');
    routeModel.mockResolvedValueOnce({
      text: JSON.stringify({
        primaryTone: 'motivational',
        secondaryTones: ['educational'],
        confidence: 0.85,
        voiceDescription: 'Energetic and motivating',
        examples: [{ content: 'Push harder!', tone: 'motivational' }],
      }),
      model: 'claude-sonnet-4-6',
      provider: 'anthropic',
      usage: { inputTokens: 50, outputTokens: 100 },
    });

    const result = await handlers.analyzeContentTone({
      captions: ['Push yourself harder every day', 'Never give up on your dreams'],
      bio: 'Motivational speaker',
    });
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('primaryTone');
  });

  it('detectExistingBrandName detects LLC pattern', async () => {
    const { routeModel } = await import('../../_shared/model-router.js');
    routeModel.mockResolvedValueOnce({
      text: JSON.stringify({
        detected: true,
        brandName: 'FitLife LLC',
        confidence: 0.9,
        source: 'bio-legal-entity',
      }),
      model: 'claude-haiku-4-5',
      provider: 'anthropic',
      usage: { inputTokens: 30, outputTokens: 50 },
    });

    const result = await handlers.detectExistingBrandName({
      bio: 'Founder of FitLife LLC | Fitness Coach',
      displayName: 'Jane Doe',
      externalUrl: 'https://fitlife.com',
    });
    expect(result.success).toBe(true);
    // Heuristic should catch this before AI
    expect(result.data.detected).toBe(true);
  });
});

// ── Test: Config values match PRD ────────────────────────────────────

describe('config values match PRD spec', () => {
  it('config has correct PRD values', async () => {
    const { skillConfig } = await import('../config.js');
    expect(skillConfig.name).toBe('social-analyzer');
    expect(skillConfig.maxTurns).toBe(15);
    expect(skillConfig.maxBudgetUsd).toBe(0.50);
    expect(skillConfig.timeoutMs).toBe(120_000);
    expect(skillConfig.retryPolicy).toBeDefined();
    expect(skillConfig.retryPolicy.maxRetries).toBe(3);
    expect(skillConfig.retryPolicy.backoffMs).toBe(1000);
    expect(skillConfig.retryPolicy.backoffMultiplier).toBe(2);
  });
});

// ── Test: Index exports ──────────────────────────────────────────────

describe('index.js exports', () => {
  it('exports skill and socialAnalyzer and buildTaskPrompt', async () => {
    const indexModule = await import('../index.js');
    expect(indexModule).toHaveProperty('skill');
    expect(indexModule).toHaveProperty('socialAnalyzer');
    expect(indexModule).toHaveProperty('buildTaskPrompt');
    expect(indexModule.default).toBe(indexModule.skill);
  });

  it('socialAnalyzer has tools wired to handlers', async () => {
    const { socialAnalyzer } = await import('../index.js');
    expect(socialAnalyzer.tools).toHaveProperty('scrapeInstagram');
    expect(socialAnalyzer.tools).toHaveProperty('scrapeTikTok');
    expect(socialAnalyzer.tools).toHaveProperty('scrapeFacebook');
    expect(socialAnalyzer.tools).toHaveProperty('analyzeAesthetic');
    expect(typeof socialAnalyzer.tools.scrapeInstagram.execute).toBe('function');
    expect(typeof socialAnalyzer.tools.analyzeAesthetic.execute).toBe('function');
  });

  it('buildTaskPrompt returns a string with handles', async () => {
    const { buildTaskPrompt } = await import('../index.js');
    const result = buildTaskPrompt({
      handles: { instagram: 'testuser', tiktok: 'testuser' },
      brandId: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000002',
    });
    expect(typeof result).toBe('string');
    expect(result).toContain('instagram: testuser');
    expect(result).toContain('tiktok: testuser');
    expect(result).toContain('<user_input>');
  });
});
