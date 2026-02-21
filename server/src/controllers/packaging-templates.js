// server/src/controllers/packaging-templates.js

import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

/**
 * GET /api/v1/packaging-templates
 * List all active packaging templates.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function listTemplates(req, res, next) {
  try {
    const { category } = req.query;
    let query = supabaseAdmin
      .from('packaging_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: { items: data } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/packaging-templates/:templateId
 * Get a single template with full zone definitions.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getTemplate(req, res, next) {
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
 * GET /api/v1/packaging-templates/by-category/:category
 * List templates for a specific category.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getTemplatesByCategory(req, res, next) {
  try {
    const { category } = req.params;

    const { data, error } = await supabaseAdmin
      .from('packaging_templates')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    res.json({ success: true, data: { items: data } });
  } catch (err) {
    next(err);
  }
}
