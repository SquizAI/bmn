// server/src/services/website-scraper.js

/**
 * Website / Linktree Scraping Service
 *
 * Scrapes personal websites, Linktree pages, and similar link-in-bio pages
 * to extract brand-relevant data: colors, product links, brand name,
 * social links, and about text.
 *
 * Features:
 * - Uses native fetch (Node 22) with timeout and error handling
 * - Extracts CSS color values from inline styles and stylesheets
 * - Identifies social media links from common platforms
 * - Extracts product/shop links from common e-commerce patterns
 * - Parses Open Graph and meta tags for brand name and description
 * - Handles Linktree, Beacons, Stan Store, and generic HTML
 */

import { logger as rootLogger } from '../lib/logger.js';

const logger = rootLogger.child({ service: 'website-scraper' });

/** @type {number} Fetch timeout in milliseconds */
const FETCH_TIMEOUT_MS = 15_000;

/** @type {number} Maximum HTML body size to process (2 MB) */
const MAX_BODY_SIZE = 2 * 1024 * 1024;

/**
 * @typedef {Object} WebsiteScrapeResult
 * @property {string[]} colors - Extracted brand colors (hex values)
 * @property {string|null} brandName - Detected brand/site name
 * @property {string[]} products - Product or shop links found
 * @property {string[]} socialLinks - Social media profile URLs
 * @property {string} aboutText - About/description text from the page
 */

/**
 * Validate and normalize a URL string.
 *
 * @param {string} rawUrl - User-provided URL
 * @returns {string} Normalized URL with protocol
 * @throws {Error} If URL is invalid
 */
function normalizeUrl(rawUrl) {
  let url = rawUrl.trim();

  // Add protocol if missing
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  // Validate via URL constructor
  try {
    const parsed = new URL(url);
    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are supported');
    }
    return parsed.href;
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }
}

/**
 * Fetch HTML content from a URL with timeout and size limits.
 *
 * @param {string} url - Validated URL to fetch
 * @returns {Promise<string>} Raw HTML string
 */
async function fetchHtml(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BrandMeNow/2.0; +https://brandmenow.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error(`Unexpected content type: ${contentType}. Expected HTML.`);
    }

    // Read with size limit
    const reader = response.body.getReader();
    const chunks = [];
    let totalSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.length;
      if (totalSize > MAX_BODY_SIZE) {
        reader.cancel();
        throw new Error('Page exceeds maximum size limit (2 MB)');
      }

      chunks.push(value);
    }

    const decoder = new TextDecoder('utf-8');
    return chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join('') + decoder.decode();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extract hex color values from HTML/CSS content.
 * Looks for hex colors in inline styles, style blocks, and CSS custom properties.
 *
 * @param {string} html - Raw HTML string
 * @returns {string[]} Unique hex color values (e.g. ["#FF5733", "#2C3E50"])
 */
function extractColors(html) {
  /** @type {Set<string>} */
  const colors = new Set();

  // Match hex colors (3, 4, 6, or 8 digit)
  const hexPattern = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/g;
  const hexMatches = html.match(hexPattern) || [];

  for (const hex of hexMatches) {
    const normalized = hex.toUpperCase();
    // Skip common non-brand colors (pure black, pure white, grays)
    if (['#000', '#000000', '#FFF', '#FFFFFF', '#333', '#333333', '#666', '#666666', '#999', '#999999', '#CCC', '#CCCCCC', '#EEE', '#EEEEEE', '#F5F5F5', '#FAFAFA'].includes(normalized)) {
      continue;
    }
    colors.add(normalized);
  }

  // Match rgb/rgba values and convert to hex
  const rgbPattern = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g;
  let rgbMatch;
  while ((rgbMatch = rgbPattern.exec(html)) !== null) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);

    if (r <= 255 && g <= 255 && b <= 255) {
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
      // Skip grayscale
      if (r !== g || g !== b || r < 20 || r > 235) continue;
      colors.add(hex);
    }
  }

  // Limit to 10 most likely brand colors
  return [...colors].slice(0, 10);
}

/**
 * Extract social media profile links from HTML.
 *
 * @param {string} html - Raw HTML string
 * @returns {string[]} Social media profile URLs
 */
function extractSocialLinks(html) {
  const socialDomains = [
    'instagram.com',
    'tiktok.com',
    'twitter.com',
    'x.com',
    'facebook.com',
    'youtube.com',
    'linkedin.com',
    'pinterest.com',
    'snapchat.com',
    'threads.net',
    'twitch.tv',
    'discord.gg',
    'discord.com',
    'reddit.com',
    'spotify.com',
    'soundcloud.com',
    'patreon.com',
  ];

  /** @type {Set<string>} */
  const links = new Set();

  // Extract all href values
  const hrefPattern = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = hrefPattern.exec(html)) !== null) {
    const href = match[1];
    for (const domain of socialDomains) {
      if (href.includes(domain)) {
        links.add(href);
        break;
      }
    }
  }

  return [...links];
}

/**
 * Extract product/shop links from HTML.
 * Looks for e-commerce platforms and shop-related URLs.
 *
 * @param {string} html - Raw HTML string
 * @returns {string[]} Product/shop URLs
 */
function extractProductLinks(html) {
  const shopPatterns = [
    'shopify.com',
    'gumroad.com',
    'etsy.com',
    'amazon.com',
    'stan.store',
    'teachable.com',
    'kajabi.com',
    'thinkific.com',
    'podia.com',
    'ko-fi.com',
    'buymeacoffee.com',
    'creativemarket.com',
    'redbubble.com',
    'teespring.com',
    'spring.com',
    'printful.com',
    'sellfy.com',
    'lemonsqueezy.com',
    '/shop',
    '/store',
    '/products',
    '/merch',
    '/courses',
    '/coaching',
  ];

  /** @type {Set<string>} */
  const links = new Set();

  const hrefPattern = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = hrefPattern.exec(html)) !== null) {
    const href = match[1];
    for (const pattern of shopPatterns) {
      if (href.toLowerCase().includes(pattern)) {
        links.add(href);
        break;
      }
    }
  }

  return [...links];
}

/**
 * Extract brand name from meta tags and page title.
 *
 * @param {string} html - Raw HTML string
 * @returns {string|null} Brand name or null
 */
function extractBrandName(html) {
  // Try Open Graph title first
  const ogTitle = html.match(/<meta\s+(?:property|name)=["']og:(?:site_name|title)["']\s+content=["']([^"']+)["']/i);
  if (ogTitle?.[1]) return ogTitle[1].trim();

  // Reverse attribute order (content before property)
  const ogTitleAlt = html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:(?:site_name|title)["']/i);
  if (ogTitleAlt?.[1]) return ogTitleAlt[1].trim();

  // Try <title> tag
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (title?.[1]) {
    // Clean up common title suffixes
    let name = title[1].trim();
    name = name.split(/\s*[|\-–—]\s*/)[0].trim();
    if (name.length > 0 && name.length < 100) return name;
  }

  return null;
}

/**
 * Extract about/description text from the page.
 *
 * @param {string} html - Raw HTML string
 * @returns {string} About text (may be empty)
 */
function extractAboutText(html) {
  // Try meta description first
  const metaDesc = html.match(/<meta\s+(?:name|property)=["'](?:description|og:description)["']\s+content=["']([^"']+)["']/i);
  if (metaDesc?.[1]) return metaDesc[1].trim();

  // Reverse attribute order
  const metaDescAlt = html.match(/<meta\s+content=["']([^"']+)["']\s+(?:name|property)=["'](?:description|og:description)["']/i);
  if (metaDescAlt?.[1]) return metaDescAlt[1].trim();

  // Look for common about sections
  const aboutPattern = /<(?:p|div|span|section)[^>]*class=["'][^"']*(?:about|bio|description|summary|intro)[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|div|span|section)>/gi;
  const aboutMatch = aboutPattern.exec(html);
  if (aboutMatch?.[1]) {
    // Strip HTML tags from the match
    const text = aboutMatch[1].replace(/<[^>]+>/g, '').trim();
    if (text.length > 10 && text.length < 2000) return text;
  }

  return '';
}

/**
 * Scrape a website URL and extract brand-relevant data.
 *
 * @param {string} url - URL to scrape (Linktree, personal site, etc.)
 * @returns {Promise<WebsiteScrapeResult>}
 */
export async function scrapeWebsite(url) {
  logger.info({ url }, 'Scraping website');

  /** @type {WebsiteScrapeResult} */
  const emptyResult = {
    colors: [],
    brandName: null,
    products: [],
    socialLinks: [],
    aboutText: '',
  };

  let normalizedUrl;
  try {
    normalizedUrl = normalizeUrl(url);
  } catch (err) {
    logger.warn({ url, error: err.message }, 'Invalid URL provided');
    throw new Error(`Invalid URL: ${err.message}`);
  }

  let html;
  try {
    html = await fetchHtml(normalizedUrl);
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn({ url: normalizedUrl }, 'Website fetch timed out');
      throw new Error('Website took too long to respond. Please check the URL and try again.');
    }
    logger.warn({ url: normalizedUrl, error: err.message }, 'Website fetch failed');
    throw new Error(`Could not fetch website: ${err.message}`);
  }

  if (!html || html.length === 0) {
    logger.warn({ url: normalizedUrl }, 'Empty response from website');
    return emptyResult;
  }

  try {
    const colors = extractColors(html);
    const brandName = extractBrandName(html);
    const products = extractProductLinks(html);
    const socialLinks = extractSocialLinks(html);
    const aboutText = extractAboutText(html);

    const result = {
      colors,
      brandName,
      products,
      socialLinks,
      aboutText,
    };

    logger.info({
      url: normalizedUrl,
      colorCount: colors.length,
      brandName,
      productCount: products.length,
      socialLinkCount: socialLinks.length,
      hasAbout: aboutText.length > 0,
    }, 'Website scrape complete');

    return result;
  } catch (err) {
    logger.error({ url: normalizedUrl, error: err.message }, 'Error parsing website HTML');
    return emptyResult;
  }
}

export default {
  scrapeWebsite,
};
