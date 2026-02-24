// server/src/skills/video-creator/tests/tools.test.js
//
// Unit tests for video-creator tool definitions: validates Zod input schemas,
// output schemas, and ensures the toolDefinitions array has all required entries.

import { describe, it, expect } from 'vitest';
import {
  ComposeVideoPromptInput,
  ComposeVideoPromptOutput,
  GenerateProductVideoInput,
  GenerateProductVideoOutput,
  UploadVideoAssetInput,
  UploadVideoAssetOutput,
  SaveVideoAssetsInput,
  SaveVideoAssetsOutput,
  toolDefinitions,
} from '../tools.js';

// ── Tool registry completeness ──────────────────────────────────────

describe('video-creator tool definitions', () => {
  const REQUIRED_TOOLS = [
    'composeVideoPrompt',
    'generateProductVideo',
    'uploadVideoAsset',
    'saveVideoAssets',
  ];

  it('exports exactly 4 tool definitions', () => {
    expect(toolDefinitions).toHaveLength(4);
  });

  it('exports all required tools by name', () => {
    const toolNames = toolDefinitions.map((t) => t.name);
    for (const name of REQUIRED_TOOLS) {
      expect(toolNames).toContain(name);
    }
  });

  it('every tool has name, description, and inputSchema', () => {
    for (const tool of toolDefinitions) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.inputSchema.parse).toBe('function');
    }
  });
});

// ── ComposeVideoPromptInput schema ──────────────────────────────────

describe('ComposeVideoPromptInput schema', () => {
  it('accepts valid input with all fields', () => {
    const result = ComposeVideoPromptInput.parse({
      videoType: 'product-spotlight',
      prompt: 'A sleek product rotating slowly on a white turntable with soft studio lighting',
      durationSec: 8,
      aspectRatio: '16:9',
      productName: 'Premium Mug',
    });
    expect(result.videoType).toBe('product-spotlight');
    expect(result.durationSec).toBe(8);
    expect(result.aspectRatio).toBe('16:9');
    expect(result.productName).toBe('Premium Mug');
  });

  it('applies defaults for optional fields', () => {
    const result = ComposeVideoPromptInput.parse({
      videoType: 'brand-showcase',
      prompt: 'Multiple products arranged elegantly on marble surface',
      productName: null,
    });
    expect(result.durationSec).toBe(8);
    expect(result.aspectRatio).toBe('16:9');
    expect(result.productName).toBeNull();
  });

  it('rejects invalid videoType', () => {
    expect(() =>
      ComposeVideoPromptInput.parse({
        videoType: 'music-video',
        prompt: 'A product showcase with dramatic lighting effects',
        productName: null,
      })
    ).toThrow();
  });

  it('rejects prompt shorter than 20 characters', () => {
    expect(() =>
      ComposeVideoPromptInput.parse({
        videoType: 'product-spotlight',
        prompt: 'Too short',
        productName: null,
      })
    ).toThrow();
  });

  it('rejects prompt longer than 500 characters', () => {
    expect(() =>
      ComposeVideoPromptInput.parse({
        videoType: 'product-spotlight',
        prompt: 'A'.repeat(501),
        productName: null,
      })
    ).toThrow();
  });

  it('rejects duration below 3 seconds', () => {
    expect(() =>
      ComposeVideoPromptInput.parse({
        videoType: 'product-spotlight',
        prompt: 'A valid prompt for testing duration limits',
        durationSec: 2,
        productName: null,
      })
    ).toThrow();
  });

  it('rejects duration above 16 seconds', () => {
    expect(() =>
      ComposeVideoPromptInput.parse({
        videoType: 'lifestyle',
        prompt: 'A valid prompt for testing duration limits',
        durationSec: 17,
        productName: null,
      })
    ).toThrow();
  });

  it('rejects invalid aspect ratio', () => {
    expect(() =>
      ComposeVideoPromptInput.parse({
        videoType: 'product-spotlight',
        prompt: 'A valid prompt for testing aspect ratio',
        aspectRatio: '4:3',
        productName: null,
      })
    ).toThrow();
  });

  it('accepts all valid video types', () => {
    for (const type of ['product-spotlight', 'brand-showcase', 'lifestyle']) {
      const result = ComposeVideoPromptInput.parse({
        videoType: type,
        prompt: 'A valid prompt for testing video type enum values',
        productName: null,
      });
      expect(result.videoType).toBe(type);
    }
  });

  it('accepts all valid aspect ratios', () => {
    for (const ratio of ['16:9', '9:16', '1:1']) {
      const result = ComposeVideoPromptInput.parse({
        videoType: 'product-spotlight',
        prompt: 'A valid prompt for testing aspect ratio',
        aspectRatio: ratio,
        productName: null,
      });
      expect(result.aspectRatio).toBe(ratio);
    }
  });
});

// ── GenerateProductVideoInput schema ────────────────────────────────

describe('GenerateProductVideoInput schema', () => {
  it('accepts valid input with all fields', () => {
    const result = GenerateProductVideoInput.parse({
      prompt: 'A premium mug rotating on a turntable with soft lighting',
      durationSec: 10,
      aspectRatio: '9:16',
      resolution: '1080p',
    });
    expect(result.prompt).toContain('premium mug');
    expect(result.durationSec).toBe(10);
    expect(result.resolution).toBe('1080p');
  });

  it('applies defaults for optional fields', () => {
    const result = GenerateProductVideoInput.parse({
      prompt: 'A product showcase with clean studio lighting and slow orbit',
    });
    expect(result.durationSec).toBe(8);
    expect(result.aspectRatio).toBe('16:9');
    expect(result.resolution).toBe('720p');
  });

  it('rejects prompt shorter than 20 characters', () => {
    expect(() =>
      GenerateProductVideoInput.parse({ prompt: 'short' })
    ).toThrow();
  });

  it('rejects invalid resolution', () => {
    expect(() =>
      GenerateProductVideoInput.parse({
        prompt: 'A valid prompt for testing resolution',
        resolution: '4K',
      })
    ).toThrow();
  });
});

// ── UploadVideoAssetInput schema ────────────────────────────────────

describe('UploadVideoAssetInput schema', () => {
  it('accepts valid input', () => {
    const result = UploadVideoAssetInput.parse({
      videoUrl: 'https://storage.googleapis.com/video.mp4',
      brandId: '12345678-1234-1234-1234-123456789012',
      videoType: 'product-spotlight',
      metadata: {
        prompt: 'test prompt for the video',
        model: 'veo-3',
        durationSec: 8,
        productName: 'Test Product',
      },
    });
    expect(result.brandId).toBe('12345678-1234-1234-1234-123456789012');
    expect(result.metadata.model).toBe('veo-3');
  });

  it('rejects invalid URL', () => {
    expect(() =>
      UploadVideoAssetInput.parse({
        videoUrl: 'not-a-url',
        brandId: '12345678-1234-1234-1234-123456789012',
        videoType: 'product-spotlight',
        metadata: { prompt: 'test', model: 'veo-3', durationSec: 8, productName: null },
      })
    ).toThrow();
  });

  it('rejects invalid UUID for brandId', () => {
    expect(() =>
      UploadVideoAssetInput.parse({
        videoUrl: 'https://example.com/video.mp4',
        brandId: 'not-a-uuid',
        videoType: 'product-spotlight',
        metadata: { prompt: 'test', model: 'veo-3', durationSec: 8, productName: null },
      })
    ).toThrow();
  });

  it('accepts null productName in metadata', () => {
    const result = UploadVideoAssetInput.parse({
      videoUrl: 'https://example.com/video.mp4',
      brandId: '12345678-1234-1234-1234-123456789012',
      videoType: 'brand-showcase',
      metadata: {
        prompt: 'test prompt',
        model: 'veo-3',
        durationSec: 10,
        productName: null,
      },
    });
    expect(result.metadata.productName).toBeNull();
  });
});

// ── SaveVideoAssetsInput schema ─────────────────────────────────────

describe('SaveVideoAssetsInput schema', () => {
  it('accepts valid input with one video', () => {
    const result = SaveVideoAssetsInput.parse({
      brandId: '12345678-1234-1234-1234-123456789012',
      userId: '87654321-4321-4321-4321-210987654321',
      videos: [
        {
          url: 'https://storage.example.com/video.mp4',
          thumbnailUrl: null,
          videoType: 'product-spotlight',
          durationSec: 8,
          prompt: 'Test prompt for the video generation',
          model: 'veo-3',
          productName: 'Premium Mug',
        },
      ],
    });
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].model).toBe('veo-3');
  });

  it('accepts multiple videos', () => {
    const result = SaveVideoAssetsInput.parse({
      brandId: '12345678-1234-1234-1234-123456789012',
      userId: '87654321-4321-4321-4321-210987654321',
      videos: [
        {
          url: 'https://storage.example.com/video1.mp4',
          thumbnailUrl: 'https://storage.example.com/thumb1.jpg',
          videoType: 'product-spotlight',
          durationSec: 8,
          prompt: 'First video prompt description',
          model: 'veo-3',
          productName: 'Product A',
        },
        {
          url: 'https://storage.example.com/video2.mp4',
          thumbnailUrl: null,
          videoType: 'brand-showcase',
          durationSec: 10,
          prompt: 'Second video prompt description',
          model: 'veo-3',
          productName: null,
        },
      ],
    });
    expect(result.videos).toHaveLength(2);
  });

  it('accepts empty videos array', () => {
    const result = SaveVideoAssetsInput.parse({
      brandId: '12345678-1234-1234-1234-123456789012',
      userId: '87654321-4321-4321-4321-210987654321',
      videos: [],
    });
    expect(result.videos).toHaveLength(0);
  });

  it('rejects invalid brandId', () => {
    expect(() =>
      SaveVideoAssetsInput.parse({
        brandId: 'bad-id',
        userId: '87654321-4321-4321-4321-210987654321',
        videos: [],
      })
    ).toThrow();
  });

  it('rejects invalid userId', () => {
    expect(() =>
      SaveVideoAssetsInput.parse({
        brandId: '12345678-1234-1234-1234-123456789012',
        userId: 'bad-id',
        videos: [],
      })
    ).toThrow();
  });

  it('rejects video with invalid URL', () => {
    expect(() =>
      SaveVideoAssetsInput.parse({
        brandId: '12345678-1234-1234-1234-123456789012',
        userId: '87654321-4321-4321-4321-210987654321',
        videos: [
          {
            url: 'not-a-url',
            thumbnailUrl: null,
            videoType: 'product-spotlight',
            durationSec: 8,
            prompt: 'test',
            model: 'veo-3',
            productName: null,
          },
        ],
      })
    ).toThrow();
  });
});

// ── Output schema validation ────────────────────────────────────────

describe('output schemas', () => {
  it('ComposeVideoPromptOutput validates correct shape', () => {
    const result = ComposeVideoPromptOutput.parse({
      success: true,
      videoType: 'product-spotlight',
      prompt: 'A valid composed prompt',
    });
    expect(result.success).toBe(true);
  });

  it('GenerateProductVideoOutput validates success case', () => {
    const result = GenerateProductVideoOutput.parse({
      success: true,
      videoUrl: 'https://storage.example.com/video.mp4',
      thumbnailUrl: null,
      durationSec: 8,
      model: 'veo-3',
      error: null,
    });
    expect(result.success).toBe(true);
    expect(result.model).toBe('veo-3');
  });

  it('GenerateProductVideoOutput validates error case', () => {
    const result = GenerateProductVideoOutput.parse({
      success: false,
      videoUrl: null,
      thumbnailUrl: null,
      durationSec: null,
      model: 'veo-3',
      error: 'Veo 3 API error: 500',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('500');
  });

  it('UploadVideoAssetOutput validates success case', () => {
    const result = UploadVideoAssetOutput.parse({
      success: true,
      permanentUrl: 'https://supabase.example.com/video.mp4',
      thumbnailUrl: null,
      error: null,
    });
    expect(result.success).toBe(true);
  });

  it('SaveVideoAssetsOutput validates success case', () => {
    const result = SaveVideoAssetsOutput.parse({
      success: true,
      brandId: '12345678-1234-1234-1234-123456789012',
      savedVideos: [
        { assetId: '87654321-4321-4321-4321-210987654321', url: 'https://example.com/video.mp4' },
      ],
      error: null,
    });
    expect(result.savedVideos).toHaveLength(1);
  });
});
