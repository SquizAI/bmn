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
    const { name, description, category, base_price, mockup_template_url, metadata, tier_id } = req.body;

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert({
        name,
        description: description || null,
        category,
        base_price: base_price || 0,
        mockup_template_url: mockup_template_url || null,
        metadata: metadata || null,
        tier_id: tier_id || null,
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

// ── Packaging Templates (admin CRUD) ──────────────────────────────────

/**
 * GET /api/v1/admin/templates
 * List all packaging templates (admin sees inactive too).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function listTemplatesAdmin(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const { category, search } = req.query;

    let query = supabaseAdmin
      .from('packaging_templates')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (category) query = query.eq('category', category);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error, count } = await query.range(offset, offset + limit - 1);
    if (error) throw error;

    res.json({ success: true, data: { items: data, total: count, page, limit } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/templates/:templateId
 * Get a single packaging template (admin view).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getTemplateAdmin(req, res, next) {
  try {
    const { templateId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('packaging_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/templates
 * Create a new packaging template.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function createTemplate(req, res, next) {
  try {
    const {
      slug, name, category, description,
      template_image_url, template_width_px, template_height_px,
      branding_zones, print_specs, ai_prompt_template, reference_images,
    } = req.body;

    const { data, error } = await supabaseAdmin
      .from('packaging_templates')
      .insert({
        slug,
        name,
        category,
        description: description || '',
        template_image_url,
        template_width_px: template_width_px || 1024,
        template_height_px: template_height_px || 1024,
        branding_zones: branding_zones || [],
        print_specs: print_specs || {},
        ai_prompt_template: ai_prompt_template || '',
        reference_images: reference_images || [],
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ success: false, error: 'Template with this slug already exists' });
      }
      throw error;
    }

    logger.info({ templateId: data.id, slug }, 'Packaging template created');
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/admin/templates/:templateId
 * Update an existing packaging template.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function updateTemplate(req, res, next) {
  try {
    const { templateId } = req.params;
    const { data: existing } = await supabaseAdmin
      .from('packaging_templates')
      .select('id')
      .eq('id', templateId)
      .single();

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    const { data, error } = await supabaseAdmin
      .from('packaging_templates')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', templateId)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/admin/templates/:templateId
 * Soft-delete a packaging template (sets is_active = false).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function deleteTemplate(req, res, next) {
  try {
    const { templateId } = req.params;
    const { error } = await supabaseAdmin
      .from('packaging_templates')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', templateId);

    if (error) throw error;
    logger.info({ templateId }, 'Template disabled by admin');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// ── Product Tiers (admin CRUD) ────────────────────────────────────────

/**
 * GET /api/v1/admin/product-tiers
 * List all product tiers (admin sees inactive too).
 * Includes product count per tier.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function listProductTiers(req, res, next) {
  try {
    const { data: tiers, error } = await supabaseAdmin
      .from('product_tiers')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error({ error }, 'Failed to list product tiers');
      throw error;
    }

    // Get product counts per tier
    const { data: counts, error: countErr } = await supabaseAdmin
      .from('products')
      .select('tier_id')
      .eq('is_active', true)
      .not('tier_id', 'is', null);

    if (countErr) {
      logger.error({ error: countErr }, 'Failed to count tier products');
      throw countErr;
    }

    const countMap = {};
    for (const row of counts || []) {
      countMap[row.tier_id] = (countMap[row.tier_id] || 0) + 1;
    }

    const items = tiers.map((tier) => ({
      ...tier,
      product_count: countMap[tier.id] || 0,
    }));

    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/product-tiers/:tierId
 * Get a single product tier with its assigned products.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getProductTier(req, res, next) {
  try {
    const { tierId } = req.params;

    const { data: tier, error } = await supabaseAdmin
      .from('product_tiers')
      .select('*')
      .eq('id', tierId)
      .single();

    if (error || !tier) {
      return res.status(404).json({ success: false, error: 'Product tier not found' });
    }

    // Get products in this tier
    const { data: products, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id, sku, name, category, base_cost, retail_price, image_url, is_active')
      .eq('tier_id', tierId)
      .order('sort_order', { ascending: true });

    if (prodErr) throw prodErr;

    res.json({ success: true, data: { ...tier, products: products || [] } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/product-tiers
 * Create a new product tier.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function createProductTier(req, res, next) {
  try {
    const {
      slug, name, display_name, description,
      sort_order, min_subscription_tier, margin_multiplier,
      badge_color, badge_label,
    } = req.body;

    const { data, error } = await supabaseAdmin
      .from('product_tiers')
      .insert({
        slug,
        name,
        display_name,
        description: description || '',
        sort_order: sort_order ?? 0,
        min_subscription_tier: min_subscription_tier || 'free',
        margin_multiplier: margin_multiplier ?? 1.00,
        badge_color: badge_color || '#6B7280',
        badge_label: badge_label || '',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ success: false, error: 'Product tier with this slug already exists' });
      }
      logger.error({ error }, 'Failed to create product tier');
      throw error;
    }

    logger.info({ tierId: data.id, slug }, 'Product tier created');
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/admin/product-tiers/:tierId
 * Update an existing product tier.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function updateProductTier(req, res, next) {
  try {
    const { tierId } = req.params;

    const { data: existing } = await supabaseAdmin
      .from('product_tiers')
      .select('id')
      .eq('id', tierId)
      .single();

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Product tier not found' });
    }

    const { data, error } = await supabaseAdmin
      .from('product_tiers')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', tierId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ success: false, error: 'Slug already in use by another tier' });
      }
      logger.error({ error, tierId }, 'Failed to update product tier');
      throw error;
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/admin/product-tiers/:tierId
 * Soft-delete a product tier (sets is_active = false).
 * Products in this tier keep their tier_id but the tier won't appear in public listings.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function deleteProductTier(req, res, next) {
  try {
    const { tierId } = req.params;

    const { error } = await supabaseAdmin
      .from('product_tiers')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', tierId);

    if (error) {
      logger.error({ error, tierId }, 'Failed to disable product tier');
      throw error;
    }

    logger.info({ tierId }, 'Product tier disabled by admin');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/admin/product-tiers/:tierId/assign
 * Bulk assign products to a tier.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function assignProductsToTier(req, res, next) {
  try {
    const { tierId } = req.params;
    const { product_ids } = req.body;

    // Verify tier exists
    const { data: tier } = await supabaseAdmin
      .from('product_tiers')
      .select('id, slug')
      .eq('id', tierId)
      .single();

    if (!tier) {
      return res.status(404).json({ success: false, error: 'Product tier not found' });
    }

    // Update all specified products
    const { data, error } = await supabaseAdmin
      .from('products')
      .update({ tier_id: tierId, updated_at: new Date().toISOString() })
      .in('id', product_ids)
      .select('id, sku, name');

    if (error) {
      logger.error({ error, tierId }, 'Failed to assign products to tier');
      throw error;
    }

    logger.info({ tierId, slug: tier.slug, count: data.length }, 'Products assigned to tier');
    res.json({
      success: true,
      data: { assigned: data.length, products: data },
    });
  } catch (err) {
    next(err);
  }
}
