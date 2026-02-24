// server/src/skills/name-generator/tests/tools.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SuggestBrandNamesInput,
  CheckDomainAvailabilityInput,
  CheckTrademarkConflictsInput,
  SaveNameSuggestionsInput,
  SuggestBrandNamesOutput,
  CheckDomainAvailabilityOutput,
  CheckTrademarkConflictsOutput,
  SaveNameSuggestionsOutput,
  tools,
} from '../tools.js';

// ---- Tool Definitions ----------------------------------------------------

describe('tool definitions', () => {
  it('should export exactly 4 tools', () => {
    assert.equal(tools.length, 4);
  });

  it('should have correct tool names in order', () => {
    const names = tools.map((t) => t.name);
    assert.deepEqual(names, [
      'suggestBrandNames',
      'checkDomainAvailability',
      'checkTrademarkConflicts',
      'saveNameSuggestions',
    ]);
  });

  it('should have descriptions for all tools', () => {
    for (const tool of tools) {
      assert.ok(tool.description.length > 0, `Tool ${tool.name} should have a description`);
    }
  });

  it('should have input schemas for all tools', () => {
    for (const tool of tools) {
      assert.ok(tool.inputSchema, `Tool ${tool.name} should have an inputSchema`);
      assert.equal(typeof tool.inputSchema.parse, 'function', `Tool ${tool.name} inputSchema should be a Zod schema`);
    }
  });

  it('should have output schemas for all tools', () => {
    for (const tool of tools) {
      assert.ok(tool.outputSchema, `Tool ${tool.name} should have an outputSchema`);
      assert.equal(typeof tool.outputSchema.parse, 'function', `Tool ${tool.name} outputSchema should be a Zod schema`);
    }
  });
});

// ---- SuggestBrandNamesInput ----------------------------------------------

describe('SuggestBrandNamesInput', () => {
  it('should accept valid input with 5 suggestions', () => {
    const valid = {
      suggestions: Array.from({ length: 5 }, (_, i) => ({
        name: `Brand${i}`,
        strategy: 'descriptive',
        reasoning: 'A descriptive brand name that clearly communicates the brand purpose',
        confidenceScore: 0.8,
        pronunciationGuide: null,
        tagline: null,
      })),
    };

    const result = SuggestBrandNamesInput.safeParse(valid);
    assert.ok(result.success, 'Should parse valid input');
  });

  it('should accept valid input with 10 suggestions', () => {
    const valid = {
      suggestions: Array.from({ length: 10 }, (_, i) => ({
        name: `Brand${i}`,
        strategy: ['descriptive', 'evocative', 'compound', 'abstract', 'metaphorical', 'acronym', 'personal'][i % 7],
        reasoning: 'A well-reasoned brand name suggestion for this brand identity',
        confidenceScore: 0.5 + (i * 0.05),
        pronunciationGuide: i % 2 === 0 ? 'BRAND' : null,
        tagline: i % 3 === 0 ? 'Tag' : null,
      })),
    };

    const result = SuggestBrandNamesInput.safeParse(valid);
    assert.ok(result.success, 'Should parse valid 10-suggestion input');
  });

  it('should reject fewer than 5 suggestions', () => {
    const invalid = {
      suggestions: [
        { name: 'Brand1', strategy: 'descriptive', reasoning: 'Some sufficient reasoning for the name', confidenceScore: 0.8, pronunciationGuide: null, tagline: null },
      ],
    };

    const result = SuggestBrandNamesInput.safeParse(invalid);
    assert.ok(!result.success, 'Should reject < 5 suggestions');
  });

  it('should reject more than 10 suggestions', () => {
    const invalid = {
      suggestions: Array.from({ length: 11 }, (_, i) => ({
        name: `Brand${i}`,
        strategy: 'descriptive',
        reasoning: 'A reasonable reasoning string for the name',
        confidenceScore: 0.8,
        pronunciationGuide: null,
        tagline: null,
      })),
    };

    const result = SuggestBrandNamesInput.safeParse(invalid);
    assert.ok(!result.success, 'Should reject > 10 suggestions');
  });

  it('should accept all 7 naming strategies', () => {
    const strategies = ['descriptive', 'evocative', 'compound', 'abstract', 'metaphorical', 'acronym', 'personal'];

    for (const strategy of strategies) {
      const input = {
        suggestions: Array.from({ length: 5 }, () => ({
          name: 'TestBrand',
          strategy,
          reasoning: 'A valid reasoning for this particular naming strategy',
          confidenceScore: 0.8,
          pronunciationGuide: null,
          tagline: null,
        })),
      };

      const result = SuggestBrandNamesInput.safeParse(input);
      assert.ok(result.success, `Should accept strategy: ${strategy}`);
    }
  });

  it('should reject invalid strategy', () => {
    const invalid = {
      suggestions: Array.from({ length: 5 }, () => ({
        name: 'Brand',
        strategy: 'portmanteau', // not a valid PRD strategy
        reasoning: 'A valid reasoning for the name suggestion',
        confidenceScore: 0.8,
        pronunciationGuide: null,
        tagline: null,
      })),
    };

    const result = SuggestBrandNamesInput.safeParse(invalid);
    assert.ok(!result.success, 'Should reject invalid strategy');
  });

  it('should reject confidence scores outside 0-1 range', () => {
    const tooHigh = {
      suggestions: Array.from({ length: 5 }, () => ({
        name: 'Brand',
        strategy: 'descriptive',
        reasoning: 'A valid reasoning for the name suggestion',
        confidenceScore: 1.5,
        pronunciationGuide: null,
        tagline: null,
      })),
    };

    assert.ok(!SuggestBrandNamesInput.safeParse(tooHigh).success, 'Should reject score > 1');

    const tooLow = {
      suggestions: Array.from({ length: 5 }, () => ({
        name: 'Brand',
        strategy: 'descriptive',
        reasoning: 'A valid reasoning for the name suggestion',
        confidenceScore: -0.1,
        pronunciationGuide: null,
        tagline: null,
      })),
    };

    assert.ok(!SuggestBrandNamesInput.safeParse(tooLow).success, 'Should reject score < 0');
  });
});

// ---- CheckDomainAvailabilityInput ----------------------------------------

describe('CheckDomainAvailabilityInput', () => {
  it('should accept valid input', () => {
    const result = CheckDomainAvailabilityInput.safeParse({
      names: ['BrandOne', 'BrandTwo'],
      extensions: ['.com', '.io'],
    });
    assert.ok(result.success);
  });

  it('should provide default extensions', () => {
    const result = CheckDomainAvailabilityInput.safeParse({
      names: ['TestBrand'],
    });
    assert.ok(result.success);
    assert.deepEqual(result.data.extensions, ['.com', '.co', '.io', '.shop', '.store']);
  });

  it('should reject empty names array', () => {
    const result = CheckDomainAvailabilityInput.safeParse({
      names: [],
    });
    assert.ok(!result.success);
  });

  it('should reject more than 10 names', () => {
    const result = CheckDomainAvailabilityInput.safeParse({
      names: Array.from({ length: 11 }, (_, i) => `Brand${i}`),
    });
    assert.ok(!result.success);
  });
});

// ---- CheckTrademarkConflictsInput ----------------------------------------

describe('CheckTrademarkConflictsInput', () => {
  it('should accept valid input', () => {
    const result = CheckTrademarkConflictsInput.safeParse({
      names: ['BrandOne', 'BrandTwo'],
      industryCategory: 'wellness',
    });
    assert.ok(result.success);
  });

  it('should reject missing industryCategory', () => {
    const result = CheckTrademarkConflictsInput.safeParse({
      names: ['BrandOne'],
    });
    assert.ok(!result.success);
  });
});

// ---- SaveNameSuggestionsInput --------------------------------------------

describe('SaveNameSuggestionsInput', () => {
  it('should accept valid input with all fields', () => {
    const result = SaveNameSuggestionsInput.safeParse({
      brandId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '660e8400-e29b-41d4-a716-446655440000',
      suggestions: [
        {
          name: 'TestBrand',
          strategy: 'compound',
          reasoning: 'A compound name',
          confidenceScore: 0.85,
          pronunciationGuide: 'TEST-brand',
          tagline: 'Test tagline',
          domainAvailability: { '.com': true, '.io': false },
          trademarkRisk: 'low',
          trademarkNotes: 'No conflicts found.',
        },
      ],
    });
    assert.ok(result.success);
  });

  it('should reject invalid UUIDs', () => {
    const result = SaveNameSuggestionsInput.safeParse({
      brandId: 'not-a-uuid',
      userId: 'also-not-uuid',
      suggestions: [],
    });
    assert.ok(!result.success);
  });

  it('should accept nullable domain and trademark fields', () => {
    const result = SaveNameSuggestionsInput.safeParse({
      brandId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '660e8400-e29b-41d4-a716-446655440000',
      suggestions: [
        {
          name: 'TestBrand',
          strategy: 'abstract',
          reasoning: 'An abstract name',
          confidenceScore: 0.7,
          pronunciationGuide: null,
          tagline: null,
          domainAvailability: null,
          trademarkRisk: null,
          trademarkNotes: null,
        },
      ],
    });
    assert.ok(result.success);
  });
});

// ---- Output Schema Validation --------------------------------------------

describe('output schemas', () => {
  it('SuggestBrandNamesOutput should validate correct output', () => {
    const result = SuggestBrandNamesOutput.safeParse({
      success: true,
      suggestions: [
        { name: 'Brand', strategy: 'descriptive', reasoning: 'Good reason', confidenceScore: 0.9, pronunciationGuide: null, tagline: null },
      ],
    });
    assert.ok(result.success);
  });

  it('CheckDomainAvailabilityOutput should validate correct output', () => {
    const result = CheckDomainAvailabilityOutput.safeParse({
      success: true,
      results: {
        'Brand': { '.com': true, '.io': false },
      },
      error: null,
    });
    assert.ok(result.success);
  });

  it('CheckTrademarkConflictsOutput should validate correct output', () => {
    const result = CheckTrademarkConflictsOutput.safeParse({
      success: true,
      results: {
        'Brand': { risk: 'low', notes: 'No conflicts', similarMarks: [] },
      },
      error: null,
    });
    assert.ok(result.success);
  });

  it('CheckTrademarkConflictsOutput should accept all risk levels', () => {
    for (const risk of ['low', 'medium', 'high', 'unknown']) {
      const result = CheckTrademarkConflictsOutput.safeParse({
        success: true,
        results: {
          'Brand': { risk, notes: 'Test', similarMarks: [] },
        },
        error: null,
      });
      assert.ok(result.success, `Should accept risk level: ${risk}`);
    }
  });

  it('SaveNameSuggestionsOutput should validate correct output', () => {
    const result = SaveNameSuggestionsOutput.safeParse({
      success: true,
      brandId: '550e8400-e29b-41d4-a716-446655440000',
      savedCount: 7,
      error: null,
    });
    assert.ok(result.success);
  });
});
