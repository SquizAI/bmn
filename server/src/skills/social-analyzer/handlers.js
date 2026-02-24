// server/src/skills/social-analyzer/handlers.js
//
// Execution handlers for the social-analyzer skill.
// Each handler corresponds to a tool defined in tools.js.
// Handlers contain the actual API calls (Apify, Gemini Flash, Claude, Supabase)
// and are wired to tool definitions in index.js.

import { tools } from './tools.js';

/**
 * Scrape Instagram profile via Apify.
 * @param {{ handle: string, postLimit?: number }} input
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function scrapeInstagram(input) {
  return tools.scrapeInstagram.execute(input);
}

/**
 * Scrape TikTok profile via Apify.
 * @param {{ handle: string, videoLimit?: number }} input
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function scrapeTikTok(input) {
  return tools.scrapeTikTok.execute(input);
}

/**
 * Scrape Facebook page via Apify.
 * @param {{ handle: string, postLimit?: number }} input
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function scrapeFacebook(input) {
  return tools.scrapeFacebook.execute(input);
}

/**
 * Scrape YouTube channel via Apify.
 * @param {{ handle: string, videoLimit?: number }} input
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function scrapeYouTube(input) {
  return tools.scrapeYouTube.execute(input);
}

/**
 * Scrape X/Twitter profile via Apify.
 * @param {{ handle: string, tweetLimit?: number }} input
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function scrapeTwitter(input) {
  return tools.scrapeTwitter.execute(input);
}

/**
 * Analyze visual aesthetic from post images using Gemini Flash.
 * @param {{ imageUrls: string[] }} input
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function analyzeAesthetic(input) {
  return tools.analyzeAesthetic.execute(input);
}

/**
 * Extract natural color palette from feed images via Gemini Flash.
 * @param {{ imageUrls: string[] }} input
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function extractFeedPalette(input) {
  return tools.extractFeedPalette.execute(input);
}

/**
 * Detect primary and secondary niches from content signals.
 * @param {{ bio: string | null, captions: string[], hashtags: string[], themes?: string[] }} input
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function detectNiche(input) {
  return tools.detectNiche.execute(input);
}

/**
 * Calculate Brand Readiness Score from aggregated metrics.
 * @param {Object} input
 * @returns {{ success: boolean, data: Object }}
 */
export function calculateReadiness(input) {
  return tools.calculateReadiness.execute(input);
}

/**
 * Calculate posting frequency from timestamps.
 * @param {{ timestamps: string[] }} input
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
export function calculatePostingFrequency(input) {
  return tools.calculatePostingFrequency.execute(input);
}

/**
 * Analyze hashtag strategy with frequency and niche alignment.
 * @param {{ posts: Array, detectedNiche?: string }} input
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
export function analyzeHashtagStrategy(input) {
  return tools.analyzeHashtagStrategy.execute(input);
}

/**
 * Detect content format distribution and best-performing format.
 * @param {{ posts: Array }} input
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
export function detectContentFormats(input) {
  return tools.detectContentFormats.execute(input);
}

/**
 * Detect similar creators and competitor brands.
 * @param {{ niche: string, hashtags?: string[], followerCount: number }} input
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
export function detectCompetitors(input) {
  return tools.detectCompetitors.execute(input);
}

/**
 * Estimate audience demographics using AI.
 * @param {Object} input
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function estimateAudienceDemographics(input) {
  return tools.estimateAudienceDemographics.execute(input);
}

/**
 * Analyze posting frequency with enhanced gap analysis.
 * @param {{ timestamps: string[] }} input
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
export function analyzePostingFrequency(input) {
  return tools.analyzePostingFrequency.execute(input);
}

/**
 * AI-enhanced hashtag strategy analysis with niche mapping.
 * @param {{ posts: Array }} input
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function analyzeHashtagStrategyAI(input) {
  return tools.analyzeHashtagStrategyAI.execute(input);
}

/**
 * Analyze content format preferences.
 * @param {{ posts: Array }} input
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
export function analyzeContentFormats(input) {
  return tools.analyzeContentFormats.execute(input);
}

/**
 * Analyze content tone and voice using AI.
 * @param {{ captions: string[], bio?: string | null }} input
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function analyzeContentTone(input) {
  return tools.analyzeContentTone.execute(input);
}

/**
 * Detect existing brand name from profile data.
 * @param {{ bio: string | null, displayName: string | null, externalUrl?: string | null, websiteText?: string | null }} input
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function detectExistingBrandName(input) {
  return tools.detectExistingBrandName.execute(input);
}
