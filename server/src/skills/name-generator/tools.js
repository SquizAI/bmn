// server/src/skills/name-generator/tools.js

import { z } from 'zod';
import { logger } from '../../lib/logger.js';

// ── Tool Definitions ────────────────────────────────────────────────

export const tools = {
  checkDomain: {
    name: 'checkDomain',
    description: 'Check domain name availability using the Domainr API. Returns registration status for the given domain.',
    inputSchema: z.object({
      domain: z
        .string()
        .min(3)
        .max(63)
        .describe('Domain name to check (e.g., "mybrand.com")'),
    }),

    /** @param {{ domain: string }} input */
    async execute({ domain }) {
      logger.info({ msg: 'Checking domain availability', domain });

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

    /** @param {{ name: string, category?: string }} input */
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
};
