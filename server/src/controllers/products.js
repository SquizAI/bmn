// server/src/controllers/products.js

import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

/**
 * GET /api/v1/products
 * List the product catalog with optional category filter and search.
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
    const { category, search } = req.query;

    let query = supabaseAdmin
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      logger.error({ error }, 'Failed to list products');
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
 * GET /api/v1/products/:productId
 * Get a single product by ID.
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
      .select('*')
      .eq('id', productId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, data });
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
