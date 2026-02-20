// server/src/controllers/wizard.js

import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { dispatchJob } from '../queues/dispatch.js';
import { sessionManager } from '../agents/session-manager.js';
import { verifyResumeToken } from '../lib/hmac-tokens.js';

/**
 * POST /api/v1/wizard/start
 * Start a new wizard session and create a draft brand.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function startWizard(req, res, next) {
  try {
    const userId = req.user.id;
    const { brand_name } = req.body;

    // Create brand in draft status
    const { data: brand, error } = await supabaseAdmin
      .from('brands')
      .insert({
        user_id: userId,
        name: brand_name || 'Untitled Brand',
        status: 'draft',
        wizard_step: 'social-analysis',
        wizard_state: {},
      })
      .select()
      .single();

    if (error) {
      logger.error({ error: error.message, userId }, 'Failed to create brand');
      return res.status(500).json({ success: false, error: 'Failed to create brand' });
    }

    logger.info({ brandId: brand.id, userId }, 'Wizard started');

    res.status(201).json({
      success: true,
      data: {
        brandId: brand.id,
        wizardStep: brand.wizard_step,
        wizardState: brand.wizard_state,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/wizard/:brandId/state
 * Get the current wizard state for a brand.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getWizardState(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;

    const { data: brand, error } = await supabaseAdmin
      .from('brands')
      .select('id, name, status, wizard_step, wizard_state, agent_session_id, created_at, updated_at')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (error || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Check for active session in Redis
    const activeSessionId = await sessionManager.get(brandId);

    res.json({
      success: true,
      data: {
        brandId: brand.id,
        name: brand.name,
        status: brand.status,
        wizardStep: brand.wizard_step,
        wizardState: brand.wizard_state,
        hasActiveSession: !!activeSessionId,
        createdAt: brand.created_at,
        updatedAt: brand.updated_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/wizard/:brandId/step
 * Save wizard step data (partial save).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function saveStepData(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;
    const { step, data } = req.body;

    // Verify ownership
    const { data: brand, error: fetchError } = await supabaseAdmin
      .from('brands')
      .select('id, wizard_state')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Merge step data into wizard_state
    const updatedState = {
      ...(brand.wizard_state || {}),
      [step]: data,
    };

    const { error: updateError } = await supabaseAdmin
      .from('brands')
      .update({
        wizard_step: step,
        wizard_state: updatedState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', brandId);

    if (updateError) {
      logger.error({ error: updateError.message, brandId }, 'Failed to save step data');
      return res.status(500).json({ success: false, error: 'Failed to save step data' });
    }

    res.json({
      success: true,
      data: { brandId, step, saved: true },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/wizard/:brandId/analyze-social
 * Queue social media analysis via the Brand Wizard agent (BullMQ).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function analyzeSocial(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;
    const socialHandles = req.body;

    // Verify ownership
    const { data: brand, error } = await supabaseAdmin
      .from('brands')
      .select('id')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (error || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Check for existing session to resume
    const sessionId = await sessionManager.get(brandId);

    // Dispatch brand-wizard job
    const { jobId } = await dispatchJob('brand-wizard', {
      userId,
      brandId,
      step: 'social-analysis',
      sessionId: sessionId || undefined,
      input: { socialHandles },
    });

    // Update brand status
    await supabaseAdmin
      .from('brands')
      .update({ wizard_step: 'social-analysis', updated_at: new Date().toISOString() })
      .eq('id', brandId);

    logger.info({ jobId, brandId, userId }, 'Social analysis job dispatched');

    res.status(202).json({
      success: true,
      data: { jobId, brandId, step: 'social-analysis' },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/wizard/:brandId/generate-identity
 * Queue brand identity generation via BullMQ.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function generateIdentity(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;

    // Verify ownership
    const { data: brand, error } = await supabaseAdmin
      .from('brands')
      .select('id, wizard_state')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (error || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    const sessionId = await sessionManager.get(brandId);

    const { jobId } = await dispatchJob('brand-wizard', {
      userId,
      brandId,
      step: 'brand-identity',
      sessionId: sessionId || undefined,
      input: {
        socialAnalysis: brand.wizard_state?.['social-analysis'] || {},
        userPreferences: req.body,
      },
    });

    await supabaseAdmin
      .from('brands')
      .update({ wizard_step: 'brand-identity', updated_at: new Date().toISOString() })
      .eq('id', brandId);

    logger.info({ jobId, brandId, userId }, 'Identity generation job dispatched');

    res.status(202).json({
      success: true,
      data: { jobId, brandId, step: 'brand-identity' },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/wizard/resume
 * Resume a wizard session from an HMAC-signed token.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function resumeWizard(req, res, next) {
  try {
    const { token } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required to resume wizard' });
    }

    // Verify HMAC token with user ownership check
    const payload = verifyResumeToken(token, userId);
    if (!payload) {
      return res.status(401).json({ success: false, error: 'Invalid or expired resume token' });
    }

    const { brandId } = payload;

    // Fetch brand state
    const { data: brand, error } = await supabaseAdmin
      .from('brands')
      .select('id, name, status, wizard_step, wizard_state, agent_session_id')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (error || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Get cached session
    const activeSessionId = await sessionManager.get(brandId);

    res.json({
      success: true,
      data: {
        brandId: brand.id,
        name: brand.name,
        status: brand.status,
        wizardStep: brand.wizard_step,
        wizardState: brand.wizard_state,
        hasActiveSession: !!activeSessionId,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/wizard/:brandId/complete
 * Mark the wizard as complete, finalize the brand.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function completeWizard(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;

    // Verify ownership
    const { data: brand, error } = await supabaseAdmin
      .from('brands')
      .select('id, name, wizard_state')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (error || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Update brand status to active
    await supabaseAdmin
      .from('brands')
      .update({
        status: 'active',
        wizard_step: 'complete',
        updated_at: new Date().toISOString(),
      })
      .eq('id', brandId);

    // Queue CRM sync
    await dispatchJob('crm-sync', {
      userId,
      eventType: 'brand.completed',
      data: { brandId, brandName: brand.name },
    });

    // Queue confirmation email
    await dispatchJob('email-send', {
      userId,
      templateId: 'brand-complete',
      data: { brandId, brandName: brand.name },
    });

    // Clear agent session cache
    await sessionManager.clear(brandId);

    logger.info({ brandId, userId }, 'Wizard completed');

    res.json({
      success: true,
      data: {
        brandId,
        status: 'active',
        message: 'Brand creation complete!',
      },
    });
  } catch (err) {
    next(err);
  }
}
