// server/src/routes/proxy.js

import { Router } from 'express';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * Allowlisted hostname patterns for image proxying.
 * Only images from these domains will be proxied.
 */
const ALLOWED_HOSTS = [
  'instagram.com',
  'cdninstagram.com',
  'fbcdn.net',
  'scontent.cdninstagram.com',
  'pbs.twimg.com',
  'yt3.ggpht.com',
  'i.ytimg.com',
  'p16-sign-sg.tiktokcdn.com',
  'p16-sign-va.tiktokcdn.com',
  'p16-sign.tiktokcdn-us.com',
  'p77-sign.tiktokcdn-us.com',
  'tiktokcdn.com',
];

/**
 * Check if a URL hostname ends with one of the allowed hosts.
 * @param {string} urlString
 * @returns {boolean}
 */
function isAllowedUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return ALLOWED_HOSTS.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

/**
 * GET /api/v1/proxy/image?url=<encoded-url>
 *
 * Proxies external images through the server to bypass CORS restrictions.
 * Only allows images from known social media CDNs (Instagram, TikTok, YouTube, Twitter).
 *
 * Response is streamed with proper cache headers (1 hour browser, 24 hour CDN).
 */
router.get('/image', async (req, res) => {
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing url query parameter' });
  }

  if (!isAllowedUrl(url)) {
    return res.status(403).json({ success: false, error: 'URL hostname not in allowlist' });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BrandMeNow/2.0)',
        Accept: 'image/*',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        success: false,
        error: `Upstream returned ${upstream.status}`,
      });
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';

    // Only proxy image content types
    if (!contentType.startsWith('image/')) {
      return res.status(400).json({ success: false, error: 'Not an image content type' });
    }

    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'Access-Control-Allow-Origin': '*',
    });

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) {
      res.set('Content-Length', contentLength);
    }

    // Stream the response body
    const reader = upstream.body?.getReader();
    if (!reader) {
      return res.status(502).json({ success: false, error: 'No response body from upstream' });
    }

    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    };

    await pump();
  } catch (err) {
    logger.warn({ err, url }, 'Image proxy fetch failed');
    if (!res.headersSent) {
      res.status(502).json({ success: false, error: 'Failed to fetch image' });
    }
  }
});

export const proxyRoutes = router;
