// server/src/controllers/brands.js

import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { dispatchJob } from '../queues/dispatch.js';

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
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error({ error, userId }, 'Failed to list brands');
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

    // Get brand_assets count
    const { count: assetCount } = await supabaseAdmin
      .from('brand_assets')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId);

    res.json({
      success: true,
      data: { ...brand, asset_count: assetCount || 0 },
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

    const { error } = await supabaseAdmin
      .from('brands')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('id', brandId);

    if (error) {
      logger.error({ error, brandId, userId }, 'Failed to delete brand');
      throw error;
    }

    logger.info({ brandId, userId }, 'Brand soft-deleted');
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
