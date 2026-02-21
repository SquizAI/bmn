// server/src/workers/social-analysis-worker.js

/**
 * Social Analysis Worker -- breaks the monolithic Creator Dossier AI call into
 * 6 parallel sub-tasks for reliability and speed.
 *
 * Instead of one massive Claude call (8192 tokens, 120s timeout) that frequently
 * times out with 503s, this worker runs 5 smaller AI calls in parallel (~1024-2048
 * tokens each, ~20-30s each), then a 6th synthesis pass once those complete.
 *
 * Sub-tasks:
 *   1. PROFILE_ANALYSIS   -- extract/validate profile data
 *   2. CONTENT_ANALYSIS    -- themes, posting frequency, hashtag strategy
 *   3. AUDIENCE_ANALYSIS   -- demographics, interests, income level
 *   4. AESTHETIC_ANALYSIS   -- colors, visual mood, photography style
 *   5. NICHE_PERSONALITY   -- niche detection + brand personality/archetype
 *   6. READINESS_SYNTHESIS -- brand readiness score (depends on 1-5)
 *
 * Each sub-task emits Socket.io progress events so the UI stays responsive.
 */

import { Worker } from 'bullmq';
import * as Sentry from '@sentry/node';
import { redis } from '../lib/redis.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { createJobLogger } from './job-logger.js';
import { logger } from '../lib/logger.js';
import { routeModel } from '../skills/_shared/model-router.js';

/** @type {number} Per-subtask timeout in milliseconds. */
const SUBTASK_TIMEOUT_MS = 45_000;

/** @type {number} Maximum sub-task failures before the whole job is aborted. */
const MAX_ALLOWED_FAILURES = 3;

// ------ Redis Connection ------

/**
 * @returns {import('ioredis').RedisOptions}
 */
function getBullRedisConfig() {
  return {
    host: redis.options.host,
    port: redis.options.port,
    password: redis.options.password,
    db: redis.options.db,
    maxRetriesPerRequest: null,
  };
}

// ------ Prompt Builders ------

/**
 * Build a short data-context block to inject into each sub-task prompt.
 * Keeps scraped data concise so prompts stay under token budgets.
 *
 * @param {Object} jobData
 * @param {Object|null} jobData.scrapedData
 * @param {Object|null} jobData.firecrawlData
 * @param {Object} jobData.socialHandles
 * @returns {string}
 */
function buildDataContext({ scrapedData, firecrawlData, socialHandles }) {
  const parts = [];

  // Social handles summary
  const handleParts = [];
  if (socialHandles.instagram) handleParts.push(`Instagram: @${socialHandles.instagram.replace(/^@/, '')}`);
  if (socialHandles.tiktok) handleParts.push(`TikTok: @${socialHandles.tiktok.replace(/^@/, '')}`);
  if (socialHandles.youtube) handleParts.push(`YouTube: @${socialHandles.youtube.replace(/^@/, '')}`);
  if (socialHandles.twitter) handleParts.push(`Twitter/X: @${socialHandles.twitter.replace(/^@/, '')}`);
  if (socialHandles.facebook) handleParts.push(`Facebook: ${socialHandles.facebook}`);
  if (socialHandles.websiteUrl) handleParts.push(`Website: ${socialHandles.websiteUrl}`);
  parts.push(`<social_handles>\n${handleParts.join('\n')}\n</social_handles>`);

  // Scraped profile data (Apify)
  if (scrapedData) {
    const postSummaries = (scrapedData.posts || []).slice(0, 15).map((p, i) => {
      const caption = (p.caption || '').slice(0, 150);
      const hashtags = (p.hashtags || []).slice(0, 8).join(', ');
      return `  ${i + 1}. [${p.type || 'Post'}] Likes:${p.likes || 0} Comments:${p.comments || 0}${hashtags ? ` Tags:${hashtags}` : ''}\n     ${caption || '(no caption)'}`;
    });

    parts.push(`<scraped_instagram_data>
Display Name: ${scrapedData.displayName || 'Unknown'}
Handle: @${scrapedData.handle || ''}
Bio: ${scrapedData.bio || 'N/A'}
Followers: ${(scrapedData.followers || 0).toLocaleString()}
Following: ${(scrapedData.following || 0).toLocaleString()}
Posts: ${(scrapedData.postsCount || 0).toLocaleString()}
Verified: ${scrapedData.isVerified || false}
Profile Pic: ${scrapedData.profilePicUrl || 'N/A'}
External URL: ${scrapedData.externalUrl || 'N/A'}

Recent Posts (${postSummaries.length}):
${postSummaries.join('\n')}
</scraped_instagram_data>`);
  }

  // Firecrawl enrichment
  if (firecrawlData?.instagramPage) {
    parts.push(`<instagram_page_content>\n${firecrawlData.instagramPage.slice(0, 2500)}\n</instagram_page_content>`);
  }
  if (firecrawlData?.externalLinks) {
    parts.push(`<external_website_content>\n${firecrawlData.externalLinks.slice(0, 1500)}\n</external_website_content>`);
  }

  return parts.join('\n\n');
}

/**
 * Whether the job has real scraped data or must rely on AI knowledge.
 * @param {Object} jobData
 * @returns {boolean}
 */
function hasScrapedData(jobData) {
  return !!(jobData.scrapedData || jobData.firecrawlData);
}

// ------ Sub-Task Definitions ------

/**
 * @typedef {Object} SubTaskDef
 * @property {string} name
 * @property {string} taskType - routeModel task type
 * @property {number} maxTokens
 * @property {number} progressStart - progress % when this task starts
 * @property {number} progressEnd - progress % when this task completes
 * @property {string} phaseStart - Socket.io phase emitted at start
 * @property {string} phaseComplete - Socket.io phase emitted at completion
 * @property {string} messageStart - Human-readable start message
 * @property {string} messageComplete - Human-readable completion message
 * @property {(ctx: string, hasData: boolean) => string} buildSystemPrompt
 * @property {(ctx: string, hasData: boolean) => string} buildUserPrompt
 * @property {Object} fallbackValue - Default value if this sub-task fails
 */

/** @type {SubTaskDef[]} */
const PARALLEL_TASKS = [
  // ── 1. PROFILE ANALYSIS ──
  {
    name: 'PROFILE_ANALYSIS',
    taskType: 'extraction',
    maxTokens: 1024,
    progressStart: 10,
    progressEnd: 20,
    phaseStart: 'scraping',
    phaseComplete: 'profile-loaded',
    messageStart: 'Extracting profile data...',
    messageComplete: 'Profile data loaded!',
    buildSystemPrompt: (_ctx, hasData) =>
      `You are a social media data extractor. ${hasData ? 'Use the provided scraped data as ground truth.' : 'Infer profile data from the social handles. Use real publicly known data if you recognize the creator.'} Return ONLY valid JSON.`,
    buildUserPrompt: (ctx, hasData) =>
      `${ctx}

Extract the creator's profile data. Return JSON:
{
  "profile": {
    "displayName": "string",
    "bio": "string or null",
    "profilePicUrl": "string or null",
    "totalFollowers": number,
    "totalFollowing": number,
    "primaryPlatform": "instagram|tiktok|youtube|twitter|facebook",
    "externalUrl": "string or null",
    "isVerified": boolean
  }
}
${hasData ? 'Use exact values from the scraped data.' : 'Use real publicly known data if you recognize the handle, otherwise provide reasonable estimates.'}
Return ONLY the JSON object.`,
    fallbackValue: {
      profile: {
        displayName: 'Creator',
        bio: null,
        profilePicUrl: null,
        totalFollowers: 0,
        totalFollowing: 0,
        primaryPlatform: 'instagram',
        externalUrl: null,
        isVerified: false,
      },
    },
  },

  // ── 2. CONTENT ANALYSIS ──
  {
    name: 'CONTENT_ANALYSIS',
    taskType: 'extraction',
    maxTokens: 2048,
    progressStart: 20,
    progressEnd: 40,
    phaseStart: 'posts-loaded',
    phaseComplete: 'analyzing-aesthetic',
    messageStart: 'Analyzing content themes and patterns...',
    messageComplete: 'Content analysis complete!',
    buildSystemPrompt: (_ctx, hasData) =>
      `You are a social media content analyst. ${hasData ? 'Analyze the provided scraped post data for themes, frequency, and engagement patterns.' : 'Infer content patterns from the social handles and any known public information.'} Return ONLY valid JSON.`,
    buildUserPrompt: (ctx, hasData) =>
      `${ctx}

Analyze the creator's content strategy. Return JSON:
{
  "content": {
    "themes": [{"name": "string", "frequency": 0.5, "examples": ["string"], "sentiment": "positive|neutral|mixed"}],
    "formats": {
      "breakdown": {"reels": number, "carousel": number, "static": number, "stories": number, "live": number},
      "bestFormat": "string",
      "engagementByFormat": {},
      "totalPostsAnalyzed": number
    },
    "postingFrequency": {
      "postsPerWeek": number,
      "consistencyPercent": number,
      "bestDays": ["string"],
      "bestTimes": ["string"],
      "gaps": [],
      "avgGapHours": number,
      "analysisSpan": {"firstPost": "ISO date", "lastPost": "ISO date", "totalDays": number, "totalPosts": number}
    },
    "consistencyScore": number (0-100),
    "bestPerformingContentType": "string",
    "peakEngagementTopics": ["string", "string"],
    "hashtagStrategy": {
      "topHashtags": [{"tag": "#hashtag", "count": number, "niche": "string", "estimatedMarketSize": "string"}],
      "strategy": "string assessment paragraph",
      "recommendations": ["string", "string", "string"]
    }
  }
}
${hasData ? 'Derive all metrics from the real post data provided.' : 'Provide reasonable estimates based on the creator\'s likely niche.'}
Include at least 3 content themes, 5 top hashtags. Return ONLY the JSON object.`,
    fallbackValue: {
      content: {
        themes: [{ name: 'General', frequency: 0.5, examples: [], sentiment: 'neutral' }],
        formats: { breakdown: { reels: 40, carousel: 20, static: 30, stories: 10, live: 0 }, bestFormat: 'reels', engagementByFormat: {}, totalPostsAnalyzed: 0 },
        postingFrequency: { postsPerWeek: 3, consistencyPercent: 50, bestDays: [], bestTimes: [], gaps: [], avgGapHours: 56, analysisSpan: { firstPost: new Date().toISOString(), lastPost: new Date().toISOString(), totalDays: 0, totalPosts: 0 } },
        consistencyScore: 50,
        bestPerformingContentType: 'reels',
        peakEngagementTopics: [],
        hashtagStrategy: { topHashtags: [], strategy: 'Analysis unavailable', recommendations: [] },
      },
    },
  },

  // ── 3. AUDIENCE ANALYSIS ──
  {
    name: 'AUDIENCE_ANALYSIS',
    taskType: 'extraction',
    maxTokens: 1536,
    progressStart: 20,
    progressEnd: 40,
    phaseStart: 'analyzing-audience',
    phaseComplete: 'audience-complete',
    messageStart: 'Profiling target audience...',
    messageComplete: 'Audience profile complete!',
    buildSystemPrompt: (_ctx, hasData) =>
      `You are a social media audience analyst. ${hasData ? 'Use the provided engagement data and content themes to infer audience demographics.' : 'Infer likely audience demographics from the creator\'s niche and handles.'} Return ONLY valid JSON.`,
    buildUserPrompt: (ctx, _hasData) =>
      `${ctx}

Analyze the creator's audience demographics. Return JSON:
{
  "audience": {
    "estimatedAgeRange": "string e.g. 18-34",
    "ageBreakdown": [{"range": "18-24", "percentage": number}, {"range": "25-34", "percentage": number}, {"range": "35-44", "percentage": number}, {"range": "45+", "percentage": number}],
    "genderSplit": {"male": number, "female": number, "other": number},
    "primaryInterests": ["interest1", "interest2", "interest3", "interest4", "interest5"],
    "geographicIndicators": ["country1", "country2"],
    "incomeLevel": "budget|mid-range|premium|luxury",
    "loyaltySignals": ["signal1", "signal2"],
    "demographicConfidence": number (0-1),
    "demographicReasoning": "string explaining reasoning"
  }
}
Include at least 5 primary interests. Return ONLY the JSON object.`,
    fallbackValue: {
      audience: {
        estimatedAgeRange: '18-34',
        ageBreakdown: [{ range: '18-24', percentage: 30 }, { range: '25-34', percentage: 40 }, { range: '35-44', percentage: 20 }, { range: '45+', percentage: 10 }],
        genderSplit: { male: 40, female: 55, other: 5 },
        primaryInterests: ['lifestyle'],
        geographicIndicators: ['United States'],
        incomeLevel: 'mid-range',
        loyaltySignals: [],
        demographicConfidence: 0.3,
        demographicReasoning: 'Audience analysis unavailable -- using defaults.',
      },
    },
  },

  // ── 4. AESTHETIC ANALYSIS ──
  {
    name: 'AESTHETIC_ANALYSIS',
    taskType: 'extraction',
    maxTokens: 1536,
    progressStart: 20,
    progressEnd: 40,
    phaseStart: 'extracting-palette',
    phaseComplete: 'palette-complete',
    messageStart: 'Extracting visual aesthetic and color palette...',
    messageComplete: 'Visual palette extracted!',
    buildSystemPrompt: (_ctx, hasData) =>
      `You are a visual brand analyst specializing in color theory and aesthetic assessment. ${hasData ? 'Analyze the provided content data to determine the creator\'s visual identity.' : 'Infer the likely visual aesthetic from the creator\'s niche and handles.'} Return ONLY valid JSON.`,
    buildUserPrompt: (ctx, _hasData) =>
      `${ctx}

Analyze the creator's visual aesthetic. Return JSON:
{
  "aesthetic": {
    "dominantColors": [{"hex": "#hexcode", "name": "color name", "percentage": number}],
    "naturalPalette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
    "visualMood": ["mood1", "mood2"],
    "photographyStyle": ["style1"],
    "compositionPatterns": ["pattern1"],
    "filterStyle": "string",
    "lighting": "string",
    "overallAesthetic": "string description"
  }
}
Generate a complete 5-color natural palette. Include at least 3 dominant colors and 2 visual moods. Return ONLY the JSON object.`,
    fallbackValue: {
      aesthetic: {
        dominantColors: [{ hex: '#1A1A2E', name: 'Dark Navy', percentage: 40 }, { hex: '#E2E2E2', name: 'Light Gray', percentage: 30 }, { hex: '#B8956A', name: 'Gold', percentage: 30 }],
        naturalPalette: ['#1A1A2E', '#E2E2E2', '#B8956A', '#FFFFFF', '#333333'],
        visualMood: ['modern', 'clean'],
        photographyStyle: ['lifestyle'],
        compositionPatterns: ['centered'],
        filterStyle: 'natural',
        lighting: 'natural',
        overallAesthetic: 'Aesthetic analysis unavailable -- using defaults.',
      },
    },
  },

  // ── 5. NICHE + PERSONALITY ──
  {
    name: 'NICHE_PERSONALITY',
    taskType: 'social-analysis',
    maxTokens: 2048,
    progressStart: 40,
    progressEnd: 60,
    phaseStart: 'detecting-niche',
    phaseComplete: 'niche-complete',
    messageStart: 'Detecting niche and brand personality...',
    messageComplete: 'Niche and personality identified!',
    buildSystemPrompt: (_ctx, hasData) =>
      `You are an expert brand strategist who detects creator niches, brand archetypes, and personality traits. ${hasData ? 'Use the provided scraped data for accurate analysis.' : 'Use your knowledge of the creator (if recognizable) or infer from handles.'} Return ONLY valid JSON.`,
    buildUserPrompt: (ctx, _hasData) =>
      `${ctx}

Detect the creator's niche, personality archetype, competitors, and growth signals. Return JSON:
{
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
  "competitors": {
    "niche": "string",
    "creatorTier": "nano|micro|mid|macro|mega",
    "similarCreators": [{"name": "string", "handle": "@handle", "followers": "string", "productLines": ["string"], "tier": "string"}],
    "competingBrands": ["brand1", "brand2"],
    "hashtagOverlapNote": "string",
    "opportunities": ["opp1", "opp2"]
  },
  "growth": {
    "trend": "growing|stable|declining|unknown",
    "momentum": "string",
    "followerGrowthSignals": "string",
    "contentEvolution": "string"
  }
}
Include at least 3-5 personality traits and 3+ values. Return ONLY the JSON object.`,
    fallbackValue: {
      niche: {
        primaryNiche: { name: 'Lifestyle', confidence: 0.3, marketSize: 'large', hashtagVolume: null, relatedKeywords: [] },
        secondaryNiches: [],
        nicheClarity: 30,
      },
      personality: {
        archetype: 'The Creator',
        traits: ['creative', 'authentic'],
        voiceTone: 'conversational',
        primaryTone: 'friendly',
        secondaryTones: ['informative'],
        toneConfidence: 0.3,
        voiceDescription: 'Personality analysis unavailable -- using defaults.',
        toneExamples: [],
        values: ['authenticity', 'creativity'],
      },
      competitors: {
        niche: 'Lifestyle',
        creatorTier: 'micro',
        similarCreators: [],
        competingBrands: [],
        hashtagOverlapNote: 'Analysis unavailable',
        opportunities: [],
      },
      growth: {
        trend: 'unknown',
        momentum: 'Analysis unavailable',
        followerGrowthSignals: 'Insufficient data',
        contentEvolution: 'Insufficient data',
      },
    },
  },
];

/**
 * The synthesis sub-task runs AFTER all parallel tasks complete.
 * @type {SubTaskDef}
 */
const READINESS_TASK = {
  name: 'READINESS_SYNTHESIS',
  taskType: 'extraction',
  maxTokens: 1024,
  progressStart: 80,
  progressEnd: 95,
  phaseStart: 'calculating-readiness',
  phaseComplete: 'readiness-complete',
  messageStart: 'Calculating brand readiness score...',
  messageComplete: 'Readiness score calculated!',
  buildSystemPrompt: () =>
    'You are a brand readiness evaluator. Given all analysis data about a creator, compute a brand readiness score. Return ONLY valid JSON.',
  buildUserPrompt: (compiledResults) =>
    `Based on the following creator analysis data, compute a brand readiness score.

<analysis_data>
${compiledResults}
</analysis_data>

Return JSON:
{
  "readinessScore": {
    "totalScore": number (0-100),
    "factors": [
      {"name": "Audience Size", "score": number (0-100), "weight": 0.2, "weightedScore": number, "tip": "string"},
      {"name": "Content Consistency", "score": number (0-100), "weight": 0.2, "weightedScore": number, "tip": "string"},
      {"name": "Niche Clarity", "score": number (0-100), "weight": 0.2, "weightedScore": number, "tip": "string"},
      {"name": "Engagement Quality", "score": number (0-100), "weight": 0.2, "weightedScore": number, "tip": "string"},
      {"name": "Brand Potential", "score": number (0-100), "weight": 0.2, "weightedScore": number, "tip": "string"}
    ],
    "tier": "not-ready|emerging|ready|prime",
    "summary": "string summary paragraph",
    "actionItems": ["action1", "action2", "action3"]
  }
}
Ensure totalScore = sum of all weightedScore values. Return ONLY the JSON object.`,
  fallbackValue: {
    readinessScore: {
      totalScore: 50,
      factors: [
        { name: 'Audience Size', score: 50, weight: 0.2, weightedScore: 10, tip: 'Grow your audience to unlock more brand opportunities.' },
        { name: 'Content Consistency', score: 50, weight: 0.2, weightedScore: 10, tip: 'Post more consistently to build reliability.' },
        { name: 'Niche Clarity', score: 50, weight: 0.2, weightedScore: 10, tip: 'Sharpen your niche focus for stronger brand identity.' },
        { name: 'Engagement Quality', score: 50, weight: 0.2, weightedScore: 10, tip: 'Focus on meaningful engagement with your audience.' },
        { name: 'Brand Potential', score: 50, weight: 0.2, weightedScore: 10, tip: 'Your brand has good potential -- keep building.' },
      ],
      tier: 'emerging',
      summary: 'Readiness analysis unavailable -- default score assigned.',
      actionItems: ['Complete social analysis for accurate scoring.'],
    },
  },
};

// ------ Sub-Task Execution ------

/**
 * Run a single AI sub-task with a timeout guard.
 *
 * @param {SubTaskDef} taskDef
 * @param {string} dataContext - Pre-built data context string
 * @param {boolean} hasData - Whether real scraped data is present
 * @param {import('pino').Logger} jobLog
 * @returns {Promise<{ name: string, result: Object, model: string, durationMs: number }>}
 */
async function runSubTask(taskDef, dataContext, hasData, jobLog) {
  const startTime = Date.now();
  jobLog.info({ task: taskDef.name }, `Sub-task starting: ${taskDef.name}`);

  const systemPrompt = taskDef.buildSystemPrompt(dataContext, hasData);
  const userPrompt = taskDef.buildUserPrompt(dataContext, hasData);

  /** @type {Promise<{ text: string, model: string, provider: string, usage: Object }>} */
  const aiCall = routeModel(taskDef.taskType, {
    systemPrompt,
    prompt: userPrompt,
    maxTokens: taskDef.maxTokens,
    temperature: 0.7,
    jsonMode: true,
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`Sub-task ${taskDef.name} timed out after ${SUBTASK_TIMEOUT_MS}ms`)),
      SUBTASK_TIMEOUT_MS,
    ),
  );

  const aiResult = await Promise.race([aiCall, timeoutPromise]);

  // Parse JSON from response (handle markdown code blocks, unclosed blocks, etc.)
  let jsonText = aiResult.text.trim();
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim();
  } else if (jsonText.startsWith('```')) {
    // Handle unclosed code blocks: strip leading ```json line
    jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  }
  // Last resort: find the first { ... } or [ ... ] block
  if (!jsonText.startsWith('{') && !jsonText.startsWith('[')) {
    const braceMatch = jsonText.match(/(\{[\s\S]*\})/);
    if (braceMatch) jsonText = braceMatch[1];
  }

  const parsed = JSON.parse(jsonText);
  const durationMs = Date.now() - startTime;

  jobLog.info(
    { task: taskDef.name, model: aiResult.model, durationMs },
    `Sub-task completed: ${taskDef.name}`,
  );

  return { name: taskDef.name, result: parsed, model: aiResult.model, durationMs };
}

// ------ Compile Results ------

/**
 * Merge all sub-task results into a single dossier object.
 *
 * @param {Array<{ name: string, result: Object }>} taskResults
 * @param {Object|null} scrapedData - Original Apify data for overlay
 * @returns {Object} Compiled dossier
 */
function compileDossier(taskResults, scrapedData) {
  const dossier = {};

  for (const { name, result } of taskResults) {
    switch (name) {
      case 'PROFILE_ANALYSIS':
        dossier.profile = result.profile;
        break;
      case 'CONTENT_ANALYSIS':
        dossier.content = result.content;
        break;
      case 'AUDIENCE_ANALYSIS':
        dossier.audience = result.audience;
        break;
      case 'AESTHETIC_ANALYSIS':
        dossier.aesthetic = result.aesthetic;
        break;
      case 'NICHE_PERSONALITY':
        dossier.niche = result.niche;
        dossier.personality = result.personality;
        dossier.competitors = result.competitors;
        dossier.growth = result.growth;
        break;
      case 'READINESS_SYNTHESIS':
        dossier.readinessScore = result.readinessScore;
        break;
      default:
        // Merge unknown keys directly
        Object.assign(dossier, result);
    }
  }

  // Build platforms array from profile data
  if (dossier.profile) {
    dossier.platforms = [
      {
        platform: dossier.profile.primaryPlatform || 'instagram',
        handle: scrapedData?.handle || '',
        displayName: dossier.profile.displayName,
        bio: dossier.profile.bio,
        profilePicUrl: dossier.profile.profilePicUrl,
        isVerified: dossier.profile.isVerified,
        metrics: {
          followers: dossier.profile.totalFollowers,
          following: dossier.profile.totalFollowing,
          postCount: scrapedData?.postsCount || 0,
          engagementRate: 0,
          avgLikes: 0,
          avgComments: 0,
          avgShares: null,
          avgViews: null,
        },
        recentPosts: [],
        topPosts: [],
        scrapedAt: new Date().toISOString(),
      },
    ];

    // Compute engagement metrics from scraped posts if available
    if (scrapedData?.posts?.length) {
      const posts = scrapedData.posts;
      const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
      const totalComments = posts.reduce((sum, p) => sum + (p.comments || 0), 0);
      const avgLikes = Math.round(totalLikes / posts.length);
      const avgComments = Math.round(totalComments / posts.length);
      const engagementRate = scrapedData.followers > 0
        ? parseFloat(((totalLikes + totalComments) / posts.length / scrapedData.followers).toFixed(4))
        : 0;

      dossier.platforms[0].metrics.engagementRate = engagementRate;
      dossier.platforms[0].metrics.avgLikes = avgLikes;
      dossier.platforms[0].metrics.avgComments = avgComments;
    }
  }

  // Overlay real scraped profile data to ensure accuracy
  if (scrapedData && dossier.profile) {
    dossier.profile.displayName = scrapedData.displayName || dossier.profile.displayName;
    dossier.profile.bio = scrapedData.bio || dossier.profile.bio;
    dossier.profile.profilePicUrl = scrapedData.profilePicUrl || dossier.profile.profilePicUrl;
    dossier.profile.totalFollowers = scrapedData.followers ?? dossier.profile.totalFollowers;
    dossier.profile.totalFollowing = scrapedData.following ?? dossier.profile.totalFollowing;
    dossier.profile.externalUrl = scrapedData.externalUrl || dossier.profile.externalUrl;
    dossier.profile.isVerified = scrapedData.isVerified ?? dossier.profile.isVerified;

    // Also overlay on platforms[0]
    if (dossier.platforms?.[0]) {
      dossier.platforms[0].profilePicUrl = scrapedData.profilePicUrl;
      dossier.platforms[0].isVerified = scrapedData.isVerified;
      dossier.platforms[0].displayName = scrapedData.displayName;
      dossier.platforms[0].bio = scrapedData.bio;
      if (dossier.platforms[0].metrics) {
        dossier.platforms[0].metrics.followers = scrapedData.followers;
        dossier.platforms[0].metrics.following = scrapedData.following;
        dossier.platforms[0].metrics.postCount = scrapedData.postsCount;
      }
    }
  }

  return dossier;
}

// ------ Emit Helpers ------

/**
 * Emit a Socket.io progress event.
 *
 * @param {import('socket.io').Server|null} io
 * @param {string} userId
 * @param {string} jobId
 * @param {string} phase
 * @param {number} progress
 * @param {string} message
 * @param {Object} [data]
 */
function emitProgress(io, userId, jobId, phase, progress, message, data) {
  if (!io) return;
  io.to(`user:${userId}`).emit('generation:progress', {
    jobId,
    phase,
    progress,
    message,
    ...(data && { data }),
  });
}

/**
 * Emit a Socket.io completion event.
 *
 * @param {import('socket.io').Server|null} io
 * @param {string} userId
 * @param {string} jobId
 * @param {Object} dossier
 */
function emitComplete(io, userId, jobId, dossier) {
  if (!io) return;
  io.to(`user:${userId}`).emit('generation:complete', {
    jobId,
    result: dossier,
  });
}

/**
 * Emit a Socket.io error event.
 *
 * @param {import('socket.io').Server|null} io
 * @param {string} userId
 * @param {string} jobId
 * @param {string} errorMessage
 */
function emitError(io, userId, jobId, errorMessage) {
  if (!io) return;
  io.to(`user:${userId}`).emit('generation:error', {
    jobId,
    error: errorMessage,
  });
}

// ------ Worker ------

/**
 * Initialize the Social Analysis worker.
 *
 * Processes 'social-analysis' queue jobs by running 6 chunked AI sub-tasks:
 * 5 in parallel, then 1 synthesis pass. Emits Socket.io progress throughout.
 *
 * @param {import('socket.io').Server} io - Socket.io server instance
 * @returns {Worker}
 */
export function initSocialAnalysisWorker(io) {
  const worker = new Worker(
    'social-analysis',
    async (job) => {
      const { brandId, userId, socialHandles, scrapedData, firecrawlData } = job.data;
      const jobLog = createJobLogger(job, 'social-analysis');

      jobLog.info(
        {
          brandId,
          userId,
          handles: Object.keys(socialHandles).filter((k) => socialHandles[k]),
          hasApifyData: !!scrapedData,
          hasFirecrawlData: !!firecrawlData,
        },
        'Social analysis worker started -- chunked parallel mode',
      );

      const overallStart = Date.now();

      // Build shared data context once (reused by all sub-tasks)
      const dataContext = buildDataContext({ scrapedData, firecrawlData, socialHandles });
      const hasData = hasScrapedData(job.data);

      // ── Phase 1: Run tasks 1-5 in parallel ──
      emitProgress(io, userId, job.id, 'scraping', 5, 'Starting parallel analysis...');

      const parallelPromises = PARALLEL_TASKS.map(async (taskDef) => {
        // Emit task start
        emitProgress(io, userId, job.id, taskDef.phaseStart, taskDef.progressStart, taskDef.messageStart);

        try {
          const result = await runSubTask(taskDef, dataContext, hasData, jobLog);

          // Emit task completion with partial data
          emitProgress(
            io, userId, job.id,
            taskDef.phaseComplete,
            taskDef.progressEnd,
            taskDef.messageComplete,
            result.result,
          );

          return result;
        } catch (err) {
          jobLog.error(
            { task: taskDef.name, error: err.message },
            `Sub-task failed: ${taskDef.name}`,
          );

          Sentry.captureException(err, {
            tags: { queue: 'social-analysis', subtask: taskDef.name },
            extra: { brandId, userId },
          });

          // Emit task completion with fallback notice
          emitProgress(
            io, userId, job.id,
            taskDef.phaseComplete,
            taskDef.progressEnd,
            `${taskDef.name} used fallback data`,
            taskDef.fallbackValue,
          );

          return {
            name: taskDef.name,
            result: taskDef.fallbackValue,
            model: 'fallback',
            durationMs: Date.now() - overallStart,
            failed: true,
            error: err.message,
          };
        }
      });

      const settledResults = await Promise.allSettled(parallelPromises);

      // Collect results (all should be fulfilled since we handle errors inside the map)
      const taskResults = [];
      let failureCount = 0;

      for (const settled of settledResults) {
        if (settled.status === 'fulfilled') {
          taskResults.push(settled.value);
          if (settled.value.failed) failureCount++;
        } else {
          // This shouldn't happen given our error handling above, but just in case
          failureCount++;
          jobLog.error({ error: settled.reason?.message }, 'Unexpected sub-task rejection');
        }
      }

      // Check if too many failures occurred
      if (failureCount >= MAX_ALLOWED_FAILURES) {
        const errorMsg = `Social analysis failed: ${failureCount}/${PARALLEL_TASKS.length} sub-tasks failed`;
        jobLog.error({ failureCount, brandId }, errorMsg);
        emitError(io, userId, job.id, 'Analysis encountered too many errors. Please try again.');
        throw new Error(errorMsg);
      }

      // Update job progress
      await job.updateProgress(70);
      emitProgress(io, userId, job.id, 'calculating-readiness', 75, 'Synthesizing results...');

      // ── Phase 2: Run the readiness synthesis (depends on tasks 1-5) ──
      const compiledSummary = JSON.stringify(
        taskResults.reduce((acc, { name, result }) => {
          acc[name] = result;
          return acc;
        }, {}),
        null,
        2,
      );

      let readinessResult;
      try {
        emitProgress(io, userId, job.id, READINESS_TASK.phaseStart, READINESS_TASK.progressStart, READINESS_TASK.messageStart);

        const systemPrompt = READINESS_TASK.buildSystemPrompt();
        const userPrompt = READINESS_TASK.buildUserPrompt(compiledSummary);

        const aiCall = routeModel(READINESS_TASK.taskType, {
          systemPrompt,
          prompt: userPrompt,
          maxTokens: READINESS_TASK.maxTokens,
          temperature: 0.5,
          jsonMode: true,
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Readiness synthesis timed out')),
            SUBTASK_TIMEOUT_MS,
          ),
        );

        const aiResult = await Promise.race([aiCall, timeoutPromise]);

        let jsonText = aiResult.text.trim();
        const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonText = jsonMatch[1].trim();
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
        }
        if (!jsonText.startsWith('{') && !jsonText.startsWith('[')) {
          const braceMatch = jsonText.match(/(\{[\s\S]*\})/);
          if (braceMatch) jsonText = braceMatch[1];
        }

        const parsed = JSON.parse(jsonText);
        readinessResult = { name: 'READINESS_SYNTHESIS', result: parsed, model: aiResult.model };

        emitProgress(
          io, userId, job.id,
          READINESS_TASK.phaseComplete,
          READINESS_TASK.progressEnd,
          READINESS_TASK.messageComplete,
          parsed,
        );

        jobLog.info({ model: aiResult.model }, 'Readiness synthesis completed');
      } catch (err) {
        jobLog.error({ error: err.message }, 'Readiness synthesis failed -- using fallback');
        Sentry.captureException(err, {
          tags: { queue: 'social-analysis', subtask: 'READINESS_SYNTHESIS' },
          extra: { brandId, userId },
        });

        readinessResult = {
          name: 'READINESS_SYNTHESIS',
          result: READINESS_TASK.fallbackValue,
          model: 'fallback',
        };

        emitProgress(
          io, userId, job.id,
          READINESS_TASK.phaseComplete,
          READINESS_TASK.progressEnd,
          'Readiness score estimated',
          READINESS_TASK.fallbackValue,
        );
      }

      // Add readiness to task results
      taskResults.push(readinessResult);

      // ── Phase 3: Compile final dossier ──
      await job.updateProgress(95);
      const dossier = compileDossier(taskResults, scrapedData);

      // Determine data sources
      const sources = [];
      if (scrapedData) sources.push('apify');
      if (firecrawlData?.instagramPage) sources.push('firecrawl');
      if (firecrawlData?.externalLinks) sources.push('firecrawl-external');
      if (sources.length === 0) sources.push('ai-knowledge');
      const source = sources.join('+');

      // Track which models were used
      const modelsUsed = [...new Set(taskResults.map((t) => t.model).filter(Boolean))];

      // Attach metadata
      dossier.source = source;
      dossier.socialHandles = socialHandles;
      dossier.generatedAt = new Date().toISOString();
      dossier.models = modelsUsed;
      dossier.chunked = true;
      dossier.taskDurations = taskResults
        .filter((t) => t.durationMs)
        .reduce((acc, t) => {
          acc[t.name] = t.durationMs;
          return acc;
        }, {});

      // ── Phase 4: Save to wizard_state ──
      const { data: brand } = await supabaseAdmin
        .from('brands')
        .select('wizard_state')
        .eq('id', brandId)
        .single();

      const updatedState = {
        ...(brand?.wizard_state || {}),
        'social-analysis': dossier,
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
        jobLog.error(
          { brandId, error: updateError.message, code: updateError.code },
          'Failed to save social analysis dossier to wizard_state',
        );
      }

      await job.updateProgress(100);

      const totalDurationMs = Date.now() - overallStart;

      // Emit final completion
      emitProgress(io, userId, job.id, 'complete', 100, 'Analysis complete!');
      emitComplete(io, userId, job.id, dossier);

      jobLog.info(
        {
          brandId,
          userId,
          source,
          modelsUsed,
          failureCount,
          totalDurationMs,
          stateSize: JSON.stringify(updatedState).length,
        },
        'Social analysis dossier generated (chunked parallel mode)',
      );

      return {
        brandId,
        source,
        modelsUsed,
        failureCount,
        totalDurationMs,
        dossier,
      };
    },
    {
      connection: getBullRedisConfig(),
      concurrency: 3,
    },
  );

  // ── Event Handlers ──

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, err, attempts: job?.attemptsMade },
      'Social analysis worker: job failed',
    );

    if (job?.attemptsMade >= 2) {
      Sentry.captureException(err, {
        tags: { queue: 'social-analysis' },
        extra: { jobData: job?.data },
      });
    }

    // Emit error to user
    const userId = job?.data?.userId;
    if (userId) {
      emitError(io, userId, job?.id, 'Social analysis failed. Please try again.');
    }
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Social analysis worker: error');
  });

  worker.on('completed', (job) => {
    logger.info(
      { jobId: job?.id, brandId: job?.data?.brandId },
      'Social analysis worker: job completed',
    );
  });

  return worker;
}
