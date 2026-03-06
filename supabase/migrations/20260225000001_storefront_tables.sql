-- =============================================================================
-- 20260225000001_storefront_tables.sql
-- Influencer Storefront Builder: themes, storefronts, sections, testimonials,
-- FAQs, analytics, carts, contacts. Includes RLS policies and seed data.
-- =============================================================================

-- ─── 1. Storefront Themes ───────────────────────────────────────────────────

CREATE TABLE public.storefront_themes (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(100)  NOT NULL,
  slug              VARCHAR(100)  NOT NULL UNIQUE,
  description       TEXT,
  preview_image_url TEXT,
  base_styles       JSONB         NOT NULL DEFAULT '{}',
  default_sections  JSONB         NOT NULL DEFAULT '[]',
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.storefront_themes IS 'Theme presets for influencer storefronts. Controls layout, styling, and default section order.';
COMMENT ON COLUMN public.storefront_themes.base_styles IS 'CSS variable overrides: borderRadius, buttonRadius, heroLayout, navStyle, sectionSpacing, etc.';
COMMENT ON COLUMN public.storefront_themes.default_sections IS 'JSON array of default sections with type + sort_order for new storefronts.';

CREATE INDEX idx_storefront_themes_slug ON public.storefront_themes (slug);
CREATE INDEX idx_storefront_themes_active ON public.storefront_themes (is_active) WHERE is_active = TRUE;

ALTER TABLE public.storefront_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "storefront_themes_public_read"
  ON public.storefront_themes FOR SELECT
  USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "storefront_themes_insert_admin"
  ON public.storefront_themes FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "storefront_themes_update_admin"
  ON public.storefront_themes FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "storefront_themes_delete_admin"
  ON public.storefront_themes FOR DELETE
  USING (public.is_admin());

-- ─── 2. Storefronts ────────────────────────────────────────────────────────

CREATE TABLE public.storefronts (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id          UUID          NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  user_id           UUID          NOT NULL REFERENCES auth.users(id),
  slug              VARCHAR(63)   NOT NULL UNIQUE,
  custom_domain     VARCHAR(255),
  theme_id          UUID          REFERENCES public.storefront_themes(id),
  status            VARCHAR(20)   NOT NULL DEFAULT 'draft'
                                  CHECK (status IN ('draft', 'published', 'suspended')),
  settings          JSONB         NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  published_at      TIMESTAMPTZ
);

COMMENT ON TABLE  public.storefronts IS 'Influencer storefronts. One per brand. Subdomain = slug.brandmenow.store.';
COMMENT ON COLUMN public.storefronts.slug IS 'Subdomain slug: slug.brandmenow.store. Lowercase alphanumeric + hyphens, 3-63 chars.';
COMMENT ON COLUMN public.storefronts.settings IS 'Global settings: SEO (meta_title, meta_description), social links, contact email, custom CSS.';

CREATE INDEX idx_storefronts_slug ON public.storefronts (slug);
CREATE INDEX idx_storefronts_brand ON public.storefronts (brand_id);
CREATE INDEX idx_storefronts_user ON public.storefronts (user_id);
CREATE INDEX idx_storefronts_status ON public.storefronts (status) WHERE status = 'published';

CREATE TRIGGER set_storefronts_updated_at
  BEFORE UPDATE ON public.storefronts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.storefronts ENABLE ROW LEVEL SECURITY;

-- Owner can manage their own storefronts
CREATE POLICY "storefronts_owner_all"
  ON public.storefronts FOR ALL
  USING (user_id = auth.uid());

-- Public read for published storefronts (customer-facing)
CREATE POLICY "storefronts_public_read"
  ON public.storefronts FOR SELECT
  USING (status = 'published');

-- Admin full access
CREATE POLICY "storefronts_admin_all"
  ON public.storefronts FOR ALL
  USING (public.is_admin());

-- ─── 3. Storefront Sections ────────────────────────────────────────────────

CREATE TABLE public.storefront_sections (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id     UUID          NOT NULL REFERENCES public.storefronts(id) ON DELETE CASCADE,
  section_type      VARCHAR(50)   NOT NULL
                                  CHECK (section_type IN (
                                    'hero', 'trust-bar', 'welcome', 'bundle-grid', 'steps',
                                    'stack-finder', 'bundle-detail', 'why-bundles', 'quality',
                                    'testimonials', 'faq', 'about', 'contact', 'products', 'custom-html'
                                  )),
  title             VARCHAR(255),
  content           JSONB         NOT NULL DEFAULT '{}',
  sort_order        INTEGER       NOT NULL DEFAULT 0,
  is_visible        BOOLEAN       NOT NULL DEFAULT TRUE,
  settings          JSONB         NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.storefront_sections IS 'Ordered, customizable sections within a storefront homepage.';
COMMENT ON COLUMN public.storefront_sections.section_type IS 'Section type: hero, trust-bar, welcome, bundle-grid, steps, etc.';
COMMENT ON COLUMN public.storefront_sections.content IS 'Section-specific content (headline, body, images, etc). Schema varies by type.';
COMMENT ON COLUMN public.storefront_sections.settings IS 'Section-specific settings: background color, layout variant, etc.';

CREATE INDEX idx_storefront_sections_storefront ON public.storefront_sections (storefront_id, sort_order);

CREATE TRIGGER set_storefront_sections_updated_at
  BEFORE UPDATE ON public.storefront_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.storefront_sections ENABLE ROW LEVEL SECURITY;

-- Owner via storefront ownership
CREATE POLICY "storefront_sections_owner_all"
  ON public.storefront_sections FOR ALL
  USING (storefront_id IN (SELECT id FROM public.storefronts WHERE user_id = auth.uid()));

-- Public read for published + visible sections
CREATE POLICY "storefront_sections_public_read"
  ON public.storefront_sections FOR SELECT
  USING (
    is_visible = TRUE
    AND storefront_id IN (SELECT id FROM public.storefronts WHERE status = 'published')
  );

-- ─── 4. Storefront Testimonials ────────────────────────────────────────────

CREATE TABLE public.storefront_testimonials (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id     UUID          NOT NULL REFERENCES public.storefronts(id) ON DELETE CASCADE,
  quote             TEXT          NOT NULL,
  author_name       VARCHAR(100)  NOT NULL,
  author_title      VARCHAR(100),
  author_image_url  TEXT,
  sort_order        INTEGER       NOT NULL DEFAULT 0,
  is_visible        BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.storefront_testimonials IS 'Customer testimonials displayed on the storefront.';

CREATE INDEX idx_storefront_testimonials_storefront ON public.storefront_testimonials (storefront_id, sort_order);

ALTER TABLE public.storefront_testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "storefront_testimonials_owner_all"
  ON public.storefront_testimonials FOR ALL
  USING (storefront_id IN (SELECT id FROM public.storefronts WHERE user_id = auth.uid()));

CREATE POLICY "storefront_testimonials_public_read"
  ON public.storefront_testimonials FOR SELECT
  USING (
    is_visible = TRUE
    AND storefront_id IN (SELECT id FROM public.storefronts WHERE status = 'published')
  );

-- ─── 5. Storefront FAQs ───────────────────────────────────────────────────

CREATE TABLE public.storefront_faqs (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id     UUID          NOT NULL REFERENCES public.storefronts(id) ON DELETE CASCADE,
  question          TEXT          NOT NULL,
  answer            TEXT          NOT NULL,
  sort_order        INTEGER       NOT NULL DEFAULT 0,
  is_visible        BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.storefront_faqs IS 'FAQ items displayed on the storefront in an accordion.';

CREATE INDEX idx_storefront_faqs_storefront ON public.storefront_faqs (storefront_id, sort_order);

ALTER TABLE public.storefront_faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "storefront_faqs_owner_all"
  ON public.storefront_faqs FOR ALL
  USING (storefront_id IN (SELECT id FROM public.storefronts WHERE user_id = auth.uid()));

CREATE POLICY "storefront_faqs_public_read"
  ON public.storefront_faqs FOR SELECT
  USING (
    is_visible = TRUE
    AND storefront_id IN (SELECT id FROM public.storefronts WHERE status = 'published')
  );

-- ─── 6. Storefront Analytics (daily aggregation) ──────────────────────────

CREATE TABLE public.storefront_analytics (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id     UUID          NOT NULL REFERENCES public.storefronts(id) ON DELETE CASCADE,
  date              DATE          NOT NULL,
  page_views        INTEGER       NOT NULL DEFAULT 0,
  unique_visitors   INTEGER       NOT NULL DEFAULT 0,
  product_views     INTEGER       NOT NULL DEFAULT 0,
  add_to_carts      INTEGER       NOT NULL DEFAULT 0,
  checkouts         INTEGER       NOT NULL DEFAULT 0,
  revenue_cents     BIGINT        NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (storefront_id, date)
);

COMMENT ON TABLE public.storefront_analytics IS 'Daily aggregated analytics per storefront.';

CREATE INDEX idx_storefront_analytics_date ON public.storefront_analytics (storefront_id, date);

ALTER TABLE public.storefront_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "storefront_analytics_owner_read"
  ON public.storefront_analytics FOR SELECT
  USING (storefront_id IN (SELECT id FROM public.storefronts WHERE user_id = auth.uid()));

-- Allow inserts from service role (analytics worker) — no user-facing insert
CREATE POLICY "storefront_analytics_service_insert"
  ON public.storefront_analytics FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "storefront_analytics_service_update"
  ON public.storefront_analytics FOR UPDATE
  USING (TRUE);

-- ─── 7. Storefront Carts (session-based, no auth) ────────────────────────

CREATE TABLE public.storefront_carts (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id     UUID          NOT NULL REFERENCES public.storefronts(id) ON DELETE CASCADE,
  session_id        VARCHAR(255)  NOT NULL,
  customer_email    VARCHAR(255),
  items             JSONB         NOT NULL DEFAULT '[]',
  subtotal_cents    BIGINT        NOT NULL DEFAULT 0,
  status            VARCHAR(20)   NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active', 'abandoned', 'converted')),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ   NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

COMMENT ON TABLE  public.storefront_carts IS 'Shopping carts for storefront customers. Session-based, no auth required.';
COMMENT ON COLUMN public.storefront_carts.items IS 'JSON array: [{productId, name, price, quantity, imageUrl}].';

CREATE INDEX idx_storefront_carts_session ON public.storefront_carts (session_id);
CREATE INDEX idx_storefront_carts_storefront ON public.storefront_carts (storefront_id);
CREATE INDEX idx_storefront_carts_expires ON public.storefront_carts (expires_at) WHERE status = 'active';

CREATE TRIGGER set_storefront_carts_updated_at
  BEFORE UPDATE ON public.storefront_carts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.storefront_carts ENABLE ROW LEVEL SECURITY;

-- Carts are public (session-based) — service role manages via supabaseAdmin
CREATE POLICY "storefront_carts_public_all"
  ON public.storefront_carts FOR ALL
  USING (TRUE);

-- ─── 8. Storefront Contacts ───────────────────────────────────────────────

CREATE TABLE public.storefront_contacts (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_id     UUID          NOT NULL REFERENCES public.storefronts(id) ON DELETE CASCADE,
  name              VARCHAR(255)  NOT NULL,
  email             VARCHAR(255)  NOT NULL,
  message           TEXT          NOT NULL,
  synced_to_crm     BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.storefront_contacts IS 'Contact form submissions from storefront visitors.';

CREATE INDEX idx_storefront_contacts_storefront ON public.storefront_contacts (storefront_id);
CREATE INDEX idx_storefront_contacts_unsynced ON public.storefront_contacts (synced_to_crm) WHERE synced_to_crm = FALSE;

ALTER TABLE public.storefront_contacts ENABLE ROW LEVEL SECURITY;

-- Owner can read contacts for their storefronts
CREATE POLICY "storefront_contacts_owner_read"
  ON public.storefront_contacts FOR SELECT
  USING (storefront_id IN (SELECT id FROM public.storefronts WHERE user_id = auth.uid()));

-- Public can insert (contact form submissions)
CREATE POLICY "storefront_contacts_public_insert"
  ON public.storefront_contacts FOR INSERT
  WITH CHECK (
    storefront_id IN (SELECT id FROM public.storefronts WHERE status = 'published')
  );

-- Service role can update (CRM sync status)
CREATE POLICY "storefront_contacts_service_update"
  ON public.storefront_contacts FOR UPDATE
  USING (TRUE);


-- =============================================================================
-- SEED DATA: Theme Presets
-- =============================================================================

INSERT INTO public.storefront_themes (name, slug, description, base_styles, default_sections, is_active) VALUES

-- 1. Clean Wellness (based on Truva Nutra)
(
  'Clean Wellness',
  'clean-wellness',
  'Nature-inspired wellness theme with soft greens and pill-shaped buttons. Clean, professional, and trustworthy — inspired by top supplement brands.',
  '{
    "borderRadius": "8px",
    "buttonRadius": "100px",
    "cardShadow": "0 2px 8px rgba(0,0,0,0.08)",
    "heroLayout": "banner",
    "productCardStyle": "minimal",
    "fontScale": 1.0,
    "sectionSpacing": "lg",
    "navStyle": "transparent",
    "footerStyle": "full",
    "colorSuggestion": { "primary": "#214A1E", "accent": "#ADC59A" }
  }',
  '[
    {"type": "hero", "sort_order": 0},
    {"type": "trust-bar", "sort_order": 1},
    {"type": "welcome", "sort_order": 2},
    {"type": "bundle-grid", "sort_order": 3},
    {"type": "steps", "sort_order": 4},
    {"type": "stack-finder", "sort_order": 5},
    {"type": "why-bundles", "sort_order": 6},
    {"type": "quality", "sort_order": 7},
    {"type": "testimonials", "sort_order": 8},
    {"type": "faq", "sort_order": 9},
    {"type": "about", "sort_order": 10},
    {"type": "contact", "sort_order": 11}
  ]',
  TRUE
),

-- 2. Bold Performance
(
  'Bold Performance',
  'bold-performance',
  'Dark, high-contrast theme with sharp edges for fitness and performance brands. Commands attention with bold typography and dramatic layouts.',
  '{
    "borderRadius": "4px",
    "buttonRadius": "4px",
    "cardShadow": "0 4px 16px rgba(0,0,0,0.2)",
    "heroLayout": "split",
    "productCardStyle": "bordered",
    "fontScale": 1.05,
    "sectionSpacing": "md",
    "navStyle": "solid",
    "footerStyle": "full",
    "colorSuggestion": { "primary": "#1A1A2E", "accent": "#E94560" }
  }',
  '[
    {"type": "hero", "sort_order": 0},
    {"type": "trust-bar", "sort_order": 1},
    {"type": "bundle-grid", "sort_order": 2},
    {"type": "steps", "sort_order": 3},
    {"type": "welcome", "sort_order": 4},
    {"type": "stack-finder", "sort_order": 5},
    {"type": "why-bundles", "sort_order": 6},
    {"type": "quality", "sort_order": 7},
    {"type": "testimonials", "sort_order": 8},
    {"type": "faq", "sort_order": 9},
    {"type": "about", "sort_order": 10},
    {"type": "contact", "sort_order": 11}
  ]',
  TRUE
),

-- 3. Minimal Nature
(
  'Minimal Nature',
  'minimal-nature',
  'Ultra-clean minimal design with generous white space and thin typography. Lets the products speak for themselves.',
  '{
    "borderRadius": "0px",
    "buttonRadius": "0px",
    "cardShadow": "none",
    "heroLayout": "centered",
    "productCardStyle": "minimal",
    "fontScale": 0.95,
    "sectionSpacing": "xl",
    "navStyle": "floating",
    "footerStyle": "minimal",
    "colorSuggestion": { "primary": "#2D3436", "accent": "#81ECEC" }
  }',
  '[
    {"type": "hero", "sort_order": 0},
    {"type": "welcome", "sort_order": 1},
    {"type": "bundle-grid", "sort_order": 2},
    {"type": "steps", "sort_order": 3},
    {"type": "stack-finder", "sort_order": 4},
    {"type": "quality", "sort_order": 5},
    {"type": "testimonials", "sort_order": 6},
    {"type": "faq", "sort_order": 7},
    {"type": "about", "sort_order": 8},
    {"type": "contact", "sort_order": 9}
  ]',
  TRUE
),

-- 4. Premium Gold
(
  'Premium Gold',
  'premium-gold',
  'Luxury-inspired theme with elegant typography, gold accents, and refined spacing. Perfect for premium supplement positioning.',
  '{
    "borderRadius": "2px",
    "buttonRadius": "2px",
    "cardShadow": "0 1px 4px rgba(0,0,0,0.06)",
    "heroLayout": "banner",
    "productCardStyle": "elevated",
    "fontScale": 1.0,
    "sectionSpacing": "lg",
    "navStyle": "solid",
    "footerStyle": "full",
    "colorSuggestion": { "primary": "#1B1B1B", "accent": "#C9A84C" }
  }',
  '[
    {"type": "hero", "sort_order": 0},
    {"type": "trust-bar", "sort_order": 1},
    {"type": "welcome", "sort_order": 2},
    {"type": "bundle-grid", "sort_order": 3},
    {"type": "steps", "sort_order": 4},
    {"type": "stack-finder", "sort_order": 5},
    {"type": "why-bundles", "sort_order": 6},
    {"type": "quality", "sort_order": 7},
    {"type": "testimonials", "sort_order": 8},
    {"type": "faq", "sort_order": 9},
    {"type": "about", "sort_order": 10},
    {"type": "contact", "sort_order": 11}
  ]',
  TRUE
),

-- 5. Sport Energy
(
  'Sport Energy',
  'sport-energy',
  'Vibrant, dynamic theme with energetic colors and athletic feel. Rounded elements and bold gradients for active lifestyle brands.',
  '{
    "borderRadius": "12px",
    "buttonRadius": "100px",
    "cardShadow": "0 4px 12px rgba(0,0,0,0.1)",
    "heroLayout": "split",
    "productCardStyle": "bordered",
    "fontScale": 1.05,
    "sectionSpacing": "md",
    "navStyle": "transparent",
    "footerStyle": "full",
    "colorSuggestion": { "primary": "#0D1B2A", "accent": "#00F5D4" }
  }',
  '[
    {"type": "hero", "sort_order": 0},
    {"type": "trust-bar", "sort_order": 1},
    {"type": "bundle-grid", "sort_order": 2},
    {"type": "steps", "sort_order": 3},
    {"type": "welcome", "sort_order": 4},
    {"type": "stack-finder", "sort_order": 5},
    {"type": "why-bundles", "sort_order": 6},
    {"type": "quality", "sort_order": 7},
    {"type": "testimonials", "sort_order": 8},
    {"type": "faq", "sort_order": 9},
    {"type": "about", "sort_order": 10},
    {"type": "contact", "sort_order": 11}
  ]',
  TRUE
);
