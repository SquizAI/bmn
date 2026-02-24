// server/src/__tests__/providers.test.js
//
// Unit tests for the direct-fetch provider clients (falClient, recraftClient,
// ideogramClient) from ../services/providers.js. Mocks global fetch to avoid
// real HTTP calls during testing.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

// Mock config to provide fake API keys
vi.mock('../config/index.js', () => ({
  config: {
    FAL_API_KEY: 'test-fal-key-123',
    IDEOGRAM_API_KEY: 'test-ideogram-key-456',
    ANTHROPIC_API_KEY: 'test-anthropic-key',
    OPENAI_API_KEY: 'test-openai-key',
    GOOGLE_API_KEY: 'test-google-key',
    NODE_ENV: 'test',
  },
}));

// Mock the SDK imports that happen at the top level in providers.js
// They may not be installed in the test environment
vi.mock('@anthropic-ai/sdk', () => {
  throw new Error('Not installed');
});
vi.mock('openai', () => {
  throw new Error('Not installed');
});
vi.mock('@google/generativeai', () => {
  throw new Error('Not installed');
});

// Now import the provider clients
const { falClient, recraftClient, ideogramClient } = await import(
  '../services/providers.js'
);

// ── Helpers ──────────────────────────────────────────────────────────

/** Create a mock Response object for fetch */
function mockFetchResponse(data, options = {}) {
  const { ok = true, status = 200 } = options;
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

/**
 * Create a mock fetch that simulates the FAL.ai Queue API 3-step flow:
 *   1. Submit (POST queue.fal.run/<model>) -> { request_id }
 *   2. Poll status (GET .../status) -> { status: 'COMPLETED' }
 *   3. Fetch result (GET .../requests/<id>) -> final data
 *
 * @param {Object} resultData - The final response payload from step 3
 * @param {Object} [options]
 * @param {string} [options.requestId='test-req-123'] - The request_id returned by step 1
 * @returns {import('vitest').Mock} - A vi.fn() mock for globalThis.fetch
 */
function mockFalQueueFetch(resultData, options = {}) {
  const { requestId = 'test-req-123' } = options;
  return vi.fn()
    // Step 1: Submit -> returns request_id
    .mockResolvedValueOnce(mockFetchResponse({ request_id: requestId }))
    // Step 2: Poll status -> COMPLETED immediately
    .mockResolvedValueOnce(mockFetchResponse({ status: 'COMPLETED' }))
    // Step 3: Fetch result -> the actual model output
    .mockResolvedValueOnce(mockFetchResponse(resultData));
}

/**
 * Create a mock fetch that fails on the submit step (step 1).
 * @param {Object} errorBody - Error response body
 * @param {number} status - HTTP status code
 * @returns {import('vitest').Mock}
 */
function mockFalQueueSubmitError(errorBody, status) {
  return vi.fn().mockResolvedValueOnce(
    mockFetchResponse(errorBody, { ok: false, status })
  );
}

// ── Tests ────────────────────────────────────────────────────────────

describe('recraftClient', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  /**
   * Helper to run a recraftClient call with fake timers.
   * Starts the async operation, immediately attaches a no-op catch
   * (to prevent unhandled rejection warnings), advances timers so
   * the polling setTimeout resolves, then returns the original promise
   * so the caller can still assert on rejection.
   */
  async function runWithTimers(asyncFn) {
    const promise = asyncFn();
    // Prevent unhandled rejection warning while timers advance
    promise.catch(() => {});
    // Advance past the poll interval (2000ms) so the setTimeout resolves
    await vi.advanceTimersByTimeAsync(3000);
    return promise;
  }

  describe('generateVector()', () => {
    it('should return imageUrl and contentType on success', async () => {
      globalThis.fetch = mockFalQueueFetch({
        images: [
          {
            url: 'https://fal.run/result/logo.svg',
            content_type: 'image/svg+xml',
            file_size: 12345,
          },
        ],
      });

      const result = await runWithTimers(() =>
        recraftClient.generateVector({ prompt: 'A modern minimalist logo' })
      );

      expect(result.imageUrl).toBe('https://fal.run/result/logo.svg');
      expect(result.contentType).toBe('image/svg+xml');
      expect(result.fileSize).toBe(12345);
    });

    it('should call the correct Recraft V4 endpoint via FAL queue', async () => {
      globalThis.fetch = mockFalQueueFetch({
        images: [{ url: 'https://fal.run/result/test.svg', content_type: 'image/svg+xml' }],
      });

      await runWithTimers(() =>
        recraftClient.generateVector({ prompt: 'Test logo' })
      );

      // First call is the queue submit
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://queue.fal.run/fal-ai/recraft/v4/text-to-vector',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Key test-fal-key-123',
          }),
        })
      );
    });

    it('should pass brand colors as RGB objects', async () => {
      globalThis.fetch = mockFalQueueFetch({
        images: [{ url: 'https://fal.run/result/colored.svg' }],
      });

      await runWithTimers(() =>
        recraftClient.generateVector({
          prompt: 'Logo with colors',
          colors: ['#FF0000', '#00FF00'],
        })
      );

      // First call (index 0) is the submit; check its body
      const callBody = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
      expect(callBody.colors).toEqual([
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 255, b: 0 },
      ]);
    });

    it('should handle API errors gracefully (non-200 on queue submit)', async () => {
      globalThis.fetch = mockFalQueueSubmitError(
        { error: 'Rate limit exceeded' },
        429
      );

      await expect(
        recraftClient.generateVector({ prompt: 'Will fail' })
      ).rejects.toThrow('FAL queue submit failed: 429');
    });

    it('should throw when no image is returned in response', async () => {
      globalThis.fetch = mockFalQueueFetch({ images: [] });

      await expect(
        runWithTimers(() =>
          recraftClient.generateVector({ prompt: 'No image' })
        )
      ).rejects.toThrow('Recraft V4 returned no image in response');
    });

    it('should throw when images array is undefined', async () => {
      globalThis.fetch = mockFalQueueFetch({});

      await expect(
        runWithTimers(() =>
          recraftClient.generateVector({ prompt: 'No images key' })
        )
      ).rejects.toThrow('Recraft V4 returned no image in response');
    });

    it('should default contentType to image/svg+xml when not provided', async () => {
      globalThis.fetch = mockFalQueueFetch({
        images: [{ url: 'https://fal.run/result/no-type.svg' }],
      });

      const result = await runWithTimers(() =>
        recraftClient.generateVector({ prompt: 'Test' })
      );
      expect(result.contentType).toBe('image/svg+xml');
    });

    it('should default fileSize to 0 when not provided', async () => {
      globalThis.fetch = mockFalQueueFetch({
        images: [{ url: 'https://fal.run/result/no-size.svg' }],
      });

      const result = await runWithTimers(() =>
        recraftClient.generateVector({ prompt: 'Test' })
      );
      expect(result.fileSize).toBe(0);
    });

    it('should pass background_color as RGB when provided', async () => {
      globalThis.fetch = mockFalQueueFetch({
        images: [{ url: 'https://fal.run/result/bg.svg' }],
      });

      await runWithTimers(() =>
        recraftClient.generateVector({
          prompt: 'Logo with bg',
          background_color: '#FFFFFF',
        })
      );

      const callBody = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
      expect(callBody.background_color).toEqual({ r: 255, g: 255, b: 255 });
    });
  });

  describe('vectorize()', () => {
    it('should return svgUrl on success', async () => {
      globalThis.fetch = mockFalQueueFetch({
        images: [
          {
            url: 'https://fal.run/result/vectorized.svg',
            content_type: 'image/svg+xml',
            file_size: 8000,
          },
        ],
      });

      const result = await runWithTimers(() =>
        recraftClient.vectorize({ imageUrl: 'https://example.com/logo.png' })
      );

      expect(result.svgUrl).toBe('https://fal.run/result/vectorized.svg');
      expect(result.contentType).toBe('image/svg+xml');
      expect(result.fileSize).toBe(8000);
    });

    it('should call the correct vectorize endpoint via FAL queue', async () => {
      globalThis.fetch = mockFalQueueFetch({
        images: [{ url: 'https://fal.run/result/vec.svg' }],
      });

      await runWithTimers(() =>
        recraftClient.vectorize({ imageUrl: 'https://example.com/raster.png' })
      );

      // First call is the queue submit to the vectorize model
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://queue.fal.run/fal-ai/recraft/vectorize',
        expect.objectContaining({ method: 'POST' })
      );

      const callBody = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
      expect(callBody.image_url).toBe('https://example.com/raster.png');
    });

    it('should handle API errors gracefully', async () => {
      globalThis.fetch = mockFalQueueSubmitError(
        { error: 'Image too large' },
        400
      );

      await expect(
        recraftClient.vectorize({ imageUrl: 'https://example.com/huge.png' })
      ).rejects.toThrow('FAL queue submit failed: 400');
    });

    it('should throw when no image is returned', async () => {
      globalThis.fetch = mockFalQueueFetch({ images: [] });

      await expect(
        runWithTimers(() =>
          recraftClient.vectorize({ imageUrl: 'https://example.com/empty.png' })
        )
      ).rejects.toThrow('Recraft vectorize returned no image in response');
    });
  });
});

describe('falClient', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('generate()', () => {
    it('should return imageUrl on success', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse({
          images: [{ url: 'https://fal.run/result/flux-image.png' }],
          seed: 42,
        })
      );

      const result = await falClient.generate({
        prompt: 'A stunning product photo',
      });

      expect(result.imageUrl).toBe('https://fal.run/result/flux-image.png');
      expect(result.seed).toBe(42);
    });

    it('should call the correct FLUX Pro endpoint', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse({
          images: [{ url: 'https://fal.run/result/test.png' }],
        })
      );

      await falClient.generate({ prompt: 'Test' });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://fal.run/fal-ai/flux-pro/v1.1',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Key test-fal-key-123',
          }),
        })
      );
    });

    it('should pass image_size and num_images in request body', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse({
          images: [{ url: 'https://fal.run/result/landscape.png' }],
        })
      );

      await falClient.generate({
        prompt: 'Landscape test',
        image_size: 'landscape_4_3',
        num_images: 2,
      });

      const callBody = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
      expect(callBody.image_size).toBe('landscape_4_3');
      expect(callBody.num_images).toBe(2);
      expect(callBody.safety_tolerance).toBe('2');
    });

    it('should include seed in request body when provided', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse({
          images: [{ url: 'https://fal.run/result/seeded.png' }],
          seed: 123,
        })
      );

      await falClient.generate({ prompt: 'Seeded', seed: 123 });

      const callBody = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
      expect(callBody.seed).toBe(123);
    });

    it('should not include seed in request body when not provided', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse({
          images: [{ url: 'https://fal.run/result/no-seed.png' }],
        })
      );

      await falClient.generate({ prompt: 'No seed' });

      const callBody = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
      expect(callBody.seed).toBeUndefined();
    });

    it('should handle API errors gracefully (non-200 responses)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse(
          { error: 'Internal Server Error' },
          { ok: false, status: 500 }
        )
      );

      await expect(
        falClient.generate({ prompt: 'Fail' })
      ).rejects.toThrow('FAL.ai request failed: 500');
    });

    it('should throw when no image is returned', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse({ images: [] })
      );

      await expect(
        falClient.generate({ prompt: 'Empty result' })
      ).rejects.toThrow('FAL.ai returned no image in response');
    });

    it('should throw when images key is missing', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse({ result: 'unexpected format' })
      );

      await expect(
        falClient.generate({ prompt: 'Bad format' })
      ).rejects.toThrow('FAL.ai returned no image in response');
    });
  });
});

describe('ideogramClient', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('generate()', () => {
    it('should return imageUrl and prompt on success', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse({
          data: [
            {
              url: 'https://ideogram.ai/result/typography.png',
              prompt: 'Enhanced: typography artwork',
            },
          ],
        })
      );

      const result = await ideogramClient.generate({
        prompt: 'Typography artwork',
      });

      expect(result.imageUrl).toBe('https://ideogram.ai/result/typography.png');
      expect(result.prompt).toBe('Enhanced: typography artwork');
    });

    it('should call the correct Ideogram endpoint', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse({
          data: [{ url: 'https://ideogram.ai/result/test.png', prompt: 'test' }],
        })
      );

      await ideogramClient.generate({ prompt: 'Test typography' });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.ideogram.ai/generate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Api-Key': 'test-ideogram-key-456',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should pass aspect ratio and model in request body', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse({
          data: [{ url: 'https://ideogram.ai/result/wide.png', prompt: 'wide' }],
        })
      );

      await ideogramClient.generate({
        prompt: 'Wide format',
        aspectRatio: '16:9',
        model: 'V_3',
      });

      const callBody = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
      expect(callBody.image_request.aspect_ratio).toBe('16:9');
      expect(callBody.image_request.model).toBe('V_3');
      expect(callBody.image_request.magic_prompt_option).toBe('AUTO');
    });

    it('should default to 1:1 aspect ratio and V_3 model', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse({
          data: [{ url: 'https://ideogram.ai/result/default.png', prompt: 'default' }],
        })
      );

      await ideogramClient.generate({ prompt: 'Default params' });

      const callBody = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
      expect(callBody.image_request.aspect_ratio).toBe('1:1');
      expect(callBody.image_request.model).toBe('V_3');
    });

    it('should handle API errors gracefully', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse(
          { error: 'Forbidden' },
          { ok: false, status: 403 }
        )
      );

      await expect(
        ideogramClient.generate({ prompt: 'Fail' })
      ).rejects.toThrow('Ideogram error: 403');
    });

    it('should throw when no image is returned in data', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockFetchResponse({ data: [] })
      );

      await expect(
        ideogramClient.generate({ prompt: 'Empty' })
      ).rejects.toThrow('Ideogram returned no image');
    });
  });
});
