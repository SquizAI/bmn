// server/src/skills/name-generator/handlers.js

import { createClient } from '@supabase/supabase-js';
import { logger as rootLogger } from '../../lib/logger.js';
import { skillConfig } from './config.js';

const logger = rootLogger.child({ skill: 'name-generator' });

/**
 * Get the Supabase client. Uses environment variables, and lazy-initialises
 * so that tests can stub process.env before first use.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getSupabase() {
  if (!getSupabase._client) {
    getSupabase._client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  }
  return getSupabase._client;
}

// ---- suggestBrandNames ---------------------------------------------------

/**
 * Validate and structure brand name suggestions (passthrough with validation).
 * Sorts by confidence score descending per PRD spec.
 *
 * @param {{ suggestions: Array<{ name: string, strategy: string, reasoning: string, confidenceScore: number, pronunciationGuide: string|null, tagline: string|null }> }} input
 * @returns {Promise<{ success: boolean, suggestions: Array }>}
 */
export async function suggestBrandNames({ suggestions }) {
  logger.info({ count: suggestions.length }, 'Structuring brand name suggestions');

  // Sort by confidence score descending
  const sorted = [...suggestions].sort((a, b) => b.confidenceScore - a.confidenceScore);

  return {
    success: true,
    suggestions: sorted,
  };
}

// ---- checkDomainAvailability ---------------------------------------------

/**
 * Check domain availability via RDAP (primary) with DNS fallback.
 * Uses native fetch (Node 22).
 *
 * @param {{ names: string[], extensions: string[] }} input
 * @returns {Promise<{ success: boolean, results: Record<string, Record<string, boolean>>, error: string|null }>}
 */
export async function checkDomainAvailability({ names, extensions }) {
  const exts = extensions && extensions.length > 0
    ? extensions
    : skillConfig.naming.domainExtensions;

  logger.info({ nameCount: names.length, extensions: exts }, 'Checking domain availability');

  /** @type {Record<string, Record<string, boolean>>} */
  const results = {};

  for (const name of names) {
    results[name] = {};
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

    if (!slug) {
      exts.forEach((ext) => { results[name][ext] = false; });
      continue;
    }

    for (const ext of exts) {
      const domain = `${slug}${ext}`;
      try {
        const available = await checkSingleDomain(domain);
        results[name][ext] = available;
      } catch (err) {
        logger.warn({ domain, err: err.message }, 'Domain check failed');
        results[name][ext] = false; // Assume taken on error (conservative)
      }

      // Small delay to avoid rate limiting
      await sleep(200);
    }
  }

  return { success: true, results, error: null };
}

/**
 * Check a single domain via RDAP with DNS fallback.
 *
 * Method 1: RDAP (Registration Data Access Protocol) -- modern WHOIS replacement.
 *   - 404 = domain not found = likely available
 *   - 200 = domain found = registered
 *
 * Method 2 (fallback): Google DNS resolution.
 *   - NXDOMAIN (Status 3) = not registered
 *   - Has Answer records = registered
 *
 * @param {string} domain - Full domain (e.g. "mybrand.com")
 * @returns {Promise<boolean>} true if likely available
 */
async function checkSingleDomain(domain) {
  try {
    // Method 1: RDAP lookup -- 5s timeout per PRD spec
    const rdapResponse = await fetch(`https://rdap.org/domain/${domain}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (rdapResponse.status === 404) {
      // Domain not found in RDAP = likely available
      return true;
    }

    if (rdapResponse.ok) {
      // Domain found = registered
      return false;
    }

    // RDAP returned non-200/non-404 -- fall through to DNS
  } catch {
    // RDAP timeout or network error -- fall through to DNS
  }

  try {
    // Method 2: DNS fallback via Google DNS-over-HTTPS
    const dnsResponse = await fetch(`https://dns.google/resolve?name=${domain}&type=A`, {
      signal: AbortSignal.timeout(5000),
    });

    if (dnsResponse.ok) {
      const dnsData = await dnsResponse.json();

      // If DNS resolves with answers, domain is registered
      if (dnsData.Answer && dnsData.Answer.length > 0) {
        return false;
      }

      // NXDOMAIN (Status 3) means the domain does not exist
      if (dnsData.Status === 3) {
        return true;
      }
    }
  } catch {
    // DNS also failed -- fall through
  }

  // Both methods inconclusive -- assume taken (conservative)
  return false;
}

// ---- checkTrademarkConflicts ---------------------------------------------

/**
 * Check for basic trademark conflicts using USPTO TESS (primary)
 * with heuristic fallback using Levenshtein distance.
 *
 * @param {{ names: string[], industryCategory: string }} input
 * @returns {Promise<{ success: boolean, results: Record<string, { risk: string, notes: string, similarMarks: string[] }>, error: string|null }>}
 */
export async function checkTrademarkConflicts({ names, industryCategory }) {
  logger.info({ nameCount: names.length, industryCategory }, 'Checking trademark conflicts');

  /** @type {Record<string, { risk: string, notes: string, similarMarks: string[] }>} */
  const results = {};

  for (const name of names) {
    try {
      const searchResult = await searchTrademarkDatabase(name, industryCategory);
      results[name] = searchResult;
    } catch (err) {
      logger.warn({ name, err: err.message }, 'Trademark check failed');
      results[name] = {
        risk: 'unknown',
        notes: 'Trademark check unavailable -- manual verification recommended.',
        similarMarks: [],
      };
    }

    await sleep(300);
  }

  return { success: true, results, error: null };
}

/**
 * Search USPTO TESS (Trademark Electronic Search System) via their public web interface.
 * Parses the HTML response to extract result counts and similar mark names.
 * Falls back to heuristic analysis if the USPTO search is unavailable.
 *
 * @param {string} name - Brand name to check
 * @param {string} _industryCategory - Industry context (used in heuristic only)
 * @returns {Promise<{ risk: string, notes: string, similarMarks: string[] }>}
 */
async function searchTrademarkDatabase(name, _industryCategory) {
  try {
    const searchTerm = encodeURIComponent(name);
    const response = await fetch(
      `https://tmsearch.uspto.gov/bin/gate.exe?f=searchss&state=4810:1.1.1&p_s_ALL=${searchTerm}&p_L=50`,
      { signal: AbortSignal.timeout(10_000) },
    );

    if (!response.ok) {
      // USPTO search unavailable -- use heuristic
      return heuristicTrademarkCheck(name);
    }

    const html = await response.text();

    // Parse for number of results
    const resultCountMatch = html.match(/(\d+)\s+result/i);
    const resultCount = resultCountMatch ? parseInt(resultCountMatch[1], 10) : 0;

    // Extract similar mark names (basic HTML extraction)
    const markMatches = html.match(/serial\s+number[^<]*<[^>]+>[^<]*<a[^>]+>([^<]+)/gi) || [];
    const similarMarks = markMatches
      .slice(0, 5)
      .map((m) => m.replace(/<[^>]+>/g, '').replace(/serial\s+number[^a-z]*/i, '').trim())
      .filter(Boolean);

    if (resultCount === 0) {
      return {
        risk: 'low',
        notes: 'No existing trademarks found with this exact name.',
        similarMarks: [],
      };
    } else if (resultCount <= 3) {
      return {
        risk: 'medium',
        notes: `${resultCount} existing trademark(s) found -- review recommended.`,
        similarMarks,
      };
    } else {
      return {
        risk: 'high',
        notes: `${resultCount} existing trademarks found -- name may conflict.`,
        similarMarks,
      };
    }
  } catch {
    return heuristicTrademarkCheck(name);
  }
}

/**
 * Heuristic trademark risk assessment when USPTO TESS is unavailable.
 * Checks exact matches and Levenshtein distance against a curated list
 * of well-known brand names.
 *
 * @param {string} name - Brand name to check
 * @returns {{ risk: string, notes: string, similarMarks: string[] }}
 */
function heuristicTrademarkCheck(name) {
  const normalized = name.toLowerCase().trim();

  // Curated list of well-known brands likely to have trademark protection
  const wellKnownBrands = [
    'apple', 'google', 'amazon', 'nike', 'adidas', 'coca-cola', 'pepsi', 'microsoft',
    'samsung', 'disney', 'netflix', 'spotify', 'uber', 'lyft', 'airbnb', 'tesla',
    'starbucks', 'mcdonalds', 'walmart', 'target', 'costco', 'dove', 'lush', 'sephora',
    'patagonia', 'north face', 'lululemon', 'peloton', 'headspace', 'calm',
    'shopify', 'stripe', 'notion', 'figma', 'canva', 'slack', 'zoom', 'meta',
    'tiktok', 'snapchat', 'pinterest', 'twitter', 'linkedin', 'adobe', 'oracle',
  ];

  // Check exact match
  const exactMatch = wellKnownBrands.find((b) => normalized === b);
  if (exactMatch) {
    return {
      risk: 'high',
      notes: `"${name}" is identical to a major registered trademark.`,
      similarMarks: [exactMatch],
    };
  }

  // Check substring containment and Levenshtein distance
  const similarMatches = wellKnownBrands.filter((b) =>
    normalized.includes(b) || b.includes(normalized) ||
    levenshteinDistance(normalized, b) <= 2
  );

  if (similarMatches.length > 0) {
    return {
      risk: 'medium',
      notes: 'Name is similar to known brand(s). Manual review recommended.',
      similarMarks: similarMatches,
    };
  }

  return {
    risk: 'low',
    notes: 'No obvious conflicts with major brands. Full trademark search recommended before registration.',
    similarMarks: [],
  };
}

/**
 * Compute the Levenshtein (edit) distance between two strings.
 * Used for fuzzy trademark matching.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} The edit distance
 */
export function levenshteinDistance(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = a[i - 1] === b[j - 1]
        ? matrix[i - 1][j - 1]
        : 1 + Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]);
    }
  }

  return matrix[a.length][b.length];
}

// ---- saveNameSuggestions -------------------------------------------------

/**
 * Save name suggestions to the brand record in Supabase.
 * Uses an RPC for JSONB merge with a direct-update fallback.
 *
 * @param {{ brandId: string, userId: string, suggestions: Array }} input
 * @returns {Promise<{ success: boolean, brandId: string, savedCount: number, error: string|null }>}
 */
export async function saveNameSuggestions({ brandId, userId, suggestions }) {
  logger.info({ brandId, count: suggestions.length }, 'Saving name suggestions');

  const supabase = getSupabase();

  try {
    // Try RPC for atomic JSONB merge (avoids overwriting other social_data keys)
    const { error: rpcError } = await supabase.rpc('merge_brand_json', {
      p_brand_id: brandId,
      p_user_id: userId,
      p_key: 'name_suggestions',
      p_value: JSON.stringify(suggestions),
    });

    // Fallback: if RPC doesn't exist yet, update social_data directly
    if (rpcError) {
      logger.warn({ rpcError: rpcError.message }, 'RPC merge_brand_json failed, updating social_data directly');

      const { data: brand } = await supabase
        .from('brands')
        .select('social_data')
        .eq('id', brandId)
        .eq('user_id', userId)
        .single();

      const existingData = brand?.social_data || {};

      const { error: updateError } = await supabase
        .from('brands')
        .update({
          social_data: { ...existingData, name_suggestions: suggestions },
          updated_at: new Date().toISOString(),
        })
        .eq('id', brandId)
        .eq('user_id', userId);

      if (updateError) {
        throw updateError;
      }
    }

    // Write audit log entry
    await supabase.from('audit_log').insert({
      user_id: userId,
      action: 'name_suggestions_generated',
      resource_type: 'brand',
      resource_id: brandId,
      metadata: {
        suggestionCount: suggestions.length,
        topName: suggestions[0]?.name,
      },
    });

    return { success: true, brandId, savedCount: suggestions.length, error: null };
  } catch (err) {
    logger.error({ err, brandId }, 'Save name suggestions failed');
    return { success: false, brandId, savedCount: 0, error: err.message };
  }
}

// ---- Helpers -------------------------------------------------------------

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Expose internals for testing
export const _internals = {
  checkSingleDomain,
  searchTrademarkDatabase,
  heuristicTrademarkCheck,
  sleep,
  getSupabase,
};
