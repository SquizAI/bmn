// server/src/services/providers.js

/**
 * Singleton provider clients for AI services.
 * Initialized once on first use, reused across all tool executions.
 * This avoids creating new client instances per request.
 *
 * All SDK imports are wrapped in try/catch since the SDKs may not
 * be installed yet during early development. If a SDK is missing,
 * the getter function throws a descriptive error on use.
 */

import { config } from '../config/index.js';

// ── SDK availability flags ───────────────────────────────────────

let AnthropicSDK = null;
let OpenAISDK = null;
let GoogleGenerativeAISDK = null;

try {
  const mod = await import('@anthropic-ai/sdk');
  AnthropicSDK = mod.default || mod.Anthropic;
} catch {
  // @anthropic-ai/sdk not installed yet
}

try {
  const mod = await import('openai');
  OpenAISDK = mod.default || mod.OpenAI;
} catch {
  // openai not installed yet
}

try {
  const mod = await import('@google/generative-ai');
  GoogleGenerativeAISDK = mod.GoogleGenerativeAI;
} catch {
  // @google/generative-ai not installed yet
}

// ── Singleton instances ──────────────────────────────────────────

/** @type {import('@anthropic-ai/sdk').default | null} */
let _anthropic = null;

/** @type {import('openai').default | null} */
let _openai = null;

/** @type {import('@google/generative-ai').GoogleGenerativeAI | null} */
let _genAI = null;

/**
 * Get the Anthropic client (singleton).
 * @returns {import('@anthropic-ai/sdk').default}
 */
export function getAnthropicClient() {
  if (!_anthropic) {
    if (!AnthropicSDK) {
      throw new Error(
        'Anthropic SDK (@anthropic-ai/sdk) is not installed. Run: npm install @anthropic-ai/sdk'
      );
    }
    _anthropic = new AnthropicSDK({ apiKey: config.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

/**
 * Get the OpenAI client (singleton).
 * @returns {import('openai').default}
 */
export function getOpenAIClient() {
  if (!_openai) {
    if (!OpenAISDK) {
      throw new Error(
        'OpenAI SDK (openai) is not installed. Run: npm install openai'
      );
    }
    _openai = new OpenAISDK({ apiKey: config.OPENAI_API_KEY });
  }
  return _openai;
}

/**
 * Get the Google Generative AI client (singleton).
 * @returns {import('@google/generative-ai').GoogleGenerativeAI}
 */
export function getGoogleAIClient() {
  if (!_genAI) {
    if (!GoogleGenerativeAISDK) {
      throw new Error(
        'Google AI SDK (@google/generative-ai) is not installed. Run: npm install @google/generative-ai'
      );
    }
    _genAI = new GoogleGenerativeAISDK(config.GOOGLE_API_KEY);
  }
  return _genAI;
}

// ── Direct API Clients (no SDK -- fetch-based) ──────────────────

/**
 * Helper: convert hex color string to RGB object for Recraft API.
 * @param {string} hex - e.g. '#2D3436' or '2D3436'
 * @returns {{ r: number, g: number, b: number }}
 */
function hexToRgb(hex) {
  const h = hex.replace(/^#/, '');
  return {
    r: parseInt(h.substring(0, 2), 16) || 0,
    g: parseInt(h.substring(2, 4), 16) || 0,
    b: parseInt(h.substring(4, 6), 16) || 0,
  };
}

/**
 * FAL.ai API client (no SDK -- direct fetch).
 * Provides a consistent interface for FLUX Pro v1.1 calls via fal.run.
 * FAL.ai is synchronous -- POST and receive the result immediately (no polling).
 */
export const falClient = {
  /**
   * Generate an image using FAL.ai FLUX Pro v1.1.
   * @param {Object} params
   * @param {string} params.prompt
   * @param {string} [params.image_size='square_hd'] - Image size preset (e.g., 'square_hd', 'landscape_4_3', 'portrait_4_3')
   * @param {number} [params.num_images=1]
   * @param {number} [params.seed]
   * @returns {Promise<{ imageUrl: string, seed: number | undefined }>}
   */
  async generate({ prompt, image_size = 'square_hd', num_images = 1, seed }) {
    const response = await fetch('https://fal.run/fal-ai/flux-pro/v1.1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${config.FAL_API_KEY}`,
      },
      body: JSON.stringify({
        prompt,
        image_size,
        num_images,
        safety_tolerance: '2',
        ...(seed !== undefined && { seed }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `FAL.ai request failed: ${response.status} — ${errorText}`
      );
    }

    const data = await response.json();
    const image = data.images?.[0];

    if (!image?.url) {
      throw new Error('FAL.ai returned no image in response');
    }

    return { imageUrl: image.url, seed: data.seed };
  },
};

/**
 * Recraft V4 client via FAL.ai Queue API (no SDK -- direct fetch).
 * #1 rated model for logo/design generation. Outputs native SVG vectors.
 * Uses the FAL Queue API (queue.fal.run) instead of the synchronous fal.run
 * endpoint, which can hang for 60+ seconds on cold starts.
 *
 * Flow: POST to queue → poll status → GET result.
 */
const FAL_QUEUE_BASE = 'https://queue.fal.run';
const FAL_POLL_INTERVAL_MS = 2000;
const FAL_MAX_WAIT_MS = 120_000; // 2 minutes max

/**
 * Submit a job to FAL.ai Queue API and poll until complete.
 * @param {string} modelId - e.g. 'fal-ai/recraft/v4/text-to-vector'
 * @param {Object} body - Request payload
 * @returns {Promise<Object>} - The model's response data
 */
async function falQueueRequest(modelId, body) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Key ${config.FAL_API_KEY}`,
  };

  // FAL Queue API requires the full modelId (with subpath) for submit,
  // but only the base model (namespace/model) for status/result checks.
  // e.g. 'fal-ai/recraft/v4/text-to-vector' → base = 'fal-ai/recraft'
  // See: https://docs.fal.ai/model-apis/model-endpoints/queue#queue-endpoints
  const parts = modelId.split('/');
  const baseModelId = parts.slice(0, 2).join('/');

  // Step 1: Submit to queue (uses full modelId with subpath)
  const submitRes = await fetch(`${FAL_QUEUE_BASE}/${modelId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!submitRes.ok) {
    const errorText = await submitRes.text();
    throw new Error(`FAL queue submit failed: ${submitRes.status} — ${errorText}`);
  }

  const { request_id } = await submitRes.json();
  if (!request_id) {
    throw new Error('FAL queue submit returned no request_id');
  }

  // Step 2: Poll status until COMPLETED (uses base modelId only)
  const deadline = Date.now() + FAL_MAX_WAIT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, FAL_POLL_INTERVAL_MS));

    const statusRes = await fetch(
      `${FAL_QUEUE_BASE}/${baseModelId}/requests/${request_id}/status`,
      { headers },
    );

    if (!statusRes.ok) {
      throw new Error(`FAL status check failed: ${statusRes.status}`);
    }

    const status = await statusRes.json();

    if (status.status === 'COMPLETED') {
      // Step 3: Fetch result (uses base modelId only)
      const resultRes = await fetch(
        `${FAL_QUEUE_BASE}/${baseModelId}/requests/${request_id}`,
        { headers },
      );

      if (!resultRes.ok) {
        const errText = await resultRes.text();
        throw new Error(`FAL result fetch failed: ${resultRes.status} — ${errText}`);
      }

      return await resultRes.json();
    }

    if (status.status === 'FAILED') {
      throw new Error(`FAL job failed: ${status.error || 'Unknown error'}`);
    }

    // IN_QUEUE or IN_PROGRESS — keep polling
  }

  throw new Error(`FAL job timed out after ${FAL_MAX_WAIT_MS / 1000}s (request_id: ${request_id})`);
}

export const recraftClient = {
  /**
   * Generate a vector logo using Recraft V4 text-to-vector via FAL.ai Queue API.
   * @param {Object} params
   * @param {string} params.prompt - Logo description (1-10000 chars)
   * @param {string} [params.image_size='square_hd'] - Output size preset
   * @param {string[]} [params.colors] - Brand hex colors (e.g. ['#2D3436', '#00CEC9'])
   * @param {string} [params.background_color] - Background hex color (default white)
   * @returns {Promise<{ imageUrl: string, contentType: string, fileSize: number }>}
   */
  async generateVector({ prompt, image_size = 'square_hd', colors, background_color }) {
    const body = { prompt, image_size };

    if (colors && colors.length > 0) {
      body.colors = colors.map(hexToRgb);
    }
    if (background_color) {
      body.background_color = hexToRgb(background_color);
    }

    const data = await falQueueRequest('fal-ai/recraft/v4/text-to-vector', body);
    const image = data.images?.[0];

    if (!image?.url) {
      throw new Error('Recraft V4 returned no image in response');
    }

    return {
      imageUrl: image.url,
      contentType: image.content_type || 'image/svg+xml',
      fileSize: image.file_size || 0,
    };
  },

  /**
   * Convert a raster image (PNG/JPG/WebP) to SVG vector using Recraft vectorize.
   * @param {Object} params
   * @param {string} params.imageUrl - URL of the raster image to vectorize
   * @returns {Promise<{ svgUrl: string, contentType: string, fileSize: number }>}
   */
  async vectorize({ imageUrl }) {
    const data = await falQueueRequest('fal-ai/recraft/vectorize', { image_url: imageUrl });
    const image = data.images?.[0];

    if (!image?.url) {
      throw new Error('Recraft vectorize returned no image in response');
    }

    return {
      svgUrl: image.url,
      contentType: image.content_type || 'image/svg+xml',
      fileSize: image.file_size || 0,
    };
  },
};

/**
 * Ideogram API client (no SDK -- direct fetch).
 */
export const ideogramClient = {
  /**
   * Generate an image with Ideogram v3.
   * @param {Object} params
   * @param {string} params.prompt
   * @param {string} [params.aspectRatio='1:1']
   * @param {string} [params.model='V_3']
   * @returns {Promise<{ imageUrl: string, prompt: string }>}
   */
  async generate({ prompt, aspectRatio = '1:1', model = 'V_3' }) {
    const response = await fetch('https://api.ideogram.ai/generate', {
      method: 'POST',
      headers: {
        'Api-Key': config.IDEOGRAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_request: {
          prompt,
          aspect_ratio: aspectRatio,
          model,
          magic_prompt_option: 'AUTO',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Ideogram error: ${response.status} — ${await response.text()}`
      );
    }

    const result = await response.json();
    const image = result.data?.[0];
    if (!image?.url) throw new Error('Ideogram returned no image');

    return { imageUrl: image.url, prompt: image.prompt };
  },
};
