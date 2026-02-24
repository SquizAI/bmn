// server/src/data/logo-templates.js

/**
 * Logo Style Templates -- JSON-driven system for consistent AI logo generation.
 *
 * Each template defines:
 *   - promptBase: Core prompt fragment for this archetype × style combo
 *   - composition: Layout rules (symmetry, weight, density)
 *   - typography: Font style guidance for text-bearing logos
 *   - iconGuidance: Symbol/shape guidance for icon-bearing logos
 *   - recraftParams: Direct Recraft V4 API parameters (style_id, substyle_id)
 *   - variations: Which logo types to generate (icon, wordmark, combination, etc.)
 *   - negativePrompt: Things to avoid in generation
 *
 * Recraft V4 style IDs:
 *   - "logo"          : General logo style
 *   - "icon"          : App/brand icon
 *   - "web_illustration" : Illustrative style
 *
 * Generation flow:
 *   1. Resolve template from (archetype, logoStyle) pair
 *   2. Inject brand-specific tokens (name, colors, vision)
 *   3. Select variation set based on count
 *   4. Build per-variation prompts from template + variation rules
 *   5. Pass to Recraft V4 with template's recraftParams
 */

// ── Archetype Definitions ──────────────────────────────────────

/**
 * Brand archetype personality traits for prompt enrichment.
 * @type {Record<string, { adjectives: string[], symbols: string[], mood: string, audience: string }>}
 */
export const ARCHETYPE_TRAITS = {
  'the-hero': {
    adjectives: ['bold', 'powerful', 'courageous', 'determined', 'strong'],
    symbols: ['shield', 'mountain', 'lightning', 'eagle', 'arrow', 'flame'],
    mood: 'empowering and triumphant',
    audience: 'ambitious achievers who want to push boundaries',
  },
  'the-sage': {
    adjectives: ['wise', 'thoughtful', 'refined', 'knowledgeable', 'authoritative'],
    symbols: ['owl', 'book', 'compass', 'tree', 'lantern', 'eye'],
    mood: 'intellectual and trustworthy',
    audience: 'knowledge-seekers and lifelong learners',
  },
  'the-explorer': {
    adjectives: ['adventurous', 'free-spirited', 'authentic', 'independent', 'rugged'],
    symbols: ['compass', 'mountain', 'path', 'horizon', 'arrow', 'star'],
    mood: 'adventurous and liberating',
    audience: 'trailblazers who value freedom and discovery',
  },
  'the-creator': {
    adjectives: ['innovative', 'imaginative', 'expressive', 'artistic', 'visionary'],
    symbols: ['brush', 'prism', 'spiral', 'spark', 'diamond', 'wave'],
    mood: 'creative and inspiring',
    audience: 'creative professionals and makers',
  },
  'the-caregiver': {
    adjectives: ['nurturing', 'warm', 'compassionate', 'gentle', 'supportive'],
    symbols: ['heart', 'hands', 'leaf', 'circle', 'nest', 'sun'],
    mood: 'warm and reassuring',
    audience: 'people who prioritize health, wellness, and community',
  },
  'the-magician': {
    adjectives: ['transformative', 'mystical', 'visionary', 'charismatic', 'dynamic'],
    symbols: ['star', 'wand', 'butterfly', 'infinity', 'crystal', 'moon'],
    mood: 'transformative and enchanting',
    audience: 'visionaries seeking breakthrough experiences',
  },
  'the-ruler': {
    adjectives: ['prestigious', 'authoritative', 'exclusive', 'commanding', 'refined'],
    symbols: ['crown', 'column', 'crest', 'lion', 'scepter', 'laurel'],
    mood: 'luxurious and commanding',
    audience: 'leaders and affluent consumers who demand the best',
  },
  'the-jester': {
    adjectives: ['playful', 'witty', 'fun', 'irreverent', 'energetic'],
    symbols: ['smile', 'confetti', 'spark', 'balloon', 'star', 'lightning'],
    mood: 'joyful and entertaining',
    audience: 'fun-loving people who appreciate humor and levity',
  },
  'the-lover': {
    adjectives: ['passionate', 'sensual', 'intimate', 'elegant', 'alluring'],
    symbols: ['heart', 'rose', 'flame', 'silk', 'feather', 'pearl'],
    mood: 'romantic and luxurious',
    audience: 'people who value beauty, intimacy, and indulgence',
  },
  'the-everyperson': {
    adjectives: ['approachable', 'honest', 'down-to-earth', 'reliable', 'friendly'],
    symbols: ['home', 'handshake', 'circle', 'leaf', 'bridge', 'path'],
    mood: 'friendly and trustworthy',
    audience: 'everyday people who value authenticity and belonging',
  },
  'the-rebel': {
    adjectives: ['disruptive', 'edgy', 'fierce', 'unconventional', 'raw'],
    symbols: ['lightning', 'skull', 'fist', 'fire', 'chain', 'blade'],
    mood: 'rebellious and provocative',
    audience: 'rule-breakers and counter-culture enthusiasts',
  },
  'the-innocent': {
    adjectives: ['pure', 'optimistic', 'simple', 'wholesome', 'fresh'],
    symbols: ['sun', 'daisy', 'cloud', 'rainbow', 'dove', 'drop'],
    mood: 'uplifting and pure',
    audience: 'optimists who value simplicity and goodness',
  },
};

// ── Style Definitions ──────────────────────────────────────────

/**
 * Visual style parameters for Recraft V4 prompt composition.
 * @type {Record<string, { promptFragment: string, typography: string, composition: string, negative: string }>}
 */
export const STYLE_PARAMS = {
  minimal: {
    promptFragment: 'Minimalist design. Clean lines, geometric precision, flat design, ample whitespace. Swiss-style grid-based layout. No gradients, no shadows, no 3D effects.',
    typography: 'Sans-serif, clean, geometric typeface. Tight letter-spacing. Uniform stroke weight.',
    composition: 'Centered or left-aligned. Maximum negative space. Single focal element. Golden ratio proportions.',
    negative: 'ornate, decorative, complex, cluttered, gradients, drop shadows, 3D, textures, photorealistic',
  },
  bold: {
    promptFragment: 'Bold and impactful design. High contrast, thick strokes, strong geometric shapes. Heavy visual weight. Commanding presence.',
    typography: 'Bold sans-serif or slab serif. Extra-bold weight. Wide tracking. Strong baseline.',
    composition: 'Centered with impact. Fills the frame. Dense visual weight. Strong vertical axis.',
    negative: 'thin, delicate, light, wispy, cursive, ornate, complex details, low contrast',
  },
  vintage: {
    promptFragment: 'Vintage heritage design. Hand-drawn quality, classic Americana, badge or crest style. Weathered texture hints. Timeless craft aesthetic.',
    typography: 'Serif or script typeface. Decorative but legible. Banner or ribbon text elements. Engraving style.',
    composition: 'Badge/crest layout or symmetrical emblem. Ornamental border elements. Layered depth with vintage texture.',
    negative: 'modern, tech, futuristic, neon, gradient, flat, minimal, digital',
  },
  modern: {
    promptFragment: 'Contemporary modern design. Sleek and tech-forward. Subtle gradient accents permitted. Progressive and forward-looking aesthetic.',
    typography: 'Modern sans-serif. Variable weight. Clean proportions. Slight geometric influence.',
    composition: 'Asymmetric balance or dynamic layout. Progressive grid. Subtle depth through gradient or shadow.',
    negative: 'vintage, retro, hand-drawn, ornate, serif, rustic, distressed, grunge',
  },
  playful: {
    promptFragment: 'Playful and energetic design. Rounded shapes, vibrant feel, approachable and fun. Bouncy proportions and joyful energy.',
    typography: 'Rounded sans-serif or hand-lettered. Variable baseline. Bouncy, irregular but balanced.',
    composition: 'Dynamic, slightly off-center. Curved flow. Multiple scale elements. Energetic negative space.',
    negative: 'corporate, formal, rigid, angular, dark, serious, austere, geometric grid',
  },
};

// ── Logo Variation Types ───────────────────────────────────────

/**
 * Logo variation definitions. Each describes a specific logo type.
 * @type {Array<{ id: string, label: string, promptSuffix: string, priority: number }>}
 */
export const LOGO_VARIATIONS = [
  {
    id: 'icon',
    label: 'Symbol Mark',
    promptSuffix: 'Icon-only symbol mark. Abstract or symbolic representation. No text, no letters. Single memorable shape.',
    priority: 1,
  },
  {
    id: 'wordmark',
    label: 'Wordmark',
    promptSuffix: 'Typographic wordmark logo. Custom lettering of the brand name. Text-based logo design, no icon or symbol element.',
    priority: 2,
  },
  {
    id: 'combination',
    label: 'Combination Mark',
    promptSuffix: 'Combination mark with icon/symbol alongside brand name text. Balanced layout, both elements work together. Icon on left, text on right.',
    priority: 3,
  },
  {
    id: 'emblem',
    label: 'Emblem',
    promptSuffix: 'Emblem or badge-style logo. Brand name integrated into a contained geometric shape, crest, or seal.',
    priority: 4,
  },
  {
    id: 'lettermark',
    label: 'Lettermark',
    promptSuffix: 'Lettermark/monogram logo using brand initials. Elegant, compact monogram design.',
    priority: 5,
  },
  {
    id: 'abstract',
    label: 'Abstract Mark',
    promptSuffix: 'Abstract geometric mark. Unique shapes that convey brand personality. Non-representational but meaningful.',
    priority: 6,
  },
];

// ── Template Resolver ──────────────────────────────────────────

/**
 * Resolve a logo generation template for a given archetype and style.
 * Returns a fully-composed template with all prompt fragments, parameters,
 * and variation list ready for the worker.
 *
 * @param {Object} params
 * @param {string} params.brandName - The brand name to incorporate
 * @param {string} params.logoStyle - One of: minimal, bold, vintage, modern, playful
 * @param {string} [params.archetype] - Brand archetype slug (e.g. 'the-hero')
 * @param {string} [params.brandVision] - Brand vision statement
 * @param {string} [params.industry] - Industry/niche for contextual hints
 * @param {string[]} [params.colorPalette] - Hex color strings
 * @param {number} [params.count=4] - Number of logos to generate
 * @param {string[]} [params.variations] - Specific variation type IDs to generate
 * @param {string} [params.refinementNotes] - User refinement instructions to incorporate
 * @returns {Object} Resolved template with prompts array
 */
export function resolveLogoTemplate({
  brandName,
  logoStyle = 'modern',
  archetype,
  brandVision,
  industry,
  colorPalette = [],
  count = 4,
  variations,
  refinementNotes,
}) {
  const style = STYLE_PARAMS[logoStyle] || STYLE_PARAMS.modern;
  const archetypeKey = archetype?.toLowerCase().replace(/\s+/g, '-');
  const traits = ARCHETYPE_TRAITS[archetypeKey] || null;

  // Build the base prompt that's shared across all variations
  const baseParts = [
    'Professional brand logo design.',
    `Brand name: "${brandName}".`,
  ];

  if (brandVision) {
    baseParts.push(`Brand vision: ${brandVision}.`);
  }

  if (traits) {
    baseParts.push(`Brand personality: ${traits.adjectives.slice(0, 3).join(', ')}.`);
    baseParts.push(`Mood: ${traits.mood}.`);
  }

  if (industry) {
    baseParts.push(`Industry: ${industry}.`);
  }

  baseParts.push(style.promptFragment);

  if (refinementNotes) {
    baseParts.push(`Refinement instructions: ${refinementNotes}`);
  }

  baseParts.push('Clean vector design, scalable, suitable for business use. White or transparent background.');

  const basePrompt = baseParts.join(' ');

  // Select which variations to generate
  let selectedVariations;
  if (variations && variations.length > 0) {
    // User-selected variations: filter LOGO_VARIATIONS to only include requested types
    selectedVariations = LOGO_VARIATIONS.filter((v) => variations.includes(v.id));
    // If none matched, fall back to priority-based selection
    if (selectedVariations.length === 0) {
      const sortedVariations = [...LOGO_VARIATIONS].sort((a, b) => a.priority - b.priority);
      selectedVariations = sortedVariations.slice(0, count);
    }
  } else {
    // Default: priority-based selection
    const sortedVariations = [...LOGO_VARIATIONS].sort((a, b) => a.priority - b.priority);
    selectedVariations = sortedVariations.slice(0, count);
  }

  // Build per-variation prompts
  const prompts = selectedVariations.map((variation) => {
    const parts = [basePrompt];

    // Add variation-specific suffix
    parts.push(variation.promptSuffix);

    // Add typography guidance for text-bearing variations
    if (['wordmark', 'combination', 'emblem', 'lettermark'].includes(variation.id)) {
      parts.push(`Typography: ${style.typography}`);
    }

    // Add archetype symbol hints for icon-bearing variations
    if (['icon', 'combination', 'abstract', 'emblem'].includes(variation.id) && traits) {
      const symbols = traits.symbols.slice(0, 3).join(', ');
      parts.push(`Consider incorporating elements inspired by: ${symbols}.`);
    }

    // Add composition guidance
    parts.push(`Layout: ${style.composition}`);

    return {
      text: parts.join(' '),
      variation: variation.id,
      label: variation.label,
    };
  });

  return {
    brandName,
    logoStyle,
    archetype: archetypeKey,
    basePrompt,
    prompts,
    recraftParams: {
      image_size: 'square_hd',
      colors: colorPalette,
    },
    negativePrompt: style.negative,
    metadata: {
      templateVersion: '1.0.0',
      archetypeTraits: traits,
      styleParams: style,
      variationCount: prompts.length,
    },
  };
}

/**
 * Get all available archetype keys.
 * @returns {string[]}
 */
export function getArchetypeKeys() {
  return Object.keys(ARCHETYPE_TRAITS);
}

/**
 * Get all available logo style keys.
 * @returns {string[]}
 */
export function getStyleKeys() {
  return Object.keys(STYLE_PARAMS);
}

/**
 * Get the recommended variation set for a given count.
 * Always includes icon + wordmark + combination first.
 * @param {number} count
 * @returns {string[]} variation IDs
 */
export function getRecommendedVariations(count) {
  const sorted = [...LOGO_VARIATIONS].sort((a, b) => a.priority - b.priority);
  return sorted.slice(0, count).map((v) => v.id);
}
