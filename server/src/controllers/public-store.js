// server/src/controllers/public-store.js
// Public storefront API — no authentication required.
// Serves published storefront data, cart, checkout, contact, analytics.

import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve a published storefront by slug.
 * @param {string} slug
 * @returns {Promise<object|null>}
 */
async function resolveStorefront(slug) {
  const { data, error } = await supabaseAdmin
    .from('storefronts')
    .select('*, brands(id, name, wizard_state)')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (error || !data) return null;
  return data;
}

// ── Public Store Data ───────────────────────────────────────────────────────

/**
 * GET /api/v1/store/:slug
 * Returns everything needed to render the full storefront in a single request.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getPublicStore(req, res, next) {
  try {
    const { slug } = req.params;
    const storefront = await resolveStorefront(slug);

    if (!storefront) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }

    // Fetch all related data in parallel
    const [sectionsRes, testimonialsRes, faqsRes, themeRes, logoRes] = await Promise.all([
      supabaseAdmin
        .from('storefront_sections')
        .select('*')
        .eq('storefront_id', storefront.id)
        .eq('is_visible', true)
        .order('sort_order'),
      supabaseAdmin
        .from('storefront_testimonials')
        .select('*')
        .eq('storefront_id', storefront.id)
        .eq('is_visible', true)
        .order('sort_order'),
      supabaseAdmin
        .from('storefront_faqs')
        .select('*')
        .eq('storefront_id', storefront.id)
        .eq('is_visible', true)
        .order('sort_order'),
      storefront.theme_id
        ? supabaseAdmin.from('storefront_themes').select('*').eq('id', storefront.theme_id).single()
        : Promise.resolve({ data: null }),
      supabaseAdmin
        .from('brand_assets')
        .select('url, thumbnail_url')
        .eq('brand_id', storefront.brands.id)
        .eq('asset_type', 'logo')
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
    ]);

    // Extract brand identity from wizard_state
    const ws = storefront.brands?.wizard_state || {};
    const identityState = ws['brand-identity'];
    const selectedDir = identityState?.directions?.find(
      (d) => d.id === identityState?.selectedDirectionId,
    ) || identityState?.directions?.[0] || null;

    const brandIdentity = {
      name: storefront.brands?.name || '',
      logoUrl: logoRes.data?.url || logoRes.data?.thumbnail_url || '',
      colorPalette: (selectedDir?.colorPalette || []).map((c) => ({
        hex: c.hex || c.color || '',
        name: c.name || '',
        role: c.role || 'accent',
      })),
      fonts: {
        primary: selectedDir?.fonts?.primary || selectedDir?.typography?.primary || 'Inter',
        secondary: selectedDir?.fonts?.secondary || selectedDir?.typography?.secondary || 'Space Grotesk',
      },
      archetype: selectedDir?.archetype || '',
    };

    return res.json({
      success: true,
      data: {
        storefront: {
          id: storefront.id,
          slug: storefront.slug,
          status: storefront.status,
          settings: storefront.settings,
        },
        brand: brandIdentity,
        theme: themeRes.data ? {
          id: themeRes.data.id,
          name: themeRes.data.name,
          slug: themeRes.data.slug,
          baseStyles: themeRes.data.base_styles,
        } : null,
        sections: (sectionsRes.data || []).map((s) => ({
          id: s.id,
          sectionType: s.section_type,
          title: s.title,
          content: s.content,
          sortOrder: s.sort_order,
          settings: s.settings,
        })),
        testimonials: (testimonialsRes.data || []).map((t) => ({
          id: t.id,
          quote: t.quote,
          authorName: t.author_name,
          authorTitle: t.author_title,
          authorImageUrl: t.author_image_url,
        })),
        faqs: (faqsRes.data || []).map((f) => ({
          id: f.id,
          question: f.question,
          answer: f.answer,
        })),
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/store/:slug/products
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getStoreProducts(req, res, next) {
  try {
    const { slug } = req.params;
    const storefront = await resolveStorefront(slug);
    if (!storefront) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }

    const brandId = storefront.brands.id;
    const { category, limit, offset } = req.query;

    // Get brand's selected products
    const query = supabaseAdmin
      .from('brand_products')
      .select('product_id, products(*)')
      .eq('brand_id', brandId);

    const { data: brandProducts, error } = await query;
    if (error) throw error;

    let products = (brandProducts || [])
      .map((bp) => bp.products)
      .filter(Boolean);

    // Apply category filter
    if (category) {
      products = products.filter((p) => p.category === category);
    }

    // Apply pagination
    const total = products.length;
    const sliced = products.slice(offset || 0, (offset || 0) + (limit || 50));

    return res.json({
      success: true,
      data: {
        items: sliced.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          category: p.category,
          imageUrl: p.image_url || p.mockup_template_url,
          sku: p.sku,
        })),
        total,
        limit: limit || 50,
        offset: offset || 0,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/store/:slug/products/:productId
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getStoreProduct(req, res, next) {
  try {
    const { slug, productId } = req.params;
    const storefront = await resolveStorefront(slug);
    if (!storefront) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }

    // Verify product belongs to this brand
    const { data: bp } = await supabaseAdmin
      .from('brand_products')
      .select('product_id')
      .eq('brand_id', storefront.brands.id)
      .eq('product_id', productId)
      .single();

    if (!bp) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error || !product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Get brand-specific mockup assets for this product
    const { data: mockups } = await supabaseAdmin
      .from('brand_assets')
      .select('url, thumbnail_url, metadata')
      .eq('brand_id', storefront.brands.id)
      .eq('asset_type', 'mockup')
      .contains('metadata', { product_id: productId });

    return res.json({
      success: true,
      data: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        category: product.category,
        sku: product.sku,
        imageUrl: product.image_url || product.mockup_template_url,
        images: (mockups || []).map((m) => m.url || m.thumbnail_url),
        metadata: product.metadata || {},
      },
    });
  } catch (err) {
    return next(err);
  }
}

// ── Cart ────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/store/:slug/cart
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function createOrUpdateCart(req, res, next) {
  try {
    const { slug } = req.params;
    const storefront = await resolveStorefront(slug);
    if (!storefront) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }

    const { sessionId, items } = req.body;

    // Validate product IDs and get prices
    const productIds = items.map((i) => i.productId);
    const { data: products, error: prodErr } = await supabaseAdmin
      .from('products')
      .select('id, name, price, image_url, mockup_template_url')
      .in('id', productIds);

    if (prodErr) throw prodErr;

    const productMap = new Map(products.map((p) => [p.id, p]));
    const cartItems = [];
    let subtotalCents = 0;

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) continue;
      const priceCents = Math.round(product.price * 100);
      cartItems.push({
        productId: product.id,
        name: product.name,
        priceCents,
        quantity: item.quantity,
        imageUrl: product.image_url || product.mockup_template_url,
      });
      subtotalCents += priceCents * item.quantity;
    }

    // Upsert cart
    const { data: existingCart } = await supabaseAdmin
      .from('storefront_carts')
      .select('id')
      .eq('storefront_id', storefront.id)
      .eq('session_id', sessionId)
      .eq('status', 'active')
      .single();

    let cart;
    if (existingCart) {
      const { data, error } = await supabaseAdmin
        .from('storefront_carts')
        .update({
          items: cartItems,
          subtotal_cents: subtotalCents,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', existingCart.id)
        .select('*')
        .single();
      if (error) throw error;
      cart = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('storefront_carts')
        .insert({
          storefront_id: storefront.id,
          session_id: sessionId,
          items: cartItems,
          subtotal_cents: subtotalCents,
          status: 'active',
        })
        .select('*')
        .single();
      if (error) throw error;
      cart = data;
    }

    return res.json({
      success: true,
      data: {
        id: cart.id,
        sessionId: cart.session_id,
        items: cart.items,
        subtotalCents: Number(cart.subtotal_cents),
        status: cart.status,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/store/:slug/cart/:sessionId
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getCart(req, res, next) {
  try {
    const { slug, sessionId } = req.params;
    const storefront = await resolveStorefront(slug);
    if (!storefront) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }

    const { data: cart, error } = await supabaseAdmin
      .from('storefront_carts')
      .select('*')
      .eq('storefront_id', storefront.id)
      .eq('session_id', sessionId)
      .eq('status', 'active')
      .single();

    if (error || !cart) {
      return res.json({
        success: true,
        data: { items: [], subtotalCents: 0, status: 'empty' },
      });
    }

    return res.json({
      success: true,
      data: {
        id: cart.id,
        sessionId: cart.session_id,
        items: cart.items,
        subtotalCents: Number(cart.subtotal_cents),
        status: cart.status,
      },
    });
  } catch (err) {
    return next(err);
  }
}

// ── Checkout ────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/store/:slug/checkout
 * Create a Stripe Checkout Session from the cart.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function createCheckoutSession(req, res, next) {
  try {
    const { slug } = req.params;
    const storefront = await resolveStorefront(slug);
    if (!storefront) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }

    const { sessionId, successUrl, cancelUrl } = req.body;

    // Get cart
    const { data: cart } = await supabaseAdmin
      .from('storefront_carts')
      .select('*')
      .eq('storefront_id', storefront.id)
      .eq('session_id', sessionId)
      .eq('status', 'active')
      .single();

    if (!cart || !cart.items?.length) {
      return res.status(400).json({ success: false, error: 'Cart is empty' });
    }

    // Build Stripe line items
    const lineItems = cart.items.map((item) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          images: item.imageUrl ? [item.imageUrl] : [],
        },
        unit_amount: item.priceCents,
      },
      quantity: item.quantity,
    }));

    // Dynamic import of stripe to avoid circular deps
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        storefront_id: storefront.id,
        cart_id: cart.id,
        brand_id: storefront.brands.id,
      },
    });

    // Mark cart as converting
    await supabaseAdmin
      .from('storefront_carts')
      .update({ status: 'converted' })
      .eq('id', cart.id);

    logger.info({
      storefrontId: storefront.id,
      cartId: cart.id,
      checkoutSessionId: checkoutSession.id,
    }, 'Stripe checkout session created for storefront');

    return res.json({
      success: true,
      data: { checkoutUrl: checkoutSession.url },
    });
  } catch (err) {
    return next(err);
  }
}

// ── Contact Form ────────────────────────────────────────────────────────────

/**
 * POST /api/v1/store/:slug/contact
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function submitContactForm(req, res, next) {
  try {
    const { slug } = req.params;
    const storefront = await resolveStorefront(slug);
    if (!storefront) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }

    const { name, email, message } = req.body;

    const { data, error } = await supabaseAdmin
      .from('storefront_contacts')
      .insert({
        storefront_id: storefront.id,
        name,
        email,
        message,
      })
      .select('id')
      .single();

    if (error) throw error;

    // Queue storefront contact → GHL CRM sync
    try {
      const { dispatchJob } = await import('../queues/dispatch.js');
      await dispatchJob('storefront-contact', {
        contactId: data.id,
        storefrontId: storefront.id,
        brandId: storefront.brands.id,
        name,
        email,
        message,
      });
    } catch (queueErr) {
      logger.warn({ err: queueErr }, 'Failed to queue CRM sync for storefront contact');
    }

    return res.json({
      success: true,
      data: { submitted: true },
    });
  } catch (err) {
    return next(err);
  }
}

// ── Analytics ───────────────────────────────────────────────────────────────

/**
 * POST /api/v1/store/:slug/analytics/pageview
 * Lightweight analytics tracking — upsert daily row.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function trackPageView(req, res, _next) {
  try {
    const { slug } = req.params;

    // Lightweight — just resolve the storefront ID from slug
    const { data: sf } = await supabaseAdmin
      .from('storefronts')
      .select('id')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (!sf) {
      return res.status(404).json({ success: false, error: 'Store not found' });
    }

    const today = new Date().toISOString().split('T')[0];

    // Upsert analytics row for today
    const { data: existing } = await supabaseAdmin
      .from('storefront_analytics')
      .select('id, page_views')
      .eq('storefront_id', sf.id)
      .eq('date', today)
      .single();

    if (existing) {
      await supabaseAdmin
        .from('storefront_analytics')
        .update({ page_views: existing.page_views + 1 })
        .eq('id', existing.id);
    } else {
      await supabaseAdmin
        .from('storefront_analytics')
        .insert({
          storefront_id: sf.id,
          date: today,
          page_views: 1,
        });
    }

    return res.json({ success: true });
  } catch (err) {
    // Analytics should never fail the page load — swallow errors
    logger.warn({ err, slug: req.params.slug }, 'Analytics pageview tracking failed');
    return res.json({ success: true });
  }
}
