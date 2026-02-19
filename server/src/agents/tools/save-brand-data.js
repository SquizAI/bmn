// server/src/agents/tools/save-brand-data.js

import { z } from 'zod';
import { supabaseAdmin } from '../../lib/supabase.js';

/** @type {import('@anthropic-ai/claude-agent-sdk').ToolDefinition} */
export const saveBrandData = {
  name: 'saveBrandData',
  description:
    'Save or update brand data fields in the database. Use after generating brand identity, selecting logos, or any step that produces data the user should keep.',
  inputSchema: z.object({
    brandId: z.string().uuid().describe('The brand UUID to update'),
    fields: z
      .object({
        name: z.string().optional().describe('Brand name'),
        vision: z.string().optional().describe('Brand vision statement'),
        archetype: z
          .string()
          .optional()
          .describe('Brand archetype (e.g., Hero, Creator, Explorer)'),
        brand_values: z
          .array(z.string())
          .optional()
          .describe('Array of brand values'),
        target_audience: z
          .string()
          .optional()
          .describe('Target audience description'),
        color_palette: z
          .array(
            z.object({
              hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
              name: z.string(),
              role: z.string().optional(),
            })
          )
          .optional()
          .describe('Color palette array'),
        fonts: z
          .object({
            primary: z.string(),
            secondary: z.string(),
          })
          .optional()
          .describe('Font selections'),
        logo_style: z
          .enum(['minimal', 'bold', 'vintage', 'modern', 'playful'])
          .optional(),
        social_data: z
          .record(z.unknown())
          .optional()
          .describe('Raw social analysis data'),
        wizard_step: z
          .string()
          .optional()
          .describe('Current wizard step path'),
      })
      .describe('Fields to update on the brand record'),
  }),
  execute: async ({ brandId, fields }) => {
    const { data, error } = await supabaseAdmin
      .from('brands')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', brandId)
      .select()
      .single();

    if (error) throw new Error(`Failed to save brand data: ${error.message}`);
    return { success: true, brand: data };
  },
};
