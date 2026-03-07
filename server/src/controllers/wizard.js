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
// Name generator prompt is now inline in generateNames() for JSON-only output
import { analyzeCompetitors as runCompetitorAnalysis } from '../services/competitor.js';
import { scrapeWebsite } from '../services/website-scraper.js';
import { generateDossierPdf } from '../services/pdf-generator.js';
import { dispatchJob } from '../queues/dispatch.js';

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

    return res.status(201).json({
      success: true,
      data: {
        brandId: brand.id,
        wizardStep: brand.wizard_step,
        wizardState: brand.wizard_state,
      },
    });
  } catch (err) {
    return next(err);
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

    return res.json({
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
    return next(err);
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

    // Verify ownership — also fetch wizard_step so we can compute advancement
    const { data: brand, error: fetchError } = await supabaseAdmin
      .from('brands')
      .select('id, wizard_state, wizard_step')
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

    // Determine whether we need to advance the step and, if so, what the
    // first intermediate step is. Combining the state save with the first
    // step advance into a single .update() prevents partial state (state
    // saved but step not advanced) when advanceToStep() would fail.
    const currentStep = brand.wizard_step || 'onboarding';
    const currentIdx = STEP_ORDER.indexOf(currentStep);
    const targetIdx = dbStep ? STEP_ORDER.indexOf(dbStep) : -1;
    const needsAdvance = dbStep && targetIdx > currentIdx;

    // Build the atomic payload — always includes wizard_state, and may
    // include the first wizard_step advancement.
    /** @type {Record<string, unknown>} */
    const payload = {
      wizard_state: updatedState,
      updated_at: new Date().toISOString(),
    };

    if (needsAdvance) {
      // Include the first step advancement in the same write as wizard_state
      payload.wizard_step = STEP_ORDER[currentIdx + 1];
    }

    const { error: stateError } = await supabaseAdmin
      .from('brands')
      .update(payload)
      .eq('id', brandId);

    if (stateError) {
      logger.error({ error: stateError.message, brandId }, 'Failed to save step data');
      return res.status(500).json({ success: false, error: 'Failed to save step data' });
    }

    // If the target is more than one step ahead, walk through any remaining
    // intermediate steps. The first step was already advanced atomically
    // with the state save above, so start from currentIdx + 2.
    if (needsAdvance && targetIdx > currentIdx + 1) {
      try {
        for (let i = currentIdx + 2; i <= targetIdx; i++) {
          const { error } = await supabaseAdmin
            .from('brands')
            .update({ wizard_step: STEP_ORDER[i], updated_at: new Date().toISOString() })
            .eq('id', brandId);

          if (error) {
            logger.error(
              { brandId, step: STEP_ORDER[i], error: error.message },
              'saveStepData: failed to advance wizard step',
            );
            throw new Error(`Failed to advance wizard to step: ${STEP_ORDER[i]}`);
          }
        }
      } catch (advanceErr) {
        logger.error({ error: advanceErr.message, brandId, dbStep }, 'Failed to advance wizard step');
        return res.status(500).json({ success: false, error: 'Failed to advance wizard step' });
      }
    }

    // When the user names their brand, persist it to the brands.name column
    // so logo generation and other downstream features see the real name.
    if (step === 'brand-name' && data?.name) {
      const { error: nameErr } = await supabaseAdmin
        .from('brands')
        .update({ name: data.name, updated_at: new Date().toISOString() })
        .eq('id', brandId);

      if (nameErr) {
        logger.warn({ brandId, error: nameErr.message }, 'Failed to update brand name (non-blocking)');
      } else {
        logger.info({ brandId, name: data.name }, 'Brand name updated from wizard');
      }
    }

    // Social proof: increment selected_count for each chosen product
    if (step === 'product-selection' && data?.productSkus?.length) {
      for (const productSku of data.productSkus) {
        // Look up product ID from SKU for the RPC call
        const { data: product, error: lookupErr } = await supabaseAdmin
          .from('products')
          .select('id')
          .eq('sku', productSku)
          .single();

        if (lookupErr || !product) {
          logger.warn(
            { productSku, error: lookupErr?.message },
            'Could not find product by SKU for selected_count increment (non-blocking)',
          );
          continue;
        }

        const { error: rpcError } = await supabaseAdmin.rpc(
          'increment_product_selected_count',
          { p_product_id: product.id },
        );
        if (rpcError) {
          logger.warn(
            { productSku, productId: product.id, error: rpcError.message },
            'Failed to increment product selected_count (non-blocking)',
          );
        }
      }
      logger.info(
        { brandId, productCount: data.productSkus.length },
        'Incremented selected_count for chosen products',
      );
    }

    return res.json({
      success: true,
      data: { brandId, step, saved: true },
    });
  } catch (err) {
    return next(err);
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
      profilePicUrl: profile.profilePicUrlHD || profile.profilePicUrl || null,
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
    return next(err);
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

  // Strip markdown fences: ```json ... ``` (closed)
  const closedFence = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (closedFence) {
    jsonText = closedFence[1].trim();
  } else {
    // Handle unclosed fences: ```json ... (no closing ```)
    const openFence = jsonText.match(/```(?:json)?\s*([\s\S]*)/);
    if (openFence) {
      jsonText = openFence[1].trim();
    }
  }

  // If the text still doesn't start with { or [, try to find JSON within it
  if (!jsonText.startsWith('{') && !jsonText.startsWith('[')) {
    const jsonStart = jsonText.search(/[{[]/);
    if (jsonStart !== -1) {
      jsonText = jsonText.slice(jsonStart);
    }
  }

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
    return next(err);
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

  return res.json({
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

    const nameSystemPrompt = `You are a brand naming expert. You MUST respond with ONLY valid JSON — no markdown, no explanation, no narrative, no tool calls. Your entire response must be a single JSON object.

Return this exact JSON structure:
{
  "suggestions": [
    {
      "name": "BrandName",
      "strategy": "evocative|descriptive|compound|abstract|metaphorical|acronym|personal",
      "rationale": "1-2 sentence explanation of why this name works",
      "confidence": 0.85,
      "pronunciationGuide": "brand-name",
      "memorabilityScore": 85,
      "brandabilityScore": 90,
      "domainLikelihood": "likely|possible|unlikely",
      "tagline": "Optional short tagline"
    }
  ],
  "topRecommendation": "BestNameHere"
}

NAMING RULES:
- Names must be 1-3 words maximum
- Easy to spell and pronounce in English
- No negative connotations in major languages
- Use at least 3 different naming strategies across suggestions
- Include at least 2 "safe" options and 2 "bold" options
- Sort by confidence score (highest first)`;

    const taskPrompt = `Generate 8-10 creative brand name suggestions for this brand:

<brand_context>
${contextParts.length > 0 ? contextParts.join('\n') : 'No prior brand context available. Generate creative, versatile brand names suitable for a personal creator brand.'}
</brand_context>

${req.body?.userPreferences ? `<user_preferences>\n${JSON.stringify(req.body.userPreferences, null, 2)}\n</user_preferences>\n` : ''}
Respond with ONLY the JSON object. No other text.`;

    logger.info({ brandId, userId }, 'Calling Claude for brand name suggestions');

    const aiResult = await routeModel('name-generation', {
      systemPrompt: nameSystemPrompt,
      prompt: taskPrompt,
      maxTokens: 6144,
      temperature: 0.9,
      jsonMode: true,
    });

    // Parse the AI response — try direct JSON, then extract from markdown/narrative
    let parsed;
    try {
      let jsonText = aiResult.text.trim();
      // Strip markdown code fences if present
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonText = jsonMatch[1].trim();
      // Try to find JSON object in response if it starts with non-JSON text
      if (!jsonText.startsWith('{')) {
        const objMatch = jsonText.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);
        if (objMatch) jsonText = objMatch[0];
      }
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

    return res.json({
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
    return next(err);
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

    // Fetch the real product catalog
    const { data: catalogData, error: catalogError } = await supabaseAdmin
      .from('products')
      .select('sku, name, category, subcategory, description, base_cost, retail_price, image_url, ingredients, materials, certifications')
      .eq('is_active', true)
      .order('category')
      .order('name');

    if (catalogError || !catalogData || catalogData.length === 0) {
      return res.status(500).json({ success: false, error: 'Product catalog unavailable' });
    }

    // Build a lookup map for enrichment after AI scoring
    const catalogMap = Object.fromEntries(catalogData.map((p) => [p.sku, p]));

    // Build catalog summary for the AI prompt
    const catalogSummary = catalogData.map((p) => ({
      sku: p.sku,
      name: p.name,
      category: p.category,
      subcategory: p.subcategory || null,
      description: p.description,
      baseCost: parseFloat(p.base_cost) || 0,
      suggestedRetail: parseFloat(p.retail_price) || 0,
      ingredients: p.ingredients || null,
      materials: p.materials || null,
    }));

    // Build context from wizard state
    const brandIdentity = brand.wizard_state?.['brand-identity'] || {};
    const socialAnalysis = brand.wizard_state?.['social-analysis'] || {};
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

    const followerCount = socialAnalysis.profile?.totalFollowers || 1000;

    const taskPrompt = `You are an expert product strategist for a creator brand. Based on the brand context and the REAL product catalog below, select and rank 8-12 products that best fit this creator.

<brand_context>
${contextParts.length > 0 ? contextParts.join('\n') : 'A personal creator brand looking for product recommendations.'}
</brand_context>

${req.body?.preferences ? `<user_preferences>\n${JSON.stringify(req.body.preferences, null, 2)}\n</user_preferences>\n` : ''}

<product_catalog>
${JSON.stringify(catalogSummary, null, 2)}
</product_catalog>

IMPORTANT: You MUST select products from the catalog above using their exact SKU values. Do NOT invent new products.

For each selected product, score it on these dimensions:
- nicheMatchScore (0.0-1.0): How well does this product category align with the creator's niche?
- audienceFitScore (0.0-1.0): How likely is this creator's audience to buy this?
- marginPercent: Calculate as ((suggestedRetail - baseCost) / suggestedRetail * 100), rounded to the nearest integer

For revenue estimation, use these assumptions:
- Follower count: ${followerCount}
- Conservative conversion rate: 0.005, Moderate: 0.015, Aggressive: 0.03
- Units per month = followers * conversionRate * nicheMatchScore
- Monthly revenue = units * suggestedRetail
- Monthly profit = units * (suggestedRetail - baseCost)

Return a JSON object with this exact structure:
{
  "products": [
    {
      "sku": "EXACT_SKU_FROM_CATALOG",
      "name": "product name from catalog",
      "category": "category from catalog",
      "subcategory": "subcategory from catalog or null",
      "baseCost": number,
      "suggestedRetail": number,
      "marginPercent": number,
      "nicheMatchScore": number (0.0-1.0),
      "audienceFitScore": number (0.0-1.0),
      "reasoning": "2-3 sentence 'Why this product fits' explanation",
      "revenue": {
        "tiers": [
          { "label": "conservative", "unitsPerMonth": number, "monthlyRevenue": number, "monthlyProfit": number, "annualRevenue": number, "annualProfit": number },
          { "label": "moderate", "unitsPerMonth": number, "monthlyRevenue": number, "monthlyProfit": number, "annualRevenue": number, "annualProfit": number },
          { "label": "aggressive", "unitsPerMonth": number, "monthlyRevenue": number, "monthlyProfit": number, "annualRevenue": number, "annualProfit": number }
        ]
      }
    }
  ],
  "bundles": [
    {
      "id": "string (unique slug)",
      "name": "string (bundle name)",
      "description": "string",
      "productSkus": ["SKU1", "SKU2"],
      "discountPercent": number (5-25),
      "bundlePrice": number,
      "reasoning": "string"
    }
  ],
  "revenueProjection": {
    "estimatedMonthlyRevenue": { "conservative": number, "moderate": number, "aggressive": number },
    "methodology": "string explaining calculation"
  }
}`;

    logger.info({ brandId, userId, catalogSize: catalogData.length }, 'Calling Claude for product recommendations (catalog-based)');

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

    // Enrich AI recommendations with real catalog data (imageUrl, exact pricing)
    const rawProducts = parsed.products || [];
    const products = rawProducts.map((rec, index) => {
      const catalogProduct = catalogMap[rec.sku];
      return {
        ...rec,
        // Ensure imageUrl comes from catalog
        imageUrl: catalogProduct?.image_url || null,
        // Ensure pricing matches catalog (AI may approximate)
        baseCost: catalogProduct ? parseFloat(catalogProduct.base_cost) || rec.baseCost : rec.baseCost,
        suggestedRetail: catalogProduct ? parseFloat(catalogProduct.retail_price) || rec.suggestedRetail : rec.suggestedRetail,
        subcategory: catalogProduct?.subcategory || rec.subcategory || null,
        // Add composite score and rank (same formula as synthesizeRecommendations)
        compositeScore: 0,
        confidenceScore: 0,
        rank: index + 1,
      };
    }).filter((rec) => catalogMap[rec.sku]); // Remove any products not in catalog

    // Calculate composite scores and re-rank
    const maxModerateRevenue = Math.max(
      1,
      ...products.map((p) => {
        const moderateTier = p.revenue?.tiers?.find((t) => t.label === 'moderate');
        return moderateTier?.monthlyRevenue || 0;
      })
    );

    for (const product of products) {
      const moderateTier = product.revenue?.tiers?.find((t) => t.label === 'moderate');
      const normalizedRevenue = (moderateTier?.monthlyRevenue || 0) / maxModerateRevenue;
      const normalizedMargin = Math.min(1.0, (product.marginPercent || 0) / 100);

      product.compositeScore = Math.round(
        ((product.nicheMatchScore || 0) * 0.4 +
          normalizedRevenue * 0.3 +
          normalizedMargin * 0.2 +
          (product.audienceFitScore || 0) * 0.1) * 100
      ) / 100;

      product.confidenceScore = Math.round(
        Math.min(100, Math.max(10,
          (product.nicheMatchScore || 0) * 40 +
          (product.audienceFitScore || 0) * 25 +
          normalizedRevenue * 20 +
          normalizedMargin * 15
        ))
      );
    }

    // Sort by composite score descending and assign final ranks
    products.sort((a, b) => b.compositeScore - a.compositeScore);
    products.forEach((p, i) => { p.rank = i + 1; });

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

    return res.json({
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
    return next(err);
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

    // Verify brand ownership
    const { data: brand, error: brandError } = await supabaseAdmin
      .from('brands')
      .select('id, user_id')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (brandError || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Accept optional productSkus from body to filter which products get mockups
    const requestedSkus = req.body?.productSkus || [];

    // Get selected products for this brand from brand_products table
    const { data: selections, error: selError } = await supabaseAdmin
      .from('brand_products')
      .select('product_sku, product_id')
      .eq('brand_id', brandId);

    if (selError || !selections || selections.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No products selected. Select products before generating mockups.',
      });
    }

    // Filter by requested SKUs if provided
    const filteredSelections = requestedSkus.length > 0
      ? selections.filter((s) => requestedSkus.includes(s.product_sku))
      : selections;

    // Resolve full product data from products table
    const productSkus = filteredSelections.map((s) => s.product_sku).filter(Boolean);
    const productIds = filteredSelections.map((s) => s.product_id).filter(Boolean);

    let products = [];
    if (productIds.length > 0) {
      const { data } = await supabaseAdmin
        .from('products')
        .select('id, sku, name, category, base_cost, retail_price, image_url, mockup_instructions, description')
        .in('id', productIds)
        .eq('is_active', true);
      if (data) products = data;
    }
    // Fallback: resolve by SKU if product_id didn't yield results
    if (products.length === 0 && productSkus.length > 0) {
      const { data } = await supabaseAdmin
        .from('products')
        .select('id, sku, name, category, base_cost, retail_price, image_url, mockup_instructions, description')
        .in('sku', productSkus)
        .eq('is_active', true);
      if (data) products = data;
    }

    if (products.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Selected products could not be found. Please re-select products.',
      });
    }

    // Fetch selected logo from brand_assets
    const { data: brandAssets } = await supabaseAdmin
      .from('brand_assets')
      .select('url, metadata')
      .eq('brand_id', brandId)
      .eq('asset_type', 'logo')
      .eq('is_selected', true)
      .limit(1);

    // Fetch brand identity
    const { data: brandRecord } = await supabaseAdmin
      .from('brands')
      .select('name, identity')
      .eq('id', brandId)
      .single();

    const selectedLogo = brandAssets?.[0] || null;
    const brandIdentity = brandRecord?.identity || {};
    const brandName = brandRecord?.name || 'Brand';

    // Dispatch mockup generation via BullMQ
    const result = await dispatchJob('brand-wizard', {
      userId,
      brandId,
      step: 'mockup-review',
      input: {
        brandId,
        userId,
        products: products.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category,
          base_cost: p.base_cost,
          retail_price: p.retail_price,
          image_url: p.image_url,
          mockup_instructions: p.mockup_instructions,
        })),
        selectedLogo: selectedLogo ? {
          url: selectedLogo.url,
          variationType: selectedLogo.metadata?.variation_type || 'primary',
          prompt: selectedLogo.metadata?.prompt || '',
        } : { url: '', variationType: 'primary', prompt: '' },
        brandIdentity: {
          brandName,
          archetype: brandIdentity.archetype || '',
          colorPalette: brandIdentity.colorPalette || brandIdentity.color_palette || {},
        },
      },
      creditCost: products.length,
    });

    logger.info({ jobId: result.jobId, brandId, userId, productCount: products.length }, 'Mockup generation job dispatched via BullMQ');

    return res.json({
      success: true,
      data: { jobId: result.jobId, queueName: result.queueName },
    });
  } catch (err) {
    return next(err);
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

    return res.json({
      success: true,
      data: { token },
    });
  } catch (err) {
    return next(err);
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

    return res.json({
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
    return next(err);
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

    return res.json({ success: true, data: { taglines } });
  } catch (err) {
    return next(err);
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

    return res.status(201).json({ success: true, data });
  } catch (err) {
    return next(err);
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

    return res.json({
      success: true,
      data: {
        brandId,
        status: 'complete',
        message: 'Brand creation complete!',
      },
    });
  } catch (err) {
    return next(err);
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

    return res.json({
      success: true,
      data: {
        brandId,
        competitors: result.competitors,
        marketAnalysis: result.marketAnalysis,
      },
    });
  } catch (err) {
    return next(err);
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

    return res.json({
      success: true,
      data: {
        brandId,
        url,
        ...result,
      },
    });
  } catch (err) {
    return next(err);
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

    return res.send(pdfBuffer);
  } catch (err) {
    return next(err);
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
/**
 * POST /api/v1/wizard/:brandId/generate-voice-samples
 * Generate AI voice samples (instagram caption, product description, email subject, taglines)
 * for a brand direction. Used by the BrandVoiceSamples component.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function generateVoiceSamples(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId } = req.params;
    const { voice, archetype, values, vision, narrative } = req.body;

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

    const brandName = brand.name && brand.name !== 'Untitled Brand' ? brand.name : 'Your Brand';

    const prompt = `You are a brand voice copywriter. Generate sample content in the brand's voice.

<brand_context>
Brand Name: ${brandName}
Voice Tone: ${voice?.tone || 'professional'}
Vocabulary Level: ${voice?.vocabularyLevel || 'conversational'}
Humor: ${voice?.humor || 'none'}
Archetype: ${archetype?.name || 'The Creator'}
Values: ${(values || []).join(', ') || 'quality, authenticity'}
Vision: ${vision || 'A modern creator brand'}
${narrative ? `Narrative: ${narrative}` : ''}
</brand_context>

Generate 4 pieces of brand voice content. Return as JSON:
{
  "instagram": "A compelling Instagram caption (2-3 sentences) in the brand voice",
  "product": "A product description (2-3 sentences) in the brand voice",
  "email": "A catchy email subject line (under 10 words) in the brand voice",
  "taglines": ["4 unique taglines (3-8 words each)"]
}

The content must reflect the tone and vocabulary level exactly. ${voice?.vocabularyLevel === 'casual' ? 'Use casual, conversational language with slang and energy.' : 'Use polished, professional language.'}`;

    const aiResult = await routeModel('brand-vision', {
      prompt,
      maxTokens: 1024,
      temperature: 0.9,
      jsonMode: true,
    });

    let parsed;
    try {
      let jsonText = aiResult.text.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonText = jsonMatch[1].trim();
      parsed = JSON.parse(jsonText);
    } catch (parseErr) {
      logger.warn({ brandId, error: parseErr.message }, 'Failed to parse voice samples AI response');
      return res.status(500).json({ success: false, error: 'Failed to generate voice samples' });
    }

    logger.info({ brandId, userId }, 'Voice samples generated');

    return res.json({
      success: true,
      data: {
        instagram: parsed.instagram || parsed.instagramCaption || null,
        product: parsed.product || parsed.productDescription || null,
        email: parsed.email || parsed.emailSubjectLine || null,
        taglines: Array.isArray(parsed.taglines) ? parsed.taglines : [],
      },
    });
  } catch (err) {
    return next(err);
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

    return res.json({
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
    return next(err);
  }
}
