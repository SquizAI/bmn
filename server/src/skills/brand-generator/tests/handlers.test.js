// server/src/skills/brand-generator/tests/handlers.test.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateBrandVision,
  generateColorPalette,
  generateTypography,
  saveBrandIdentity,
  calculateContrastRatio,
  getRelativeLuminance,
} from '../handlers.js';

// ─── Mock Supabase ───────────────────────────────────────────────

const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) });
const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table) => {
      if (table === 'brands') return { update: mockUpdate };
      if (table === 'audit_log') return { insert: mockInsert };
      return {};
    },
  }),
}));

// ─── Mock fetch for Google Fonts validation ──────────────────────

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── WCAG Contrast Helpers ───────────────────────────────────────

describe('calculateContrastRatio', () => {
  it('should return 21:1 for black on white', () => {
    const ratio = calculateContrastRatio('#000000', '#FFFFFF');
    expect(ratio).toBeGreaterThanOrEqual(20);
    expect(ratio).toBeLessThanOrEqual(21.1);
  });

  it('should return 1:1 for same color', () => {
    const ratio = calculateContrastRatio('#FF5733', '#FF5733');
    expect(ratio).toBe(1);
  });

  it('should be commutative (order independent)', () => {
    const ratio1 = calculateContrastRatio('#2C2C2C', '#FAF3E8');
    const ratio2 = calculateContrastRatio('#FAF3E8', '#2C2C2C');
    expect(ratio1).toBe(ratio2);
  });

  it('should identify passing WCAG AA contrast (>= 4.5:1)', () => {
    // Dark text on light background should pass
    const ratio = calculateContrastRatio('#2C2C2C', '#FFFFFF');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('should identify failing WCAG AA contrast (< 4.5:1)', () => {
    // Light gray text on white background should fail
    const ratio = calculateContrastRatio('#AAAAAA', '#FFFFFF');
    expect(ratio).toBeLessThan(4.5);
  });
});

describe('getRelativeLuminance', () => {
  it('should return 0 for black', () => {
    expect(getRelativeLuminance('#000000')).toBe(0);
  });

  it('should return 1 for white', () => {
    expect(getRelativeLuminance('#FFFFFF')).toBe(1);
  });

  it('should return value between 0 and 1', () => {
    const lum = getRelativeLuminance('#2D5F2B');
    expect(lum).toBeGreaterThanOrEqual(0);
    expect(lum).toBeLessThanOrEqual(1);
  });
});

// ─── generateBrandVision ─────────────────────────────────────────

describe('generateBrandVision', () => {
  const validInput = {
    brandName: 'Sage & Soul',
    vision: 'Empowering mindful living through accessible wellness products rooted in nature.',
    mission: 'To make holistic wellness accessible and beautiful for the modern creator.',
    archetype: 'The Caregiver',
    secondaryArchetype: 'The Sage',
    values: ['mindfulness', 'authenticity', 'sustainability', 'community'],
    targetAudience: 'Health-conscious women aged 25-40 who follow wellness content on Instagram.',
    voiceTone: 'Warm, encouraging, and grounded.',
    differentiator: 'Combines existing wellness community trust with professionally branded products.',
  };

  it('should return structured vision with success: true', async () => {
    const result = await generateBrandVision(validInput);
    expect(result.success).toBe(true);
    expect(result.vision).toBeDefined();
    expect(result.vision.archetype).toBe('The Caregiver');
    expect(result.vision.values).toEqual(validInput.values);
  });

  it('should handle null brandName', async () => {
    const result = await generateBrandVision({ ...validInput, brandName: null });
    expect(result.vision.brandName).toBeNull();
  });

  it('should handle null secondaryArchetype', async () => {
    const result = await generateBrandVision({ ...validInput, secondaryArchetype: null });
    expect(result.vision.secondaryArchetype).toBeNull();
  });

  it('should preserve all input fields in output', async () => {
    const result = await generateBrandVision(validInput);
    expect(result.vision.vision).toBe(validInput.vision);
    expect(result.vision.mission).toBe(validInput.mission);
    expect(result.vision.targetAudience).toBe(validInput.targetAudience);
    expect(result.vision.voiceTone).toBe(validInput.voiceTone);
    expect(result.vision.differentiator).toBe(validInput.differentiator);
  });
});

// ─── generateColorPalette ────────────────────────────────────────

describe('generateColorPalette', () => {
  const validInput = {
    colors: [
      { hex: '#2D5F2B', name: 'Forest Sage', role: 'primary' },
      { hex: '#F4A261', name: 'Golden Hour', role: 'secondary' },
      { hex: '#E76F51', name: 'Terracotta Glow', role: 'accent' },
      { hex: '#FAF3E8', name: 'Warm Linen', role: 'background' },
      { hex: '#FFFFFF', name: 'Clean White', role: 'surface' },
      { hex: '#2C2C2C', name: 'Charcoal', role: 'text' },
    ],
    mood: 'Warm, earthy, and inviting',
    inspiration: 'Derived from the creator\'s dominant earth tones and warm photography style',
  };

  it('should return success with valid palette', async () => {
    const result = await generateColorPalette(validInput);
    expect(result.success).toBe(true);
    expect(result.palette.colors).toHaveLength(6);
    expect(result.palette.mood).toBe(validInput.mood);
  });

  it('should NOT include contrastWarnings when contrast is good', async () => {
    const result = await generateColorPalette(validInput);
    // Dark text (#2C2C2C) on light background (#FAF3E8) should pass
    expect(result.contrastWarnings).toBeUndefined();
  });

  it('should include contrastWarnings when text/background contrast fails', async () => {
    const lowContrastInput = {
      ...validInput,
      colors: [
        ...validInput.colors.slice(0, 3),
        { hex: '#CCCCCC', name: 'Light Gray', role: 'background' },
        { hex: '#FFFFFF', name: 'White', role: 'surface' },
        { hex: '#AAAAAA', name: 'Medium Gray', role: 'text' },
      ],
    };
    const result = await generateColorPalette(lowContrastInput);
    expect(result.contrastWarnings).toBeDefined();
    expect(result.contrastWarnings.length).toBeGreaterThan(0);
    expect(result.contrastWarnings.some((w) => w.includes('WCAG AA'))).toBe(true);
  });

  it('should warn about missing color roles', async () => {
    const missingRoleInput = {
      ...validInput,
      colors: [
        { hex: '#2D5F2B', name: 'Forest Sage', role: 'primary' },
        { hex: '#F4A261', name: 'Golden Hour', role: 'secondary' },
        { hex: '#E76F51', name: 'Terracotta Glow', role: 'accent' },
        { hex: '#FAF3E8', name: 'Warm Linen', role: 'background' },
        { hex: '#FFFFFF', name: 'Clean White', role: 'primary' }, // duplicate primary, missing surface
        { hex: '#2C2C2C', name: 'Charcoal', role: 'text' },
      ],
    };
    const result = await generateColorPalette(missingRoleInput);
    expect(result.contrastWarnings).toBeDefined();
    expect(result.contrastWarnings.some((w) => w.includes('Missing required color role: surface'))).toBe(true);
  });

  it('should preserve all 6 colors in output', async () => {
    const result = await generateColorPalette(validInput);
    expect(result.palette.colors).toEqual(validInput.colors);
  });
});

// ─── generateTypography ──────────────────────────────────────────

describe('generateTypography', () => {
  const validInput = {
    primary: {
      fontFamily: 'Playfair Display',
      weight: '700',
      style: 'serif',
      reason: 'Elegant serif conveys wisdom and warmth.',
    },
    secondary: {
      fontFamily: 'Inter',
      weight: '400',
      style: 'sans-serif',
      reason: 'Clean, highly legible sans-serif for body text.',
    },
    pairingRationale: 'Serif headings + sans-serif body creates a classic editorial feel.',
  };

  it('should return success with valid typography (mocking Google Fonts API)', async () => {
    // Mock successful Google Fonts response
    const mockFontsData = {
      familyMetadataList: [
        { family: 'Playfair Display', category: 'serif' },
        { family: 'Inter', category: 'sans-serif' },
      ],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `)]}'\n${JSON.stringify(mockFontsData)}`,
    });

    const result = await generateTypography(validInput);
    expect(result.success).toBe(true);
    expect(result.typography.primary.fontFamily).toBe('Playfair Display');
    expect(result.typography.secondary.fontFamily).toBe('Inter');
    expect(result.fontWarnings).toBeUndefined();
  });

  it('should warn about fonts not found on Google Fonts', async () => {
    const mockFontsData = {
      familyMetadataList: [
        { family: 'Inter', category: 'sans-serif' },
        // Playfair Display intentionally missing
      ],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `)]}'\n${JSON.stringify(mockFontsData)}`,
    });

    const result = await generateTypography(validInput);
    expect(result.fontWarnings).toBeDefined();
    expect(result.fontWarnings.some((w) => w.includes('Playfair Display'))).toBe(true);
  });

  it('should gracefully handle Google Fonts API failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await generateTypography(validInput);
    // Should not fail; should return success with no warnings
    expect(result.success).toBe(true);
    expect(result.fontWarnings).toBeUndefined();
  });

  it('should warn when primary and secondary fonts are identical', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const sameFont = {
      ...validInput,
      primary: { fontFamily: 'Inter', weight: '700', style: 'sans-serif', reason: 'test' },
      secondary: { fontFamily: 'Inter', weight: '400', style: 'sans-serif', reason: 'test' },
    };
    const result = await generateTypography(sameFont);
    expect(result.fontWarnings).toBeDefined();
    expect(result.fontWarnings.some((w) => w.includes('identical'))).toBe(true);
  });

  it('should preserve pairing rationale in output', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await generateTypography(validInput);
    expect(result.typography.pairingRationale).toBe(validInput.pairingRationale);
  });
});

// ─── saveBrandIdentity ───────────────────────────────────────────

describe('saveBrandIdentity', () => {
  const validInput = {
    brandId: '550e8400-e29b-41d4-a716-446655440000',
    userId: '550e8400-e29b-41d4-a716-446655440001',
    vision: {
      vision: {
        brandName: 'Sage & Soul',
        vision: 'Empowering mindful living.',
        mission: 'Make wellness accessible.',
        archetype: 'The Caregiver',
        secondaryArchetype: 'The Sage',
        values: ['mindfulness', 'authenticity'],
        targetAudience: 'Health-conscious women aged 25-40.',
        voiceTone: 'Warm and encouraging.',
        differentiator: 'Community trust + professional products.',
      },
    },
    colorPalette: {
      palette: {
        colors: [
          { hex: '#2D5F2B', name: 'Forest Sage', role: 'primary' },
          { hex: '#F4A261', name: 'Golden Hour', role: 'secondary' },
          { hex: '#E76F51', name: 'Terracotta Glow', role: 'accent' },
          { hex: '#FAF3E8', name: 'Warm Linen', role: 'background' },
          { hex: '#FFFFFF', name: 'Clean White', role: 'surface' },
          { hex: '#2C2C2C', name: 'Charcoal', role: 'text' },
        ],
        mood: 'Warm and earthy',
        inspiration: 'Social data',
      },
    },
    typography: {
      typography: {
        primary: { fontFamily: 'Playfair Display', weight: '700', style: 'serif', reason: 'Elegant' },
        secondary: { fontFamily: 'Inter', weight: '400', style: 'sans-serif', reason: 'Clean' },
        pairingRationale: 'Classic editorial feel.',
      },
    },
  };

  it('should return success when Supabase save succeeds', async () => {
    const result = await saveBrandIdentity(validInput);
    expect(result.success).toBe(true);
    expect(result.brandId).toBe(validInput.brandId);
    expect(result.error).toBeNull();
    expect(result.identity.vision).toBeDefined();
    expect(result.identity.colorPalette).toBeDefined();
    expect(result.identity.typography).toBeDefined();
  });

  it('should return identity data even on save failure', async () => {
    // Mock a Supabase error
    mockUpdate.mockReturnValueOnce({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'RLS policy violation' } }),
      }),
    });

    const result = await saveBrandIdentity(validInput);
    expect(result.success).toBe(false);
    expect(result.error).toBe('RLS policy violation');
    // Identity data should still be returned (not lost)
    expect(result.identity.vision).toBeDefined();
    expect(result.identity.colorPalette).toBeDefined();
    expect(result.identity.typography).toBeDefined();
  });

  it('should handle thrown exceptions gracefully', async () => {
    mockUpdate.mockImplementationOnce(() => {
      throw new Error('Connection timeout');
    });

    const result = await saveBrandIdentity(validInput);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection timeout');
    expect(result.identity).toBeDefined();
  });
});
