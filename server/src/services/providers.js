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
  const mod = await import('@google/generativeai');
  GoogleGenerativeAISDK = mod.GoogleGenerativeAI;
} catch {
  // @google/generativeai not installed yet
}

// ── Singleton instances ──────────────────────────────────────────

/** @type {import('@anthropic-ai/sdk').default | null} */
let _anthropic = null;

/** @type {import('openai').default | null} */
let _openai = null;

/** @type {import('@google/generativeai').GoogleGenerativeAI | null} */
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
 * @returns {import('@google/generativeai').GoogleGenerativeAI}
 */
export function getGoogleAIClient() {
  if (!_genAI) {
    if (!GoogleGenerativeAISDK) {
      throw new Error(
        'Google AI SDK (@google/generativeai) is not installed. Run: npm install @google/generativeai'
      );
    }
    _genAI = new GoogleGenerativeAISDK(config.GOOGLE_API_KEY);
  }
  return _genAI;
}

// ── Direct API Clients (no SDK -- fetch-based) ──────────────────

/**
 * BFL API client (no SDK -- direct fetch).
 * Provides a consistent interface for FLUX.2 Pro calls.
 */
export const bflClient = {
  /**
   * Submit an image generation request to BFL FLUX.2 Pro.
   * @param {Object} params
   * @param {string} params.prompt
   * @param {number} [params.width=1024]
   * @param {number} [params.height=1024]
   * @param {number} [params.seed]
   * @returns {Promise<{ taskId: string }>}
   */
  async submit({ prompt, width = 1024, height = 1024, seed }) {
    const response = await fetch('https://api.bfl.ml/v1/flux-pro-1.1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Key': config.BFL_API_KEY,
      },
      body: JSON.stringify({
        prompt,
        width,
        height,
        ...(seed !== undefined && { seed }),
        safety_tolerance: 2,
        output_format: 'png',
      }),
    });

    if (!response.ok) {
      throw new Error(
        `BFL submit failed: ${response.status} — ${await response.text()}`
      );
    }

    const { id } = await response.json();
    return { taskId: id };
  },

  /**
   * Poll for a completed BFL generation result.
   * @param {string} taskId
   * @param {number} [timeoutMs=60000]
   * @returns {Promise<{ imageUrl: string }>}
   */
  async poll(taskId, timeoutMs = 60000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const response = await fetch(
        `https://api.bfl.ml/v1/get_result?id=${taskId}`,
        {
          headers: { 'X-Key': config.BFL_API_KEY },
        }
      );

      const data = await response.json();

      if (data.status === 'Ready') return { imageUrl: data.result.sample };
      if (data.status === 'Error')
        throw new Error(`BFL error: ${data.error}`);

      await new Promise((r) => setTimeout(r, 1000));
    }

    throw new Error(
      `BFL poll timeout after ${timeoutMs}ms for task ${taskId}`
    );
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
