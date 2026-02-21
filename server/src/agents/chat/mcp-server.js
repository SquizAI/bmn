// server/src/agents/chat/mcp-server.js
//
// MCP tool server for the chat agent. Organizes tools in 3 tiers:
//   Tier 1: Brand (all authenticated users)
//   Tier 2: Organization (org admin/owner)
//   Tier 3: Platform Admin (super_admin)
//
// Uses the same sdkTool() + createSdkMcpServer() pattern as
// server/src/agents/tools/mcp-server.js

import { z } from 'zod';
import { supabaseAdmin } from '../../lib/supabase.js';
import { dispatchJob } from '../../queues/dispatch.js';
import { logger } from '../../lib/logger.js';
import { getEffectiveRole, getAllowedCategories } from './tool-filter.js';

/** @type {typeof import('@anthropic-ai/claude-agent-sdk').tool} */
let sdkTool;
/** @type {typeof import('@anthropic-ai/claude-agent-sdk').createSdkMcpServer} */
let createSdkMcpServer;

try {
  const sdk = await import('@anthropic-ai/claude-agent-sdk');
  sdkTool = sdk.tool;
  createSdkMcpServer = sdk.createSdkMcpServer;
} catch {
  // Agent SDK not installed — will throw at build time
}

// ═══════════════════════════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Verify user can access a brand. Defense-in-depth on top of RLS.
 * @param {string} brandId
 * @param {string} userId
 * @param {string} effectiveRole
 * @param {string|null} orgId
 * @returns {Promise<{authorized: boolean, brand: Object|null}>}
 */
async function verifyBrandAccess(brandId, userId, effectiveRole, orgId) {
  let query = supabaseAdmin.from('brands').select('*').eq('id', brandId);

  if (effectiveRole === 'platform_admin') {
    // No scoping
  } else if (['admin', 'owner'].includes(effectiveRole) && orgId) {
    query = query.eq('org_id', orgId);
  } else {
    // user/manager — own brands or assigned
    query = query.or(`user_id.eq.${userId}`);
  }

  const { data, error } = await query.single();
  if (error || !data) return { authorized: false, brand: null };
  return { authorized: true, brand: data };
}

/** JSON tool response helper */
function toolResult(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

// ═══════════════════════════════════════════════════════════════════════
// TIER 1: BRAND TOOLS (all authenticated users)
// ═══════════════════════════════════════════════════════════════════════

function createBrandReadTools(context) {
  const { userId, orgId, effectiveRole } = context;

  const listUserBrands = sdkTool(
    'listUserBrands',
    'List all brands the current user owns or has access to.',
    {
      status: z.enum(['draft', 'active', 'archived', 'all']).default('all'),
      limit: z.number().int().min(1).max(50).default(20),
    },
    async ({ status, limit }) => {
      let query = supabaseAdmin
        .from('brands')
        .select('id, name, status, wizard_step, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (status !== 'all') query = query.eq('status', status);
      const { data, error } = await query;
      if (error) return toolResult({ error: error.message });
      return toolResult({ brands: data, count: data.length });
    }
  );

  const getBrandSummary = sdkTool(
    'getBrandSummary',
    'Get a full summary of a specific brand including name, status, identity, and social data.',
    { brandId: z.string().uuid() },
    async ({ brandId }) => {
      const { authorized, brand } = await verifyBrandAccess(brandId, userId, effectiveRole, orgId);
      if (!authorized) return toolResult({ error: 'Brand not found or access denied' });
      return toolResult({
        id: brand.id,
        name: brand.name,
        status: brand.status,
        wizardStep: brand.wizard_step,
        brandIdentity: brand.wizard_state?.['brand-identity'] || null,
        socialData: brand.wizard_state?.['social-analysis'] ? 'available' : 'not analyzed',
        createdAt: brand.created_at,
      });
    }
  );

  const getBrandIdentity = sdkTool(
    'getBrandIdentity',
    'Get the brand identity details: vision, values, archetype, colors, fonts, voice, tagline.',
    { brandId: z.string().uuid() },
    async ({ brandId }) => {
      const { authorized, brand } = await verifyBrandAccess(brandId, userId, effectiveRole, orgId);
      if (!authorized) return toolResult({ error: 'Brand not found or access denied' });
      const identity = brand.wizard_state?.['brand-identity'] || {};
      return toolResult({ brandId, identity });
    }
  );

  const getBrandAssets = sdkTool(
    'getBrandAssets',
    'List all generated assets for a brand (logos, mockups, bundle images).',
    {
      brandId: z.string().uuid(),
      assetType: z.enum(['logo', 'mockup', 'bundle', 'social_asset', 'all']).default('all'),
    },
    async ({ brandId, assetType }) => {
      const { authorized } = await verifyBrandAccess(brandId, userId, effectiveRole, orgId);
      if (!authorized) return toolResult({ error: 'Brand not found or access denied' });

      let query = supabaseAdmin
        .from('brand_assets')
        .select('id, asset_type, storage_path, metadata, is_selected, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });

      if (assetType !== 'all') query = query.eq('asset_type', assetType);
      const { data, error } = await query;
      if (error) return toolResult({ error: error.message });
      return toolResult({ assets: data, count: data.length });
    }
  );

  const getBrandProducts = sdkTool(
    'getBrandProducts',
    'List all products selected for a brand with pricing and mockup status.',
    { brandId: z.string().uuid() },
    async ({ brandId }) => {
      const { authorized } = await verifyBrandAccess(brandId, userId, effectiveRole, orgId);
      if (!authorized) return toolResult({ error: 'Brand not found or access denied' });

      const { data, error } = await supabaseAdmin
        .from('brand_products')
        .select('id, product_id, config, products(name, category, base_cost, retail_price)')
        .eq('brand_id', brandId);
      if (error) return toolResult({ error: error.message });
      return toolResult({ products: data, count: data.length });
    }
  );

  const getBrandBundles = sdkTool(
    'getBrandBundles',
    'List all product bundles for a brand.',
    { brandId: z.string().uuid() },
    async ({ brandId }) => {
      const { authorized } = await verifyBrandAccess(brandId, userId, effectiveRole, orgId);
      if (!authorized) return toolResult({ error: 'Brand not found or access denied' });

      const { data, error } = await supabaseAdmin
        .from('brand_bundles')
        .select('id, name, discount_percent, brand_bundle_items(product_id, quantity)')
        .eq('brand_id', brandId);
      if (error) return toolResult({ error: error.message });
      return toolResult({ bundles: data, count: data.length });
    }
  );

  const getSocialAnalysis = sdkTool(
    'getSocialAnalysis',
    'Get the social analysis dossier: niche, audience, themes, engagement, personality.',
    { brandId: z.string().uuid() },
    async ({ brandId }) => {
      const { authorized, brand } = await verifyBrandAccess(brandId, userId, effectiveRole, orgId);
      if (!authorized) return toolResult({ error: 'Brand not found or access denied' });
      const social = brand.wizard_state?.['social-analysis'] || null;
      if (!social) return toolResult({ message: 'No social analysis data yet. The brand may not have completed this wizard step.' });
      return toolResult({ brandId, socialAnalysis: social });
    }
  );

  const searchProductCatalog = sdkTool(
    'searchProductCatalog',
    'Search the product catalog by category or keyword.',
    {
      category: z.enum(['apparel', 'accessories', 'home_goods', 'packaging', 'digital', 'supplements', 'skincare', 'coffee-tea', 'journals']).optional(),
      keyword: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(20),
    },
    async ({ category, keyword, limit }) => {
      let query = supabaseAdmin
        .from('products')
        .select('id, sku, name, category, base_cost, retail_price, image_url, metadata')
        .eq('is_active', true)
        .limit(limit);

      if (category) query = query.eq('category', category);
      if (keyword) query = query.textSearch('name', keyword);

      const { data, error } = await query;
      if (error) return toolResult({ error: error.message });
      return toolResult({ products: data, count: data.length });
    }
  );

  return [
    { tool: listUserBrands, name: 'listUserBrands', category: 'brand_read' },
    { tool: getBrandSummary, name: 'getBrandSummary', category: 'brand_read' },
    { tool: getBrandIdentity, name: 'getBrandIdentity', category: 'brand_read' },
    { tool: getBrandAssets, name: 'getBrandAssets', category: 'brand_read' },
    { tool: getBrandProducts, name: 'getBrandProducts', category: 'brand_read' },
    { tool: getBrandBundles, name: 'getBrandBundles', category: 'brand_read' },
    { tool: getSocialAnalysis, name: 'getSocialAnalysis', category: 'brand_read' },
    { tool: searchProductCatalog, name: 'searchProductCatalog', category: 'brand_read' },
  ];
}

function createBrandModifyTools(context) {
  const { userId, orgId, effectiveRole } = context;

  const updateBrandIdentity = sdkTool(
    'updateBrandIdentity',
    'Update brand identity fields: vision, values, archetype, tagline, voice, colors, fonts.',
    {
      brandId: z.string().uuid(),
      fields: z.object({
        vision: z.string().max(2000).optional(),
        tagline: z.string().max(500).optional(),
        values: z.array(z.string()).min(1).max(10).optional(),
        archetype: z.string().optional(),
        voice: z.object({
          tone: z.string().optional(),
          vocabularyLevel: z.enum(['casual', 'conversational', 'professional', 'formal']).optional(),
          communicationStyle: z.string().optional(),
        }).optional(),
        colorPalette: z.array(z.object({
          hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
          name: z.string(),
          role: z.string(),
        })).optional(),
        fonts: z.object({
          heading: z.object({ family: z.string(), weight: z.string() }).optional(),
          body: z.object({ family: z.string(), weight: z.string() }).optional(),
        }).optional(),
      }),
    },
    async ({ brandId, fields }) => {
      const { authorized, brand } = await verifyBrandAccess(brandId, userId, effectiveRole, orgId);
      if (!authorized) return toolResult({ error: 'Brand not found or access denied' });

      const currentIdentity = brand.wizard_state?.['brand-identity'] || {};
      const updatedIdentity = { ...currentIdentity, ...fields };

      const { error } = await supabaseAdmin
        .from('brands')
        .update({
          wizard_state: { ...brand.wizard_state, 'brand-identity': updatedIdentity },
          updated_at: new Date().toISOString(),
        })
        .eq('id', brandId);

      if (error) return toolResult({ error: error.message });
      return toolResult({ success: true, message: 'Brand identity updated', updatedFields: Object.keys(fields) });
    }
  );

  const updateBrandName = sdkTool(
    'updateBrandName',
    'Change the brand name. REQUIRES user confirmation before calling with confirmed=true.',
    {
      brandId: z.string().uuid(),
      name: z.string().min(1).max(200),
      confirmed: z.boolean().default(false).describe('Set true ONLY after user explicitly confirms'),
    },
    async ({ brandId, name, confirmed }) => {
      if (!confirmed) {
        return toolResult({
          requiresConfirmation: true,
          action: 'rename_brand',
          message: `This will change the brand name to "${name}". Please confirm.`,
        });
      }

      const { authorized } = await verifyBrandAccess(brandId, userId, effectiveRole, orgId);
      if (!authorized) return toolResult({ error: 'Brand not found or access denied' });

      const { error } = await supabaseAdmin
        .from('brands')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', brandId);

      if (error) return toolResult({ error: error.message });
      return toolResult({ success: true, message: `Brand renamed to "${name}"` });
    }
  );

  const addProductToBrand = sdkTool(
    'addProductToBrand',
    'Add a product from the catalog to the brand.',
    {
      brandId: z.string().uuid(),
      productId: z.string().uuid(),
    },
    async ({ brandId, productId }) => {
      const { authorized } = await verifyBrandAccess(brandId, userId, effectiveRole, orgId);
      if (!authorized) return toolResult({ error: 'Brand not found or access denied' });

      const { error } = await supabaseAdmin
        .from('brand_products')
        .insert({ brand_id: brandId, product_id: productId, config: {} });

      if (error) {
        if (error.code === '23505') return toolResult({ error: 'Product already added to this brand' });
        return toolResult({ error: error.message });
      }
      return toolResult({ success: true, message: 'Product added to brand' });
    }
  );

  const removeProductFromBrand = sdkTool(
    'removeProductFromBrand',
    'Remove a product from the brand. REQUIRES user confirmation.',
    {
      brandId: z.string().uuid(),
      productId: z.string().uuid(),
      confirmed: z.boolean().default(false),
    },
    async ({ brandId, productId, confirmed }) => {
      if (!confirmed) {
        return toolResult({
          requiresConfirmation: true,
          action: 'remove_product',
          message: 'This will remove the product from the brand. Confirm?',
        });
      }

      const { authorized } = await verifyBrandAccess(brandId, userId, effectiveRole, orgId);
      if (!authorized) return toolResult({ error: 'Brand not found or access denied' });

      const { error } = await supabaseAdmin
        .from('brand_products')
        .delete()
        .eq('brand_id', brandId)
        .eq('product_id', productId);

      if (error) return toolResult({ error: error.message });
      return toolResult({ success: true, message: 'Product removed from brand' });
    }
  );

  const createBundle = sdkTool(
    'createBundle',
    'Create a new product bundle for a brand.',
    {
      brandId: z.string().uuid(),
      name: z.string().max(200),
      description: z.string().max(500).optional(),
      productIds: z.array(z.string().uuid()).min(2).max(10),
      discountPercent: z.number().min(0).max(50).default(10),
    },
    async ({ brandId, name, description, productIds, discountPercent }) => {
      const { authorized } = await verifyBrandAccess(brandId, userId, effectiveRole, orgId);
      if (!authorized) return toolResult({ error: 'Brand not found or access denied' });

      const { data: bundle, error } = await supabaseAdmin
        .from('brand_bundles')
        .insert({ brand_id: brandId, name, description, discount_percent: discountPercent })
        .select('id')
        .single();

      if (error) return toolResult({ error: error.message });

      const items = productIds.map((pid) => ({
        bundle_id: bundle.id,
        product_id: pid,
        quantity: 1,
      }));
      await supabaseAdmin.from('brand_bundle_items').insert(items);

      return toolResult({ success: true, bundleId: bundle.id, message: `Bundle "${name}" created with ${productIds.length} products` });
    }
  );

  return [
    { tool: updateBrandIdentity, name: 'updateBrandIdentity', category: 'brand_modify' },
    { tool: updateBrandName, name: 'updateBrandName', category: 'brand_modify' },
    { tool: addProductToBrand, name: 'addProductToBrand', category: 'brand_modify' },
    { tool: removeProductFromBrand, name: 'removeProductFromBrand', category: 'brand_modify' },
    { tool: createBundle, name: 'createBundle', category: 'brand_modify' },
  ];
}

function createGenerationTools(context) {
  const { userId, orgId, effectiveRole } = context;

  const regenerateLogos = sdkTool(
    'regenerateLogos',
    'Queue new logo generation for a brand. Costs credits. Check balance first.',
    {
      brandId: z.string().uuid(),
      count: z.number().int().min(1).max(8).default(4),
      refinementNotes: z.string().max(1000).optional(),
    },
    async ({ brandId, count, refinementNotes }) => {
      const { authorized } = await verifyBrandAccess(brandId, userId, effectiveRole, orgId);
      if (!authorized) return toolResult({ error: 'Brand not found or access denied' });

      // Check credits
      const { data: creditData } = await supabaseAdmin.rpc('get_credit_summary', { p_user_id: userId });
      const logoCredits = creditData?.find((c) => c.credit_type === 'logo');
      const remaining = logoCredits?.credits_remaining || 0;

      if (remaining < count) {
        return toolResult({
          error: 'insufficient_credits',
          creditsRequired: count,
          creditsRemaining: remaining,
          message: `Need ${count} logo credits but only have ${remaining}. Suggest upgrading plan.`,
        });
      }

      // Deduct and dispatch
      await supabaseAdmin.rpc('deduct_credits', { p_user_id: userId, p_amount: count });

      const result = await dispatchJob('logo-generation', {
        userId,
        brandId,
        count,
        refinementNotes: refinementNotes || null,
      }).catch((err) => ({ error: err.message }));

      if (result.error) return toolResult({ error: result.error });

      return toolResult({
        success: true,
        async: true,
        jobId: result.jobId,
        creditsDeducted: count,
        message: `Generating ${count} logos. You'll see progress in real-time. Credits remaining: ${remaining - count}.`,
      });
    }
  );

  const regenerateMockup = sdkTool(
    'regenerateMockup',
    'Queue mockup regeneration for a specific product. Costs 1 credit.',
    {
      brandId: z.string().uuid(),
      productId: z.string().uuid(),
      notes: z.string().max(1000).optional(),
    },
    async ({ brandId, productId, notes }) => {
      const { authorized } = await verifyBrandAccess(brandId, userId, effectiveRole, orgId);
      if (!authorized) return toolResult({ error: 'Brand not found or access denied' });

      const { data: creditData } = await supabaseAdmin.rpc('get_credit_summary', { p_user_id: userId });
      const mockupCredits = creditData?.find((c) => c.credit_type === 'mockup');
      const remaining = mockupCredits?.credits_remaining || 0;

      if (remaining < 1) {
        return toolResult({
          error: 'insufficient_credits',
          creditsRequired: 1,
          creditsRemaining: remaining,
          message: `Need 1 mockup credit but have ${remaining}. Suggest upgrading plan.`,
        });
      }

      await supabaseAdmin.rpc('deduct_credits', { p_user_id: userId, p_amount: 1 });

      const result = await dispatchJob('mockup-generation', {
        userId,
        brandId,
        productId,
        notes: notes || null,
      }).catch((err) => ({ error: err.message }));

      if (result.error) return toolResult({ error: result.error });

      return toolResult({
        success: true,
        async: true,
        jobId: result.jobId,
        message: `Mockup generation queued. Credits remaining: ${remaining - 1}.`,
      });
    }
  );

  const generateTaglines = sdkTool(
    'generateTaglines',
    'Generate tagline suggestions based on brand identity. No credit cost.',
    {
      brandId: z.string().uuid(),
      count: z.number().int().min(3).max(15).default(8),
      style: z.string().max(200).optional(),
    },
    async ({ brandId, count, style }) => {
      const { authorized, brand } = await verifyBrandAccess(brandId, userId, effectiveRole, orgId);
      if (!authorized) return toolResult({ error: 'Brand not found or access denied' });

      const identity = brand.wizard_state?.['brand-identity'] || {};
      // Inline Haiku call for fast text generation
      const prompt = `Generate ${count} creative taglines for a brand with these characteristics:
Name: ${brand.name}
Archetype: ${identity.archetype || 'not set'}
Vision: ${identity.vision || 'not set'}
Values: ${(identity.values || []).join(', ') || 'not set'}
${style ? `Style guidance: ${style}` : ''}

Return ONLY a JSON array of strings, no markdown, no explanation.`;

      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new Anthropic();
        const msg = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        });
        const text = msg.content[0]?.text || '[]';
        const taglines = JSON.parse(text);
        return toolResult({ success: true, taglines });
      } catch (err) {
        return toolResult({ error: `Tagline generation failed: ${err.message}` });
      }
    }
  );

  const generateBrandContent = sdkTool(
    'generateBrandContent',
    'Generate social media content (posts, captions, stories) in the brand voice. No credit cost.',
    {
      brandId: z.string().uuid(),
      platform: z.enum(['instagram', 'tiktok', 'twitter', 'general']),
      contentType: z.enum(['post', 'story', 'reel_script', 'announcement', 'promotional']),
      topic: z.string().max(500).optional(),
    },
    async ({ brandId, platform, contentType, topic }) => {
      const { authorized, brand } = await verifyBrandAccess(brandId, userId, effectiveRole, orgId);
      if (!authorized) return toolResult({ error: 'Brand not found or access denied' });

      const identity = brand.wizard_state?.['brand-identity'] || {};
      const voice = identity.voice || {};

      const prompt = `Write a ${platform} ${contentType} for brand "${brand.name}".
Brand voice: ${voice.tone || 'professional'}, ${voice.communicationStyle || 'engaging'}
Archetype: ${identity.archetype || 'not set'}
${topic ? `Topic: ${topic}` : 'Write about the brand in general'}

Return ONLY the content text, ready to post. Include relevant hashtags for ${platform}.`;

      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new Anthropic();
        const msg = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        });
        return toolResult({ success: true, content: msg.content[0]?.text, platform, contentType });
      } catch (err) {
        return toolResult({ error: `Content generation failed: ${err.message}` });
      }
    }
  );

  return [
    { tool: regenerateLogos, name: 'regenerateLogos', category: 'generation' },
    { tool: regenerateMockup, name: 'regenerateMockup', category: 'generation' },
    { tool: generateTaglines, name: 'generateTaglines', category: 'generation' },
    { tool: generateBrandContent, name: 'generateBrandContent', category: 'generation' },
  ];
}

function createAccountTools(context) {
  const { userId } = context;

  const getMyProfile = sdkTool(
    'getMyProfile',
    'Get the current user\'s profile: name, email, role, subscription tier.',
    {},
    async () => {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, role, subscription_tier, org_id, onboarding_done')
        .eq('id', userId)
        .single();
      if (error) return toolResult({ error: error.message });
      return toolResult({ profile: data });
    }
  );

  const getCreditBalance = sdkTool(
    'getCreditBalance',
    'Get the current user\'s generation credit balance.',
    {},
    async () => {
      const { data, error } = await supabaseAdmin.rpc('get_credit_summary', { p_user_id: userId });
      if (error) return toolResult({ error: error.message });
      return toolResult({ credits: data });
    }
  );

  const getSubscriptionInfo = sdkTool(
    'getSubscriptionInfo',
    'Get the current user\'s subscription details.',
    {},
    async () => {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('subscription_tier')
        .eq('id', userId)
        .single();
      if (error) return toolResult({ error: error.message });
      return toolResult({ subscription: data });
    }
  );

  return [
    { tool: getMyProfile, name: 'getMyProfile', category: 'account' },
    { tool: getCreditBalance, name: 'getCreditBalance', category: 'account' },
    { tool: getSubscriptionInfo, name: 'getSubscriptionInfo', category: 'account' },
  ];
}

// ═══════════════════════════════════════════════════════════════════════
// TIER 2: ORGANIZATION TOOLS (org admin/owner)
// ═══════════════════════════════════════════════════════════════════════

function createOrganizationTools(context) {
  const { userId, orgId } = context;

  const getOrganization = sdkTool(
    'getOrganization',
    'Get the user\'s organization details.',
    {},
    async () => {
      const { data, error } = await supabaseAdmin
        .from('organizations')
        .select('id, name, slug, billing_email, subscription_tier, created_at')
        .eq('id', orgId)
        .single();
      if (error) return toolResult({ error: error.message });
      return toolResult({ organization: data });
    }
  );

  const listOrgMembers = sdkTool(
    'listOrgMembers',
    'List all members in the organization with their roles.',
    { limit: z.number().int().min(1).max(100).default(50) },
    async ({ limit }) => {
      const { data, error } = await supabaseAdmin
        .from('organization_members')
        .select('id, user_id, role, joined_at, profiles(email, full_name)')
        .eq('org_id', orgId)
        .limit(limit);
      if (error) return toolResult({ error: error.message });
      return toolResult({ members: data, count: data.length });
    }
  );

  const listOrgBrands = sdkTool(
    'listOrgBrands',
    'List all brands across the organization.',
    {
      status: z.enum(['draft', 'active', 'archived', 'all']).default('all'),
      limit: z.number().int().min(1).max(100).default(50),
    },
    async ({ status, limit }) => {
      let query = supabaseAdmin
        .from('brands')
        .select('id, name, status, wizard_step, user_id, created_at, profiles(email, full_name)')
        .eq('org_id', orgId)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (status !== 'all') query = query.eq('status', status);
      const { data, error } = await query;
      if (error) return toolResult({ error: error.message });
      return toolResult({ brands: data, count: data.length });
    }
  );

  const inviteOrgMember = sdkTool(
    'inviteOrgMember',
    'Send an invitation to join the organization. REQUIRES confirmation.',
    {
      email: z.string().email(),
      role: z.enum(['member', 'manager', 'admin']).default('member'),
      confirmed: z.boolean().default(false),
    },
    async ({ email, role, confirmed }) => {
      if (!confirmed) {
        return toolResult({
          requiresConfirmation: true,
          action: 'invite_member',
          message: `This will send an invitation to ${email} as ${role}. Confirm?`,
        });
      }

      const { randomBytes } = await import('node:crypto');
      const token = randomBytes(32).toString('hex');

      const { error } = await supabaseAdmin
        .from('organization_invites')
        .insert({
          org_id: orgId,
          email,
          role,
          invited_by: userId,
          token,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

      if (error) {
        if (error.code === '23505') return toolResult({ error: 'An invite for this email already exists' });
        return toolResult({ error: error.message });
      }

      // Queue invite email
      await dispatchJob('email-send', {
        userId,
        templateId: 'org-invite',
        data: { email, role, token, orgId },
      }).catch((err) => logger.error({ err }, 'Failed to queue invite email'));

      return toolResult({ success: true, message: `Invitation sent to ${email} as ${role}` });
    }
  );

  const removeOrgMember = sdkTool(
    'removeOrgMember',
    'Remove a member from the organization. REQUIRES confirmation.',
    {
      memberId: z.string().uuid().describe('The user_id of the member to remove'),
      confirmed: z.boolean().default(false),
    },
    async ({ memberId, confirmed }) => {
      if (!confirmed) {
        return toolResult({
          requiresConfirmation: true,
          action: 'remove_member',
          message: 'This will remove the member from the organization and unassign their brands. Confirm?',
        });
      }

      const { error } = await supabaseAdmin
        .from('organization_members')
        .delete()
        .eq('org_id', orgId)
        .eq('user_id', memberId)
        .neq('role', 'owner');

      if (error) return toolResult({ error: error.message });

      // Clean up brand assignments
      await supabaseAdmin
        .from('brand_assignments')
        .delete()
        .eq('user_id', memberId);

      return toolResult({ success: true, message: 'Member removed from organization' });
    }
  );

  const updateOrgSettings = sdkTool(
    'updateOrgSettings',
    'Update organization settings (name, billing email).',
    {
      name: z.string().min(1).max(200).optional(),
      billingEmail: z.string().email().optional(),
    },
    async ({ name, billingEmail }) => {
      const updates = {};
      if (name) updates.name = name;
      if (billingEmail) updates.billing_email = billingEmail;
      updates.updated_at = new Date().toISOString();

      const { error } = await supabaseAdmin
        .from('organizations')
        .update(updates)
        .eq('id', orgId);

      if (error) return toolResult({ error: error.message });
      return toolResult({ success: true, message: 'Organization settings updated' });
    }
  );

  return [
    { tool: getOrganization, name: 'getOrganization', category: 'organization' },
    { tool: listOrgMembers, name: 'listOrgMembers', category: 'organization' },
    { tool: listOrgBrands, name: 'listOrgBrands', category: 'organization' },
    { tool: inviteOrgMember, name: 'inviteOrgMember', category: 'organization' },
    { tool: removeOrgMember, name: 'removeOrgMember', category: 'organization' },
    { tool: updateOrgSettings, name: 'updateOrgSettings', category: 'organization' },
  ];
}

// ═══════════════════════════════════════════════════════════════════════
// TIER 3: PLATFORM ADMIN TOOLS (super_admin)
// ═══════════════════════════════════════════════════════════════════════

function createPlatformAdminTools() {
  const adminListUsers = sdkTool(
    'adminListUsers',
    'List all users on the platform. Platform admin only.',
    {
      search: z.string().max(200).optional(),
      role: z.enum(['user', 'admin', 'super_admin', 'all']).default('all'),
      limit: z.number().int().min(1).max(100).default(50),
    },
    async ({ search, role, limit }) => {
      let query = supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, role, subscription_tier, org_id, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (role !== 'all') query = query.eq('role', role);
      if (search) query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);

      const { data, error } = await query;
      if (error) return toolResult({ error: error.message });
      return toolResult({ users: data, count: data.length });
    }
  );

  const adminListAllBrands = sdkTool(
    'adminListAllBrands',
    'List all brands across the platform. Platform admin only.',
    {
      status: z.enum(['draft', 'active', 'archived', 'all']).default('all'),
      search: z.string().max(200).optional(),
      limit: z.number().int().min(1).max(100).default(50),
    },
    async ({ status, search, limit }) => {
      let query = supabaseAdmin
        .from('brands')
        .select('id, name, status, wizard_step, user_id, org_id, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status !== 'all') query = query.eq('status', status);
      if (search) query = query.ilike('name', `%${search}%`);

      const { data, error } = await query;
      if (error) return toolResult({ error: error.message });
      return toolResult({ brands: data, count: data.length });
    }
  );

  const adminGetSystemMetrics = sdkTool(
    'adminGetSystemMetrics',
    'Get platform-wide metrics: total users, brands, credit usage.',
    {},
    async () => {
      const [usersRes, brandsRes, activeRes] = await Promise.all([
        supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('brands').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('brands').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      ]);

      return toolResult({
        totalUsers: usersRes.count || 0,
        totalBrands: brandsRes.count || 0,
        activeBrands: activeRes.count || 0,
      });
    }
  );

  const adminGrantCredits = sdkTool(
    'adminGrantCredits',
    'Grant generation credits to a user. REQUIRES confirmation.',
    {
      targetUserId: z.string().uuid(),
      amount: z.number().int().min(1).max(1000),
      reason: z.string().max(500),
      confirmed: z.boolean().default(false),
    },
    async ({ targetUserId, amount, reason, confirmed }) => {
      if (!confirmed) {
        return toolResult({
          requiresConfirmation: true,
          action: 'grant_credits',
          message: `This will grant ${amount} credits to user ${targetUserId}. Reason: ${reason}. Confirm?`,
        });
      }

      const { error } = await supabaseAdmin.rpc('refill_credits', {
        p_user_id: targetUserId,
        p_amount: amount,
      });

      if (error) return toolResult({ error: error.message });
      return toolResult({ success: true, message: `Granted ${amount} credits. Reason: ${reason}` });
    }
  );

  return [
    { tool: adminListUsers, name: 'adminListUsers', category: 'platform_admin' },
    { tool: adminListAllBrands, name: 'adminListAllBrands', category: 'platform_admin' },
    { tool: adminGetSystemMetrics, name: 'adminGetSystemMetrics', category: 'platform_admin' },
    { tool: adminGrantCredits, name: 'adminGrantCredits', category: 'platform_admin' },
  ];
}

// ═══════════════════════════════════════════════════════════════════════
// MCP SERVER FACTORY
// ═══════════════════════════════════════════════════════════════════════

/**
 * Create the chat agent MCP server with role-filtered tools.
 *
 * @param {Object} context
 * @param {string} context.userId
 * @param {string|null} context.orgId
 * @param {string} context.profileRole - profiles.role
 * @param {string|null} context.orgRole - organization_members.role
 * @returns {{ server: Object, toolNames: string[] }}
 */
export function createChatToolsServer({ userId, orgId, profileRole, orgRole }) {
  if (!createSdkMcpServer) {
    throw new Error('Anthropic Agent SDK not installed.');
  }

  const effectiveRole = getEffectiveRole(profileRole, orgRole);
  const allowedCategories = getAllowedCategories(effectiveRole);

  const ctx = { userId, orgId, effectiveRole };

  // Collect all tools from all tiers
  const allToolEntries = [
    ...createBrandReadTools(ctx),
    ...createBrandModifyTools(ctx),
    ...createGenerationTools(ctx),
    ...createAccountTools(ctx),
    ...createOrganizationTools(ctx),
    ...createPlatformAdminTools(),
  ];

  // Filter by role
  const filteredEntries = allToolEntries.filter((entry) =>
    allowedCategories.includes(entry.category)
  );

  const toolNames = filteredEntries.map((e) => e.name);
  const tools = filteredEntries.map((e) => e.tool);

  logger.info({
    userId,
    effectiveRole,
    toolCount: tools.length,
    categories: allowedCategories,
  }, 'Chat tools server created');

  const server = createSdkMcpServer({
    name: 'bmn-chat-tools',
    version: '2.0.0',
    tools,
  });

  return { server, toolNames };
}
