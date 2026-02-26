// server/src/skills/mockup-renderer/handlers.js

import { createClient } from '@supabase/supabase-js';
import { logger as rootLogger } from '../../lib/logger.js';
import { skillConfig } from './config.js';

const logger = rootLogger.child({ skill: 'mockup-renderer' });

// ── Lazy-initialised clients ─────────────────────────────────────

/**
 * Get the Supabase admin client. Lazy-initialises so tests can stub env vars
 * before first use.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getSupabase() {
  if (!getSupabase._client) {
    getSupabase._client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  }
  return getSupabase._client;
}

/**
 * Get the OpenAI client (lazy, nullable for stub mode).
 * @returns {Promise<import('openai').default | null>}
 */
async function getOpenAIClient() {
  try {
    const { default: OpenAI } = await import('openai');
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } catch {
    logger.warn('openai package not installed -- generateProductMockup will return stubs');
    return null;
  }
}

/**
 * Get the Google Generative AI client (lazy, nullable for stub mode).
 * @returns {Promise<import('@google/generativeai').GoogleGenerativeAI | null>}
 */
async function getGoogleAIClient() {
  try {
    const { GoogleGenerativeAI } = await import('@google/generativeai');
    return new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  } catch {
    logger.warn('@google/generativeai not installed -- composeBundleImage will return stubs');
    return null;
  }
}

// ── Retry helper ─────────────────────────────────────────────────

/**
 * Retry an async function with exponential backoff.
 *
 * @template T
 * @param {() => Promise<T>} fn - Async function to retry
 * @param {{ maxRetries?: number, backoffMs?: number, backoffMultiplier?: number }} [policy]
 * @returns {Promise<T>}
 */
async function withRetry(fn, policy = {}) {
  const maxRetries = policy.maxRetries ?? skillConfig.retryPolicy.maxRetries;
  const backoffMs = policy.backoffMs ?? skillConfig.retryPolicy.backoffMs;
  const multiplier = policy.backoffMultiplier ?? skillConfig.retryPolicy.backoffMultiplier;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = backoffMs * Math.pow(multiplier, attempt);
        logger.warn({ attempt: attempt + 1, maxRetries, delay, error: err.message }, 'Retrying after failure');
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// ── generateProductMockup ────────────────────────────────────────

/**
 * Generate a product mockup via GPT Image 1.5 (OpenAI).
 *
 * @param {Object} input
 * @param {string} input.prompt
 * @param {string} input.productSku
 * @param {string} input.productName
 * @param {string} input.logoUrl
 * @param {string} [input.size='1024x1024']
 * @param {string} [input.quality='hd']
 * @returns {Promise<{ success: boolean, imageUrl: string|null, revisedPrompt: string|null, model: string, error: string|null }>}
 */
export async function generateProductMockup({ prompt, productSku, productName, logoUrl, size, quality }) {
  logger.info({ productSku, productName, size }, 'Generating product mockup via GPT Image 1.5');

  const openai = await getOpenAIClient();
  if (!openai) {
    return {
      success: false,
      imageUrl: null,
      revisedPrompt: null,
      model: 'gpt-image-1.5',
      error: 'OpenAI SDK not available. Install openai to enable mockup generation.',
    };
  }

  try {
    const result = await withRetry(
      () => openai.images.generate({
        model: 'gpt-image-1.5',
        prompt,
        n: 1,
        size: size || '1024x1024',
        quality: quality || 'hd',
        response_format: 'url',
      }),
    );

    const imageData = result.data?.[0];
    if (!imageData) {
      return { success: false, imageUrl: null, revisedPrompt: null, model: 'gpt-image-1.5', error: 'No image returned from OpenAI' };
    }

    return {
      success: true,
      imageUrl: imageData.url || null,
      revisedPrompt: imageData.revised_prompt || null,
      model: 'gpt-image-1.5',
      error: null,
    };
  } catch (err) {
    logger.error({ err, productSku }, 'GPT Image 1.5 generation failed');

    // Handle content policy violations specifically
    if (err.code === 'content_policy_violation') {
      return {
        success: false,
        imageUrl: null,
        revisedPrompt: null,
        model: 'gpt-image-1.5',
        error: 'Content policy violation — prompt may need adjustment',
      };
    }

    return { success: false, imageUrl: null, revisedPrompt: null, model: 'gpt-image-1.5', error: err.message };
  }
}

// ── generateTextOnProduct ────────────────────────────────────────

/**
 * Map user-facing aspect ratio strings to Ideogram API format.
 * @param {string} ratio - e.g. '1:1', '4:3'
 * @returns {string} Ideogram format e.g. 'ASPECT_1_1'
 */
function toIdeogramAspectRatio(ratio) {
  const map = {
    '1:1': 'ASPECT_1_1',
    '4:3': 'ASPECT_4_3',
    '3:4': 'ASPECT_3_4',
    '16:9': 'ASPECT_16_9',
    '9:16': 'ASPECT_9_16',
  };
  return map[ratio] || 'ASPECT_1_1';
}

/**
 * Generate a text-on-product image via Ideogram v3.
 * Falls back to GPT Image 1.5 if Ideogram fails after retries.
 *
 * @param {Object} input
 * @param {string} input.prompt
 * @param {string} input.brandText
 * @param {string} input.productSku
 * @param {string} input.productName
 * @param {string} [input.aspectRatio='1:1']
 * @param {string} [input.styleType='realistic']
 * @returns {Promise<{ success: boolean, imageUrl: string|null, model: string, error: string|null }>}
 */
export async function generateTextOnProduct({ prompt, brandText, productSku, productName, aspectRatio, styleType }) {
  logger.info({ productSku, brandText, styleType }, 'Generating text-on-product via Ideogram v3');

  try {
    const response = await withRetry(
      () => fetch('https://api.ideogram.ai/generate', {
        method: 'POST',
        headers: {
          'Api-Key': process.env.IDEOGRAM_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_request: {
            prompt,
            aspect_ratio: toIdeogramAspectRatio(aspectRatio || '1:1'),
            model: 'V_3',
            style_type: (styleType || 'realistic').toUpperCase(),
            magic_prompt_option: 'AUTO',
          },
        }),
      }),
    );

    if (!response.ok) {
      const errBody = await response.text();
      logger.error({ status: response.status, body: errBody }, 'Ideogram API failed');

      // Fall back to GPT Image 1.5 per PRD error handling spec
      logger.info({ productSku }, 'Falling back to GPT Image 1.5 for text-on-product');
      return await fallbackToGPTImage(prompt, productSku);
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url || null;

    if (!imageUrl) {
      logger.warn({ productSku }, 'No image URL in Ideogram response, falling back to GPT Image 1.5');
      return await fallbackToGPTImage(prompt, productSku);
    }

    return {
      success: true,
      imageUrl,
      model: 'ideogram-v3',
      error: null,
    };
  } catch (err) {
    logger.error({ err, productSku }, 'Ideogram v3 generation failed after retries');

    // Fall back to GPT Image 1.5 per PRD spec
    logger.info({ productSku }, 'Falling back to GPT Image 1.5 for text-on-product');
    return await fallbackToGPTImage(prompt, productSku);
  }
}

/**
 * Fallback: generate an image via GPT Image 1.5 when Ideogram fails.
 *
 * @param {string} prompt
 * @param {string} productSku
 * @returns {Promise<{ success: boolean, imageUrl: string|null, model: string, error: string|null }>}
 */
async function fallbackToGPTImage(prompt, productSku) {
  const openai = await getOpenAIClient();
  if (!openai) {
    return { success: false, imageUrl: null, model: 'gpt-image-1.5', error: 'OpenAI SDK not available for Ideogram fallback' };
  }

  try {
    const result = await openai.images.generate({
      model: 'gpt-image-1.5',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'hd',
      response_format: 'url',
    });

    const url = result.data?.[0]?.url || null;
    if (!url) {
      return { success: false, imageUrl: null, model: 'gpt-image-1.5', error: 'GPT Image 1.5 fallback returned no image' };
    }

    return { success: true, imageUrl: url, model: 'gpt-image-1.5', error: null };
  } catch (err) {
    logger.error({ err, productSku }, 'GPT Image 1.5 fallback also failed');
    return { success: false, imageUrl: null, model: 'gpt-image-1.5', error: `Fallback also failed: ${err.message}` };
  }
}

// ── composeBundleImage ───────────────────────────────────────────

/**
 * Compose a bundle image via Gemini 3 Pro Image (Google AI).
 * Falls back to GPT Image 1.5 simple product grid on failure.
 *
 * @param {Object} input
 * @param {string} input.prompt
 * @param {string} input.bundleName
 * @param {string[]} input.productDescriptions
 * @param {string[]} input.referenceImageUrls
 * @returns {Promise<{ success: boolean, imageBase64: string|null, mimeType: string|null, model: string, error: string|null }>}
 */
export async function composeBundleImage({ prompt, bundleName, productDescriptions, referenceImageUrls }) {
  logger.info({ bundleName, productCount: productDescriptions.length }, 'Composing bundle image via Gemini 3 Pro Image');

  const genAI = await getGoogleAIClient();
  if (!genAI) {
    // Fall back to GPT Image 1.5 for bundle
    logger.info({ bundleName }, 'Google AI SDK not available, falling back to GPT Image 1.5 for bundle');
    return await fallbackBundleToGPTImage(prompt, bundleName, productDescriptions);
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-pro-preview',
      generationConfig: { responseMimeType: 'image/png' },
    });

    // Build multimodal content with reference images
    const contentParts = [
      { text: prompt },
    ];

    // Include up to 6 reference images for better composition
    for (const url of referenceImageUrls.slice(0, 6)) {
      try {
        const imgResponse = await fetch(url);
        if (imgResponse.ok) {
          const buffer = Buffer.from(await imgResponse.arrayBuffer());
          contentParts.push({
            inlineData: {
              mimeType: imgResponse.headers.get('content-type') || 'image/png',
              data: buffer.toString('base64'),
            },
          });
        }
      } catch {
        logger.warn({ url }, 'Could not fetch reference image for bundle composition');
      }
    }

    const result = await withRetry(
      () => model.generateContent(contentParts),
      { maxRetries: 2 }, // PRD: retry twice for Gemini bundles
    );

    // Extract generated image from response
    const response = result.response;
    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData?.mimeType?.startsWith('image/'),
    );

    if (!imagePart) {
      logger.warn({ bundleName }, 'No image in Gemini response, falling back to GPT Image 1.5');
      return await fallbackBundleToGPTImage(prompt, bundleName, productDescriptions);
    }

    return {
      success: true,
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType,
      model: 'gemini-3-pro-image',
      error: null,
    };
  } catch (err) {
    logger.error({ err, bundleName }, 'Gemini 3 Pro Image composition failed after retries');

    // Fall back to GPT Image 1.5 per PRD spec
    logger.info({ bundleName }, 'Falling back to GPT Image 1.5 for bundle composition');
    return await fallbackBundleToGPTImage(prompt, bundleName, productDescriptions);
  }
}

/**
 * Fallback: generate a simple product grid bundle image via GPT Image 1.5
 * when Gemini fails.
 *
 * @param {string} prompt
 * @param {string} bundleName
 * @param {string[]} productDescriptions
 * @returns {Promise<{ success: boolean, imageBase64: string|null, mimeType: string|null, model: string, error: string|null }>}
 */
async function fallbackBundleToGPTImage(prompt, bundleName, productDescriptions) {
  const openai = await getOpenAIClient();
  if (!openai) {
    return { success: false, imageBase64: null, mimeType: null, model: 'gpt-image-1.5', error: 'OpenAI SDK not available for Gemini fallback' };
  }

  try {
    const gridPrompt = `Professional product photography flat-lay composition showing a bundle called "${bundleName}" containing: ${productDescriptions.join(', ')}. Clean white background, evenly spaced product arrangement, studio lighting, e-commerce quality. ${prompt}`;

    const result = await openai.images.generate({
      model: 'gpt-image-1.5',
      prompt: gridPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'hd',
      response_format: 'b64_json',
    });

    const b64 = result.data?.[0]?.b64_json || null;
    if (!b64) {
      return { success: false, imageBase64: null, mimeType: null, model: 'gpt-image-1.5', error: 'GPT Image 1.5 fallback returned no image for bundle' };
    }

    return { success: true, imageBase64: b64, mimeType: 'image/png', model: 'gpt-image-1.5', error: null };
  } catch (err) {
    logger.error({ err, bundleName }, 'GPT Image 1.5 bundle fallback also failed');
    return { success: false, imageBase64: null, mimeType: null, model: 'gpt-image-1.5', error: `Bundle fallback failed: ${err.message}` };
  }
}

// ── uploadMockupAsset ────────────────────────────────────────────

/**
 * Upload a mockup image to permanent storage (Supabase Storage).
 *
 * @param {Object} input
 * @param {string} input.imageSource - URL or base64 data
 * @param {string} input.brandId
 * @param {string} input.assetType - 'mockup' or 'bundle'
 * @param {string|null} input.productSku
 * @param {string|null} input.bundleName
 * @param {{ prompt: string, model: string, productName: string|null }} input.metadata
 * @returns {Promise<{ success: boolean, permanentUrl: string|null, thumbnailUrl: string|null, error: string|null }>}
 */
export async function uploadMockupAsset({ imageSource, brandId, assetType, productSku, bundleName, metadata }) {
  logger.info({ brandId, assetType, productSku, bundleName }, 'Uploading mockup to storage');

  const supabase = getSupabase();

  try {
    let imageBuffer;
    let contentType = 'image/png';

    // Determine if imageSource is a URL or base64
    if (imageSource.startsWith('http')) {
      const response = await withRetry(
        () => fetch(imageSource),
        { maxRetries: 1 }, // PRD: retry once for uploads
      );
      if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
      imageBuffer = Buffer.from(await response.arrayBuffer());
      contentType = response.headers.get('content-type') || 'image/png';
    } else {
      // Base64 data
      imageBuffer = Buffer.from(imageSource, 'base64');
    }

    const timestamp = Date.now();
    const identifier = productSku || bundleName?.replace(/\s+/g, '-') || 'asset';
    const extension = contentType.includes('png') ? 'png' : 'jpg';
    const storagePath = `brands/${brandId}/${assetType}s/${identifier}-${timestamp}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('brand-assets')
      .upload(storagePath, imageBuffer, { contentType, upsert: false });

    if (uploadError) {
      logger.error({ uploadError, storagePath }, 'Storage upload failed');
      // PRD: return temporary API URL as fallback on upload failure
      if (imageSource.startsWith('http')) {
        logger.warn({ brandId }, 'Upload failed, returning temporary API URL as fallback');
        return { success: true, permanentUrl: imageSource, thumbnailUrl: null, error: `Upload failed (using temp URL): ${uploadError.message}` };
      }
      return { success: false, permanentUrl: null, thumbnailUrl: null, error: uploadError.message };
    }

    const { data: urlData } = supabase.storage.from('brand-assets').getPublicUrl(storagePath);
    const permanentUrl = urlData.publicUrl;
    const thumbnailUrl = `${permanentUrl}?width=256&height=256&resize=contain`;

    return { success: true, permanentUrl, thumbnailUrl, error: null };
  } catch (err) {
    logger.error({ err, brandId }, 'Mockup upload failed');

    // PRD: return temporary API URL as fallback
    if (imageSource.startsWith('http')) {
      return { success: true, permanentUrl: imageSource, thumbnailUrl: null, error: `Upload failed (using temp URL): ${err.message}` };
    }
    return { success: false, permanentUrl: null, thumbnailUrl: null, error: err.message };
  }
}

// ── saveMockupAssets ─────────────────────────────────────────────

/**
 * Save all mockup assets to the database (brand_assets table).
 *
 * @param {Object} input
 * @param {string} input.brandId
 * @param {string} input.userId
 * @param {Array<{ url: string, thumbnailUrl: string|null, productSku: string|null, bundleName: string|null, assetType: string, prompt: string, model: string, productName: string|null }>} input.mockups
 * @returns {Promise<{ success: boolean, brandId: string, savedMockups: Array, error: string|null }>}
 */
export async function saveMockupAssets({ brandId, userId, mockups }) {
  logger.info({ brandId, mockupCount: mockups.length }, 'Saving mockup assets to database');

  const supabase = getSupabase();

  try {
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

    const { data, error } = await supabase
      .from('brand_assets')
      .insert(assetRows)
      .select('id, url, metadata');

    if (error) {
      logger.error({ error, brandId }, 'Failed to save mockup assets');
      return { success: false, brandId, savedMockups: [], error: error.message };
    }

    // Update wizard step to mockup-review
    await supabase
      .from('brands')
      .update({ wizard_step: 'mockup-review', updated_at: new Date().toISOString() })
      .eq('id', brandId)
      .eq('user_id', userId);

    // Write audit log entry
    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'mockups_generated',
      resource_type: 'brand',
      resource_id: brandId,
      metadata: { mockupCount: mockups.length, models: [...new Set(mockups.map((m) => m.model))] },
    });

    const savedMockups = (data || []).map((row) => ({
      assetId: row.id,
      url: row.url,
      productSku: row.metadata?.productSku || null,
      assetType: row.metadata?.bundleName ? 'bundle' : 'mockup',
    }));

    return { success: true, brandId, savedMockups, error: null };
  } catch (err) {
    logger.error({ err, brandId }, 'Save mockup assets failed');
    return { success: false, brandId, savedMockups: [], error: err.message };
  }
}
