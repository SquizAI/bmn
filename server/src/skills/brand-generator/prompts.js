// server/src/skills/brand-generator/prompts.js

export const SYSTEM_PROMPT = `You are an expert brand strategist working for Brand Me Now, an AI-powered brand creation platform. Your job is to transform social media analysis data into THREE distinct brand identity directions that the user can choose from.

<instructions>
You receive structured social analysis data (aesthetic, themes, audience, engagement, personality) and must generate THREE complete, contrasting brand identity directions. Follow this workflow:

1. ANALYZE the social data to identify the strongest brand signals -- recurring themes, dominant aesthetics, audience expectations, and personality traits.

2. SUGGEST ARCHETYPES: Use the suggestArchetypes tool with the personality traits from the social analysis. The top 3 archetypes will anchor your 3 directions.

3. BUILD 3 DIRECTIONS: Create three contrasting but equally viable brand identities:

   - **Direction A** ("Bold & Energetic"): The most dynamic, attention-grabbing direction. High contrast colors, strong typography, energetic voice. Best for creators who want to stand out loudly.

   - **Direction B** ("Clean & Premium"): The refined, upscale direction. Muted/sophisticated palette, elegant fonts, professional voice. Best for creators targeting a premium market.

   - **Direction C** ("Warm & Approachable"): The friendly, inviting direction. Warm tones, rounded fonts, casual voice. Best for creators who build through community and trust.

   Each direction MUST include ALL of these:
   - A unique label and tagline
   - Brand vision (1-2 sentence vision statement)
   - Brand archetype with justification
   - 3-5 core values
   - Color palette (5 colors: primary, secondary, accent, background, text -- all as hex codes with names and roles)
   - Font pairings (heading + body from Google Fonts -- use suggestFontPairings tool for each direction's style)
   - Logo style recommendation (minimal/bold/vintage/modern/playful)
   - Brand voice (tone, vocabulary level, communication style)
   - A narrative paragraph (2-3 sentences telling the brand's story in second person: "Based on your content...")

4. DIFFERENTIATE: The 3 directions MUST feel genuinely different. Different archetypes, different color temperatures, different font vibes, different voice tones. The user should feel like they have a real choice.

IMPORTANT RULES:
- Every recommendation must trace back to evidence in the social data. Do not invent traits.
- Color palettes should harmonize with the dominant colors found in the aesthetic analysis, but each direction interprets them differently.
- Font pairings must come from Google Fonts (free, web-safe).
- Return ALL data as structured JSON. No prose responses.
</instructions>

<output_format>
Your final response MUST be a JSON object with this shape:

{
  "directions": [
    {
      "id": "direction-a",
      "label": "Bold & Energetic",
      "tagline": "A short tagline that captures this direction's feel",
      "archetype": {
        "name": "string -- archetype name",
        "score": 0.85,
        "description": "string -- why this archetype fits this direction"
      },
      "vision": "string -- 1-2 sentence brand vision statement",
      "values": ["value1", "value2", "value3"],
      "colorPalette": [
        { "hex": "#FFFFFF", "role": "primary", "name": "Snow White" },
        { "hex": "#000000", "role": "secondary", "name": "Midnight" },
        { "hex": "#FF5733", "role": "accent", "name": "Coral Burst" },
        { "hex": "#F5F5F5", "role": "background", "name": "Soft Gray" },
        { "hex": "#1a1a1a", "role": "text", "name": "Near Black" }
      ],
      "fonts": {
        "heading": { "family": "string", "weight": "600" },
        "body": { "family": "string", "weight": "400" }
      },
      "logoStyle": {
        "style": "minimal | bold | vintage | modern | playful",
        "reasoning": "string -- why this style fits"
      },
      "voice": {
        "tone": "string -- e.g. friendly and approachable",
        "vocabularyLevel": "casual | conversational | professional | formal",
        "communicationStyle": "string -- e.g. storytelling, direct, inspirational"
      },
      "narrative": "string -- 2-3 sentences in second person telling the brand story for this direction. Start with 'Based on your content...'"
    }
  ],
  "socialContext": "string -- brief summary of the key social data signals that informed these directions"
}
</output_format>`;

/**
 * Build the task prompt sent by the parent agent for 3-direction generation.
 * @param {Object} input
 * @param {Object} input.socialAnalysis - The social analysis data from the social-analyzer skill
 * @param {string} input.brandId - Brand record ID
 * @param {string} input.userId - User ID for scoping
 * @param {string} [input.brandName] - Brand name if already chosen
 * @param {Object} [input.userPreferences] - Any user preferences from wizard state
 * @returns {string}
 */
export function buildDirectionsTaskPrompt(input) {
  const analysis = input.socialAnalysis || {};

  // Extract structured dossier signals for clearer AI context
  const niche = analysis.niche || {};
  const aesthetic = analysis.aesthetic || {};
  const audience = analysis.audience || {};
  const content = analysis.content || {};
  const personality = analysis.personality || {};
  const readiness = analysis.readinessScore || {};

  const contextSections = [];

  if (input.brandName) {
    contextSections.push(`Brand Name: ${input.brandName}`);
  }

  if (niche.primaryNiche?.name) {
    const subNiches = (niche.secondaryNiches || []).map((n) => n.name || n).filter(Boolean);
    contextSections.push(`Creator Niche: ${niche.primaryNiche.name} (confidence: ${niche.primaryNiche.confidence || 'N/A'})${subNiches.length > 0 ? `\nSub-niches: ${subNiches.join(', ')}` : ''}`);
  }

  if (aesthetic.dominantColors?.length > 0) {
    const colorList = aesthetic.dominantColors.map((c) => `${c.name || c.hex} (${c.hex})`).join(', ');
    contextSections.push(`Dominant Feed Colors: ${colorList}`);
  }

  if (aesthetic.naturalPalette?.length > 0) {
    contextSections.push(`Natural Palette: ${aesthetic.naturalPalette.join(', ')}`);
  }

  if (aesthetic.visualMood?.length > 0) {
    contextSections.push(`Visual Mood: ${aesthetic.visualMood.join(', ')}`);
  }

  if (audience.estimatedAgeRange) {
    const audienceParts = [`Age Range: ${audience.estimatedAgeRange}`];
    if (audience.genderSplit) {
      audienceParts.push(`Gender: ${Object.entries(audience.genderSplit).map(([k, v]) => `${k}: ${v}%`).join(', ')}`);
    }
    if (audience.primaryInterests?.length > 0) {
      audienceParts.push(`Interests: ${audience.primaryInterests.join(', ')}`);
    }
    contextSections.push(`Audience Demographics:\n${audienceParts.join('\n')}`);
  }

  if (content.themes?.length > 0) {
    const themeList = content.themes.map((t) => `${t.name} (${Math.round((t.frequency || 0) * 100)}%)`).join(', ');
    contextSections.push(`Content Themes: ${themeList}`);
  }

  if (personality.traits?.length > 0) {
    contextSections.push(`Personality Traits: ${personality.traits.join(', ')}`);
  }

  if (personality.voiceTone) {
    contextSections.push(`Existing Voice Tone: ${personality.voiceTone}`);
  }

  if (readiness.totalScore) {
    contextSections.push(`Brand Readiness Score: ${readiness.totalScore}/100 (tier: ${readiness.tier || 'N/A'})`);
  }

  const structuredContext = contextSections.length > 0
    ? `\n<dossier_summary>\n${contextSections.join('\n\n')}\n</dossier_summary>\n`
    : '';

  return `Generate 3 brand identity directions based on the following social media analysis data:

Brand ID: ${input.brandId}
User ID: ${input.userId}
${structuredContext}
<social_analysis>
${JSON.stringify(analysis, null, 2)}
</social_analysis>

${input.userPreferences ? `<user_preferences>\n${JSON.stringify(input.userPreferences, null, 2)}\n</user_preferences>\n` : ''}
Analyze the data above and generate 3 distinct, contrasting brand identity directions (Bold & Energetic, Clean & Premium, Warm & Approachable). Each must be fully specified with archetype, colors, fonts, voice, and narrative. Ground every recommendation in evidence from the social data. The color palettes should harmonize with the creator's natural feed palette but interpret it differently per direction.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: ANALYZE_CONTEXT -- Fast context distillation + archetype suggestion
// ─────────────────────────────────────────────────────────────────────────────

export const CONTEXT_ANALYSIS_SYSTEM = `You are an expert brand strategist. Your job is to distill social media analysis data into a concise creative brief and suggest 3 distinct brand archetypes. Be specific and evidence-based. Return ONLY valid JSON.`;

/**
 * Build the Step 1 prompt: Analyze social context and suggest 3 archetypes.
 * @param {Object} input
 * @param {Object} input.socialAnalysis - Social analysis dossier
 * @param {string} [input.brandName] - Brand name if chosen
 * @param {Object} [input.userPreferences] - User preferences
 * @returns {string}
 */
export function buildContextAnalysisPrompt(input) {
  const analysis = input.socialAnalysis || {};

  // Condense the dossier to key signals only (avoid sending full JSON)
  const signals = [];
  if (input.brandName) signals.push(`Brand Name: ${input.brandName}`);
  if (analysis.niche?.primaryNiche?.name) signals.push(`Primary Niche: ${analysis.niche.primaryNiche.name}`);
  if (analysis.niche?.secondaryNiches?.length > 0) {
    signals.push(`Sub-niches: ${analysis.niche.secondaryNiches.map((n) => n.name || n).join(', ')}`);
  }
  if (analysis.personality?.traits?.length > 0) signals.push(`Personality Traits: ${analysis.personality.traits.join(', ')}`);
  if (analysis.personality?.voiceTone) signals.push(`Voice Tone: ${analysis.personality.voiceTone}`);
  if (analysis.personality?.archetype) {
    const arch = typeof analysis.personality.archetype === 'string'
      ? analysis.personality.archetype
      : analysis.personality.archetype.name || analysis.personality.archetype;
    signals.push(`Detected Archetype: ${arch}`);
  }
  if (analysis.aesthetic?.dominantColors?.length > 0) {
    signals.push(`Dominant Colors: ${analysis.aesthetic.dominantColors.map((c) => `${c.name || c.hex} (${c.hex})`).join(', ')}`);
  }
  if (analysis.aesthetic?.naturalPalette?.length > 0) {
    signals.push(`Natural Palette: ${analysis.aesthetic.naturalPalette.join(', ')}`);
  }
  if (analysis.aesthetic?.visualMood?.length > 0) signals.push(`Visual Mood: ${analysis.aesthetic.visualMood.join(', ')}`);
  if (analysis.audience?.estimatedAgeRange) signals.push(`Target Age: ${analysis.audience.estimatedAgeRange}`);
  if (analysis.audience?.primaryInterests?.length > 0) {
    signals.push(`Audience Interests: ${analysis.audience.primaryInterests.join(', ')}`);
  }
  if (analysis.audience?.incomeLevel) signals.push(`Income Level: ${analysis.audience.incomeLevel}`);
  if (analysis.content?.themes?.length > 0) {
    signals.push(`Content Themes: ${analysis.content.themes.map((t) => t.name).join(', ')}`);
  }
  if (analysis.readinessScore?.totalScore) {
    signals.push(`Brand Readiness: ${analysis.readinessScore.totalScore}/100 (${analysis.readinessScore.tier || 'N/A'})`);
  }
  if (analysis.profile?.totalFollowers) signals.push(`Followers: ${analysis.profile.totalFollowers.toLocaleString()}`);

  return `Analyze this social media presence data and suggest 3 distinctly different brand archetypes that would work well for this creator.

<social_data>
${signals.join('\n')}
</social_data>

${input.userPreferences ? `<user_preferences>\n${JSON.stringify(input.userPreferences, null, 2)}\n</user_preferences>\n` : ''}
Return a JSON object with this exact structure:
{
  "socialContext": "2-3 sentence summary of the creator's brand potential, key strengths, and audience characteristics",
  "archetypes": [
    {
      "id": "direction-a",
      "name": "The Creator",
      "label": "Bold & Energetic",
      "reasoning": "1-2 sentences explaining why this archetype fits based on the social data",
      "tone": "energetic, confident, dynamic",
      "visionHint": "A brief phrase capturing the brand direction vision"
    },
    {
      "id": "direction-b",
      "name": "The Sage",
      "label": "Clean & Premium",
      "reasoning": "1-2 sentences explaining why",
      "tone": "refined, authoritative, polished",
      "visionHint": "A brief phrase capturing the brand direction vision"
    },
    {
      "id": "direction-c",
      "name": "The Caregiver",
      "label": "Warm & Approachable",
      "reasoning": "1-2 sentences explaining why",
      "tone": "warm, inclusive, inviting",
      "visionHint": "A brief phrase capturing the brand direction vision"
    }
  ]
}

IMPORTANT:
- The 3 archetypes MUST be distinctly different from each other
- Direction A should be the boldest/most energetic option
- Direction B should be the most refined/premium option
- Direction C should be the warmest/most approachable option
- Each must trace back to evidence in the social data
- Use archetypes from: The Creator, The Sage, The Explorer, The Hero, The Magician, The Ruler, The Caregiver, The Jester, The Lover, The Innocent, The Outlaw, The Everyperson`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2/3: GENERATE_DIRECTION -- Build one complete brand direction
// ─────────────────────────────────────────────────────────────────────────────

export const DIRECTION_GENERATION_SYSTEM = `You are an expert brand identity designer working for Brand Me Now. Your job is to create a complete, cohesive brand direction based on a specific archetype and social context. Every recommendation must be grounded in the social data. Return ONLY valid JSON.`;

/**
 * Build the Step 2/3 prompt: Generate a single complete brand direction.
 * @param {Object} input
 * @param {string} input.socialContext - Condensed social context from Step 1
 * @param {Object} input.archetype - Archetype object from Step 1
 * @param {string} [input.brandName] - Brand name
 * @param {Object} [input.existingDirection] - Direction A (for contrast when generating B/C)
 * @param {string} [input.contrastNote] - Note about how to differentiate
 * @returns {string}
 */
export function buildDirectionPrompt(input) {
  const contrastSection = input.existingDirection
    ? `\n<existing_direction_for_contrast>
Direction A uses: ${input.existingDirection.archetype?.name || 'unknown'} archetype, colors: ${(input.existingDirection.colorPalette || []).map((c) => c.hex).join(', ')}, fonts: ${input.existingDirection.fonts?.heading?.family || 'unknown'} / ${input.existingDirection.fonts?.body?.family || 'unknown'}, tone: ${input.existingDirection.voice?.tone || 'unknown'}
</existing_direction_for_contrast>
${input.contrastNote ? `\nIMPORTANT: ${input.contrastNote}` : ''}\n`
    : '';

  return `Create a complete brand identity direction based on this archetype and social context.

<social_context>${input.socialContext}</social_context>

<archetype>
Name: ${input.archetype.name}
Label: ${input.archetype.label}
Tone: ${input.archetype.tone}
Reasoning: ${input.archetype.reasoning}
Vision Hint: ${input.archetype.visionHint}
</archetype>

${input.brandName ? `<brand_name>${input.brandName}</brand_name>` : ''}
${contrastSection}
Return a JSON object with this exact structure:
{
  "id": "${input.archetype.id}",
  "label": "${input.archetype.label}",
  "tagline": "A punchy 3-8 word tagline that captures this direction's feel",
  "archetype": {
    "name": "${input.archetype.name}",
    "score": 0.85,
    "description": "2-3 sentences explaining why this archetype perfectly fits this creator based on their social data"
  },
  "vision": "A compelling 1-2 sentence brand vision statement",
  "values": ["value1", "value2", "value3", "value4"],
  "colorPalette": [
    { "hex": "#hex", "role": "primary", "name": "Color Name" },
    { "hex": "#hex", "role": "secondary", "name": "Color Name" },
    { "hex": "#hex", "role": "accent", "name": "Color Name" },
    { "hex": "#hex", "role": "background", "name": "Color Name" },
    { "hex": "#hex", "role": "text", "name": "Color Name" }
  ],
  "fonts": {
    "heading": { "family": "Google Font Name", "weight": "600" },
    "body": { "family": "Google Font Name", "weight": "400" }
  },
  "logoStyle": {
    "style": "minimal|bold|vintage|modern|playful",
    "reasoning": "1 sentence explaining why this logo style fits"
  },
  "voice": {
    "tone": "2-3 word tone description",
    "vocabularyLevel": "casual|conversational|professional|formal",
    "communicationStyle": "1 sentence describing the brand's communication approach"
  },
  "narrative": "2-3 sentences in second person telling the brand story. Start with 'Based on your content...'"
}

IMPORTANT:
- Color palette must have exactly 5 colors with roles: primary, secondary, accent, background, text
- All hex codes must be valid 6-digit hex (e.g. #FF5733)
- Font families MUST be from Google Fonts (free, web-safe)
- The narrative must reference specific aspects of the creator's social presence
- Background color should have sufficient contrast with text color for readability
${input.existingDirection ? '- This direction MUST feel distinctly different from the existing direction shown above -- different color temperature, different font vibe, different voice tone' : ''}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 (parallel variant): GENERATE_DIRECTIONS_B_C
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the Step 3 prompt: Generate directions B and C in one call.
 * @param {Object} input
 * @param {string} input.socialContext - Condensed social context from Step 1
 * @param {Array} input.archetypes - Archetypes B and C from Step 1
 * @param {string} [input.brandName] - Brand name
 * @param {Object} input.directionA - Complete Direction A for contrast
 * @returns {string}
 */
export function buildDirectionsBCPrompt(input) {
  return `Create two complete brand identity directions that are DISTINCT from Direction A.

<social_context>${input.socialContext}</social_context>

<direction_a_summary>
Label: ${input.directionA.label}
Archetype: ${input.directionA.archetype?.name}
Colors: ${(input.directionA.colorPalette || []).map((c) => `${c.name} (${c.hex})`).join(', ')}
Fonts: ${input.directionA.fonts?.heading?.family} / ${input.directionA.fonts?.body?.family}
Voice: ${input.directionA.voice?.tone}, ${input.directionA.voice?.vocabularyLevel}
</direction_a_summary>

<archetype_b>
Name: ${input.archetypes[0].name}
Label: ${input.archetypes[0].label}
Tone: ${input.archetypes[0].tone}
Reasoning: ${input.archetypes[0].reasoning}
Vision Hint: ${input.archetypes[0].visionHint}
</archetype_b>

<archetype_c>
Name: ${input.archetypes[1].name}
Label: ${input.archetypes[1].label}
Tone: ${input.archetypes[1].tone}
Reasoning: ${input.archetypes[1].reasoning}
Vision Hint: ${input.archetypes[1].visionHint}
</archetype_c>

${input.brandName ? `<brand_name>${input.brandName}</brand_name>` : ''}

Return a JSON object with exactly 2 directions:
{
  "directions": [
    {
      "id": "${input.archetypes[0].id}",
      "label": "${input.archetypes[0].label}",
      "tagline": "A punchy 3-8 word tagline",
      "archetype": { "name": "${input.archetypes[0].name}", "score": 0.85, "description": "..." },
      "vision": "1-2 sentence brand vision",
      "values": ["value1", "value2", "value3", "value4"],
      "colorPalette": [
        { "hex": "#hex", "role": "primary", "name": "Color Name" },
        { "hex": "#hex", "role": "secondary", "name": "Color Name" },
        { "hex": "#hex", "role": "accent", "name": "Color Name" },
        { "hex": "#hex", "role": "background", "name": "Color Name" },
        { "hex": "#hex", "role": "text", "name": "Color Name" }
      ],
      "fonts": { "heading": { "family": "Google Font", "weight": "600" }, "body": { "family": "Google Font", "weight": "400" } },
      "logoStyle": { "style": "minimal|bold|vintage|modern|playful", "reasoning": "..." },
      "voice": { "tone": "...", "vocabularyLevel": "casual|conversational|professional|formal", "communicationStyle": "..." },
      "narrative": "2-3 sentences starting with 'Based on your content...'"
    },
    {
      "id": "${input.archetypes[1].id}",
      "label": "${input.archetypes[1].label}",
      "tagline": "...",
      "archetype": { "name": "${input.archetypes[1].name}", "score": 0.85, "description": "..." },
      "vision": "...",
      "values": ["value1", "value2", "value3", "value4"],
      "colorPalette": [ ... 5 colors with roles ... ],
      "fonts": { "heading": { "family": "...", "weight": "..." }, "body": { "family": "...", "weight": "..." } },
      "logoStyle": { "style": "...", "reasoning": "..." },
      "voice": { "tone": "...", "vocabularyLevel": "...", "communicationStyle": "..." },
      "narrative": "..."
    }
  ]
}

IMPORTANT:
- Each direction MUST feel distinctly different from Direction A AND from each other
- Different color temperatures, different font vibes, different voice tones
- Color palette must have exactly 5 colors with roles: primary, secondary, accent, background, text
- All hex codes must be valid 6-digit hex
- Font families MUST be from Google Fonts
- Background/text colors must have readable contrast
- Narratives must reference the creator's actual social presence`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4: VALIDATE_HARMONIZE -- Cross-check and polish all 3 directions
// ─────────────────────────────────────────────────────────────────────────────

export const VALIDATION_SYSTEM = `You are a brand quality assurance specialist. Your job is to validate and harmonize brand identity directions, ensuring color palettes are harmonious, font pairings work well, and all directions are clearly differentiated. Return ONLY valid JSON.`;

/**
 * Build the Step 4 prompt: Validate and harmonize all 3 directions.
 * @param {Array} directions - The 3 directions to validate
 * @returns {string}
 */
export function buildValidationPrompt(directions) {
  return `Validate and harmonize these 3 brand identity directions. Check for:
1. Color harmony within each palette (primary/secondary should work together, accent should pop, background/text must be readable)
2. Font pairing quality (heading and body fonts should complement each other)
3. Differentiation (the 3 directions should feel distinctly different)
4. Consistency (each direction should be internally cohesive)

<directions>
${JSON.stringify(directions, null, 2)}
</directions>

Fix any issues and return the validated directions. If colors have poor contrast, adjust them. If font pairings clash, suggest better ones (from Google Fonts only). If two directions feel too similar, adjust one to be more distinct.

Return JSON:
{
  "directions": [
    { ...direction_a with any fixes applied },
    { ...direction_b with any fixes applied },
    { ...direction_c with any fixes applied }
  ],
  "fixes": [
    "Description of fix 1 (or empty array if no fixes needed)"
  ]
}

IMPORTANT:
- Preserve the id, label, and archetype.name of each direction
- Only modify fields that need fixing
- All hex codes must be valid 6-digit hex
- Background/text contrast ratio should be at least 4.5:1 for readability
- If no fixes are needed, return the directions unchanged with an empty fixes array`;
}
