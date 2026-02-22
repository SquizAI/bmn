// server/src/__tests__/logo-templates.test.js
//
// Unit tests for the logo template resolver used by the logo generation worker.
// Tests resolveLogoTemplate(), getArchetypeKeys(), getStyleKeys(), and
// getRecommendedVariations() from ../data/logo-templates.js.

import { describe, it, expect } from 'vitest';
import {
  resolveLogoTemplate,
  getArchetypeKeys,
  getStyleKeys,
  getRecommendedVariations,
  ARCHETYPE_TRAITS,
  STYLE_PARAMS,
  LOGO_VARIATIONS,
} from '../data/logo-templates.js';

// ── resolveLogoTemplate ──────────────────────────────────────────────────

describe('resolveLogoTemplate', () => {
  const baseParams = {
    brandName: 'TestBrand',
    logoStyle: 'modern',
  };

  // ── Prompt count matching ──────────────────────────────────────────

  it('should return the correct number of prompts matching count param', () => {
    const result = resolveLogoTemplate({ ...baseParams, count: 3 });
    expect(result.prompts).toHaveLength(3);
  });

  it('should default to 4 prompts when count is not specified', () => {
    const result = resolveLogoTemplate({ brandName: 'Test', logoStyle: 'bold' });
    expect(result.prompts).toHaveLength(4);
  });

  it('should return 1 prompt when count is 1', () => {
    const result = resolveLogoTemplate({ ...baseParams, count: 1 });
    expect(result.prompts).toHaveLength(1);
  });

  it('should return all 6 variations when count is 6', () => {
    const result = resolveLogoTemplate({ ...baseParams, count: 6 });
    expect(result.prompts).toHaveLength(6);
  });

  it('should cap at the total number of variations when count exceeds available', () => {
    const result = resolveLogoTemplate({ ...baseParams, count: 100 });
    expect(result.prompts).toHaveLength(LOGO_VARIATIONS.length);
  });

  // ── Prompt structure ───────────────────────────────────────────────

  it('should return prompts with text, variation, and label fields', () => {
    const result = resolveLogoTemplate({ ...baseParams, count: 2 });

    for (const prompt of result.prompts) {
      expect(prompt).toHaveProperty('text');
      expect(prompt).toHaveProperty('variation');
      expect(prompt).toHaveProperty('label');
      expect(typeof prompt.text).toBe('string');
      expect(typeof prompt.variation).toBe('string');
      expect(typeof prompt.label).toBe('string');
      expect(prompt.text.length).toBeGreaterThan(0);
      expect(prompt.variation.length).toBeGreaterThan(0);
      expect(prompt.label.length).toBeGreaterThan(0);
    }
  });

  // ── Archetype trait usage ──────────────────────────────────────────

  it('should include archetype personality traits when archetype is provided', () => {
    const result = resolveLogoTemplate({
      ...baseParams,
      archetype: 'the-hero',
      count: 1,
    });

    const heroTraits = ARCHETYPE_TRAITS['the-hero'];
    // The base prompt should include personality adjectives
    expect(result.basePrompt).toContain('Brand personality:');
    expect(result.basePrompt).toContain(heroTraits.adjectives[0]);
    // The base prompt should include mood
    expect(result.basePrompt).toContain(`Mood: ${heroTraits.mood}`);
  });

  it('should normalize archetype key with spaces to kebab-case', () => {
    const result = resolveLogoTemplate({
      ...baseParams,
      archetype: 'The Hero',
      count: 1,
    });

    expect(result.archetype).toBe('the-hero');
    expect(result.basePrompt).toContain('Brand personality:');
  });

  it('should not include archetype traits when archetype is not provided', () => {
    const result = resolveLogoTemplate({
      ...baseParams,
      count: 1,
    });

    expect(result.basePrompt).not.toContain('Brand personality:');
    expect(result.basePrompt).not.toContain('Mood:');
    expect(result.metadata.archetypeTraits).toBeNull();
  });

  it('should add archetype symbol hints for icon-bearing variations', () => {
    const result = resolveLogoTemplate({
      ...baseParams,
      archetype: 'the-sage',
      count: 1, // icon is priority 1
    });

    // The icon variation should include symbol hints
    const iconPrompt = result.prompts[0];
    expect(iconPrompt.variation).toBe('icon');
    expect(iconPrompt.text).toContain('Consider incorporating elements inspired by:');
    const sageSymbols = ARCHETYPE_TRAITS['the-sage'].symbols.slice(0, 3);
    expect(iconPrompt.text).toContain(sageSymbols.join(', '));
  });

  // ── Style fallback ─────────────────────────────────────────────────

  it('should fall back to "modern" style when unknown style is given', () => {
    const result = resolveLogoTemplate({
      brandName: 'FallbackTest',
      logoStyle: 'nonexistent-style',
      count: 1,
    });

    const modernStyle = STYLE_PARAMS.modern;
    expect(result.basePrompt).toContain(modernStyle.promptFragment);
    expect(result.negativePrompt).toBe(modernStyle.negative);
  });

  it('should use "modern" style when logoStyle is undefined', () => {
    const result = resolveLogoTemplate({
      brandName: 'NoStyle',
      count: 1,
    });

    expect(result.logoStyle).toBe('modern');
    expect(result.basePrompt).toContain(STYLE_PARAMS.modern.promptFragment);
  });

  it('should use the specified style when valid', () => {
    const result = resolveLogoTemplate({
      brandName: 'VintageTest',
      logoStyle: 'vintage',
      count: 1,
    });

    expect(result.logoStyle).toBe('vintage');
    expect(result.basePrompt).toContain(STYLE_PARAMS.vintage.promptFragment);
    expect(result.negativePrompt).toBe(STYLE_PARAMS.vintage.negative);
  });

  // ── Brand name in prompt ───────────────────────────────────────────

  it('should include the brand name in the base prompt', () => {
    const result = resolveLogoTemplate({
      brandName: 'My Unique Brand',
      logoStyle: 'bold',
      count: 1,
    });

    expect(result.basePrompt).toContain('Brand name: "My Unique Brand"');
    expect(result.brandName).toBe('My Unique Brand');
  });

  it('should include brand name in every variation prompt text', () => {
    const result = resolveLogoTemplate({
      brandName: 'EveryPrompt',
      logoStyle: 'minimal',
      count: 3,
    });

    for (const prompt of result.prompts) {
      expect(prompt.text).toContain('EveryPrompt');
    }
  });

  // ── Priority ordering ──────────────────────────────────────────────

  it('should prioritize icon, wordmark, combination first', () => {
    const result = resolveLogoTemplate({ ...baseParams, count: 3 });

    expect(result.prompts[0].variation).toBe('icon');
    expect(result.prompts[1].variation).toBe('wordmark');
    expect(result.prompts[2].variation).toBe('combination');
  });

  it('should follow full priority order: icon, wordmark, combination, emblem, lettermark, abstract', () => {
    const result = resolveLogoTemplate({ ...baseParams, count: 6 });

    expect(result.prompts.map((p) => p.variation)).toEqual([
      'icon',
      'wordmark',
      'combination',
      'emblem',
      'lettermark',
      'abstract',
    ]);
  });

  // ── Template metadata ──────────────────────────────────────────────

  it('should include metadata with version string', () => {
    const result = resolveLogoTemplate({ ...baseParams, count: 1 });

    expect(result.metadata).toBeDefined();
    expect(typeof result.metadata.templateVersion).toBe('string');
    expect(result.metadata.templateVersion).toBe('1.0.0');
  });

  it('should include variationCount in metadata matching actual prompts', () => {
    const result = resolveLogoTemplate({ ...baseParams, count: 3 });
    expect(result.metadata.variationCount).toBe(3);
    expect(result.metadata.variationCount).toBe(result.prompts.length);
  });

  it('should include styleParams in metadata', () => {
    const result = resolveLogoTemplate({ ...baseParams, count: 1 });
    expect(result.metadata.styleParams).toBeDefined();
    expect(result.metadata.styleParams.promptFragment).toBe(STYLE_PARAMS.modern.promptFragment);
  });

  // ── recraftParams and colors ───────────────────────────────────────

  it('should include colors from colorPalette in recraftParams', () => {
    const palette = ['#FF0000', '#00FF00', '#0000FF'];
    const result = resolveLogoTemplate({
      ...baseParams,
      colorPalette: palette,
      count: 1,
    });

    expect(result.recraftParams).toBeDefined();
    expect(result.recraftParams.colors).toEqual(palette);
    expect(result.recraftParams.image_size).toBe('square_hd');
  });

  it('should have empty colors array when no colorPalette provided', () => {
    const result = resolveLogoTemplate({ ...baseParams, count: 1 });
    expect(result.recraftParams.colors).toEqual([]);
  });

  // ── Optional fields ────────────────────────────────────────────────

  it('should include brand vision in base prompt when provided', () => {
    const result = resolveLogoTemplate({
      ...baseParams,
      brandVision: 'Empowering creators worldwide',
      count: 1,
    });

    expect(result.basePrompt).toContain('Brand vision: Empowering creators worldwide');
  });

  it('should include industry in base prompt when provided', () => {
    const result = resolveLogoTemplate({
      ...baseParams,
      industry: 'Health & Wellness',
      count: 1,
    });

    expect(result.basePrompt).toContain('Industry: Health & Wellness');
  });

  it('should not include vision or industry when not provided', () => {
    const result = resolveLogoTemplate({ ...baseParams, count: 1 });

    expect(result.basePrompt).not.toContain('Brand vision:');
    expect(result.basePrompt).not.toContain('Industry:');
  });

  // ── Typography guidance ────────────────────────────────────────────

  it('should add typography guidance for text-bearing variations', () => {
    const result = resolveLogoTemplate({ ...baseParams, count: 4 });

    // wordmark (index 1) and combination (index 2) should have typography
    const wordmarkPrompt = result.prompts.find((p) => p.variation === 'wordmark');
    const combinationPrompt = result.prompts.find((p) => p.variation === 'combination');
    expect(wordmarkPrompt.text).toContain('Typography:');
    expect(combinationPrompt.text).toContain('Typography:');
  });

  it('should not add typography guidance for icon-only variations', () => {
    const result = resolveLogoTemplate({
      ...baseParams,
      count: 1, // icon only
    });

    expect(result.prompts[0].variation).toBe('icon');
    expect(result.prompts[0].text).not.toContain('Typography:');
  });
});

// ── getArchetypeKeys ─────────────────────────────────────────────────────

describe('getArchetypeKeys', () => {
  it('should return an array of archetype key strings', () => {
    const keys = getArchetypeKeys();
    expect(Array.isArray(keys)).toBe(true);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(typeof key).toBe('string');
    }
  });

  it('should include known archetype keys', () => {
    const keys = getArchetypeKeys();
    expect(keys).toContain('the-hero');
    expect(keys).toContain('the-sage');
    expect(keys).toContain('the-creator');
    expect(keys).toContain('the-rebel');
  });

  it('should match ARCHETYPE_TRAITS keys', () => {
    const keys = getArchetypeKeys();
    expect(keys).toEqual(Object.keys(ARCHETYPE_TRAITS));
  });
});

// ── getStyleKeys ─────────────────────────────────────────────────────────

describe('getStyleKeys', () => {
  it('should return an array of style key strings', () => {
    const keys = getStyleKeys();
    expect(Array.isArray(keys)).toBe(true);
    expect(keys.length).toBeGreaterThan(0);
  });

  it('should include all known styles', () => {
    const keys = getStyleKeys();
    expect(keys).toContain('minimal');
    expect(keys).toContain('bold');
    expect(keys).toContain('vintage');
    expect(keys).toContain('modern');
    expect(keys).toContain('playful');
  });
});

// ── getRecommendedVariations ─────────────────────────────────────────────

describe('getRecommendedVariations', () => {
  it('should return icon + wordmark + combination first for count >= 3', () => {
    const variations = getRecommendedVariations(3);
    expect(variations).toEqual(['icon', 'wordmark', 'combination']);
  });

  it('should return only icon for count of 1', () => {
    const variations = getRecommendedVariations(1);
    expect(variations).toEqual(['icon']);
  });

  it('should return icon + wordmark for count of 2', () => {
    const variations = getRecommendedVariations(2);
    expect(variations).toEqual(['icon', 'wordmark']);
  });

  it('should cap at available variations for large count', () => {
    const variations = getRecommendedVariations(100);
    expect(variations).toHaveLength(LOGO_VARIATIONS.length);
  });

  it('should return string IDs', () => {
    const variations = getRecommendedVariations(4);
    for (const id of variations) {
      expect(typeof id).toBe('string');
    }
  });
});

// ── ARCHETYPE_TRAITS data integrity ──────────────────────────────────────

describe('ARCHETYPE_TRAITS', () => {
  it('should have adjectives, symbols, mood, and audience for every archetype', () => {
    for (const [key, traits] of Object.entries(ARCHETYPE_TRAITS)) {
      expect(Array.isArray(traits.adjectives), `${key} missing adjectives`).toBe(true);
      expect(traits.adjectives.length, `${key} should have adjectives`).toBeGreaterThan(0);
      expect(Array.isArray(traits.symbols), `${key} missing symbols`).toBe(true);
      expect(traits.symbols.length, `${key} should have symbols`).toBeGreaterThan(0);
      expect(typeof traits.mood, `${key} missing mood`).toBe('string');
      expect(typeof traits.audience, `${key} missing audience`).toBe('string');
    }
  });
});

// ── STYLE_PARAMS data integrity ──────────────────────────────────────────

describe('STYLE_PARAMS', () => {
  it('should have promptFragment, typography, composition, and negative for every style', () => {
    for (const [key, params] of Object.entries(STYLE_PARAMS)) {
      expect(typeof params.promptFragment, `${key} missing promptFragment`).toBe('string');
      expect(typeof params.typography, `${key} missing typography`).toBe('string');
      expect(typeof params.composition, `${key} missing composition`).toBe('string');
      expect(typeof params.negative, `${key} missing negative`).toBe('string');
    }
  });
});

// ── LOGO_VARIATIONS data integrity ───────────────────────────────────────

describe('LOGO_VARIATIONS', () => {
  it('should have unique IDs across all variations', () => {
    const ids = LOGO_VARIATIONS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should have unique priority values', () => {
    const priorities = LOGO_VARIATIONS.map((v) => v.priority);
    expect(new Set(priorities).size).toBe(priorities.length);
  });

  it('should have id, label, promptSuffix, and priority for every variation', () => {
    for (const variation of LOGO_VARIATIONS) {
      expect(typeof variation.id).toBe('string');
      expect(typeof variation.label).toBe('string');
      expect(typeof variation.promptSuffix).toBe('string');
      expect(typeof variation.priority).toBe('number');
    }
  });
});
