// server/src/__tests__/print-export-prompt.test.js
//
// Tests for the print export prompt composition logic.
// Since composePrintPrompt and resolveImageSize are module-private in the worker,
// we re-implement the same logic here as pure-function tests to verify the
// prompt template replacement, fallback composition, and print spec appending.
//
// This mirrors the exact logic from server/src/workers/print-export.js lines 39-108.
// If the worker's prompt logic changes, these tests should be updated accordingly.

import { describe, it, expect } from 'vitest';

// ── Extracted prompt composition logic (mirrors print-export.js) ─────

/**
 * Re-implemented composePrintPrompt for isolated unit testing.
 * This is an exact copy of the function in print-export.js.
 *
 * @param {Object} params
 * @param {Object} params.template
 * @param {Object} params.brand
 * @param {Object|null} params.product
 * @param {string|null} params.logoUrl
 * @param {string} params.format
 * @returns {string}
 */
function composePrintPrompt({ template, brand, product, logoUrl, format }) {
  const identity = brand.wizard_state?.['brand-identity'] || {};
  const colorPalette = identity.colors || identity.colorPalette || [];
  const brandVision = identity.vision || identity.brandVision || '';
  const brandName = brand.name || 'Brand';
  const productName = product?.name || 'Product';
  const colorPrimary = colorPalette[0] || '#000000';
  const colorSecondary = colorPalette[1] || colorPalette[0] || '#333333';
  const printSpecs = template.print_specs || {};
  const dpi = printSpecs.dpi || 300;

  if (template.ai_prompt_template) {
    let prompt = template.ai_prompt_template
      .replace(/\{\{brandName\}\}/g, brandName)
      .replace(/\{\{brandVision\}\}/g, brandVision)
      .replace(/\{\{colorPrimary\}\}/g, colorPrimary)
      .replace(/\{\{colorSecondary\}\}/g, colorSecondary)
      .replace(/\{\{productName\}\}/g, productName);

    prompt += ` Print-ready at ${dpi} DPI.`;
    if (printSpecs.bleed_mm) {
      prompt += ` Include ${printSpecs.bleed_mm}mm bleed area.`;
    }
    if (printSpecs.color_space) {
      prompt += ` Optimized for ${printSpecs.color_space} color space.`;
    }
    prompt += ' Ultra-high detail, crisp edges, professional packaging artwork.';

    return prompt;
  }

  let prompt = `Professional print-ready packaging artwork for "${productName}" by "${brandName}". `;
  prompt += `Template: ${template.name} (${template.category || 'packaging'}). `;
  prompt += `Brand colors: primary ${colorPrimary}, secondary ${colorSecondary}. `;

  if (brandVision) {
    prompt += `Brand vision: ${brandVision}. `;
  }

  const zones = template.branding_zones || [];
  for (const zone of zones) {
    if (zone.type === 'logo') {
      prompt += `The brand logo is prominently placed in the ${zone.label || 'center'} area. `;
    } else if (zone.type === 'text') {
      prompt += `"${brandName}" text appears in the ${zone.label || 'header'} area with clean typography. `;
    } else if (zone.type === 'color_fill') {
      prompt += `${zone.label || 'Background'} area uses brand color ${colorPrimary}. `;
    } else if (zone.type === 'product_image') {
      prompt += `Product image displayed in the ${zone.label || 'main'} area. `;
    }
  }

  if (template.template_width_px && template.template_height_px) {
    prompt += `Canvas: ${template.template_width_px}x${template.template_height_px}px. `;
  }

  prompt += `Print-ready at ${dpi} DPI.`;
  if (printSpecs.bleed_mm) {
    prompt += ` Include ${printSpecs.bleed_mm}mm bleed area.`;
  }
  if (printSpecs.color_space) {
    prompt += ` Optimized for ${printSpecs.color_space} color space.`;
  }
  prompt += ' Ultra-high detail, crisp edges, photorealistic professional packaging artwork. No text errors.';

  return prompt;
}

/**
 * Re-implemented resolveImageSize for isolated unit testing.
 */
function resolveImageSize(template) {
  const w = template.template_width_px || 1024;
  const h = template.template_height_px || 1024;
  const ratio = w / h;

  if (ratio > 1.2) return '1536x1024';
  if (ratio < 0.8) return '1024x1536';
  return '1024x1024';
}

// ── Fixtures ─────────────────────────────────────────────────────────

const baseBrand = {
  name: 'TestBrand',
  wizard_state: {
    'brand-identity': {
      colors: ['#FF6B35', '#004E98'],
      vision: 'Empowering creators to build amazing brands',
    },
  },
};

const baseProduct = {
  name: 'Premium Hoodie',
  category: 'apparel',
};

const baseTemplate = {
  name: 'Hoodie Packaging',
  category: 'apparel',
  ai_prompt_template: 'Design packaging for {{brandName}}, product: {{productName}}, primary color: {{colorPrimary}}, secondary: {{colorSecondary}}, vision: {{brandVision}}.',
  print_specs: {
    dpi: 300,
    bleed_mm: 3,
    color_space: 'CMYK',
  },
  branding_zones: [],
};

// ── Template placeholder replacement ─────────────────────────────────

describe('composePrintPrompt (template mode)', () => {
  it('should replace {{brandName}} placeholder', () => {
    const prompt = composePrintPrompt({
      template: baseTemplate,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('TestBrand');
    expect(prompt).not.toContain('{{brandName}}');
  });

  it('should replace {{productName}} placeholder', () => {
    const prompt = composePrintPrompt({
      template: baseTemplate,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('Premium Hoodie');
    expect(prompt).not.toContain('{{productName}}');
  });

  it('should replace {{colorPrimary}} placeholder', () => {
    const prompt = composePrintPrompt({
      template: baseTemplate,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('#FF6B35');
    expect(prompt).not.toContain('{{colorPrimary}}');
  });

  it('should replace {{colorSecondary}} placeholder', () => {
    const prompt = composePrintPrompt({
      template: baseTemplate,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('#004E98');
    expect(prompt).not.toContain('{{colorSecondary}}');
  });

  it('should replace {{brandVision}} placeholder', () => {
    const prompt = composePrintPrompt({
      template: baseTemplate,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('Empowering creators to build amazing brands');
    expect(prompt).not.toContain('{{brandVision}}');
  });

  it('should replace all placeholders including duplicates', () => {
    const templateWithDupes = {
      ...baseTemplate,
      ai_prompt_template: '{{brandName}} logo for {{brandName}} packaging of {{productName}}.',
    };

    const prompt = composePrintPrompt({
      template: templateWithDupes,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).not.toContain('{{brandName}}');
    expect(prompt.indexOf('TestBrand')).not.toBe(prompt.lastIndexOf('TestBrand'));
  });
});

// ── Print specs appending ────────────────────────────────────────────

describe('composePrintPrompt (print specs)', () => {
  it('should append DPI specification', () => {
    const prompt = composePrintPrompt({
      template: baseTemplate,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('Print-ready at 300 DPI.');
  });

  it('should append bleed area when bleed_mm is specified', () => {
    const prompt = composePrintPrompt({
      template: baseTemplate,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('Include 3mm bleed area.');
  });

  it('should append color space when specified', () => {
    const prompt = composePrintPrompt({
      template: baseTemplate,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('Optimized for CMYK color space.');
  });

  it('should default DPI to 300 when not specified in print_specs', () => {
    const templateNoDpi = {
      ...baseTemplate,
      print_specs: {},
    };

    const prompt = composePrintPrompt({
      template: templateNoDpi,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('Print-ready at 300 DPI.');
  });

  it('should not include bleed when not specified', () => {
    const templateNoBleed = {
      ...baseTemplate,
      print_specs: { dpi: 150 },
    };

    const prompt = composePrintPrompt({
      template: templateNoBleed,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).not.toContain('bleed area');
    expect(prompt).toContain('Print-ready at 150 DPI.');
  });

  it('should not include color space when not specified', () => {
    const templateNoCS = {
      ...baseTemplate,
      print_specs: { dpi: 300 },
    };

    const prompt = composePrintPrompt({
      template: templateNoCS,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).not.toContain('color space');
  });

  it('should end with ultra-high detail instruction (template mode)', () => {
    const prompt = composePrintPrompt({
      template: baseTemplate,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('Ultra-high detail, crisp edges, professional packaging artwork.');
  });
});

// ── Fallback prompt (no ai_prompt_template) ──────────────────────────

describe('composePrintPrompt (fallback mode)', () => {
  const fallbackTemplate = {
    name: 'Mug Packaging',
    category: 'drinkware',
    ai_prompt_template: null,
    print_specs: {
      dpi: 300,
      bleed_mm: 5,
      color_space: 'CMYK',
    },
    branding_zones: [
      { type: 'logo', label: 'top-center' },
      { type: 'text', label: 'bottom banner' },
      { type: 'color_fill', label: 'Side panel' },
      { type: 'product_image', label: 'front' },
    ],
    template_width_px: 2400,
    template_height_px: 1200,
  };

  it('should include product and brand name in fallback prompt', () => {
    const prompt = composePrintPrompt({
      template: fallbackTemplate,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('"Premium Hoodie"');
    expect(prompt).toContain('"TestBrand"');
  });

  it('should include template name and category', () => {
    const prompt = composePrintPrompt({
      template: fallbackTemplate,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('Template: Mug Packaging (drinkware)');
  });

  it('should include branding zone descriptions for logo zones', () => {
    const prompt = composePrintPrompt({
      template: fallbackTemplate,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('brand logo is prominently placed in the top-center area');
  });

  it('should include branding zone descriptions for text zones', () => {
    const prompt = composePrintPrompt({
      template: fallbackTemplate,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('"TestBrand" text appears in the bottom banner area');
  });

  it('should include branding zone descriptions for color_fill zones', () => {
    const prompt = composePrintPrompt({
      template: fallbackTemplate,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('Side panel area uses brand color #FF6B35');
  });

  it('should include branding zone descriptions for product_image zones', () => {
    const prompt = composePrintPrompt({
      template: fallbackTemplate,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('Product image displayed in the front area');
  });

  it('should include canvas dimensions when template has width and height', () => {
    const prompt = composePrintPrompt({
      template: fallbackTemplate,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('Canvas: 2400x1200px');
  });

  it('should include brand vision in fallback when available', () => {
    const prompt = composePrintPrompt({
      template: fallbackTemplate,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('Brand vision: Empowering creators to build amazing brands');
  });

  it('should use default zone labels when none provided', () => {
    const templateDefaults = {
      ...fallbackTemplate,
      branding_zones: [
        { type: 'logo' },
        { type: 'text' },
        { type: 'color_fill' },
        { type: 'product_image' },
      ],
    };

    const prompt = composePrintPrompt({
      template: templateDefaults,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('center area');
    expect(prompt).toContain('header area');
    expect(prompt).toContain('Background area');
    expect(prompt).toContain('main area');
  });

  it('should end with photorealistic packaging instruction (fallback mode)', () => {
    const prompt = composePrintPrompt({
      template: fallbackTemplate,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('photorealistic professional packaging artwork. No text errors.');
  });
});

// ── Edge cases / defaults ────────────────────────────────────────────

describe('composePrintPrompt (edge cases)', () => {
  it('should default brand name to "Brand" when not provided', () => {
    const prompt = composePrintPrompt({
      template: { ...baseTemplate, ai_prompt_template: null },
      brand: { name: null, wizard_state: {} },
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('"Brand"');
  });

  it('should default product name to "Product" when not provided', () => {
    const prompt = composePrintPrompt({
      template: { ...baseTemplate, ai_prompt_template: null },
      brand: baseBrand,
      product: null,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('"Product"');
  });

  it('should default primary color to #000000 when no palette', () => {
    const prompt = composePrintPrompt({
      template: { ...baseTemplate, ai_prompt_template: null },
      brand: { name: 'Test', wizard_state: {} },
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('primary #000000');
  });

  it('should default secondary color to primary when only one color', () => {
    const brandOneColor = {
      name: 'OneColor',
      wizard_state: {
        'brand-identity': { colors: ['#ABCDEF'] },
      },
    };

    const prompt = composePrintPrompt({
      template: { ...baseTemplate, ai_prompt_template: null },
      brand: brandOneColor,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('primary #ABCDEF');
    expect(prompt).toContain('secondary #ABCDEF');
  });

  it('should use colorPalette when colors key is not present', () => {
    const brandAltKey = {
      name: 'AltKey',
      wizard_state: {
        'brand-identity': { colorPalette: ['#112233', '#445566'] },
      },
    };

    const prompt = composePrintPrompt({
      template: { ...baseTemplate, ai_prompt_template: null },
      brand: brandAltKey,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('#112233');
    expect(prompt).toContain('#445566');
  });

  it('should use brandVision when vision key is not present', () => {
    const brandAltVision = {
      name: 'AltVision',
      wizard_state: {
        'brand-identity': { brandVision: 'Alternative vision statement' },
      },
    };

    const prompt = composePrintPrompt({
      template: { ...baseTemplate, ai_prompt_template: null },
      brand: brandAltVision,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('Alternative vision statement');
  });

  it('should default category to "packaging" in fallback when not specified', () => {
    const noCategoryTemplate = {
      name: 'Generic Template',
      ai_prompt_template: null,
      print_specs: {},
      branding_zones: [],
    };

    const prompt = composePrintPrompt({
      template: noCategoryTemplate,
      brand: baseBrand,
      product: baseProduct,
      logoUrl: null,
      format: 'pdf',
    });

    expect(prompt).toContain('(packaging)');
  });
});

// ── resolveImageSize ─────────────────────────────────────────────────

describe('resolveImageSize', () => {
  it('should return "1024x1024" for square templates', () => {
    expect(resolveImageSize({ template_width_px: 1024, template_height_px: 1024 })).toBe('1024x1024');
  });

  it('should return "1536x1024" for landscape templates (ratio > 1.2)', () => {
    expect(resolveImageSize({ template_width_px: 2400, template_height_px: 1200 })).toBe('1536x1024');
  });

  it('should return "1024x1536" for portrait templates (ratio < 0.8)', () => {
    expect(resolveImageSize({ template_width_px: 600, template_height_px: 1200 })).toBe('1024x1536');
  });

  it('should default to "1024x1024" when dimensions are not provided', () => {
    expect(resolveImageSize({})).toBe('1024x1024');
  });

  it('should return square for templates with ratio between 0.8 and 1.2', () => {
    // Ratio of 1.1 -- just under 1.2 threshold
    expect(resolveImageSize({ template_width_px: 1100, template_height_px: 1000 })).toBe('1024x1024');
    // Ratio of 0.9 -- just above 0.8 threshold
    expect(resolveImageSize({ template_width_px: 900, template_height_px: 1000 })).toBe('1024x1024');
  });
});
