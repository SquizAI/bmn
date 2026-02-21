// server/src/controllers/products.js

import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { SUBSCRIPTION_TIER_ORDER } from '../../../shared/schemas/product-tiers.js';

/**
 * GET /api/v1/products
 * List the product catalog with optional category, tier, and search filters.
 * Includes tier data via join. Supports subscription-level gating.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function listProducts(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const { category, search, tier } = req.query;

    // Determine the user's subscription tier for gating (default to 'free')
    const userTier = req.user?.subscription_tier || 'free';
    const userTierLevel = SUBSCRIPTION_TIER_ORDER[userTier] ?? 0;

    let query = supabaseAdmin
      .from('products')
      .select('*, product_tiers!left(id, slug, name, display_name, badge_color, badge_label, min_subscription_tier)', { count: 'exact' })
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    if (tier) {
      query = query.eq('product_tiers.slug', tier);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      logger.error({ error }, 'Failed to list products');
      throw error;
    }

    // Apply subscription gating: filter out products whose tier requires a higher subscription
    const items = (data || []).map((product) => {
      const tierData = product.product_tiers;
      const requiredTier = tierData?.min_subscription_tier || 'free';
      const requiredLevel = SUBSCRIPTION_TIER_ORDER[requiredTier] ?? 0;
      const accessible = userTierLevel >= requiredLevel;

      return {
        ...product,
        tier: tierData ? {
          id: tierData.id,
          slug: tierData.slug,
          name: tierData.name,
          display_name: tierData.display_name,
          badge_color: tierData.badge_color,
          badge_label: tierData.badge_label,
        } : null,
        accessible,
        product_tiers: undefined,
      };
    });

    res.json({
      success: true,
      data: { items, total: count, page, limit },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/products/:productId
 * Get a single product by ID with tier data.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getProduct(req, res, next) {
  try {
    const { productId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*, product_tiers!left(id, slug, name, display_name, badge_color, badge_label, min_subscription_tier)')
      .eq('id', productId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const tierData = data.product_tiers;
    const product = {
      ...data,
      tier: tierData ? {
        id: tierData.id,
        slug: tierData.slug,
        name: tierData.name,
        display_name: tierData.display_name,
        badge_color: tierData.badge_color,
        badge_label: tierData.badge_label,
      } : null,
      product_tiers: undefined,
    };

    res.json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/products/categories
 * List all distinct product categories.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function listCategories(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('category')
      .eq('is_active', true);

    if (error) {
      logger.error({ error }, 'Failed to list categories');
      throw error;
    }

    // Extract unique categories
    const categories = [...new Set(data.map((row) => row.category))].sort();

    res.json({ success: true, data: { categories } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/products/tiers
 * List all active product tiers (public endpoint).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function listProductTiers(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('product_tiers')
      .select('id, slug, name, display_name, description, badge_color, badge_label, min_subscription_tier, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      logger.error({ error }, 'Failed to list product tiers');
      throw error;
    }

    res.json({ success: true, data: { tiers: data } });
  } catch (err) {
    next(err);
  }
}
