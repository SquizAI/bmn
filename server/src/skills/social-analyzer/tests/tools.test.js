// server/src/skills/social-analyzer/tests/tools.test.js
//
// Unit tests for social-analyzer tool definitions: validates Zod input schemas,
// synchronous tool execution (detectNiche, calculateReadiness,
// calculatePostingFrequency, analyzeHashtagStrategy, detectContentFormats),
// and ensures the tools object has all required entries.

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
    text: '{}',
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    usage: { inputTokens: 10, outputTokens: 10 },
  }),
}));

// ── Import tools ─────────────────────────────────────────────────────

const { tools } = await import('../tools.js');

// ── Test: Tool registry completeness ────────────────────────────────

describe('social-analyzer tools', () => {
  const PRD_REQUIRED_TOOLS = [
    'scrapeInstagram',
    'scrapeTikTok',
    'scrapeFacebook',
    'analyzeAesthetic',
  ];

  const EXTENDED_TOOLS = [
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

  it('exports all PRD-required tools', () => {
    for (const toolName of PRD_REQUIRED_TOOLS) {
      expect(tools).toHaveProperty(toolName);
      expect(tools[toolName]).toHaveProperty('name', toolName);
      expect(tools[toolName]).toHaveProperty('description');
      expect(tools[toolName]).toHaveProperty('inputSchema');
      expect(tools[toolName]).toHaveProperty('execute');
      expect(typeof tools[toolName].execute).toBe('function');
    }
  });

  it('exports all extended tools', () => {
    for (const toolName of EXTENDED_TOOLS) {
      expect(tools).toHaveProperty(toolName);
      expect(tools[toolName]).toHaveProperty('name', toolName);
      expect(tools[toolName]).toHaveProperty('execute');
    }
  });

  it('every tool has a Zod inputSchema with .parse()', () => {
    for (const [name, tool] of Object.entries(tools)) {
      expect(tool.inputSchema, `${name} missing inputSchema`).toBeDefined();
      expect(typeof tool.inputSchema.parse, `${name} inputSchema.parse is not a function`).toBe('function');
    }
  });
});

// ── Test: Zod input schema validation ─────────────────────────────

describe('Zod input schemas', () => {
  it('scrapeInstagram rejects empty handle', () => {
    expect(() => tools.scrapeInstagram.inputSchema.parse({ handle: '' })).toThrow();
  });

  it('scrapeInstagram accepts valid handle', () => {
    const result = tools.scrapeInstagram.inputSchema.parse({ handle: 'coffeeshopjane' });
    expect(result.handle).toBe('coffeeshopjane');
  });

  it('scrapeInstagram rejects handle with special characters', () => {
    expect(() => tools.scrapeInstagram.inputSchema.parse({ handle: 'coffee shop!' })).toThrow();
  });

  it('scrapeTikTok accepts valid handle', () => {
    const result = tools.scrapeTikTok.inputSchema.parse({ handle: 'johndoe' });
    expect(result.handle).toBe('johndoe');
  });

  it('scrapeFacebook accepts valid handle', () => {
    const result = tools.scrapeFacebook.inputSchema.parse({ handle: 'mybrandpage' });
    expect(result.handle).toBe('mybrandpage');
  });

  it('analyzeAesthetic requires at least 3 image URLs', () => {
    expect(() => tools.analyzeAesthetic.inputSchema.parse({ imageUrls: ['https://example.com/a.jpg'] })).toThrow();
  });

  it('analyzeAesthetic accepts 3+ valid URLs', () => {
    const urls = [
      'https://example.com/a.jpg',
      'https://example.com/b.jpg',
      'https://example.com/c.jpg',
    ];
    const result = tools.analyzeAesthetic.inputSchema.parse({ imageUrls: urls });
    expect(result.imageUrls).toHaveLength(3);
  });

  it('detectNiche accepts valid input', () => {
    const result = tools.detectNiche.inputSchema.parse({
      bio: 'Fitness enthusiast',
      captions: ['Working out today!'],
      hashtags: ['#fitness', '#gym'],
    });
    expect(result.bio).toBe('Fitness enthusiast');
  });

  it('calculateReadiness accepts valid metrics', () => {
    const result = tools.calculateReadiness.inputSchema.parse({
      followerCount: 10000,
      engagementRate: 0.045,
      postingFrequency: 'daily',
      consistencyScore: 75,
      nicheClarity: 80,
      aestheticCohesion: 70,
      audienceLoyalty: 60,
    });
    expect(result.followerCount).toBe(10000);
  });

  it('calculatePostingFrequency requires at least 2 timestamps', () => {
    expect(() => tools.calculatePostingFrequency.inputSchema.parse({ timestamps: ['2024-01-01'] })).toThrow();
  });
});

// ── Test: Synchronous tool execution ─────────────────────────────

describe('detectNiche execution', () => {
  it('detects fitness niche from hashtags', async () => {
    const result = await tools.detectNiche.execute({
      bio: 'Personal trainer | Fitness coach',
      captions: ['Hit the gym today', 'Workout routine', 'Morning exercise'],
      hashtags: ['#fitness', '#gym', '#workout', '#fitfam', '#exercise', '#gym', '#fitness', '#fitness'],
    });
    expect(result.success).toBe(true);
    expect(result.data.primaryNiche.name).toBe('fitness');
    expect(result.data.primaryNiche.confidence).toBeGreaterThan(0);
  });

  it('falls back to lifestyle when no niche is clear', async () => {
    const result = await tools.detectNiche.execute({
      bio: null,
      captions: ['Hello world'],
      hashtags: [],
    });
    expect(result.success).toBe(true);
    expect(result.data.primaryNiche.name).toBe('lifestyle');
    expect(result.data.primaryNiche.confidence).toBeLessThanOrEqual(0.3);
  });

  it('returns secondary niches when detected', async () => {
    const result = await tools.detectNiche.execute({
      bio: 'Fashion and beauty blogger',
      captions: ['New outfit', 'Skincare routine', 'OOTD today'],
      hashtags: ['#fashion', '#beauty', '#ootd', '#skincare', '#style', '#makeup', '#fashion', '#beauty'],
    });
    expect(result.success).toBe(true);
    expect(result.data.secondaryNiches.length).toBeGreaterThan(0);
  });
});

describe('calculateReadiness execution', () => {
  it('returns a valid readiness score', () => {
    const result = tools.calculateReadiness.execute({
      followerCount: 50000,
      engagementRate: 0.045,
      postingFrequency: 'daily',
      consistencyScore: 80,
      nicheClarity: 85,
      aestheticCohesion: 75,
      audienceLoyalty: 70,
    });
    expect(result.success).toBe(true);
    expect(result.data.totalScore).toBeGreaterThan(0);
    expect(result.data.totalScore).toBeLessThanOrEqual(100);
    expect(['prime', 'ready', 'emerging', 'not-ready']).toContain(result.data.tier);
    expect(result.data.factors).toHaveLength(6);
  });

  it('classifies low-follower accounts as not-ready or emerging', () => {
    const result = tools.calculateReadiness.execute({
      followerCount: 100,
      engagementRate: 0.01,
      postingFrequency: 'less than weekly',
      consistencyScore: 20,
      nicheClarity: 20,
      aestheticCohesion: 20,
      audienceLoyalty: 20,
    });
    expect(result.success).toBe(true);
    expect(['not-ready', 'emerging']).toContain(result.data.tier);
  });

  it('handles null optional fields', () => {
    const result = tools.calculateReadiness.execute({
      followerCount: 5000,
      engagementRate: null,
      postingFrequency: null,
      consistencyScore: null,
      nicheClarity: 50,
      aestheticCohesion: null,
      audienceLoyalty: null,
    });
    expect(result.success).toBe(true);
    expect(result.data.totalScore).toBeGreaterThan(0);
  });
});

describe('calculatePostingFrequency execution', () => {
  it('calculates frequency from valid timestamps', () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const timestamps = [
      new Date(now - 6 * day).toISOString(),
      new Date(now - 5 * day).toISOString(),
      new Date(now - 4 * day).toISOString(),
      new Date(now - 3 * day).toISOString(),
      new Date(now - 2 * day).toISOString(),
      new Date(now - 1 * day).toISOString(),
      new Date(now).toISOString(),
    ];
    const result = tools.calculatePostingFrequency.execute({ timestamps });
    expect(result.success).toBe(true);
    expect(result.data.postsPerDay).toBeGreaterThan(0);
    expect(result.data.postsPerWeek).toBeGreaterThan(0);
    expect(result.data.consistencyPct).toBeGreaterThan(0);
    expect(result.data.peakDays).toBeDefined();
    expect(result.data.peakHours).toBeDefined();
  });

  it('returns error for insufficient timestamps', () => {
    const result = tools.calculatePostingFrequency.execute({ timestamps: ['2024-01-01T00:00:00Z'] });
    expect(result.success).toBe(false);
    expect(result.error).toContain('at least 2');
  });
});

describe('detectContentFormats execution', () => {
  it('detects format distribution', () => {
    const posts = [
      { type: 'Reel', likes: 500, comments: 20 },
      { type: 'Reel', likes: 400, comments: 15 },
      { type: 'Image', likes: 200, comments: 10 },
      { type: 'Sidecar', likes: 350, comments: 25 },
      { type: 'Video', likes: 600, comments: 30 },
    ];
    const result = tools.detectContentFormats.execute({ posts });
    expect(result.success).toBe(true);
    expect(result.data.formatDistribution).toBeDefined();
    expect(result.data.bestPerformingFormat).toBeDefined();
    expect(result.data.totalPostsAnalyzed).toBe(5);
  });
});

describe('detectCompetitors execution', () => {
  it('returns competitors for a known niche', () => {
    const result = tools.detectCompetitors.execute({
      niche: 'fitness',
      hashtags: ['#fitness', '#gym'],
      followerCount: 50000,
    });
    expect(result.success).toBe(true);
    expect(result.data.similarCreators.length).toBeGreaterThan(0);
    expect(result.data.competingBrands.length).toBeGreaterThan(0);
    expect(result.data.opportunities.length).toBeGreaterThan(0);
  });

  it('falls back to lifestyle for unknown niche', () => {
    const result = tools.detectCompetitors.execute({
      niche: 'underwater-basket-weaving',
      hashtags: [],
      followerCount: 1000,
    });
    expect(result.success).toBe(true);
    expect(result.data.similarCreators.length).toBeGreaterThan(0);
  });
});

describe('analyzeHashtagStrategy execution', () => {
  it('analyzes hashtag frequency and diversity', () => {
    const posts = [
      { hashtags: ['#fitness', '#gym', '#workout'], likes: 500, comments: 20 },
      { hashtags: ['#fitness', '#health', '#motivation'], likes: 400, comments: 15 },
      { hashtags: ['#gym', '#gains', '#fitfam'], likes: 300, comments: 10 },
    ];
    const result = tools.analyzeHashtagStrategy.execute({ posts, detectedNiche: 'fitness' });
    expect(result.success).toBe(true);
    expect(result.data.topHashtags.length).toBeGreaterThan(0);
    expect(result.data.hashtagDiversityScore).toBeGreaterThan(0);
    expect(result.data.totalUniqueHashtags).toBeGreaterThan(0);
  });

  it('returns empty data for posts with no hashtags', () => {
    const result = tools.analyzeHashtagStrategy.execute({ posts: [{ hashtags: [] }] });
    expect(result.success).toBe(true);
    expect(result.data.topHashtags).toEqual([]);
    expect(result.data.hashtagDiversityScore).toBe(0);
  });
});
