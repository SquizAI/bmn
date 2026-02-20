// server/src/controllers/admin.js

import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

/**
 * GET /api/v1/admin/users
 * List all users with pagination and search.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function listUsers(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const { search } = req.query;

    let query = supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      logger.error({ error }, 'Failed to list users');
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
 * GET /api/v1/admin/users/:userId
 * Get detailed user info including brands and subscription.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getUser(req, res, next) {
  try {
    const { userId } = req.params;

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Get brand count
    const { count: brandCount } = await supabaseAdmin
      .from('brands')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('status', 'deleted');

    res.json({
      success: true,
      data: {
        ...profile,
        brand_count: brandCount || 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/brands
 * List all brands across all users with pagination and filters.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function listAllBrands(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const { status, search } = req.query;

    let query = supabaseAdmin
      .from('brands')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      logger.error({ error }, 'Failed to list all brands');
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
 * POST /api/v1/admin/products
 * Create a new product in the catalog.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function createProduct(req, res, next) {
  try {
    const { name, description, category, base_price, mockup_template_url, metadata } = req.body;

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert({
        name,
        description: description || null,
        category,
        base_price: base_price || 0,
        mockup_template_url: mockup_template_url || null,
        metadata: metadata || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      logger.error({ error }, 'Failed to create product');
      throw error;
    }

    logger.info({ productId: data.id }, 'Product created by admin');
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/admin/products/:productId
 * Update an existing product.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function updateProduct(req, res, next) {
  try {
    const { productId } = req.params;

    // Verify product exists
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('products')
      .select('id')
      .eq('id', productId)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      logger.error({ error, productId }, 'Failed to update product');
      throw error;
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/admin/products/:productId
 * Disable a product (soft delete).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function disableProduct(req, res, next) {
  try {
    const { productId } = req.params;

    const { error } = await supabaseAdmin
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', productId);

    if (error) {
      logger.error({ error, productId }, 'Failed to disable product');
      throw error;
    }

    logger.info({ productId }, 'Product disabled by admin');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/jobs
 * Get BullMQ job queue status and counts.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getJobStatus(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const { status, queue_name } = req.query;

    let query = supabaseAdmin
      .from('generation_jobs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (queue_name) {
      query = query.eq('queue_name', queue_name);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      logger.error({ error }, 'Failed to get job status');
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
 * GET /api/v1/admin/metrics
 * Get system metrics (costs, generation counts, user counts).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getMetrics(req, res, next) {
  try {
    // Run all metric queries in parallel
    const [usersResult, brandsResult, activeBrandsResult, jobsResult, creditsResult] =
      await Promise.all([
        supabaseAdmin
          .from('profiles')
          .select('*', { count: 'exact', head: true }),

        supabaseAdmin
          .from('brands')
          .select('*', { count: 'exact', head: true })
          .neq('status', 'deleted'),

        supabaseAdmin
          .from('brands')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active'),

        supabaseAdmin
          .from('generation_jobs')
          .select('*', { count: 'exact', head: true }),

        supabaseAdmin
          .from('credit_transactions')
          .select('amount'),
      ]);

    // Sum credit usage (negative amounts are debits)
    const totalCreditsUsed = (creditsResult.data || [])
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const totalCreditsAdded = (creditsResult.data || [])
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    res.json({
      success: true,
      data: {
        total_users: usersResult.count || 0,
        total_brands: brandsResult.count || 0,
        active_brands: activeBrandsResult.count || 0,
        total_generation_jobs: jobsResult.count || 0,
        credits: {
          total_used: totalCreditsUsed,
          total_added: totalCreditsAdded,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}
