// server/src/agents/tools/mcp-server.js
//
// Creates an in-process MCP server containing all direct tools
// that the Brand Wizard parent agent needs. Uses the Agent SDK's
// tool() helper + createSdkMcpServer() so tools are delivered
// via the MCP protocol the SDK expects.

import { z } from 'zod';
import { supabaseAdmin } from '../../lib/supabase.js';
import { dispatchJob } from '../../queues/dispatch.js';
import { logger } from '../../lib/logger.js';

/** @type {typeof import('@anthropic-ai/claude-agent-sdk').tool} */
let sdkTool;
/** @type {typeof import('@anthropic-ai/claude-agent-sdk').createSdkMcpServer} */
let createSdkMcpServer;

try {
  const sdk = await import('@anthropic-ai/claude-agent-sdk');
  sdkTool = sdk.tool;
  createSdkMcpServer = sdk.createSdkMcpServer;
} catch {
  // SDK not installed — will throw at build time
}

// ── Tool Definitions ────────────────────────────────────────────────

const saveBrandData = sdkTool(
  'saveBrandData',
  'Save or update brand data fields in the database. Use after generating brand identity, selecting logos, or any step that produces data the user should keep.',
  {
    brandId: z.string().uuid().describe('The brand UUID to update'),
    fields: z.record(z.unknown()).describe('Fields to update on the brand record'),
  },
  async ({ brandId, fields }) => {
    const { data, error } = await supabaseAdmin
      .from('brands')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', brandId)
      .select()
      .single();

    if (error) {
      return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify({ success: true, brand: data }) }] };
  }
);

const searchProducts = sdkTool(
  'searchProducts',
  'Search the product catalog by category, keyword, or retrieve all active products. Returns products with pricing and mockup template info.',
  {
    category: z
      .enum(['apparel', 'accessories', 'home_goods', 'packaging', 'digital'])
      .optional()
      .describe('Filter by product category'),
    keyword: z.string().optional().describe('Full-text search keyword'),
    limit: z.number().int().min(1).max(50).default(20).describe('Max results to return'),
  },
  async ({ category, keyword, limit }) => {
    let query = supabaseAdmin
      .from('products')
      .select('id, sku, name, category, base_cost, retail_price, image_url, mockup_template_url, metadata')
      .eq('is_active', true)
      .limit(limit);

    if (category) query = query.eq('category', category);
    if (keyword) query = query.textSearch('name', keyword);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify({ products: data, count: data.length }) }] };
  }
);

const validateInput = sdkTool(
  'validateInput',
  'Cheap and fast validation or classification using Gemini 3.0 Flash. Use for: checking social handle validity, classifying user intent, validating brand name appropriateness, NSFW detection on text.',
  {
    input: z.string().describe('The text to validate or classify'),
    validationType: z
      .enum(['social_handle', 'brand_name', 'nsfw_text', 'user_intent', 'color_hex', 'general'])
      .describe('What kind of validation to perform'),
    criteria: z.string().optional().describe('Additional validation criteria or instructions'),
  },
  async ({ input, validationType, criteria }) => {
    let genAI = null;
    try {
      const { GoogleGenerativeAI } = await import('@google/generativeai');
      genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    } catch {
      return { content: [{ type: 'text', text: JSON.stringify({ valid: true, message: 'Validation unavailable - Google AI SDK not configured' }) }] };
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-3.0-flash' });

    const prompts = {
      social_handle: `Validate if this looks like a real social media handle (not gibberish, not offensive). Handle: "${input}". Return JSON: { "valid": boolean, "reason": string }`,
      brand_name: `Evaluate this brand name for appropriateness, memorability, and potential trademark issues. Name: "${input}". Return JSON: { "appropriate": boolean, "memorable": number (1-10), "concerns": string[] }`,
      nsfw_text: `Check if this text contains NSFW, offensive, or inappropriate content. Text: "${input}". Return JSON: { "safe": boolean, "reason": string }`,
      user_intent: `Classify the user's intent from this message. Message: "${input}". Return JSON: { "intent": string, "confidence": number }`,
      color_hex: `Validate these color hex codes and name them. Input: "${input}". Return JSON: { "valid": boolean, "colors": { "hex": string, "name": string }[] }`,
      general: `${criteria || 'Validate the following input'}: "${input}". Return JSON with your assessment.`,
    };

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompts[validationType] }] }],
      generationConfig: { responseMimeType: 'application/json' },
    });

    return { content: [{ type: 'text', text: result.response.text() }] };
  }
);

const checkCredits = sdkTool(
  'checkCredits',
  'Check if a user has remaining generation credits. MUST be called before any image generation (logos, mockups, bundles). Returns credit balance and whether the requested operation is affordable.',
  {
    userId: z.string().uuid().describe('The user UUID'),
    operationType: z.enum(['logo', 'mockup', 'bundle', 'text_image', 'video']).describe('Type of generation to check credits for'),
    quantity: z.number().int().min(1).default(1).describe('Number of generations requested'),
  },
  async ({ userId, operationType, quantity }) => {
    const costs = { logo: 1, mockup: 1, bundle: 2, text_image: 1, video: 5 };
    const requiredCredits = costs[operationType] * quantity;

    const { data, error } = await supabaseAdmin
      .from('generation_credits')
      .select('credits_remaining')
      .eq('user_id', userId)
      .single();

    if (error) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    }

    const canAfford = data.credits_remaining >= requiredCredits;
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          creditsRemaining: data.credits_remaining,
          creditsRequired: requiredCredits,
          canAfford,
          message: canAfford
            ? `User has ${data.credits_remaining} credits. This operation costs ${requiredCredits}.`
            : `Insufficient credits. Has ${data.credits_remaining}, needs ${requiredCredits}. Suggest plan upgrade.`,
        }),
      }],
    };
  }
);

const deductCredit = sdkTool(
  'deductCredit',
  'Deduct generation credits after a successful generation. Call AFTER the generation tool returns successfully, not before.',
  {
    userId: z.string().uuid().describe('The user UUID'),
    amount: z.number().int().min(1).describe('Number of credits to deduct'),
    reason: z.string().describe('What the credits were used for (e.g., "4 logo generations")'),
    brandId: z.string().uuid().describe('The brand UUID for audit trail'),
  },
  async ({ userId, amount, reason, brandId }) => {
    const { data, error } = await supabaseAdmin.rpc('deduct_credits', {
      p_user_id: userId,
      p_amount: amount,
    });

    if (error) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    }

    await supabaseAdmin.from('audit_log').insert({
      user_id: userId,
      action: 'credit_deducted',
      resource_type: 'generation_credits',
      resource_id: brandId,
      metadata: { amount, reason, remaining: data },
    });

    return { content: [{ type: 'text', text: JSON.stringify({ success: true, creditsRemaining: data, deducted: amount }) }] };
  }
);

const queueCRMSync = sdkTool(
  'queueCRMSync',
  'Dispatch a CRM sync job to GoHighLevel. Non-blocking -- the job runs in the background via BullMQ. Use after brand completion, wizard start, or wizard abandonment.',
  {
    userId: z.string().uuid().describe('The user UUID'),
    eventType: z
      .enum(['wizard.started', 'wizard.abandoned', 'brand.completed', 'logo.generated', 'mockup.generated', 'subscription.created'])
      .describe('The event that triggered the CRM sync'),
    data: z.record(z.unknown()).optional().describe('Event-specific payload data'),
  },
  async ({ userId, eventType, data }) => {
    const result = await dispatchJob('crm-sync', {
      userId,
      eventType,
      data: data || {},
      timestamp: new Date().toISOString(),
    });

    return { content: [{ type: 'text', text: JSON.stringify({ success: true, jobId: result.jobId, message: `CRM sync queued: ${eventType}` }) }] };
  }
);

const sendEmail = sdkTool(
  'sendEmail',
  'Dispatch a transactional email job via BullMQ + Resend. Non-blocking. Use for: brand completion confirmation, wizard abandonment follow-up, welcome emails.',
  {
    userId: z.string().uuid().describe('The recipient user UUID (email looked up from profiles table)'),
    templateId: z
      .enum(['brand-complete', 'welcome', 'wizard-abandoned', 'logo-ready', 'mockup-ready', 'subscription-confirmed', 'support-ticket'])
      .describe('The email template to use'),
    data: z.record(z.unknown()).optional().describe('Template-specific merge data (brand name, logo URL, etc.)'),
  },
  async ({ userId, templateId, data }) => {
    const result = await dispatchJob('email-send', {
      userId,
      templateId,
      data: data || {},
      timestamp: new Date().toISOString(),
    });

    return { content: [{ type: 'text', text: JSON.stringify({ success: true, jobId: result.jobId, message: `Email queued: ${templateId}` }) }] };
  }
);

// ── MCP Server Export ───────────────────────────────────────────────

/**
 * Create the in-process MCP server for all parent-agent direct tools.
 * Returns a McpSdkServerConfigWithInstance that can be passed to
 * options.mcpServers in the SDK query() call.
 *
 * @returns {import('@anthropic-ai/claude-agent-sdk').McpSdkServerConfigWithInstance}
 */
export function createParentToolsServer() {
  if (!createSdkMcpServer) {
    throw new Error('Anthropic Agent SDK not installed. Run: npm install @anthropic-ai/claude-agent-sdk');
  }

  return createSdkMcpServer({
    name: 'bmn-parent-tools',
    version: '2.0.0',
    tools: [
      saveBrandData,
      searchProducts,
      validateInput,
      checkCredits,
      deductCredit,
      queueCRMSync,
      sendEmail,
    ],
  });
}

/** Tool names list for allowedTools config */
export const PARENT_TOOL_NAMES = [
  'saveBrandData',
  'searchProducts',
  'validateInput',
  'checkCredits',
  'deductCredit',
  'queueCRMSync',
  'sendEmail',
];
