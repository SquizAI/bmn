-- =============================================================================
-- 20260220000003_expand_catalog_phase4.sql
-- Phase 4: Expand product catalog with candles, digital downloads,
-- additional apparel, and more accessories.
-- Adds ~20 new products bringing total from 54 to 74.
-- =============================================================================

-- ── Step 1: Expand the category CHECK constraint with new categories ─────────

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_category_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_category_check
  CHECK (category IN (
    'apparel', 'accessories', 'home_goods', 'packaging', 'digital',
    'supplements', 'skincare', 'wellness', 'food_beverage', 'journals',
    'candles', 'digital_downloads'
  ));


-- ── Candles & Home Fragrance (4 products) ──────────────────────────────────

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('CND-001', 'Signature Soy Candle (8oz)', 'candles',
 'Hand-poured soy wax candle with cotton wick. Burns for 45+ hours. Available in custom scent profiles matched to your brand personality.',
 4.00, 28.99,
 '/images/products/CND-001.webp', '/mockups/templates/CND-001.png',
 'Place the brand logo on a minimalist label wrapped around a clear glass candle jar. Use brand colors for the label and wax tint. Include "Signature Candle" text and scent name. Show the candle lit with a warm glow, on a marble or wood surface with dried flowers nearby. Luxury home aesthetic with soft, warm lighting.',
 300,
 '{"ingredients": ["100% Natural Soy Wax", "Cotton Wick", "Essential Oil Blend", "Phthalate-Free Fragrance"], "burn_time": "45+ hours", "weight": "8 oz", "container": "Clear Glass Jar with Lid", "scent_profiles": ["Warm Vanilla & Amber", "Fresh Eucalyptus & Mint", "Rose & Sandalwood"]}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('CND-002', 'Travel Candle Tin (4oz)', 'candles',
 'Portable soy candle in a branded travel tin. 20+ hour burn time. Perfect as a gift or travel companion.',
 2.50, 16.99,
 '/images/products/CND-002.webp', '/mockups/templates/CND-002.png',
 'Place the brand logo on the lid of a gold or matte black travel candle tin. Include brand name and scent on the label. Show 2-3 tins stacked or arranged with the lid partially off on one, revealing the candle inside. Travel or gifting aesthetic with tissue paper or small bag.',
 301,
 '{"ingredients": ["100% Natural Soy Wax", "Cotton Wick", "Essential Oil Blend"], "burn_time": "20+ hours", "weight": "4 oz", "container": "Metal Travel Tin", "scent_profiles": ["Lavender Dreams", "Citrus Burst", "Ocean Breeze"]}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('CND-003', 'Candle Gift Set (3-pack)', 'candles',
 'Curated set of 3 mini soy candles in branded packaging. 15+ hour burn each. Includes discovery card with scent descriptions.',
 6.00, 38.99,
 '/images/products/CND-003.webp', '/mockups/templates/CND-003.png',
 'Place the brand logo on a gift box containing 3 mini candle jars. Each jar has a different colored wax matching brand palette. Include a branded discovery card. Show the box open with candles visible, ribbon, and tissue paper. Luxury gifting aesthetic.',
 302,
 '{"ingredients": ["100% Natural Soy Wax", "Cotton Wicks", "Essential Oil Blends"], "burn_time": "15+ hours each", "count": 3, "container": "Gift Box with Mini Glass Jars"}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('CND-004', 'Room Spray & Mist', 'candles',
 'All-natural room and linen spray with essential oils. 4oz glass bottle with fine mist sprayer. Matches your candle scent profile.',
 3.00, 18.99,
 '/images/products/CND-004.webp', '/mockups/templates/CND-004.png',
 'Place the brand logo on a frosted or amber glass spray bottle with a minimalist label. Include "Room Mist" text and scent name. Show the bottle beside folded linens, a candle, or on a nightstand. Spa-like, calming aesthetic.',
 303,
 '{"ingredients": ["Purified Water", "Essential Oil Blend", "Witch Hazel", "Vegetable Glycerin"], "volume": "4 fl oz (118ml)", "container": "Glass Spray Bottle"}')

ON CONFLICT (sku) DO NOTHING;


-- ── Digital Downloads (6 products) ─────────────────────────────────────────

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('DLD-001', '12-Week Workout Plan (PDF)', 'digital_downloads',
 'Comprehensive 12-week progressive workout program. Includes exercise illustrations, warm-up/cool-down routines, and progress tracking sheets. Available for home or gym.',
 0.00, 29.99,
 '/images/products/DLD-001.webp', '/mockups/templates/DLD-001.png',
 'Create a branded PDF cover page and interior spread for a workout plan. Use brand colors and logo prominently on the cover. Show a tablet or laptop displaying the workout plan alongside dumbbells and a water bottle. Clean, professional fitness aesthetic.',
 310,
 '{"format": "PDF", "pages": 48, "features": ["12-Week Progressive Program", "Home & Gym Versions", "Exercise Illustrations", "Warm-Up/Cool-Down Routines", "Progress Tracking Sheets"], "delivery": "Instant Digital Download"}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('DLD-002', '30-Day Meal Plan (PDF)', 'digital_downloads',
 'Complete 30-day meal plan with recipes, grocery lists, and macro breakdowns. Customizable for different dietary preferences (vegan, keto, balanced).',
 0.00, 24.99,
 '/images/products/DLD-002.webp', '/mockups/templates/DLD-002.png',
 'Create a branded PDF cover and sample recipe page. Use brand colors and logo on the cover. Show the meal plan displayed on a tablet beside fresh ingredients and a cutting board. Healthy, appetizing food photography aesthetic.',
 311,
 '{"format": "PDF", "pages": 64, "features": ["30 Days of Meals", "Complete Recipes", "Weekly Grocery Lists", "Macro Breakdowns", "Dietary Variations (Vegan, Keto, Balanced)"], "delivery": "Instant Digital Download"}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('DLD-003', 'Brand Building eBook', 'digital_downloads',
 'Comprehensive guide to building a personal brand online. Covers social media strategy, content creation, monetization, and audience growth. 120+ pages with actionable worksheets.',
 0.00, 19.99,
 '/images/products/DLD-003.webp', '/mockups/templates/DLD-003.png',
 'Create a branded eBook cover with a professional, authoritative design. Use brand colors and logo. Include the title "Brand Building Guide" and subtitle. Show the eBook on a tablet with a notebook and coffee nearby. Professional, educational aesthetic.',
 312,
 '{"format": "PDF", "pages": 128, "features": ["Social Media Strategy", "Content Creation Framework", "Monetization Playbook", "Audience Growth Tactics", "Actionable Worksheets"], "delivery": "Instant Digital Download"}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('DLD-004', 'Mindfulness & Meditation Guide', 'digital_downloads',
 'Digital guide to daily mindfulness practices. Includes guided meditation scripts, breathing exercises, and a 30-day mindfulness challenge. Audio companion available.',
 0.00, 14.99,
 '/images/products/DLD-004.webp', '/mockups/templates/DLD-004.png',
 'Create a calming branded PDF cover for a meditation guide. Use soft, serene brand colors with the logo. Show the guide displayed on a phone beside a meditation cushion and incense. Zen, peaceful aesthetic with natural light.',
 313,
 '{"format": "PDF + Audio", "pages": 56, "features": ["Guided Meditation Scripts", "Breathing Exercises", "30-Day Mindfulness Challenge", "Audio Companion Tracks", "Daily Journal Prompts"], "delivery": "Instant Digital Download"}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('DLD-005', 'Habit Tracker Printable Bundle', 'digital_downloads',
 'Set of 12 printable habit tracker templates. Monthly, weekly, and daily formats. Compatible with any planner or binder system.',
 0.00, 9.99,
 '/images/products/DLD-005.webp', '/mockups/templates/DLD-005.png',
 'Create branded printable habit tracker pages. Show multiple tracker designs fanned out or in a planner. Use brand colors for headers and accents. Include brand logo watermark. Organized, productive aesthetic with pens and planner accessories.',
 314,
 '{"format": "PDF (Printable)", "pages": 12, "features": ["Monthly Overview Tracker", "Weekly Habit Grid", "Daily Routines Tracker", "Goal Setting Worksheets", "Compatible with A4 & Letter Size"], "delivery": "Instant Digital Download"}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('DLD-006', 'Social Media Content Calendar', 'digital_downloads',
 '90-day social media content calendar with post ideas, hashtag strategies, and engagement prompts. Includes editable Canva templates for stories and posts.',
 0.00, 17.99,
 '/images/products/DLD-006.webp', '/mockups/templates/DLD-006.png',
 'Create a branded content calendar cover and sample page. Show the calendar on a laptop screen with a phone showing Instagram beside it. Use brand colors. Professional social media marketing aesthetic.',
 315,
 '{"format": "PDF + Canva Templates", "pages": 32, "features": ["90-Day Content Calendar", "Post Ideas by Category", "Hashtag Strategy Guide", "Engagement Prompts", "Editable Canva Templates"], "delivery": "Instant Digital Download"}')

ON CONFLICT (sku) DO NOTHING;


-- ── Additional Apparel (4 products) ────────────────────────────────────────

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('APR-JOGGER-001', 'Jogger Pants', 'apparel',
 'Premium fleece jogger pants with elastic cuffs and drawstring waist. Unisex fit with side pockets.',
 14.00, 49.99,
 '/images/products/APR-JOGGER-001.webp', '/mockups/templates/APR-JOGGER-001.png',
 'Place the brand logo on the left thigh area of jogger pants. Logo should be approximately 4 inches wide. Embroidered look. Show the joggers on a flat-lay or styled on a model from waist down. Maintain fabric texture and drawstring detail. Athleisure aesthetic.',
 55,
 '{"materials": ["80% Cotton", "20% Polyester", "Fleece Interior"], "sizes": ["XS", "S", "M", "L", "XL", "2XL"], "features": ["Elastic Waist with Drawstring", "Side Pockets", "Elastic Cuffs"]}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('APR-JACKET-001', 'Windbreaker Jacket', 'apparel',
 'Lightweight water-resistant windbreaker with zip front and hood. Packable design fits into its own pocket.',
 16.00, 59.99,
 '/images/products/APR-JACKET-001.webp', '/mockups/templates/APR-JACKET-001.png',
 'Place the brand logo on the left chest of the windbreaker jacket. Logo should be approximately 4 inches wide. Include a small logo on the back between the shoulders. Show the jacket zipped halfway with hood down. Outdoor or urban street aesthetic.',
 56,
 '{"materials": ["100% Nylon Shell", "Mesh Lining", "YKK Zipper"], "sizes": ["XS", "S", "M", "L", "XL", "2XL"], "features": ["Water-Resistant", "Packable into Pocket", "Adjustable Hood", "Elastic Cuffs"]}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('APR-SPORTS-BRA-001', 'Sports Bra', 'apparel',
 'Medium-support sports bra with moisture-wicking fabric. Removable pads and racerback design.',
 7.00, 34.99,
 '/images/products/APR-SPORTS-BRA-001.webp', '/mockups/templates/APR-SPORTS-BRA-001.png',
 'Place the brand logo centered below the neckline on the sports bra. Logo should be approximately 3 inches wide. Show the sports bra on a flat-lay or athletic mannequin. Maintain fabric texture. Fitness-forward, empowering aesthetic.',
 57,
 '{"materials": ["85% Nylon", "15% Spandex", "Moisture-Wicking"], "sizes": ["XS", "S", "M", "L", "XL"], "features": ["Medium Support", "Removable Pads", "Racerback Design", "Moisture-Wicking"]}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('APR-BEANIE-001', 'Cuffed Beanie', 'apparel',
 'Soft ribbed knit beanie with fold-up cuff. Unisex one-size-fits-most.',
 4.00, 22.99,
 '/images/products/APR-BEANIE-001.webp', '/mockups/templates/APR-BEANIE-001.png',
 'Place the brand logo as a woven patch or embroidered design on the fold-up cuff of the beanie. Logo should be approximately 2 inches wide. Show the beanie on a flat surface or wooden head form. Cozy winter aesthetic.',
 58,
 '{"materials": ["100% Acrylic Ribbed Knit"], "sizes": ["One Size Fits Most"], "features": ["Fold-Up Cuff", "Embroidered Logo Patch", "Soft Ribbed Knit"]}')

ON CONFLICT (sku) DO NOTHING;


-- ── Additional Accessories (4 products) ────────────────────────────────────

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('ACC-BACKPACK-001', 'Everyday Backpack', 'accessories',
 'Minimalist water-resistant backpack with padded laptop compartment (fits 15" laptop). Multiple organization pockets.',
 18.00, 64.99,
 '/images/products/ACC-BACKPACK-001.webp', '/mockups/templates/ACC-BACKPACK-001.png',
 'Place the brand logo centered on the front panel of the backpack. Logo should be approximately 5 inches wide. Show the backpack at a 3/4 angle with zippers partially open revealing organization. Urban street or campus setting. Clean, modern everyday carry aesthetic.',
 95,
 '{"materials": ["600D Polyester", "Water-Resistant Coating", "Padded Back Panel", "YKK Zippers"], "dimensions": "17 x 12 x 6 inches", "features": ["Padded Laptop Compartment (15\")", "Water Bottle Pocket", "Front Organizer Pocket", "Adjustable Padded Straps"]}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('ACC-KEYCHAIN-001', 'Leather Keychain', 'accessories',
 'Genuine leather keychain with brass hardware and debossed logo. Comes with key ring and clip.',
 2.00, 14.99,
 '/images/products/ACC-KEYCHAIN-001.webp', '/mockups/templates/ACC-KEYCHAIN-001.png',
 'Place the brand logo debossed on a leather keychain tag. Show the keychain on a flat surface with keys attached, beside a wallet or bag. Use brand color for the leather (natural tan, black, or brand-matched). Minimal everyday carry aesthetic.',
 96,
 '{"materials": ["Genuine Leather", "Brass Hardware", "Steel Key Ring"], "dimensions": "4.5 x 1.5 inches", "features": ["Debossed Logo", "Lobster Clasp", "Key Ring"]}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('ACC-SUNGLASSES-001', 'Branded Sunglasses', 'accessories',
 'UV400 polarized sunglasses with classic wayfarer frame. Custom brand logo on temples.',
 5.00, 29.99,
 '/images/products/ACC-SUNGLASSES-001.webp', '/mockups/templates/ACC-SUNGLASSES-001.png',
 'Place the brand logo on both temples of wayfarer-style sunglasses. Show the sunglasses folded on a marble surface or being worn in an outdoor lifestyle shot. Include a branded microfiber cleaning cloth. Summer, fashion-forward aesthetic.',
 97,
 '{"materials": ["Polycarbonate Lenses", "Acetate Frame"], "features": ["UV400 Protection", "Polarized Lenses", "Logo on Temples", "Includes Microfiber Cloth & Case"]}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('ACC-NOTEBOOK-001', 'Pocket Notebook (3-pack)', 'accessories',
 'Set of 3 pocket-sized notebooks with branded cover. 48 pages each, dotted grid. Perfect for quick notes and ideas.',
 2.00, 12.99,
 '/images/products/ACC-NOTEBOOK-001.webp', '/mockups/templates/ACC-NOTEBOOK-001.png',
 'Place the brand logo on the front cover of pocket notebooks. Show 3 notebooks fanned out with different brand accent colors. Include one open to show dotted grid interior. Desk setting with a pen and coffee. Creative, on-the-go aesthetic.',
 98,
 '{"materials": ["Cardstock Cover", "60lb Paper", "Saddle-Stitched"], "count": 3, "pages": "48 pages each", "dimensions": "3.5 x 5.5 inches", "ruling": "Dotted Grid"}')

ON CONFLICT (sku) DO NOTHING;


-- ── Summary ─────────────────────────────────────────────────────────────────
-- Added 18 new products across 4 categories (2 new + 2 expanded):
--   Candles & Home Fragrance:  4 products (CND-001 through CND-004)
--   Digital Downloads:         6 products (DLD-001 through DLD-006)
--   Additional Apparel:        4 products (APR-JOGGER-001 through APR-BEANIE-001)
--   Additional Accessories:    4 products (ACC-BACKPACK-001 through ACC-NOTEBOOK-001)
-- Total catalog: 54 existing + 18 new = 72 products
-- =============================================================================
