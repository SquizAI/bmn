// server/src/controllers/wizard.js

import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { dispatchJob } from '../queues/dispatch.js';
import { sessionManager } from '../agents/session-manager.js';
import { verifyResumeToken } from '../lib/hmac-tokens.js';
import { routeModel } from '../skills/_shared/model-router.js';
import { SYSTEM_PROMPT as BRAND_GENERATOR_PROMPT, buildDirectionsTaskPrompt } from '../skills/brand-generator/prompts.js';
import { SYSTEM_PROMPT as NAME_GENERATOR_PROMPT } from '../skills/name-generator/prompts.js';

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
      .select('id, name, wizard_state')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (error || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Return cached directions if they already exist and no regeneration was requested
    const existingDirections = brand.wizard_state?.['brand-identity']?.directions;
    if (existingDirections && existingDirections.length > 0 && !req.body?.regenerate) {
      logger.info({ brandId, userId }, 'Returning cached brand identity directions');
      return res.json({
        success: true,
        data: {
          cached: true,
          brandId,
          step: 'brand-identity',
          directions: existingDirections,
          socialContext: brand.wizard_state?.['brand-identity']?.socialContext || null,
        },
      });
    }

    // Call Claude directly to generate 3 brand identity directions
    const socialAnalysis = brand.wizard_state?.['social-analysis'] || {};
    const taskPrompt = buildDirectionsTaskPrompt({
      socialAnalysis,
      brandId,
      userId,
      brandName: brand.name || null,
      userPreferences: req.body,
    });

    logger.info({ brandId, userId }, 'Calling Claude for brand identity directions');

    const aiResult = await routeModel('brand-vision', {
      systemPrompt: BRAND_GENERATOR_PROMPT,
      prompt: taskPrompt,
      maxTokens: 8192,
      temperature: 0.8,
      jsonMode: true,
    });

    // Parse the AI response
    let parsed;
    try {
      // Extract JSON from the response (handle markdown code blocks)
      let jsonText = aiResult.text.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonText = jsonMatch[1].trim();
      parsed = JSON.parse(jsonText);
    } catch (parseErr) {
      logger.error({ brandId, error: parseErr.message, rawText: aiResult.text.slice(0, 500) }, 'Failed to parse AI directions response');
      return res.status(500).json({ success: false, error: 'Failed to parse AI-generated directions' });
    }

    const directions = parsed.directions || [];
    const socialContext = parsed.socialContext || null;

    // Cache in wizard_state
    const updatedState = {
      ...(brand.wizard_state || {}),
      'brand-identity': {
        ...(brand.wizard_state?.['brand-identity'] || {}),
        directions,
        socialContext,
        generatedAt: new Date().toISOString(),
        model: aiResult.model,
      },
    };

    await supabaseAdmin
      .from('brands')
      .update({
        wizard_step: 'brand-identity',
        wizard_state: updatedState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', brandId);

    logger.info({ brandId, userId, model: aiResult.model, directionCount: directions.length }, 'Brand identity directions generated');

    res.json({
      success: true,
      data: {
        brandId,
        step: 'brand-identity',
        directions,
        socialContext,
        model: aiResult.model,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/wizard/:brandId/generate-names
 * Queue brand name generation.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function generateNames(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;

    const { data: brand, error } = await supabaseAdmin
      .from('brands')
      .select('id, wizard_state')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (error || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Return cached names if they exist and no regeneration was requested
    const existingNames = brand.wizard_state?.['brand-names']?.suggestions;
    if (existingNames && existingNames.length > 0 && !req.body?.regenerate) {
      logger.info({ brandId, userId }, 'Returning cached name suggestions');
      return res.json({
        success: true,
        data: {
          cached: true,
          brandId,
          step: 'brand-names',
          suggestions: existingNames,
          topRecommendation: brand.wizard_state?.['brand-names']?.topRecommendation || existingNames[0]?.name,
        },
      });
    }

    // Build context from wizard state
    const brandIdentity = brand.wizard_state?.['brand-identity'] || {};
    const socialAnalysis = brand.wizard_state?.['social-analysis'] || {};
    const selectedDirection = brandIdentity.directions?.find(
      (d) => d.id === brandIdentity.selectedDirectionId
    ) || brandIdentity.directions?.[0] || {};

    const contextParts = [];
    if (selectedDirection.vision) contextParts.push(`Brand Vision: ${selectedDirection.vision}`);
    if (selectedDirection.archetype?.name) contextParts.push(`Archetype: ${selectedDirection.archetype.name}`);
    if (selectedDirection.values?.length > 0) contextParts.push(`Core Values: ${selectedDirection.values.join(', ')}`);
    if (socialAnalysis.niche?.primaryNiche?.name) contextParts.push(`Niche: ${socialAnalysis.niche.primaryNiche.name}`);
    if (socialAnalysis.personality?.traits?.length > 0) contextParts.push(`Personality: ${socialAnalysis.personality.traits.join(', ')}`);
    if (req.body?.archetype) contextParts.push(`User-Preferred Archetype: ${req.body.archetype}`);
    if (req.body?.traits?.length > 0) contextParts.push(`User Traits: ${req.body.traits.join(', ')}`);

    const taskPrompt = `Generate 8-10 creative brand name suggestions based on the following brand identity context:

Brand ID: ${brandId}

<brand_context>
${contextParts.length > 0 ? contextParts.join('\n') : 'No prior brand context available. Generate creative, versatile brand names suitable for a personal creator brand.'}
</brand_context>

${req.body?.userPreferences ? `<user_preferences>\n${JSON.stringify(req.body.userPreferences, null, 2)}\n</user_preferences>\n` : ''}
Generate names using various techniques (portmanteau, evocative, invented, metaphor, descriptive). For each name, provide rationale, pronunciation guide, memorability/brandability scores, and note that domain/trademark checks require separate verification. Return as structured JSON per the output format.`;

    logger.info({ brandId, userId }, 'Calling Claude for brand name suggestions');

    const aiResult = await routeModel('name-generation', {
      systemPrompt: NAME_GENERATOR_PROMPT,
      prompt: taskPrompt,
      maxTokens: 6144,
      temperature: 0.9,
      jsonMode: true,
    });

    // Parse the AI response
    let parsed;
    try {
      let jsonText = aiResult.text.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonText = jsonMatch[1].trim();
      parsed = JSON.parse(jsonText);
    } catch (parseErr) {
      logger.error({ brandId, error: parseErr.message, rawText: aiResult.text.slice(0, 500) }, 'Failed to parse AI names response');
      return res.status(500).json({ success: false, error: 'Failed to parse AI-generated names' });
    }

    const suggestions = parsed.suggestions || [];
    const topRecommendation = parsed.topRecommendation || suggestions[0]?.name;

    // Cache in wizard_state
    const updatedState = {
      ...(brand.wizard_state || {}),
      'brand-names': {
        suggestions,
        topRecommendation,
        generatedAt: new Date().toISOString(),
        model: aiResult.model,
      },
    };

    await supabaseAdmin
      .from('brands')
      .update({
        wizard_state: updatedState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', brandId);

    logger.info({ brandId, userId, model: aiResult.model, nameCount: suggestions.length }, 'Brand names generated');

    res.json({
      success: true,
      data: {
        brandId,
        step: 'brand-names',
        suggestions,
        topRecommendation,
        model: aiResult.model,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/wizard/:brandId/recommend-products
 * Get AI product recommendations.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function recommendProducts(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;

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
      step: 'product-recommendations',
      sessionId: sessionId || undefined,
      input: {
        brandIdentity: brand.wizard_state?.['brand-identity'] || {},
        socialAnalysis: brand.wizard_state?.['social-analysis'] || {},
        userPreferences: req.body,
      },
    });

    logger.info({ jobId, brandId, userId }, 'Product recommendation job dispatched');

    res.status(202).json({
      success: true,
      data: { jobId, brandId, step: 'product-recommendations' },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/wizard/:brandId/generate-mockups
 * Queue mockup generation.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function generateMockups(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;

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
      step: 'mockup-generation',
      sessionId: sessionId || undefined,
      input: {
        brandIdentity: brand.wizard_state?.['brand-identity'] || {},
        selectedProducts: brand.wizard_state?.['product-selection'] || {},
        userPreferences: req.body,
      },
    });

    logger.info({ jobId, brandId, userId }, 'Mockup generation job dispatched');

    res.status(202).json({
      success: true,
      data: { jobId, brandId, step: 'mockup-generation' },
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
