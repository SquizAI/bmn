# 17 — Influencer Storefront Builder

**Product:** Brand Me Now v2 — Influencer Website Builder
**Date:** February 25, 2026
**Status:** Approved for development
**Covers:** Storefront themes, drag-and-drop builder, public store rendering, product catalog display, checkout integration, influencer analytics

---

## 1. Overview

The Influencer Storefront Builder enables Brand Me Now users (influencers) to launch a fully branded e-commerce website for their supplement line — replacing basic platforms like Square Online with a premium, AI-enhanced experience.

**Reference site:** [Truva Nutra on Square](https://truva-nutra.square.site/) — scraped data in `docs/truva-nutra-reference.json`

**Core concept:** Each influencer gets a customizable storefront populated with their brand identity (colors, logo, fonts) and the Selfnamed white-label product catalog. The builder is template-driven with drag-and-drop section reordering and content editing — no coding required.

---

## 2. User Stories

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| SF-001 | As an influencer, I can launch a storefront pre-populated with my brand identity and products. | One-click creation from dashboard. Brand colors, logo, fonts auto-applied to default template. All selected products/bundles visible. |
| SF-002 | As an influencer, I can customize my storefront by editing sections (hero, about, testimonials, FAQs). | Inline editing with live preview. Rich text editor for content blocks. Image upload for hero/about sections. |
| SF-003 | As an influencer, I can reorder sections on my homepage via drag-and-drop. | Section drag handles. Real-time preview. Changes saved automatically (debounced). |
| SF-004 | As an influencer, I can choose from multiple theme presets while keeping my brand colors. | 5+ theme presets (Clean, Bold, Minimal, Premium, Sport). Theme changes colors/layout but preserves brand identity. |
| SF-005 | As an influencer, my storefront has a custom subdomain (myname.brandmenow.store). | Subdomain auto-provisioned on storefront creation. Custom domain support (Phase 2). |
| SF-006 | As a customer, I can browse products and bundles on the influencer's storefront. | Product grid with categories. Bundle showcase with included products. Mobile responsive. |
| SF-007 | As a customer, I can view detailed product pages with descriptions, ingredients, and images. | Product page with image gallery, rich description (matching Truva Nutra's science-backed format), related products. |
| SF-008 | As a customer, I can add products to cart and checkout. | Shopping cart with quantity controls. Stripe Checkout for payment. Order confirmation. |
| SF-009 | As an influencer, I can see analytics for my storefront (visits, conversions, revenue). | Dashboard analytics page with storefront metrics. Real-time visitor count via Socket.io. |
| SF-010 | As an influencer, I can manage testimonials on my storefront. | Add/edit/delete testimonials. Author name, quote, optional photo. |
| SF-011 | As an influencer, I can customize my FAQ section. | Add/edit/delete FAQ items. Pre-populated with supplement industry defaults. |
| SF-012 | As an influencer, my contact form submissions go to my GHL CRM. | Contact form with name, email, message. Submissions queued via BullMQ to GHL. |

---

## 3. Architecture

### 3.1 Database Schema

```sql
-- Storefront (one per brand)
CREATE TABLE storefronts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  slug VARCHAR(63) NOT NULL UNIQUE, -- subdomain: slug.brandmenow.store
  custom_domain VARCHAR(255),
  theme_id UUID REFERENCES storefront_themes(id),
  status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft, published, suspended
  settings JSONB NOT NULL DEFAULT '{}', -- global settings (SEO, analytics, social links)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

-- Theme presets
CREATE TABLE storefront_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  preview_image_url TEXT,
  base_styles JSONB NOT NULL DEFAULT '{}', -- CSS variables, layout config
  default_sections JSONB NOT NULL DEFAULT '[]', -- default section order + content
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Storefront page sections (ordered, customizable)
CREATE TABLE storefront_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID NOT NULL REFERENCES storefronts(id) ON DELETE CASCADE,
  section_type VARCHAR(50) NOT NULL, -- hero, welcome, bundles, products, steps, testimonials, faq, about, contact, quality, custom
  title VARCHAR(255),
  content JSONB NOT NULL DEFAULT '{}', -- section-specific content
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  settings JSONB NOT NULL DEFAULT '{}', -- section-specific settings (background, layout variant)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Storefront testimonials
CREATE TABLE storefront_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID NOT NULL REFERENCES storefronts(id) ON DELETE CASCADE,
  quote TEXT NOT NULL,
  author_name VARCHAR(100) NOT NULL,
  author_title VARCHAR(100), -- e.g., "Age 34" or "Fitness Coach"
  author_image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Storefront FAQs
CREATE TABLE storefront_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID NOT NULL REFERENCES storefronts(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Storefront analytics (aggregated daily)
CREATE TABLE storefront_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID NOT NULL REFERENCES storefronts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  page_views INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  product_views INTEGER NOT NULL DEFAULT 0,
  add_to_carts INTEGER NOT NULL DEFAULT 0,
  checkouts INTEGER NOT NULL DEFAULT 0,
  revenue_cents BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(storefront_id, date)
);

-- Shopping cart (guest + authenticated)
CREATE TABLE storefront_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID NOT NULL REFERENCES storefronts(id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL, -- anonymous session tracking
  customer_email VARCHAR(255),
  items JSONB NOT NULL DEFAULT '[]', -- [{product_id, quantity, price}]
  subtotal_cents BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, abandoned, converted
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

-- Contact form submissions
CREATE TABLE storefront_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id UUID NOT NULL REFERENCES storefronts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  synced_to_crm BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE storefronts ENABLE ROW LEVEL SECURITY;
ALTER TABLE storefront_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE storefront_testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE storefront_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE storefront_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE storefront_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE storefront_contacts ENABLE ROW LEVEL SECURITY;

-- Owner can manage their own storefront
CREATE POLICY storefront_owner ON storefronts
  FOR ALL USING (user_id = auth.uid());

-- Sections inherit from storefront ownership
CREATE POLICY storefront_sections_owner ON storefront_sections
  FOR ALL USING (storefront_id IN (SELECT id FROM storefronts WHERE user_id = auth.uid()));

-- Public read for published storefronts (for the public-facing store)
CREATE POLICY storefront_public_read ON storefronts
  FOR SELECT USING (status = 'published');

CREATE POLICY storefront_sections_public_read ON storefront_sections
  FOR SELECT USING (storefront_id IN (SELECT id FROM storefronts WHERE status = 'published') AND is_visible = true);

-- Indexes
CREATE INDEX idx_storefronts_slug ON storefronts(slug);
CREATE INDEX idx_storefronts_brand ON storefronts(brand_id);
CREATE INDEX idx_storefront_sections_storefront ON storefront_sections(storefront_id, sort_order);
CREATE INDEX idx_storefront_analytics_date ON storefront_analytics(storefront_id, date);
CREATE INDEX idx_storefront_carts_session ON storefront_carts(session_id);
```

### 3.2 API Routes

```
# Storefront Management (authenticated, owner only)
POST   /api/v1/storefronts                    -- Create storefront for a brand
GET    /api/v1/storefronts                    -- List user's storefronts
GET    /api/v1/storefronts/:id                -- Get storefront details
PATCH  /api/v1/storefronts/:id                -- Update storefront settings
DELETE /api/v1/storefronts/:id                -- Delete storefront
POST   /api/v1/storefronts/:id/publish        -- Publish storefront
POST   /api/v1/storefronts/:id/unpublish      -- Unpublish storefront

# Section Management (authenticated, owner only)
GET    /api/v1/storefronts/:id/sections       -- List all sections
POST   /api/v1/storefronts/:id/sections       -- Add new section
PATCH  /api/v1/storefronts/:id/sections/:sid  -- Update section content
DELETE /api/v1/storefronts/:id/sections/:sid  -- Delete section
PATCH  /api/v1/storefronts/:id/sections/reorder -- Reorder all sections

# Testimonials (authenticated, owner only)
GET    /api/v1/storefronts/:id/testimonials
POST   /api/v1/storefronts/:id/testimonials
PATCH  /api/v1/storefronts/:id/testimonials/:tid
DELETE /api/v1/storefronts/:id/testimonials/:tid

# FAQs (authenticated, owner only)
GET    /api/v1/storefronts/:id/faqs
POST   /api/v1/storefronts/:id/faqs
PATCH  /api/v1/storefronts/:id/faqs/:fid
DELETE /api/v1/storefronts/:id/faqs/:fid

# Theme Management
GET    /api/v1/storefront-themes              -- List available themes

# Storefront Analytics (authenticated, owner only)
GET    /api/v1/storefronts/:id/analytics      -- Get analytics summary

# Public Storefront (no auth required)
GET    /api/v1/store/:slug                    -- Get published storefront data
GET    /api/v1/store/:slug/products           -- Get products for storefront
GET    /api/v1/store/:slug/products/:pid      -- Get single product
POST   /api/v1/store/:slug/cart               -- Create/update cart
GET    /api/v1/store/:slug/cart/:sessionId    -- Get cart
POST   /api/v1/store/:slug/checkout           -- Create Stripe checkout session
POST   /api/v1/store/:slug/contact            -- Submit contact form
POST   /api/v1/store/:slug/analytics/pageview -- Track page view
```

### 3.3 Section Types

Each section type has its own content schema:

| Type | Content Schema | Based on Truva Nutra Section |
|------|---------------|------------------------------|
| `hero` | `{headline, subheadline, ctaText, ctaUrl, backgroundImageUrl, overlayOpacity}` | Hero banner |
| `trust-bar` | `{items: [{icon, text}]}` | "Third-party tested. Made in USA. GMP certified." |
| `welcome` | `{title, body, imageUrl}` | Welcome to Truva Nutra |
| `bundle-grid` | `{title, maxItems, layout: 'grid'|'scroll'}` | Supplement Bundles grid |
| `steps` | `{title, subtitle, steps: [{title, description, imageUrl}]}` | Three Simple Steps |
| `stack-finder` | `{title, stacks: [{name, description, imageUrl, benefits: []}]}` | Find Your Perfect Stack |
| `bundle-detail` | `{bundleId, layout: 'left'|'right', tagline, title, description, ctaText}` | Individual bundle showcases |
| `why-bundles` | `{title, reasons: [{icon, title, description}]}` | Why Choose Bundles |
| `quality` | `{title, body, imageUrl, badges: []}` | Quality You Can Trust |
| `testimonials` | `{title}` | Real People Real Results (pulls from storefront_testimonials) |
| `faq` | `{title, subtitle}` | FAQs (pulls from storefront_faqs) |
| `about` | `{title, subtitle, body, imageUrl, ctaText, ctaUrl}` | About Us |
| `contact` | `{title, subtitle, showPhone, showEmail}` | Contact form |
| `products` | `{title, categoryFilter, layout: 'grid'|'list', maxItems}` | Shop page products |
| `custom-html` | `{html}` | User-injected content (sanitized) |

### 3.4 Theme Preset Structure

```jsonc
{
  "name": "Clean Wellness",
  "slug": "clean-wellness",
  "base_styles": {
    // These get OVERRIDDEN by the influencer's brand colors
    "borderRadius": "8px",          // or "0px" for sharp, "100px" for pill
    "buttonRadius": "100px",        // pill buttons (like Truva Nutra)
    "cardShadow": "0 2px 8px rgba(0,0,0,0.08)",
    "heroLayout": "banner",         // "banner", "split", "centered"
    "productCardStyle": "minimal",  // "minimal", "bordered", "elevated"
    "fontScale": 1.0,               // multiplier for all font sizes
    "sectionSpacing": "lg",         // "sm", "md", "lg", "xl"
    "navStyle": "transparent",      // "transparent", "solid", "floating"
    "footerStyle": "full"           // "minimal", "full"
  },
  "default_sections": [
    { "type": "hero", "sort_order": 0 },
    { "type": "trust-bar", "sort_order": 1 },
    { "type": "welcome", "sort_order": 2 },
    { "type": "bundle-grid", "sort_order": 3 },
    { "type": "steps", "sort_order": 4 },
    { "type": "stack-finder", "sort_order": 5 },
    { "type": "why-bundles", "sort_order": 6 },
    { "type": "quality", "sort_order": 7 },
    { "type": "testimonials", "sort_order": 8 },
    { "type": "faq", "sort_order": 9 },
    { "type": "about", "sort_order": 10 },
    { "type": "contact", "sort_order": 11 }
  ]
}
```

---

## 4. Frontend Architecture

### 4.1 Dashboard — Storefront Builder

New route: `/dashboard/storefront`

Components:
- `StorefrontBuilder.tsx` — Main builder page with live preview
- `SectionEditor.tsx` — Edit individual section content
- `SectionList.tsx` — Draggable section list (using @dnd-kit/sortable)
- `ThemeSelector.tsx` — Theme preset picker with previews
- `StorefrontPreview.tsx` — Live iframe preview of the storefront
- `StorefrontSettings.tsx` — SEO, domain, social links, analytics config
- `TestimonialManager.tsx` — CRUD for testimonials
- `FaqManager.tsx` — CRUD for FAQs
- `StorefrontAnalytics.tsx` — Analytics dashboard for the store
- `PublishControls.tsx` — Publish/unpublish with status indicator

### 4.2 Public Storefront — Rendered Store

The public storefront is served as a standalone React SPA at `{slug}.brandmenow.store`.

It fetches all data from the public API (`/api/v1/store/:slug`) and renders based on the theme + sections configuration.

Components:
- `StorefrontApp.tsx` — Root app for public store
- `StorefrontLayout.tsx` — Nav + footer wrapper
- `StorefrontNav.tsx` — Navigation bar with brand logo
- `StorefrontFooter.tsx` — Footer with legal links
- Section renderers (one per section type):
  - `HeroSection.tsx`, `TrustBarSection.tsx`, `WelcomeSection.tsx`
  - `BundleGridSection.tsx`, `StepsSection.tsx`, `StackFinderSection.tsx`
  - `BundleDetailSection.tsx`, `WhyBundlesSection.tsx`, `QualitySection.tsx`
  - `TestimonialsSection.tsx`, `FaqSection.tsx`, `AboutSection.tsx`
  - `ContactSection.tsx`, `ProductsSection.tsx`
- `ProductPage.tsx` — Individual product detail page
- `CartDrawer.tsx` — Slide-out shopping cart
- `CheckoutPage.tsx` — Stripe checkout integration

### 4.3 State Management

```typescript
// New Zustand store
interface StorefrontBuilderStore {
  storefront: Storefront | null;
  sections: StorefrontSection[];
  selectedSection: string | null;
  isDirty: boolean;
  isPreviewOpen: boolean;
  // Actions
  loadStorefront: (id: string) => Promise<void>;
  updateSection: (id: string, content: Partial<SectionContent>) => void;
  reorderSections: (ids: string[]) => void;
  addSection: (type: SectionType) => void;
  removeSection: (id: string) => void;
  saveChanges: () => Promise<void>;
  publish: () => Promise<void>;
}
```

---

## 5. Default Content (Pre-populated from Truva Nutra Pattern)

When a storefront is created, it's pre-populated with:

1. **Hero**: Uses brand name + generic supplement headline template
2. **Trust Bar**: "Third-party tested. Made in the USA. GMP certified."
3. **Welcome**: Template text with brand name injected
4. **Bundle Grid**: Auto-populated from brand's selected bundles
5. **Steps**: "Choose Your Goal → Follow the Timing → Feel the Difference"
6. **Stack Finder**: Auto-populated from brand's bundles with benefits
7. **Why Bundles**: "Designed to Work Together", "Save 15-20%", "Simple Daily Routine"
8. **Quality**: Quality trust section template
9. **Testimonials**: 4 placeholder testimonials (influencer replaces with real ones)
10. **FAQs**: 7 default supplement industry FAQs
11. **About**: Template with brand name + mission injected from brand identity
12. **Contact**: Standard contact form

---

## 6. Technical Decisions

1. **Public storefront is a separate Vite SPA** served from `/client-storefront/` — NOT part of the main client app. Lighter bundle, no auth required.
2. **Subdomain routing** handled by Caddy reverse proxy — `*.brandmenow.store` → storefront SPA with slug param.
3. **Theme system uses CSS custom properties** — brand colors injected as `--color-primary`, `--color-accent`, etc. Theme presets control layout/spacing/radius.
4. **Drag-and-drop** uses `@dnd-kit/sortable` — lightweight, accessible, React-native.
5. **Cart uses session-based storage** — `localStorage` for cart ID, server-side cart persistence.
6. **Checkout via Stripe Checkout Sessions** — server creates session, client redirects to Stripe.
7. **Analytics tracked via lightweight pixel** — POST to `/api/v1/store/:slug/analytics/pageview` on load. Aggregated daily by BullMQ worker.
8. **Contact form submissions** queued to BullMQ → GHL CRM sync.
9. **Image assets** served via existing image proxy route.
10. **SEO**: Server-rendered meta tags via a thin Express middleware that injects OG tags for the storefront slug before serving the SPA shell.

---

## 7. File Structure

```
server/src/
├── routes/
│   ├── storefronts.js          -- Authenticated storefront management
│   └── public-store.js         -- Public storefront API (no auth)
├── controllers/
│   ├── storefronts.js          -- Storefront CRUD logic
│   └── public-store.js         -- Public store data + cart + checkout
├── services/
│   └── storefront.js           -- Storefront business logic
├── workers/
│   ├── storefront-analytics.js -- Daily analytics aggregation
│   └── storefront-contact.js   -- Contact form → GHL sync

client/src/
├── routes/
│   └── dashboard/
│       └── storefront.tsx       -- Builder page route
├── components/
│   └── storefront-builder/
│       ├── StorefrontBuilder.tsx
│       ├── SectionEditor.tsx
│       ├── SectionList.tsx
│       ├── ThemeSelector.tsx
│       ├── StorefrontPreview.tsx
│       ├── StorefrontSettings.tsx
│       ├── TestimonialManager.tsx
│       ├── FaqManager.tsx
│       ├── PublishControls.tsx
│       └── StorefrontAnalytics.tsx
├── stores/
│   └── storefront-store.ts
├── hooks/
│   └── use-storefront.ts

client-storefront/              -- SEPARATE Vite SPA for public stores
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── StorefrontNav.tsx
│   │   │   └── StorefrontFooter.tsx
│   │   ├── sections/
│   │   │   ├── HeroSection.tsx
│   │   │   ├── TrustBarSection.tsx
│   │   │   ├── WelcomeSection.tsx
│   │   │   ├── BundleGridSection.tsx
│   │   │   ├── StepsSection.tsx
│   │   │   ├── StackFinderSection.tsx
│   │   │   ├── BundleDetailSection.tsx
│   │   │   ├── WhyBundlesSection.tsx
│   │   │   ├── QualitySection.tsx
│   │   │   ├── TestimonialsSection.tsx
│   │   │   ├── FaqSection.tsx
│   │   │   ├── AboutSection.tsx
│   │   │   ├── ContactSection.tsx
│   │   │   └── ProductsSection.tsx
│   │   ├── product/
│   │   │   ├── ProductPage.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   └── ProductGallery.tsx
│   │   ├── cart/
│   │   │   ├── CartDrawer.tsx
│   │   │   ├── CartItem.tsx
│   │   │   └── CartSummary.tsx
│   │   └── checkout/
│   │       └── CheckoutPage.tsx
│   ├── hooks/
│   │   ├── use-store-data.ts
│   │   ├── use-cart.ts
│   │   └── use-analytics.ts
│   ├── lib/
│   │   ├── api.ts
│   │   └── theme.ts
│   └── styles/
│       └── storefront.css

supabase/migrations/
└── YYYYMMDD_storefront_tables.sql
```

---

## 8. Build Order

1. **Database migration** — Create all tables + RLS policies + seed themes
2. **Server: storefront routes + controllers** — CRUD API for storefront management
3. **Server: public store routes** — Public API for rendering storefronts
4. **Client: storefront builder** — Dashboard UI for editing storefronts
5. **Client-storefront: public store SPA** — The actual customer-facing store
6. **Server: cart + checkout** — Shopping cart + Stripe integration
7. **Server: analytics worker** — Page view tracking + daily aggregation
8. **Server: contact form worker** — GHL CRM sync for contact submissions
9. **Integration testing** — End-to-end flow from builder to public store to checkout
