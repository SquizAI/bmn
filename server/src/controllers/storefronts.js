// server/src/controllers/storefronts.js
// Authenticated storefront management: CRUD, sections, testimonials, FAQs, analytics.

import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

// ── Default content generators ──────────────────────────────────────────────

/**
 * Generate default section content for a new storefront.
 * @param {string} brandName
 * @param {object} brandIdentity - color palette, fonts, logo, etc.
 * @returns {Record<string, object>}
 */
function getDefaultSectionContent(brandName, brandIdentity) {
  const logo = brandIdentity?.logoUrl || '';
  return {
    'hero': {
      headline: `Smarter Supplements. Real Results. Zero Guesswork.`,
      subheadline: `Strategic bundles designed to work together — perfectly timed and scientifically backed.`,
      ctaText: 'Shop All Bundles',
      ctaUrl: '#bundles',
      backgroundImageUrl: '',
      overlayOpacity: 0.4,
    },
    'trust-bar': {
      items: [
        { icon: 'shield-check', text: 'Third-Party Tested' },
        { icon: 'flag', text: 'Made in the USA' },
        { icon: 'badge-check', text: 'GMP Certified' },
      ],
    },
    'welcome': {
      title: `Welcome to ${brandName}`,
      body: `We believe supplementation should be simple, not overwhelming. That's why we created strategic bundles — products formulated to work together synergistically, timed for your daily routine, and priced to actually make sense. No more guessing what to take or when. Just real ingredients, real science, and real results you can feel.`,
      imageUrl: logo,
    },
    'bundle-grid': {
      title: 'Our Supplement Bundles',
      maxItems: 5,
      layout: 'grid',
    },
    'steps': {
      title: 'Three Simple Steps to Better Health',
      subtitle: 'Choose. Follow. Feel.',
      steps: [
        { title: 'Choose Your Goal', description: 'Pick the bundle that matches where you\'re at — energy, fitness, fat loss, sleep, or vitality.' },
        { title: 'Follow the Timing', description: 'Each bundle comes with a simple daily protocol. No confusion, just results.' },
        { title: 'Feel the Difference', description: 'Products designed to work together = bigger impact than taking them alone.' },
      ],
    },
    'stack-finder': {
      title: 'Find Your Perfect Stack',
      stacks: [],
    },
    'why-bundles': {
      title: 'Why Choose Bundles Over Individual Supplements?',
      reasons: [
        { icon: 'puzzle', title: 'Designed to Work Together', description: 'Products formulated for synergy. Combined effects are greater than taking them separately.' },
        { icon: 'piggy-bank', title: 'Save 15-20%', description: 'Better value than buying individual products. More impact for less money.' },
        { icon: 'clock', title: 'Simple Daily Routine', description: 'No guessing when to take what. Each bundle includes clear timing instructions.' },
      ],
    },
    'quality': {
      title: 'Quality You Can Trust',
      body: `Every ${brandName} product is third-party tested for purity and potency, manufactured in GMP-certified facilities, and made in the USA. We don't cut corners on quality — because your health deserves better.`,
      imageUrl: '',
      badges: ['Third-Party Tested', 'GMP Certified', 'Made in USA'],
    },
    'testimonials': {
      title: 'Real People. Real Results.',
    },
    'faq': {
      title: 'Frequently Asked Questions',
      subtitle: 'Got questions? We\'ve got answers.',
    },
    'about': {
      title: 'About Us',
      subtitle: 'From Nature to Nutrition — With Intention.',
      body: `At ${brandName}, we bridge the gap between natural wellness and modern performance. We believe supplements should work with your body — not against it — supporting balance, focus, and longevity. Every formula is crafted in the USA, third-party tested, and made with responsibly sourced ingredients.`,
      imageUrl: logo,
      ctaText: 'Shop Now',
      ctaUrl: '#bundles',
    },
    'contact': {
      title: 'Get in Touch',
      subtitle: 'Have questions? We\'d love to hear from you.',
      showPhone: false,
      showEmail: true,
    },
    'products': {
      title: 'All Products',
      categoryFilter: '',
      layout: 'grid',
      maxItems: 50,
    },
  };
}

/** @returns {Array<{quote: string, author_name: string, author_title: string}>} */
function getDefaultTestimonials() {
  return [
    { quote: 'The Morning Momentum Stack is a game changer. I actually have energy all day without the caffeine crash.', author_name: 'Happy Customer', author_title: 'Verified Buyer' },
    { quote: 'Best workout stack I\'ve ever used. My strength gains have been incredible.', author_name: 'Happy Customer', author_title: 'Verified Buyer' },
    { quote: 'Finally sleeping through the night. This stack changed everything for my recovery.', author_name: 'Happy Customer', author_title: 'Verified Buyer' },
    { quote: 'This gave me the clean boost I needed. It\'s become part of my daily routine.', author_name: 'Happy Customer', author_title: 'Verified Buyer' },
  ];
}

/**
 * @param {string} brandName
 * @returns {Array<{question: string, answer: string}>}
 */
function getDefaultFaqs(brandName) {
  return [
    { question: `What is ${brandName}?`, answer: `${brandName} is a premium wellness brand focused on bridging the gap between natural nutrition and modern performance.` },
    { question: 'Where are your products made?', answer: 'All products are formulated and manufactured in the USA, using responsibly sourced ingredients and produced in GMP-certified, third-party-tested facilities.' },
    { question: 'Are your supplements third-party tested?', answer: 'Yes. Every batch is independently tested to verify ingredient integrity, purity, and quality.' },
    { question: 'Do your products contain artificial additives?', answer: 'Our formulations are created with clean, science-driven ingredients. We avoid unnecessary fillers, artificial colors, or harsh additives whenever possible.' },
    { question: 'How long will it take to see results?', answer: 'Consistency is key — most customers begin to notice benefits within a few weeks of daily use.' },
    { question: 'Are your products suitable for both men and women?', answer: 'Yes! Our product line supports a wide range of goals for men and women alike.' },
    { question: 'Are your products FDA-approved?', answer: 'Dietary supplements are not evaluated or approved by the FDA. However, all products are manufactured in FDA-registered facilities that follow Good Manufacturing Practices (GMP).' },
  ];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Verify a storefront belongs to the authenticated user.
 * @param {string} storefrontId
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function verifyOwnership(storefrontId, userId) {
  const { data, error } = await supabaseAdmin
    .from('storefronts')
    .select('*')
    .eq('id', storefrontId)
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return data;
}

/**
 * @param {object} row
 * @returns {object}
 */
function toStorefrontResponse(row) {
  return {
    id: row.id,
    brandId: row.brand_id,
    slug: row.slug,
    customDomain: row.custom_domain,
    themeId: row.theme_id,
    status: row.status,
    settings: row.settings,
    whiteLabelSettings: row.settings?.white_label || {},
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * @param {object} row
 * @returns {object}
 */
function toSectionResponse(row) {
  return {
    id: row.id,
    storefrontId: row.storefront_id,
    sectionType: row.section_type,
    title: row.title,
    content: row.content,
    sortOrder: row.sort_order,
    isVisible: row.is_visible,
    settings: row.settings,
  };
}

// ── Storefront CRUD ─────────────────────────────────────────────────────────

/**
 * POST /api/v1/storefronts
 * Create a new storefront for a brand.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function createStorefront(req, res, next) {
  try {
    const userId = req.user.id;
    const { brandId, slug, themeId } = req.body;

    // Verify brand belongs to user
    const { data: brand, error: brandErr } = await supabaseAdmin
      .from('brands')
      .select('id, name, wizard_state')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single();

    if (brandErr || !brand) {
      return res.status(404).json({ success: false, error: 'Brand not found or access denied' });
    }

    // Check slug uniqueness
    const { data: existing } = await supabaseAdmin
      .from('storefronts')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      return res.status(409).json({ success: false, error: 'Slug is already taken' });
    }

    // Check brand doesn't already have a storefront
    const { data: existingStore } = await supabaseAdmin
      .from('storefronts')
      .select('id')
      .eq('brand_id', brandId)
      .single();

    if (existingStore) {
      return res.status(409).json({ success: false, error: 'Brand already has a storefront' });
    }

    // Load theme defaults
    let themeDefaults = null;
    const resolvedThemeId = themeId || null;
    if (resolvedThemeId) {
      const { data: theme } = await supabaseAdmin
        .from('storefront_themes')
        .select('*')
        .eq('id', resolvedThemeId)
        .single();
      themeDefaults = theme;
    }

    // If no theme specified, use first active theme
    if (!themeDefaults) {
      const { data: defaultTheme } = await supabaseAdmin
        .from('storefront_themes')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      themeDefaults = defaultTheme;
    }

    // Create storefront
    const { data: storefront, error: createErr } = await supabaseAdmin
      .from('storefronts')
      .insert({
        brand_id: brandId,
        user_id: userId,
        slug,
        theme_id: themeDefaults?.id || null,
        status: 'draft',
        settings: {},
      })
      .select('*')
      .single();

    if (createErr) throw createErr;

    // Extract brand identity for content generation
    const ws = brand.wizard_state || {};
    const identityState = ws['brand-identity'];
    const selectedDir = identityState?.directions?.find(
      (d) => d.id === identityState?.selectedDirectionId,
    ) || identityState?.directions?.[0] || null;

    const brandIdentity = {
      logoUrl: selectedDir?.logoUrl || '',
      colors: selectedDir?.colorPalette || [],
      fonts: selectedDir?.fonts || {},
    };

    // Get logo URL from brand assets
    const { data: logoAsset } = await supabaseAdmin
      .from('brand_assets')
      .select('url')
      .eq('brand_id', brandId)
      .eq('asset_type', 'logo')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (logoAsset?.url) {
      brandIdentity.logoUrl = logoAsset.url;
    }

    // Create default sections from theme
    const defaultContent = getDefaultSectionContent(brand.name, brandIdentity);
    const sectionDefs = themeDefaults?.default_sections || [
      { type: 'hero', sort_order: 0 },
      { type: 'trust-bar', sort_order: 1 },
      { type: 'welcome', sort_order: 2 },
      { type: 'bundle-grid', sort_order: 3 },
      { type: 'steps', sort_order: 4 },
      { type: 'stack-finder', sort_order: 5 },
      { type: 'why-bundles', sort_order: 6 },
      { type: 'quality', sort_order: 7 },
      { type: 'testimonials', sort_order: 8 },
      { type: 'faq', sort_order: 9 },
      { type: 'about', sort_order: 10 },
      { type: 'contact', sort_order: 11 },
    ];

    const sections = sectionDefs.map((def) => ({
      storefront_id: storefront.id,
      section_type: def.type,
      title: null,
      content: defaultContent[def.type] || {},
      sort_order: def.sort_order,
      is_visible: true,
      settings: {},
    }));

    if (sections.length > 0) {
      const { error: sectErr } = await supabaseAdmin
        .from('storefront_sections')
        .insert(sections);
      if (sectErr) logger.warn({ err: sectErr }, 'Failed to create default sections');
    }

    // Create default testimonials
    const defaultTestimonials = getDefaultTestimonials().map((t, i) => ({
      storefront_id: storefront.id,
      quote: t.quote,
      author_name: t.author_name,
      author_title: t.author_title,
      sort_order: i,
      is_visible: true,
    }));

    const { error: testErr } = await supabaseAdmin
      .from('storefront_testimonials')
      .insert(defaultTestimonials);
    if (testErr) logger.warn({ err: testErr }, 'Failed to create default testimonials');

    // Create default FAQs
    const defaultFaqs = getDefaultFaqs(brand.name).map((f, i) => ({
      storefront_id: storefront.id,
      question: f.question,
      answer: f.answer,
      sort_order: i,
      is_visible: true,
    }));

    const { error: faqErr } = await supabaseAdmin
      .from('storefront_faqs')
      .insert(defaultFaqs);
    if (faqErr) logger.warn({ err: faqErr }, 'Failed to create default FAQs');

    logger.info({ storefrontId: storefront.id, brandId, slug }, 'Storefront created');

    return res.status(201).json({
      success: true,
      data: toStorefrontResponse(storefront),
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/storefronts
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function listStorefronts(req, res, next) {
  try {
    const userId = req.user.id;
    const { data, error } = await supabaseAdmin
      .from('storefronts')
      .select('*, brands(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({
      success: true,
      data: (data || []).map((row) => ({
        ...toStorefrontResponse(row),
        brandName: row.brands?.name || null,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/storefronts/:storefrontId
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getStorefront(req, res, next) {
  try {
    const userId = req.user.id;
    const { storefrontId } = req.params;

    const storefront = await verifyOwnership(storefrontId, userId);
    if (!storefront) {
      return res.status(404).json({ success: false, error: 'Storefront not found' });
    }

    // Fetch related data in parallel
    const [sectionsRes, testimonialsRes, faqsRes, themeRes, customDomainRes] = await Promise.all([
      supabaseAdmin.from('storefront_sections')
        .select('*').eq('storefront_id', storefrontId).order('sort_order'),
      supabaseAdmin.from('storefront_testimonials')
        .select('*').eq('storefront_id', storefrontId).order('sort_order'),
      supabaseAdmin.from('storefront_faqs')
        .select('*').eq('storefront_id', storefrontId).order('sort_order'),
      storefront.theme_id
        ? supabaseAdmin.from('storefront_themes').select('*').eq('id', storefront.theme_id).single()
        : Promise.resolve({ data: null }),
      supabaseAdmin.from('custom_domains')
        .select('id, domain, verification_status, ssl_status, is_active, verified_at')
        .eq('storefront_id', storefrontId)
        .single(),
    ]);

    return res.json({
      success: true,
      data: {
        ...toStorefrontResponse(storefront),
        sections: (sectionsRes.data || []).map(toSectionResponse),
        testimonials: (testimonialsRes.data || []).map((t) => ({
          id: t.id, quote: t.quote, authorName: t.author_name,
          authorTitle: t.author_title, authorImageUrl: t.author_image_url,
          sortOrder: t.sort_order, isVisible: t.is_visible,
        })),
        faqs: (faqsRes.data || []).map((f) => ({
          id: f.id, question: f.question, answer: f.answer,
          sortOrder: f.sort_order, isVisible: f.is_visible,
        })),
        theme: themeRes.data ? {
          id: themeRes.data.id, name: themeRes.data.name, slug: themeRes.data.slug,
          baseStyles: themeRes.data.base_styles,
        } : null,
        customDomain: customDomainRes.data ? {
          id: customDomainRes.data.id,
          domain: customDomainRes.data.domain,
          verificationStatus: customDomainRes.data.verification_status,
          sslStatus: customDomainRes.data.ssl_status,
          isActive: customDomainRes.data.is_active,
          verifiedAt: customDomainRes.data.verified_at,
        } : null,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/v1/storefronts/:storefrontId
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function updateStorefront(req, res, next) {
  try {
    const userId = req.user.id;
    const { storefrontId } = req.params;

    const storefront = await verifyOwnership(storefrontId, userId);
    if (!storefront) {
      return res.status(404).json({ success: false, error: 'Storefront not found' });
    }

    const updates = {};
    if (req.body.slug !== undefined) {
      // Check slug uniqueness
      const { data: existing } = await supabaseAdmin
        .from('storefronts').select('id').eq('slug', req.body.slug).neq('id', storefrontId).single();
      if (existing) {
        return res.status(409).json({ success: false, error: 'Slug is already taken' });
      }
      updates.slug = req.body.slug;
    }
    if (req.body.themeId !== undefined) updates.theme_id = req.body.themeId;
    if (req.body.settings !== undefined) {
      updates.settings = { ...storefront.settings, ...req.body.settings };
    }

    const { data, error } = await supabaseAdmin
      .from('storefronts')
      .update(updates)
      .eq('id', storefrontId)
      .select('*')
      .single();

    if (error) throw error;

    return res.json({ success: true, data: toStorefrontResponse(data) });
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/v1/storefronts/:storefrontId
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function deleteStorefront(req, res, next) {
  try {
    const userId = req.user.id;
    const { storefrontId } = req.params;

    const storefront = await verifyOwnership(storefrontId, userId);
    if (!storefront) {
      return res.status(404).json({ success: false, error: 'Storefront not found' });
    }

    const { error } = await supabaseAdmin
      .from('storefronts')
      .delete()
      .eq('id', storefrontId);

    if (error) throw error;

    logger.info({ storefrontId }, 'Storefront deleted');
    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/v1/storefronts/:storefrontId/publish
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function publishStorefront(req, res, next) {
  try {
    const userId = req.user.id;
    const { storefrontId } = req.params;

    const storefront = await verifyOwnership(storefrontId, userId);
    if (!storefront) {
      return res.status(404).json({ success: false, error: 'Storefront not found' });
    }

    const { data, error } = await supabaseAdmin
      .from('storefronts')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', storefrontId)
      .select('*')
      .single();

    if (error) throw error;

    logger.info({ storefrontId, slug: data.slug }, 'Storefront published');
    return res.json({ success: true, data: toStorefrontResponse(data) });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/v1/storefronts/:storefrontId/unpublish
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function unpublishStorefront(req, res, next) {
  try {
    const userId = req.user.id;
    const { storefrontId } = req.params;

    const storefront = await verifyOwnership(storefrontId, userId);
    if (!storefront) {
      return res.status(404).json({ success: false, error: 'Storefront not found' });
    }

    const { data, error } = await supabaseAdmin
      .from('storefronts')
      .update({ status: 'draft' })
      .eq('id', storefrontId)
      .select('*')
      .single();

    if (error) throw error;

    logger.info({ storefrontId }, 'Storefront unpublished');
    return res.json({ success: true, data: toStorefrontResponse(data) });
  } catch (err) {
    return next(err);
  }
}

// ── Section Management ──────────────────────────────────────────────────────

/**
 * GET /api/v1/storefronts/:storefrontId/sections
 */
export async function listSections(req, res, next) {
  try {
    const userId = req.user.id;
    const { storefrontId } = req.params;
    if (!(await verifyOwnership(storefrontId, userId))) {
      return res.status(404).json({ success: false, error: 'Storefront not found' });
    }

    const { data, error } = await supabaseAdmin
      .from('storefront_sections')
      .select('*')
      .eq('storefront_id', storefrontId)
      .order('sort_order');

    if (error) throw error;
    return res.json({ success: true, data: (data || []).map(toSectionResponse) });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/v1/storefronts/:storefrontId/sections
 */
export async function createSection(req, res, next) {
  try {
    const userId = req.user.id;
    const { storefrontId } = req.params;
    if (!(await verifyOwnership(storefrontId, userId))) {
      return res.status(404).json({ success: false, error: 'Storefront not found' });
    }

    const { sectionType, title, content, sortOrder, isVisible, settings } = req.body;

    // If no sortOrder, append to end
    let resolvedOrder = sortOrder;
    if (resolvedOrder === undefined) {
      const { data: last } = await supabaseAdmin
        .from('storefront_sections')
        .select('sort_order')
        .eq('storefront_id', storefrontId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();
      resolvedOrder = (last?.sort_order ?? -1) + 1;
    }

    const { data, error } = await supabaseAdmin
      .from('storefront_sections')
      .insert({
        storefront_id: storefrontId,
        section_type: sectionType,
        title: title || null,
        content,
        sort_order: resolvedOrder,
        is_visible: isVisible,
        settings,
      })
      .select('*')
      .single();

    if (error) throw error;
    return res.status(201).json({ success: true, data: toSectionResponse(data) });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/v1/storefronts/:storefrontId/sections/:sectionId
 */
export async function updateSection(req, res, next) {
  try {
    const userId = req.user.id;
    const { storefrontId, sectionId } = req.params;
    if (!(await verifyOwnership(storefrontId, userId))) {
      return res.status(404).json({ success: false, error: 'Storefront not found' });
    }

    const updates = {};
    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.content !== undefined) updates.content = req.body.content;
    if (req.body.sortOrder !== undefined) updates.sort_order = req.body.sortOrder;
    if (req.body.isVisible !== undefined) updates.is_visible = req.body.isVisible;
    if (req.body.settings !== undefined) updates.settings = req.body.settings;

    const { data, error } = await supabaseAdmin
      .from('storefront_sections')
      .update(updates)
      .eq('id', sectionId)
      .eq('storefront_id', storefrontId)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Section not found' });
    return res.json({ success: true, data: toSectionResponse(data) });
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/v1/storefronts/:storefrontId/sections/:sectionId
 */
export async function deleteSection(req, res, next) {
  try {
    const userId = req.user.id;
    const { storefrontId, sectionId } = req.params;
    if (!(await verifyOwnership(storefrontId, userId))) {
      return res.status(404).json({ success: false, error: 'Storefront not found' });
    }

    const { error } = await supabaseAdmin
      .from('storefront_sections')
      .delete()
      .eq('id', sectionId)
      .eq('storefront_id', storefrontId);

    if (error) throw error;
    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/v1/storefronts/:storefrontId/sections/reorder
 */
export async function reorderSections(req, res, next) {
  try {
    const userId = req.user.id;
    const { storefrontId } = req.params;
    if (!(await verifyOwnership(storefrontId, userId))) {
      return res.status(404).json({ success: false, error: 'Storefront not found' });
    }

    const { sectionIds } = req.body;

    // Update sort_order for each section
    const updates = sectionIds.map((id, index) =>
      supabaseAdmin
        .from('storefront_sections')
        .update({ sort_order: index })
        .eq('id', id)
        .eq('storefront_id', storefrontId),
    );

    await Promise.all(updates);

    // Fetch updated sections
    const { data, error } = await supabaseAdmin
      .from('storefront_sections')
      .select('*')
      .eq('storefront_id', storefrontId)
      .order('sort_order');

    if (error) throw error;
    return res.json({ success: true, data: (data || []).map(toSectionResponse) });
  } catch (err) {
    return next(err);
  }
}

// ── Testimonials ────────────────────────────────────────────────────────────

/** GET /api/v1/storefronts/:storefrontId/testimonials */
export async function listTestimonials(req, res, next) {
  try {
    const userId = req.user.id;
    const { storefrontId } = req.params;
    if (!(await verifyOwnership(storefrontId, userId))) {
      return res.status(404).json({ success: false, error: 'Storefront not found' });
    }

    const { data, error } = await supabaseAdmin
      .from('storefront_testimonials')
      .select('*')
      .eq('storefront_id', storefrontId)
      .order('sort_order');

    if (error) throw error;
    return res.json({
      success: true,
      data: (data || []).map((t) => ({
        id: t.id, quote: t.quote, authorName: t.author_name,
        authorTitle: t.author_title, authorImageUrl: t.author_image_url,
        sortOrder: t.sort_order, isVisible: t.is_visible,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/v1/storefronts/:storefrontId/testimonials */
export async function createTestimonial(req, res, next) {
  try {
    const userId = req.user.id;
    const { storefrontId } = req.params;
    if (!(await verifyOwnership(storefrontId, userId))) {
      return res.status(404).json({ success: false, error: 'Storefront not found' });
    }

    const { data, error } = await supabaseAdmin
      .from('storefront_testimonials')
      .insert({
        storefront_id: storefrontId,
        quote: req.body.quote,
        author_name: req.body.authorName,
        author_title: req.body.authorTitle || null,
        author_image_url: req.body.authorImageUrl || null,
        sort_order: req.body.sortOrder ?? 0,
        is_visible: req.body.isVisible ?? true,
      })
      .select('*')
      .single();

    if (error) throw error;
    return res.status(201).json({
      success: true,
      data: {
        id: data.id, quote: data.quote, authorName: data.author_name,
        authorTitle: data.author_title, authorImageUrl: data.author_image_url,
        sortOrder: data.sort_order, isVisible: data.is_visible,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/** PATCH /api/v1/storefronts/:storefrontId/testimonials/:testimonialId */
export async function updateTestimonial(req, res, next) {
  try {
    const userId = req.user.id;
    const { storefrontId, testimonialId } = req.params;
    if (!(await verifyOwnership(storefrontId, userId))) {
      return res.status(404).json({ success: false, error: 'Storefront not found' });
    }

    const updates = {};
    if (req.body.quote !== undefined) updates.quote = req.body.quote;
    if (req.body.authorName !== undefined) updates.author_name = req.body.authorName;
    if (req.body.authorTitle !== undefined) updates.author_title = req.body.authorTitle;
    if (req.body.authorImageUrl !== undefined) updates.author_image_url = req.body.authorImageUrl;
    if (req.body.sortOrder !== undefined) updates.sort_order = req.body.sortOrder;
    if (req.body.isVisible !== undefined) updates.is_visible = req.body.isVisible;

    const { data, error } = await supabaseAdmin
      .from('storefront_testimonials')
      .update(updates)
      .eq('id', testimonialId)
      .eq('storefront_id', storefrontId)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Testimonial not found' });
    return res.json({
      success: true,
      data: {
        id: data.id, quote: data.quote, authorName: data.author_name,
        authorTitle: data.author_title, authorImageUrl: data.author_image_url,
        sortOrder: data.sort_order, isVisible: data.is_visible,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/** DELETE /api/v1/storefronts/:storefrontId/testimonials/:testimonialId */
export async function deleteTestimonial(req, res, next) {
  try {
    const userId = req.user.id;
    const { storefrontId, testimonialId } = req.params;
    if (!(await verifyOwnership(storefrontId, userId))) {
      return res.status(404).json({ success: false, error: 'Storefront not found' });
    }

    const { error } = await supabaseAdmin
      .from('storefront_testimonials')
      .delete()
      .eq('id', testimonialId)
      .eq('storefront_id', storefrontId);

    if (error) throw error;
    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    return next(err);
  }
}

// ── FAQs ────────────────────────────────────────────────────────────────────

/** GET /api/v1/storefronts/:storefrontId/faqs */
export async function listFaqs(req, res, next) {
  try {
    const userId = req.user.id;
    const { storefrontId } = req.params;
    if (!(await verifyOwnership(storefrontId, userId))) {
      return res.status(404).json({ success: false, error: 'Storefront not found' });
    }

    const { data, error } = await supabaseAdmin
      .from('storefront_faqs')
      .select('*')
      .eq('storefront_id', storefrontId)
      .order('sort_order');

    if (error) throw error;
    return res.json({
      success: true,
      data: (data || []).map((f) => ({
        id: f.id, question: f.question, answer: f.answer,
        sortOrder: f.sort_order, isVisible: f.is_visible,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/v1/storefronts/:storefrontId/faqs */
export async function createFaq(req, res, next) {
  try {
    const userId = req.user.id;
    const { storefrontId } = req.params;
    if (!(await verifyOwnership(storefrontId, userId))) {
      return res.status(404).json({ success: false, error: 'Storefront not found' });
    }

    const { data, error } = await supabaseAdmin
      .from('storefront_faqs')
      .insert({
        storefront_id: storefrontId,
        question: req.body.question,
        answer: req.body.answer,
        sort_order: req.body.sortOrder ?? 0,
        is_visible: req.body.isVisible ?? true,
      })
      .select('*')
      .single();

    if (error) throw error;
    return res.status(201).json({
      success: true,
      data: {
        id: data.id, question: data.question, answer: data.answer,
        sortOrder: data.sort_order, isVisible: data.is_visible,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/** PATCH /api/v1/storefronts/:storefrontId/faqs/:faqId */
export async function updateFaq(req, res, next) {
  try {
    const userId = req.user.id;
    const { storefrontId, faqId } = req.params;
    if (!(await verifyOwnership(storefrontId, userId))) {
      return res.status(404).json({ success: false, error: 'Storefront not found' });
    }

    const updates = {};
    if (req.body.question !== undefined) updates.question = req.body.question;
    if (req.body.answer !== undefined) updates.answer = req.body.answer;
    if (req.body.sortOrder !== undefined) updates.sort_order = req.body.sortOrder;
    if (req.body.isVisible !== undefined) updates.is_visible = req.body.isVisible;

    const { data, error } = await supabaseAdmin
      .from('storefront_faqs')
      .update(updates)
      .eq('id', faqId)
      .eq('storefront_id', storefrontId)
      .select('*')
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'FAQ not found' });
    return res.json({
      success: true,
      data: {
        id: data.id, question: data.question, answer: data.answer,
        sortOrder: data.sort_order, isVisible: data.is_visible,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/** DELETE /api/v1/storefronts/:storefrontId/faqs/:faqId */
export async function deleteFaq(req, res, next) {
  try {
    const userId = req.user.id;
    const { storefrontId, faqId } = req.params;
    if (!(await verifyOwnership(storefrontId, userId))) {
      return res.status(404).json({ success: false, error: 'Storefront not found' });
    }

    const { error } = await supabaseAdmin
      .from('storefront_faqs')
      .delete()
      .eq('id', faqId)
      .eq('storefront_id', storefrontId);

    if (error) throw error;
    return res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    return next(err);
  }
}

// ── Analytics & Contacts ────────────────────────────────────────────────────

/** GET /api/v1/storefronts/:storefrontId/analytics */
export async function getAnalytics(req, res, next) {
  try {
    const userId = req.user.id;
    const { storefrontId } = req.params;
    if (!(await verifyOwnership(storefrontId, userId))) {
      return res.status(404).json({ success: false, error: 'Storefront not found' });
    }

    const period = req.query.period || '30d';
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabaseAdmin
      .from('storefront_analytics')
      .select('*')
      .eq('storefront_id', storefrontId)
      .gte('date', since.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (error) throw error;

    const rows = data || [];
    const totals = rows.reduce(
      (acc, r) => ({
        pageViews: acc.pageViews + r.page_views,
        uniqueVisitors: acc.uniqueVisitors + r.unique_visitors,
        productViews: acc.productViews + r.product_views,
        addToCarts: acc.addToCarts + r.add_to_carts,
        checkouts: acc.checkouts + r.checkouts,
        revenue: acc.revenue + Number(r.revenue_cents),
      }),
      { pageViews: 0, uniqueVisitors: 0, productViews: 0, addToCarts: 0, checkouts: 0, revenue: 0 },
    );

    return res.json({
      success: true,
      data: {
        period,
        totals,
        daily: rows.map((r) => ({
          date: r.date,
          pageViews: r.page_views,
          uniqueVisitors: r.unique_visitors,
          productViews: r.product_views,
          addToCarts: r.add_to_carts,
          checkouts: r.checkouts,
          revenueCents: Number(r.revenue_cents),
        })),
      },
    });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/v1/storefronts/:storefrontId/contacts */
export async function listContacts(req, res, next) {
  try {
    const userId = req.user.id;
    const { storefrontId } = req.params;
    if (!(await verifyOwnership(storefrontId, userId))) {
      return res.status(404).json({ success: false, error: 'Storefront not found' });
    }

    const { data, error } = await supabaseAdmin
      .from('storefront_contacts')
      .select('*')
      .eq('storefront_id', storefrontId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return res.json({
      success: true,
      data: (data || []).map((c) => ({
        id: c.id, name: c.name, email: c.email, message: c.message,
        syncedToCrm: c.synced_to_crm, createdAt: c.created_at,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

// ── Themes (public) ─────────────────────────────────────────────────────────

/** GET /api/v1/storefronts/themes */
export async function listThemes(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('storefront_themes')
      .select('*')
      .eq('is_active', true)
      .order('created_at');

    if (error) throw error;
    return res.json({
      success: true,
      data: (data || []).map((t) => ({
        id: t.id, name: t.name, slug: t.slug, description: t.description,
        previewImageUrl: t.preview_image_url, baseStyles: t.base_styles,
      })),
    });
  } catch (err) {
    return next(err);
  }
}
