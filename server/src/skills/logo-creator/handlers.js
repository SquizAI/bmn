// server/src/skills/logo-creator/handlers.js

import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { recraftClient } from '../../services/providers.js';
import { supabaseAdmin } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';

const log = logger.child({ skill: 'logo-creator' });

/**
 * Compose and validate a logo prompt (pure passthrough with validation).
 * The AI agent crafts the prompt; this tool structures and validates it.
 *
 * @param {import('zod').infer<import('./tools.js').ComposeLogoPromptInput>} input
 * @returns {Promise<import('zod').infer<import('./tools.js').ComposeLogoPromptOutput>>}
 */
export async function composeLogoPrompt(input) {
  log.info({ variationType: input.variationType, promptLength: input.prompt.length }, 'Composing logo prompt');

  return {
    success: true,
    variationType: input.variationType,
    prompt: input.prompt,
    designRationale: input.designRationale,
  };
}

/**
 * Generate a logo via Recraft V4 text-to-vector through FAL.ai queue API.
 * Uses the shared recraftClient which handles queue submission + polling.
 *
 * @param {import('zod').infer<import('./tools.js').GenerateLogoInput>} input
 * @returns {Promise<import('zod').infer<import('./tools.js').GenerateLogoOutput>>}
 */
export async function generateLogo({ prompt, imageSize, colors }) {
  log.info({ promptLength: prompt.length, imageSize }, 'Generating logo via Recraft V4 text-to-vector');

  try {
    const result = await recraftClient.generateVector({
      prompt,
      image_size: imageSize || config.generation.imageSize,
      colors: colors || undefined,
    });

    if (!result.imageUrl) {
      return {
        success: false,
        imageUrl: null,
        contentType: null,
        model: config.generation.recraftModel,
        error: 'Recraft V4 returned no image URL',
      };
    }

    log.info({ imageUrl: result.imageUrl, contentType: result.contentType }, 'Logo generation complete');

    return {
      success: true,
      imageUrl: result.imageUrl,
      contentType: result.contentType || 'image/svg+xml',
      model: config.generation.recraftModel,
      error: null,
    };
  } catch (err) {
    log.error({ err }, 'Logo generation failed');
    return {
      success: false,
      imageUrl: null,
      contentType: null,
      model: config.generation.recraftModel,
      error: err.message,
    };
  }
}

/**
 * Refine a logo by modifying the prompt and regenerating.
 * Appends refinement instructions to the original prompt. Max 3 rounds.
 *
 * @param {import('zod').infer<import('./tools.js').RefineLogoInput>} input
 * @returns {Promise<import('zod').infer<import('./tools.js').RefineLogoOutput>>}
 */
export async function refineLogo({ originalPrompt, refinementInstructions, refinementRound, imageSize, colors }) {
  log.info({ refinementRound }, 'Refining logo');

  if (refinementRound > config.generation.maxRefinements) {
    return {
      success: false,
      imageUrl: null,
      refinedPrompt: originalPrompt,
      refinementRound,
      contentType: null,
      model: config.generation.recraftModel,
      error: `Maximum refinement rounds (${config.generation.maxRefinements}) exceeded`,
    };
  }

  // Build refined prompt -- additive, not a full rewrite
  const refinedPrompt = `${originalPrompt}. Refinement: ${refinementInstructions}`;

  // Generate with the refined prompt via the same pipeline
  const result = await generateLogo({
    prompt: refinedPrompt,
    imageSize: imageSize || config.generation.imageSize,
    colors,
  });

  return {
    success: result.success,
    imageUrl: result.imageUrl,
    refinedPrompt,
    refinementRound,
    contentType: result.contentType,
    model: result.model,
    error: result.error,
  };
}

/**
 * Download image from temporary FAL.ai URL and upload to Supabase Storage.
 * Falls back to returning the temp URL if upload fails (temp URLs expire in ~24h).
 *
 * @param {import('zod').infer<import('./tools.js').UploadLogoAssetInput>} input
 * @returns {Promise<import('zod').infer<import('./tools.js').UploadLogoAssetOutput>>}
 */
export async function uploadLogoAsset({ imageUrl, brandId, variationType, metadata }) {
  log.info({ brandId, variationType }, 'Uploading logo to permanent storage');

  try {
    // Step 1: Download image from temporary FAL.ai URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      log.warn({ status: imageResponse.status, brandId }, 'Failed to download from FAL.ai, returning temp URL as fallback');
      return {
        success: true,
        permanentUrl: imageUrl,
        thumbnailUrl: null,
        storagePath: null,
        error: `Download failed (${imageResponse.status}); returning temporary URL as fallback`,
      };
    }

    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const contentType = imageResponse.headers.get('content-type') || metadata.contentType || 'image/svg+xml';
    const extension = contentType.includes('svg') ? 'svg' : contentType.includes('png') ? 'png' : 'jpg';

    // Step 2: Generate storage path
    const timestamp = Date.now();
    const filename = `${variationType}-${timestamp}-${randomUUID().slice(0, 8)}.${extension}`;
    const storagePath = `brands/${brandId}/logos/${filename}`;

    // Step 3: Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('brand-assets')
      .upload(storagePath, buffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      log.error({ uploadError, storagePath }, 'Supabase Storage upload failed, returning temp URL as fallback');
      return {
        success: true,
        permanentUrl: imageUrl,
        thumbnailUrl: null,
        storagePath: null,
        error: `Upload failed: ${uploadError.message}; returning temporary URL as fallback`,
      };
    }

    // Step 4: Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('brand-assets')
      .getPublicUrl(storagePath);

    const permanentUrl = urlData.publicUrl;

    // Thumbnail URL via Supabase image transforms (for raster images only)
    const thumbnailUrl = extension !== 'svg'
      ? `${permanentUrl}?width=256&height=256&resize=contain`
      : null;

    log.info({ permanentUrl, storagePath }, 'Logo uploaded to permanent storage');

    return {
      success: true,
      permanentUrl,
      thumbnailUrl,
      storagePath,
      error: null,
    };
  } catch (err) {
    log.error({ err, brandId }, 'Logo upload failed, returning temp URL as fallback');
    return {
      success: true,
      permanentUrl: imageUrl,
      thumbnailUrl: null,
      storagePath: null,
      error: `Upload failed: ${err.message}; returning temporary URL as fallback`,
    };
  }
}

/**
 * Save all logo assets to the brand_assets table in Supabase.
 * Updates the brand wizard_step and writes an audit log entry.
 *
 * @param {import('zod').infer<import('./tools.js').SaveLogoAssetsInput>} input
 * @returns {Promise<import('zod').infer<import('./tools.js').SaveLogoAssetsOutput>>}
 */
export async function saveLogoAssets({ brandId, userId, logos }) {
  log.info({ brandId, logoCount: logos.length }, 'Saving logo assets to database');

  try {
    // Build asset records for insertion
    const assetRows = logos.map((logo) => ({
      brand_id: brandId,
      asset_type: 'logo',
      url: logo.url,
      thumbnail_url: logo.thumbnailUrl || null,
      is_selected: false,
      metadata: {
        variationType: logo.variationType,
        prompt: logo.prompt,
        designRationale: logo.designRationale,
        model: logo.model,
        contentType: logo.contentType || 'image/svg+xml',
      },
    }));

    const { data, error } = await supabaseAdmin
      .from('brand_assets')
      .insert(assetRows)
      .select('id, url, metadata');

    if (error) {
      log.error({ error, brandId }, 'Failed to save logo assets');
      return { success: false, brandId, savedLogos: [], error: error.message };
    }

    // Update brand wizard step to logo-refinement
    await supabaseAdmin
      .from('brands')
      .update({ wizard_step: 'logo-refinement', updated_at: new Date().toISOString() })
      .eq('id', brandId)
      .eq('user_id', userId);

    // Audit log
    await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      action: 'logos_generated',
      resource_type: 'brand',
      resource_id: brandId,
      metadata: { logoCount: logos.length, model: logos[0]?.model },
    });

    const savedLogos = (data || []).map((row) => ({
      assetId: row.id,
      url: row.url,
      variationType: row.metadata?.variationType || 'unknown',
    }));

    log.info({ brandId, savedCount: savedLogos.length }, 'Logo assets saved to database');

    return { success: true, brandId, savedLogos, error: null };
  } catch (err) {
    log.error({ err, brandId }, 'Save logo assets failed');
    return { success: false, brandId, savedLogos: [], error: err.message };
  }
}
