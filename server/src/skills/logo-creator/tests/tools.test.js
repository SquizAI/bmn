// server/src/skills/logo-creator/tests/tools.test.js

import { describe, it, expect } from 'vitest';
import {
  ComposeLogoPromptInput,
  GenerateLogoInput,
  RefineLogoInput,
  UploadLogoAssetInput,
  SaveLogoAssetsInput,
  ComposeLogoPromptOutput,
  GenerateLogoOutput,
  RefineLogoOutput,
  UploadLogoAssetOutput,
  SaveLogoAssetsOutput,
  tools,
} from '../tools.js';

// ── ComposeLogoPromptInput Schema ────────────────────────────────

describe('ComposeLogoPromptInput schema', () => {
  const validInput = {
    variationType: 'iconMark',
    prompt: 'Professional brand logo icon mark for Sage & Soul, modern style, nurturing and wise mood',
    brandName: 'Sage & Soul',
    colors: ['#2D5F2B', '#F4A261'],
    designRationale: 'Icon mark capturing the nurturing caregiver archetype through a leaf motif',
  };

  it('should accept valid input', () => {
    const result = ComposeLogoPromptInput.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should accept all 4 variation types', () => {
    const types = ['iconMark', 'wordmark', 'combinationMark', 'abstract'];
    for (const variationType of types) {
      const result = ComposeLogoPromptInput.safeParse({ ...validInput, variationType });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid variation type', () => {
    const result = ComposeLogoPromptInput.safeParse({ ...validInput, variationType: 'emblem' });
    expect(result.success).toBe(false);
  });

  it('should reject prompt shorter than 20 chars', () => {
    const result = ComposeLogoPromptInput.safeParse({ ...validInput, prompt: 'Too short' });
    expect(result.success).toBe(false);
  });

  it('should accept null brandName', () => {
    const result = ComposeLogoPromptInput.safeParse({ ...validInput, brandName: null });
    expect(result.success).toBe(true);
  });

  it('should accept input without colors (optional)', () => {
    const { colors, ...rest } = validInput;
    const result = ComposeLogoPromptInput.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it('should reject more than 6 colors', () => {
    const result = ComposeLogoPromptInput.safeParse({
      ...validInput,
      colors: ['#000000', '#111111', '#222222', '#333333', '#444444', '#555555', '#666666'],
    });
    expect(result.success).toBe(false);
  });
});

// ── GenerateLogoInput Schema ─────────────────────────────────────

describe('GenerateLogoInput schema', () => {
  const validInput = {
    prompt: 'Professional brand logo icon mark for Sage & Soul, modern style',
    imageSize: 'square_hd',
    colors: ['#2D5F2B', '#F4A261'],
  };

  it('should accept valid input', () => {
    const result = GenerateLogoInput.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should default imageSize to square_hd', () => {
    const result = GenerateLogoInput.safeParse({ prompt: validInput.prompt });
    expect(result.success).toBe(true);
    expect(result.data.imageSize).toBe('square_hd');
  });

  it('should accept all valid image sizes', () => {
    const sizes = ['square_hd', 'square', 'landscape_4_3', 'landscape_16_9', 'portrait_4_3', 'portrait_16_9'];
    for (const imageSize of sizes) {
      const result = GenerateLogoInput.safeParse({ ...validInput, imageSize });
      expect(result.success).toBe(true);
    }
  });

  it('should reject prompt shorter than 20 chars', () => {
    const result = GenerateLogoInput.safeParse({ prompt: 'Short' });
    expect(result.success).toBe(false);
  });

  it('should accept input without colors (optional)', () => {
    const result = GenerateLogoInput.safeParse({ prompt: validInput.prompt });
    expect(result.success).toBe(true);
  });
});

// ── RefineLogoInput Schema ───────────────────────────────────────

describe('RefineLogoInput schema', () => {
  const validInput = {
    originalPrompt: 'Professional brand logo icon mark for Sage & Soul',
    refinementInstructions: 'Make the leaf shape larger and more prominent',
    refinementRound: 1,
    imageSize: 'square_hd',
    colors: ['#2D5F2B'],
  };

  it('should accept valid input', () => {
    const result = RefineLogoInput.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should accept rounds 1, 2, and 3', () => {
    for (const round of [1, 2, 3]) {
      const result = RefineLogoInput.safeParse({ ...validInput, refinementRound: round });
      expect(result.success).toBe(true);
    }
  });

  it('should reject round 0', () => {
    const result = RefineLogoInput.safeParse({ ...validInput, refinementRound: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject round 4 (max is 3)', () => {
    const result = RefineLogoInput.safeParse({ ...validInput, refinementRound: 4 });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer round', () => {
    const result = RefineLogoInput.safeParse({ ...validInput, refinementRound: 1.5 });
    expect(result.success).toBe(false);
  });
});

// ── UploadLogoAssetInput Schema ──────────────────────────────────

describe('UploadLogoAssetInput schema', () => {
  const validInput = {
    imageUrl: 'https://fal.media/files/elephant/abc123.svg',
    brandId: '550e8400-e29b-41d4-a716-446655440000',
    variationType: 'iconMark',
    metadata: {
      prompt: 'Professional brand logo icon mark',
      model: 'recraft-v4',
    },
  };

  it('should accept valid input', () => {
    const result = UploadLogoAssetInput.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should reject non-URL imageUrl', () => {
    const result = UploadLogoAssetInput.safeParse({ ...validInput, imageUrl: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('should reject non-UUID brandId', () => {
    const result = UploadLogoAssetInput.safeParse({ ...validInput, brandId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('should accept metadata with optional contentType', () => {
    const result = UploadLogoAssetInput.safeParse({
      ...validInput,
      metadata: { prompt: 'test', model: 'recraft-v4', contentType: 'image/svg+xml' },
    });
    expect(result.success).toBe(true);
  });

  it('should accept metadata with optional refinementRound', () => {
    const result = UploadLogoAssetInput.safeParse({
      ...validInput,
      metadata: { prompt: 'test', model: 'recraft-v4', refinementRound: 2 },
    });
    expect(result.success).toBe(true);
  });
});

// ── SaveLogoAssetsInput Schema ───────────────────────────────────

describe('SaveLogoAssetsInput schema', () => {
  const validLogo = {
    url: 'https://storage.supabase.co/brand-assets/logos/iconMark-123.svg',
    thumbnailUrl: null,
    variationType: 'iconMark',
    prompt: 'Professional brand logo icon mark',
    designRationale: 'Icon captures the caregiver archetype',
    model: 'recraft-v4',
    contentType: 'image/svg+xml',
  };

  const validInput = {
    brandId: '550e8400-e29b-41d4-a716-446655440000',
    userId: '550e8400-e29b-41d4-a716-446655440001',
    logos: [validLogo],
  };

  it('should accept valid input with 1 logo', () => {
    const result = SaveLogoAssetsInput.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should accept 4 logos (standard generation)', () => {
    const result = SaveLogoAssetsInput.safeParse({
      ...validInput,
      logos: [
        { ...validLogo, variationType: 'iconMark' },
        { ...validLogo, variationType: 'wordmark' },
        { ...validLogo, variationType: 'combinationMark' },
        { ...validLogo, variationType: 'abstract' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should accept up to 8 logos (with refinements)', () => {
    const logos = Array.from({ length: 8 }, (_, i) => ({
      ...validLogo,
      variationType: `variation-${i}`,
    }));
    const result = SaveLogoAssetsInput.safeParse({ ...validInput, logos });
    expect(result.success).toBe(true);
  });

  it('should reject more than 8 logos', () => {
    const logos = Array.from({ length: 9 }, (_, i) => ({
      ...validLogo,
      variationType: `variation-${i}`,
    }));
    const result = SaveLogoAssetsInput.safeParse({ ...validInput, logos });
    expect(result.success).toBe(false);
  });

  it('should reject empty logos array', () => {
    const result = SaveLogoAssetsInput.safeParse({ ...validInput, logos: [] });
    expect(result.success).toBe(false);
  });

  it('should reject non-UUID brandId', () => {
    const result = SaveLogoAssetsInput.safeParse({ ...validInput, brandId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('should reject non-UUID userId', () => {
    const result = SaveLogoAssetsInput.safeParse({ ...validInput, userId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('should reject logo with non-URL url', () => {
    const result = SaveLogoAssetsInput.safeParse({
      ...validInput,
      logos: [{ ...validLogo, url: 'not-a-url' }],
    });
    expect(result.success).toBe(false);
  });
});

// ── Output Schemas ───────────────────────────────────────────────

describe('ComposeLogoPromptOutput schema', () => {
  it('should accept valid output', () => {
    const result = ComposeLogoPromptOutput.safeParse({
      success: true,
      variationType: 'iconMark',
      prompt: 'Professional brand logo icon mark for Sage & Soul',
      designRationale: 'Captures the caregiver archetype',
    });
    expect(result.success).toBe(true);
  });
});

describe('GenerateLogoOutput schema', () => {
  it('should accept success output', () => {
    const result = GenerateLogoOutput.safeParse({
      success: true,
      imageUrl: 'https://fal.media/files/elephant/abc123.svg',
      contentType: 'image/svg+xml',
      model: 'recraft-v4',
      error: null,
    });
    expect(result.success).toBe(true);
  });

  it('should accept error output', () => {
    const result = GenerateLogoOutput.safeParse({
      success: false,
      imageUrl: null,
      contentType: null,
      model: 'recraft-v4',
      error: 'Generation timed out',
    });
    expect(result.success).toBe(true);
  });
});

describe('RefineLogoOutput schema', () => {
  it('should accept success output', () => {
    const result = RefineLogoOutput.safeParse({
      success: true,
      imageUrl: 'https://fal.media/files/elephant/abc123.svg',
      refinedPrompt: 'Original prompt. Refinement: make it bigger',
      refinementRound: 1,
      contentType: 'image/svg+xml',
      model: 'recraft-v4',
      error: null,
    });
    expect(result.success).toBe(true);
  });

  it('should accept error output for exceeded rounds', () => {
    const result = RefineLogoOutput.safeParse({
      success: false,
      imageUrl: null,
      refinedPrompt: 'original prompt',
      refinementRound: 4,
      contentType: null,
      model: 'recraft-v4',
      error: 'Maximum refinement rounds (3) exceeded',
    });
    expect(result.success).toBe(true);
  });
});

describe('UploadLogoAssetOutput schema', () => {
  it('should accept success output', () => {
    const result = UploadLogoAssetOutput.safeParse({
      success: true,
      permanentUrl: 'https://storage.supabase.co/brand-assets/logos/iconMark-123.svg',
      thumbnailUrl: null,
      storagePath: 'brands/uuid/logos/iconMark-123.svg',
      error: null,
    });
    expect(result.success).toBe(true);
  });

  it('should accept fallback output with temp URL', () => {
    const result = UploadLogoAssetOutput.safeParse({
      success: true,
      permanentUrl: 'https://fal.media/files/elephant/abc123.svg',
      thumbnailUrl: null,
      storagePath: null,
      error: 'Upload failed; returning temporary URL as fallback',
    });
    expect(result.success).toBe(true);
  });
});

describe('SaveLogoAssetsOutput schema', () => {
  it('should accept success output', () => {
    const result = SaveLogoAssetsOutput.safeParse({
      success: true,
      brandId: '550e8400-e29b-41d4-a716-446655440000',
      savedLogos: [
        { assetId: '550e8400-e29b-41d4-a716-446655440002', url: 'https://storage.supabase.co/test.svg', variationType: 'iconMark' },
      ],
      error: null,
    });
    expect(result.success).toBe(true);
  });

  it('should accept error output', () => {
    const result = SaveLogoAssetsOutput.safeParse({
      success: false,
      brandId: '550e8400-e29b-41d4-a716-446655440000',
      savedLogos: [],
      error: 'Database connection failed',
    });
    expect(result.success).toBe(true);
  });
});

// ── Tool Definitions Array ───────────────────────────────────────

describe('tools array', () => {
  it('should export exactly 5 tools', () => {
    expect(tools).toHaveLength(5);
  });

  it('should define composeLogoPrompt as first tool', () => {
    expect(tools[0].name).toBe('composeLogoPrompt');
    expect(tools[0].inputSchema).toBe(ComposeLogoPromptInput);
    expect(tools[0].outputSchema).toBe(ComposeLogoPromptOutput);
  });

  it('should define generateLogo as second tool', () => {
    expect(tools[1].name).toBe('generateLogo');
    expect(tools[1].inputSchema).toBe(GenerateLogoInput);
    expect(tools[1].outputSchema).toBe(GenerateLogoOutput);
  });

  it('should define refineLogo as third tool', () => {
    expect(tools[2].name).toBe('refineLogo');
    expect(tools[2].inputSchema).toBe(RefineLogoInput);
    expect(tools[2].outputSchema).toBe(RefineLogoOutput);
  });

  it('should define uploadLogoAsset as fourth tool', () => {
    expect(tools[3].name).toBe('uploadLogoAsset');
    expect(tools[3].inputSchema).toBe(UploadLogoAssetInput);
    expect(tools[3].outputSchema).toBe(UploadLogoAssetOutput);
  });

  it('should define saveLogoAssets as fifth tool', () => {
    expect(tools[4].name).toBe('saveLogoAssets');
    expect(tools[4].inputSchema).toBe(SaveLogoAssetsInput);
    expect(tools[4].outputSchema).toBe(SaveLogoAssetsOutput);
  });

  it('should have descriptions for all tools', () => {
    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });
});
