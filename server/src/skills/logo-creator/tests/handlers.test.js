// server/src/skills/logo-creator/tests/handlers.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  composeLogoPrompt,
  generateLogo,
  refineLogo,
  uploadLogoAsset,
  saveLogoAssets,
} from '../handlers.js';

// ── Mock Supabase ────────────────────────────────────────────────

const mockStorageUpload = vi.fn().mockResolvedValue({ data: {}, error: null });
const mockStorageGetPublicUrl = vi.fn().mockReturnValue({
  data: { publicUrl: 'https://storage.supabase.co/brand-assets/brands/uuid/logos/test.svg' },
});
const mockBrandAssetsInsert = vi.fn().mockReturnValue({
  select: vi.fn().mockResolvedValue({
    data: [
      { id: '550e8400-e29b-41d4-a716-446655440010', url: 'https://storage.supabase.co/test.svg', metadata: { variationType: 'iconMark' } },
    ],
    error: null,
  }),
});
const mockBrandsUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  }),
});
const mockAuditLogInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock('../../../lib/supabase.js', () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        getPublicUrl: mockStorageGetPublicUrl,
      }),
    },
    from: (table) => {
      if (table === 'brand_assets') return { insert: mockBrandAssetsInsert };
      if (table === 'brands') return { update: mockBrandsUpdate };
      if (table === 'audit_log') return { insert: mockAuditLogInsert };
      return {};
    },
  },
}));

// ── Mock recraftClient ───────────────────────────────────────────

const mockGenerateVector = vi.fn();

vi.mock('../../../services/providers.js', () => ({
  recraftClient: {
    generateVector: (...args) => mockGenerateVector(...args),
  },
}));

// ── Mock logger ──────────────────────────────────────────────────

vi.mock('../../../lib/logger.js', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// ── Mock fetch (for image downloads in uploadLogoAsset) ──────────

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
});

// ── composeLogoPrompt ────────────────────────────────────────────

describe('composeLogoPrompt', () => {
  it('should return structured output with success: true', async () => {
    const result = await composeLogoPrompt({
      variationType: 'iconMark',
      prompt: 'Professional brand logo icon mark for Sage & Soul',
      brandName: 'Sage & Soul',
      designRationale: 'Leaf motif for caregiver archetype',
    });

    expect(result.success).toBe(true);
    expect(result.variationType).toBe('iconMark');
    expect(result.prompt).toBe('Professional brand logo icon mark for Sage & Soul');
    expect(result.designRationale).toBe('Leaf motif for caregiver archetype');
  });

  it('should pass through all fields unchanged', async () => {
    const input = {
      variationType: 'abstract',
      prompt: 'Abstract artistic interpretation of growth and wellness',
      brandName: null,
      designRationale: 'Abstract shapes represent transformation',
    };
    const result = await composeLogoPrompt(input);
    expect(result.variationType).toBe(input.variationType);
    expect(result.prompt).toBe(input.prompt);
    expect(result.designRationale).toBe(input.designRationale);
  });
});

// ── generateLogo ─────────────────────────────────────────────────

describe('generateLogo', () => {
  it('should return success with imageUrl when Recraft succeeds', async () => {
    mockGenerateVector.mockResolvedValueOnce({
      imageUrl: 'https://fal.media/files/elephant/abc123.svg',
      contentType: 'image/svg+xml',
      fileSize: 12345,
    });

    const result = await generateLogo({
      prompt: 'Professional brand logo icon mark for Sage & Soul',
      imageSize: 'square_hd',
      colors: ['#2D5F2B'],
    });

    expect(result.success).toBe(true);
    expect(result.imageUrl).toBe('https://fal.media/files/elephant/abc123.svg');
    expect(result.contentType).toBe('image/svg+xml');
    expect(result.model).toBe('recraft-v4');
    expect(result.error).toBeNull();
  });

  it('should return error when Recraft returns no imageUrl', async () => {
    mockGenerateVector.mockResolvedValueOnce({
      imageUrl: null,
      contentType: null,
      fileSize: 0,
    });

    const result = await generateLogo({
      prompt: 'Professional brand logo test prompt here',
      imageSize: 'square_hd',
    });

    expect(result.success).toBe(false);
    expect(result.imageUrl).toBeNull();
    expect(result.error).toContain('no image URL');
  });

  it('should handle Recraft API errors gracefully', async () => {
    mockGenerateVector.mockRejectedValueOnce(new Error('FAL queue submit failed: 429'));

    const result = await generateLogo({
      prompt: 'Professional brand logo test prompt here',
      imageSize: 'square_hd',
    });

    expect(result.success).toBe(false);
    expect(result.imageUrl).toBeNull();
    expect(result.error).toContain('429');
  });

  it('should pass colors to recraftClient when provided', async () => {
    mockGenerateVector.mockResolvedValueOnce({
      imageUrl: 'https://fal.media/files/elephant/abc123.svg',
      contentType: 'image/svg+xml',
      fileSize: 12345,
    });

    await generateLogo({
      prompt: 'Professional brand logo test prompt here',
      imageSize: 'square_hd',
      colors: ['#2D5F2B', '#F4A261'],
    });

    expect(mockGenerateVector).toHaveBeenCalledWith({
      prompt: 'Professional brand logo test prompt here',
      image_size: 'square_hd',
      colors: ['#2D5F2B', '#F4A261'],
    });
  });
});

// ── refineLogo ───────────────────────────────────────────────────

describe('refineLogo', () => {
  it('should generate with a modified prompt and return refinement metadata', async () => {
    mockGenerateVector.mockResolvedValueOnce({
      imageUrl: 'https://fal.media/files/elephant/refined123.svg',
      contentType: 'image/svg+xml',
      fileSize: 14000,
    });

    const result = await refineLogo({
      originalPrompt: 'Professional brand logo icon mark for Sage & Soul',
      refinementInstructions: 'Make the leaf larger and more prominent',
      refinementRound: 1,
      imageSize: 'square_hd',
      colors: ['#2D5F2B'],
    });

    expect(result.success).toBe(true);
    expect(result.imageUrl).toBe('https://fal.media/files/elephant/refined123.svg');
    expect(result.refinedPrompt).toContain('Make the leaf larger');
    expect(result.refinementRound).toBe(1);
  });

  it('should reject refinement round exceeding max (3)', async () => {
    const result = await refineLogo({
      originalPrompt: 'Professional brand logo icon mark',
      refinementInstructions: 'Some change',
      refinementRound: 4,
      imageSize: 'square_hd',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Maximum refinement rounds');
    // Should NOT call the Recraft API
    expect(mockGenerateVector).not.toHaveBeenCalled();
  });

  it('should accept round 3 (the maximum)', async () => {
    mockGenerateVector.mockResolvedValueOnce({
      imageUrl: 'https://fal.media/files/elephant/r3.svg',
      contentType: 'image/svg+xml',
      fileSize: 12000,
    });

    const result = await refineLogo({
      originalPrompt: 'Professional brand logo test prompt here',
      refinementInstructions: 'Final refinement round',
      refinementRound: 3,
      imageSize: 'square_hd',
    });

    expect(result.success).toBe(true);
    expect(result.refinementRound).toBe(3);
  });

  it('should build additive prompt (original + refinement)', async () => {
    mockGenerateVector.mockResolvedValueOnce({
      imageUrl: 'https://fal.media/files/elephant/test.svg',
      contentType: 'image/svg+xml',
      fileSize: 12000,
    });

    const result = await refineLogo({
      originalPrompt: 'Original prompt text here for testing',
      refinementInstructions: 'Make it simpler',
      refinementRound: 1,
      imageSize: 'square_hd',
    });

    expect(result.refinedPrompt).toBe('Original prompt text here for testing. Refinement: Make it simpler');
  });
});

// ── uploadLogoAsset ──────────────────────────────────────────────

describe('uploadLogoAsset', () => {
  const validInput = {
    imageUrl: 'https://fal.media/files/elephant/abc123.svg',
    brandId: '550e8400-e29b-41d4-a716-446655440000',
    variationType: 'iconMark',
    metadata: {
      prompt: 'Professional brand logo icon mark',
      model: 'recraft-v4',
      contentType: 'image/svg+xml',
    },
  };

  it('should download, upload, and return permanent URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(100),
      headers: new Map([['content-type', 'image/svg+xml']]),
    });

    const result = await uploadLogoAsset(validInput);

    expect(result.success).toBe(true);
    expect(result.permanentUrl).toContain('storage.supabase.co');
    expect(result.storagePath).not.toBeNull();
    expect(result.error).toBeNull();
  });

  it('should fallback to temp URL when download fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await uploadLogoAsset(validInput);

    expect(result.success).toBe(true);
    expect(result.permanentUrl).toBe(validInput.imageUrl);
    expect(result.error).toContain('Download failed');
  });

  it('should fallback to temp URL when Supabase upload fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(100),
      headers: new Map([['content-type', 'image/svg+xml']]),
    });
    mockStorageUpload.mockResolvedValueOnce({ data: null, error: { message: 'Bucket full' } });

    const result = await uploadLogoAsset(validInput);

    expect(result.success).toBe(true);
    expect(result.permanentUrl).toBe(validInput.imageUrl);
    expect(result.error).toContain('Bucket full');
  });

  it('should handle fetch exceptions gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

    const result = await uploadLogoAsset(validInput);

    expect(result.success).toBe(true);
    expect(result.permanentUrl).toBe(validInput.imageUrl);
    expect(result.error).toContain('Network timeout');
  });

  it('should not generate thumbnailUrl for SVG content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(100),
      headers: new Map([['content-type', 'image/svg+xml']]),
    });

    const result = await uploadLogoAsset(validInput);

    expect(result.thumbnailUrl).toBeNull();
  });
});

// ── saveLogoAssets ───────────────────────────────────────────────

describe('saveLogoAssets', () => {
  const validInput = {
    brandId: '550e8400-e29b-41d4-a716-446655440000',
    userId: '550e8400-e29b-41d4-a716-446655440001',
    logos: [
      {
        url: 'https://storage.supabase.co/brand-assets/logos/iconMark-123.svg',
        thumbnailUrl: null,
        variationType: 'iconMark',
        prompt: 'Professional brand logo icon mark',
        designRationale: 'Leaf motif for caregiver archetype',
        model: 'recraft-v4',
        contentType: 'image/svg+xml',
      },
    ],
  };

  it('should save logos and return savedLogos array', async () => {
    const result = await saveLogoAssets(validInput);

    expect(result.success).toBe(true);
    expect(result.brandId).toBe(validInput.brandId);
    expect(result.savedLogos).toHaveLength(1);
    expect(result.savedLogos[0].assetId).toBeDefined();
    expect(result.savedLogos[0].variationType).toBe('iconMark');
    expect(result.error).toBeNull();
  });

  it('should call brand_assets insert with correct data', async () => {
    await saveLogoAssets(validInput);

    expect(mockBrandAssetsInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          brand_id: validInput.brandId,
          asset_type: 'logo',
          url: validInput.logos[0].url,
          is_selected: false,
          metadata: expect.objectContaining({
            variationType: 'iconMark',
            model: 'recraft-v4',
          }),
        }),
      ])
    );
  });

  it('should update brand wizard_step', async () => {
    await saveLogoAssets(validInput);

    expect(mockBrandsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        wizard_step: 'logo-refinement',
      })
    );
  });

  it('should write an audit log entry', async () => {
    await saveLogoAssets(validInput);

    expect(mockAuditLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: validInput.userId,
        action: 'logos_generated',
        resource_type: 'brand',
        resource_id: validInput.brandId,
      })
    );
  });

  it('should return error when brand_assets insert fails', async () => {
    mockBrandAssetsInsert.mockReturnValueOnce({
      select: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'RLS policy violation' },
      }),
    });

    const result = await saveLogoAssets(validInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe('RLS policy violation');
    expect(result.savedLogos).toHaveLength(0);
  });

  it('should handle thrown exceptions gracefully', async () => {
    mockBrandAssetsInsert.mockImplementationOnce(() => {
      throw new Error('Connection refused');
    });

    const result = await saveLogoAssets(validInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection refused');
  });
});
