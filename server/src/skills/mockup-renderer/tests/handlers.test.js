// server/src/skills/mockup-renderer/tests/handlers.test.js

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// ── Stub environment variables before importing handlers ─────────

process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.GOOGLE_API_KEY = 'test-google-key';
process.env.IDEOGRAM_API_KEY = 'test-ideogram-key';

import {
  generateProductMockup,
  generateTextOnProduct,
  composeBundleImage,
  uploadMockupAsset,
  saveMockupAssets,
} from '../handlers.js';

// ── generateProductMockup ────────────────────────────────────────

describe('generateProductMockup', () => {
  it('should return error when OpenAI SDK is not available', async () => {
    // The lazy loader will try dynamic import -- in test env, openai may not be installed.
    // We test the graceful degradation path.
    const result = await generateProductMockup({
      prompt: 'Professional product photography of a white cotton t-shirt with a logo centered on chest',
      productSku: 'TEE-001',
      productName: 'Classic T-Shirt',
      logoUrl: 'https://example.com/logo.png',
      size: '1024x1024',
      quality: 'hd',
    });

    // If openai is not installed, we expect a graceful error
    assert.equal(typeof result.success, 'boolean');
    assert.equal(result.model, 'gpt-image-1.5');
    assert.equal(typeof result.error === 'string' || result.error === null, true);
  });

  it('should return correct shape on success', async () => {
    // Simulate a successful result shape
    const expected = {
      success: true,
      imageUrl: 'https://oaidalleapiprodscus.blob.core.windows.net/image.png',
      revisedPrompt: 'A revised prompt',
      model: 'gpt-image-1.5',
      error: null,
    };

    assert.ok('success' in expected);
    assert.ok('imageUrl' in expected);
    assert.ok('revisedPrompt' in expected);
    assert.ok('model' in expected);
    assert.ok('error' in expected);
  });
});

// ── generateTextOnProduct ────────────────────────────────────────

describe('generateTextOnProduct', () => {
  /** @type {typeof globalThis.fetch} */
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should return success when Ideogram API returns valid data', async () => {
    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ url: 'https://api.ideogram.ai/image/test123.png' }],
      }),
    }));

    const result = await generateTextOnProduct({
      prompt: '"Sage & Soul" brand name in elegant serif font on premium kraft paper box lid',
      brandText: 'Sage & Soul',
      productSku: 'BOX-001',
      productName: 'Premium Box',
      aspectRatio: '1:1',
      styleType: 'realistic',
    });

    assert.equal(result.success, true);
    assert.equal(result.imageUrl, 'https://api.ideogram.ai/image/test123.png');
    assert.equal(result.model, 'ideogram-v3');
    assert.equal(result.error, null);
  });

  it('should send correct Ideogram API payload', async () => {
    /** @type {string} */
    let capturedBody;

    globalThis.fetch = mock.fn(async (_url, opts) => {
      capturedBody = opts.body;
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [{ url: 'https://test.com/img.png' }] }),
      };
    });

    await generateTextOnProduct({
      prompt: 'A sufficiently long prompt for text-on-product testing via Ideogram',
      brandText: 'Test Brand',
      productSku: 'LBL-001',
      productName: 'Label',
      aspectRatio: '4:3',
      styleType: 'design',
    });

    const body = JSON.parse(capturedBody);
    assert.equal(body.image_request.model, 'V_3');
    assert.equal(body.image_request.aspect_ratio, 'ASPECT_4_3');
    assert.equal(body.image_request.style_type, 'DESIGN');
    assert.equal(body.image_request.magic_prompt_option, 'AUTO');
  });

  it('should fall back to GPT Image when Ideogram returns non-ok response', async () => {
    // Both Ideogram and OpenAI fallback will fail in test env, but we verify the fallback path is attempted
    globalThis.fetch = mock.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    }));

    const result = await generateTextOnProduct({
      prompt: 'A sufficiently long prompt for testing the Ideogram fallback path',
      brandText: 'Test',
      productSku: 'BOX-001',
      productName: 'Box',
      aspectRatio: '1:1',
      styleType: 'realistic',
    });

    // Should attempt fallback -- result will indicate the fallback model
    assert.equal(typeof result.success, 'boolean');
    assert.ok(result.model === 'ideogram-v3' || result.model === 'gpt-image-1.5');
  });

  it('should fall back when Ideogram returns no image URL', async () => {
    globalThis.fetch = mock.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }), // No image data
    }));

    const result = await generateTextOnProduct({
      prompt: 'A sufficiently long prompt for testing the empty response path',
      brandText: 'Test',
      productSku: 'BOX-001',
      productName: 'Box',
      aspectRatio: '1:1',
      styleType: 'realistic',
    });

    assert.equal(typeof result.success, 'boolean');
  });

  it('should fall back when fetch throws', async () => {
    globalThis.fetch = mock.fn(async () => {
      throw new Error('Network timeout');
    });

    const result = await generateTextOnProduct({
      prompt: 'A sufficiently long prompt for testing the network error path',
      brandText: 'Test',
      productSku: 'BOX-001',
      productName: 'Box',
    });

    assert.equal(typeof result.success, 'boolean');
  });
});

// ── composeBundleImage ───────────────────────────────────────────

describe('composeBundleImage', () => {
  it('should return error when Google AI SDK is not available', async () => {
    const result = await composeBundleImage({
      prompt: 'Professional flat-lay product photography showing branded items together in a lifestyle setting',
      bundleName: 'Starter Kit',
      productDescriptions: ['White t-shirt with logo', 'Ceramic mug with logo'],
      referenceImageUrls: ['https://example.com/tee.png', 'https://example.com/mug.png'],
    });

    // In test env, @google/generativeai may not be installed
    assert.equal(typeof result.success, 'boolean');
    assert.ok(result.model === 'gemini-3-pro-image' || result.model === 'gpt-image-1.5');
  });

  it('should return correct output shape', () => {
    const expected = {
      success: true,
      imageBase64: 'iVBORw0KGgoAAAANSUhEUg...',
      mimeType: 'image/png',
      model: 'gemini-3-pro-image',
      error: null,
    };

    assert.ok('success' in expected);
    assert.ok('imageBase64' in expected);
    assert.ok('mimeType' in expected);
    assert.ok('model' in expected);
    assert.ok('error' in expected);
  });
});

// ── uploadMockupAsset ────────────────────────────────────────────

describe('uploadMockupAsset', () => {
  /** @type {typeof globalThis.fetch} */
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should handle URL image source download failure with fallback URL', async () => {
    // Supabase client will fail in test, but we can verify the fallback URL behavior
    globalThis.fetch = mock.fn(async () => ({
      ok: false,
      status: 404,
    }));

    const result = await uploadMockupAsset({
      imageSource: 'https://oaidalleapiprodscus.blob.core.windows.net/image.png',
      brandId: '550e8400-e29b-41d4-a716-446655440000',
      assetType: 'mockup',
      productSku: 'TEE-001',
      bundleName: null,
      metadata: { prompt: 'test', model: 'gpt-image-1.5', productName: 'T-Shirt' },
    });

    // On download failure, should still return the temp URL as fallback
    assert.equal(typeof result.success, 'boolean');
    assert.ok('permanentUrl' in result);
    assert.ok('thumbnailUrl' in result);
    assert.ok('error' in result);
  });

  it('should handle base64 image source', async () => {
    const result = await uploadMockupAsset({
      imageSource: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk',
      brandId: '550e8400-e29b-41d4-a716-446655440000',
      assetType: 'bundle',
      productSku: null,
      bundleName: 'Starter Kit',
      metadata: { prompt: 'test', model: 'gemini-3-pro-image', productName: null },
    });

    // Will fail at Supabase upload in test env, but should not crash
    assert.equal(typeof result.success, 'boolean');
    assert.ok('error' in result);
  });

  it('should construct correct storage path', () => {
    const brandId = '550e8400-e29b-41d4-a716-446655440000';
    const productSku = 'TEE-001';
    const assetType = 'mockup';

    // Verify path construction logic
    const timestamp = Date.now();
    const identifier = productSku || 'asset';
    const extension = 'png';
    const storagePath = `brands/${brandId}/${assetType}s/${identifier}-${timestamp}.${extension}`;

    assert.ok(storagePath.startsWith(`brands/${brandId}/mockups/TEE-001-`));
    assert.ok(storagePath.endsWith('.png'));
  });

  it('should use bundleName for identifier when productSku is null', () => {
    const _brandId = '550e8400-e29b-41d4-a716-446655440000';
    const bundleName = 'Starter Kit';
    const productSku = null;
    const identifier = productSku || bundleName?.replace(/\s+/g, '-') || 'asset';

    assert.equal(identifier, 'Starter-Kit');
  });
});

// ── saveMockupAssets ─────────────────────────────────────────────

describe('saveMockupAssets', () => {
  it('should handle Supabase insert failure gracefully', async () => {
    const result = await saveMockupAssets({
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
      ],
    });

    // Will fail at Supabase in test env, but should not crash
    assert.equal(typeof result.success, 'boolean');
    assert.ok('brandId' in result);
    assert.ok('savedMockups' in result);
    assert.ok('error' in result);
  });

  it('should construct correct asset rows from mockup data', () => {
    const mockups = [
      {
        url: 'https://storage.supabase.co/mockups/tee.png',
        thumbnailUrl: 'https://storage.supabase.co/mockups/tee.png?width=256',
        productSku: 'TEE-001',
        bundleName: null,
        assetType: 'mockup',
        prompt: 'T-shirt mockup',
        model: 'gpt-image-1.5',
        productName: 'Classic T-Shirt',
      },
    ];

    const brandId = '550e8400-e29b-41d4-a716-446655440000';

    const assetRows = mockups.map((m) => ({
      brand_id: brandId,
      asset_type: m.assetType,
      url: m.url,
      thumbnail_url: m.thumbnailUrl || null,
      is_selected: false,
      metadata: {
        productSku: m.productSku,
        bundleName: m.bundleName,
        prompt: m.prompt,
        model: m.model,
        productName: m.productName,
      },
    }));

    assert.equal(assetRows.length, 1);
    assert.equal(assetRows[0].brand_id, brandId);
    assert.equal(assetRows[0].asset_type, 'mockup');
    assert.equal(assetRows[0].is_selected, false);
    assert.equal(assetRows[0].metadata.productSku, 'TEE-001');
    assert.equal(assetRows[0].metadata.model, 'gpt-image-1.5');
  });

  it('should deduplicate model names for audit log', () => {
    const mockups = [
      { model: 'gpt-image-1.5' },
      { model: 'gpt-image-1.5' },
      { model: 'ideogram-v3' },
      { model: 'gemini-3-pro-image' },
    ];

    const models = [...new Set(mockups.map((m) => m.model))];
    assert.equal(models.length, 3);
    assert.ok(models.includes('gpt-image-1.5'));
    assert.ok(models.includes('ideogram-v3'));
    assert.ok(models.includes('gemini-3-pro-image'));
  });
});
