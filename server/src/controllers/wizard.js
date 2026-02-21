// server/src/controllers/wizard.js

import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { sessionManager } from '../agents/session-manager.js';
import { verifyResumeToken } from '../lib/hmac-tokens.js';
import { routeModel } from '../skills/_shared/model-router.js';
import { SYSTEM_PROMPT as BRAND_GENERATOR_PROMPT, buildDirectionsTaskPrompt } from '../skills/brand-generator/prompts.js';
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
 * Analyze social media profiles and generate a Creator Dossier via Claude.
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

    // Return cached dossier if it exists and no regeneration was requested
    const existingDossier = brand.wizard_state?.['social-analysis'];
    if (existingDossier && existingDossier.profile && !req.body?.regenerate) {
      logger.info({ brandId, userId }, 'Returning cached social analysis dossier');
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

    const systemPrompt = `You are an expert social media analyst working for Brand Me Now, an AI-powered brand creation platform. Your job is to analyze a creator's social media presence and build a comprehensive Creator Dossier -- the raw materials for building their brand identity. Use your knowledge of public social media creators to provide realistic, insightful analysis. Return ONLY valid JSON matching the exact structure specified.`;

    const taskPrompt = `Analyze the following creator's social media presence and generate a comprehensive Creator Dossier.

<social_handles>
${handleParts.join('\n')}
</social_handles>

${brand.name && brand.name !== 'Untitled Brand' ? `<brand_name>${brand.name}</brand_name>` : ''}

Based on your knowledge of these social media accounts (or if you don't recognize them, generate a realistic and comprehensive analysis based on the handle names, likely niche, and typical creator patterns), create a Creator Dossier JSON with this EXACT structure:

{
  "profile": {
    "displayName": "string - display name or best guess from handle",
    "bio": "string - likely bio or a generated one that fits",
    "profilePicUrl": null,
    "totalFollowers": number,
    "totalFollowing": number,
    "primaryPlatform": "instagram|tiktok|youtube|twitter|facebook",
    "externalUrl": null,
    "isVerified": false
  },
  "platforms": [
    {
      "platform": "instagram",
      "handle": "string",
      "displayName": "string",
      "bio": "string or null",
      "profilePicUrl": null,
      "isVerified": false,
      "metrics": {
        "followers": number,
        "following": number,
        "postCount": number,
        "engagementRate": number (0-1 decimal, e.g. 0.045),
        "avgLikes": number,
        "avgComments": number,
        "avgShares": null,
        "avgViews": null
      },
      "recentPosts": [],
      "topPosts": [],
      "scrapedAt": "${new Date().toISOString()}"
    }
  ],
  "audience": {
    "estimatedAgeRange": "string e.g. 18-34",
    "ageBreakdown": [{"range": "18-24", "percentage": 35}, {"range": "25-34", "percentage": 40}, {"range": "35-44", "percentage": 15}, {"range": "45+", "percentage": 10}],
    "genderSplit": {"male": number, "female": number, "other": number},
    "primaryInterests": ["interest1", "interest2", "interest3", "interest4", "interest5"],
    "geographicIndicators": ["country1", "country2"],
    "incomeLevel": "budget|mid-range|premium|luxury",
    "loyaltySignals": ["signal1", "signal2"],
    "demographicConfidence": number (0-1),
    "demographicReasoning": "string explaining reasoning"
  },
  "content": {
    "themes": [{"name": "theme name", "frequency": 0.5, "examples": ["example caption or description"], "sentiment": "positive|neutral|mixed"}],
    "formats": {
      "breakdown": {"reels": number, "carousel": number, "static": number, "stories": number, "live": number},
      "bestFormat": "string",
      "engagementByFormat": {},
      "totalPostsAnalyzed": number
    },
    "postingFrequency": {
      "postsPerWeek": number,
      "consistencyPercent": number,
      "bestDays": ["Monday", "Thursday"],
      "bestTimes": ["18:00 UTC", "12:00 UTC"],
      "gaps": [],
      "avgGapHours": number,
      "analysisSpan": {"firstPost": "${new Date(Date.now() - 60 * 86400000).toISOString()}", "lastPost": "${new Date().toISOString()}", "totalDays": 60, "totalPosts": number}
    },
    "consistencyScore": number (0-100),
    "bestPerformingContentType": "string",
    "peakEngagementTopics": ["topic1", "topic2"],
    "hashtagStrategy": {
      "topHashtags": [{"tag": "#hashtag", "count": number, "niche": "string", "estimatedMarketSize": "string"}],
      "strategy": "string - strategy assessment paragraph",
      "recommendations": ["rec1", "rec2", "rec3"]
    }
  },
  "aesthetic": {
    "dominantColors": [{"hex": "#hexcode", "name": "color name", "percentage": number}],
    "naturalPalette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
    "visualMood": ["mood1", "mood2"],
    "photographyStyle": ["style1"],
    "compositionPatterns": ["pattern1"],
    "filterStyle": "string",
    "lighting": "string",
    "overallAesthetic": "string description"
  },
  "niche": {
    "primaryNiche": {
      "name": "string",
      "confidence": number (0-1),
      "marketSize": "small|medium|large|massive",
      "hashtagVolume": null,
      "relatedKeywords": ["keyword1", "keyword2"]
    },
    "secondaryNiches": [{"name": "string", "confidence": number}],
    "nicheClarity": number (0-100)
  },
  "readinessScore": {
    "totalScore": number (0-100),
    "factors": [{"name": "factor name", "score": number, "weight": number, "weightedScore": number, "tip": "string"}],
    "tier": "not-ready|emerging|ready|prime",
    "summary": "string summary",
    "actionItems": ["action1", "action2"]
  },
  "competitors": {
    "niche": "string",
    "creatorTier": "nano|micro|mid|macro|mega",
    "similarCreators": [{"name": "string", "handle": "@handle", "followers": "string", "productLines": ["string"], "tier": "string"}],
    "competingBrands": ["brand1", "brand2"],
    "hashtagOverlapNote": "string",
    "opportunities": ["opp1", "opp2"]
  },
  "personality": {
    "archetype": "The Creator|The Sage|The Explorer|The Hero|The Magician|The Ruler|The Caregiver|The Jester|The Lover|The Innocent|The Outlaw|The Everyperson",
    "traits": ["trait1", "trait2", "trait3", "trait4"],
    "voiceTone": "string description",
    "primaryTone": "string",
    "secondaryTones": ["tone1", "tone2"],
    "toneConfidence": number (0-1),
    "voiceDescription": "string",
    "toneExamples": [{"content": "string example", "tone": "string"}],
    "values": ["value1", "value2", "value3"]
  },
  "growth": {
    "trend": "growing|stable|declining|unknown",
    "momentum": "string",
    "followerGrowthSignals": "string",
    "contentEvolution": "string"
  }
}

IMPORTANT:
- Generate realistic, specific data for ALL fields based on the social handles provided
- Use your knowledge of public creators if you recognize the handles
- If you don't recognize them, infer likely niche, audience, and content patterns from the handle names
- Include at least 3 content themes, 5 top hashtags, 3-5 personality traits, 3+ values
- Generate a complete 5-color natural palette that fits the creator's likely aesthetic
- Be specific and insightful -- this dossier drives the entire brand creation process
- ALL numbers must be realistic for the creator's likely tier (follower count, engagement, etc.)
- Return ONLY the JSON object, no markdown code blocks, no explanatory text`;

    logger.info({ brandId, userId, handles: handleParts }, 'Calling Claude for social analysis dossier');

    let aiResult;
    try {
      aiResult = await routeModel('social-analysis', {
        systemPrompt,
        prompt: taskPrompt,
        maxTokens: 8192,
        temperature: 0.7,
        jsonMode: true,
      });
    } catch (aiError) {
      logger.error({ brandId, error: aiError.message }, 'AI model call failed for social analysis');
      return res.status(503).json({
        success: false,
        error: 'AI analysis service is temporarily unavailable. Please try again in a moment.',
        detail: process.env.NODE_ENV !== 'production' ? aiError.message : undefined,
      });
    }

    // Parse the AI response
    let parsed;
    try {
      let jsonText = aiResult.text.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonText = jsonMatch[1].trim();
      parsed = JSON.parse(jsonText);
    } catch (parseErr) {
      logger.error({ brandId, error: parseErr.message, rawText: aiResult.text.slice(0, 500) }, 'Failed to parse social analysis AI response');
      return res.status(500).json({ success: false, error: 'Failed to parse AI-generated dossier' });
    }

    // Cache in wizard_state
    const updatedState = {
      ...(brand.wizard_state || {}),
      'social-analysis': {
        ...parsed,
        source: 'ai-analysis',
        socialHandles,
        generatedAt: new Date().toISOString(),
        model: aiResult.model,
      },
    };

    const { error: updateError } = await supabaseAdmin
      .from('brands')
      .update({
        wizard_step: 'social',
        wizard_state: updatedState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', brandId);

    if (updateError) {
      logger.error({ brandId, error: updateError.message, code: updateError.code }, 'Failed to save social analysis to wizard_state');
    }

    logger.info({ brandId, userId, model: aiResult.model, stateSize: JSON.stringify(updatedState).length }, 'Social analysis dossier generated');

    res.json({
      success: true,
      data: {
        brandId,
        step: 'social-analysis',
        dossier: parsed,
        model: aiResult.model,
      },
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

    logger.info({ brandId, userId, model: aiResult.model, directionCount: directions.length, stateSize: JSON.stringify(updatedState).length }, 'Brand identity directions generated');

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
 * Submit a custom product request.
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

    const { data: brand, error } = await supabaseAdmin
      .from('brands')
      .select('id, wizard_state')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (error || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    const requestId = crypto.randomUUID();
    const existingRequests = brand.wizard_state?.['custom-product-requests'] || [];
    const newRequest = {
      id: requestId,
      description,
      category,
      priceRange,
      createdAt: new Date().toISOString(),
    };

    await supabaseAdmin
      .from('brands')
      .update({
        wizard_state: {
          ...(brand.wizard_state || {}),
          'custom-product-requests': [...existingRequests, newRequest],
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', brandId);

    logger.info({ brandId, requestId, category }, 'Custom product request submitted');

    res.json({ success: true, data: { message: 'Request received', requestId } });
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
    // Walk through every remaining step until we reach 'complete'.
    const stepOrder = [
      'onboarding', 'social', 'identity', 'colors', 'fonts',
      'logos', 'products', 'mockups', 'bundles', 'projections',
      'checkout', 'complete',
    ];
    const currentIdx = stepOrder.indexOf(brand.wizard_step);
    const completeIdx = stepOrder.indexOf('complete');

    if (currentIdx < 0) {
      logger.warn({ brandId, wizardStep: brand.wizard_step }, 'Unknown current wizard step');
    }

    // Advance one step at a time to satisfy the trigger
    for (let i = Math.max(currentIdx, 0) + 1; i <= completeIdx; i++) {
      const { error: stepError } = await supabaseAdmin
        .from('brands')
        .update({
          wizard_step: stepOrder[i],
          updated_at: new Date().toISOString(),
        })
        .eq('id', brandId);

      if (stepError) {
        logger.error({ brandId, step: stepOrder[i], error: stepError.message }, 'Failed to advance wizard step');
        return res.status(500).json({ success: false, error: `Failed to advance to step: ${stepOrder[i]}` });
      }
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
