// server/src/skills/mockup-renderer/tests/tools.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GenerateProductMockupInput,
  GenerateTextOnProductInput,
  ComposeBundleImageInput,
  UploadMockupAssetInput,
  SaveMockupAssetsInput,
  GenerateProductMockupOutput,
  GenerateTextOnProductOutput,
  ComposeBundleImageOutput,
  UploadMockupAssetOutput,
  SaveMockupAssetsOutput,
  tools,
} from '../tools.js';

// ── Tool Definitions ─────────────────────────────────────────────

describe('tool definitions', () => {
  it('should export exactly 5 tools', () => {
    assert.equal(tools.length, 5);
  });

  it('should have correct tool names in PRD order', () => {
    const names = tools.map((t) => t.name);
    assert.deepEqual(names, [
      'generateProductMockup',
      'generateTextOnProduct',
      'composeBundleImage',
      'uploadMockupAsset',
      'saveMockupAssets',
    ]);
  });

  it('should have descriptions for all tools', () => {
    for (const tool of tools) {
      assert.ok(tool.description.length > 0, `Tool ${tool.name} should have a description`);
    }
  });

  it('should have input schemas for all tools', () => {
    for (const tool of tools) {
      assert.ok(tool.inputSchema, `Tool ${tool.name} should have an inputSchema`);
      assert.equal(typeof tool.inputSchema.parse, 'function', `Tool ${tool.name} inputSchema should be a Zod schema`);
    }
  });

  it('should have output schemas for all tools', () => {
    for (const tool of tools) {
      assert.ok(tool.outputSchema, `Tool ${tool.name} should have an outputSchema`);
      assert.equal(typeof tool.outputSchema.parse, 'function', `Tool ${tool.name} outputSchema should be a Zod schema`);
    }
  });
});

// ── GenerateProductMockupInput ───────────────────────────────────

describe('GenerateProductMockupInput', () => {
  it('should accept valid input with all fields', () => {
    const result = GenerateProductMockupInput.safeParse({
      prompt: 'Professional product photography of a white cotton t-shirt with logo centered on chest',
      productSku: 'TEE-001',
      productName: 'Classic T-Shirt',
      logoUrl: 'https://storage.supabase.co/logos/test.png',
      size: '1024x1024',
      quality: 'hd',
    });
    assert.ok(result.success, 'Should parse valid input');
  });

  it('should provide default size and quality', () => {
    const result = GenerateProductMockupInput.safeParse({
      prompt: 'Professional product photography of a white cotton t-shirt',
      productSku: 'TEE-001',
      productName: 'Classic T-Shirt',
      logoUrl: 'https://example.com/logo.png',
    });
    assert.ok(result.success);
    assert.equal(result.data.size, '1024x1024');
    assert.equal(result.data.quality, 'hd');
  });

  it('should reject prompt shorter than 20 characters', () => {
    const result = GenerateProductMockupInput.safeParse({
      prompt: 'too short',
      productSku: 'TEE-001',
      productName: 'T-Shirt',
      logoUrl: 'https://example.com/logo.png',
    });
    assert.ok(!result.success, 'Should reject short prompt');
  });

  it('should reject invalid logo URL', () => {
    const result = GenerateProductMockupInput.safeParse({
      prompt: 'A sufficiently long prompt for testing purposes',
      productSku: 'TEE-001',
      productName: 'T-Shirt',
      logoUrl: 'not-a-url',
    });
    assert.ok(!result.success, 'Should reject invalid URL');
  });

  it('should accept all valid size options', () => {
    const sizes = ['1024x1024', '1024x1536', '1536x1024'];
    for (const size of sizes) {
      const result = GenerateProductMockupInput.safeParse({
        prompt: 'A sufficiently long prompt for testing purposes',
        productSku: 'TEE-001',
        productName: 'T-Shirt',
        logoUrl: 'https://example.com/logo.png',
        size,
      });
      assert.ok(result.success, `Should accept size: ${size}`);
    }
  });

  it('should reject invalid size', () => {
    const result = GenerateProductMockupInput.safeParse({
      prompt: 'A sufficiently long prompt for testing purposes',
      productSku: 'TEE-001',
      productName: 'T-Shirt',
      logoUrl: 'https://example.com/logo.png',
      size: '512x512',
    });
    assert.ok(!result.success, 'Should reject invalid size');
  });
});

// ── GenerateTextOnProductInput ───────────────────────────────────

describe('GenerateTextOnProductInput', () => {
  it('should accept valid input with all fields', () => {
    const result = GenerateTextOnProductInput.safeParse({
      prompt: '"Sage & Soul" brand name in elegant serif font on premium kraft paper box lid',
      brandText: 'Sage & Soul',
      productSku: 'BOX-001',
      productName: 'Premium Box',
      aspectRatio: '1:1',
      styleType: 'realistic',
    });
    assert.ok(result.success);
  });

  it('should provide defaults for aspectRatio and styleType', () => {
    const result = GenerateTextOnProductInput.safeParse({
      prompt: '"Brand Name" text on a glass candle jar label',
      brandText: 'Brand Name',
      productSku: 'JAR-001',
      productName: 'Candle Jar',
    });
    assert.ok(result.success);
    assert.equal(result.data.aspectRatio, '1:1');
    assert.equal(result.data.styleType, 'realistic');
  });

  it('should accept all valid aspect ratios', () => {
    const ratios = ['1:1', '4:3', '3:4', '16:9', '9:16'];
    for (const ratio of ratios) {
      const result = GenerateTextOnProductInput.safeParse({
        prompt: 'A sufficiently long prompt for text on product testing',
        brandText: 'Test',
        productSku: 'TST-001',
        productName: 'Test Product',
        aspectRatio: ratio,
      });
      assert.ok(result.success, `Should accept aspectRatio: ${ratio}`);
    }
  });

  it('should accept all valid style types', () => {
    const styles = ['general', 'realistic', 'design', 'render_3d', 'anime'];
    for (const style of styles) {
      const result = GenerateTextOnProductInput.safeParse({
        prompt: 'A sufficiently long prompt for text on product testing',
        brandText: 'Test',
        productSku: 'TST-001',
        productName: 'Test Product',
        styleType: style,
      });
      assert.ok(result.success, `Should accept styleType: ${style}`);
    }
  });

  it('should reject missing brandText', () => {
    const result = GenerateTextOnProductInput.safeParse({
      prompt: 'A sufficiently long prompt for text on product testing',
      productSku: 'BOX-001',
      productName: 'Premium Box',
    });
    assert.ok(!result.success, 'Should reject missing brandText');
  });
});

// ── ComposeBundleImageInput ──────────────────────────────────────

describe('ComposeBundleImageInput', () => {
  it('should accept valid input', () => {
    const result = ComposeBundleImageInput.safeParse({
      prompt: 'Professional flat-lay product photography showing branded items arranged together',
      bundleName: 'Starter Kit',
      productDescriptions: ['White t-shirt with logo', 'Ceramic mug with logo'],
      referenceImageUrls: ['https://example.com/tee.png', 'https://example.com/mug.png'],
    });
    assert.ok(result.success);
  });

  it('should reject prompt shorter than 20 characters', () => {
    const result = ComposeBundleImageInput.safeParse({
      prompt: 'too short',
      bundleName: 'Kit',
      productDescriptions: ['item 1'],
      referenceImageUrls: ['https://example.com/a.png'],
    });
    assert.ok(!result.success);
  });

  it('should reject invalid reference image URLs', () => {
    const result = ComposeBundleImageInput.safeParse({
      prompt: 'A sufficiently long prompt for bundle composition testing',
      bundleName: 'Kit',
      productDescriptions: ['item 1'],
      referenceImageUrls: ['not-a-url'],
    });
    assert.ok(!result.success);
  });
});

// ── UploadMockupAssetInput ───────────────────────────────────────

describe('UploadMockupAssetInput', () => {
  it('should accept URL imageSource', () => {
    const result = UploadMockupAssetInput.safeParse({
      imageSource: 'https://oaidalleapiprodscus.blob.core.windows.net/image.png',
      brandId: '550e8400-e29b-41d4-a716-446655440000',
      assetType: 'mockup',
      productSku: 'TEE-001',
      bundleName: null,
      metadata: { prompt: 'test prompt', model: 'gpt-image-1.5', productName: 'T-Shirt' },
    });
    assert.ok(result.success);
  });

  it('should accept base64 imageSource', () => {
    const result = UploadMockupAssetInput.safeParse({
      imageSource: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk',
      brandId: '550e8400-e29b-41d4-a716-446655440000',
      assetType: 'bundle',
      productSku: null,
      bundleName: 'Starter Kit',
      metadata: { prompt: 'test prompt', model: 'gemini-3-pro-image', productName: null },
    });
    assert.ok(result.success);
  });

  it('should reject invalid brandId', () => {
    const result = UploadMockupAssetInput.safeParse({
      imageSource: 'https://example.com/img.png',
      brandId: 'not-a-uuid',
      assetType: 'mockup',
      productSku: null,
      bundleName: null,
      metadata: { prompt: 'test', model: 'test', productName: null },
    });
    assert.ok(!result.success);
  });

  it('should accept only mockup or bundle asset types', () => {
    for (const assetType of ['mockup', 'bundle']) {
      const result = UploadMockupAssetInput.safeParse({
        imageSource: 'https://example.com/img.png',
        brandId: '550e8400-e29b-41d4-a716-446655440000',
        assetType,
        productSku: null,
        bundleName: null,
        metadata: { prompt: 'test', model: 'test', productName: null },
      });
      assert.ok(result.success, `Should accept assetType: ${assetType}`);
    }
  });

  it('should reject invalid asset type', () => {
    const result = UploadMockupAssetInput.safeParse({
      imageSource: 'https://example.com/img.png',
      brandId: '550e8400-e29b-41d4-a716-446655440000',
      assetType: 'logo',
      productSku: null,
      bundleName: null,
      metadata: { prompt: 'test', model: 'test', productName: null },
    });
    assert.ok(!result.success, 'Should reject asset type "logo"');
  });
});

// ── SaveMockupAssetsInput ────────────────────────────────────────

describe('SaveMockupAssetsInput', () => {
  it('should accept valid input with multiple mockups', () => {
    const result = SaveMockupAssetsInput.safeParse({
      brandId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '660e8400-e29b-41d4-a716-446655440000',
      mockups: [
        {
          url: 'https://storage.supabase.co/mockups/tee.png',
          thumbnailUrl: 'https://storage.supabase.co/mockups/tee.png?width=256',
          productSku: 'TEE-001',
          bundleName: null,
          assetType: 'mockup',
          prompt: 'T-shirt mockup prompt',
          model: 'gpt-image-1.5',
          productName: 'Classic T-Shirt',
        },
        {
          url: 'https://storage.supabase.co/mockups/bundle.png',
          thumbnailUrl: null,
          productSku: null,
          bundleName: 'Starter Kit',
          assetType: 'bundle',
          prompt: 'Bundle composition prompt',
          model: 'gemini-3-pro-image',
          productName: null,
        },
      ],
    });
    assert.ok(result.success);
  });

  it('should reject invalid UUIDs', () => {
    const result = SaveMockupAssetsInput.safeParse({
      brandId: 'not-a-uuid',
      userId: 'also-not-uuid',
      mockups: [],
    });
    assert.ok(!result.success);
  });

  it('should accept empty mockups array', () => {
    const result = SaveMockupAssetsInput.safeParse({
      brandId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '660e8400-e29b-41d4-a716-446655440000',
      mockups: [],
    });
    assert.ok(result.success);
  });
});

// ── Output Schema Validation ─────────────────────────────────────

describe('output schemas', () => {
  it('GenerateProductMockupOutput should validate success response', () => {
    const result = GenerateProductMockupOutput.safeParse({
      success: true,
      imageUrl: 'https://oaidalleapiprodscus.blob.core.windows.net/image.png',
      revisedPrompt: 'A revised version of the prompt',
      model: 'gpt-image-1.5',
      error: null,
    });
    assert.ok(result.success);
  });

  it('GenerateProductMockupOutput should validate error response', () => {
    const result = GenerateProductMockupOutput.safeParse({
      success: false,
      imageUrl: null,
      revisedPrompt: null,
      model: 'gpt-image-1.5',
      error: 'Content policy violation',
    });
    assert.ok(result.success);
  });

  it('GenerateTextOnProductOutput should validate success response', () => {
    const result = GenerateTextOnProductOutput.safeParse({
      success: true,
      imageUrl: 'https://api.ideogram.ai/image/abc123.png',
      model: 'ideogram-v3',
      error: null,
    });
    assert.ok(result.success);
  });

  it('ComposeBundleImageOutput should validate success response', () => {
    const result = ComposeBundleImageOutput.safeParse({
      success: true,
      imageBase64: 'iVBORw0KGgoAAAANSUhEUg...',
      mimeType: 'image/png',
      model: 'gemini-3-pro-image',
      error: null,
    });
    assert.ok(result.success);
  });

  it('ComposeBundleImageOutput should validate error response', () => {
    const result = ComposeBundleImageOutput.safeParse({
      success: false,
      imageBase64: null,
      mimeType: null,
      model: 'gemini-3-pro-image',
      error: 'Gemini composition failed',
    });
    assert.ok(result.success);
  });

  it('UploadMockupAssetOutput should validate success response', () => {
    const result = UploadMockupAssetOutput.safeParse({
      success: true,
      permanentUrl: 'https://storage.supabase.co/brand-assets/brands/123/mockups/tee.png',
      thumbnailUrl: 'https://storage.supabase.co/brand-assets/brands/123/mockups/tee.png?width=256',
      error: null,
    });
    assert.ok(result.success);
  });

  it('SaveMockupAssetsOutput should validate success response', () => {
    const result = SaveMockupAssetsOutput.safeParse({
      success: true,
      brandId: '550e8400-e29b-41d4-a716-446655440000',
      savedMockups: [
        {
          assetId: '770e8400-e29b-41d4-a716-446655440000',
          url: 'https://storage.supabase.co/mockups/tee.png',
          productSku: 'TEE-001',
          assetType: 'mockup',
        },
      ],
      error: null,
    });
    assert.ok(result.success);
  });

  it('SaveMockupAssetsOutput should validate error response', () => {
    const result = SaveMockupAssetsOutput.safeParse({
      success: false,
      brandId: '550e8400-e29b-41d4-a716-446655440000',
      savedMockups: [],
      error: 'Database insert failed',
    });
    assert.ok(result.success);
  });
});
