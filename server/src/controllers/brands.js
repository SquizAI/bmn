// server/src/controllers/brands.js

import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { dispatchJob } from '../queues/dispatch.js';

// ── Helpers: transform DB rows into client-expected shapes ──────────

/**
 * Transform a raw brand row into the summary shape for brand list cards.
 * Maps snake_case DB fields to camelCase and extracts key summary data.
 *
 * @param {object} row - Raw Supabase brand row
 * @param {string|null} [thumbnailUrl] - Optional first logo URL
 * @returns {object} Brand summary for list view
 */
function toBrandSummary(row, thumbnailUrl = null) {
  const ws = row.wizard_state || {};
  const identity = ws['brand-identity'];
  const selectedDir = identity?.directions?.find(
    (d) => d.id === identity?.selectedDirectionId
  );

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    wizardStep: row.wizard_step || 'onboarding',
    thumbnailUrl: thumbnailUrl || null,
    archetype: selectedDir?.archetype || null,
    primaryColor: selectedDir?.colorPalette?.[0]?.hex || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Transform a raw brand row + assets into the full BrandDetail shape.
 *
 * @param {object} row - Raw Supabase brand row
 * @param {object[]} logoAssets - brand_assets rows with asset_type='logo'
 * @param {object[]} mockupAssets - brand_assets rows with asset_type='mockup'
 * @returns {object} BrandDetail matching client TypeScript interface
 */
function toBrandDetail(row, logoAssets = [], mockupAssets = []) {
  const ws = row.wizard_state || {};
  const identityState = ws['brand-identity'];
  const productsState = ws['product-recommendations'];

  // Extract the selected direction's identity data
  const selectedDir = identityState?.directions?.find(
    (d) => d.id === identityState?.selectedDirectionId
  ) || identityState?.directions?.[0] || null;

  let identity = null;
  if (selectedDir) {
    identity = {
      vision: selectedDir.vision || identityState?.vision || '',
      archetype: selectedDir.archetype || '',
      values: selectedDir.values || [],
      targetAudience: selectedDir.targetAudience || '',
      colorPalette: (selectedDir.colorPalette || []).map((c) => ({
        hex: c.hex || c.color || '',
        name: c.name || '',
        role: c.role || 'accent',
      })),
      fonts: {
        primary: selectedDir.fonts?.primary || selectedDir.typography?.primary || 'Inter',
        secondary: selectedDir.fonts?.secondary || selectedDir.typography?.secondary || 'Space Grotesk',
      },
    };
  }

  // Map logo assets to LogoAsset shape
  const logos = logoAssets.map((a) => ({
    id: a.id,
    url: a.url || '',
    thumbnailUrl: a.thumbnail_url || a.url || '',
    status: a.metadata?.status || 'generated',
    prompt: a.metadata?.prompt || undefined,
    model: a.metadata?.model || undefined,
  }));

  // Map mockup assets to MockupAsset shape
  const mockups = mockupAssets.map((a) => ({
    id: a.id,
    url: a.url || '',
    productSku: a.metadata?.product_sku || '',
    productName: a.metadata?.product_name || '',
    status: a.metadata?.status || 'pending',
  }));

  // Extract projections from product recommendations
  const projections = (productsState?.revenueProjection || productsState?.products || [])
    .map((p) => ({
      productSku: p.sku || p.productSku || '',
      productName: p.name || p.productName || '',
      costPrice: p.costPrice || p.cost_price || 0,
      retailPrice: p.retailPrice || p.retail_price || 0,
      margin: p.margin || 0,
      projectedMonthlySales: p.projectedMonthlySales || p.projected_monthly_sales || 0,
      monthlyRevenue: p.monthlyRevenue || p.monthly_revenue || 0,
      monthlyProfit: p.monthlyProfit || p.monthly_profit || 0,
    }));

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    wizardStep: row.wizard_step || 'onboarding',
    identity,
    logos,
    mockups,
    projections,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Route Handlers ──────────────────────────────────────────────────

/**
 * GET /api/v1/brands
 * List all brands for the authenticated user.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function listBrands(req, res, next) {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabaseAdmin
      .from('brands')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error({ error, userId }, 'Failed to list brands');
      throw error;
    }

    // Fetch first logo asset for each brand (for thumbnail)
    const brandIds = data.map((b) => b.id);
    let logoMap = {};
    if (brandIds.length > 0) {
      const { data: logos } = await supabaseAdmin
        .from('brand_assets')
        .select('brand_id, url')
        .in('brand_id', brandIds)
        .eq('asset_type', 'logo')
        .order('created_at', { ascending: true });

      if (logos) {
        for (const logo of logos) {
          if (!logoMap[logo.brand_id]) {
            logoMap[logo.brand_id] = logo.url;
          }
        }
      }
    }

    const items = data.map((row) => toBrandSummary(row, logoMap[row.id] || null));

    res.json({
      success: true,
      data: { items, total: count, page, limit },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/brands
 * Create a new brand.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function createBrand(req, res, next) {
  try {
    const userId = req.user.id;
    const { name, description } = req.body;

    const { data, error } = await supabaseAdmin
      .from('brands')
      .insert({
        user_id: userId,
        org_id: req.profile.org_id,
        name,
        description: description || null,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      logger.error({ error, userId }, 'Failed to create brand');
      throw error;
    }

    logger.info({ brandId: data.id, userId }, 'Brand created');

    // Dispatch CRM sync if GHL is configured
    if (process.env.GHL_CLIENT_ID || process.env.GHL_ACCESS_TOKEN) {
      try {
        await dispatchJob('crm-sync', {
          userId,
          eventType: 'wizard.started',
          data: { brandId: data.id, brandName: name },
        });
      } catch (err) {
        logger.warn({ userId, brandId: data.id, error: err.message }, 'Failed to queue CRM sync for brand creation');
      }
    }

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/brands/:brandId
 * Get a single brand by ID (scoped to authenticated user).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getBrand(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;

    const { data: brand, error } = await supabaseAdmin
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .single();

    if (error || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Fetch logo and mockup assets for this brand
    const { data: assets } = await supabaseAdmin
      .from('brand_assets')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: true });

    const logoAssets = (assets || []).filter((a) => a.asset_type === 'logo');
    const mockupAssets = (assets || []).filter((a) => a.asset_type === 'mockup');

    res.json({
      success: true,
      data: toBrandDetail(brand, logoAssets, mockupAssets),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/brands/:brandId
 * Update a brand.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function updateBrand(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;

    // Verify ownership
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('brands')
      .select('id')
      .eq('id', brandId)
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    const { data, error } = await supabaseAdmin
      .from('brands')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', brandId)
      .select()
      .single();

    if (error) {
      logger.error({ error, brandId, userId }, 'Failed to update brand');
      throw error;
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/brands/:brandId
 * Delete a brand (soft delete).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function deleteBrand(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;

    // Verify ownership (exclude already-archived brands)
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('brands')
      .select('id')
      .eq('id', brandId)
      .eq('user_id', userId)
      .neq('status', 'archived')
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Soft-delete by archiving (status enum: draft/generating/review/complete/archived)
    const { error } = await supabaseAdmin
      .from('brands')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', brandId);

    if (error) {
      logger.error({ error, brandId, userId }, 'Failed to delete brand');
      throw error;
    }

    logger.info({ brandId, userId }, 'Brand archived (soft-deleted)');

    // Dispatch CRM sync if GHL is configured
    if (process.env.GHL_CLIENT_ID || process.env.GHL_ACCESS_TOKEN) {
      try {
        await dispatchJob('crm-sync', {
          userId,
          eventType: 'wizard.abandoned',
          data: { brandId },
        });
      } catch (err) {
        logger.warn({ userId, brandId, error: err.message }, 'Failed to queue CRM sync for brand deletion');
      }
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/brands/:brandId/assets
 * List all assets for a brand (logos, mockups, bundles).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function listBrandAssets(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;
    const { asset_type } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    // Verify brand ownership
    const { data: brand, error: brandErr } = await supabaseAdmin
      .from('brands')
      .select('id')
      .eq('id', brandId)
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .single();

    if (brandErr || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    let query = supabaseAdmin
      .from('brand_assets')
      .select('*', { count: 'exact' })
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false });

    if (asset_type) {
      query = query.eq('asset_type', asset_type);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      logger.error({ error, brandId }, 'Failed to list brand assets');
      throw error;
    }

    res.json({
      success: true,
      data: { items: data, total: count, page, limit },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/brands/:brandId/generate/logos
 * Queue logo generation via BullMQ.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function generateLogos(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;

    // Load brand with wizard_state to extract identity data for logo prompts
    const { data: brand, error: brandErr } = await supabaseAdmin
      .from('brands')
      .select('id, name, wizard_state')
      .eq('id', brandId)
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .single();

    if (brandErr || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Extract brand identity from wizard_state
    const ws = brand.wizard_state || {};
    const identity = ws['brand-identity'] || {};
    const directions = identity.directions || [];
    const selectedDir = directions.find((d) => d.id === identity.selectedDirectionId) || directions[0];

    const colorPalette = (selectedDir?.colorPalette || identity.colorPalette || [])
      .map((c) => (typeof c === 'string' ? c : c.hex))
      .filter(Boolean);

    // Extract industry/niche from social analysis or identity data
    const socialAnalysis = ws['social-analysis'] || {};
    const rawIndustry = socialAnalysis.niche || socialAnalysis.industry
      || selectedDir?.industry || identity.industry || '';
    // Coerce to string -- AI sometimes stores niche/industry as an object
    const industry = typeof rawIndustry === 'string'
      ? rawIndustry
      : (rawIndustry?.name || rawIndustry?.primaryNiche?.name || rawIndustry?.label || '');

    // Coerce logoStyle to a valid enum value
    const VALID_LOGO_STYLES = ['minimal', 'bold', 'vintage', 'modern', 'playful'];
    const rawStyle = req.body.style || selectedDir?.logoStyle?.style || selectedDir?.logoStyle || identity.logoStyle || 'modern';
    const styleStr = typeof rawStyle === 'string' ? rawStyle.toLowerCase().trim() : 'modern';
    const logoStyle = VALID_LOGO_STYLES.includes(styleStr) ? styleStr : 'modern';

    // Truncate brandVision to fit schema max (2000 chars)
    const rawVision = selectedDir?.vision || identity.vision || '';
    const brandVision = typeof rawVision === 'string' ? rawVision.slice(0, 2000) : '';

    // Coerce archetype to string
    const rawArchetype = selectedDir?.archetype?.name || selectedDir?.archetype || identity.archetype || '';
    const archetype = typeof rawArchetype === 'string' ? rawArchetype.slice(0, 200) : '';

    const result = await dispatchJob('logo-generation', {
      userId,
      brandId,
      brandName: (brand.name && brand.name !== 'Untitled Brand' ? brand.name : null)
        || ws['brand-name']?.name
        || brand.name
        || 'Brand',
      logoStyle,
      colorPalette: colorPalette.length > 0 ? colorPalette : ['#6366F1', '#EC4899', '#F59E0B'],
      brandVision,
      archetype,
      industry: industry.slice(0, 200),
      count: req.body.count || 4,
    });

    logger.info({ jobId: result.jobId, brandId, userId }, 'Logo generation job dispatched');

    // Dispatch CRM sync if GHL is configured
    if (process.env.GHL_CLIENT_ID || process.env.GHL_ACCESS_TOKEN) {
      try {
        await dispatchJob('crm-sync', {
          userId,
          eventType: 'logo.generated',
          data: { brandId, brandName: brand.name },
        });
      } catch (err) {
        logger.warn({ userId, brandId, error: err.message }, 'Failed to queue CRM sync for logo generation');
      }
    }

    res.status(202).json({
      success: true,
      data: { jobId: result.jobId, queueName: result.queueName },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/brands/:brandId/upload-logo
 * Register a user-uploaded logo (uploaded to Supabase Storage from the client).
 * Expects { url: string, fileName: string } in the body.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function uploadLogo(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;
    const { url, fileName } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing logo URL' });
    }

    // Verify brand ownership
    const { data: brand, error: brandErr } = await supabaseAdmin
      .from('brands')
      .select('id')
      .eq('id', brandId)
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .single();

    if (brandErr || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Determine if the uploaded logo is raster (needs vectorization)
    const isRaster = /\.(png|jpe?g|webp)$/i.test(fileName || '') ||
      /image\/(png|jpeg|webp)/.test(url);
    const isSvg = /\.svg$/i.test(fileName || '') || url.includes('.svg');

    // Attempt to vectorize raster logos to SVG
    let svgUrl = null;
    if (isRaster && !isSvg) {
      try {
        const { recraftClient } = await import('../services/providers.js');
        const result = await recraftClient.vectorize({ imageUrl: url });
        svgUrl = result.svgUrl;
        logger.info({ brandId, svgUrl }, 'Uploaded logo vectorized to SVG');
      } catch (vecErr) {
        logger.warn({ err: vecErr, brandId }, 'Failed to vectorize uploaded logo, keeping raster');
      }
    }

    // Create brand_asset record for the uploaded logo
    const { data: asset, error: insertErr } = await supabaseAdmin
      .from('brand_assets')
      .insert({
        brand_id: brandId,
        asset_type: 'logo',
        url: svgUrl || url,
        is_selected: false,
        metadata: {
          source: 'user_upload',
          file_name: fileName || 'uploaded-logo',
          uploaded_at: new Date().toISOString(),
          original_url: url,
          svg_url: svgUrl,
          png_url: isRaster ? url : null,
          has_vector: !!svgUrl || isSvg,
          was_vectorized: !!svgUrl,
        },
      })
      .select()
      .single();

    if (insertErr) {
      logger.error({ err: insertErr, brandId }, 'Failed to save uploaded logo asset');
      return res.status(500).json({ success: false, error: 'Failed to save logo' });
    }

    logger.info({ assetId: asset.id, brandId, userId, vectorized: !!svgUrl }, 'User logo uploaded');

    res.json({
      success: true,
      data: asset,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/brands/:brandId/generate/mockups
 * Queue mockup generation via BullMQ.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function generateMockups(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;

    // Verify brand ownership
    const { data: brand, error: brandErr } = await supabaseAdmin
      .from('brands')
      .select('id')
      .eq('id', brandId)
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .single();

    if (brandErr || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    const result = await dispatchJob('brand-wizard', {
      userId,
      brandId,
      step: 'mockup-review',
      input: req.body,
      creditCost: req.body.creditCost || 1,
    });

    logger.info({ jobId: result.jobId, brandId, userId }, 'Mockup generation job dispatched');

    // Dispatch CRM sync if GHL is configured
    if (process.env.GHL_CLIENT_ID || process.env.GHL_ACCESS_TOKEN) {
      try {
        await dispatchJob('crm-sync', {
          userId,
          eventType: 'mockup.generated',
          data: { brandId },
        });
      } catch (err) {
        logger.warn({ userId, brandId, error: err.message }, 'Failed to queue CRM sync for mockup generation');
      }
    }

    res.status(202).json({
      success: true,
      data: { jobId: result.jobId, queueName: result.queueName },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/brands/:brandId/download
 * Download a ZIP of all brand assets (logos, mockups, guidelines).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function downloadBrandAssets(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;

    // Verify brand ownership
    const { data: brand, error: brandErr } = await supabaseAdmin
      .from('brands')
      .select('id, name, status')
      .eq('id', brandId)
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .single();

    if (brandErr || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Fetch all assets for this brand
    const { data: assets, error: assetsErr } = await supabaseAdmin
      .from('brand_assets')
      .select('id, asset_type, url, metadata')
      .eq('brand_id', brandId)
      .order('asset_type', { ascending: true })
      .order('created_at', { ascending: true });

    if (assetsErr) {
      logger.error({ error: assetsErr, brandId }, 'Failed to fetch brand assets for download');
      throw assetsErr;
    }

    if (!assets || assets.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No assets found for this brand. Generate logos or mockups first.',
      });
    }

    // Set response headers for ZIP download
    const safeName = (brand.name || 'brand').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-assets.zip"`);

    // Use archiver to stream ZIP to client
    const archiver = (await import('archiver')).default;
    const archive = archiver('zip', { zlib: { level: 5 } });

    archive.on('error', (archiveErr) => {
      logger.error({ error: archiveErr, brandId }, 'Archive stream error');
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Failed to generate ZIP archive' });
      }
    });

    archive.pipe(res);

    // Track folder counters for unique file names
    const folderCounts = {};

    // Download each asset and append to the archive
    for (const asset of assets) {
      if (!asset.url) continue;

      const folder = asset.asset_type || 'other';
      folderCounts[folder] = (folderCounts[folder] || 0) + 1;

      // Determine file extension from URL or metadata
      const urlPath = asset.url.split('?')[0];
      const ext = urlPath.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `${folder}/${folderCounts[folder]}-${asset.id.slice(0, 8)}.${ext}`;

      try {
        // Check if the URL is a Supabase Storage path or external URL
        const isSupabasePath = asset.url.includes('/storage/v1/object/');
        let assetBuffer;

        if (isSupabasePath) {
          // Extract the storage path from the full URL
          const storagePath = asset.url.split('/brand-assets/').pop()?.split('?')[0];
          if (storagePath) {
            const { data: fileData, error: dlErr } = await supabaseAdmin.storage
              .from('brand-assets')
              .download(storagePath);

            if (dlErr || !fileData) {
              logger.warn({ assetId: asset.id, error: dlErr }, 'Failed to download asset from Supabase Storage');
              continue;
            }
            assetBuffer = Buffer.from(await fileData.arrayBuffer());
          }
        }

        if (!assetBuffer) {
          // Fetch from external URL (e.g. FAL.ai, Recraft CDN)
          const response = await fetch(asset.url, {
            signal: AbortSignal.timeout(30_000),
          });

          if (!response.ok) {
            logger.warn({ assetId: asset.id, status: response.status }, 'Failed to fetch asset URL');
            continue;
          }

          assetBuffer = Buffer.from(await response.arrayBuffer());
        }

        archive.append(assetBuffer, { name: fileName });
      } catch (dlError) {
        logger.warn({ assetId: asset.id, error: dlError.message }, 'Skipping asset in ZIP download');
      }
    }

    await archive.finalize();
    logger.info({ brandId, userId, assetCount: assets.length }, 'Brand asset ZIP downloaded');
  } catch (err) {
    next(err);
  }
}
