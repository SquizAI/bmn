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
      step: 'logo-generation',
      input: req.body,
      creditCost: req.body.creditCost || 1,
    });

    logger.info({ jobId: result.jobId, brandId, userId }, 'Logo generation job dispatched');

    res.status(202).json({
      success: true,
      data: { jobId: result.jobId, queueName: result.queueName },
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

    // TODO: Implement ZIP generation from Supabase Storage
    // For now, return a 501 indicating the feature is not yet available.
    logger.info({ brandId, userId }, 'Brand asset download requested (not yet implemented)');

    res.status(501).json({
      success: false,
      error: 'Brand asset download is coming soon. Your assets are available individually from the brand detail page.',
    });
  } catch (err) {
    next(err);
  }
}
