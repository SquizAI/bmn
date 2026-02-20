import { useState, useCallback } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Types ───────────────────────────────────────────────────────

interface ColorEntry {
  hex: string;
  name: string;
  role: string;
}

interface BrandStyleGuidePdfProps {
  brandName: string;
  vision?: string;
  archetype?: string;
  values?: string[];
  targetAudience?: string;
  voiceTone?: string;
  taglines?: string[];
  colorPalette: ColorEntry[];
  fonts?: { heading: string; body: string; accent?: string };
  logoUrl?: string;
  onExportStart?: () => void;
  onExportComplete?: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  const num = parseInt(cleaned, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function formatRgb(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
}

/** Determine if text on a swatch should be white or dark. */
function contrastTextColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#1a1a2e' : '#ffffff';
}

async function imageToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Return archetype-aware sample copy snippets. */
function sampleCopy(archetype: string | undefined, brandName: string) {
  const arch = (archetype || '').toLowerCase();
  const archetypeCopy: Record<string, { caption: string; product: string; email: string }> = {
    creator: {
      caption: `Every piece tells a story. ${brandName} is where imagination meets intention. What are you creating today?`,
      product: `Crafted for the creative spirit. This ${brandName} essential is designed for those who see the world differently and aren't afraid to show it.`,
      email: `Your next creative breakthrough starts here, ${brandName} style`,
    },
    hero: {
      caption: `Rise above the ordinary. ${brandName} was built for those who lead from the front. Your moment is now.`,
      product: `Engineered for peak performance. Every ${brandName} product is battle-tested and built to help you conquer your goals.`,
      email: `${brandName}: Gear up for your next victory`,
    },
    sage: {
      caption: `Knowledge is the ultimate luxury. ${brandName} curates wisdom for the modern thinker. What truth are you seeking?`,
      product: `Thoughtfully designed with purpose. This ${brandName} piece embodies the pursuit of deeper understanding and mindful living.`,
      email: `Discover the insight behind ${brandName}'s latest collection`,
    },
    rebel: {
      caption: `Rules were made to be rewritten. ${brandName} doesn't follow trends -- we set them. Are you in?`,
      product: `Unapologetically bold. This ${brandName} essential is for those who refuse to blend in and live life on their own terms.`,
      email: `${brandName} just dropped something the industry isn't ready for`,
    },
    explorer: {
      caption: `The journey is the destination. ${brandName} is your companion for the uncharted path ahead. Where will you go next?`,
      product: `Built for the boundless. Every ${brandName} product is designed to keep up with your next adventure, wherever it leads.`,
      email: `New territory awaits -- explore ${brandName}'s latest`,
    },
    lover: {
      caption: `Beauty lives in the details. ${brandName} celebrates the art of connection and the elegance of everyday moments.`,
      product: `Indulge in the exquisite. This ${brandName} piece is a love letter to quality, sensuality, and refined taste.`,
      email: `Fall in love with ${brandName}'s newest arrivals`,
    },
    jester: {
      caption: `Life's too short for boring brands. ${brandName} brings the energy, the laughs, and the good vibes. Ready to play?`,
      product: `Fun is not optional. This ${brandName} essential brings joy, personality, and a whole lot of character to your everyday.`,
      email: `${brandName} just made your day -- open this`,
    },
    caregiver: {
      caption: `Taking care is a superpower. ${brandName} is here to nurture, support, and uplift -- because you deserve it.`,
      product: `Made with heart. Every ${brandName} product is designed with your wellbeing at the center, because caring matters.`,
      email: `${brandName} cares: something special just for you`,
    },
    magician: {
      caption: `Transform the ordinary into extraordinary. ${brandName} turns vision into reality, one moment at a time.`,
      product: `Where transformation begins. This ${brandName} piece is crafted to help you unlock your most extraordinary self.`,
      email: `The magic of ${brandName} -- a new chapter begins`,
    },
    ruler: {
      caption: `Excellence is non-negotiable. ${brandName} sets the standard for those who demand the best in everything they do.`,
      product: `Command attention. This ${brandName} essential is crafted for leaders who accept nothing less than exceptional quality.`,
      email: `${brandName}: The new standard in premium quality`,
    },
    everyperson: {
      caption: `Real people, real style. ${brandName} is designed for the everyday moments that matter most. Welcome home.`,
      product: `Honest quality for real life. This ${brandName} product is built with authenticity, comfort, and everyday value in mind.`,
      email: `${brandName}: Made for people like you`,
    },
    innocent: {
      caption: `Simplicity is the ultimate sophistication. ${brandName} believes in the beauty of pure, honest, uncomplicated living.`,
      product: `Pure and simple. This ${brandName} essential is crafted with clean ingredients, honest materials, and wholesome intention.`,
      email: `Start fresh with ${brandName}'s purest collection yet`,
    },
  };

  return (
    archetypeCopy[arch] || {
      caption: `Welcome to ${brandName} -- where your story meets style. This is just the beginning.`,
      product: `Designed with intention. Every ${brandName} product reflects a commitment to quality, identity, and authentic self-expression.`,
      email: `Something new from ${brandName} just landed`,
    }
  );
}

// ── Build the print-friendly HTML document ──────────────────────

function buildStyleGuideHtml(
  props: BrandStyleGuidePdfProps,
  logoBase64: string | null,
): string {
  const {
    brandName,
    vision,
    archetype,
    values,
    targetAudience,
    voiceTone,
    taglines,
    colorPalette,
    fonts,
  } = props;

  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const primaryColor = colorPalette[0]?.hex || '#B8956A';
  const secondaryColor = colorPalette[1]?.hex || '#1a1a2e';
  const accentColor = colorPalette[2]?.hex || '#d4a574';
  const primaryTextColor = contrastTextColor(primaryColor);

  const headingFont = fonts?.heading || 'Inter';
  const bodyFont = fonts?.body || 'Inter';
  const accentFont = fonts?.accent;

  const copy = sampleCopy(archetype, brandName);

  // Google Fonts link for heading and body fonts (best effort)
  const fontFamilies = [headingFont, bodyFont, ...(accentFont ? [accentFont] : [])]
    .filter((f, i, arr) => arr.indexOf(f) === i)
    .map((f) => f.replace(/\s+/g, '+'))
    .join('&family=');
  const googleFontsLink = `https://fonts.googleapis.com/css2?family=${fontFamilies}:wght@300;400;500;600;700;800&display=swap`;

  // Usage guidelines based on role labels
  const usageGuidelines = colorPalette.map((c) => {
    const roleLower = c.role.toLowerCase();
    if (roleLower.includes('primary'))
      return { ...c, usage: 'Use for headlines, CTAs, and key brand elements' };
    if (roleLower.includes('secondary'))
      return { ...c, usage: 'Use for backgrounds, supporting elements, and containers' };
    if (roleLower.includes('accent'))
      return { ...c, usage: 'Use for highlights, icons, and interactive states' };
    if (roleLower.includes('neutral') || roleLower.includes('background'))
      return { ...c, usage: 'Use for backgrounds, borders, and subtle dividers' };
    if (roleLower.includes('text') || roleLower.includes('dark'))
      return { ...c, usage: 'Use for body text and dark UI elements' };
    return { ...c, usage: `Use as ${c.role.toLowerCase()} color in brand materials` };
  });

  // Logo HTML
  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" alt="${brandName} Logo" style="max-width:200px;max-height:120px;object-fit:contain;" />`
    : null;

  // Archetype description mapping
  const archetypeDescriptions: Record<string, string> = {
    creator:
      'The Creator archetype is driven by innovation and self-expression. Brands with this archetype inspire imagination and empower others to bring their visions to life.',
    hero: 'The Hero archetype is courageous and determined. Brands with this archetype inspire mastery, prove their worth through bold action, and empower customers to overcome challenges.',
    sage: 'The Sage archetype seeks truth and wisdom. Brands with this archetype position themselves as trusted experts and thought leaders, guiding customers to deeper understanding.',
    rebel:
      'The Rebel archetype challenges the status quo. Brands with this archetype disrupt industries, break conventions, and attract those who value independence and revolution.',
    explorer:
      'The Explorer archetype craves freedom and discovery. Brands with this archetype inspire adventure, curiosity, and the pursuit of new experiences.',
    lover:
      'The Lover archetype celebrates beauty, intimacy, and connection. Brands with this archetype evoke passion, sensuality, and aesthetic refinement.',
    jester:
      'The Jester archetype brings joy and levity. Brands with this archetype use humor, playfulness, and irreverence to create memorable, feel-good experiences.',
    caregiver:
      'The Caregiver archetype nurtures and protects. Brands with this archetype build trust through compassion, generosity, and a commitment to their customers\u2019 wellbeing.',
    magician:
      'The Magician archetype transforms and inspires wonder. Brands with this archetype create transformative experiences that make the impossible feel achievable.',
    ruler:
      'The Ruler archetype commands authority and excellence. Brands with this archetype set industry standards, project prestige, and attract those who demand the best.',
    everyperson:
      'The Everyperson archetype is relatable and genuine. Brands with this archetype build belonging through authenticity, humility, and accessible quality.',
    innocent:
      'The Innocent archetype embodies purity and optimism. Brands with this archetype offer simplicity, honesty, and a wholesome vision of the good life.',
  };

  const archetypeDesc = archetype
    ? archetypeDescriptions[archetype.toLowerCase()] ||
      `The ${archetype} archetype defines the core personality of your brand, shaping how it communicates, connects, and creates value for its audience.`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${brandName} - Brand Style Guide</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${googleFontsLink}" rel="stylesheet" />
  <style>
    @page {
      size: letter;
      margin: 0.75in;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: '${bodyFont}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1a1a2e;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 13px;
      line-height: 1.6;
    }

    .page {
      width: 8.5in;
      min-height: 11in;
      padding: 0.75in;
      page-break-after: always;
      position: relative;
      overflow: hidden;
    }

    .page:last-child {
      page-break-after: auto;
    }

    /* ── Page 1: Cover ───────────────────────────── */

    .cover {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      background: linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 100%);
      color: #fff;
    }

    .cover-accent-bar {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 6px;
      background: linear-gradient(to right, ${primaryColor}, ${secondaryColor}, ${accentColor});
    }

    .cover-label {
      font-size: 11px;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: ${primaryColor};
      margin-bottom: 16px;
    }

    .cover-logo {
      margin-bottom: 32px;
    }

    .cover-brand-name {
      font-family: '${headingFont}', sans-serif;
      font-size: 56px;
      font-weight: 800;
      line-height: 1.1;
      letter-spacing: -1px;
      margin-bottom: 16px;
      background: linear-gradient(135deg, #fff 0%, ${primaryColor} 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .cover-subtitle {
      font-size: 18px;
      font-weight: 300;
      letter-spacing: 6px;
      text-transform: uppercase;
      color: #9ca3af;
      margin-bottom: 48px;
    }

    .cover-palette-strip {
      display: flex;
      gap: 4px;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 48px;
    }

    .cover-palette-chip {
      width: 48px;
      height: 8px;
    }

    .cover-date {
      position: absolute;
      bottom: 1in;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 11px;
      color: #6b7280;
    }

    .cover-branding {
      position: absolute;
      bottom: 0.6in;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 10px;
      color: ${primaryColor};
      letter-spacing: 1px;
    }

    /* ── Page headers ────────────────────────────── */

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 2px solid #e5e7eb;
    }

    .page-header h2 {
      font-family: '${headingFont}', sans-serif;
      font-size: 20px;
      font-weight: 700;
    }

    .page-header .page-num {
      font-size: 11px;
      color: #9ca3af;
    }

    .section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #6b7280;
      margin-bottom: 12px;
      margin-top: 24px;
    }

    .section-title:first-child {
      margin-top: 0;
    }

    /* ── Info blocks ──────────────────────────────── */

    .info-block {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }

    .info-block-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #9ca3af;
      margin-bottom: 4px;
    }

    .info-block-value {
      font-family: '${headingFont}', sans-serif;
      font-size: 15px;
      font-weight: 600;
      color: #1a1a2e;
    }

    .info-block-desc {
      font-size: 13px;
      color: #4b5563;
      margin-top: 6px;
      line-height: 1.6;
    }

    /* ── Color swatches ──────────────────────────── */

    .color-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .color-card {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      overflow: hidden;
    }

    .color-swatch {
      height: 80px;
      display: flex;
      align-items: flex-end;
      padding: 8px 12px;
    }

    .color-swatch-role {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .color-info {
      padding: 10px 12px;
      background: #fff;
    }

    .color-name {
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 4px;
    }

    .color-codes {
      font-family: 'SF Mono', SFMono-Regular, ui-monospace, Menlo, monospace;
      font-size: 11px;
      color: #6b7280;
      line-height: 1.6;
    }

    /* ── Usage rules ─────────────────────────────── */

    .rules-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 16px;
    }

    .rule-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 14px;
    }

    .rule-card.do {
      border-left: 3px solid #16a34a;
    }

    .rule-card.dont {
      border-left: 3px solid #dc2626;
    }

    .rule-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }

    .rule-label.do { color: #16a34a; }
    .rule-label.dont { color: #dc2626; }

    .rule-item {
      font-size: 12px;
      color: #4b5563;
      padding: 3px 0;
      line-height: 1.5;
    }

    /* ── Typography specimens ─────────────────────── */

    .type-specimen {
      margin-bottom: 20px;
    }

    .type-row {
      display: flex;
      align-items: baseline;
      gap: 16px;
      padding: 10px 0;
      border-bottom: 1px solid #f3f4f6;
    }

    .type-meta {
      flex-shrink: 0;
      width: 110px;
      text-align: right;
    }

    .type-meta-size {
      font-size: 11px;
      font-weight: 600;
      color: #9ca3af;
    }

    .type-meta-label {
      font-size: 9px;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .type-sample {
      flex: 1;
      color: #1a1a2e;
    }

    .type-rule-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin-top: 16px;
    }

    .type-rule-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 14px;
      text-align: center;
    }

    .type-rule-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #9ca3af;
      margin-bottom: 6px;
    }

    .type-rule-value {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a2e;
    }

    /* ── Voice & Tone ────────────────────────────── */

    .sample-copy-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
    }

    .sample-copy-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: ${primaryColor};
      font-weight: 600;
      margin-bottom: 6px;
    }

    .sample-copy-text {
      font-size: 13px;
      color: #1a1a2e;
      line-height: 1.6;
      font-style: italic;
    }

    .tagline-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .tagline-item {
      font-family: '${headingFont}', sans-serif;
      font-size: 16px;
      font-weight: 600;
      padding: 10px 16px;
      border-left: 3px solid ${primaryColor};
      margin-bottom: 8px;
      background: #f9fafb;
      border-radius: 0 8px 8px 0;
    }

    /* ── Logo usage ──────────────────────────────── */

    .logo-display {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 40px;
      margin-bottom: 24px;
      min-height: 180px;
    }

    .logo-placeholder {
      text-align: center;
      color: #9ca3af;
    }

    .logo-placeholder-text {
      font-size: 13px;
      margin-top: 12px;
    }

    .clearspace-diagram {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 24px;
    }

    .clearspace-box {
      position: relative;
      padding: 32px;
      border: 2px dashed ${primaryColor};
      border-radius: 8px;
      background: #fff;
    }

    .clearspace-label {
      position: absolute;
      font-size: 9px;
      color: ${primaryColor};
      font-weight: 600;
      letter-spacing: 1px;
    }

    .clearspace-top { top: 4px; left: 50%; transform: translateX(-50%); }
    .clearspace-bottom { bottom: 4px; left: 50%; transform: translateX(-50%); }
    .clearspace-left { left: 4px; top: 50%; transform: translateY(-50%) rotate(-90deg); }
    .clearspace-right { right: 4px; top: 50%; transform: translateY(-50%) rotate(90deg); }

    .logo-dont-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 16px;
    }

    .logo-dont-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }

    .logo-dont-visual {
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
      font-size: 12px;
      font-weight: 700;
      color: #9ca3af;
    }

    .logo-dont-label {
      font-size: 11px;
      color: #dc2626;
      font-weight: 600;
    }

    /* ── Tags ─────────────────────────────────────── */

    .tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .tag {
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 999px;
      padding: 4px 12px;
      font-size: 11px;
      color: #4b5563;
    }

    /* ── Footer ───────────────────────────────────── */

    .page-footer {
      position: absolute;
      bottom: 0.5in;
      left: 0.75in;
      right: 0.75in;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #9ca3af;
      border-top: 1px solid #e5e7eb;
      padding-top: 8px;
    }

    .two-col {
      display: flex;
      gap: 24px;
    }

    .two-col > div {
      flex: 1;
    }

    @media print {
      body { background: #fff; }
      .page { margin: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <!-- PAGE 1: COVER -->
  <div class="page cover">
    <div class="cover-accent-bar"></div>

    <div class="cover-label">Brand Style Guide</div>

    ${logoHtml ? `<div class="cover-logo">${logoHtml}</div>` : ''}

    <div class="cover-brand-name">${brandName}</div>
    <div class="cover-subtitle">Style Guide</div>

    <div class="cover-palette-strip">
      ${colorPalette.map((c) => `<div class="cover-palette-chip" style="background:${c.hex};"></div>`).join('')}
    </div>

    <div class="cover-date">Generated ${generatedDate}</div>
    <div class="cover-branding">brandmenow.ai</div>
  </div>

  <!-- PAGE 2: BRAND STORY -->
  <div class="page">
    <div class="page-header">
      <h2>Brand Story</h2>
      <span class="page-num">Page 2 of 6</span>
    </div>

    ${vision ? `
    <div class="section-title">Brand Vision</div>
    <div class="info-block">
      <div class="info-block-desc" style="font-size:14px;color:#1a1a2e;line-height:1.7;">${vision}</div>
    </div>
    ` : ''}

    ${archetype ? `
    <div class="section-title">Brand Archetype</div>
    <div class="info-block">
      <div class="info-block-value" style="text-transform:capitalize;color:${primaryColor};font-size:18px;">${archetype}</div>
      ${archetypeDesc ? `<div class="info-block-desc">${archetypeDesc}</div>` : ''}
    </div>
    ` : ''}

    ${values && values.length > 0 ? `
    <div class="section-title">Core Values</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      ${values.map((v, i) => `
      <div class="info-block" style="margin-bottom:0;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:${primaryColor};color:${primaryTextColor};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">${i + 1}</div>
          <div class="info-block-value" style="font-size:14px;text-transform:capitalize;">${v}</div>
        </div>
      </div>
      `).join('')}
    </div>
    ` : ''}

    ${targetAudience ? `
    <div class="section-title">Target Audience</div>
    <div class="info-block">
      <div class="info-block-desc" style="font-size:13px;color:#1a1a2e;">${targetAudience}</div>
    </div>
    ` : ''}

    <div class="page-footer">
      <span>${brandName} - Brand Style Guide</span>
      <span>brandmenow.ai</span>
    </div>
  </div>

  <!-- PAGE 3: COLOR SYSTEM -->
  <div class="page">
    <div class="page-header">
      <h2>Color System</h2>
      <span class="page-num">Page 3 of 6</span>
    </div>

    <div class="section-title">Brand Palette</div>
    <div class="color-grid">
      ${colorPalette.map((c) => `
      <div class="color-card">
        <div class="color-swatch" style="background-color:${c.hex};">
          <span class="color-swatch-role" style="color:${contrastTextColor(c.hex)};">${c.role}</span>
        </div>
        <div class="color-info">
          <div class="color-name">${c.name}</div>
          <div class="color-codes">
            HEX: ${c.hex.toUpperCase()}<br/>
            RGB: ${formatRgb(c.hex)}
          </div>
        </div>
      </div>
      `).join('')}
    </div>

    ${usageGuidelines.length > 0 ? `
    <div class="section-title">Usage Guidelines</div>
    ${usageGuidelines.map((c) => `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
      <div style="flex-shrink:0;width:20px;height:20px;border-radius:4px;background:${c.hex};border:1px solid #e5e7eb;"></div>
      <div style="font-size:12px;">
        <span style="font-weight:600;">${c.name}:</span>
        <span style="color:#6b7280;"> ${c.usage}</span>
      </div>
    </div>
    `).join('')}
    ` : ''}

    <div class="rules-grid">
      <div class="rule-card do">
        <div class="rule-label do">Do</div>
        <div class="rule-item">Use the primary color for headlines and CTAs</div>
        <div class="rule-item">Maintain sufficient contrast ratios (4.5:1 minimum)</div>
        <div class="rule-item">Use neutral tones for large background areas</div>
        <div class="rule-item">Apply accent color sparingly for emphasis</div>
      </div>
      <div class="rule-card dont">
        <div class="rule-label dont">Don't</div>
        <div class="rule-item">Use accent colors for body text</div>
        <div class="rule-item">Combine multiple brand colors at full saturation</div>
        <div class="rule-item">Alter the hex values of the brand palette</div>
        <div class="rule-item">Use colors not in the approved palette</div>
      </div>
    </div>

    <div class="page-footer">
      <span>${brandName} - Brand Style Guide</span>
      <span>brandmenow.ai</span>
    </div>
  </div>

  <!-- PAGE 4: TYPOGRAPHY -->
  <div class="page">
    <div class="page-header">
      <h2>Typography</h2>
      <span class="page-num">Page 4 of 6</span>
    </div>

    <div class="section-title">Heading Font &mdash; ${headingFont}</div>
    <div class="type-specimen">
      <div class="type-row">
        <div class="type-meta">
          <div class="type-meta-size">48px</div>
          <div class="type-meta-label">H1</div>
        </div>
        <div class="type-sample" style="font-family:'${headingFont}',sans-serif;font-size:48px;font-weight:800;line-height:1.1;">
          ${brandName}
        </div>
      </div>
      <div class="type-row">
        <div class="type-meta">
          <div class="type-meta-size">36px</div>
          <div class="type-meta-label">H2</div>
        </div>
        <div class="type-sample" style="font-family:'${headingFont}',sans-serif;font-size:36px;font-weight:700;line-height:1.2;">
          Brand Identity
        </div>
      </div>
      <div class="type-row">
        <div class="type-meta">
          <div class="type-meta-size">24px</div>
          <div class="type-meta-label">H3</div>
        </div>
        <div class="type-sample" style="font-family:'${headingFont}',sans-serif;font-size:24px;font-weight:600;line-height:1.3;">
          Section Heading
        </div>
      </div>
    </div>

    <div class="section-title">Body Font &mdash; ${bodyFont}</div>
    <div class="info-block">
      <div style="font-family:'${bodyFont}',sans-serif;font-size:16px;line-height:1.7;color:#1a1a2e;">
        The quick brown fox jumps over the lazy dog. This sample paragraph demonstrates the body typeface at 16px, the recommended size for comfortable reading across digital and print contexts. Good typography creates visual hierarchy, improves readability, and reinforces the brand personality in every piece of communication.
      </div>
    </div>

    ${accentFont ? `
    <div class="section-title">Accent Font &mdash; ${accentFont}</div>
    <div class="info-block">
      <div style="font-family:'${accentFont}',sans-serif;font-size:18px;line-height:1.5;color:${primaryColor};">
        For special moments, pull quotes, and decorative text.
      </div>
    </div>
    ` : ''}

    <div class="section-title">Font Pairing Rationale</div>
    <div class="info-block">
      <div class="info-block-desc">
        ${headingFont === bodyFont
          ? `<strong>${headingFont}</strong> is used as a unified typeface across all contexts. Weight variation (Bold for headings, Regular for body) creates clear hierarchy while maintaining a cohesive, streamlined visual identity.`
          : `<strong>${headingFont}</strong> for headings paired with <strong>${bodyFont}</strong> for body text creates a balanced contrast. The heading font commands attention and conveys brand personality, while the body font ensures comfortable readability for longer content.${accentFont ? ` <strong>${accentFont}</strong> adds a distinctive touch for pull quotes and callouts.` : ''}`
        }
      </div>
    </div>

    <div class="section-title">Usage Rules</div>
    <div class="type-rule-grid">
      <div class="type-rule-card">
        <div class="type-rule-label">Headlines</div>
        <div class="type-rule-value" style="font-family:'${headingFont}',sans-serif;">${headingFont} Bold</div>
      </div>
      <div class="type-rule-card">
        <div class="type-rule-label">Body Copy</div>
        <div class="type-rule-value" style="font-family:'${bodyFont}',sans-serif;">${bodyFont} Regular</div>
      </div>
      <div class="type-rule-card">
        <div class="type-rule-label">Captions</div>
        <div class="type-rule-value" style="font-family:'${bodyFont}',sans-serif;font-weight:300;">${bodyFont} Light</div>
      </div>
    </div>

    <div class="page-footer">
      <span>${brandName} - Brand Style Guide</span>
      <span>brandmenow.ai</span>
    </div>
  </div>

  <!-- PAGE 5: VOICE & TONE -->
  <div class="page">
    <div class="page-header">
      <h2>Voice &amp; Tone</h2>
      <span class="page-num">Page 5 of 6</span>
    </div>

    ${voiceTone ? `
    <div class="section-title">Brand Voice</div>
    <div class="info-block">
      <div class="info-block-desc" style="font-size:14px;color:#1a1a2e;line-height:1.7;">${voiceTone}</div>
    </div>
    ` : ''}

    ${archetype ? `
    <div class="section-title">Tone Characteristics</div>
    <div class="info-block">
      <div class="info-block-label">Driven by the ${archetype} archetype</div>
      <div class="info-block-desc">
        The brand voice should consistently reflect the ${archetype.toLowerCase()} personality across all touchpoints.
        Every piece of content should feel intentional, authentic, and aligned with the brand's core identity.
      </div>
    </div>
    ` : ''}

    <div class="section-title">Sample Copy</div>

    <div class="sample-copy-card">
      <div class="sample-copy-label">Instagram Caption</div>
      <div class="sample-copy-text">${copy.caption}</div>
    </div>

    <div class="sample-copy-card">
      <div class="sample-copy-label">Product Description</div>
      <div class="sample-copy-text">${copy.product}</div>
    </div>

    <div class="sample-copy-card">
      <div class="sample-copy-label">Email Subject Line</div>
      <div class="sample-copy-text">${copy.email}</div>
    </div>

    <div class="rules-grid" style="margin-top:20px;">
      <div class="rule-card do">
        <div class="rule-label do">Voice Do's</div>
        <div class="rule-item">Be authentic and consistent across all channels</div>
        <div class="rule-item">Speak directly to your audience's aspirations</div>
        <div class="rule-item">Use the brand's archetype as a compass for tone</div>
        <div class="rule-item">Match energy to the platform context</div>
      </div>
      <div class="rule-card dont">
        <div class="rule-label dont">Voice Don'ts</div>
        <div class="rule-item">Use jargon that alienates your audience</div>
        <div class="rule-item">Switch tone drastically between platforms</div>
        <div class="rule-item">Over-promise or use hyperbolic claims</div>
        <div class="rule-item">Copy competitors' voice or messaging style</div>
      </div>
    </div>

    ${taglines && taglines.length > 0 ? `
    <div class="section-title">Tagline Options</div>
    <ul class="tagline-list">
      ${taglines.map((t) => `<li class="tagline-item">"${t}"</li>`).join('')}
    </ul>
    ` : ''}

    <div class="page-footer">
      <span>${brandName} - Brand Style Guide</span>
      <span>brandmenow.ai</span>
    </div>
  </div>

  <!-- PAGE 6: LOGO USAGE -->
  <div class="page">
    <div class="page-header">
      <h2>Logo Usage</h2>
      <span class="page-num">Page 6 of 6</span>
    </div>

    <div class="section-title">Primary Logo</div>
    <div class="logo-display">
      ${logoHtml
        ? logoHtml
        : `<div class="logo-placeholder">
            <div style="font-size:48px;color:#d1d5db;">&#9634;</div>
            <div class="logo-placeholder-text">Logo will be added after the logo generation step</div>
          </div>`
      }
    </div>

    ${logoHtml ? `
    <div class="section-title">Clear Space</div>
    <div class="clearspace-diagram">
      <div class="clearspace-box">
        <span class="clearspace-label clearspace-top">X</span>
        <span class="clearspace-label clearspace-bottom">X</span>
        <span class="clearspace-label clearspace-left">X</span>
        <span class="clearspace-label clearspace-right">X</span>
        ${logoHtml}
      </div>
    </div>
    <div class="info-block">
      <div class="info-block-desc" style="text-align:center;">
        Maintain a clear space of at least <strong>X</strong> (the height of the logo mark) around all sides of the logo. This ensures the logo maintains visual impact and legibility in all contexts.
      </div>
    </div>
    ` : ''}

    <div class="section-title">Minimum Size</div>
    <div class="info-block">
      <div class="info-block-desc">
        Never display the logo smaller than <strong>32px</strong> in height for digital applications, or <strong>0.5 inches</strong> for print. Below this threshold, details become illegible and the brand impression is weakened.
      </div>
    </div>

    <div class="section-title">Logo Restrictions</div>
    <div class="logo-dont-grid">
      <div class="logo-dont-card">
        <div class="logo-dont-visual" style="transform:scaleX(1.4) scaleY(0.7);">
          ${brandName.substring(0, 3).toUpperCase()}
        </div>
        <div class="logo-dont-label">Don't stretch or distort</div>
      </div>
      <div class="logo-dont-card">
        <div class="logo-dont-visual" style="transform:rotate(15deg);">
          ${brandName.substring(0, 3).toUpperCase()}
        </div>
        <div class="logo-dont-label">Don't rotate the logo</div>
      </div>
      <div class="logo-dont-card">
        <div class="logo-dont-visual" style="color:#bef264;">
          ${brandName.substring(0, 3).toUpperCase()}
        </div>
        <div class="logo-dont-label">Don't change brand colors</div>
      </div>
    </div>

    <div class="rules-grid" style="margin-top:20px;">
      <div class="rule-card do">
        <div class="rule-label do">Logo Do's</div>
        <div class="rule-item">Use the logo on light or dark backgrounds with adequate contrast</div>
        <div class="rule-item">Maintain the original aspect ratio at all times</div>
        <div class="rule-item">Use the provided logo files (SVG or high-res PNG)</div>
      </div>
      <div class="rule-card dont">
        <div class="rule-label dont">Logo Don'ts</div>
        <div class="rule-item">Add drop shadows, outlines, or effects to the logo</div>
        <div class="rule-item">Place the logo on busy backgrounds that reduce clarity</div>
        <div class="rule-item">Recreate or approximate the logo with other fonts</div>
      </div>
    </div>

    <div class="page-footer">
      <span>${brandName} - Brand Style Guide</span>
      <span>brandmenow.ai</span>
    </div>
  </div>

</body>
</html>`;
}

// ── Main Component ──────────────────────────────────────────────

export default function BrandStyleGuidePdf({
  brandName,
  vision,
  archetype,
  values,
  targetAudience,
  voiceTone,
  taglines,
  colorPalette,
  fonts,
  logoUrl,
  onExportStart,
  onExportComplete,
}: BrandStyleGuidePdfProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleExport = useCallback(async () => {
    setIsGenerating(true);
    onExportStart?.();

    try {
      // Attempt to load logo as base64 for embedding
      let logoBase64: string | null = null;
      if (logoUrl) {
        logoBase64 = await imageToBase64(logoUrl);
      }

      const html = buildStyleGuideHtml(
        {
          brandName,
          vision,
          archetype,
          values,
          targetAudience,
          voiceTone,
          taglines,
          colorPalette,
          fonts,
          logoUrl,
        },
        logoBase64,
      );

      // Open a new window with the style guide and trigger print (Save as PDF)
      const printWindow = window.open('', '_blank', 'width=816,height=1056');
      if (!printWindow) {
        console.error('Failed to open print window. Pop-ups may be blocked.');
        return;
      }

      printWindow.document.write(html);
      printWindow.document.close();

      // Wait for fonts & content to render, then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          onExportComplete?.();
        }, 800);
      };

      // Fallback if onload doesn't fire (some browsers)
      setTimeout(() => {
        try {
          if (!printWindow.closed) {
            printWindow.print();
          }
        } catch {
          // Window may have been closed by user
        }
        onExportComplete?.();
      }, 3000);
    } catch (err) {
      console.error('Failed to generate style guide:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [
    brandName,
    vision,
    archetype,
    values,
    targetAudience,
    voiceTone,
    taglines,
    colorPalette,
    fonts,
    logoUrl,
    onExportStart,
    onExportComplete,
  ]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      loading={isGenerating}
      leftIcon={!isGenerating ? <FileText className="h-4 w-4" /> : undefined}
    >
      {isGenerating ? 'Generating...' : 'Download Style Guide'}
    </Button>
  );
}

export type { BrandStyleGuidePdfProps };
