// server/src/__tests__/validation.test.js
//
// Tests for the Zod validation schemas used by the wizard routes.

import { describe, it, expect } from 'vitest';
import {
  wizardStartSchema,
  wizardStepUpdateSchema,
  socialHandlesSchema,
  wizardResumeSchema,
  scrapeWebsiteSchema,
  customProductRequestSchema,
  personalityQuizSchema,
} from '../validation/wizard.js';

// ─── wizardStartSchema ────────────────────────────────────────────────────────

describe('wizardStartSchema', () => {
  it('should accept a valid brand name', () => {
    const result = wizardStartSchema.safeParse({ brand_name: 'My Brand' });
    expect(result.success).toBe(true);
  });

  it('should accept an empty object (brand_name is optional)', () => {
    const result = wizardStartSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept undefined brand_name', () => {
    const result = wizardStartSchema.safeParse({ brand_name: undefined });
    expect(result.success).toBe(true);
  });

  it('should reject brand_name that is too long (>100 chars)', () => {
    const result = wizardStartSchema.safeParse({ brand_name: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('should reject brand_name that is an empty string (min 1)', () => {
    const result = wizardStartSchema.safeParse({ brand_name: '' });
    expect(result.success).toBe(false);
  });

  it('should reject non-string brand_name', () => {
    const result = wizardStartSchema.safeParse({ brand_name: 12345 });
    expect(result.success).toBe(false);
  });
});

// ─── wizardStepUpdateSchema ───────────────────────────────────────────────────

describe('wizardStepUpdateSchema', () => {
  it('should accept valid step name and data', () => {
    const result = wizardStepUpdateSchema.safeParse({ step: 'brand-name', data: { name: 'test' } });
    expect(result.success).toBe(true);
  });

  it('should accept various step names', () => {
    const result = wizardStepUpdateSchema.safeParse({ step: 'brand-identity', data: {} });
    expect(result.success).toBe(true);
  });

  it('should reject empty step string', () => {
    const result = wizardStepUpdateSchema.safeParse({ step: '', data: {} });
    expect(result.success).toBe(false);
  });

  it('should reject numeric step', () => {
    const result = wizardStepUpdateSchema.safeParse({ step: 5, data: {} });
    expect(result.success).toBe(false);
  });

  it('should reject missing data field', () => {
    const result = wizardStepUpdateSchema.safeParse({ step: 'brand-name' });
    expect(result.success).toBe(false);
  });
});

// ─── socialHandlesSchema ──────────────────────────────────────────────────────

describe('socialHandlesSchema', () => {
  it('should accept valid social handles', () => {
    const result = socialHandlesSchema.safeParse({
      instagram: 'testuser',
      tiktok: 'testuser',
    });
    expect(result.success).toBe(true);
  });

  it('should accept all handles being optional (empty object)', () => {
    const result = socialHandlesSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept a single handle', () => {
    const result = socialHandlesSchema.safeParse({ youtube: 'channel' });
    expect(result.success).toBe(true);
  });

  it('should reject too-long handle (>100 chars)', () => {
    const result = socialHandlesSchema.safeParse({ instagram: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('should accept handles at exactly 100 chars', () => {
    const result = socialHandlesSchema.safeParse({ instagram: 'a'.repeat(100) });
    expect(result.success).toBe(true);
  });

  it('should reject non-string handle values', () => {
    const result = socialHandlesSchema.safeParse({ instagram: 12345 });
    expect(result.success).toBe(false);
  });
});

// ─── personalityQuizSchema ────────────────────────────────────────────────────

describe('personalityQuizSchema', () => {
  const validQuiz = {
    vibe: 'modern and minimalist',
    brandWords: ['bold', 'authentic', 'creative'],
    dreamCustomer: 'Young professionals aged 25-35 who value quality and sustainability',
    contentStyle: 'Educational with a touch of humor',
  };

  it('should accept valid personality quiz data', () => {
    const result = personalityQuizSchema.safeParse(validQuiz);
    expect(result.success).toBe(true);
  });

  it('should accept quiz data with optional colorPalette', () => {
    const result = personalityQuizSchema.safeParse({
      ...validQuiz,
      colorPalette: ['#FF0000', '#00FF00', '#0000FF'],
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing vibe field', () => {
    const { vibe, ...rest } = validQuiz;
    const result = personalityQuizSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should reject empty vibe string', () => {
    const result = personalityQuizSchema.safeParse({ ...validQuiz, vibe: '' });
    expect(result.success).toBe(false);
  });

  it('should reject missing brandWords', () => {
    const { brandWords, ...rest } = validQuiz;
    const result = personalityQuizSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should reject empty brandWords array', () => {
    const result = personalityQuizSchema.safeParse({ ...validQuiz, brandWords: [] });
    expect(result.success).toBe(false);
  });

  it('should reject brandWords with more than 10 items', () => {
    const result = personalityQuizSchema.safeParse({
      ...validQuiz,
      brandWords: Array.from({ length: 11 }, (_, i) => `word${i}`),
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing dreamCustomer', () => {
    const { dreamCustomer, ...rest } = validQuiz;
    const result = personalityQuizSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should reject missing contentStyle', () => {
    const { contentStyle, ...rest } = validQuiz;
    const result = personalityQuizSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// ─── customProductRequestSchema ───────────────────────────────────────────────

describe('customProductRequestSchema', () => {
  it('should accept valid product request', () => {
    const result = customProductRequestSchema.safeParse({
      description: 'A custom embroidered beanie',
      category: 'accessories',
      priceRange: '$25-50',
    });
    expect(result.success).toBe(true);
  });

  it('should accept all valid price ranges', () => {
    const ranges = ['$10-25', '$25-50', '$50-100', '$100+'];
    for (const priceRange of ranges) {
      const result = customProductRequestSchema.safeParse({
        description: 'A test product',
        category: 'apparel',
        priceRange,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid price range', () => {
    const result = customProductRequestSchema.safeParse({
      description: 'A test product',
      category: 'apparel',
      priceRange: '$5-10',
    });
    expect(result.success).toBe(false);
  });

  it('should reject too-short description (<5 chars)', () => {
    const result = customProductRequestSchema.safeParse({
      description: 'abc',
      category: 'apparel',
      priceRange: '$10-25',
    });
    expect(result.success).toBe(false);
  });

  it('should reject too-long description (>500 chars)', () => {
    const result = customProductRequestSchema.safeParse({
      description: 'a'.repeat(501),
      category: 'apparel',
      priceRange: '$10-25',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty category', () => {
    const result = customProductRequestSchema.safeParse({
      description: 'A test product',
      category: '',
      priceRange: '$10-25',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing fields', () => {
    const result = customProductRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── wizardResumeSchema ──────────────────────────────────────────────────────

describe('wizardResumeSchema', () => {
  it('should accept a valid resume token', () => {
    const result = wizardResumeSchema.safeParse({ token: 'abc123.hmac.signature' });
    expect(result.success).toBe(true);
  });

  it('should reject empty token', () => {
    const result = wizardResumeSchema.safeParse({ token: '' });
    expect(result.success).toBe(false);
  });

  it('should reject missing token', () => {
    const result = wizardResumeSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── scrapeWebsiteSchema ─────────────────────────────────────────────────────

describe('scrapeWebsiteSchema', () => {
  it('should accept a valid URL', () => {
    const result = scrapeWebsiteSchema.safeParse({ url: 'https://linktr.ee/testuser' });
    expect(result.success).toBe(true);
  });

  it('should reject empty URL', () => {
    const result = scrapeWebsiteSchema.safeParse({ url: '' });
    expect(result.success).toBe(false);
  });

  it('should reject too-long URL (>2048 chars)', () => {
    const result = scrapeWebsiteSchema.safeParse({ url: 'https://example.com/' + 'a'.repeat(2040) });
    expect(result.success).toBe(false);
  });

  it('should reject missing URL', () => {
    const result = scrapeWebsiteSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
