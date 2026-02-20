// server/src/services/competitor.js

/**
 * Competitor Analysis Service
 *
 * Analyzes the competitive landscape for a creator's niche using Apify
 * for discovery and Claude for strategic analysis. Returns structured
 * competitor profiles with market positioning insights.
 *
 * Features:
 * - Discovers 3-5 similar creators in the same niche via Apify
 * - Extracts name, handle, followers, product types, revenue category
 * - Uses Claude (social-analysis route) for market analysis summary
 * - Graceful degradation when scraping fails for individual competitors
 */

import { logger as rootLogger } from '../lib/logger.js';
import { routeModel } from '../skills/_shared/model-router.js';
import { scrapeProfile } from './apify.js';

const logger = rootLogger.child({ service: 'competitor' });

/**
 * @typedef {Object} CompetitorProfile
 * @property {string} name - Display name
 * @property {string} handle - Social media handle
 * @property {string} platform - Primary platform
 * @property {number} followers - Follower count
 * @property {string[]} products - Product types they sell
 * @property {'micro'|'small'|'medium'|'large'|'enterprise'} revenueCategory - Estimated revenue bracket
 */

/**
 * @typedef {Object} CompetitorAnalysisResult
 * @property {CompetitorProfile[]} competitors
 * @property {string} marketAnalysis - AI-generated competitive landscape summary
 */

/**
 * Map follower count to an estimated revenue category.
 *
 * @param {number} followers
 * @returns {'micro'|'small'|'medium'|'large'|'enterprise'}
 */
function estimateRevenueCategory(followers) {
  if (followers < 10_000) return 'micro';
  if (followers < 50_000) return 'small';
  if (followers < 250_000) return 'medium';
  if (followers < 1_000_000) return 'large';
  return 'enterprise';
}

/**
 * Use Claude to identify competitor handles in a niche, then scrape them.
 *
 * @param {string} niche - Primary niche/category (e.g. "fitness coaching", "beauty")
 * @param {Object} followPatterns - Social follow patterns from dossier
 * @param {number} [followPatterns.followerCount] - User's follower count for calibration
 * @param {string} [followPatterns.platform] - User's primary platform
 * @param {string[]} [followPatterns.hashtags] - User's top hashtags
 * @returns {Promise<CompetitorAnalysisResult>}
 */
export async function analyzeCompetitors(niche, followPatterns = {}) {
  logger.info({ niche, followPatterns }, 'Starting competitor analysis');

  // Step 1: Ask Claude to identify competitor handles in this niche
  const discoveryPrompt = `You are a competitive intelligence analyst for creator brands.

Given the following niche and creator context, identify 3-5 real, well-known creators/brands in this space that would be direct competitors.

<niche>${niche}</niche>

<creator_context>
Platform: ${followPatterns.platform || 'instagram'}
Follower count: ${followPatterns.followerCount || 'unknown'}
Top hashtags: ${(followPatterns.hashtags || []).join(', ') || 'none provided'}
</creator_context>

For each competitor, provide:
- name: Their display/brand name
- handle: Their social media handle (without @)
- platform: Which platform they're most known on (instagram, tiktok, youtube, twitter, facebook)
- estimatedFollowers: Your best estimate of their follower count
- knownProducts: Array of product types they sell (e.g. ["courses", "merch", "coaching", "ebooks", "supplements"])
- whyCompetitor: One sentence explaining why they're a relevant competitor

Return as JSON:
{
  "competitors": [
    {
      "name": "...",
      "handle": "...",
      "platform": "...",
      "estimatedFollowers": 0,
      "knownProducts": ["..."],
      "whyCompetitor": "..."
    }
  ]
}`;

  let discoveredCompetitors = [];

  try {
    const discoveryResult = await routeModel('social-analysis', {
      prompt: discoveryPrompt,
      maxTokens: 2048,
      temperature: 0.7,
      jsonMode: true,
    });

    let parsed;
    try {
      let jsonText = discoveryResult.text.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonText = jsonMatch[1].trim();
      parsed = JSON.parse(jsonText);
    } catch (parseErr) {
      logger.error({ error: parseErr.message, rawText: discoveryResult.text.slice(0, 500) }, 'Failed to parse competitor discovery response');
      parsed = { competitors: [] };
    }

    discoveredCompetitors = parsed.competitors || [];
  } catch (err) {
    logger.error({ error: err.message, niche }, 'Competitor discovery AI call failed');
    return {
      competitors: [],
      marketAnalysis: 'Unable to analyze competitive landscape at this time. Please try again later.',
    };
  }

  // Step 2: Attempt to scrape each discovered competitor for real data
  /** @type {CompetitorProfile[]} */
  const competitors = [];

  const scrapePromises = discoveredCompetitors.slice(0, 5).map(async (/** @type {any} */ comp) => {
    try {
      const result = await scrapeProfile(comp.platform || 'instagram', comp.handle, { postLimit: 3 });

      if (result.success) {
        return {
          name: result.profile.displayName || comp.name,
          handle: comp.handle,
          platform: comp.platform || 'instagram',
          followers: result.profile.followerCount,
          products: comp.knownProducts || [],
          revenueCategory: estimateRevenueCategory(result.profile.followerCount),
        };
      }

      // Scrape failed -- fall back to AI-estimated data
      logger.warn({ handle: comp.handle, error: result.error }, 'Competitor scrape failed, using AI estimates');
      return {
        name: comp.name,
        handle: comp.handle,
        platform: comp.platform || 'instagram',
        followers: comp.estimatedFollowers || 0,
        products: comp.knownProducts || [],
        revenueCategory: estimateRevenueCategory(comp.estimatedFollowers || 0),
      };
    } catch (err) {
      logger.warn({ handle: comp.handle, error: err.message }, 'Competitor scrape threw, using AI estimates');
      return {
        name: comp.name,
        handle: comp.handle,
        platform: comp.platform || 'instagram',
        followers: comp.estimatedFollowers || 0,
        products: comp.knownProducts || [],
        revenueCategory: estimateRevenueCategory(comp.estimatedFollowers || 0),
      };
    }
  });

  const results = await Promise.allSettled(scrapePromises);
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      competitors.push(result.value);
    }
  }

  // Step 3: Generate market analysis summary using Claude
  let marketAnalysis = '';

  try {
    const analysisPrompt = `You are a brand strategist analyzing a creator's competitive landscape.

<niche>${niche}</niche>

<competitors>
${JSON.stringify(competitors, null, 2)}
</competitors>

<creator_context>
Follower count: ${followPatterns.followerCount || 'unknown'}
Platform: ${followPatterns.platform || 'instagram'}
</creator_context>

Write a concise (2-3 paragraph) competitive landscape analysis that covers:
1. Market positioning -- where does this creator fit relative to competitors?
2. Gaps and opportunities -- what product types or approaches are underserved?
3. Differentiation strategy -- how can this creator stand out?

Be specific and actionable. Reference the actual competitors by name. Write in a professional but encouraging tone.`;

    const analysisResult = await routeModel('social-analysis', {
      prompt: analysisPrompt,
      maxTokens: 1024,
      temperature: 0.7,
    });

    marketAnalysis = analysisResult.text.trim();
  } catch (err) {
    logger.error({ error: err.message }, 'Market analysis AI call failed');
    marketAnalysis = 'Competitive analysis is temporarily unavailable. The competitor profiles above are still available for your review.';
  }

  logger.info({ niche, competitorCount: competitors.length }, 'Competitor analysis complete');

  return {
    competitors,
    marketAnalysis,
  };
}

export default {
  analyzeCompetitors,
};
