// server/src/skills/video-creator/tests/handlers.test.js
//
// Unit tests for video-creator handlers. Verifies feature flag gating,
// Veo 3 API calls (mocked), retry behavior, upload and save flows.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('../../../config/index.js', () => ({
  config: {
    GOOGLE_API_KEY: 'test-google-api-key',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    NODE_ENV: 'test',
  },
}));

vi.mock('../../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

// Mock the skill config with fast retry/poll for tests (0ms backoff)
vi.mock('../config.js', () => ({
  config: {
    name: 'video-creator',
    description: 'Generate product showcase videos via Veo 3 (Phase 2 feature).',
    model: 'claude-sonnet-4-6',
    maxTurns: 15,
    maxBudgetUsd: 1.00,
    timeoutMs: 300_000,
    featureFlag: 'VIDEO_GENERATION_ENABLED',
    phase: 2,
    retryPolicy: {
      maxRetries: 2,
      backoffMs: 0,           // instant for tests
      backoffMultiplier: 1,   // no escalation for tests
    },
    video: {
      defaultDurationSec: 8,
      maxDurationSec: 16,
      minDurationSec: 3,
      defaultResolution: '720p',
      defaultAspectRatio: '16:9',
      supportedAspectRatios: ['16:9', '9:16', '1:1'],
      supportedResolutions: ['720p', '1080p'],
      maxFileSize: 100 * 1024 * 1024,
      pollIntervalMs: 0,       // instant for tests
      pollMaxWaitMs: 5000,
      apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    },
    allowedTiers: ['pro', 'agency'],
  },
  skillConfig: {
    name: 'video-creator',
    description: 'Generate product showcase videos via Veo 3 (Phase 2 feature).',
    model: 'claude-sonnet-4-6',
    maxTurns: 15,
    maxBudgetUsd: 1.00,
    timeoutMs: 300_000,
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
      maxFileSize: 100 * 1024 * 1024,
      pollIntervalMs: 5000,
      pollMaxWaitMs: 120_000,
      apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    },
    allowedTiers: ['pro', 'agency'],
  },
}));

const mockSupabaseUpload = vi.fn().mockResolvedValue({ data: {}, error: null });
const mockSupabaseGetPublicUrl = vi.fn().mockReturnValue({
  data: { publicUrl: 'https://supabase.test/storage/v1/object/public/brand-assets/test.mp4' },
});
const mockSupabaseInsert = vi.fn().mockReturnValue({
  select: vi.fn().mockResolvedValue({
    data: [{ id: '11111111-1111-1111-1111-111111111111', url: 'https://supabase.test/video.mp4' }],
    error: null,
  }),
});
const mockSupabaseAuditInsert = vi.fn().mockReturnValue({
  then: vi.fn((cb) => cb({ error: null })),
});

vi.mock('../../../lib/supabase.js', () => ({
  supabaseAdmin: {
    storage: {
      from: vi.fn(() => ({
        upload: mockSupabaseUpload,
        getPublicUrl: mockSupabaseGetPublicUrl,
      })),
    },
    from: vi.fn((table) => {
      if (table === 'audit_log') {
        return { insert: mockSupabaseAuditInsert };
      }
      return { insert: mockSupabaseInsert };
    }),
  },
}));

// Save original env and fetch
const originalEnv = { ...process.env };
const originalFetch = global.fetch;

// ── Import handlers after mocks ────────────────────────────────────

const {
  composeVideoPrompt,
  generateProductVideo,
  uploadVideoAsset,
  saveVideoAssets,
} = await import('../handlers.js');

// ── Setup / Teardown ───────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv };
  delete process.env.VIDEO_GENERATION_ENABLED;
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env = originalEnv;
});

// ── composeVideoPrompt ──────────────────────────────────────────────

describe('composeVideoPrompt', () => {
  it('returns success for valid prompt', async () => {
    const result = await composeVideoPrompt({
      videoType: 'product-spotlight',
      prompt: 'A sleek product rotating slowly on a white turntable with soft studio lighting and clean background',
      durationSec: 8,
      aspectRatio: '16:9',
      productName: 'Premium Mug',
    });
    expect(result.success).toBe(true);
    expect(result.videoType).toBe('product-spotlight');
    expect(result.prompt).toContain('turntable');
  });

  it('returns failure for very short prompt (fewer than 5 words)', async () => {
    const result = await composeVideoPrompt({
      videoType: 'product-spotlight',
      prompt: 'Too short for Veo three',
      durationSec: 8,
      aspectRatio: '16:9',
      productName: null,
    });
    // "Too short for Veo three" = 5 words, should pass
    expect(result.success).toBe(true);

    const result2 = await composeVideoPrompt({
      videoType: 'product-spotlight',
      prompt: 'Just four words here',
      durationSec: 8,
      aspectRatio: '16:9',
      productName: null,
    });
    // "Just four words here" = 4 words, should fail
    expect(result2.success).toBe(false);
    expect(result2.prompt).toContain('too short');
  });
});

// ── generateProductVideo -- feature flag disabled ───────────────────

describe('generateProductVideo -- feature flag disabled', () => {
  it('returns not-available when VIDEO_GENERATION_ENABLED is unset', async () => {
    const result = await generateProductVideo({
      prompt: 'A product rotating on a turntable with studio lighting',
      durationSec: 8,
      aspectRatio: '16:9',
      resolution: '720p',
    });
    expect(result.success).toBe(false);
    expect(result.model).toBe('veo-3');
    expect(result.error).toContain('not available');
    expect(result.videoUrl).toBeNull();
  });

  it('returns not-available when VIDEO_GENERATION_ENABLED is false', async () => {
    process.env.VIDEO_GENERATION_ENABLED = 'false';
    const result = await generateProductVideo({
      prompt: 'A product rotating on a turntable with studio lighting',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not available');
  });
});

// ── generateProductVideo -- feature flag enabled ────────────────────

describe('generateProductVideo -- feature flag enabled', () => {
  beforeEach(() => {
    process.env.VIDEO_GENERATION_ENABLED = 'true';
  });

  it('calls Veo 3 API and returns direct result', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        generatedVideos: [
          {
            video: {
              uri: 'https://storage.googleapis.com/generated-video.mp4',
              thumbnail: { uri: 'https://storage.googleapis.com/thumb.jpg' },
            },
          },
        ],
      }),
    });

    const result = await generateProductVideo({
      prompt: 'A premium coffee mug rotating on a turntable with warm studio lighting',
      durationSec: 8,
      aspectRatio: '16:9',
      resolution: '720p',
    });

    expect(result.success).toBe(true);
    expect(result.videoUrl).toBe('https://storage.googleapis.com/generated-video.mp4');
    expect(result.thumbnailUrl).toBe('https://storage.googleapis.com/thumb.jpg');
    expect(result.durationSec).toBe(8);
    expect(result.model).toBe('veo-3');
    expect(result.error).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('handles async operation polling', async () => {
    // First call returns operation name
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ name: 'operations/video-123' }),
      })
      // First poll -- not done
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ done: false }),
      })
      // Second poll -- done
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          done: true,
          response: {
            generatedVideos: [
              {
                video: {
                  uri: 'https://storage.googleapis.com/polled-video.mp4',
                  thumbnail: { uri: 'https://storage.googleapis.com/polled-thumb.jpg' },
                },
              },
            ],
          },
        }),
      });

    global.fetch = fetchMock;

    const result = await generateProductVideo({
      prompt: 'A product showcase with dramatic side lighting and slow orbit',
      durationSec: 10,
      aspectRatio: '16:9',
      resolution: '720p',
    });

    expect(result.success).toBe(true);
    expect(result.videoUrl).toBe('https://storage.googleapis.com/polled-video.mp4');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('returns error on HTTP failure after retries', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Internal Server Error'),
    });

    const result = await generateProductVideo({
      prompt: 'A product with studio lighting that triggers server error',
      durationSec: 8,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Veo 3 API error: 500');
    // 1 initial + 2 retries = 3 calls
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('returns error on network failure after retries', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await generateProductVideo({
      prompt: 'A product that causes a network failure during generation',
      durationSec: 8,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
  });

  it('retries on content moderation rejection (SAFETY)', async () => {
    const fetchMock = vi.fn()
      // First attempt: safety rejection
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('SAFETY: content blocked'),
      })
      // Second attempt: success
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          generatedVideos: [
            {
              video: { uri: 'https://storage.googleapis.com/retry-video.mp4' },
            },
          ],
        }),
      });

    global.fetch = fetchMock;

    const result = await generateProductVideo({
      prompt: 'A product that initially triggers safety filter but works on retry',
      durationSec: 8,
    });

    expect(result.success).toBe(true);
    expect(result.videoUrl).toBe('https://storage.googleapis.com/retry-video.mp4');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on rate limiting (429)', async () => {
    const fetchMock = vi.fn()
      // First attempt: rate limited
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue('Rate limited'),
      })
      // Second attempt: success
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          generatedVideos: [
            {
              video: { uri: 'https://storage.googleapis.com/rate-limit-video.mp4' },
            },
          ],
        }),
      });

    global.fetch = fetchMock;

    const result = await generateProductVideo({
      prompt: 'A product video request that hits rate limit then succeeds',
      durationSec: 8,
    });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sends correct API request structure', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        generatedVideos: [
          { video: { uri: 'https://storage.googleapis.com/video.mp4' } },
        ],
      }),
    });

    await generateProductVideo({
      prompt: 'A product rotating slowly on a clean white background',
      durationSec: 10,
      aspectRatio: '9:16',
      resolution: '1080p',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/veo-3:generateVideo',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-goog-api-key': 'test-google-api-key',
        }),
      })
    );

    const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(requestBody.prompt).toContain('rotating slowly');
    expect(requestBody.videoConfig.durationSeconds).toBe(10);
    expect(requestBody.videoConfig.aspectRatio).toBe('9:16');
    expect(requestBody.videoConfig.resolution).toBe('1080p');
    expect(requestBody.videoConfig.personGeneration).toBe('dont_allow');
  });
});

// ── uploadVideoAsset ────────────────────────────────────────────────

describe('uploadVideoAsset', () => {
  it('downloads video and uploads to Supabase Storage', async () => {
    const videoBuffer = Buffer.from('fake-video-content');
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(videoBuffer.buffer),
    });

    const result = await uploadVideoAsset({
      videoUrl: 'https://storage.googleapis.com/temp-video.mp4',
      brandId: '12345678-1234-1234-1234-123456789012',
      videoType: 'product-spotlight',
      metadata: {
        prompt: 'Test prompt for video upload',
        model: 'veo-3',
        durationSec: 8,
        productName: 'Test Product',
      },
    });

    expect(result.success).toBe(true);
    expect(result.permanentUrl).toContain('supabase.test');
    expect(result.error).toBeNull();
    expect(mockSupabaseUpload).toHaveBeenCalledTimes(1);
  });

  it('returns error when video download fails', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const result = await uploadVideoAsset({
      videoUrl: 'https://storage.googleapis.com/missing-video.mp4',
      brandId: '12345678-1234-1234-1234-123456789012',
      videoType: 'product-spotlight',
      metadata: { prompt: 'test', model: 'veo-3', durationSec: 8, productName: null },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to download');
  });

  it('returns error when Supabase upload fails', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(Buffer.from('data').buffer),
    });

    mockSupabaseUpload.mockResolvedValueOnce({
      data: null,
      error: { message: 'Storage quota exceeded' },
    });

    const result = await uploadVideoAsset({
      videoUrl: 'https://storage.googleapis.com/video.mp4',
      brandId: '12345678-1234-1234-1234-123456789012',
      videoType: 'product-spotlight',
      metadata: { prompt: 'test', model: 'veo-3', durationSec: 8, productName: null },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Storage quota exceeded');
  });

  it('returns error when fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Connection refused'));

    const result = await uploadVideoAsset({
      videoUrl: 'https://unreachable.example.com/video.mp4',
      brandId: '12345678-1234-1234-1234-123456789012',
      videoType: 'product-spotlight',
      metadata: { prompt: 'test', model: 'veo-3', durationSec: 8, productName: null },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Connection refused');
  });
});

// ── saveVideoAssets ─────────────────────────────────────────────────

describe('saveVideoAssets', () => {
  it('inserts video records and returns saved IDs', async () => {
    const result = await saveVideoAssets({
      brandId: '12345678-1234-1234-1234-123456789012',
      userId: '87654321-4321-4321-4321-210987654321',
      videos: [
        {
          url: 'https://supabase.test/video.mp4',
          thumbnailUrl: null,
          videoType: 'product-spotlight',
          durationSec: 8,
          prompt: 'Test prompt for save',
          model: 'veo-3',
          productName: 'Premium Mug',
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.brandId).toBe('12345678-1234-1234-1234-123456789012');
    expect(result.savedVideos).toHaveLength(1);
    expect(result.savedVideos[0].assetId).toBe('11111111-1111-1111-1111-111111111111');
    expect(result.error).toBeNull();
  });

  it('returns error when insert fails', async () => {
    mockSupabaseInsert.mockReturnValueOnce({
      select: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Unique constraint violation' },
      }),
    });

    const result = await saveVideoAssets({
      brandId: '12345678-1234-1234-1234-123456789012',
      userId: '87654321-4321-4321-4321-210987654321',
      videos: [
        {
          url: 'https://supabase.test/video.mp4',
          thumbnailUrl: null,
          videoType: 'product-spotlight',
          durationSec: 8,
          prompt: 'test',
          model: 'veo-3',
          productName: null,
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unique constraint');
    expect(result.savedVideos).toHaveLength(0);
  });

  it('handles empty videos array gracefully', async () => {
    mockSupabaseInsert.mockReturnValueOnce({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const result = await saveVideoAssets({
      brandId: '12345678-1234-1234-1234-123456789012',
      userId: '87654321-4321-4321-4321-210987654321',
      videos: [],
    });

    expect(result.success).toBe(true);
    expect(result.savedVideos).toHaveLength(0);
  });
});

// ── Config values match PRD spec ────────────────────────────────────

describe('config values match PRD spec', () => {
  it('config has correct PRD values', async () => {
    const { skillConfig } = await import('../config.js');
    expect(skillConfig.name).toBe('video-creator');
    expect(skillConfig.maxTurns).toBe(15);
    expect(skillConfig.maxBudgetUsd).toBe(1.00);
    expect(skillConfig.timeoutMs).toBe(300_000);
    expect(skillConfig.featureFlag).toBe('VIDEO_GENERATION_ENABLED');
    expect(skillConfig.phase).toBe(2);
    expect(skillConfig.retryPolicy).toBeDefined();
    expect(skillConfig.retryPolicy.maxRetries).toBe(2);
    expect(skillConfig.retryPolicy.backoffMs).toBe(3000);
    expect(skillConfig.retryPolicy.backoffMultiplier).toBe(2);
  });

  it('video config has correct defaults', async () => {
    const { skillConfig } = await import('../config.js');
    expect(skillConfig.video.defaultDurationSec).toBe(8);
    expect(skillConfig.video.maxDurationSec).toBe(16);
    expect(skillConfig.video.defaultResolution).toBe('720p');
    expect(skillConfig.video.defaultAspectRatio).toBe('16:9');
  });

  it('only Pro+ tiers are allowed', async () => {
    const { skillConfig } = await import('../config.js');
    expect(skillConfig.allowedTiers).toContain('pro');
    expect(skillConfig.allowedTiers).toContain('agency');
    expect(skillConfig.allowedTiers).not.toContain('starter');
    expect(skillConfig.allowedTiers).not.toContain('free');
  });
});

// ── Index exports ───────────────────────────────────────────────────

describe('index.js exports', () => {
  it('exports skill and videoCreator and buildTaskPrompt', async () => {
    const indexModule = await import('../index.js');
    expect(indexModule).toHaveProperty('skill');
    expect(indexModule).toHaveProperty('videoCreator');
    expect(indexModule).toHaveProperty('buildTaskPrompt');
    expect(indexModule.default).toBe(indexModule.skill);
  });

  it('videoCreator has tools wired to handlers', async () => {
    const { videoCreator } = await import('../index.js');
    expect(videoCreator.tools).toHaveProperty('composeVideoPrompt');
    expect(videoCreator.tools).toHaveProperty('generateProductVideo');
    expect(videoCreator.tools).toHaveProperty('uploadVideoAsset');
    expect(videoCreator.tools).toHaveProperty('saveVideoAssets');
    expect(typeof videoCreator.tools.composeVideoPrompt.execute).toBe('function');
    expect(typeof videoCreator.tools.generateProductVideo.execute).toBe('function');
    expect(typeof videoCreator.tools.uploadVideoAsset.execute).toBe('function');
    expect(typeof videoCreator.tools.saveVideoAssets.execute).toBe('function');
  });

  it('buildTaskPrompt returns a string with brand and product data', async () => {
    const { buildTaskPrompt } = await import('../index.js');
    const result = buildTaskPrompt({
      brandIdentity: {
        brandName: 'TestBrand',
        archetype: 'Creator',
        colorPalette: { colors: ['#FF0000', '#00FF00', '#0000FF'] },
        voiceTone: 'Bold and creative',
      },
      products: [
        { name: 'Premium Mug', mockupUrl: 'https://example.com/mug.png' },
        { name: 'T-Shirt', mockupUrl: null },
      ],
      videoTypes: ['product-spotlight', 'brand-showcase'],
      brandId: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000002',
    });
    expect(typeof result).toBe('string');
    expect(result).toContain('TestBrand');
    expect(result).toContain('Creator');
    expect(result).toContain('Premium Mug');
    expect(result).toContain('product-spotlight');
    expect(result).toContain('<user_input>');
  });

  it('skill has correct feature flag and phase', async () => {
    const { skill } = await import('../index.js');
    expect(skill.featureFlag).toBe('VIDEO_GENERATION_ENABLED');
    expect(skill.phase).toBe(2);
    expect(skill.steps).toContain('video-generation');
  });
});
