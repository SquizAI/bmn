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
