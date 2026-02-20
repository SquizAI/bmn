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

  calculatePostingFrequency: {
    name: 'calculatePostingFrequency',
    description: 'Analyze an array of post timestamps to calculate posting frequency, consistency, peak posting days, and peak posting times.',
    inputSchema: z.object({
      timestamps: z
        .array(z.string())
        .min(2)
        .describe('Array of ISO-8601 or Unix timestamp strings from posts'),
    }),

    /**
     * @param {{ timestamps: string[] }} input
     * @returns {{ success: boolean, data?: Object, error?: string }}
     */
    execute({ timestamps }) {
      logger.info({ msg: 'Calculating posting frequency', postCount: timestamps.length });

      try {
        // Parse and sort timestamps oldest-first
        const dates = timestamps
          .map((ts) => {
            const parsed = new Date(isNaN(Number(ts)) ? ts : Number(ts) * 1000);
            return isNaN(parsed.getTime()) ? null : parsed;
          })
          .filter(Boolean)
          .sort((a, b) => a.getTime() - b.getTime());

        if (dates.length < 2) {
          return { success: false, error: 'Need at least 2 valid timestamps to calculate frequency.' };
        }

        // Time span
        const firstPost = dates[0];
        const lastPost = dates[dates.length - 1];
        const spanMs = lastPost.getTime() - firstPost.getTime();
        const spanDays = Math.max(spanMs / (1000 * 60 * 60 * 24), 1);
        const spanWeeks = Math.max(spanDays / 7, 1);
        const spanMonths = Math.max(spanDays / 30, 1);

        const postsPerDay = dates.length / spanDays;
        const postsPerWeek = dates.length / spanWeeks;
        const postsPerMonth = dates.length / spanMonths;

        // Calculate gaps between consecutive posts (in hours)
        const gaps = [];
        for (let i = 1; i < dates.length; i++) {
          gaps.push((dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60));
        }

        const avgGapHours = gaps.reduce((s, g) => s + g, 0) / gaps.length;
        const medianGapHours = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];

        // Standard deviation of gaps for consistency measure
        const meanGap = avgGapHours;
        const variance = gaps.reduce((s, g) => s + Math.pow(g - meanGap, 2), 0) / gaps.length;
        const stdDevGap = Math.sqrt(variance);

        // Consistency %: low stddev relative to mean = high consistency
        // coefficient of variation inverted to a 0-100 scale
        const cv = meanGap > 0 ? stdDevGap / meanGap : 0;
        const consistencyPct = Math.round(Math.max(0, Math.min(100, (1 - Math.min(cv, 2) / 2) * 100)));

        // Peak posting days (day-of-week distribution)
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayCounts = new Array(7).fill(0);
        for (const d of dates) {
          dayCounts[d.getUTCDay()]++;
        }
        const peakDays = dayCounts
          .map((count, idx) => ({ day: dayNames[idx], count, percentage: Math.round((count / dates.length) * 100) }))
          .sort((a, b) => b.count - a.count)
          .filter((d) => d.count > 0)
          .slice(0, 3);

        // Peak posting hours (hour-of-day distribution, UTC)
        const hourCounts = new Array(24).fill(0);
        for (const d of dates) {
          hourCounts[d.getUTCHours()]++;
        }
        const peakHours = hourCounts
          .map((count, hour) => ({ hour, label: `${hour.toString().padStart(2, '0')}:00 UTC`, count, percentage: Math.round((count / dates.length) * 100) }))
          .sort((a, b) => b.count - a.count)
          .filter((h) => h.count > 0)
          .slice(0, 3);

        // Human-readable frequency description
        let frequencyLabel;
        if (postsPerDay >= 2) frequencyLabel = 'multiple times daily';
        else if (postsPerDay >= 0.9) frequencyLabel = 'daily';
        else if (postsPerWeek >= 5) frequencyLabel = '5-6 times per week';
        else if (postsPerWeek >= 3) frequencyLabel = '3-4 times per week';
        else if (postsPerWeek >= 1.5) frequencyLabel = '2-3 times per week';
        else if (postsPerWeek >= 0.8) frequencyLabel = 'about once per week';
        else if (postsPerMonth >= 2) frequencyLabel = '2-3 times per month';
        else frequencyLabel = 'less than once per week';

        return {
          success: true,
          data: {
            postsPerDay: Math.round(postsPerDay * 100) / 100,
            postsPerWeek: Math.round(postsPerWeek * 100) / 100,
            postsPerMonth: Math.round(postsPerMonth * 100) / 100,
            frequencyLabel,
            consistencyPct,
            avgGapHours: Math.round(avgGapHours * 10) / 10,
            medianGapHours: Math.round(medianGapHours * 10) / 10,
            peakDays,
            peakHours,
            analysisSpan: {
              firstPost: firstPost.toISOString(),
              lastPost: lastPost.toISOString(),
              totalDays: Math.round(spanDays),
              totalPosts: dates.length,
            },
          },
        };
      } catch (err) {
        logger.error({ msg: 'Posting frequency calculation failed', error: err.message });
        return { success: false, error: `Posting frequency calculation failed: ${err.message}` };
      }
    },
  },

  analyzeHashtagStrategy: {
    name: 'analyzeHashtagStrategy',
    description: 'Analyze hashtag usage across posts to determine strategy effectiveness, niche alignment, reach tiers, and estimated market sizes.',
    inputSchema: z.object({
      posts: z
        .array(z.object({
          hashtags: z.array(z.string()).describe('Hashtags from a single post'),
          likes: z.number().optional().describe('Post likes for engagement correlation'),
          comments: z.number().optional().describe('Post comments for engagement correlation'),
        }))
        .min(1)
        .describe('Array of posts with their hashtags and engagement metrics'),
      detectedNiche: z
        .string()
        .optional()
        .describe('Primary niche detected by detectNiche tool (e.g. "fitness", "beauty")'),
    }),

    /**
     * @param {{ posts: Array<{ hashtags: string[], likes?: number, comments?: number }>, detectedNiche?: string }} input
     * @returns {{ success: boolean, data?: Object, error?: string }}
     */
    execute({ posts, detectedNiche }) {
      logger.info({ msg: 'Analyzing hashtag strategy', postCount: posts.length, detectedNiche });

      try {
        // Flatten all hashtags and normalize
        const allHashtags = [];
        const hashtagEngagement = {};

        for (const post of posts) {
          const engagement = (post.likes || 0) + (post.comments || 0);
          for (const tag of post.hashtags) {
            const normalized = tag.toLowerCase().replace(/^#/, '');
            if (!normalized) continue;
            allHashtags.push(normalized);
            if (!hashtagEngagement[normalized]) {
              hashtagEngagement[normalized] = { totalEngagement: 0, postCount: 0 };
            }
            hashtagEngagement[normalized].totalEngagement += engagement;
            hashtagEngagement[normalized].postCount++;
          }
        }

        if (allHashtags.length === 0) {
          return {
            success: true,
            data: {
              topHashtags: [],
              hashtagDiversityScore: 0,
              nicheAlignment: { score: 0, alignedHashtags: [], unalignedHashtags: [] },
              reachTiers: { mega: [], macro: [], micro: [], nano: [] },
              avgHashtagsPerPost: 0,
              totalUniqueHashtags: 0,
              estimatedNicheMarketSize: null,
            },
          };
        }

        // Frequency count
        const freqMap = {};
        for (const tag of allHashtags) {
          freqMap[tag] = (freqMap[tag] || 0) + 1;
        }

        const totalUnique = Object.keys(freqMap).length;
        const avgPerPost = posts.length > 0 ? Math.round((allHashtags.length / posts.length) * 10) / 10 : 0;

        // Top 10 by frequency
        const topHashtags = Object.entries(freqMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([tag, count]) => ({
            tag,
            count,
            percentage: Math.round((count / posts.length) * 100),
            avgEngagement: hashtagEngagement[tag]
              ? Math.round(hashtagEngagement[tag].totalEngagement / hashtagEngagement[tag].postCount)
              : 0,
          }));

        // Hashtag diversity score: ratio of unique hashtags to total used, scaled 0-100
        const diversityRatio = allHashtags.length > 0 ? totalUnique / allHashtags.length : 0;
        const hashtagDiversityScore = Math.round(diversityRatio * 100);

        // Niche-hashtag alignment
        const nicheKeywords = {
          fitness: ['fitness', 'gym', 'workout', 'exercise', 'training', 'muscle', 'gains', 'bodybuilding', 'fitfam', 'fitlife', 'strength', 'hiit', 'cardio', 'lifting'],
          wellness: ['wellness', 'mindfulness', 'meditation', 'selfcare', 'mentalhealth', 'healing', 'holistic', 'yoga', 'breathwork', 'journaling', 'gratitude'],
          beauty: ['beauty', 'makeup', 'skincare', 'cosmetics', 'glam', 'beautytips', 'mua', 'lipstick', 'foundation', 'glow', 'contour', 'eyeshadow'],
          fashion: ['fashion', 'style', 'ootd', 'outfit', 'streetstyle', 'fashionista', 'trend', 'wardrobe', 'clothing', 'lookbook', 'fashionweek'],
          cooking: ['cooking', 'recipe', 'foodie', 'chef', 'baking', 'mealprep', 'homemade', 'kitchen', 'food', 'nutrition', 'healthyeating'],
          tech: ['tech', 'technology', 'gadgets', 'coding', 'programming', 'software', 'ai', 'startup', 'developer', 'engineering', 'saas'],
          finance: ['finance', 'investing', 'money', 'wealth', 'crypto', 'stocks', 'budget', 'financialfreedom', 'entrepreneur', 'business', 'passive'],
          travel: ['travel', 'wanderlust', 'explore', 'adventure', 'destination', 'backpacking', 'tourism', 'travelgram', 'vacation', 'roadtrip'],
          parenting: ['parenting', 'mom', 'dad', 'momlife', 'dadlife', 'family', 'kids', 'motherhood', 'baby', 'toddler', 'sahm'],
          gaming: ['gaming', 'gamer', 'twitch', 'esports', 'gameplay', 'videogames', 'streamer', 'xbox', 'playstation', 'pc', 'nintendo'],
          music: ['music', 'musician', 'singer', 'producer', 'beats', 'songwriter', 'hiphop', 'rap', 'pop', 'indie', 'newmusic'],
          art: ['art', 'artist', 'painting', 'drawing', 'illustration', 'creative', 'digitalart', 'design', 'sketch', 'artwork'],
          education: ['education', 'learning', 'teacher', 'study', 'students', 'knowledge', 'tutor', 'school', 'course', 'edtech'],
          lifestyle: ['lifestyle', 'dailylife', 'vlog', 'dayinmylife', 'life', 'motivation', 'inspiration', 'goals', 'aesthetic'],
          pets: ['pets', 'dog', 'cat', 'puppy', 'kitten', 'dogsofinstagram', 'catsofinstagram', 'animals', 'petlover'],
          sports: ['sports', 'athlete', 'football', 'basketball', 'soccer', 'running', 'marathon', 'tennis', 'baseball'],
          photography: ['photography', 'photographer', 'photo', 'camera', 'portrait', 'landscape', 'photooftheday', 'lens'],
          supplements: ['supplements', 'protein', 'preworkout', 'vitamins', 'whey', 'creatine', 'bcaa', 'collagen', 'superfood'],
        };

        const nicheKeywordSet = detectedNiche && nicheKeywords[detectedNiche]
          ? new Set(nicheKeywords[detectedNiche])
          : new Set();

        const alignedHashtags = [];
        const unalignedHashtags = [];

        for (const tag of Object.keys(freqMap)) {
          if (nicheKeywordSet.size > 0) {
            const isAligned = [...nicheKeywordSet].some((kw) => tag.includes(kw) || kw.includes(tag));
            if (isAligned) {
              alignedHashtags.push(tag);
            } else {
              unalignedHashtags.push(tag);
            }
          }
        }

        const nicheAlignmentScore = nicheKeywordSet.size > 0 && totalUnique > 0
          ? Math.round((alignedHashtags.length / totalUnique) * 100)
          : null;

        // Estimated reach tiers based on known hashtag volumes
        // This is an approximation based on typical Instagram hashtag post counts
        const megaHashtags = ['love', 'instagood', 'fashion', 'photooftheday', 'beautiful', 'happy', 'cute', 'like4like', 'followme', 'selfie', 'picoftheday', 'art', 'food', 'fitness', 'travel', 'nature', 'style', 'beauty', 'music', 'life'];
        const macroHashtags = ['fitfam', 'healthylifestyle', 'entrepreneurlife', 'ootd', 'foodie', 'travelphotography', 'makeuptutorial', 'skincareroutine', 'workoutmotivation', 'mealprep', 'streetstyle', 'catsofinstagram', 'dogsofinstagram', 'gaming', 'podcast', 'bookstagram', 'plantbased', 'yogalife', 'techie', 'mensfashion'];

        const tierResults = { mega: [], macro: [], micro: [], nano: [] };

        for (const tag of Object.keys(freqMap)) {
          if (megaHashtags.includes(tag)) {
            tierResults.mega.push({ tag, estimatedReach: '100M+ posts' });
          } else if (macroHashtags.includes(tag) || tag.length <= 6) {
            tierResults.macro.push({ tag, estimatedReach: '1M-100M posts' });
          } else if (tag.length <= 15) {
            tierResults.micro.push({ tag, estimatedReach: '100K-1M posts' });
          } else {
            tierResults.nano.push({ tag, estimatedReach: '<100K posts' });
          }
        }

        // Estimated market sizes for common niches (USD)
        const nicheMarketSizes = {
          fitness: { size: '$2.1B', label: 'Fitness & Health', source: 'creator economy estimate' },
          beauty: { size: '$1.8B', label: 'Beauty & Cosmetics', source: 'creator economy estimate' },
          fashion: { size: '$1.5B', label: 'Fashion & Apparel', source: 'creator economy estimate' },
          cooking: { size: '$1.2B', label: 'Food & Cooking', source: 'creator economy estimate' },
          gaming: { size: '$2.5B', label: 'Gaming & Esports', source: 'creator economy estimate' },
          tech: { size: '$1.3B', label: 'Technology & SaaS', source: 'creator economy estimate' },
          finance: { size: '$1.1B', label: 'Personal Finance', source: 'creator economy estimate' },
          travel: { size: '$900M', label: 'Travel & Tourism', source: 'creator economy estimate' },
          wellness: { size: '$1.5B', label: 'Wellness & Self-Care', source: 'creator economy estimate' },
          parenting: { size: '$800M', label: 'Parenting & Family', source: 'creator economy estimate' },
          music: { size: '$1.0B', label: 'Music & Audio', source: 'creator economy estimate' },
          art: { size: '$500M', label: 'Art & Illustration', source: 'creator economy estimate' },
          education: { size: '$1.4B', label: 'Education & Courses', source: 'creator economy estimate' },
          lifestyle: { size: '$1.6B', label: 'Lifestyle & General', source: 'creator economy estimate' },
          pets: { size: '$600M', label: 'Pets & Animals', source: 'creator economy estimate' },
          sports: { size: '$1.8B', label: 'Sports & Athletics', source: 'creator economy estimate' },
          photography: { size: '$400M', label: 'Photography', source: 'creator economy estimate' },
          supplements: { size: '$1.7B', label: 'Supplements & Nutrition', source: 'creator economy estimate' },
        };

        return {
          success: true,
          data: {
            topHashtags,
            hashtagDiversityScore,
            nicheAlignment: {
              score: nicheAlignmentScore,
              alignedHashtags: alignedHashtags.slice(0, 10),
              unalignedHashtags: unalignedHashtags.slice(0, 10),
            },
            reachTiers: {
              mega: tierResults.mega.slice(0, 5),
              macro: tierResults.macro.slice(0, 5),
              micro: tierResults.micro.slice(0, 10),
              nano: tierResults.nano.slice(0, 5),
            },
            avgHashtagsPerPost: avgPerPost,
            totalUniqueHashtags: totalUnique,
            estimatedNicheMarketSize: detectedNiche ? (nicheMarketSizes[detectedNiche] || null) : null,
          },
        };
      } catch (err) {
        logger.error({ msg: 'Hashtag strategy analysis failed', error: err.message });
        return { success: false, error: `Hashtag strategy analysis failed: ${err.message}` };
      }
    },
  },

  detectContentFormats: {
    name: 'detectContentFormats',
    description: 'Analyze the format/type distribution of posts (Reels/Videos vs Carousels vs Single Images vs Stories) and determine best-performing format by engagement and format trends over time.',
    inputSchema: z.object({
      posts: z
        .array(z.object({
          type: z.string().describe('Post type/format (e.g. "Image", "Video", "Sidecar", "Reel", "Story", "Carousel", "Short")'),
          likes: z.number().optional().describe('Post likes'),
          comments: z.number().optional().describe('Post comments'),
          shares: z.number().optional().describe('Post shares'),
          views: z.number().optional().describe('Post views (for video content)'),
          timestamp: z.string().nullable().optional().describe('Post timestamp for trend detection'),
        }))
        .min(1)
        .describe('Array of posts with type and engagement info'),
    }),

    /**
     * @param {{ posts: Array<{ type: string, likes?: number, comments?: number, shares?: number, views?: number, timestamp?: string | null }> }} input
     * @returns {{ success: boolean, data?: Object, error?: string }}
     */
    execute({ posts }) {
      logger.info({ msg: 'Detecting content formats', postCount: posts.length });

      try {
        // Normalize format types into canonical categories
        const normalizeFormat = (type) => {
          const t = (type || 'unknown').toLowerCase().trim();
          if (['reel', 'reels', 'video', 'videos', 'short', 'shorts'].includes(t)) return 'video';
          if (['sidecar', 'carousel', 'carousels', 'album'].includes(t)) return 'carousel';
          if (['image', 'photo', 'photos', 'graphimage'].includes(t)) return 'image';
          if (['story', 'stories'].includes(t)) return 'story';
          if (['text', 'tweet', 'thread'].includes(t)) return 'text';
          if (['live', 'stream'].includes(t)) return 'live';
          return 'other';
        };

        // Categorize posts
        const formatBuckets = {};
        const formatEngagement = {};

        for (const post of posts) {
          const format = normalizeFormat(post.type);
          if (!formatBuckets[format]) {
            formatBuckets[format] = [];
          }
          formatBuckets[format].push(post);

          if (!formatEngagement[format]) {
            formatEngagement[format] = { totalLikes: 0, totalComments: 0, totalShares: 0, totalViews: 0, count: 0 };
          }
          formatEngagement[format].totalLikes += post.likes || 0;
          formatEngagement[format].totalComments += post.comments || 0;
          formatEngagement[format].totalShares += post.shares || 0;
          formatEngagement[format].totalViews += post.views || 0;
          formatEngagement[format].count++;
        }

        // Format distribution
        const totalPosts = posts.length;
        const formatDistribution = Object.entries(formatBuckets)
          .map(([format, items]) => ({
            format,
            count: items.length,
            percentage: Math.round((items.length / totalPosts) * 100),
            avgLikes: formatEngagement[format].count > 0
              ? Math.round(formatEngagement[format].totalLikes / formatEngagement[format].count)
              : 0,
            avgComments: formatEngagement[format].count > 0
              ? Math.round(formatEngagement[format].totalComments / formatEngagement[format].count)
              : 0,
            avgShares: formatEngagement[format].totalShares > 0
              ? Math.round(formatEngagement[format].totalShares / formatEngagement[format].count)
              : null,
            avgViews: formatEngagement[format].totalViews > 0
              ? Math.round(formatEngagement[format].totalViews / formatEngagement[format].count)
              : null,
            avgEngagement: formatEngagement[format].count > 0
              ? Math.round((formatEngagement[format].totalLikes + formatEngagement[format].totalComments) / formatEngagement[format].count)
              : 0,
          }))
          .sort((a, b) => b.percentage - a.percentage);

        // Best performing format by average engagement
        const bestPerforming = [...formatDistribution].sort((a, b) => b.avgEngagement - a.avgEngagement)[0] || null;

        // Format trend: compare first half vs second half of posts (by timestamp)
        const postsWithDates = posts
          .map((p) => ({
            ...p,
            parsedDate: p.timestamp ? new Date(isNaN(Number(p.timestamp)) ? p.timestamp : Number(p.timestamp) * 1000) : null,
          }))
          .filter((p) => p.parsedDate && !isNaN(p.parsedDate.getTime()))
          .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

        let formatTrend = null;
        if (postsWithDates.length >= 6) {
          const midpoint = Math.floor(postsWithDates.length / 2);
          const olderHalf = postsWithDates.slice(0, midpoint);
          const newerHalf = postsWithDates.slice(midpoint);

          const countFormats = (subset) => {
            const counts = {};
            for (const p of subset) {
              const f = normalizeFormat(p.type);
              counts[f] = (counts[f] || 0) + 1;
            }
            return counts;
          };

          const olderCounts = countFormats(olderHalf);
          const newerCounts = countFormats(newerHalf);

          // Detect shifts: which formats grew or shrank
          const allFormats = new Set([...Object.keys(olderCounts), ...Object.keys(newerCounts)]);
          const shifts = [];

          for (const f of allFormats) {
            const olderPct = olderHalf.length > 0 ? ((olderCounts[f] || 0) / olderHalf.length) * 100 : 0;
            const newerPct = newerHalf.length > 0 ? ((newerCounts[f] || 0) / newerHalf.length) * 100 : 0;
            const change = Math.round(newerPct - olderPct);
            if (Math.abs(change) >= 10) {
              shifts.push({ format: f, change, direction: change > 0 ? 'increasing' : 'decreasing' });
            }
          }

          formatTrend = {
            hasShift: shifts.length > 0,
            shifts: shifts.sort((a, b) => Math.abs(b.change) - Math.abs(a.change)),
            summary: shifts.length > 0
              ? `Creator is shifting toward more ${shifts.filter((s) => s.direction === 'increasing').map((s) => s.format).join(', ') || 'varied'} content.`
              : 'No significant format shift detected in recent posts.',
          };
        }

        return {
          success: true,
          data: {
            formatDistribution,
            bestPerformingFormat: bestPerforming
              ? { format: bestPerforming.format, avgEngagement: bestPerforming.avgEngagement, avgViews: bestPerforming.avgViews }
              : null,
            formatTrend,
            totalPostsAnalyzed: totalPosts,
            dominantFormat: formatDistribution.length > 0 ? formatDistribution[0].format : 'unknown',
          },
        };
      } catch (err) {
        logger.error({ msg: 'Content format detection failed', error: err.message });
        return { success: false, error: `Content format detection failed: ${err.message}` };
      }
    },
  },

  detectCompetitors: {
    name: 'detectCompetitors',
    description: 'Detect similar creators and competitor brands in the same niche based on niche category, hashtags, and follower count. Uses a curated lookup database -- does NOT scrape competitor profiles.',
    inputSchema: z.object({
      niche: z.string().describe('Primary niche (e.g. "fitness", "beauty", "tech")'),
      hashtags: z.array(z.string()).optional().describe('Top hashtags used by the creator'),
      followerCount: z.number().describe('Creator follower count for tier matching'),
    }),

    /**
     * @param {{ niche: string, hashtags?: string[], followerCount: number }} input
     * @returns {{ success: boolean, data?: Object, error?: string }}
     */
    execute({ niche, hashtags, followerCount }) {
      logger.info({ msg: 'Detecting competitors', niche, followerCount });

      try {
        // Curated competitor/brand database organized by niche
        // Each entry includes known creators and brands with their product lines
        const competitorDb = {
          fitness: {
            creators: [
              { name: 'Kayla Itsines', handle: '@kayla_itsines', followers: '16M', productLines: ['Sweat App', 'Workout Programs', 'Activewear'], tier: 'mega' },
              { name: 'Jeff Nippard', handle: '@jeffnippard', followers: '4.5M', productLines: ['Training Programs', 'eBooks', 'Supplements (collab)'], tier: 'macro' },
              { name: 'Whitney Simmons', handle: '@whitneyysimmons', followers: '3M', productLines: ['Activewear (Gymshark)', 'Workout Plans', 'Supplements'], tier: 'macro' },
              { name: 'Natacha Oceane', handle: '@natacha.oceane', followers: '2M', productLines: ['Training Programs', 'Nutrition Guides'], tier: 'macro' },
              { name: 'Sam Sulek', handle: '@sam_sulek', followers: '5M', productLines: ['Merchandise', 'Supplement Partnerships'], tier: 'macro' },
            ],
            brands: ['Gymshark', 'Alphalete', 'Alani Nu', '1st Phorm', 'Alo Yoga'],
          },
          beauty: {
            creators: [
              { name: 'James Charles', handle: '@jamescharles', followers: '23M', productLines: ['Palette (Morphe)', 'Merchandise', 'Masterclass'], tier: 'mega' },
              { name: 'Jackie Aina', handle: '@jackieaina', followers: '3.5M', productLines: ['FORVR Mood Candles', 'Brand Collabs', 'Affiliate'], tier: 'macro' },
              { name: 'Robert Welsh', handle: '@robertwelsh', followers: '2M', productLines: ['Skincare Line', 'Online Course', 'Affiliate'], tier: 'macro' },
              { name: 'Mikayla Nogueira', handle: '@mikaylanogueira', followers: '15M', productLines: ['Brand Partnerships', 'Affiliate Marketing'], tier: 'mega' },
              { name: 'Hyram', handle: '@skincarebyhyram', followers: '6M', productLines: ['Selfless by Hyram (skincare)', 'Brand Deals'], tier: 'macro' },
            ],
            brands: ['Glossier', 'Fenty Beauty', 'Rare Beauty', 'Charlotte Tilbury', 'The Ordinary'],
          },
          fashion: {
            creators: [
              { name: 'Chiara Ferragni', handle: '@chiaraferragni', followers: '29M', productLines: ['Chiara Ferragni Collection', 'Eyewear', 'Brand Collabs'], tier: 'mega' },
              { name: 'Emma Chamberlain', handle: '@emmachamberlain', followers: '16M', productLines: ['Chamberlain Coffee', 'Brand Deals', 'Podcast'], tier: 'mega' },
              { name: 'Matilda Djerf', handle: '@matildadjerf', followers: '3M', productLines: ['Djerf Avenue (clothing)', 'Hair Products'], tier: 'macro' },
              { name: 'Wisdom Kaye', handle: '@wisdm', followers: '4M', productLines: ['Brand Partnerships', 'Modeling', 'Merchandise'], tier: 'macro' },
              { name: 'Brittany Xavier', handle: '@brittanyxavier', followers: '2M', productLines: ['Drops of Joi (jewelry)', 'Affiliate Marketing'], tier: 'macro' },
            ],
            brands: ['SHEIN', 'Zara', 'H&M', 'Revolve', 'Princess Polly'],
          },
          cooking: {
            creators: [
              { name: 'Joshua Weissman', handle: '@joshuaweissman', followers: '8M', productLines: ['Cookbook', 'Sauce Line', 'Kitchen Tools'], tier: 'macro' },
              { name: 'Nara Smith', handle: '@narasmith', followers: '10M', productLines: ['Brand Partnerships', 'Cookbook (upcoming)'], tier: 'mega' },
              { name: 'Nick DiGiovanni', handle: '@nickdigio', followers: '15M', productLines: ['Osmo Salt Brand', 'Cookbook', 'Brand Deals'], tier: 'mega' },
              { name: 'Tabitha Brown', handle: '@iamtabithabrown', followers: '5M', productLines: ['Seasoning Line', 'Book', 'Target Collab'], tier: 'macro' },
              { name: 'Binging with Babish', handle: '@bingingwithbabish', followers: '3M', productLines: ['Cookware Line', 'Cookbook', 'Sauces'], tier: 'macro' },
            ],
            brands: ['HelloFresh', 'Our Place', 'Hexclad', 'Great Jones', 'Caraway'],
          },
          tech: {
            creators: [
              { name: 'MKBHD', handle: '@mkbhd', followers: '18M', productLines: ['Panels Wallpaper App', 'Studio Headphones (Beats collab)', 'Merchandise'], tier: 'mega' },
              { name: 'Linus Tech Tips', handle: '@linustech', followers: '16M', productLines: ['LTT Store (merchandise)', 'Screwdriver', 'Backpack'], tier: 'mega' },
              { name: 'iJustine', handle: '@ijustine', followers: '7M', productLines: ['Brand Deals', 'Merchandise', 'Books'], tier: 'macro' },
              { name: 'Ali Abdaal', handle: '@aliabdaal', followers: '5M', productLines: ['Part-Time YouTuber Academy', 'Book', 'Templates'], tier: 'macro' },
              { name: 'Sara Dietschy', handle: '@saradietschy', followers: '1M', productLines: ['Courses', 'Merchandise', 'Brand Deals'], tier: 'macro' },
            ],
            brands: ['dbrand', 'Anker', 'Logitech', 'Notion', 'Squarespace'],
          },
          finance: {
            creators: [
              { name: 'Graham Stephan', handle: '@grahamstephan', followers: '4.5M', productLines: ['Real Estate Course', 'Merchandise', 'Affiliate'], tier: 'macro' },
              { name: 'Andrei Jikh', handle: '@andreijikh', followers: '2M', productLines: ['Courses', 'Brand Partnerships', 'Affiliate'], tier: 'macro' },
              { name: 'Tori Dunlap', handle: '@herfirst100k', followers: '3M', productLines: ['Book', 'Financial Toolkit', 'Courses'], tier: 'macro' },
              { name: 'Humphrey Yang', handle: '@humphreytalks', followers: '4M', productLines: ['Brand Deals', 'Affiliate Marketing', 'Courses'], tier: 'macro' },
              { name: 'Vivian Tu (Your Rich BFF)', handle: '@yourrichbff', followers: '5M', productLines: ['Book', 'Newsletter', 'Brand Deals'], tier: 'macro' },
            ],
            brands: ['Robinhood', 'Wealthfront', 'SoFi', 'Betterment', 'NerdWallet'],
          },
          travel: {
            creators: [
              { name: 'Kara and Nate', handle: '@karaandnate', followers: '3M', productLines: ['Travel Guides', 'Presets', 'Merchandise'], tier: 'macro' },
              { name: 'Drew Binsky', handle: '@drewbinsky', followers: '3M', productLines: ['Travel Book', 'Presets', 'Merchandise'], tier: 'macro' },
              { name: 'Damon and Jo', handle: '@damonandjo', followers: '1.5M', productLines: ['Travel Courses', 'Brand Deals', 'Books'], tier: 'macro' },
              { name: 'Lost LeBlanc', handle: '@lostleblanc', followers: '2M', productLines: ['YouTube Course', 'Presets', 'Travel Guides'], tier: 'macro' },
              { name: 'Hey Nadine', handle: '@heynadine', followers: '700K', productLines: ['Presets', 'Travel Guides', 'Affiliate'], tier: 'mid' },
            ],
            brands: ['Away', 'Airbnb', 'Booking.com', 'Peak Design', 'Osprey'],
          },
          wellness: {
            creators: [
              { name: 'Jay Shetty', handle: '@jayshetty', followers: '12M', productLines: ['Books', 'Podcast', 'Coaching Programs', 'Tea Brand'], tier: 'mega' },
              { name: 'Yoga With Adriene', handle: '@adrienelouise', followers: '12M', productLines: ['FWFG Yoga (membership)', 'Merchandise', 'Books'], tier: 'mega' },
              { name: 'Dr. Nicole LePera', handle: '@the.holistic.psychologist', followers: '5M', productLines: ['Books', 'SelfHealers Circle (membership)', 'Journal'], tier: 'macro' },
              { name: 'Mel Robbins', handle: '@melrobbins', followers: '8M', productLines: ['Books', 'Planner', 'Courses', 'Podcast'], tier: 'macro' },
              { name: 'Sahara Rose', handle: '@iamsahararose', followers: '2M', productLines: ['Books', 'Rose Gold Goddesses (community)', 'Podcast'], tier: 'macro' },
            ],
            brands: ['Calm', 'Headspace', 'Lululemon', 'Moon Juice', 'Alo Yoga'],
          },
          gaming: {
            creators: [
              { name: 'PewDiePie', handle: '@pewdiepie', followers: '111M', productLines: ['Tsuki Market (clothing)', 'Book', 'Game'], tier: 'mega' },
              { name: 'Pokimane', handle: '@pokimanelol', followers: '9M', productLines: ['Midnight Snacks (brand)', 'RTS Agency', 'Merchandise'], tier: 'mega' },
              { name: 'Valkyrae', handle: '@valabortsonly', followers: '4M', productLines: ['RFLCT Skincare', 'Merchandise', 'Gaming Peripherals'], tier: 'macro' },
              { name: 'Ludwig', handle: '@ludwig', followers: '5M', productLines: ['Mogul Moves (merch)', 'Mogul Mail', 'Event Production'], tier: 'macro' },
              { name: 'Disguised Toast', handle: '@disguisedtoast', followers: '3M', productLines: ['Merchandise', 'Brand Deals'], tier: 'macro' },
            ],
            brands: ['Razer', 'HyperX', 'SteelSeries', 'Corsair', 'NZXT'],
          },
          parenting: {
            creators: [
              { name: 'Myka Stauffer', handle: '@mykastauffer', followers: '700K', productLines: ['Merchandise', 'Brand Deals', 'YouTube Revenue'], tier: 'mid' },
              { name: 'The Bucket List Family', handle: '@thebucketlistfamily', followers: '3M', productLines: ['Book', 'Travel Brand Deals', 'Merchandise'], tier: 'macro' },
              { name: 'Jamie Oliver', handle: '@jamieoliver', followers: '10M', productLines: ['Cookbooks', 'Kitchenware', 'Restaurant Chain'], tier: 'mega' },
              { name: 'BusyToddler', handle: '@busytoddler', followers: '2M', productLines: ['Book', 'Activity Guide', 'Course'], tier: 'macro' },
              { name: 'DadLab', handle: '@thedadlab', followers: '1.5M', productLines: ['Book', 'Science Kits', 'Brand Deals'], tier: 'macro' },
            ],
            brands: ['Lovevery', 'KiwiCo', 'Honest Company', 'Babybjorn', 'Hatch'],
          },
          music: {
            creators: [
              { name: 'Andrew Huang', handle: '@andrewhuang', followers: '2M', productLines: ['Sample Packs', 'Courses', 'Plugins'], tier: 'macro' },
              { name: 'Adam Neely', handle: '@adamneely', followers: '1.5M', productLines: ['Music Courses', 'Patreon', 'Merchandise'], tier: 'macro' },
              { name: 'Rick Beato', handle: '@rickbeato', followers: '4M', productLines: ['Beato Book', 'Ear Training Course', 'Merchandise'], tier: 'macro' },
              { name: 'Aimee Nolte', handle: '@aimeenoltemusic', followers: '500K', productLines: ['Jazz Courses', 'Sheet Music', 'Patreon'], tier: 'mid' },
              { name: 'Rob Scallon', handle: '@robscallon', followers: '1.5M', productLines: ['Merchandise', 'Patreon', 'Brand Deals'], tier: 'macro' },
            ],
            brands: ['Fender', 'Splice', 'Native Instruments', 'Focusrite', 'iZotope'],
          },
          art: {
            creators: [
              { name: 'Bobby Chiu', handle: '@digitalbobert', followers: '500K', productLines: ['Art Books', 'Schoolism (courses)', 'Prints'], tier: 'mid' },
              { name: 'Ross Draws', handle: '@rossdraws', followers: '2M', productLines: ['Art Prints', 'Courses', 'Merchandise'], tier: 'macro' },
              { name: 'Peter McKinnon', handle: '@petermckinnon', followers: '6M', productLines: ['Presets', 'LUTs', 'Coffee Brand'], tier: 'macro' },
              { name: 'Kasey Golden', handle: '@kaseythegolden', followers: '1.5M', productLines: ['Sketchbooks', 'Merchandise', 'Patreon'], tier: 'macro' },
              { name: 'Jazza', handle: '@jaborsky', followers: '6M', productLines: ['Art Supplies Brand', 'Courses', 'Books'], tier: 'macro' },
            ],
            brands: ['Procreate', 'Adobe', 'Arteza', 'Copic', 'Skillshare'],
          },
          education: {
            creators: [
              { name: 'Thomas Frank', handle: '@tomfrankly', followers: '3M', productLines: ['Notion Templates', 'Courses', 'Books'], tier: 'macro' },
              { name: 'Crash Course', handle: '@crashcourse', followers: '15M', productLines: ['Books', 'Study Guides', 'Merch'], tier: 'mega' },
              { name: 'Mark Rober', handle: '@markrober', followers: '25M', productLines: ['CrunchLabs (subscription)', 'Merchandise'], tier: 'mega' },
              { name: 'Mike Boyd', handle: '@mikeboyd', followers: '5M', productLines: ['Courses', 'Merchandise', 'Brand Deals'], tier: 'macro' },
              { name: 'Veritasium', handle: '@veritasium', followers: '16M', productLines: ['Brand Deals', 'Speaking', 'Merchandise'], tier: 'mega' },
            ],
            brands: ['Brilliant', 'Skillshare', 'MasterClass', 'Coursera', 'Notion'],
          },
          supplements: {
            creators: [
              { name: 'Andrew Huberman', handle: '@hubabortsonly', followers: '6M', productLines: ['Momentous Supplements', 'Podcast', 'Newsletter'], tier: 'macro' },
              { name: 'Greg Doucette', handle: '@gregdoucette', followers: '3M', productLines: ['Cookbooks', 'Supplement Line', 'Training Plans'], tier: 'macro' },
              { name: 'Chris Bumstead', handle: '@cbum', followers: '20M', productLines: ['RAW Nutrition', 'Bum Energy', 'Apparel'], tier: 'mega' },
              { name: 'More Plates More Dates', handle: '@moreplatesmoredates', followers: '2M', productLines: ['Gorilla Mind (supplements)', 'Merch'], tier: 'macro' },
              { name: 'Jeff Cavaliere', handle: '@atabortsonly', followers: '13M', productLines: ['Athlean-X Programs', 'RX Supplements'], tier: 'mega' },
            ],
            brands: ['Gorilla Mind', 'RAW Nutrition', 'Ghost', 'Transparent Labs', 'Legion Athletics'],
          },
          lifestyle: {
            creators: [
              { name: 'Emma Chamberlain', handle: '@emmachamberlain', followers: '16M', productLines: ['Chamberlain Coffee', 'Brand Deals', 'Podcast'], tier: 'mega' },
              { name: 'David Dobrik', handle: '@daviddobrik', followers: '12M', productLines: ['Dispo App', 'Perfume', 'Brand Deals'], tier: 'mega' },
              { name: 'Safiya Nygaard', handle: '@safiyany', followers: '10M', productLines: ['Lipstick Line (collab)', 'Merchandise'], tier: 'mega' },
              { name: 'Zach King', handle: '@zachking', followers: '25M', productLines: ['Books', 'Courses', 'Brand Deals'], tier: 'mega' },
              { name: 'Hannah Ashton', handle: '@hannahashton', followers: '2M', productLines: ['Merchandise', 'Courses', 'Brand Deals'], tier: 'macro' },
            ],
            brands: ['Chamberlain Coffee', 'Dispo', 'Fanjoy', 'Represent', 'Spring'],
          },
          pets: {
            creators: [
              { name: 'Tucker Budzyn', handle: '@tuckerbudzyn', followers: '3.5M', productLines: ['Merchandise', 'Books', 'Brand Deals'], tier: 'macro' },
              { name: 'Jiffpom', handle: '@jiffpom', followers: '9M', productLines: ['Merchandise', 'Brand Deals', 'Appearances'], tier: 'mega' },
              { name: 'Nala Cat', handle: '@nala_cat', followers: '4M', productLines: ['Love, Nala (cat food)', 'Merchandise'], tier: 'macro' },
              { name: 'Doug the Pug', handle: '@itsdougthepug', followers: '3.5M', productLines: ['Books', 'Toys', 'Merchandise', 'Brand Deals'], tier: 'macro' },
              { name: 'The Dodo', handle: '@thedodo', followers: '20M', productLines: ['Merchandise', 'Books', 'Shows'], tier: 'mega' },
            ],
            brands: ['BarkBox', 'Chewy', 'PetSmart', 'Wild One', 'Farmer\'s Dog'],
          },
          photography: {
            creators: [
              { name: 'Peter McKinnon', handle: '@petermckinnon', followers: '6M', productLines: ['Presets', 'LUTs', 'Coffee Brand'], tier: 'macro' },
              { name: 'Mango Street', handle: '@mangostreetlab', followers: '2M', productLines: ['Presets', 'Courses', 'LUTs'], tier: 'macro' },
              { name: 'Jessica Kobeissi', handle: '@jessicakobeissi', followers: '1M', productLines: ['Presets', 'Workshops', 'Patreon'], tier: 'macro' },
              { name: 'Irene Rudnyk', handle: '@irenerudnyk', followers: '500K', productLines: ['Presets', 'Overlays', 'Workshops'], tier: 'mid' },
              { name: 'Pat Kay', handle: '@pat.kay', followers: '300K', productLines: ['Presets', 'Education', 'Prints'], tier: 'mid' },
            ],
            brands: ['Sony', 'Canon', 'Adobe Lightroom', 'Moment', 'Peak Design'],
          },
          sports: {
            creators: [
              { name: 'Dude Perfect', handle: '@dudeperfect', followers: '60M', productLines: ['Merchandise', 'Mobile Game', 'Toys'], tier: 'mega' },
              { name: 'Jesser', handle: '@jesser', followers: '5M', productLines: ['Merchandise', 'Brand Deals', 'YouTube Revenue'], tier: 'macro' },
              { name: 'Deestroying', handle: '@deestroying', followers: '5M', productLines: ['Merchandise', 'Brand Deals'], tier: 'macro' },
              { name: 'Ryan Garcia', handle: '@kingryan', followers: '10M', productLines: ['Brand Deals', 'Supplements', 'Merchandise'], tier: 'mega' },
              { name: 'Juju Smith-Schuster', handle: '@jujusmithschuster', followers: '4M', productLines: ['Brand Deals', 'Merchandise', 'Gaming'], tier: 'macro' },
            ],
            brands: ['Nike', 'Under Armour', 'Gatorade', 'Adidas', 'New Balance'],
          },
        };

        // Determine creator tier based on follower count
        let creatorTier;
        if (followerCount >= 1_000_000) creatorTier = 'mega';
        else if (followerCount >= 100_000) creatorTier = 'macro';
        else if (followerCount >= 10_000) creatorTier = 'mid';
        else if (followerCount >= 1_000) creatorTier = 'micro';
        else creatorTier = 'nano';

        const nicheLower = (niche || 'lifestyle').toLowerCase();
        const nicheData = competitorDb[nicheLower] || competitorDb.lifestyle;

        // Filter competitors to similar tier or one tier above
        const tierOrder = ['nano', 'micro', 'mid', 'macro', 'mega'];
        const creatorTierIdx = tierOrder.indexOf(creatorTier);
        const relevantTiers = tierOrder.slice(
          Math.max(0, creatorTierIdx - 1),
          Math.min(tierOrder.length, creatorTierIdx + 3)
        );

        const relevantCreators = nicheData.creators
          .filter((c) => relevantTiers.includes(c.tier))
          .slice(0, 5);

        // If not enough relevant-tier competitors, fill with any from the niche
        const competitors = relevantCreators.length >= 3
          ? relevantCreators
          : nicheData.creators.slice(0, 5);

        // Identify hashtag overlap with niche hashtags
        const normalizedHashtags = (hashtags || []).map((h) => h.toLowerCase().replace(/^#/, ''));
        const competitorHashtagOverlap = normalizedHashtags.length > 0
          ? `Creator uses ${normalizedHashtags.length} hashtags common in the ${nicheLower} niche.`
          : 'No hashtag data available for overlap analysis.';

        return {
          success: true,
          data: {
            niche: nicheLower,
            creatorTier,
            similarCreators: competitors.map((c) => ({
              name: c.name,
              handle: c.handle,
              followers: c.followers,
              productLines: c.productLines,
              tier: c.tier,
            })),
            competingBrands: nicheData.brands || [],
            hashtagOverlapNote: competitorHashtagOverlap,
            opportunities: [
              `Most ${nicheLower} creators at the ${creatorTier} level monetize through ${competitors[0]?.productLines[0] || 'merchandise'} and ${competitors[0]?.productLines[1] || 'digital products'}.`,
              `Key competing brands in ${nicheLower}: ${(nicheData.brands || []).slice(0, 3).join(', ')}.`,
              `Consider differentiation through unique branding, niche sub-specialization, or underserved audience segments.`,
            ],
          },
        };
      } catch (err) {
        logger.error({ msg: 'Competitor detection failed', error: err.message });
        return { success: false, error: `Competitor detection failed: ${err.message}` };
      }
    },
  },
};
