// server/src/controllers/wizard.js

import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { sessionManager } from '../agents/session-manager.js';
import { signResumeToken, verifyResumeToken } from '../lib/hmac-tokens.js';
import { routeModel } from '../skills/_shared/model-router.js';
import {
  SYSTEM_PROMPT as BRAND_GENERATOR_PROMPT,
  buildDirectionsTaskPrompt,
  CONTEXT_ANALYSIS_SYSTEM,
  buildContextAnalysisPrompt,
  DIRECTION_GENERATION_SYSTEM,
  buildDirectionPrompt,
  buildDirectionsBCPrompt,
  VALIDATION_SYSTEM,
  buildValidationPrompt,
} from '../skills/brand-generator/prompts.js';
import { SYSTEM_PROMPT as NAME_GENERATOR_PROMPT } from '../skills/name-generator/prompts.js';
import { analyzeCompetitors as runCompetitorAnalysis } from '../services/competitor.js';
import { scrapeWebsite } from '../services/website-scraper.js';
import { generateDossierPdf } from '../services/pdf-generator.js';

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
        org_id: req.profile.org_id,
        name: brand_name || 'Untitled Brand',
        status: 'draft',
        wizard_step: 'social',
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
// Map client step names → valid DB wizard_step values.
// The DB trigger only accepts these: onboarding, social, identity, colors, fonts,
// logos, products, mockups, bundles, projections, checkout, complete.
const CLIENT_STEP_TO_DB = {
  'social-analysis': 'social',
  'brand-name': 'social',
  'brand-identity': 'identity',
  'logo-generation': 'logos',
  'product-selection': 'products',
  'mockup-review': 'mockups',
  'bundle-builder': 'bundles',
  'profit-calculator': 'projections',
  'completion': 'complete',
  // Also allow DB step names directly
  'onboarding': 'onboarding',
  'social': 'social',
  'identity': 'identity',
  'colors': 'colors',
  'fonts': 'fonts',
  'logos': 'logos',
  'products': 'products',
  'mockups': 'mockups',
  'bundles': 'bundles',
  'projections': 'projections',
  'checkout': 'checkout',
  'complete': 'complete',
};

// Ordered list of all DB wizard steps. The Supabase validate_wizard_step()
// trigger enforces sequential (+1) progression, so we must advance through
// every intermediate step when the wizard UI skips steps like colors/fonts/checkout.
const STEP_ORDER = [
  'onboarding', 'social', 'identity', 'colors', 'fonts',
  'logos', 'products', 'mockups', 'bundles', 'projections',
  'checkout', 'complete',
];

/**
 * Advance a brand's wizard_step through every intermediate step up to (and
 * including) the target step. This satisfies the DB trigger which only allows
 * moving forward by exactly one step at a time.
 *
 * @param {string} brandId
 * @param {string} targetStep - one of the values in STEP_ORDER
 * @returns {Promise<void>}
 */
async function advanceToStep(brandId, targetStep) {
  // Fetch current step
  const { data } = await supabaseAdmin
    .from('brands')
    .select('wizard_step')
    .eq('id', brandId)
    .single();

  const currentStep = data?.wizard_step || 'onboarding';
  const currentIdx = STEP_ORDER.indexOf(currentStep);
  const targetIdx = STEP_ORDER.indexOf(targetStep);

  // Already at or past this step — nothing to do
  if (targetIdx <= currentIdx) return;

  // Walk through each intermediate step one-by-one
  for (let i = currentIdx + 1; i <= targetIdx; i++) {
    const { error } = await supabaseAdmin
      .from('brands')
      .update({ wizard_step: STEP_ORDER[i], updated_at: new Date().toISOString() })
      .eq('id', brandId);

    if (error) {
      logger.error(
        { brandId, step: STEP_ORDER[i], error: error.message },
        'advanceToStep: failed to advance wizard step',
      );
      throw new Error(`Failed to advance wizard to step: ${STEP_ORDER[i]}`);
    }
  }
}

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

    // Merge step data into wizard_state (keyed by the client step name)
    const updatedState = {
      ...(brand.wizard_state || {}),
      [step]: data,
    };

    // Only update wizard_step if the client step maps to a valid DB step
    const dbStep = CLIENT_STEP_TO_DB[step];

    // First, save wizard_state (this never triggers the step validation)
    const { error: stateError } = await supabaseAdmin
      .from('brands')
      .update({
        wizard_state: updatedState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', brandId);

    if (stateError) {
      logger.error({ error: stateError.message, brandId }, 'Failed to save step data');
      return res.status(500).json({ success: false, error: 'Failed to save step data' });
    }

    // Then advance through any intermediate steps to reach the target DB step.
    // This walks step-by-step so the DB trigger (which only allows +1) is satisfied.
    if (dbStep) {
      try {
        await advanceToStep(brandId, dbStep);
      } catch (advanceErr) {
        logger.error({ error: advanceErr.message, brandId, dbStep }, 'Failed to advance wizard step');
        return res.status(500).json({ success: false, error: 'Failed to advance wizard step' });
      }
    }

    // Social proof: increment selected_count for each chosen product
    if (step === 'product-selection' && data?.selectedProducts?.length) {
      for (const productId of data.selectedProducts) {
        const { error: rpcError } = await supabaseAdmin.rpc(
          'increment_product_selected_count',
          { p_product_id: productId },
        );
        if (rpcError) {
          logger.warn(
            { productId, error: rpcError.message },
            'Failed to increment product selected_count (non-blocking)',
          );
        }
      }
      logger.info(
        { brandId, productCount: data.selectedProducts.length },
        'Incremented selected_count for chosen products',
      );
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
 * Normalize a social handle for comparison (strip @, lowercase).
 * @param {string|undefined} handle
 * @returns {string}
 */
function normalizeHandle(handle) {
  return (handle || '').replace(/^@/, '').toLowerCase().trim();
}

/**
 * Check if submitted handles match what's already cached.
 * @param {Object} submitted - The handles from the request body
 * @param {Object} cached - The socialHandles stored in wizard_state
 * @returns {boolean}
 */
function handlesMatch(submitted, cached) {
  if (!cached) return false;
  const platforms = ['instagram', 'tiktok', 'youtube', 'twitter', 'facebook'];
  return platforms.every(
    (p) => normalizeHandle(submitted[p]) === normalizeHandle(cached[p]),
  );
}

/**
 * Scrape an Instagram profile via Apify. Returns null if Apify is unavailable.
 * @param {string} handle
 * @returns {Promise<Object|null>}
 */
async function scrapeInstagramProfile(handle) {
  try {
    const { ApifyClient } = await import('apify-client');
    const { config } = await import('../config/index.js');
    if (!config.APIFY_API_TOKEN) {
      logger.warn('No APIFY_API_TOKEN set -- skipping Instagram scrape');
      return null;
    }
    const client = new ApifyClient({ token: config.APIFY_API_TOKEN });

    logger.info({ handle }, 'Scraping Instagram via Apify');
    const run = await client.actor('apify/instagram-profile-scraper').call(
      { usernames: [handle], resultsLimit: 20 },
      { waitSecs: 120 },
    );

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    if (!items || items.length === 0) {
      logger.warn({ handle }, 'Apify returned no data for Instagram handle');
      return null;
    }

    const profile = items[0];
    return {
      platform: 'instagram',
      handle,
      displayName: profile.fullName || handle,
      bio: profile.biography || null,
      followers: profile.followersCount || 0,
      following: profile.followsCount || 0,
      postsCount: profile.postsCount || 0,
      isVerified: profile.verified || false,
      profilePicUrl: profile.profilePicUrl || profile.profilePicUrlHD || null,
      externalUrl: profile.externalUrl || null,
      posts: (profile.latestPosts || []).slice(0, 20).map((post) => ({
        id: post.id,
        type: post.type || 'Image',
        caption: post.caption || '',
        likes: post.likesCount || 0,
        comments: post.commentsCount || 0,
        timestamp: post.timestamp,
        imageUrl: post.displayUrl || null,
        videoUrl: post.videoUrl || null,
        hashtags: post.hashtags || [],
      })),
    };
  } catch (err) {
    logger.error({ handle, error: err.message }, 'Instagram Apify scrape failed -- will use AI knowledge');
    return null;
  }
}

/**
 * Scrape a public Instagram page via Firecrawl for rich supplementary context.
 * Firecrawl is especially good at extracting text content from public profiles.
 * @param {string} handle - Instagram handle without @
 * @returns {Promise<Object|null>}
 */
async function scrapeWithFirecrawl(handle) {
  try {
    const FirecrawlApp = (await import('@mendable/firecrawl-js')).default;
    const { config } = await import('../config/index.js');
    if (!config.FIRECRAWL_API_KEY || config.FIRECRAWL_API_KEY === 'placeholder') {
      logger.debug('No FIRECRAWL_API_KEY set -- skipping Firecrawl enrichment');
      return null;
    }

    const firecrawl = new FirecrawlApp({ apiKey: config.FIRECRAWL_API_KEY });

    logger.info({ handle }, 'Enriching profile data via Firecrawl');

    // Scrape the public Instagram profile page
    const igResult = await firecrawl.scrapeUrl(`https://www.instagram.com/${handle}/`, {
      formats: ['markdown'],
      timeout: 30000,
    });

    if (!igResult.success) {
      logger.warn({ handle, error: igResult.error }, 'Firecrawl Instagram scrape failed');
      return null;
    }

    const result = { instagramPage: igResult.markdown || null, externalLinks: null };

    // If the Apify data had an external URL (linktree, website), scrape that too
    // (we'll call this separately if we have a URL)
    logger.info({ handle, hasIgData: !!result.instagramPage }, 'Firecrawl enrichment complete');
    return result;
  } catch (err) {
    logger.warn({ handle, error: err.message }, 'Firecrawl enrichment failed -- continuing without it');
    return null;
  }
}

/**
 * Scrape external URL (linktree, website) via Firecrawl for brand context.
 * @param {string} url
 * @returns {Promise<string|null>}
 */
async function scrapeExternalUrl(url) {
  if (!url) return null;
  try {
    const FirecrawlApp = (await import('@mendable/firecrawl-js')).default;
    const { config } = await import('../config/index.js');
    if (!config.FIRECRAWL_API_KEY || config.FIRECRAWL_API_KEY === 'placeholder') return null;

    const firecrawl = new FirecrawlApp({ apiKey: config.FIRECRAWL_API_KEY });
    const result = await firecrawl.scrapeUrl(url, {
      formats: ['markdown'],
      timeout: 20000,
    });

    return result.success ? result.markdown : null;
  } catch (err) {
    logger.warn({ url, error: err.message }, 'External URL scrape failed');
    return null;
  }
}

/**
 * POST /api/v1/wizard/:brandId/analyze-social
 * Analyze social media profiles and generate a Creator Dossier.
 *
 * Flow:
 *  1. Check cache -- return cached dossier directly if handles match (no BullMQ).
 *  2. Scrape real data via Apify + Firecrawl in parallel (stays synchronous, ~10-30s).
 *  3. Dispatch a `social-analysis` BullMQ job with the scraped data payload.
 *  4. Return immediately with `{ jobId, status: 'processing' }`.
 *  5. The worker (`social-analysis-worker.js`) handles chunked AI processing
 *     and emits Socket.io progress events for the client to track.
 *
 * Response shapes (backward-compatible):
 *  - Cache hit:  `{ cached: true, dossier: {...} }`
 *  - New job:    `{ jobId: "...", status: "processing" }`
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
      .select('id, name, wizard_state')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (error || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Return cached dossier ONLY if handles match and no regeneration was requested
    const existingDossier = brand.wizard_state?.['social-analysis'];
    const cachedHandles = existingDossier?.socialHandles;
    if (
      existingDossier &&
      existingDossier.profile &&
      !req.body?.regenerate &&
      handlesMatch(socialHandles, cachedHandles)
    ) {
      logger.info({ brandId, userId }, 'Returning cached social analysis dossier (handles match)');
      return res.json({
        success: true,
        data: {
          cached: true,
          brandId,
          step: 'social-analysis',
          dossier: existingDossier,
        },
      });
    }

    // Build handles list for the prompt
    const handleParts = [];
    if (socialHandles.instagram) handleParts.push(`Instagram: @${socialHandles.instagram.replace(/^@/, '')}`);
    if (socialHandles.tiktok) handleParts.push(`TikTok: @${socialHandles.tiktok.replace(/^@/, '')}`);
    if (socialHandles.youtube) handleParts.push(`YouTube: @${socialHandles.youtube.replace(/^@/, '')}`);
    if (socialHandles.twitter) handleParts.push(`Twitter/X: @${socialHandles.twitter.replace(/^@/, '')}`);
    if (socialHandles.facebook) handleParts.push(`Facebook: ${socialHandles.facebook}`);

    if (handleParts.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one social handle is required' });
    }

    // ── Step 1: Scrape real data via Apify + Firecrawl in parallel ──
    let scrapedData = null;
    let firecrawlData = null;
    if (socialHandles.instagram) {
      const igHandle = socialHandles.instagram.replace(/^@/, '');
      // Run Apify (structured data) and Firecrawl (rich page context) in parallel
      const [apifyResult, firecrawlResult] = await Promise.allSettled([
        scrapeInstagramProfile(igHandle),
        scrapeWithFirecrawl(igHandle),
      ]);
      scrapedData = apifyResult.status === 'fulfilled' ? apifyResult.value : null;
      firecrawlData = firecrawlResult.status === 'fulfilled' ? firecrawlResult.value : null;

      // If Apify found an external URL, scrape that too via Firecrawl
      if (scrapedData?.externalUrl) {
        const extContent = await scrapeExternalUrl(scrapedData.externalUrl);
        if (extContent) {
          firecrawlData = { ...(firecrawlData || {}), externalLinks: extContent };
        }
      }
    }

    // ── Step 2: Dispatch AI analysis to BullMQ ──
    // The heavy AI processing runs asynchronously in a worker.
    // The worker emits Socket.io progress events as it processes chunks.
    const { getQueue } = await import('../queues/index.js');
    const queue = getQueue('social-analysis');

    const job = await queue.add('analyze', {
      brandId,
      userId,
      socialHandles,
      scrapedData,
      firecrawlData,
      brandName: brand?.name || null,
    }, {
      priority: 1,
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
    });

    logger.info({
      brandId,
      userId,
      jobId: job.id,
      handles: handleParts,
      handleCount: handleParts.length,
      hasApifyData: !!scrapedData,
      hasFirecrawlData: !!firecrawlData,
      scrapedFollowers: scrapedData?.followers || null,
    }, 'Social analysis job dispatched to BullMQ');

    // Return immediately with job ID for Socket.io tracking
    return res.json({
      success: true,
      data: {
        brandId,
        step: 'social-analysis',
        jobId: job.id,
        status: 'processing',
        message: 'Social analysis started. Track progress via WebSocket.',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Timeout wrapper for AI model calls.
 * @param {Promise} promise - The model call promise
 * @param {number} ms - Timeout in milliseconds
 * @param {string} label - Step label for error messages
 * @returns {Promise}
 */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

/**
 * Parse a JSON response from an AI model, handling markdown code blocks.
 * @param {string} text - Raw AI response text
 * @returns {Object} Parsed JSON object
 */
function parseAiJson(text) {
  let jsonText = text.trim();
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonText = jsonMatch[1].trim();
  return JSON.parse(jsonText);
}

/**
 * Emit a generation progress event via Socket.io to the user's room.
 * @param {import('socket.io').Server|null} io - Socket.io server instance
 * @param {string} userId - User ID for room targeting
 * @param {Object} payload - Progress event payload
 * @param {string} payload.phase - Current phase (analyzing, generating, complete)
 * @param {number} payload.progress - Progress percentage (0-100)
 * @param {string} payload.message - Human-readable status message
 * @param {Object} [payload.data] - Partial data (e.g. directions as they complete)
 */
function emitProgress(io, userId, payload) {
  if (!io) return;
  try {
    io.to(`user:${userId}`).emit('generation:progress', payload);
  } catch (err) {
    logger.warn({ userId, error: err.message }, 'Failed to emit generation:progress');
  }
}

/**
 * Emit a generation complete event via Socket.io.
 * @param {import('socket.io').Server|null} io
 * @param {string} userId
 * @param {Object} result
 */
function emitComplete(io, userId, result) {
  if (!io) return;
  try {
    io.to(`user:${userId}`).emit('generation:complete', { result });
  } catch (err) {
    logger.warn({ userId, error: err.message }, 'Failed to emit generation:complete');
  }
}

/**
 * POST /api/v1/wizard/:brandId/generate-identity
 *
 * Generate 3 brand identity directions using a 4-step chunked pipeline:
 *   Step 1: ANALYZE_CONTEXT   (Haiku, ~15s) -- distill social data + suggest 3 archetypes
 *   Step 2: GENERATE_DIR_A    (Sonnet, ~25s) -- build complete direction A
 *   Step 3: GENERATE_DIR_B_C  (Sonnet, ~25s) -- build directions B & C (contrasted with A)
 *   Step 4: VALIDATE_HARMONIZE (Haiku, ~10s) -- cross-check colors, fonts, differentiation
 *
 * Emits Socket.io `generation:progress` events during each step.
 * Falls back to the monolithic single-call approach if the pipeline fails.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function generateIdentity(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;
    const io = req.app.locals.io || null;

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

    const socialAnalysis = brand.wizard_state?.['social-analysis'] || {};
    const brandName = brand.name && brand.name !== 'Untitled Brand' ? brand.name : null;
    const startTime = Date.now();
    const modelsUsed = [];

    logger.info({ brandId, userId }, 'Starting 4-step brand identity pipeline');

    // ──────────────────────────────────────────────────────────────────────
    // STEP 1: ANALYZE_CONTEXT (Haiku, ~15s)
    // Distill social data into a concise context + suggest 3 archetypes
    // ──────────────────────────────────────────────────────────────────────
    emitProgress(io, userId, {
      phase: 'analyzing',
      progress: 10,
      message: 'Analyzing your social DNA...',
    });

    let contextResult;
    try {
      const contextPrompt = buildContextAnalysisPrompt({
        socialAnalysis,
        brandName,
        userPreferences: req.body,
      });

      const step1Result = await withTimeout(
        routeModel('context-analysis', {
          systemPrompt: CONTEXT_ANALYSIS_SYSTEM,
          prompt: contextPrompt,
          maxTokens: 1024,
          temperature: 0.7,
          jsonMode: true,
        }),
        60_000,
        'Step 1 (context analysis)',
      );

      contextResult = parseAiJson(step1Result.text);
      modelsUsed.push({ step: 'context-analysis', model: step1Result.model });

      logger.info(
        { brandId, step: 1, model: step1Result.model, archetypes: contextResult.archetypes?.length, durationMs: Date.now() - startTime },
        'Step 1 complete: context analyzed',
      );
    } catch (step1Err) {
      logger.error({ brandId, error: step1Err.message }, 'Step 1 failed -- falling back to monolithic generation');
      return await fallbackMonolithicGeneration(req, res, brand, socialAnalysis, brandName, io, userId);
    }

    const { socialContext, archetypes } = contextResult;
    if (!archetypes || archetypes.length < 3) {
      logger.warn({ brandId, archetypeCount: archetypes?.length }, 'Step 1 returned fewer than 3 archetypes -- falling back');
      return await fallbackMonolithicGeneration(req, res, brand, socialAnalysis, brandName, io, userId);
    }

    emitProgress(io, userId, {
      phase: 'analyzing',
      progress: 25,
      message: 'Social context analyzed. Crafting direction 1 of 3...',
    });

    // ──────────────────────────────────────────────────────────────────────
    // STEP 2: GENERATE_DIRECTION_A (Sonnet, ~25s)
    // Build the first complete brand direction
    // ──────────────────────────────────────────────────────────────────────
    emitProgress(io, userId, {
      phase: 'generating',
      progress: 30,
      message: 'Crafting direction 1 of 3...',
    });

    let directionA;
    try {
      const dirAPrompt = buildDirectionPrompt({
        socialContext,
        archetype: archetypes[0],
        brandName,
      });

      const step2Result = await withTimeout(
        routeModel('brand-vision', {
          systemPrompt: DIRECTION_GENERATION_SYSTEM,
          prompt: dirAPrompt,
          maxTokens: 3072,
          temperature: 0.8,
          jsonMode: true,
        }),
        60_000,
        'Step 2 (direction A)',
      );

      directionA = parseAiJson(step2Result.text);
      modelsUsed.push({ step: 'direction-a', model: step2Result.model });

      logger.info(
        { brandId, step: 2, model: step2Result.model, label: directionA.label, durationMs: Date.now() - startTime },
        'Step 2 complete: direction A generated',
      );
    } catch (step2Err) {
      logger.error({ brandId, error: step2Err.message }, 'Step 2 failed -- attempting retry then fallback');

      // Retry once with slightly different temperature
      try {
        const retryPrompt = buildDirectionPrompt({
          socialContext,
          archetype: archetypes[0],
          brandName,
        });

        const retryResult = await withTimeout(
          routeModel('brand-vision', {
            systemPrompt: DIRECTION_GENERATION_SYSTEM,
            prompt: retryPrompt,
            maxTokens: 3072,
            temperature: 0.9,
            jsonMode: true,
          }),
          60_000,
          'Step 2 retry (direction A)',
        );

        directionA = parseAiJson(retryResult.text);
        modelsUsed.push({ step: 'direction-a-retry', model: retryResult.model });
      } catch (retryErr) {
        logger.error({ brandId, error: retryErr.message }, 'Step 2 retry failed -- falling back to monolithic');
        return await fallbackMonolithicGeneration(req, res, brand, socialAnalysis, brandName, io, userId);
      }
    }

    // Emit partial data so the client can show the first direction card
    emitProgress(io, userId, {
      phase: 'generating',
      progress: 50,
      message: 'Direction 1 complete! Crafting directions 2 and 3...',
      data: { directions: [directionA] },
    });

    // ──────────────────────────────────────────────────────────────────────
    // STEP 3: GENERATE_DIRECTIONS_B_C (Sonnet, ~25s)
    // Build directions B and C, contrasted against direction A
    // ──────────────────────────────────────────────────────────────────────
    let directionB;
    let directionC;
    try {
      const dirBCPrompt = buildDirectionsBCPrompt({
        socialContext,
        archetypes: [archetypes[1], archetypes[2]],
        brandName,
        directionA,
      });

      const step3Result = await withTimeout(
        routeModel('brand-vision', {
          systemPrompt: DIRECTION_GENERATION_SYSTEM,
          prompt: dirBCPrompt,
          maxTokens: 4096,
          temperature: 0.8,
          jsonMode: true,
        }),
        60_000,
        'Step 3 (directions B & C)',
      );

      const parsedBC = parseAiJson(step3Result.text);
      const bcDirections = parsedBC.directions || [];
      directionB = bcDirections[0] || null;
      directionC = bcDirections[1] || null;
      modelsUsed.push({ step: 'directions-bc', model: step3Result.model });

      logger.info(
        { brandId, step: 3, model: step3Result.model, dirCount: bcDirections.length, durationMs: Date.now() - startTime },
        'Step 3 complete: directions B & C generated',
      );
    } catch (step3Err) {
      logger.error({ brandId, error: step3Err.message }, 'Step 3 failed -- returning direction A only');

      // Graceful degradation: return whatever directions we have
      const partialDirections = [directionA];
      emitProgress(io, userId, {
        phase: 'generating',
        progress: 85,
        message: 'Partial results ready (1 direction). Finalizing...',
        data: { directions: partialDirections, socialContext },
      });

      // Save and return partial results
      return await saveAndRespond(res, brand, brandId, userId, partialDirections, socialContext, modelsUsed, startTime, io);
    }

    // Collect all completed directions
    const allDirections = [directionA];
    if (directionB) allDirections.push(directionB);
    if (directionC) allDirections.push(directionC);

    emitProgress(io, userId, {
      phase: 'generating',
      progress: 85,
      message: `All ${allDirections.length} directions crafted. Validating...`,
      data: { directions: allDirections, socialContext },
    });

    // ──────────────────────────────────────────────────────────────────────
    // STEP 4: VALIDATE_HARMONIZE (Haiku, ~10s)
    // Cross-check colors, fonts, and differentiation
    // ──────────────────────────────────────────────────────────────────────
    let finalDirections = allDirections;
    try {
      if (allDirections.length >= 3) {
        const validationPrompt = buildValidationPrompt(allDirections);

        const step4Result = await withTimeout(
          routeModel('brand-validation', {
            systemPrompt: VALIDATION_SYSTEM,
            prompt: validationPrompt,
            maxTokens: 2048,
            temperature: 0.3,
            jsonMode: true,
          }),
          60_000,
          'Step 4 (validation)',
        );

        const validated = parseAiJson(step4Result.text);
        if (validated.directions && validated.directions.length >= allDirections.length) {
          finalDirections = validated.directions;
          modelsUsed.push({ step: 'validation', model: step4Result.model });

          if (validated.fixes?.length > 0) {
            logger.info(
              { brandId, step: 4, fixes: validated.fixes },
              'Step 4: validation applied fixes',
            );
          }
        }

        logger.info(
          { brandId, step: 4, model: step4Result.model, durationMs: Date.now() - startTime },
          'Step 4 complete: directions validated',
        );
      } else {
        logger.info({ brandId, dirCount: allDirections.length }, 'Skipping validation (fewer than 3 directions)');
      }
    } catch (step4Err) {
      // Validation failure is non-fatal -- use unvalidated directions
      logger.warn({ brandId, error: step4Err.message }, 'Step 4 (validation) failed -- using unvalidated directions');
    }

    emitProgress(io, userId, {
      phase: 'complete',
      progress: 100,
      message: 'Brand directions ready!',
      data: { directions: finalDirections, socialContext },
    });

    // Save and return final results
    return await saveAndRespond(res, brand, brandId, userId, finalDirections, socialContext, modelsUsed, startTime, io);
  } catch (err) {
    next(err);
  }
}

/**
 * Save brand identity directions to wizard_state and send HTTP response.
 * @param {import('express').Response} res
 * @param {Object} brand - Brand record from DB
 * @param {string} brandId
 * @param {string} userId
 * @param {Array} directions
 * @param {string|null} socialContext
 * @param {Array} modelsUsed
 * @param {number} startTime
 * @param {import('socket.io').Server|null} io
 */
async function saveAndRespond(res, brand, brandId, userId, directions, socialContext, modelsUsed, startTime, io) {
  const updatedState = {
    ...(brand.wizard_state || {}),
    'brand-identity': {
      ...(brand.wizard_state?.['brand-identity'] || {}),
      directions,
      socialContext,
      generatedAt: new Date().toISOString(),
      modelsUsed,
      pipeline: 'chunked-4-step',
    },
  };

  const { error: updateError } = await supabaseAdmin
    .from('brands')
    .update({
      wizard_step: 'identity',
      wizard_state: updatedState,
      updated_at: new Date().toISOString(),
    })
    .eq('id', brandId);

  if (updateError) {
    logger.error({ brandId, error: updateError.message, code: updateError.code }, 'Failed to save brand identity to wizard_state');
  }

  const totalDurationMs = Date.now() - startTime;
  logger.info(
    { brandId, userId, directionCount: directions.length, modelsUsed, totalDurationMs, stateSize: JSON.stringify(updatedState).length },
    'Brand identity pipeline complete',
  );

  emitComplete(io, userId, { directions, socialContext });

  res.json({
    success: true,
    data: {
      brandId,
      step: 'brand-identity',
      directions,
      socialContext,
      model: modelsUsed.map((m) => m.model).join(', '),
    },
  });
}

/**
 * Fallback: generate all 3 directions in a single monolithic AI call.
 * Used when the chunked pipeline fails at an early step.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {Object} brand
 * @param {Object} socialAnalysis
 * @param {string|null} brandName
 * @param {import('socket.io').Server|null} io
 * @param {string} userId
 */
async function fallbackMonolithicGeneration(req, res, brand, socialAnalysis, brandName, io, userId) {
  const brandId = brand.id;
  const startTime = Date.now();

  emitProgress(io, userId, {
    phase: 'generating',
    progress: 30,
    message: 'Generating all brand directions (fallback mode)...',
  });

  logger.info({ brandId, userId }, 'Falling back to monolithic brand identity generation');

  const taskPrompt = buildDirectionsTaskPrompt({
    socialAnalysis,
    brandId,
    userId,
    brandName,
    userPreferences: req.body,
  });

  try {
    const aiResult = await withTimeout(
      routeModel('brand-vision', {
        systemPrompt: BRAND_GENERATOR_PROMPT,
        prompt: taskPrompt,
        maxTokens: 8192,
        temperature: 0.8,
        jsonMode: true,
      }),
      120_000,
      'Monolithic fallback',
    );

    const parsed = parseAiJson(aiResult.text);
    const directions = parsed.directions || [];
    const socialContext = parsed.socialContext || null;
    const modelsUsed = [{ step: 'monolithic-fallback', model: aiResult.model }];

    return await saveAndRespond(res, brand, brandId, userId, directions, socialContext, modelsUsed, startTime, io);
  } catch (fallbackErr) {
    logger.error({ brandId, error: fallbackErr.message }, 'Monolithic fallback also failed');
    return res.status(503).json({
      success: false,
      error: 'Brand identity generation is temporarily unavailable. Please try again in a moment.',
    });
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
 * Get AI product recommendations via Claude.
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
      .select('id, name, wizard_state')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (error || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Return cached recommendations if they exist and no regeneration was requested
    const existingRecs = brand.wizard_state?.['product-recommendations']?.products;
    if (existingRecs && existingRecs.length > 0 && !req.body?.regenerate) {
      logger.info({ brandId, userId }, 'Returning cached product recommendations');
      return res.json({
        success: true,
        data: {
          cached: true,
          brandId,
          step: 'product-recommendations',
          products: existingRecs,
          bundles: brand.wizard_state?.['product-recommendations']?.bundles || [],
          revenueProjection: brand.wizard_state?.['product-recommendations']?.revenueProjection || null,
        },
      });
    }

    // Build context from wizard state
    const brandIdentity = brand.wizard_state?.['brand-identity'] || {};
    const socialAnalysis = brand.wizard_state?.['social-analysis'] || {};
    const brandNames = brand.wizard_state?.['brand-names'] || {};
    const selectedDirection = brandIdentity.directions?.find(
      (d) => d.id === brandIdentity.selectedDirectionId
    ) || brandIdentity.directions?.[0] || {};

    const contextParts = [];
    if (brand.name && brand.name !== 'Untitled Brand') contextParts.push(`Brand Name: ${brand.name}`);
    if (selectedDirection.vision) contextParts.push(`Brand Vision: ${selectedDirection.vision}`);
    if (selectedDirection.archetype?.name) contextParts.push(`Archetype: ${selectedDirection.archetype.name}`);
    if (selectedDirection.values?.length > 0) contextParts.push(`Core Values: ${selectedDirection.values.join(', ')}`);
    if (socialAnalysis.niche?.primaryNiche?.name) contextParts.push(`Niche: ${socialAnalysis.niche.primaryNiche.name}`);
    if (socialAnalysis.personality?.traits?.length > 0) contextParts.push(`Personality: ${socialAnalysis.personality.traits.join(', ')}`);
    if (socialAnalysis.aesthetic?.naturalPalette?.length > 0) contextParts.push(`Brand Colors: ${socialAnalysis.aesthetic.naturalPalette.join(', ')}`);
    if (socialAnalysis.audience?.estimatedAgeRange) contextParts.push(`Target Age Range: ${socialAnalysis.audience.estimatedAgeRange}`);
    if (socialAnalysis.audience?.primaryInterests?.length > 0) contextParts.push(`Audience Interests: ${socialAnalysis.audience.primaryInterests.join(', ')}`);
    if (socialAnalysis.profile?.totalFollowers) contextParts.push(`Followers: ${socialAnalysis.profile.totalFollowers}`);

    const taskPrompt = `You are a product strategist for a creator brand. Based on the brand context below, recommend 8-12 physical products that this creator should sell.

<brand_context>
${contextParts.length > 0 ? contextParts.join('\n') : 'A personal creator brand looking for product recommendations.'}
</brand_context>

${req.body?.preferences ? `<user_preferences>\n${JSON.stringify(req.body.preferences, null, 2)}\n</user_preferences>\n` : ''}

Return a JSON object with this exact structure:
{
  "products": [
    {
      "id": "string (unique slug like 'premium-hoodie')",
      "name": "string (product name)",
      "category": "apparel|accessories|drinkware|stationery|home|tech|wellness|art",
      "description": "string (compelling 1-2 sentence description)",
      "basePrice": number (wholesale cost),
      "suggestedRetailPrice": number,
      "marginPercent": number (0-100),
      "printAreas": ["front", "back", "sleeve"],
      "mockupPrompt": "string (GPT Image 1.5 prompt for generating a photorealistic product mockup with brand logo)",
      "popularity": number (1-10 score, how likely this creator's audience would buy),
      "reasoning": "string (why this product fits this brand)",
      "tags": ["string tags"],
      "tier": "essential|premium|luxury"
    }
  ],
  "bundles": [
    {
      "id": "string (unique slug)",
      "name": "string (bundle name)",
      "description": "string",
      "productIds": ["string array of product ids from above"],
      "discountPercent": number (5-25),
      "bundlePrice": number,
      "reasoning": "string"
    }
  ],
  "revenueProjection": {
    "estimatedMonthlyRevenue": {"low": number, "mid": number, "high": number},
    "estimatedAnnualRevenue": {"low": number, "mid": number, "high": number},
    "conversionRate": number (0-1 decimal),
    "avgOrderValue": number,
    "methodology": "string explaining how the projection was calculated"
  }
}

IMPORTANT:
- Products must be realistic print-on-demand or branded merch items
- Prices should be market-rate for the quality tier
- Include a mix of price points (some accessible, some premium)
- Bundles should combine 2-4 complementary products
- Revenue projections should be based on the creator's follower count and typical creator conversion rates
- Every product needs a detailed mockupPrompt optimized for GPT Image 1.5 that would create a great product image`;

    logger.info({ brandId, userId }, 'Calling Claude for product recommendations');

    const aiResult = await routeModel('brand-vision', {
      prompt: taskPrompt,
      maxTokens: 8192,
      temperature: 0.7,
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
      logger.error({ brandId, error: parseErr.message, rawText: aiResult.text.slice(0, 500) }, 'Failed to parse product recommendations AI response');
      return res.status(500).json({ success: false, error: 'Failed to parse AI-generated product recommendations' });
    }

    const products = parsed.products || [];
    const bundles = parsed.bundles || [];
    const revenueProjection = parsed.revenueProjection || null;

    // Cache in wizard_state
    const updatedState = {
      ...(brand.wizard_state || {}),
      'product-recommendations': {
        products,
        bundles,
        revenueProjection,
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

    logger.info({ brandId, userId, model: aiResult.model, productCount: products.length }, 'Product recommendations generated');

    res.json({
      success: true,
      data: {
        brandId,
        step: 'product-recommendations',
        products,
        bundles,
        revenueProjection,
        model: aiResult.model,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/wizard/:brandId/generate-mockups
 * Generate product mockup descriptions via Claude (image generation queued separately).
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
      .select('id, name, wizard_state')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (error || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Return cached mockups if they exist and no regeneration was requested
    const existingMockups = brand.wizard_state?.['mockup-generation']?.mockups;
    if (existingMockups && existingMockups.length > 0 && !req.body?.regenerate) {
      logger.info({ brandId, userId }, 'Returning cached mockup descriptions');
      return res.json({
        success: true,
        data: {
          cached: true,
          brandId,
          step: 'mockup-generation',
          mockups: existingMockups,
        },
      });
    }

    // Gather brand context
    const brandIdentity = brand.wizard_state?.['brand-identity'] || {};
    const socialAnalysis = brand.wizard_state?.['social-analysis'] || {};
    const productRecs = brand.wizard_state?.['product-recommendations'] || {};
    const selectedProducts = brand.wizard_state?.['product-selection']?.selectedProductIds || [];
    const allProducts = productRecs.products || [];

    // Use selected products, or fallback to top 4 products
    const productsToMock = selectedProducts.length > 0
      ? allProducts.filter((p) => selectedProducts.includes(p.id))
      : allProducts.slice(0, 4);

    const selectedDirection = brandIdentity.directions?.find(
      (d) => d.id === brandIdentity.selectedDirectionId
    ) || brandIdentity.directions?.[0] || {};

    const taskPrompt = `You are a product designer creating detailed mockup specifications for a creator brand. Generate photorealistic mockup descriptions for each product.

<brand_context>
Brand Name: ${brand.name || 'Creator Brand'}
Brand Vision: ${selectedDirection.vision || 'Modern creator brand'}
Archetype: ${selectedDirection.archetype?.name || 'The Creator'}
Colors: ${socialAnalysis.aesthetic?.naturalPalette?.join(', ') || '#000000, #FFFFFF, #B8956A'}
Niche: ${socialAnalysis.niche?.primaryNiche?.name || 'Lifestyle'}
</brand_context>

<products_to_mockup>
${productsToMock.map((p, i) => `${i + 1}. ${p.name} (${p.category}) - ${p.description || ''}`).join('\n')}
</products_to_mockup>

For each product, generate a detailed mockup specification. Return as JSON:
{
  "mockups": [
    {
      "productId": "string (matching product id)",
      "productName": "string",
      "imagePrompt": "string (detailed GPT Image 1.5 prompt for photorealistic product mockup showing the brand logo/name on the product, specific colors, setting, lighting, camera angle)",
      "backgroundColor": "#hex (solid background color for the mockup)",
      "placementDescription": "string (where the logo/text appears on the product)",
      "scene": "studio|lifestyle|flatlay|closeup",
      "status": "pending"
    }
  ]
}

IMPORTANT:
- Each imagePrompt should be 2-3 sentences describing a photorealistic product shot
- Include the brand name "${brand.name || 'Brand'}" in the design
- Use the brand's color palette
- Vary the scene types across products for visual interest`;

    logger.info({ brandId, userId, productCount: productsToMock.length }, 'Calling Claude for mockup specifications');

    const aiResult = await routeModel('brand-vision', {
      prompt: taskPrompt,
      maxTokens: 4096,
      temperature: 0.7,
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
      logger.error({ brandId, error: parseErr.message, rawText: aiResult.text.slice(0, 500) }, 'Failed to parse mockup AI response');
      return res.status(500).json({ success: false, error: 'Failed to parse AI-generated mockups' });
    }

    const mockups = parsed.mockups || [];

    // Cache in wizard_state
    const updatedState = {
      ...(brand.wizard_state || {}),
      'mockup-generation': {
        mockups,
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

    logger.info({ brandId, userId, model: aiResult.model, mockupCount: mockups.length }, 'Mockup specifications generated');

    res.json({
      success: true,
      data: {
        brandId,
        step: 'mockup-generation',
        mockups,
        model: aiResult.model,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/wizard/:brandId/resume-token
 * Generate an HMAC-signed resume token for sharing / magic link resume.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function generateResumeToken(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;

    // Verify ownership
    const { data: brand, error } = await supabaseAdmin
      .from('brands')
      .select('id, wizard_step')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (error || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    const token = signResumeToken(brandId, userId, brand.wizard_step);

    logger.info({ brandId, userId }, 'Resume token generated');

    res.json({
      success: true,
      data: { token },
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
 * POST /api/v1/wizard/:brandId/generate-taglines
 * Generate AI taglines for a brand direction.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function generateTaglines(req, res, next) {
  try {
    const { brandId } = req.params;
    const userId = req.user.id;

    const { data: brand, error } = await supabaseAdmin
      .from('brands')
      .select('id, name, wizard_state')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (error || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Check cache
    const cached = brand.wizard_state?.taglines;
    if (cached?.length && !req.body?.regenerate) {
      return res.json({ success: true, data: { taglines: cached, cached: true } });
    }

    const identity = brand.wizard_state?.['brand-identity'];
    const direction = identity?.selectedDirection || identity?.directions?.[0];

    const prompt = `Generate 8-10 unique, memorable taglines for a brand called "${brand.name || 'this brand'}".

<brand_context>
Brand archetype: ${direction?.archetype?.name || 'Unknown'}
Brand values: ${(direction?.values || []).join(', ') || 'Not specified'}
Brand vision: ${direction?.vision || 'Not specified'}
Voice tone: ${direction?.voice?.tone || 'professional'}
Existing tagline: ${direction?.tagline || 'None'}
</brand_context>

Requirements:
- Each tagline should be 3-8 words
- Mix punchy/short with slightly longer options
- Reflect the brand archetype and values
- Be memorable and distinctive
- No generic/cliché taglines

Return a JSON object: { "taglines": ["tagline1", "tagline2", ...] }`;

    logger.info({ brandId, userId }, 'Generating taglines via Claude');

    const aiResult = await routeModel('brand-vision', {
      prompt,
      maxTokens: 1024,
      temperature: 0.9,
      jsonMode: true,
    });

    let taglines = [];
    try {
      let jsonText = aiResult.text.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonText = jsonMatch[1].trim();
      const parsed = JSON.parse(jsonText);
      taglines = parsed.taglines || [];
    } catch (parseErr) {
      logger.warn({ brandId, parseErr: parseErr.message }, 'Failed to parse tagline response');
      taglines = [];
    }

    // Cache in wizard_state
    await supabaseAdmin
      .from('brands')
      .update({
        wizard_state: {
          ...(brand.wizard_state || {}),
          taglines,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', brandId);

    logger.info({ brandId, userId, count: taglines.length }, 'Taglines generated');

    res.json({ success: true, data: { taglines } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/wizard/:brandId/custom-product-request
 * Submit a custom product request for admin review.
 * Stores data in the custom_product_requests table and caches in wizard_state.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function submitCustomProductRequest(req, res, next) {
  try {
    const { brandId } = req.params;
    const userId = req.user.id;
    const { description, category, priceRange } = req.body;

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

    // Insert into the custom_product_requests table
    const { data, error } = await supabaseAdmin
      .from('custom_product_requests')
      .insert({
        brand_id: brandId,
        user_id: userId,
        description,
        category,
        price_range: priceRange,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Also cache in wizard_state for quick access during the wizard flow
    const existingRequests = brand.wizard_state?.['custom-product-requests'] || [];
    await supabaseAdmin
      .from('brands')
      .update({
        wizard_state: {
          ...(brand.wizard_state || {}),
          'custom-product-requests': [...existingRequests, {
            id: data.id,
            description,
            category,
            priceRange,
            status: 'pending',
            createdAt: data.created_at,
          }],
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', brandId);

    logger.info({ brandId, requestId: data.id, category }, 'Custom product request submitted');

    res.status(201).json({ success: true, data });
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
      .select('id, name, wizard_step, wizard_state')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (error || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // The DB trigger enforces sequential step progression (max +1 at a time).
    // Use the shared advanceToStep helper to walk through every remaining step.
    try {
      await advanceToStep(brandId, 'complete');
    } catch (stepError) {
      logger.error({ brandId, error: stepError.message }, 'Failed to advance wizard to complete');
      return res.status(500).json({ success: false, error: 'Failed to finalize wizard steps' });
    }

    // CRM sync and email will be dispatched via BullMQ once workers are ready
    // For now, log the intent
    logger.info({ brandId, userId, brandName: brand.name }, 'Brand complete — CRM sync and email pending worker setup');

    // Clear agent session cache
    await sessionManager.clear(brandId);

    logger.info({ brandId, userId }, 'Wizard completed');

    res.json({
      success: true,
      data: {
        brandId,
        status: 'complete',
        message: 'Brand creation complete!',
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/wizard/:brandId/analyze-competitors
 * Trigger competitor analysis using dossier data from the brand's wizard state.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function analyzeCompetitors(req, res, next) {
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

    // Extract niche and follow patterns from dossier
    const socialAnalysis = brand.wizard_state?.['social-analysis'] || {};
    const niche = socialAnalysis.niche?.primaryNiche?.name || socialAnalysis.niche?.name || '';

    if (!niche) {
      return res.status(400).json({
        success: false,
        error: 'Social analysis must be completed before competitor analysis. No niche data found.',
      });
    }

    const profile = socialAnalysis.profile || socialAnalysis.profiles?.[0] || {};
    const followPatterns = {
      followerCount: profile.followerCount || 0,
      platform: profile.platform || 'instagram',
      hashtags: socialAnalysis.content?.topHashtags || [],
    };

    logger.info({ brandId, userId, niche }, 'Starting competitor analysis');

    const result = await runCompetitorAnalysis(niche, followPatterns);

    // Cache competitor data in wizard_state
    const updatedState = {
      ...(brand.wizard_state || {}),
      'competitor-analysis': {
        ...result,
        analyzedAt: new Date().toISOString(),
      },
    };

    await supabaseAdmin
      .from('brands')
      .update({
        wizard_state: updatedState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', brandId);

    logger.info({ brandId, userId, competitorCount: result.competitors.length }, 'Competitor analysis complete');

    res.json({
      success: true,
      data: {
        brandId,
        competitors: result.competitors,
        marketAnalysis: result.marketAnalysis,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/wizard/:brandId/scrape-website
 * Scrape a Linktree/website URL and return extracted brand data.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function scrapeWebsiteEndpoint(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;
    const { url } = req.body;

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

    logger.info({ brandId, userId, url }, 'Scraping website for brand data');

    let result;
    try {
      result = await scrapeWebsite(url);
    } catch (scrapeErr) {
      return res.status(400).json({
        success: false,
        error: scrapeErr.message || 'Failed to scrape website',
      });
    }

    // Cache website data in wizard_state
    const updatedState = {
      ...(brand.wizard_state || {}),
      'website-scrape': {
        url,
        ...result,
        scrapedAt: new Date().toISOString(),
      },
    };

    await supabaseAdmin
      .from('brands')
      .update({
        wizard_state: updatedState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', brandId);

    logger.info({ brandId, userId, url, colorCount: result.colors.length }, 'Website scrape complete');

    res.json({
      success: true,
      data: {
        brandId,
        url,
        ...result,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/wizard/:brandId/dossier-pdf
 * Generate and stream a PDF (HTML) of the Creator Intelligence Report.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getDossierPdf(req, res, next) {
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

    const socialAnalysis = brand.wizard_state?.['social-analysis'];
    if (!socialAnalysis) {
      return res.status(400).json({
        success: false,
        error: 'Social analysis must be completed before generating a dossier PDF.',
      });
    }

    // Merge competitor data into the dossier if available
    const competitorData = brand.wizard_state?.['competitor-analysis'] || {};
    const dossierData = {
      ...socialAnalysis,
      competitors: competitorData.competitors || [],
      marketAnalysis: competitorData.marketAnalysis || '',
    };

    logger.info({ brandId, userId }, 'Generating dossier PDF');

    const pdfBuffer = generateDossierPdf(dossierData);

    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': pdfBuffer.length,
      'Content-Disposition': `inline; filename="dossier-${brandId}.html"`,
      'Cache-Control': 'private, max-age=300',
    });

    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/wizard/:brandId/personality-quiz
 * Alternative path for users without social media.
 * Takes quiz answers and generates equivalent dossier data using Claude.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function personalityQuiz(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;
    const { vibe, brandWords, dreamCustomer, colorPalette, contentStyle } = req.body;

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

    logger.info({ brandId, userId }, 'Processing personality quiz for dossier generation');

    const quizPrompt = `You are a brand analyst generating a creator intelligence dossier from personality quiz answers (no social media data available).

<quiz_answers>
Vibe/Aesthetic: ${vibe}
Brand Words: ${brandWords.join(', ')}
Dream Customer: ${dreamCustomer}
Preferred Colors: ${(colorPalette || []).join(', ') || 'Not specified'}
Content Style: ${contentStyle}
Brand Name: ${brand.name || 'Not yet decided'}
</quiz_answers>

Generate a complete dossier analysis in the same structure as a social media analysis would produce. Be creative and insightful -- extrapolate from the quiz answers to build a rich profile.

Return as JSON with this exact structure:
{
  "profile": {
    "displayName": "${brand.name || 'Creator'}",
    "handle": "",
    "bio": "A generated bio based on quiz answers",
    "followerCount": 0,
    "followingCount": 0,
    "postCount": 0,
    "profilePicUrl": "",
    "isVerified": false,
    "platform": "quiz"
  },
  "niche": {
    "primaryNiche": {
      "name": "string -- inferred primary niche",
      "confidence": 0.8
    },
    "subNiches": ["string array of sub-niches"],
    "analysis": "string -- paragraph analyzing their market position"
  },
  "personality": {
    "archetype": {
      "name": "string -- brand archetype (e.g. The Creator, The Sage, etc.)",
      "description": "string"
    },
    "traits": ["string array of 4-6 personality traits"],
    "tone": "string -- recommended tone of voice"
  },
  "audience": {
    "ageRange": "string -- estimated target age range",
    "gender": "string -- target gender split",
    "primaryLanguage": "English",
    "topLocations": ["string array"],
    "interests": ["string array of audience interests"]
  },
  "content": {
    "themes": ["string array of recommended content themes"],
    "topHashtags": ["string array of 8-12 recommended hashtags with # prefix"],
    "postingFrequency": "string -- recommended posting cadence"
  },
  "colors": ${JSON.stringify(colorPalette || [])},
  "brandReadiness": {
    "score": 50,
    "overall": 50,
    "summary": "string -- brand readiness assessment based on quiz clarity",
    "strengths": ["string array"],
    "improvements": ["string array"]
  }
}

Important: Fill in ALL fields with thoughtful, specific content based on the quiz answers. Do not leave fields empty.`;

    const aiResult = await routeModel('social-analysis', {
      prompt: quizPrompt,
      maxTokens: 4096,
      temperature: 0.7,
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
      logger.error({ brandId, error: parseErr.message, rawText: aiResult.text.slice(0, 500) }, 'Failed to parse personality quiz AI response');
      return res.status(500).json({ success: false, error: 'Failed to generate dossier from quiz answers' });
    }

    // Cache in wizard_state under 'social-analysis' so downstream wizard steps work identically
    const updatedState = {
      ...(brand.wizard_state || {}),
      'social-analysis': {
        ...parsed,
        source: 'personality-quiz',
        quizAnswers: { vibe, brandWords, dreamCustomer, colorPalette, contentStyle },
        generatedAt: new Date().toISOString(),
        model: aiResult.model,
      },
    };

    await supabaseAdmin
      .from('brands')
      .update({
        wizard_step: 'social',
        wizard_state: updatedState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', brandId);

    logger.info({ brandId, userId, model: aiResult.model }, 'Personality quiz dossier generated');

    res.json({
      success: true,
      data: {
        brandId,
        step: 'social-analysis',
        source: 'personality-quiz',
        dossier: parsed,
        model: aiResult.model,
      },
    });
  } catch (err) {
    next(err);
  }
}
