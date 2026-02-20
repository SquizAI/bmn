// server/src/services/apify.js

/**
 * Apify Web Scraping Service
 *
 * Unified scraping interface for Instagram, TikTok, and Facebook profiles.
 * Returns a normalized ScrapeProfileOutput for all platforms.
 *
 * Features:
 * - Lazy-loaded ApifyClient (avoids hard dependency)
 * - Monthly budget cap tracked in Redis
 * - Per-platform normalization to unified schema
 * - Retry with configurable backoff [1s, 5s, 15s]
 * - Graceful fallback on failure (structured error, not thrown)
 */

import { logger as rootLogger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import { config } from '../config/index.js';

const logger = rootLogger.child({ service: 'apify' });

// ── Lazy Client ───────────────────────────────────────────────────

/** @type {import('apify-client').ApifyClient | null} */
let _client = null;

/**
 * Get the ApifyClient singleton (lazy-loaded).
 * @returns {Promise<import('apify-client').ApifyClient>}
 */
async function getClient() {
  if (!_client) {
    try {
      const { ApifyClient } = await import('apify-client');
      _client = new ApifyClient({ token: config.APIFY_API_TOKEN });
    } catch {
      throw new Error('apify-client is not installed. Run: npm install apify-client');
    }
  }
  return _client;
}

// ── Actor IDs ─────────────────────────────────────────────────────

const ACTORS = {
  instagram: 'apify/instagram-profile-scraper',
  tiktok: 'clockworks/tiktok-profile-scraper',
  facebook: 'apify/facebook-pages-scraper',
};

// ── Retry Configuration ───────────────────────────────────────────

const RETRY_BACKOFF_MS = [1_000, 5_000, 15_000];
const MAX_RETRIES = 3;

// ── Cost Management ───────────────────────────────────────────────

/**
 * Check if the monthly Apify budget allows this scrape.
 *
 * @param {number} estimatedCostUsd
 * @returns {Promise<boolean>} True if within budget
 */
async function checkBudget(estimatedCostUsd) {
  try {
    const monthKey = `apify:cost:${new Date().toISOString().slice(0, 7)}`;
    const currentCost = parseFloat(await redis.get(monthKey) || '0');
    const budget = parseFloat(process.env.APIFY_MONTHLY_BUDGET_USD || '50');

    if (currentCost + estimatedCostUsd > budget) {
      logger.warn({ currentCost, estimatedCost: estimatedCostUsd, budget }, 'Apify monthly budget exceeded');
      return false;
    }
    return true;
  } catch (err) {
    // If Redis fails, allow the scrape
    logger.warn({ err }, 'Budget check failed, allowing scrape');
    return true;
  }
}

/**
 * Record the actual cost of a completed Apify run.
 *
 * @param {number} actualCostUsd
 * @returns {Promise<void>}
 */
async function recordCost(actualCostUsd) {
  try {
    const monthKey = `apify:cost:${new Date().toISOString().slice(0, 7)}`;
    await redis.incrbyfloat(monthKey, actualCostUsd);
    // Expire at end of month + 7 day buffer
    await redis.expire(monthKey, 40 * 24 * 3600);
  } catch (err) {
    logger.warn({ err }, 'Failed to record Apify cost');
  }
}

// ── Unified Output Schema ─────────────────────────────────────────

/**
 * @typedef {Object} SocialPost
 * @property {string} [id]
 * @property {string} [caption]
 * @property {string} [imageUrl]
 * @property {string} [videoUrl]
 * @property {number} likeCount
 * @property {number} commentCount
 * @property {number} shareCount
 * @property {number} viewCount
 * @property {string} [timestamp]
 * @property {string[]} hashtags
 * @property {'image'|'video'|'carousel'|'reel'|'text'} type
 */

/**
 * @typedef {Object} SocialProfileData
 * @property {string} handle
 * @property {string} displayName
 * @property {string} bio
 * @property {number} followerCount
 * @property {number} followingCount
 * @property {number} postCount
 * @property {string} [profilePicUrl]
 * @property {boolean} isVerified
 */

/**
 * @typedef {Object} ScrapeProfileOutput
 * @property {boolean} success
 * @property {'instagram'|'tiktok'|'facebook'} platform
 * @property {SocialProfileData} profile
 * @property {SocialPost[]} recentPosts
 * @property {string|null} error
 */

// ── Retry Helper ──────────────────────────────────────────────────

/**
 * Execute a function with retry and exponential backoff.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {string} label - Description for logging
 * @returns {Promise<T>}
 */
async function withRetry(fn, label) {
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_BACKOFF_MS[attempt] || 15_000;
        logger.warn({ attempt: attempt + 1, delay, label, error: err.message }, 'Retrying after failure');
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// ── Platform Scrapers ─────────────────────────────────────────────

/**
 * Scrape an Instagram profile.
 *
 * @param {string} handle - Instagram username (without @)
 * @param {number} [postLimit=12] - Number of recent posts to scrape
 * @returns {Promise<ScrapeProfileOutput>}
 */
export async function scrapeInstagram(handle, postLimit = 12) {
  const cleanHandle = handle.replace(/^@/, '').trim();
  logger.info({ handle: cleanHandle, postLimit }, 'Scraping Instagram profile');

  if (!(await checkBudget(0.05))) {
    return {
      success: false,
      platform: 'instagram',
      profile: emptyProfile(cleanHandle),
      recentPosts: [],
      error: 'Apify monthly budget exceeded. Try again next month or upgrade.',
    };
  }

  try {
    return await withRetry(async () => {
      const client = await getClient();

      const run = await client.actor(ACTORS.instagram).call(
        {
          usernames: [cleanHandle],
          resultsLimit: postLimit,
          addParentData: false,
        },
        {
          timeout: 120,
          memory: 256,
        }
      );

      const { items } = await client.dataset(run.defaultDatasetId).listItems();

      if (!items || items.length === 0) {
        throw new Error(`No data returned for Instagram @${cleanHandle}. Profile may be private or not exist.`);
      }

      const raw = items[0];
      const actualCost = run.stats?.costUsd || 0.02;
      await recordCost(actualCost);

      return normalizeInstagram(raw, cleanHandle);
    }, `instagram:${cleanHandle}`);
  } catch (err) {
    logger.error({ handle: cleanHandle, error: err.message }, 'Instagram scrape failed after retries');
    return {
      success: false,
      platform: 'instagram',
      profile: emptyProfile(cleanHandle),
      recentPosts: [],
      error: err.message,
    };
  }
}

/**
 * Scrape a TikTok profile.
 *
 * @param {string} handle - TikTok username (without @)
 * @param {number} [videoLimit=12] - Number of recent videos to scrape
 * @returns {Promise<ScrapeProfileOutput>}
 */
export async function scrapeTikTok(handle, videoLimit = 12) {
  const cleanHandle = handle.replace(/^@/, '').trim();
  logger.info({ handle: cleanHandle, videoLimit }, 'Scraping TikTok profile');

  if (!(await checkBudget(0.05))) {
    return {
      success: false,
      platform: 'tiktok',
      profile: emptyProfile(cleanHandle),
      recentPosts: [],
      error: 'Apify monthly budget exceeded.',
    };
  }

  try {
    return await withRetry(async () => {
      const client = await getClient();

      const run = await client.actor(ACTORS.tiktok).call(
        {
          profiles: [`https://www.tiktok.com/@${cleanHandle}`],
          resultsPerPage: videoLimit,
          shouldDownloadVideos: false,
          shouldDownloadCovers: false,
        },
        {
          timeout: 120,
          memory: 256,
        }
      );

      const { items } = await client.dataset(run.defaultDatasetId).listItems();

      if (!items || items.length === 0) {
        throw new Error(`No data returned for TikTok @${cleanHandle}. Profile may be private or not exist.`);
      }

      const raw = items[0];
      const actualCost = run.stats?.costUsd || 0.03;
      await recordCost(actualCost);

      return normalizeTikTok(raw, cleanHandle);
    }, `tiktok:${cleanHandle}`);
  } catch (err) {
    logger.error({ handle: cleanHandle, error: err.message }, 'TikTok scrape failed after retries');
    return {
      success: false,
      platform: 'tiktok',
      profile: emptyProfile(cleanHandle),
      recentPosts: [],
      error: err.message,
    };
  }
}

/**
 * Scrape a Facebook page.
 *
 * @param {string} pageId - Facebook page URL or page name
 * @param {number} [postLimit=12] - Number of recent posts to scrape
 * @returns {Promise<ScrapeProfileOutput>}
 */
export async function scrapeFacebook(pageId, postLimit = 12) {
  const url = pageId.startsWith('http') ? pageId : `https://www.facebook.com/${pageId}`;
  logger.info({ url, postLimit }, 'Scraping Facebook page');

  if (!(await checkBudget(0.05))) {
    return {
      success: false,
      platform: 'facebook',
      profile: emptyProfile(pageId),
      recentPosts: [],
      error: 'Apify monthly budget exceeded.',
    };
  }

  try {
    return await withRetry(async () => {
      const client = await getClient();

      const run = await client.actor(ACTORS.facebook).call(
        {
          startUrls: [{ url }],
          maxPosts: postLimit,
        },
        {
          timeout: 180, // Facebook scraping is slower
          memory: 512,
        }
      );

      const { items } = await client.dataset(run.defaultDatasetId).listItems();

      if (!items || items.length === 0) {
        throw new Error('No data returned for Facebook page. Page may be private or not exist.');
      }

      const raw = items[0];
      const actualCost = run.stats?.costUsd || 0.04;
      await recordCost(actualCost);

      return normalizeFacebook(raw, pageId);
    }, `facebook:${pageId}`);
  } catch (err) {
    logger.error({ pageId, error: err.message }, 'Facebook scrape failed after retries');
    return {
      success: false,
      platform: 'facebook',
      profile: emptyProfile(pageId),
      recentPosts: [],
      error: err.message,
    };
  }
}

// ── Router ────────────────────────────────────────────────────────

/**
 * Route to the correct scraper based on platform.
 *
 * @param {'instagram'|'tiktok'|'facebook'} platform
 * @param {string} handle
 * @param {Object} [options]
 * @param {number} [options.postLimit=12]
 * @returns {Promise<ScrapeProfileOutput>}
 */
export async function scrapeProfile(platform, handle, options = {}) {
  const postLimit = options.postLimit || 12;

  switch (platform) {
    case 'instagram':
      return scrapeInstagram(handle, postLimit);
    case 'tiktok':
      return scrapeTikTok(handle, postLimit);
    case 'facebook':
      return scrapeFacebook(handle, postLimit);
    default:
      return {
        success: false,
        platform,
        profile: emptyProfile(handle),
        recentPosts: [],
        error: `Unsupported platform: ${platform}. Supported: instagram, tiktok, facebook.`,
      };
  }
}

// ── Data Normalization ────────────────────────────────────────────

/**
 * Create an empty profile object.
 *
 * @param {string} handle
 * @returns {SocialProfileData}
 */
function emptyProfile(handle) {
  return {
    handle: handle || '',
    displayName: '',
    bio: '',
    followerCount: 0,
    followingCount: 0,
    postCount: 0,
    profilePicUrl: '',
    isVerified: false,
  };
}

/**
 * Normalize Instagram API response to unified output.
 *
 * @param {Object} raw - Raw Apify response
 * @param {string} handle
 * @returns {ScrapeProfileOutput}
 */
function normalizeInstagram(raw, handle) {
  const posts = raw.latestPosts || raw.posts || [];

  const recentPosts = posts.slice(0, 12).map((/** @type {any} */ p) => ({
    id: p.id || p.shortCode || '',
    caption: p.caption || '',
    imageUrl: p.displayUrl || p.url || p.imageUrl || '',
    videoUrl: p.videoUrl || '',
    likeCount: p.likesCount || p.likes || 0,
    commentCount: p.commentsCount || p.comments || 0,
    shareCount: 0,
    viewCount: p.videoViewCount || 0,
    timestamp: p.timestamp || '',
    hashtags: extractHashtags(p.caption || ''),
    type: p.type === 'Video' ? 'video' : p.type === 'Sidecar' ? 'carousel' : 'image',
  }));

  return {
    success: true,
    platform: 'instagram',
    profile: {
      handle,
      displayName: raw.fullName || raw.name || handle,
      bio: raw.biography || raw.bio || '',
      followerCount: raw.followersCount || raw.followers || 0,
      followingCount: raw.followsCount || raw.following || 0,
      postCount: raw.postsCount || raw.mediaCount || 0,
      profilePicUrl: raw.profilePicUrlHD || raw.profilePicUrl || '',
      isVerified: raw.verified || raw.isVerified || false,
    },
    recentPosts,
    error: null,
  };
}

/**
 * Normalize TikTok API response to unified output.
 *
 * @param {Object} raw - Raw Apify response
 * @param {string} handle
 * @returns {ScrapeProfileOutput}
 */
function normalizeTikTok(raw, handle) {
  const authorMeta = raw.authorMeta || raw.author || {};
  const posts = raw.latestPosts || raw.items || [];

  const recentPosts = posts.slice(0, 12).map((/** @type {any} */ p) => ({
    id: p.id || '',
    caption: p.text || p.desc || '',
    imageUrl: p.videoMeta?.coverUrl || p.covers?.default || '',
    videoUrl: p.videoUrl || '',
    likeCount: p.diggCount || p.likes || 0,
    commentCount: p.commentCount || p.comments || 0,
    shareCount: p.shareCount || p.shares || 0,
    viewCount: p.playCount || p.views || 0,
    timestamp: p.createTime ? new Date(p.createTime * 1000).toISOString() : '',
    hashtags: (p.hashtags || []).map((/** @type {any} */ h) => `#${h.name || h}`),
    type: 'video',
  }));

  return {
    success: true,
    platform: 'tiktok',
    profile: {
      handle,
      displayName: authorMeta.name || authorMeta.nickname || handle,
      bio: authorMeta.signature || authorMeta.bio || '',
      followerCount: authorMeta.fans || authorMeta.followers || 0,
      followingCount: authorMeta.following || 0,
      postCount: authorMeta.video || authorMeta.videoCount || 0,
      profilePicUrl: authorMeta.avatar || authorMeta.avatarMedium || '',
      isVerified: authorMeta.verified || false,
    },
    recentPosts,
    error: null,
  };
}

/**
 * Normalize Facebook page response to unified output.
 *
 * @param {Object} raw - Raw Apify response
 * @param {string} pageId
 * @returns {ScrapeProfileOutput}
 */
function normalizeFacebook(raw, pageId) {
  const posts = raw.posts || [];

  const recentPosts = posts.slice(0, 12).map((/** @type {any} */ p) => ({
    id: p.postId || p.id || '',
    caption: p.text || p.message || '',
    imageUrl: p.photoUrl || p.imageUrl || '',
    videoUrl: p.videoUrl || '',
    likeCount: p.likes || p.reactions || 0,
    commentCount: p.comments || 0,
    shareCount: p.shares || 0,
    viewCount: 0,
    timestamp: p.time || p.timestamp || '',
    hashtags: extractHashtags(p.text || p.message || ''),
    type: p.videoUrl ? 'video' : p.photoUrl ? 'image' : 'text',
  }));

  return {
    success: true,
    platform: 'facebook',
    profile: {
      handle: raw.pageUrl || pageId,
      displayName: raw.title || raw.name || '',
      bio: raw.about || raw.description || '',
      followerCount: raw.likes || raw.followers || 0,
      followingCount: 0, // Facebook pages don't "follow"
      postCount: posts.length,
      profilePicUrl: raw.profilePhoto || raw.profilePicture || '',
      isVerified: raw.verified || false,
    },
    recentPosts,
    error: null,
  };
}

// ── Utilities ─────────────────────────────────────────────────────

/**
 * Extract hashtags from text.
 *
 * @param {string} text
 * @returns {string[]}
 */
function extractHashtags(text) {
  if (!text) return [];
  const matches = text.match(/#[\w\u00C0-\u024F]+/g) || [];
  return [...new Set(matches.map((t) => t.toLowerCase()))];
}

export default {
  scrapeProfile,
  scrapeInstagram,
  scrapeTikTok,
  scrapeFacebook,
  checkBudget,
  recordCost,
};
