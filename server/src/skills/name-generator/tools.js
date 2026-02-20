// server/src/skills/name-generator/tools.js

import { z } from 'zod';
import dns from 'node:dns/promises';
import { logger } from '../../lib/logger.js';
import { routeModel } from '../_shared/model-router.js';

// ── Tool Definitions ────────────────────────────────────────────────

export const tools = {
  /**
   * brainstormNames
   *
   * Uses Claude Sonnet via model-router to generate 10 creative brand name
   * options based on brand archetype, personality traits, industry, and style.
   * Returns structured JSON array with reasoning for each name.
   *
   * Cost estimate: ~$0.01-0.02 per call (Claude Sonnet, ~500 tokens in, ~2000 out)
   */
  brainstormNames: {
    name: 'brainstormNames',
    description: 'Generate 10 creative brand name options using Claude AI. Considers archetype, personality traits, industry, and target audience. Returns names with reasoning, pronunciation notes, and trademark-friendliness assessment.',
    inputSchema: z.object({
      archetype: z
        .string()
        .describe('Brand archetype (e.g., "Creator", "Explorer", "Hero")'),
      traits: z
        .array(z.string())
        .min(1)
        .describe('Brand personality traits'),
      industry: z
        .string()
        .optional()
        .describe('Industry or niche (e.g., "fitness", "beauty", "sustainable fashion")'),
      targetAudience: z
        .string()
        .optional()
        .describe('Target audience description (e.g., "millennial women", "tech-savvy professionals")'),
      style: z
        .enum(['minimal', 'bold', 'vintage', 'modern', 'playful'])
        .optional()
        .describe('Brand style direction'),
      keywords: z
        .array(z.string())
        .optional()
        .describe('Optional keywords or themes to incorporate'),
      avoidWords: z
        .array(z.string())
        .optional()
        .describe('Words or patterns to avoid in generated names'),
    }),

    /**
     * @param {{ archetype: string, traits: string[], industry?: string, targetAudience?: string, style?: string, keywords?: string[], avoidWords?: string[] }} input
     * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
     */
    async execute({ archetype, traits, industry, targetAudience, style, keywords, avoidWords }) {
      logger.info({ msg: 'Brainstorming brand names via Claude Sonnet', archetype, traitCount: traits.length });

      const prompt = `You are an expert brand naming strategist. Generate exactly 10 creative, memorable, and trademark-friendly brand name options.

<user_input>
Brand archetype: ${archetype}
Personality traits: ${traits.join(', ')}
${industry ? `Industry: ${industry}` : ''}
${targetAudience ? `Target audience: ${targetAudience}` : ''}
${style ? `Visual style: ${style}` : ''}
${keywords && keywords.length > 0 ? `Keywords to incorporate: ${keywords.join(', ')}` : ''}
${avoidWords && avoidWords.length > 0 ? `Words to AVOID: ${avoidWords.join(', ')}` : ''}
</user_input>

Generate 10 brand names following these rules:
1. Each name should be unique, memorable, and easy to pronounce
2. Mix different naming strategies: coined words, portmanteaus, metaphors, descriptive, abstract
3. Names should be 1-3 words maximum
4. Consider domain availability (prefer names where .com might be available)
5. Avoid names that are too generic or already well-known brands
6. Each name should evoke the brand archetype and personality

Return ONLY a valid JSON object with this exact shape:
{
  "names": [
    {
      "name": "BrandName",
      "strategy": "coined|portmanteau|metaphor|descriptive|abstract|compound|acronym",
      "reasoning": "Why this name works for this brand",
      "pronunciation": "BRAND-name",
      "trademarkFriendly": true,
      "trademarkNotes": "Brief note on trademark viability",
      "suggestedDomains": ["brandname.com", "brandname.co"],
      "moodAlignment": "How the name aligns with the brand mood/style"
    }
  ]
}`;

      try {
        const result = await routeModel('name-generation', {
          prompt,
          systemPrompt: 'You are an expert brand naming strategist. Always respond with valid JSON only. No markdown, no explanation outside JSON.',
          maxTokens: 4096,
          temperature: 0.9, // Higher temperature for more creative names
          jsonMode: true,
        });

        // Parse the response
        let parsed;
        try {
          parsed = JSON.parse(result.text);
        } catch {
          const jsonMatch = result.text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            logger.warn({ msg: 'Failed to extract JSON from name brainstorm response' });
            return { success: false, error: 'AI returned non-JSON response for name generation.' };
          }
          parsed = JSON.parse(jsonMatch[0]);
        }

        const names = parsed.names || [];

        logger.info({
          msg: 'Name brainstorm complete',
          model: result.model,
          provider: result.provider,
          nameCount: names.length,
        });

        return {
          success: true,
          data: {
            names,
            count: names.length,
            inputContext: {
              archetype,
              traits,
              industry: industry || null,
              style: style || null,
            },
            model: result.model,
            provider: result.provider,
          },
        };
      } catch (err) {
        logger.error({ msg: 'Name brainstorm failed', error: err.message });
        return { success: false, error: `Name brainstorm failed: ${err.message}` };
      }
    },
  },

  /**
   * checkDomainAvailability
   *
   * Check domain availability for multiple TLDs using Node.js built-in DNS resolution.
   * Performs DNS lookup (dns.resolve) -- if the domain has no DNS records, it is
   * likely available. This is a heuristic, not authoritative (WHOIS would be definitive).
   *
   * Cost estimate: Free (uses Node.js built-in dns module)
   */
  checkDomainAvailability: {
    name: 'checkDomainAvailability',
    description: 'Check domain availability for a brand name across .com, .co, and .io TLDs using DNS resolution. Fast and free but heuristic-based -- a domain with no DNS records is likely available.',
    inputSchema: z.object({
      name: z
        .string()
        .min(1)
        .max(63)
        .describe('Brand name to check (will be cleaned to valid domain format)'),
      tlds: z
        .array(z.string())
        .default(['.com', '.co', '.io'])
        .describe('TLDs to check (default: .com, .co, .io)'),
    }),

    /**
     * @param {{ name: string, tlds: string[] }} input
     * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
     */
    async execute({ name, tlds = ['.com', '.co', '.io'] }) {
      // Clean the name to a valid domain format
      const cleanName = name
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .replace(/^-+|-+$/g, '')
        .substring(0, 63);

      if (!cleanName) {
        return { success: false, error: 'Brand name could not be converted to a valid domain format.' };
      }

      logger.info({ msg: 'Checking domain availability', name: cleanName, tlds });

      const results = [];

      for (const tld of tlds) {
        const normalizedTld = tld.startsWith('.') ? tld : `.${tld}`;
        const domain = `${cleanName}${normalizedTld}`;

        try {
          // Try multiple DNS record types
          let hasRecords = false;

          // Check A records (IPv4)
          try {
            const aRecords = await dns.resolve4(domain);
            if (aRecords && aRecords.length > 0) {
              hasRecords = true;
            }
          } catch {
            // ENOTFOUND or ENODATA means no A records -- that's fine
          }

          // Check AAAA records (IPv6) if no A records found
          if (!hasRecords) {
            try {
              const aaaaRecords = await dns.resolve6(domain);
              if (aaaaRecords && aaaaRecords.length > 0) {
                hasRecords = true;
              }
            } catch {
              // No AAAA records
            }
          }

          // Check NS records (nameservers) as a stronger signal of registration
          if (!hasRecords) {
            try {
              const nsRecords = await dns.resolveNs(domain);
              if (nsRecords && nsRecords.length > 0) {
                hasRecords = true;
              }
            } catch {
              // No NS records
            }
          }

          // Check MX records as additional signal
          if (!hasRecords) {
            try {
              const mxRecords = await dns.resolveMx(domain);
              if (mxRecords && mxRecords.length > 0) {
                hasRecords = true;
              }
            } catch {
              // No MX records
            }
          }

          results.push({
            domain,
            tld: normalizedTld,
            available: !hasRecords,
            status: hasRecords ? 'likely-taken' : 'likely-available',
            method: 'dns-lookup',
            note: hasRecords
              ? 'Domain has DNS records -- likely registered.'
              : 'No DNS records found -- domain is likely available (verify via registrar before purchasing).',
          });
        } catch (err) {
          // General DNS lookup failure -- treat as potentially available
          results.push({
            domain,
            tld: normalizedTld,
            available: null,
            status: 'unknown',
            method: 'dns-lookup',
            note: `DNS lookup failed: ${err.message}. Check manually.`,
          });
        }
      }

      const availableCount = results.filter((r) => r.available === true).length;
      const takenCount = results.filter((r) => r.available === false).length;

      logger.info({
        msg: 'Domain check complete',
        name: cleanName,
        available: availableCount,
        taken: takenCount,
        unknown: results.length - availableCount - takenCount,
      });

      return {
        success: true,
        data: {
          brandName: name,
          cleanDomainName: cleanName,
          results,
          summary: {
            checked: results.length,
            likelyAvailable: availableCount,
            likelyTaken: takenCount,
            unknown: results.length - availableCount - takenCount,
          },
          disclaimer: 'DNS-based availability check is heuristic. A domain without DNS records may still be registered but not configured. Always verify via a domain registrar before purchasing.',
        },
      };
    },
  },

  /**
   * checkDomain
   *
   * Check domain availability using the Domainr API for authoritative results.
   * Requires DOMAINR_API_KEY to be configured. Falls back to 'unchecked' status if not set.
   *
   * Cost estimate: Depends on Domainr plan (free tier available)
   */
  checkDomain: {
    name: 'checkDomain',
    description: 'Check domain name availability using the Domainr API (authoritative). Returns registration status for the given domain. Requires DOMAINR_API_KEY.',
    inputSchema: z.object({
      domain: z
        .string()
        .min(3)
        .max(63)
        .describe('Domain name to check (e.g., "mybrand.com")'),
    }),

    /**
     * @param {{ domain: string }} input
     * @returns {Promise<{ success: boolean, data: Object }>}
     */
    async execute({ domain }) {
      logger.info({ msg: 'Checking domain availability via Domainr', domain });

      const apiKey = process.env.DOMAINR_API_KEY;

      if (!apiKey) {
        logger.warn({ msg: 'DOMAINR_API_KEY not set -- returning unchecked status' });
        return {
          success: true,
          data: {
            domain,
            status: 'unchecked',
            available: null,
            note: 'Domain check API key not configured. Status could not be verified.',
          },
        };
      }

      try {
        const url = new URL('https://api.domainr.com/v2/status');
        url.searchParams.set('domain', domain);
        url.searchParams.set('client_id', apiKey);

        const response = await fetch(url.toString());

        if (!response.ok) {
          logger.warn({ msg: 'Domainr API request failed', status: response.status, domain });
          return {
            success: true,
            data: {
              domain,
              status: 'unchecked',
              available: null,
              note: `Domain check API returned status ${response.status}.`,
            },
          };
        }

        const result = await response.json();
        const domainStatus = result.status?.[0];

        if (!domainStatus) {
          return {
            success: true,
            data: { domain, status: 'unchecked', available: null, note: 'No status data returned.' },
          };
        }

        // Domainr status summary codes:
        // "undelegated" = available, "active" = taken, "inactive" = may be available
        const summaryStatus = domainStatus.summary || '';
        const isAvailable = summaryStatus.includes('undelegated') || summaryStatus.includes('inactive');
        const isTaken = summaryStatus.includes('active');

        return {
          success: true,
          data: {
            domain: domainStatus.domain,
            status: isAvailable ? 'available' : isTaken ? 'taken' : 'unknown',
            available: isAvailable,
            summary: summaryStatus,
            zone: domainStatus.zone || null,
          },
        };
      } catch (err) {
        logger.warn({ msg: 'Domain check failed', domain, error: err.message });
        return {
          success: true,
          data: {
            domain,
            status: 'unchecked',
            available: null,
            note: `Domain check failed: ${err.message}`,
          },
        };
      }
    },
  },

  /**
   * checkTrademark
   *
   * Check for potential trademark conflicts using the Trademarkia API.
   * Results are informational only -- NOT legal advice.
   * Requires TRADEMARKIA_API_KEY to be configured.
   *
   * Cost estimate: Depends on Trademarkia plan
   */
  checkTrademark: {
    name: 'checkTrademark',
    description: 'Check for potential trademark conflicts using the Trademarkia API. Returns are informational only -- NOT legal advice.',
    inputSchema: z.object({
      name: z
        .string()
        .min(1)
        .max(100)
        .describe('Brand name to check for trademark conflicts'),
      category: z
        .string()
        .optional()
        .describe('Trademark category/class to search within (optional, e.g., "clothing", "software")'),
    }),

    /**
     * @param {{ name: string, category?: string }} input
     * @returns {Promise<{ success: boolean, data: Object }>}
     */
    async execute({ name, category }) {
      logger.info({ msg: 'Checking trademark availability', name, category });

      const apiKey = process.env.TRADEMARKIA_API_KEY;

      if (!apiKey) {
        logger.warn({ msg: 'TRADEMARKIA_API_KEY not set -- returning unchecked status' });
        return {
          success: true,
          data: {
            name,
            category: category || null,
            status: 'unchecked',
            conflicts: [],
            disclaimer: 'Trademark search results are for informational purposes only and do not constitute legal advice. Consult a trademark attorney before finalizing your brand name.',
            note: 'Trademark check API key not configured. Status could not be verified.',
          },
        };
      }

      try {
        const url = new URL('https://api.trademarkia.com/api/v1/trademark/search');
        const params = { query: name };
        if (category) {
          params.category = category;
        }

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          logger.warn({ msg: 'Trademarkia API request failed', status: response.status, name });
          return {
            success: true,
            data: {
              name,
              category: category || null,
              status: 'unchecked',
              conflicts: [],
              disclaimer: 'Trademark search results are for informational purposes only and do not constitute legal advice. Consult a trademark attorney before finalizing your brand name.',
              note: `Trademark check API returned status ${response.status}.`,
            },
          };
        }

        const result = await response.json();
        const matches = result.results || result.trademarks || [];

        // Evaluate conflict level
        const exactMatches = matches.filter((m) =>
          (m.name || m.mark || '').toLowerCase() === name.toLowerCase()
        );
        const similarMatches = matches.filter((m) =>
          (m.name || m.mark || '').toLowerCase() !== name.toLowerCase()
        );

        let status = 'clear';
        if (exactMatches.length > 0) {
          status = 'conflict-found';
        } else if (similarMatches.length > 0) {
          status = 'potential-conflict';
        }

        return {
          success: true,
          data: {
            name,
            category: category || null,
            status,
            exactMatches: exactMatches.length,
            similarMatches: similarMatches.length,
            conflicts: matches.slice(0, 5).map((m) => ({
              name: m.name || m.mark,
              status: m.status,
              category: m.category || m.class_description,
              owner: m.owner || null,
            })),
            disclaimer: 'Trademark search results are for informational purposes only and do not constitute legal advice. Consult a trademark attorney before finalizing your brand name.',
          },
        };
      } catch (err) {
        logger.warn({ msg: 'Trademark check failed', name, error: err.message });
        return {
          success: true,
          data: {
            name,
            category: category || null,
            status: 'unchecked',
            conflicts: [],
            disclaimer: 'Trademark search results are for informational purposes only and do not constitute legal advice. Consult a trademark attorney before finalizing your brand name.',
            note: `Trademark check failed: ${err.message}`,
          },
        };
      }
    },
  },

  /**
   * checkSocialHandles
   *
   * Check social media handle availability across Instagram, TikTok, and YouTube.
   * Uses HTTP HEAD/GET requests to platform profile pages.
   * A 404 or redirect suggests the handle may be available.
   *
   * Cost estimate: Free (HTTP requests to public endpoints)
   */
  checkSocialHandles: {
    name: 'checkSocialHandles',
    description: 'Check if a brand name is available as a social media handle on Instagram, TikTok, and YouTube. Uses HTTP requests to profile pages -- 404 means likely available.',
    inputSchema: z.object({
      handle: z
        .string()
        .min(1)
        .max(30)
        .describe('Handle to check (without @ prefix)'),
      platforms: z
        .array(z.enum(['instagram', 'tiktok', 'youtube']))
        .default(['instagram', 'tiktok', 'youtube'])
        .describe('Platforms to check'),
    }),

    /**
     * @param {{ handle: string, platforms: string[] }} input
     * @returns {Promise<{ success: boolean, data: Object }>}
     */
    async execute({ handle, platforms = ['instagram', 'tiktok', 'youtube'] }) {
      const cleanHandle = handle
        .toLowerCase()
        .replace(/[^a-z0-9_.]/g, '')
        .substring(0, 30);

      if (!cleanHandle) {
        return { success: false, error: 'Handle could not be cleaned to a valid format.' };
      }

      logger.info({ msg: 'Checking social handle availability', handle: cleanHandle, platforms });

      const platformUrls = {
        instagram: `https://www.instagram.com/${cleanHandle}/`,
        tiktok: `https://www.tiktok.com/@${cleanHandle}`,
        youtube: `https://www.youtube.com/@${cleanHandle}`,
      };

      const results = {};

      for (const platform of platforms) {
        const url = platformUrls[platform];
        if (!url) continue;

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'manual',
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; BrandMeNow/2.0)',
            },
          });

          clearTimeout(timeout);

          // 404 = likely available, 200 = likely taken, 3xx = redirect (platform-dependent)
          if (response.status === 404) {
            results[platform] = { available: true, status: 'likely-available' };
          } else if (response.status >= 200 && response.status < 300) {
            results[platform] = { available: false, status: 'likely-taken' };
          } else if (response.status >= 300 && response.status < 400) {
            // Redirects on some platforms mean the handle doesn't exist
            results[platform] = { available: null, status: 'unknown' };
          } else {
            results[platform] = { available: null, status: 'unknown' };
          }
        } catch {
          results[platform] = { available: null, status: 'unchecked', note: 'Request failed or timed out.' };
        }
      }

      return {
        success: true,
        data: {
          handle: cleanHandle,
          results,
          note: 'Social handle availability is heuristic-based. Verify by attempting to register on each platform.',
        },
      };
    },
  },
};
