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

  scrapeYouTube: {
    name: 'scrapeYouTube',
    description: 'Scrape a YouTube channel using Apify to get channel info, recent videos, and engagement metrics.',
    inputSchema: z.object({
      handle: z
        .string()
        .min(1)
        .describe('YouTube channel handle (e.g. "MrBeast") or @handle without the @ prefix'),
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

      const cleanHandle = handle.replace(/^@/, '');
      logger.info({ msg: 'Scraping YouTube channel', handle: cleanHandle, videoLimit });

      try {
        const run = await client.actor('apify/youtube-channel-scraper').call({
          channelUrls: [`https://www.youtube.com/@${cleanHandle}`],
          maxResults: videoLimit,
          maxResultsShorts: 0,
        });

        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        if (!items || items.length === 0) {
          return { success: false, error: `No data found for YouTube channel: ${cleanHandle}` };
        }

        // YouTube channel scraper returns videos; channel info is embedded in each item
        const firstItem = items[0];
        const channelInfo = firstItem.channelName || firstItem.channelTitle || cleanHandle;
        const channelId = firstItem.channelId || null;

        return {
          success: true,
          data: {
            platform: 'youtube',
            handle: cleanHandle,
            displayName: channelInfo,
            bio: firstItem.channelDescription || null,
            followers: firstItem.channelSubscribers || firstItem.subscriberCount || 0,
            following: null,
            videosCount: firstItem.channelVideoCount || items.length,
            isVerified: firstItem.channelVerified || false,
            profilePicUrl: firstItem.channelAvatar || firstItem.channelThumbnail || null,
            channelId,
            videos: items.slice(0, videoLimit).map((video) => ({
              id: video.id || video.videoId || String(Math.random()),
              title: video.title || '',
              description: video.text || video.description || '',
              likes: video.likes || video.likeCount || 0,
              comments: video.commentsCount || video.numberOfComments || 0,
              views: video.viewCount || video.views || 0,
              timestamp: video.date || video.uploadDate || null,
              thumbnailUrl: video.thumbnailUrl || video.thumbnail || null,
              duration: video.duration || null,
              hashtags: (video.text || video.description || '').match(/#\w+/g) || [],
            })),
          },
        };
      } catch (err) {
        logger.error({ msg: 'YouTube scrape failed', handle: cleanHandle, error: err.message });
        return { success: false, error: `YouTube scrape failed: ${err.message}` };
      }
    },
  },

  scrapeTwitter: {
    name: 'scrapeTwitter',
    description: 'Scrape an X (Twitter) profile using Apify to get profile info, recent tweets, and engagement metrics.',
    inputSchema: z.object({
      handle: z
        .string()
        .regex(/^[a-zA-Z0-9_]+$/, 'Invalid X/Twitter handle format')
        .describe('X/Twitter handle without the @ prefix'),
      tweetLimit: z
        .number()
        .int()
        .min(6)
        .max(50)
        .default(20)
        .describe('Number of recent tweets to scrape (6-50)'),
    }),

    /**
     * @param {{ handle: string, tweetLimit: number }} input
     * @returns {Promise<{ success: boolean, data?: Object, error?: string, stub?: boolean }>}
     * Cost estimate: ~$0.50-1.50 per run (Apify compute units)
     */
    async execute({ handle, tweetLimit = 20 }) {
      const client = await getApifyClient();
      if (!client) {
        return {
          success: false,
          error: 'Apify client not available. Install apify-client to enable scraping.',
          stub: true,
        };
      }

      const cleanHandle = handle.replace(/^@/, '');
      logger.info({ msg: 'Scraping X/Twitter profile', handle: cleanHandle, tweetLimit });

      try {
        const run = await client.actor('apify/twitter-scraper').call({
          handle: [cleanHandle],
          maxItems: tweetLimit,
          addUserInfo: true,
        });

        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        if (!items || items.length === 0) {
          return { success: false, error: `No data found for X/Twitter handle: ${cleanHandle}` };
        }

        // Twitter scraper returns tweets; user info is embedded in each item
        const userInfo = items[0]?.author || items[0]?.user || {};
        const tweetItems = items.filter((i) => i.text || i.full_text || i.tweetText);

        return {
          success: true,
          data: {
            platform: 'twitter',
            handle: cleanHandle,
            displayName: userInfo.name || userInfo.userName || cleanHandle,
            bio: userInfo.description || userInfo.bio || null,
            followers: userInfo.followers || userInfo.followersCount || 0,
            following: userInfo.following || userInfo.friendsCount || 0,
            tweetsCount: userInfo.statusesCount || tweetItems.length,
            isVerified: userInfo.isVerified || userInfo.isBlueVerified || false,
            profilePicUrl: userInfo.profileImageUrl || userInfo.profilePicUrl || null,
            tweets: tweetItems.slice(0, tweetLimit).map((tweet) => ({
              id: tweet.id || tweet.tweetId || String(Math.random()),
              text: tweet.text || tweet.full_text || tweet.tweetText || '',
              likes: tweet.likeCount || tweet.favoriteCount || 0,
              retweets: tweet.retweetCount || 0,
              replies: tweet.replyCount || 0,
              views: tweet.viewCount || tweet.impressionCount || 0,
              timestamp: tweet.createdAt || tweet.created_at || null,
              imageUrls: tweet.media?.photos?.map((p) => p.url) || tweet.images || [],
              hashtags: (tweet.text || tweet.full_text || '').match(/#\w+/g) || [],
            })),
          },
        };
      } catch (err) {
        logger.error({ msg: 'X/Twitter scrape failed', handle: cleanHandle, error: err.message });
        return { success: false, error: `X/Twitter scrape failed: ${err.message}` };
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

  extractFeedPalette: {
    name: 'extractFeedPalette',
    description: 'Extract a natural color palette from the top 9-12 post images. Analyzes dominant colors per image and synthesizes into a cohesive "natural palette" — the colors the creator gravitates toward.',
    inputSchema: z.object({
      imageUrls: z
        .array(z.string().url())
        .min(3)
        .max(12)
        .describe('URLs of top post images to extract palette from (3-12)'),
    }),

    /**
     * @param {{ imageUrls: string[] }} input
     * @returns {Promise<{ success: boolean, data?: Object, error?: string, stub?: boolean }>}
     */
    async execute({ imageUrls }) {
      const googleAI = await getGoogleAI();
      if (!googleAI) {
        return {
          success: false,
          error: 'Google AI SDK not available.',
          stub: true,
        };
      }

      logger.info({ msg: 'Extracting feed color palette', imageCount: imageUrls.length });

      try {
        const model = googleAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const imageParts = [];
        for (const url of imageUrls) {
          try {
            const response = await fetch(url);
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            const mimeType = response.headers.get('content-type') || 'image/jpeg';
            imageParts.push({ inlineData: { data: base64, mimeType } });
          } catch (err) {
            logger.warn({ msg: 'Failed to fetch image for palette', url, error: err.message });
          }
        }

        if (imageParts.length < 3) {
          return { success: false, error: 'Could not fetch enough images for palette extraction (minimum 3).' };
        }

        const palettePrompt = `Analyze these ${imageParts.length} social media images and extract the creator's natural color palette.

For each image, identify the 2-3 most dominant colors.
Then synthesize ALL colors across all images into:

1. DOMINANT COLORS: The 5-8 most recurring colors with their hex codes, friendly names, and percentage prominence
2. NATURAL PALETTE: A curated set of 5-6 hex codes that best represent this creator's visual identity, suitable for use as brand colors
3. COLOR TEMPERATURE: Overall warm/cool/neutral tendency
4. SATURATION LEVEL: Overall muted/vibrant/mixed tendency

Return ONLY a valid JSON object:
{
  "dominantColors": [
    { "hex": "#hex", "name": "Color Name", "percentage": 25 }
  ],
  "naturalPalette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "colorTemperature": "warm | cool | neutral",
  "saturationLevel": "muted | vibrant | mixed",
  "paletteDescription": "One-sentence description of the color story"
}`;

        const result = await model.generateContent([palettePrompt, ...imageParts]);
        const text = result.response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return { success: false, error: 'Failed to parse palette extraction response as JSON.' };
        }

        try {
          const palette = JSON.parse(jsonMatch[0]);
          return { success: true, data: palette };
        } catch {
          return { success: false, error: 'Failed to parse palette JSON.' };
        }
      } catch (err) {
        logger.error({ msg: 'Feed palette extraction failed', error: err.message });
        return { success: false, error: `Feed palette extraction failed: ${err.message}` };
      }
    },
  },

  detectNiche: {
    name: 'detectNiche',
    description: 'Analyze bio text, hashtags, post captions, and content themes to auto-detect the creator\'s niche. Classifies into primary + up to 2 secondary niches with confidence scores and estimated market size.',
    inputSchema: z.object({
      bio: z.string().nullable().describe('Creator bio text from their profile'),
      captions: z.array(z.string()).describe('Array of post/video captions'),
      hashtags: z.array(z.string()).describe('All hashtags used across posts'),
      themes: z.array(z.string()).optional().describe('Previously detected content themes'),
    }),

    /**
     * @param {{ bio: string | null, captions: string[], hashtags: string[], themes?: string[] }} input
     * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
     */
    async execute({ bio, captions, hashtags, themes }) {
      logger.info({ msg: 'Detecting niche', captionCount: captions.length, hashtagCount: hashtags.length });

      // Build a frequency map of hashtags
      const hashtagCounts = {};
      for (const tag of hashtags) {
        const normalized = tag.toLowerCase().replace(/^#/, '');
        hashtagCounts[normalized] = (hashtagCounts[normalized] || 0) + 1;
      }

      const sortedHashtags = Object.entries(hashtagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([tag, count]) => ({ tag, count }));

      // Niche category definitions with keyword sets
      const nicheCategories = {
        fitness: ['fitness', 'gym', 'workout', 'exercise', 'training', 'muscle', 'gains', 'bodybuilding', 'crossfit', 'strength', 'fitfam', 'fitlife'],
        wellness: ['wellness', 'mindfulness', 'meditation', 'selfcare', 'mentalhealth', 'healing', 'holistic', 'yoga', 'breathwork', 'journaling'],
        beauty: ['beauty', 'makeup', 'skincare', 'cosmetics', 'glam', 'beautytips', 'mua', 'lipstick', 'foundation', 'glow'],
        fashion: ['fashion', 'style', 'ootd', 'outfit', 'streetstyle', 'fashionista', 'trend', 'wardrobe', 'clothing'],
        cooking: ['cooking', 'recipe', 'foodie', 'chef', 'baking', 'mealprep', 'homemade', 'kitchen', 'food', 'nutrition'],
        tech: ['tech', 'technology', 'gadgets', 'coding', 'programming', 'software', 'ai', 'startup', 'developer', 'engineering'],
        finance: ['finance', 'investing', 'money', 'wealth', 'crypto', 'stocks', 'budget', 'financialfreedom', 'entrepreneur', 'business'],
        travel: ['travel', 'wanderlust', 'explore', 'adventure', 'destination', 'backpacking', 'tourism', 'travelgram'],
        parenting: ['parenting', 'mom', 'dad', 'momlife', 'dadlife', 'family', 'kids', 'motherhood', 'baby', 'toddler'],
        gaming: ['gaming', 'gamer', 'twitch', 'esports', 'gameplay', 'videogames', 'streamer', 'xbox', 'playstation', 'pc'],
        music: ['music', 'musician', 'singer', 'producer', 'beats', 'songwriter', 'hiphop', 'rap', 'pop', 'indie'],
        art: ['art', 'artist', 'painting', 'drawing', 'illustration', 'creative', 'digitalart', 'design', 'sketch'],
        education: ['education', 'learning', 'teacher', 'study', 'students', 'knowledge', 'tutor', 'school', 'course'],
        lifestyle: ['lifestyle', 'dailylife', 'vlog', 'dayinmylife', 'life', 'motivation', 'inspiration', 'goals'],
        pets: ['pets', 'dog', 'cat', 'puppy', 'kitten', 'dogsofinstagram', 'catsofinstagram', 'animals', 'petlover'],
        sports: ['sports', 'athlete', 'football', 'basketball', 'soccer', 'running', 'marathon', 'tennis', 'baseball'],
        photography: ['photography', 'photographer', 'photo', 'camera', 'portrait', 'landscape', 'photooftheday', 'lens'],
        supplements: ['supplements', 'protein', 'preworkout', 'vitamins', 'whey', 'creatine', 'bcaa', 'collagen', 'superfood'],
      };

      // Score each niche based on hashtag matches, bio text, and caption keywords
      const nicheScores = {};
      const allText = [bio || '', ...captions, ...(themes || [])].join(' ').toLowerCase();
      const allHashtagText = hashtags.map((h) => h.toLowerCase().replace(/^#/, '')).join(' ');

      for (const [niche, keywords] of Object.entries(nicheCategories)) {
        let score = 0;

        for (const keyword of keywords) {
          // Check hashtags (strongest signal)
          const hashtagMatch = sortedHashtags.find((h) => h.tag.includes(keyword));
          if (hashtagMatch) {
            score += hashtagMatch.count * 3;
          }

          // Check bio (strong signal)
          if ((bio || '').toLowerCase().includes(keyword)) {
            score += 5;
          }

          // Check captions (moderate signal)
          const captionMatches = allText.split(keyword).length - 1;
          score += captionMatches;

          // Check raw hashtag text
          if (allHashtagText.includes(keyword)) {
            score += 2;
          }
        }

        if (score > 0) {
          nicheScores[niche] = score;
        }
      }

      // Sort by score and pick top 3
      const ranked = Object.entries(nicheScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      if (ranked.length === 0) {
        return {
          success: true,
          data: {
            primaryNiche: {
              name: 'lifestyle',
              confidence: 0.3,
              marketSize: 'large',
              hashtagVolume: null,
              relatedKeywords: [],
            },
            secondaryNiches: [],
            nicheClarity: 10,
          },
        };
      }

      const maxScore = ranked[0][1];
      const marketSizeMap = {
        fitness: 'massive', wellness: 'large', beauty: 'massive', fashion: 'massive',
        cooking: 'large', tech: 'large', finance: 'large', travel: 'large',
        parenting: 'large', gaming: 'massive', music: 'massive', art: 'medium',
        education: 'large', lifestyle: 'massive', pets: 'medium', sports: 'massive',
        photography: 'medium', supplements: 'large',
      };

      const primary = ranked[0];
      const secondaries = ranked.slice(1);

      // Niche clarity: how dominant is the primary vs secondary
      const totalScore = ranked.reduce((sum, [, s]) => sum + s, 0);
      const nicheClarity = Math.round((primary[1] / totalScore) * 100);

      return {
        success: true,
        data: {
          primaryNiche: {
            name: primary[0],
            confidence: Math.min(primary[1] / maxScore, 1),
            marketSize: marketSizeMap[primary[0]] || 'medium',
            hashtagVolume: sortedHashtags
              .filter((h) => nicheCategories[primary[0]]?.some((kw) => h.tag.includes(kw)))
              .reduce((sum, h) => sum + h.count, 0) || null,
            relatedKeywords: nicheCategories[primary[0]]?.slice(0, 5) || [],
          },
          secondaryNiches: secondaries.map(([name, score]) => ({
            name,
            confidence: Math.min(score / maxScore, 0.99),
            marketSize: marketSizeMap[name] || 'medium',
            hashtagVolume: sortedHashtags
              .filter((h) => nicheCategories[name]?.some((kw) => h.tag.includes(kw)))
              .reduce((sum, h) => sum + h.count, 0) || null,
            relatedKeywords: nicheCategories[name]?.slice(0, 5) || [],
          })),
          nicheClarity,
        },
      };
    },
  },

  calculateReadiness: {
    name: 'calculateReadiness',
    description: 'Calculate a Brand Readiness Score (0-100) based on follower count, engagement rate, content consistency, niche clarity, visual consistency, and audience loyalty signals.',
    inputSchema: z.object({
      followerCount: z.number().describe('Total followers across platforms'),
      engagementRate: z.number().nullable().describe('Average engagement rate (0-1)'),
      postingFrequency: z.string().nullable().describe('Description of posting frequency'),
      consistencyScore: z.number().nullable().describe('Content consistency score (0-100)'),
      nicheClarity: z.number().describe('Niche clarity score (0-100)'),
      aestheticCohesion: z.number().nullable().describe('Visual consistency score (0-100)'),
      audienceLoyalty: z.number().nullable().describe('Audience loyalty/engagement depth score (0-100)'),
    }),

    /**
     * @param {Object} input
     * @returns {{ success: boolean, data: Object }}
     */
    execute({
      followerCount,
      engagementRate,
      postingFrequency,
      consistencyScore,
      nicheClarity,
      aestheticCohesion,
      audienceLoyalty,
    }) {
      logger.info({ msg: 'Calculating Brand Readiness Score', followerCount });

      // Factor: Follower Count (20% weight)
      let followerScore;
      if (followerCount >= 100_000) followerScore = 100;
      else if (followerCount >= 50_000) followerScore = 90;
      else if (followerCount >= 25_000) followerScore = 80;
      else if (followerCount >= 10_000) followerScore = 70;
      else if (followerCount >= 5_000) followerScore = 55;
      else if (followerCount >= 1_000) followerScore = 40;
      else if (followerCount >= 500) followerScore = 25;
      else followerScore = 10;

      // Factor: Engagement Rate (25% weight)
      let engagementScore;
      const er = engagementRate ?? 0;
      if (er >= 0.06) engagementScore = 100;
      else if (er >= 0.04) engagementScore = 85;
      else if (er >= 0.03) engagementScore = 70;
      else if (er >= 0.02) engagementScore = 55;
      else if (er >= 0.01) engagementScore = 35;
      else engagementScore = 15;

      // Factor: Content Consistency/Frequency (15% weight)
      let contentScore = consistencyScore ?? 50;
      if (postingFrequency) {
        const freqLower = postingFrequency.toLowerCase();
        if (freqLower.includes('daily') || freqLower.includes('7')) contentScore = Math.max(contentScore, 90);
        else if (freqLower.includes('5') || freqLower.includes('6')) contentScore = Math.max(contentScore, 80);
        else if (freqLower.includes('3') || freqLower.includes('4')) contentScore = Math.max(contentScore, 65);
        else if (freqLower.includes('2') || freqLower.includes('week')) contentScore = Math.max(contentScore, 50);
        else if (freqLower.includes('1') || freqLower.includes('sporadic')) contentScore = Math.max(contentScore, 30);
      }

      // Factor: Niche Clarity (15% weight)
      const nicheScore = Math.min(nicheClarity, 100);

      // Factor: Visual Consistency (10% weight)
      const visualScore = aestheticCohesion ?? 50;

      // Factor: Audience Loyalty (15% weight)
      const loyaltyScore = audienceLoyalty ?? 50;

      const factors = [
        { name: 'Follower Count', score: followerScore, weight: 0.20, weightedScore: followerScore * 0.20, tip: followerScore < 70 ? 'Grow your following by posting consistently and engaging with similar creators.' : 'Great audience size for launching a brand.' },
        { name: 'Engagement Rate', score: engagementScore, weight: 0.25, weightedScore: engagementScore * 0.25, tip: engagementScore < 70 ? 'Boost engagement by asking questions, running polls, and responding to every comment.' : 'Your audience is highly engaged -- perfect for conversions.' },
        { name: 'Content Consistency', score: contentScore, weight: 0.15, weightedScore: contentScore * 0.15, tip: contentScore < 70 ? 'Post more regularly. Aim for 3-5 times per week across platforms.' : 'Excellent posting consistency.' },
        { name: 'Niche Clarity', score: nicheScore, weight: 0.15, weightedScore: nicheScore * 0.15, tip: nicheScore < 70 ? 'Focus your content around 1-2 core topics to build niche authority.' : 'Clear niche positioning helps brand relevance.' },
        { name: 'Visual Consistency', score: visualScore, weight: 0.10, weightedScore: visualScore * 0.10, tip: visualScore < 70 ? 'Use consistent color schemes, filters, and composition in your posts.' : 'Strong visual identity already in place.' },
        { name: 'Audience Loyalty', score: loyaltyScore, weight: 0.15, weightedScore: loyaltyScore * 0.15, tip: loyaltyScore < 70 ? 'Build deeper connections through stories, DMs, and community engagement.' : 'Loyal, engaged fanbase ready to support your brand.' },
      ];

      const totalScore = Math.round(factors.reduce((sum, f) => sum + f.weightedScore, 0));

      let tier;
      if (totalScore >= 80) tier = 'prime';
      else if (totalScore >= 60) tier = 'ready';
      else if (totalScore >= 40) tier = 'emerging';
      else tier = 'not-ready';

      const tierSummaries = {
        'prime': 'You are in the prime position to launch a brand. Your audience, engagement, and content are all aligned.',
        'ready': 'You are brand-ready. A few optimizations could maximize your launch success.',
        'emerging': 'You are an emerging creator with strong potential. Focus on the areas below to accelerate your brand launch.',
        'not-ready': 'Building your brand foundation. Focus on growing your audience and content consistency before launching.',
      };

      const actionItems = factors
        .filter((f) => f.score < 70)
        .sort((a, b) => b.weight - a.weight)
        .map((f) => f.tip);

      return {
        success: true,
        data: {
          totalScore,
          factors,
          tier,
          summary: tierSummaries[tier],
          actionItems,
        },
      };
    },
  },
};
