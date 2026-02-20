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
  youtube: 'apify/youtube-channel-scraper',
  twitter: 'apify/twitter-scraper',
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
 * @property {'instagram'|'tiktok'|'facebook'|'youtube'|'twitter'} platform
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

/**
 * Scrape a YouTube channel.
 *
 * @param {string} handle - YouTube channel handle (without @)
 * @param {number} [videoLimit=12] - Number of recent videos to scrape
 * @returns {Promise<ScrapeProfileOutput>}
 */
export async function scrapeYouTube(handle, videoLimit = 12) {
  const cleanHandle = handle.replace(/^@/, '').trim();
  logger.info({ handle: cleanHandle, videoLimit }, 'Scraping YouTube channel');

  if (!(await checkBudget(0.05))) {
    return {
      success: false,
      platform: 'youtube',
      profile: emptyProfile(cleanHandle),
      recentPosts: [],
      error: 'Apify monthly budget exceeded.',
    };
  }

  try {
    return await withRetry(async () => {
      const client = await getClient();

      const run = await client.actor(ACTORS.youtube).call(
        {
          channelUrls: [`https://www.youtube.com/@${cleanHandle}`],
          maxResults: videoLimit,
          maxResultsShorts: 0,
        },
        {
          timeout: 180,
          memory: 512,
        }
      );

      const { items } = await client.dataset(run.defaultDatasetId).listItems();

      if (!items || items.length === 0) {
        throw new Error(`No data returned for YouTube @${cleanHandle}. Channel may not exist.`);
      }

      const actualCost = run.stats?.costUsd || 0.04;
      await recordCost(actualCost);

      return normalizeYouTube(items, cleanHandle);
    }, `youtube:${cleanHandle}`);
  } catch (err) {
    logger.error({ handle: cleanHandle, error: err.message }, 'YouTube scrape failed after retries');
    return {
      success: false,
      platform: 'youtube',
      profile: emptyProfile(cleanHandle),
      recentPosts: [],
      error: err.message,
    };
  }
}

/**
 * Scrape an X/Twitter profile.
 *
 * @param {string} handle - Twitter/X handle (without @)
 * @param {number} [tweetLimit=12] - Number of recent tweets to scrape
 * @returns {Promise<ScrapeProfileOutput>}
 */
export async function scrapeTwitter(handle, tweetLimit = 12) {
  const cleanHandle = handle.replace(/^@/, '').trim();
  logger.info({ handle: cleanHandle, tweetLimit }, 'Scraping X/Twitter profile');

  if (!(await checkBudget(0.05))) {
    return {
      success: false,
      platform: 'twitter',
      profile: emptyProfile(cleanHandle),
      recentPosts: [],
      error: 'Apify monthly budget exceeded.',
    };
  }

  try {
    return await withRetry(async () => {
      const client = await getClient();

      const run = await client.actor(ACTORS.twitter).call(
        {
          handle: [cleanHandle],
          maxItems: tweetLimit,
          addUserInfo: true,
        },
        {
          timeout: 120,
          memory: 256,
        }
      );

      const { items } = await client.dataset(run.defaultDatasetId).listItems();

      if (!items || items.length === 0) {
        throw new Error(`No data returned for X/Twitter @${cleanHandle}. Profile may be private or not exist.`);
      }

      const actualCost = run.stats?.costUsd || 0.03;
      await recordCost(actualCost);

      return normalizeTwitter(items, cleanHandle);
    }, `twitter:${cleanHandle}`);
  } catch (err) {
    logger.error({ handle: cleanHandle, error: err.message }, 'X/Twitter scrape failed after retries');
    return {
      success: false,
      platform: 'twitter',
      profile: emptyProfile(cleanHandle),
      recentPosts: [],
      error: err.message,
    };
  }
}

// ── Router ────────────────────────────────────────────────────────

/**
 * Route to the correct scraper based on platform.
 *
 * @param {'instagram'|'tiktok'|'facebook'|'youtube'|'twitter'} platform
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
    case 'youtube':
      return scrapeYouTube(handle, postLimit);
    case 'twitter':
      return scrapeTwitter(handle, postLimit);
    default:
      return {
        success: false,
        platform,
        profile: emptyProfile(handle),
        recentPosts: [],
        error: `Unsupported platform: ${platform}. Supported: instagram, tiktok, facebook, youtube, twitter.`,
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

/**
 * Normalize YouTube API response to unified output.
 * YouTube channel scraper returns an array of video items with embedded channel info.
 *
 * @param {Object[]} items - Raw Apify response items (videos)
 * @param {string} handle
 * @returns {ScrapeProfileOutput}
 */
function normalizeYouTube(items, handle) {
  const firstItem = items[0] || {};

  const recentPosts = items.slice(0, 12).map((/** @type {any} */ v) => ({
    id: v.id || v.videoId || '',
    caption: v.title || '',
    imageUrl: v.thumbnailUrl || v.thumbnail || '',
    videoUrl: v.url || (v.id ? `https://www.youtube.com/watch?v=${v.id}` : ''),
    likeCount: v.likes || v.likeCount || 0,
    commentCount: v.commentsCount || v.numberOfComments || 0,
    shareCount: 0,
    viewCount: v.viewCount || v.views || 0,
    timestamp: v.date || v.uploadDate || '',
    hashtags: extractHashtags(v.text || v.description || ''),
    type: 'video',
  }));

  return {
    success: true,
    platform: 'youtube',
    profile: {
      handle,
      displayName: firstItem.channelName || firstItem.channelTitle || handle,
      bio: firstItem.channelDescription || '',
      followerCount: firstItem.channelSubscribers || firstItem.subscriberCount || 0,
      followingCount: 0, // YouTube channels don't "follow"
      postCount: firstItem.channelVideoCount || items.length,
      profilePicUrl: firstItem.channelAvatar || firstItem.channelThumbnail || '',
      isVerified: firstItem.channelVerified || false,
    },
    recentPosts,
    error: null,
  };
}

/**
 * Normalize X/Twitter API response to unified output.
 * Twitter scraper returns an array of tweet items with embedded user info.
 *
 * @param {Object[]} items - Raw Apify response items (tweets)
 * @param {string} handle
 * @returns {ScrapeProfileOutput}
 */
function normalizeTwitter(items, handle) {
  const userInfo = items[0]?.author || items[0]?.user || {};
  const tweetItems = items.filter((/** @type {any} */ i) => i.text || i.full_text || i.tweetText);

  const recentPosts = tweetItems.slice(0, 12).map((/** @type {any} */ t) => ({
    id: t.id || t.tweetId || '',
    caption: t.text || t.full_text || t.tweetText || '',
    imageUrl: t.media?.photos?.[0]?.url || '',
    videoUrl: '',
    likeCount: t.likeCount || t.favoriteCount || 0,
    commentCount: t.replyCount || 0,
    shareCount: t.retweetCount || 0,
    viewCount: t.viewCount || t.impressionCount || 0,
    timestamp: t.createdAt || t.created_at || '',
    hashtags: extractHashtags(t.text || t.full_text || ''),
    type: t.media?.photos?.length ? 'image' : 'text',
  }));

  return {
    success: true,
    platform: 'twitter',
    profile: {
      handle,
      displayName: userInfo.name || userInfo.userName || handle,
      bio: userInfo.description || userInfo.bio || '',
      followerCount: userInfo.followers || userInfo.followersCount || 0,
      followingCount: userInfo.following || userInfo.friendsCount || 0,
      postCount: userInfo.statusesCount || tweetItems.length,
      profilePicUrl: userInfo.profileImageUrl || userInfo.profilePicUrl || '',
      isVerified: userInfo.isVerified || userInfo.isBlueVerified || false,
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
  scrapeYouTube,
  scrapeTwitter,
  checkBudget,
  recordCost,
};
