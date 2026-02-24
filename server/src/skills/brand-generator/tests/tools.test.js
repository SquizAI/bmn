// server/src/skills/brand-generator/tests/tools.test.js

import { describe, it, expect } from 'vitest';
import {
  GenerateBrandVisionInput,
  GenerateColorPaletteInput,
  GenerateTypographyInput,
  SaveBrandIdentityInput,
  BrandVisionOutput,
  ColorPaletteOutput,
  TypographyOutput,
  SaveBrandIdentityOutput,
  tools,
} from '../tools.js';

// ─── GenerateBrandVisionInput Schema ─────────────────────────────

describe('GenerateBrandVisionInput schema', () => {
  const validInput = {
    brandName: 'Sage & Soul',
    vision: 'Empowering mindful living through accessible wellness products rooted in nature.',
    mission: 'To make holistic wellness accessible and beautiful.',
    archetype: 'The Caregiver',
    secondaryArchetype: 'The Sage',
    values: ['mindfulness', 'authenticity', 'sustainability'],
    targetAudience: 'Health-conscious women aged 25-40 who follow wellness content.',
    voiceTone: 'Warm, encouraging, and grounded.',
    differentiator: 'Combines community trust with professionally branded products.',
  };

  it('should accept valid input', () => {
    const result = GenerateBrandVisionInput.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should accept null brandName', () => {
    const result = GenerateBrandVisionInput.safeParse({ ...validInput, brandName: null });
    expect(result.success).toBe(true);
  });

  it('should accept null secondaryArchetype', () => {
    const result = GenerateBrandVisionInput.safeParse({ ...validInput, secondaryArchetype: null });
    expect(result.success).toBe(true);
  });

  it('should reject invalid archetype', () => {
    const result = GenerateBrandVisionInput.safeParse({ ...validInput, archetype: 'The Pirate' });
    expect(result.success).toBe(false);
  });

  it('should reject too short vision', () => {
    const result = GenerateBrandVisionInput.safeParse({ ...validInput, vision: 'Short' });
    expect(result.success).toBe(false);
  });

  it('should reject fewer than 3 values', () => {
    const result = GenerateBrandVisionInput.safeParse({ ...validInput, values: ['one', 'two'] });
    expect(result.success).toBe(false);
  });

  it('should reject more than 5 values', () => {
    const result = GenerateBrandVisionInput.safeParse({
      ...validInput,
      values: ['a', 'b', 'c', 'd', 'e', 'f'],
    });
    expect(result.success).toBe(false);
  });

  it('should accept all 12 valid archetypes', () => {
    const archetypes = [
      'The Innocent', 'The Explorer', 'The Sage', 'The Hero',
      'The Outlaw', 'The Magician', 'The Everyperson', 'The Lover',
      'The Jester', 'The Caregiver', 'The Creator', 'The Ruler',
    ];
    for (const archetype of archetypes) {
      const result = GenerateBrandVisionInput.safeParse({ ...validInput, archetype });
      expect(result.success).toBe(true);
    }
  });
});

// ─── GenerateColorPaletteInput Schema ────────────────────────────

describe('GenerateColorPaletteInput schema', () => {
  const validInput = {
    colors: [
      { hex: '#2D5F2B', name: 'Forest Sage', role: 'primary' },
      { hex: '#F4A261', name: 'Golden Hour', role: 'secondary' },
      { hex: '#E76F51', name: 'Terracotta Glow', role: 'accent' },
      { hex: '#FAF3E8', name: 'Warm Linen', role: 'background' },
      { hex: '#FFFFFF', name: 'Clean White', role: 'surface' },
      { hex: '#2C2C2C', name: 'Charcoal', role: 'text' },
    ],
    mood: 'Warm and earthy with a natural feel',
    inspiration: 'Derived from earth tones in the social analysis',
  };

  it('should accept valid input with exactly 6 colors', () => {
    const result = GenerateColorPaletteInput.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should reject fewer than 6 colors', () => {
    const result = GenerateColorPaletteInput.safeParse({
      ...validInput,
      colors: validInput.colors.slice(0, 5),
    });
    expect(result.success).toBe(false);
  });

  it('should reject more than 6 colors', () => {
    const result = GenerateColorPaletteInput.safeParse({
      ...validInput,
      colors: [...validInput.colors, { hex: '#000000', name: 'Extra', role: 'primary' }],
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid hex codes', () => {
    const result = GenerateColorPaletteInput.safeParse({
      ...validInput,
      colors: [
        ...validInput.colors.slice(0, 5),
        { hex: 'not-a-hex', name: 'Bad', role: 'text' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('should reject 3-digit hex codes', () => {
    const result = GenerateColorPaletteInput.safeParse({
      ...validInput,
      colors: [
        ...validInput.colors.slice(0, 5),
        { hex: '#FFF', name: 'Short', role: 'text' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid color roles', () => {
    const result = GenerateColorPaletteInput.safeParse({
      ...validInput,
      colors: [
        ...validInput.colors.slice(0, 5),
        { hex: '#000000', name: 'Bad Role', role: 'tertiary' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('should accept all 6 valid color roles', () => {
    const roles = ['primary', 'secondary', 'accent', 'background', 'surface', 'text'];
    const colors = roles.map((role) => ({ hex: '#000000', name: `Color ${role}`, role }));
    const result = GenerateColorPaletteInput.safeParse({
      ...validInput,
      colors,
    });
    expect(result.success).toBe(true);
  });
});

// ─── GenerateTypographyInput Schema ──────────────────────────────

describe('GenerateTypographyInput schema', () => {
  const validInput = {
    primary: {
      fontFamily: 'Playfair Display',
      weight: '700',
      style: 'serif',
      reason: 'Elegant serif for headings.',
    },
    secondary: {
      fontFamily: 'Inter',
      weight: '400',
      style: 'sans-serif',
      reason: 'Clean sans-serif for body text.',
    },
    pairingRationale: 'Serif headings with sans-serif body creates visual hierarchy.',
  };

  it('should accept valid input', () => {
    const result = GenerateTypographyInput.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should reject missing primary fontFamily', () => {
    const { fontFamily, ...rest } = validInput.primary;
    const result = GenerateTypographyInput.safeParse({
      ...validInput,
      primary: rest,
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing secondary', () => {
    const { secondary, ...rest } = validInput;
    const result = GenerateTypographyInput.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should reject missing pairingRationale', () => {
    const { pairingRationale, ...rest } = validInput;
    const result = GenerateTypographyInput.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// ─── SaveBrandIdentityInput Schema ───────────────────────────────

describe('SaveBrandIdentityInput schema', () => {
  it('should accept valid UUIDs', () => {
    const result = SaveBrandIdentityInput.safeParse({
      brandId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      vision: { some: 'data' },
      colorPalette: { some: 'data' },
      typography: { some: 'data' },
    });
    expect(result.success).toBe(true);
  });

  it('should reject non-UUID brandId', () => {
    const result = SaveBrandIdentityInput.safeParse({
      brandId: 'not-a-uuid',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      vision: {},
      colorPalette: {},
      typography: {},
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-UUID userId', () => {
    const result = SaveBrandIdentityInput.safeParse({
      brandId: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'not-a-uuid',
      vision: {},
      colorPalette: {},
      typography: {},
    });
    expect(result.success).toBe(false);
  });
});

// ─── Output Schemas ──────────────────────────────────────────────

describe('BrandVisionOutput schema', () => {
  it('should accept valid output', () => {
    const result = BrandVisionOutput.safeParse({
      success: true,
      vision: {
        brandName: 'Sage & Soul',
        vision: 'A vision statement.',
        mission: 'A mission statement.',
        archetype: 'The Caregiver',
        secondaryArchetype: null,
        values: ['one', 'two', 'three'],
        targetAudience: 'Target audience.',
        voiceTone: 'Warm tone.',
        differentiator: 'What makes it unique.',
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('ColorPaletteOutput schema', () => {
  it('should accept valid output', () => {
    const result = ColorPaletteOutput.safeParse({
      success: true,
      palette: {
        colors: [
          { hex: '#2D5F2B', name: 'Forest', role: 'primary' },
        ],
        mood: 'Earthy',
        inspiration: 'Social data',
      },
    });
    expect(result.success).toBe(true);
  });

  it('should accept output with contrastWarnings', () => {
    const result = ColorPaletteOutput.safeParse({
      success: true,
      palette: {
        colors: [{ hex: '#000000', name: 'Black', role: 'text' }],
        mood: 'Dark',
        inspiration: 'Night',
      },
      contrastWarnings: ['Low contrast'],
    });
    expect(result.success).toBe(true);
  });
});

describe('TypographyOutput schema', () => {
  it('should accept valid output', () => {
    const result = TypographyOutput.safeParse({
      success: true,
      typography: {
        primary: { fontFamily: 'Playfair Display', weight: '700', style: 'serif', reason: 'Elegant' },
        secondary: { fontFamily: 'Inter', weight: '400', style: 'sans-serif', reason: 'Clean' },
        pairingRationale: 'Good contrast',
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('SaveBrandIdentityOutput schema', () => {
  it('should accept success output', () => {
    const result = SaveBrandIdentityOutput.safeParse({
      success: true,
      brandId: '550e8400-e29b-41d4-a716-446655440000',
      identity: { vision: {}, colorPalette: {}, typography: {} },
      error: null,
    });
    expect(result.success).toBe(true);
  });

  it('should accept error output', () => {
    const result = SaveBrandIdentityOutput.safeParse({
      success: false,
      brandId: '550e8400-e29b-41d4-a716-446655440000',
      identity: { vision: {}, colorPalette: {}, typography: {} },
      error: 'Database connection failed',
    });
    expect(result.success).toBe(true);
  });
});

// ─── Tool Definitions Array ──────────────────────────────────────

describe('tools array', () => {
  it('should export exactly 4 tools', () => {
    expect(tools).toHaveLength(4);
  });

  it('should define generateBrandVision as first tool', () => {
    expect(tools[0].name).toBe('generateBrandVision');
    expect(tools[0].inputSchema).toBe(GenerateBrandVisionInput);
    expect(tools[0].outputSchema).toBe(BrandVisionOutput);
  });

  it('should define generateColorPalette as second tool', () => {
    expect(tools[1].name).toBe('generateColorPalette');
    expect(tools[1].inputSchema).toBe(GenerateColorPaletteInput);
    expect(tools[1].outputSchema).toBe(ColorPaletteOutput);
  });

  it('should define generateTypography as third tool', () => {
    expect(tools[2].name).toBe('generateTypography');
    expect(tools[2].inputSchema).toBe(GenerateTypographyInput);
    expect(tools[2].outputSchema).toBe(TypographyOutput);
  });

  it('should define saveBrandIdentity as fourth tool', () => {
    expect(tools[3].name).toBe('saveBrandIdentity');
    expect(tools[3].inputSchema).toBe(SaveBrandIdentityInput);
    expect(tools[3].outputSchema).toBe(SaveBrandIdentityOutput);
  });

  it('should have descriptions for all tools', () => {
    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });
});
