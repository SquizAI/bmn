// server/src/routes/api/v1/public-api.js

import { Router } from 'express';
import { validate } from '../../../middleware/validate.js';
import { requireScope } from '../../../middleware/api-key-auth.js';
import { supabaseAdmin } from '../../../lib/supabase.js';
import { logger } from '../../../lib/logger.js';
import {
  publicBrandListQuerySchema,
  publicCreateBrandSchema,
  publicBrandIdParamSchema,
} from '../../../validation/webhooks-user.js';

export const publicApiRoutes = Router();

// ---------- Brands ----------

/**
 * GET /api/v1/public/brands
 * List brands for the authenticated API key owner.
 */
publicApiRoutes.get(
  '/brands',
  requireScope('brands:read'),
  validate({ query: publicBrandListQuerySchema }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { page, limit, status } = req.query;
      const offset = (page - 1) * limit;

      let query = supabaseAdmin
        .from('brands')
        .select('id, name, status, wizard_step, thumbnail_url, created_at, updated_at', {
          count: 'exact',
        })
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (status) {
        query = query.eq('status', status);
      }

      const { data: brands, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error({ err: error, userId }, 'Public API: failed to list brands');
        throw error;
      }

      res.json({
        success: true,
        data: {
          items: brands || [],
          total: count || 0,
          page,
          limit,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/public/brands
 * Create a new brand.
 */
publicApiRoutes.post(
  '/brands',
  requireScope('brands:write'),
  validate({ body: publicCreateBrandSchema }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { name } = req.body;

      const { data: brand, error } = await supabaseAdmin
        .from('brands')
        .insert({
          user_id: userId,
          name,
          status: 'draft',
          wizard_step: 'onboarding',
        })
        .select('id, name, status, wizard_step, created_at')
        .single();

      if (error) {
        logger.error({ err: error, userId }, 'Public API: failed to create brand');
        throw error;
      }

      logger.info({ userId, brandId: brand.id }, 'Public API: brand created');

      res.status(201).json({
        success: true,
        data: brand,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/public/brands/:id
 * Get a single brand's details.
 */
publicApiRoutes.get(
  '/brands/:id',
  requireScope('brands:read'),
  validate({ params: publicBrandIdParamSchema }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const { data: brand, error } = await supabaseAdmin
        .from('brands')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .single();

      if (error || !brand) {
        return res.status(404).json({
          success: false,
          error: 'Brand not found',
        });
      }

      res.json({
        success: true,
        data: brand,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/public/brands/:id/generate-logo
 * Queue a logo generation job for a brand.
 */
publicApiRoutes.post(
  '/brands/:id/generate-logo',
  requireScope('mockups:generate'),
  validate({ params: publicBrandIdParamSchema }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Verify brand ownership
      const { data: brand, error: brandError } = await supabaseAdmin
        .from('brands')
        .select('id, name, status')
        .eq('id', id)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .single();

      if (brandError || !brand) {
        return res.status(404).json({
          success: false,
          error: 'Brand not found',
        });
      }

      // Create a generation job record
      const { data: job, error: jobError } = await supabaseAdmin
        .from('generation_jobs')
        .insert({
          user_id: userId,
          brand_id: id,
          type: 'logo',
          status: 'queued',
        })
        .select('id, type, status, created_at')
        .single();

      if (jobError) {
        logger.error({ err: jobError, userId, brandId: id }, 'Public API: failed to queue logo generation');
        throw jobError;
      }

      logger.info({ userId, brandId: id, jobId: job.id }, 'Public API: logo generation queued');

      res.status(202).json({
        success: true,
        data: {
          jobId: job.id,
          type: 'logo',
          status: 'queued',
          message: 'Logo generation has been queued. Use the job ID to check progress.',
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/public/brands/:id/generate-mockups
 * Queue mockup generation for a brand.
 */
publicApiRoutes.post(
  '/brands/:id/generate-mockups',
  requireScope('mockups:generate'),
  validate({ params: publicBrandIdParamSchema }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Verify brand ownership
      const { data: brand, error: brandError } = await supabaseAdmin
        .from('brands')
        .select('id, name, status')
        .eq('id', id)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .single();

      if (brandError || !brand) {
        return res.status(404).json({
          success: false,
          error: 'Brand not found',
        });
      }

      // Create a generation job record
      const { data: job, error: jobError } = await supabaseAdmin
        .from('generation_jobs')
        .insert({
          user_id: userId,
          brand_id: id,
          type: 'mockup',
          status: 'queued',
        })
        .select('id, type, status, created_at')
        .single();

      if (jobError) {
        logger.error({ err: jobError, userId, brandId: id }, 'Public API: failed to queue mockup generation');
        throw jobError;
      }

      logger.info({ userId, brandId: id, jobId: job.id }, 'Public API: mockup generation queued');

      res.status(202).json({
        success: true,
        data: {
          jobId: job.id,
          type: 'mockup',
          status: 'queued',
          message: 'Mockup generation has been queued. Use the job ID to check progress.',
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/public/brands/:id/assets
 * List all assets (logos, mockups) for a brand.
 */
publicApiRoutes.get(
  '/brands/:id/assets',
  requireScope('brands:read'),
  validate({ params: publicBrandIdParamSchema }),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Verify brand ownership
      const { data: brand, error: brandError } = await supabaseAdmin
        .from('brands')
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .single();

      if (brandError || !brand) {
        return res.status(404).json({
          success: false,
          error: 'Brand not found',
        });
      }

      const { data: assets, error } = await supabaseAdmin
        .from('brand_assets')
        .select('id, type, url, metadata, created_at')
        .eq('brand_id', id)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error({ err: error, userId, brandId: id }, 'Public API: failed to list brand assets');
        throw error;
      }

      res.json({
        success: true,
        data: { items: assets || [] },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ---------- Analytics ----------

/**
 * GET /api/v1/public/analytics/overview
 * Get an analytics summary for the authenticated user.
 */
publicApiRoutes.get(
  '/analytics/overview',
  requireScope('analytics:read'),
  async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Fetch brand count
      const { count: brandCount } = await supabaseAdmin
        .from('brands')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('deleted_at', null);

      // Fetch active brand count
      const { count: activeBrandCount } = await supabaseAdmin
        .from('brands')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'active')
        .is('deleted_at', null);

      // Fetch total orders
      const { data: brands } = await supabaseAdmin
        .from('brands')
        .select('id')
        .eq('user_id', userId)
        .is('deleted_at', null);

      const brandIds = (brands || []).map((b) => b.id);

      let totalOrders = 0;
      let totalRevenue = 0;

      if (brandIds.length > 0) {
        const { data: orders } = await supabaseAdmin
          .from('orders')
          .select('id, total_amount')
          .in('brand_id', brandIds);

        const orderList = orders || [];
        totalOrders = orderList.length;
        totalRevenue = orderList.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      }

      // Fetch total asset count
      let totalAssets = 0;
      if (brandIds.length > 0) {
        const { count: assetCount } = await supabaseAdmin
          .from('brand_assets')
          .select('id', { count: 'exact', head: true })
          .in('brand_id', brandIds);
        totalAssets = assetCount || 0;
      }

      res.json({
        success: true,
        data: {
          totalBrands: brandCount || 0,
          activeBrands: activeBrandCount || 0,
          totalOrders,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalAssets,
        },
      });
    } catch (err) {
      logger.error({ err, userId: req.user?.id }, 'Public API: analytics overview failed');
      next(err);
    }
  },
);
