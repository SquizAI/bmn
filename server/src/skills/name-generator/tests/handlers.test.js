// server/src/skills/name-generator/tests/handlers.test.js

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  suggestBrandNames,
  checkDomainAvailability,
  checkTrademarkConflicts,
  levenshteinDistance,
  _internals,
} from '../handlers.js';

// ---- suggestBrandNames ---------------------------------------------------

describe('suggestBrandNames', () => {
  it('should sort suggestions by confidence score descending', async () => {
    const input = {
      suggestions: [
        { name: 'Alpha', strategy: 'descriptive', reasoning: 'A descriptive brand name for testing', confidenceScore: 0.5, pronunciationGuide: null, tagline: null },
        { name: 'Zeta', strategy: 'abstract', reasoning: 'An abstract invented word for the brand', confidenceScore: 0.9, pronunciationGuide: 'ZEE-tah', tagline: null },
        { name: 'Mid', strategy: 'compound', reasoning: 'A compound word blending two concepts together', confidenceScore: 0.7, pronunciationGuide: null, tagline: 'Stay centered' },
      ],
    };

    const result = await suggestBrandNames(input);

    assert.equal(result.success, true);
    assert.equal(result.suggestions.length, 3);
    assert.equal(result.suggestions[0].name, 'Zeta');
    assert.equal(result.suggestions[1].name, 'Mid');
    assert.equal(result.suggestions[2].name, 'Alpha');
  });

  it('should preserve all fields in suggestions', async () => {
    const input = {
      suggestions: [
        {
          name: 'TestBrand',
          strategy: 'evocative',
          reasoning: 'Evokes a feeling of trust and reliability',
          confidenceScore: 0.85,
          pronunciationGuide: 'TEST-brand',
          tagline: 'Trust the process',
        },
      ],
    };

    const result = await suggestBrandNames(input);

    assert.equal(result.suggestions[0].pronunciationGuide, 'TEST-brand');
    assert.equal(result.suggestions[0].tagline, 'Trust the process');
    assert.equal(result.suggestions[0].strategy, 'evocative');
  });
});

// ---- checkDomainAvailability (with mocked fetch) -------------------------

describe('checkDomainAvailability', () => {
  /** @type {ReturnType<typeof mock.fn>} */
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should return available=true when RDAP returns 404', async () => {
    globalThis.fetch = mock.fn(async (url) => {
      if (url.includes('rdap.org')) {
        return { status: 404, ok: false };
      }
      return { status: 200, ok: true, json: async () => ({}) };
    });

    const result = await checkDomainAvailability({
      names: ['TestBrand'],
      extensions: ['.com'],
    });

    assert.equal(result.success, true);
    assert.equal(result.results['TestBrand']['.com'], true);
  });

  it('should return available=false when RDAP returns 200', async () => {
    globalThis.fetch = mock.fn(async (url) => {
      if (url.includes('rdap.org')) {
        return { status: 200, ok: true, json: async () => ({}) };
      }
      return { status: 200, ok: true, json: async () => ({}) };
    });

    const result = await checkDomainAvailability({
      names: ['Google'],
      extensions: ['.com'],
    });

    assert.equal(result.success, true);
    assert.equal(result.results['Google']['.com'], false);
  });

  it('should fall back to DNS when RDAP fails with non-404/non-200', async () => {
    globalThis.fetch = mock.fn(async (url) => {
      if (url.includes('rdap.org')) {
        return { status: 500, ok: false };
      }
      if (url.includes('dns.google')) {
        return {
          status: 200,
          ok: true,
          json: async () => ({ Status: 3, Answer: null }),
        };
      }
      return { status: 200, ok: true };
    });

    const result = await checkDomainAvailability({
      names: ['UniqueBrand'],
      extensions: ['.com'],
    });

    assert.equal(result.success, true);
    // DNS NXDOMAIN (Status 3) = available
    assert.equal(result.results['UniqueBrand']['.com'], true);
  });

  it('should return available=false when DNS resolves with Answer records', async () => {
    globalThis.fetch = mock.fn(async (url) => {
      if (url.includes('rdap.org')) {
        return { status: 500, ok: false };
      }
      if (url.includes('dns.google')) {
        return {
          status: 200,
          ok: true,
          json: async () => ({
            Status: 0,
            Answer: [{ name: 'google.com', type: 1, data: '142.250.80.46' }],
          }),
        };
      }
      return { status: 200, ok: true };
    });

    const result = await checkDomainAvailability({
      names: ['Google'],
      extensions: ['.com'],
    });

    assert.equal(result.success, true);
    assert.equal(result.results['Google']['.com'], false);
  });

  it('should assume taken when both RDAP and DNS fail', async () => {
    globalThis.fetch = mock.fn(async () => {
      throw new Error('Network error');
    });

    const result = await checkDomainAvailability({
      names: ['FailBrand'],
      extensions: ['.com'],
    });

    assert.equal(result.success, true);
    assert.equal(result.results['FailBrand']['.com'], false);
  });

  it('should check all 5 default extensions when none provided', async () => {
    globalThis.fetch = mock.fn(async (url) => {
      if (url.includes('rdap.org')) {
        return { status: 404, ok: false };
      }
      return { status: 200, ok: true };
    });

    const result = await checkDomainAvailability({
      names: ['TestBrand'],
      extensions: ['.com', '.co', '.io', '.shop', '.store'],
    });

    assert.equal(result.success, true);
    const domains = Object.keys(result.results['TestBrand']);
    assert.equal(domains.length, 5);
    assert.ok(domains.includes('.com'));
    assert.ok(domains.includes('.co'));
    assert.ok(domains.includes('.io'));
    assert.ok(domains.includes('.shop'));
    assert.ok(domains.includes('.store'));
  });

  it('should handle empty slug by marking all extensions as false', async () => {
    const result = await checkDomainAvailability({
      names: ['!!!'],
      extensions: ['.com'],
    });

    assert.equal(result.success, true);
    assert.equal(result.results['!!!']['.com'], false);
  });
});

// ---- checkTrademarkConflicts (with mocked fetch) -------------------------

describe('checkTrademarkConflicts', () => {
  /** @type {ReturnType<typeof mock.fn>} */
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should return low risk when USPTO returns no results', async () => {
    globalThis.fetch = mock.fn(async () => ({
      status: 200,
      ok: true,
      text: async () => '<html>0 results found</html>',
    }));

    const result = await checkTrademarkConflicts({
      names: ['ZyphoraUnique'],
      industryCategory: 'wellness',
    });

    assert.equal(result.success, true);
    assert.equal(result.results['ZyphoraUnique'].risk, 'low');
  });

  it('should return medium risk when USPTO returns 1-3 results', async () => {
    globalThis.fetch = mock.fn(async () => ({
      status: 200,
      ok: true,
      text: async () => '<html>2 results found</html>',
    }));

    const result = await checkTrademarkConflicts({
      names: ['TestMark'],
      industryCategory: 'tech',
    });

    assert.equal(result.success, true);
    assert.equal(result.results['TestMark'].risk, 'medium');
  });

  it('should return high risk when USPTO returns many results', async () => {
    globalThis.fetch = mock.fn(async () => ({
      status: 200,
      ok: true,
      text: async () => '<html>15 results found</html>',
    }));

    const result = await checkTrademarkConflicts({
      names: ['CommonName'],
      industryCategory: 'general',
    });

    assert.equal(result.success, true);
    assert.equal(result.results['CommonName'].risk, 'high');
  });

  it('should fall back to heuristic when USPTO is unavailable', async () => {
    globalThis.fetch = mock.fn(async () => ({
      status: 503,
      ok: false,
    }));

    const result = await checkTrademarkConflicts({
      names: ['Apple'],
      industryCategory: 'tech',
    });

    assert.equal(result.success, true);
    // "Apple" is in the well-known brands list, so heuristic should flag it
    assert.equal(result.results['Apple'].risk, 'high');
    assert.ok(result.results['Apple'].similarMarks.includes('apple'));
  });

  it('should fall back to heuristic when fetch throws', async () => {
    globalThis.fetch = mock.fn(async () => {
      throw new Error('Network error');
    });

    const result = await checkTrademarkConflicts({
      names: ['UniqueWordXYZ'],
      industryCategory: 'fashion',
    });

    assert.equal(result.success, true);
    assert.equal(result.results['UniqueWordXYZ'].risk, 'low');
  });

  it('should detect exact match with well-known brand in heuristic', async () => {
    globalThis.fetch = mock.fn(async () => {
      throw new Error('Offline');
    });

    const result = await checkTrademarkConflicts({
      names: ['Nike'],
      industryCategory: 'sports',
    });

    assert.equal(result.results['Nike'].risk, 'high');
    assert.ok(result.results['Nike'].notes.includes('identical'));
  });

  it('should detect similar names via Levenshtein distance in heuristic', async () => {
    globalThis.fetch = mock.fn(async () => {
      throw new Error('Offline');
    });

    const result = await checkTrademarkConflicts({
      names: ['Nke'], // Levenshtein distance 1 from 'nike'
      industryCategory: 'sports',
    });

    assert.equal(result.results['Nke'].risk, 'medium');
    assert.ok(result.results['Nke'].similarMarks.includes('nike'));
  });
});

// ---- levenshteinDistance --------------------------------------------------

describe('levenshteinDistance', () => {
  it('should return 0 for identical strings', () => {
    assert.equal(levenshteinDistance('hello', 'hello'), 0);
  });

  it('should return string length for empty comparison', () => {
    assert.equal(levenshteinDistance('hello', ''), 5);
    assert.equal(levenshteinDistance('', 'world'), 5);
  });

  it('should return 0 for two empty strings', () => {
    assert.equal(levenshteinDistance('', ''), 0);
  });

  it('should handle single character difference (substitution)', () => {
    assert.equal(levenshteinDistance('cat', 'bat'), 1);
  });

  it('should handle single character difference (insertion)', () => {
    assert.equal(levenshteinDistance('cat', 'cats'), 1);
  });

  it('should handle single character difference (deletion)', () => {
    assert.equal(levenshteinDistance('cats', 'cat'), 1);
  });

  it('should compute correct distance for common examples', () => {
    assert.equal(levenshteinDistance('kitten', 'sitting'), 3);
    assert.equal(levenshteinDistance('saturday', 'sunday'), 3);
    assert.equal(levenshteinDistance('nike', 'nke'), 1);
    assert.equal(levenshteinDistance('apple', 'aple'), 1);
    assert.equal(levenshteinDistance('google', 'gogle'), 1);
  });

  it('should be symmetric', () => {
    assert.equal(
      levenshteinDistance('abc', 'xyz'),
      levenshteinDistance('xyz', 'abc'),
    );
  });
});
