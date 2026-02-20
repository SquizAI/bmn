// server/src/skills/social-analyzer/tools.js

import { z } from 'zod';
import { config } from '../../config/index.js';
import { logger } from '../../lib/logger.js';

// ── Lazy-load external SDKs (wrap in try/catch for environments where not installed) ──

/** @returns {Promise<import('apify-client').ApifyClient | null>} */
async function getApifyClient() {
  try {
    const { ApifyClient } = await import('apify-client');
    return new ApifyClient({ token: config.APIFY_API_TOKEN });
  } catch {
    logger.warn({ msg: 'apify-client not installed -- scraping tools will return stubs' });
    return null;
  }
}

/** @returns {Promise<import('@google/generative-ai').GoogleGenerativeAI | null>} */
async function getGoogleAI() {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    return new GoogleGenerativeAI(config.GOOGLE_API_KEY);
  } catch {
    logger.warn({ msg: '@google/generative-ai not installed -- analyzeAesthetic tool will return stubs' });
    return null;
  }
}

// ── Tool Definitions ────────────────────────────────────────────────

export const tools = {
  scrapeInstagram: {
    name: 'scrapeInstagram',
    description: 'Scrape an Instagram profile using Apify to get profile info, recent posts, and image URLs.',
    inputSchema: z.object({
      handle: z
        .string()
        .regex(/^[a-zA-Z0-9._]+$/, 'Invalid Instagram handle format')
        .describe('Instagram handle without the @ prefix'),
      postLimit: z
        .number()
        .int()
        .min(6)
        .max(50)
        .default(20)
        .describe('Number of recent posts to scrape (6-50)'),
    }),

    /**
     * @param {{ handle: string, postLimit: number }} input
     * @returns {Promise<{ success: boolean, data?: Object, error?: string, stub?: boolean }>}
     * Cost estimate: ~$0.50-1.00 per run (Apify compute units)
     */
    async execute({ handle, postLimit = 20 }) {
      const client = await getApifyClient();
      if (!client) {
        return {
          success: false,
          error: 'Apify client not available. Install apify-client to enable scraping.',
          stub: true,
        };
      }

      logger.info({ msg: 'Scraping Instagram profile', handle, postLimit });

      try {
        const run = await client.actor('apify/instagram-profile-scraper').call({
          usernames: [handle],
          resultsLimit: postLimit,
        });

        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        if (!items || items.length === 0) {
          return { success: false, error: `No data found for Instagram handle: ${handle}` };
        }

        const profile = items[0];
        return {
          success: true,
          data: {
            platform: 'instagram',
            handle,
            displayName: profile.fullName || handle,
            bio: profile.biography || null,
            followers: profile.followersCount || 0,
            following: profile.followsCount || 0,
            postsCount: profile.postsCount || 0,
            isVerified: profile.verified || false,
            profilePicUrl: profile.profilePicUrl || null,
            posts: (profile.latestPosts || []).slice(0, postLimit).map((post) => ({
              id: post.id,
              type: post.type,
              caption: post.caption || '',
              likes: post.likesCount || 0,
              comments: post.commentsCount || 0,
              timestamp: post.timestamp,
              imageUrl: post.displayUrl || null,
              videoUrl: post.videoUrl || null,
              hashtags: post.hashtags || [],
            })),
          },
        };
      } catch (err) {
        logger.error({ msg: 'Instagram scrape failed', handle, error: err.message });
        return { success: false, error: `Instagram scrape failed: ${err.message}` };
      }
    },
  },

  scrapeTikTok: {
    name: 'scrapeTikTok',
    description: 'Scrape a TikTok profile using Apify to get profile info and recent videos.',
    inputSchema: z.object({
      handle: z
        .string()
        .min(1)
        .describe('TikTok handle without the @ prefix'),
      videoLimit: z
        .number()
        .int()
        .min(6)
        .max(30)
        .default(15)
        .describe('Number of recent videos to scrape (6-30)'),
    }),

    /**
     * @param {{ handle: string, videoLimit: number }} input
     * @returns {Promise<{ success: boolean, data?: Object, error?: string, stub?: boolean }>}
     * Cost estimate: ~$0.50-1.00 per run (Apify compute units)
     */
    async execute({ handle, videoLimit = 15 }) {
      const client = await getApifyClient();
      if (!client) {
        return {
          success: false,
          error: 'Apify client not available. Install apify-client to enable scraping.',
          stub: true,
        };
      }

      logger.info({ msg: 'Scraping TikTok profile', handle, videoLimit });

      try {
        const run = await client.actor('clockworks/tiktok-profile-scraper').call({
          profiles: [handle],
          resultsPerPage: videoLimit,
        });

        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        if (!items || items.length === 0) {
          return { success: false, error: `No data found for TikTok handle: ${handle}` };
        }

        const profile = items[0];
        return {
          success: true,
          data: {
            platform: 'tiktok',
            handle,
            displayName: profile.nickname || handle,
            bio: profile.signature || null,
            followers: profile.fans || 0,
            following: profile.following || 0,
            likes: profile.heart || 0,
            videosCount: profile.video || 0,
            isVerified: profile.verified || false,
            profilePicUrl: profile.avatarLarger || null,
            videos: (profile.videos || items.slice(1)).slice(0, videoLimit).map((video) => ({
              id: video.id,
              description: video.text || '',
              likes: video.diggCount || 0,
              comments: video.commentCount || 0,
              shares: video.shareCount || 0,
              views: video.playCount || 0,
              timestamp: video.createTime,
              thumbnailUrl: video.cover || null,
              hashtags: video.hashtags?.map((h) => h.name) || [],
            })),
          },
        };
      } catch (err) {
        logger.error({ msg: 'TikTok scrape failed', handle, error: err.message });
        return { success: false, error: `TikTok scrape failed: ${err.message}` };
      }
    },
  },

  /**
   * scrapeFacebook
   *
   * Scrape a Facebook page using Apify's Facebook Pages Scraper actor.
   * Follows the same pattern as scrapeInstagram and scrapeTikTok.
   *
   * Cost estimate: ~$0.50-1.00 per run (Apify compute units)
   */
  scrapeFacebook: {
    name: 'scrapeFacebook',
    description: 'Scrape a Facebook page using Apify to get page info, recent posts, images, reactions, and shares.',
    inputSchema: z.object({
      handle: z
        .string()
        .min(1)
        .describe('Facebook page name, URL slug, or full page URL'),
      postLimit: z
        .number()
        .int()
        .min(6)
        .max(50)
        .default(20)
        .describe('Number of recent posts to scrape (6-50)'),
    }),

    /**
     * @param {{ handle: string, postLimit: number }} input
     * @returns {Promise<{ success: boolean, data?: Object, error?: string, stub?: boolean }>}
     */
    async execute({ handle, postLimit = 20 }) {
      const client = await getApifyClient();
      if (!client) {
        return {
          success: false,
          error: 'Apify client not available. Install apify-client to enable scraping.',
          stub: true,
        };
      }

      // Clean the handle: strip @ prefix and full URLs
      const cleanHandle = handle
        .replace(/^@/, '')
        .replace(/https?:\/\/(www\.)?facebook\.com\//, '')
        .replace(/\/$/, '');

      logger.info({ msg: 'Scraping Facebook page', handle: cleanHandle, postLimit });

      try {
        const run = await client.actor('apify/facebook-pages-scraper').call({
          startUrls: [{ url: `https://www.facebook.com/${cleanHandle}` }],
          maxPosts: postLimit,
          maxPostComments: 0,
          maxReviews: 0,
        });

        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        if (!items || items.length === 0) {
          return { success: false, error: `No data found for Facebook page: ${cleanHandle}` };
        }

        // Facebook Pages Scraper returns the page info as the first item
        // and posts as subsequent items, or all mixed together
        const pageItem = items.find((i) => i.pageUrl || i.title || i.categories);
        const postItems = items.filter((i) => i.postText || i.postUrl || i.text);

        // Extract page-level information
        const pageInfo = pageItem || items[0];

        return {
          success: true,
          data: {
            platform: 'facebook',
            handle: cleanHandle,
            displayName: pageInfo.title || pageInfo.name || cleanHandle,
            bio: pageInfo.about || pageInfo.description || null,
            followers: pageInfo.likes || pageInfo.followersCount || 0,
            following: null, // Facebook pages don't show following count
            postsCount: postItems.length,
            isVerified: pageInfo.isVerified || pageInfo.verified || false,
            profilePicUrl: pageInfo.profilePicture || pageInfo.profilePic || null,
            categories: pageInfo.categories || [],
            website: pageInfo.website || null,
            posts: postItems.slice(0, postLimit).map((post) => ({
              id: post.postId || post.id || post.postUrl || String(Math.random()),
              type: post.type || (post.videoUrl ? 'video' : 'image'),
              caption: post.postText || post.text || '',
              likes: post.likesCount || post.reactions || 0,
              comments: post.commentsCount || post.comments || 0,
              shares: post.sharesCount || post.shares || 0,
              timestamp: post.time || post.timestamp || post.date || null,
              imageUrl: post.imageUrl || post.fullPicture || post.image || null,
              videoUrl: post.videoUrl || null,
              hashtags: (post.postText || post.text || '').match(/#\w+/g) || [],
            })),
          },
        };
      } catch (err) {
        logger.error({ msg: 'Facebook scrape failed', handle: cleanHandle, error: err.message });
        return { success: false, error: `Facebook scrape failed: ${err.message}` };
      }
    },
  },

  analyzeAesthetic: {
    name: 'analyzeAesthetic',
    description: 'Analyze a set of social media images using Gemini 3.0 Flash to extract visual aesthetic patterns, colors, mood, and style.',
    inputSchema: z.object({
      imageUrls: z
        .array(z.string().url())
        .min(3)
        .max(20)
        .describe('URLs of post images to analyze (3-20)'),
    }),

    /**
     * @param {{ imageUrls: string[] }} input
     * @returns {Promise<{ success: boolean, data?: Object, error?: string, stub?: boolean }>}
     * Cost estimate: ~$0.001-0.005 per call (Gemini Flash, image analysis)
     */
    async execute({ imageUrls }) {
      const googleAI = await getGoogleAI();
      if (!googleAI) {
        return {
          success: false,
          error: 'Google AI SDK not available. Install @google/generative-ai to enable aesthetic analysis.',
          stub: true,
        };
      }

      logger.info({ msg: 'Analyzing image aesthetics', imageCount: imageUrls.length });

      try {
        const model = googleAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        // Fetch images and convert to base64 for Gemini
        const imageParts = [];
        for (const url of imageUrls) {
          try {
            const response = await fetch(url);
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            const mimeType = response.headers.get('content-type') || 'image/jpeg';
            imageParts.push({
              inlineData: { data: base64, mimeType },
            });
          } catch (err) {
            logger.warn({ msg: 'Failed to fetch image for analysis', url, error: err.message });
          }
        }

        if (imageParts.length < 3) {
          return { success: false, error: 'Could not fetch enough images for analysis (minimum 3 required).' };
        }

        const analysisPrompt = `Analyze these ${imageParts.length} social media images as a cohesive set. Extract:

1. DOMINANT COLORS: The 3-6 most prominent hex color codes across all images
2. VISUAL MOOD: Overall emotional feel (e.g., "warm and inviting", "bold and energetic", "minimal and clean")
3. PHOTOGRAPHY STYLE: Describe the style (e.g., "lifestyle flat-lay", "portrait-heavy", "product-focused", "candid street")
4. COMPOSITION PATTERNS: Recurring layout patterns (e.g., "centered subject", "rule of thirds", "text overlay", "grid aesthetic")
5. LIGHTING: Describe lighting tendencies (e.g., "natural warm light", "studio lit", "high contrast", "moody shadows")
6. FILTER/EDITING STYLE: Any consistent editing patterns (e.g., "desaturated vintage", "high saturation", "no filter natural")

Return ONLY a valid JSON object with this exact shape:
{
  "dominantColors": ["#hex1", "#hex2", "#hex3"],
  "visualMood": "string",
  "photographyStyle": "string",
  "compositionPatterns": ["pattern1", "pattern2"],
  "lighting": "string",
  "editingStyle": "string"
}`;

        const result = await model.generateContent([analysisPrompt, ...imageParts]);
        const text = result.response.text();

        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return { success: false, error: 'Failed to parse aesthetic analysis response as JSON.' };
        }

        try {
          const analysis = JSON.parse(jsonMatch[0]);
          return { success: true, data: analysis };
        } catch {
          return { success: false, error: 'Failed to parse aesthetic analysis JSON.' };
        }
      } catch (err) {
        logger.error({ msg: 'Aesthetic analysis failed', error: err.message });
        return { success: false, error: `Aesthetic analysis failed: ${err.message}` };
      }
    },
  },
};
