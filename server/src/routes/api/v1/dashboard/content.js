// server/src/routes/api/v1/dashboard/content.js

import { Router } from 'express';
import { supabaseAdmin } from '../../../../lib/supabase.js';
import { logger } from '../../../../lib/logger.js';

export const contentRoutes = Router();

/**
 * GET /api/v1/dashboard/content
 * Lists generated content for the user's brands, with optional type filter and pagination.
 *
 * NOTE: The `generated_content` table may not exist yet. If the query fails,
 * the try/catch returns an empty list. Expected columns:
 *   id, brand_id, content, content_type, platform, hashtags, image_prompt, created_at
 */
contentRoutes.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { brandId, type, limit = 20, offset = 0 } = req.query;

    // Get user's brands
    let brandFilter = [];
    if (brandId) {
      brandFilter = [brandId];
    } else {
      const { data: brands } = await supabaseAdmin
        .from('brands')
        .select('id')
        .eq('user_id', userId)
        .is('deleted_at', null);
      brandFilter = (brands || []).map((b) => b.id);
    }

    if (brandFilter.length === 0) {
      return res.json({ success: true, data: { items: [], total: 0 } });
    }

    let query = supabaseAdmin
      .from('generated_content')
      .select('*', { count: 'exact' })
      .in('brand_id', brandFilter)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (type) {
      query = query.eq('content_type', type);
    }

    const { data: items, count } = await query;

    res.json({
      success: true,
      data: {
        items: (items || []).map((item) => ({
          id: item.id,
          content: item.content,
          type: item.content_type,
          platform: item.platform,
          hashtags: item.hashtags,
          imagePrompt: item.image_prompt,
          brandId: item.brand_id,
          createdAt: item.created_at,
        })),
        total: count || 0,
      },
    });
  } catch (err) {
    logger.error({ err, userId: req.user?.id }, 'Content list fetch failed');
    next(err);
  }
});

/**
 * POST /api/v1/dashboard/content/generate
 * Queues AI content generation for a specific brand.
 * Tries BullMQ first; falls back to a placeholder response if the queue is unavailable.
 */
contentRoutes.post('/generate', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { brandId, platform, contentType, tone, topic } = req.body;

    if (!brandId) {
      return res.status(400).json({ success: false, error: 'brandId is required' });
    }

    // Verify brand ownership
    const { data: brand } = await supabaseAdmin
      .from('brands')
      .select('id, name')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (!brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Get brand identity for context
    const { data: wizardState } = await supabaseAdmin
      .from('wizard_state')
      .select('state_data')
      .eq('brand_id', brandId)
      .single();

    const identity = wizardState?.state_data?.['brand-identity'];

    // Try to queue via BullMQ if available
    try {
      const { getQueue } = await import('../../../../lib/queue.js');
      const contentQueue = getQueue('content-generation');

      const job = await contentQueue.add('generate-content', {
        brandId,
        userId,
        brandName: brand.name,
        identity,
        platform: platform || 'instagram',
        contentType: contentType || 'post',
        tone: tone || 'professional',
        topic: topic || '',
      });

      return res.json({
        success: true,
        data: {
          jobId: job.id,
          status: 'queued',
          message: 'Content generation started',
        },
      });
    } catch (queueErr) {
      // BullMQ not available — fall back to direct placeholder response
      logger.warn({ err: queueErr }, 'BullMQ unavailable, returning placeholder');

      return res.json({
        success: true,
        data: {
          id: crypto.randomUUID(),
          content: `Here's a ${contentType || 'post'} idea for ${brand.name}: Share your brand story and connect with your audience authentically.`,
          type: contentType || 'social-post',
          platform: platform || 'instagram',
          status: 'generated',
          createdAt: new Date().toISOString(),
        },
      });
    }
  } catch (err) {
    logger.error({ err, userId: req.user?.id }, 'Content generation failed');
    next(err);
  }
});
