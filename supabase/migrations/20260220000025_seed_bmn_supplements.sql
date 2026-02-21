-- =============================================================================
-- 20260220000025_seed_bmn_supplements.sql
-- Seed 12 BrandMeNow.ai reference supplement products with BMN- SKU prefix.
-- Each product links to its packaging template via template_id subquery.
-- =============================================================================

-- ── BMN-001: Mushroom Immune Booster ──────────────────────────────────────────

INSERT INTO public.products (
  sku, name, category, subcategory, description,
  base_cost, retail_price,
  image_url, mockup_template_url, mockup_instructions,
  template_id, sort_order, metadata
) VALUES (
  'BMN-001',
  'Mushroom Immune Booster',
  'supplements',
  'general_health',
  'Powerful immune support blend featuring Lion''s Mane, Reishi, Chaga, Turkey Tail, and Cordyceps mushroom extracts. Dual-extracted for maximum bioavailability. 60 vegetable capsules, 30-day supply.',
  8.00, 34.99,
  '/images/products/BMN-001.webp',
  '/mockups/templates/BMN-001.png',
  'Place the brand logo on the front of a white supplement bottle with an earthy, natural-toned label. Include "Mushroom Immune Booster" text with subtle mushroom illustrations. Show the bottle at a 3/4 angle with a few capsules beside it on a wooden surface. Premium wellness aesthetic.',
  (SELECT id FROM public.packaging_templates WHERE slug = 'supplement-bottle-60ct'),
  400,
  '{"ingredients": ["Lion''s Mane Extract (500mg)", "Reishi Extract (400mg)", "Chaga Extract (300mg)", "Turkey Tail Extract (250mg)", "Cordyceps Extract (200mg)", "BioPerine Black Pepper Extract (5mg)"], "serving_size": "2 capsules", "servings_per_container": 30, "weight": "3.2 oz", "form": "capsules", "count": 60}'::jsonb
)
ON CONFLICT (sku) DO NOTHING;


-- ── BMN-002: Sleep Formula ───────────────────────────────────────────────────

INSERT INTO public.products (
  sku, name, category, subcategory, description,
  base_cost, retail_price,
  image_url, mockup_template_url, mockup_instructions,
  template_id, sort_order, metadata
) VALUES (
  'BMN-002',
  'Sleep Formula',
  'supplements',
  'general_health',
  'Advanced sleep support with Magnesium Glycinate, L-Theanine, GABA, Chamomile, and Melatonin. Promotes deep, restorative sleep without morning grogginess. 60 vegetable capsules.',
  7.00, 32.99,
  '/images/products/BMN-002.webp',
  '/mockups/templates/BMN-002.png',
  'Place the brand logo on a supplement bottle with a calming deep purple/navy label. Include "Sleep Formula" text with moon and stars motif. Show the bottle on a nightstand with soft ambient lighting. Serene, restful aesthetic.',
  (SELECT id FROM public.packaging_templates WHERE slug = 'supplement-bottle-60ct'),
  401,
  '{"ingredients": ["Magnesium Glycinate (400mg)", "L-Theanine (200mg)", "GABA (100mg)", "Chamomile Extract (150mg)", "Passionflower Extract (100mg)", "Melatonin (3mg)"], "serving_size": "2 capsules", "servings_per_container": 30, "weight": "3.0 oz", "form": "capsules", "count": 60}'::jsonb
)
ON CONFLICT (sku) DO NOTHING;


-- ── BMN-003: Magnesium Glycinate ──────────────────────────────────────────────

INSERT INTO public.products (
  sku, name, category, subcategory, description,
  base_cost, retail_price,
  image_url, mockup_template_url, mockup_instructions,
  template_id, sort_order, metadata
) VALUES (
  'BMN-003',
  'Magnesium Glycinate',
  'supplements',
  'general_health',
  'Highly absorbable Magnesium Glycinate chelate for muscle relaxation, nerve support, and restful sleep. Gentle on the stomach. 60 vegetable capsules providing 400mg elemental magnesium.',
  6.00, 29.99,
  '/images/products/BMN-003.webp',
  '/mockups/templates/BMN-003.png',
  'Place the brand logo on a clean, minimalist supplement bottle with a soft blue or teal label. Include "Magnesium Glycinate" text and "400mg" dosage callout. Show the bottle with capsules on a clean white surface. Clinical, premium aesthetic.',
  (SELECT id FROM public.packaging_templates WHERE slug = 'supplement-bottle-60ct'),
  402,
  '{"ingredients": ["Magnesium Glycinate Chelate (400mg elemental magnesium)", "Vegetable Cellulose Capsule", "Rice Flour"], "serving_size": "2 capsules", "servings_per_container": 30, "weight": "3.1 oz", "form": "capsules", "count": 60}'::jsonb
)
ON CONFLICT (sku) DO NOTHING;


-- ── BMN-004: Vitamin K2+D3 ───────────────────────────────────────────────────

INSERT INTO public.products (
  sku, name, category, subcategory, description,
  base_cost, retail_price,
  image_url, mockup_template_url, mockup_instructions,
  template_id, sort_order, metadata
) VALUES (
  'BMN-004',
  'Vitamin K2+D3',
  'supplements',
  'general_health',
  'Synergistic Vitamin K2 (MK-7) and D3 formula for bone health, calcium metabolism, and immune function. Bioavailable MenaQ7 K2 with Cholecalciferol D3. 60 softgels.',
  5.00, 27.99,
  '/images/products/BMN-004.webp',
  '/mockups/templates/BMN-004.png',
  'Place the brand logo on a supplement bottle with a bright, sunny yellow/orange label. Include "Vitamin K2+D3" text with a sun icon. Show the bottle with softgels on a light surface with natural sunlight. Bright, healthy, optimistic aesthetic.',
  (SELECT id FROM public.packaging_templates WHERE slug = 'supplement-bottle-60ct'),
  403,
  '{"ingredients": ["Vitamin D3 (Cholecalciferol, 5000 IU)", "Vitamin K2 (MenaQ7 MK-7, 100mcg)", "Olive Oil", "Softgel Capsule (Gelatin, Glycerin, Water)"], "serving_size": "1 softgel", "servings_per_container": 60, "weight": "2.8 oz", "form": "softgels", "count": 60}'::jsonb
)
ON CONFLICT (sku) DO NOTHING;


-- ── BMN-005: Ashwagandha KSM-66 ──────────────────────────────────────────────

INSERT INTO public.products (
  sku, name, category, subcategory, description,
  base_cost, retail_price,
  image_url, mockup_template_url, mockup_instructions,
  template_id, sort_order, metadata
) VALUES (
  'BMN-005',
  'Ashwagandha KSM-66',
  'supplements',
  'general_health',
  'Full-spectrum Ashwagandha root extract using patented KSM-66 process. Clinically studied for stress relief, cortisol reduction, and enhanced athletic performance. 600mg per serving, 60 vegetable capsules.',
  8.00, 34.99,
  '/images/products/BMN-005.webp',
  '/mockups/templates/BMN-005.png',
  'Place the brand logo on a supplement bottle with earthy green and brown label tones. Include "Ashwagandha KSM-66" text with a botanical leaf illustration. Show the bottle with capsules on a natural stone surface. Wellness-focused, premium adaptogen aesthetic.',
  (SELECT id FROM public.packaging_templates WHERE slug = 'supplement-bottle-60ct'),
  404,
  '{"ingredients": ["Ashwagandha Root Extract (KSM-66, 600mg)", "BioPerine Black Pepper Extract (5mg)", "Vegetable Cellulose Capsule"], "serving_size": "2 capsules", "servings_per_container": 30, "weight": "3.0 oz", "form": "capsules", "count": 60}'::jsonb
)
ON CONFLICT (sku) DO NOTHING;


-- ── BMN-006: Probiotic 40 Billion CFU ─────────────────────────────────────────

INSERT INTO public.products (
  sku, name, category, subcategory, description,
  base_cost, retail_price,
  image_url, mockup_template_url, mockup_instructions,
  template_id, sort_order, metadata
) VALUES (
  'BMN-006',
  'Probiotic 40 Billion CFU',
  'supplements',
  'general_health',
  'Shelf-stable probiotic with 40 billion CFU from 16 clinically studied strains. Delayed-release capsules survive stomach acid for maximum intestinal delivery. 30 vegetable capsules.',
  9.00, 36.99,
  '/images/products/BMN-006.webp',
  '/mockups/templates/BMN-006.png',
  'Place the brand logo on a supplement bottle with a clean, clinical blue-and-white label. Include "Probiotic 40 Billion CFU" text and "16 Strains" callout. Show the bottle with a few capsules on a clean, bright surface. Professional, science-backed aesthetic.',
  (SELECT id FROM public.packaging_templates WHERE slug = 'supplement-bottle-30ct'),
  405,
  '{"ingredients": ["Lactobacillus acidophilus", "Lactobacillus rhamnosus", "Bifidobacterium lactis", "Lactobacillus plantarum", "Bifidobacterium longum", "12 additional strains", "Prebiotic FOS (100mg)"], "serving_size": "1 capsule", "servings_per_container": 30, "weight": "1.8 oz", "form": "capsules", "count": 30}'::jsonb
)
ON CONFLICT (sku) DO NOTHING;


-- ── BMN-007: Organic Super Greens ─────────────────────────────────────────────

INSERT INTO public.products (
  sku, name, category, subcategory, description,
  base_cost, retail_price,
  image_url, mockup_template_url, mockup_instructions,
  template_id, sort_order, metadata
) VALUES (
  'BMN-007',
  'Organic Super Greens',
  'supplements',
  'premium_superfoods',
  'USDA Organic superfood greens blend with 30+ nutrient-dense ingredients including spirulina, chlorella, wheatgrass, and adaptogenic mushrooms. Naturally sweetened with monk fruit. 30 servings.',
  13.00, 49.99,
  '/images/products/BMN-007.webp',
  '/mockups/templates/BMN-007.png',
  'Place the brand logo on a powder tub with a vibrant green and earthy label design. Include "Organic Super Greens" text and "30+ Superfoods" callout. Show the tub with a scoop of green powder and a green smoothie glass nearby. Fresh, organic, health-conscious aesthetic.',
  (SELECT id FROM public.packaging_templates WHERE slug = 'supplement-tub-powder'),
  406,
  '{"ingredients": ["Organic Spirulina", "Organic Chlorella", "Organic Wheatgrass", "Organic Barley Grass", "Organic Matcha", "Organic Ashwagandha", "Organic Turmeric", "Organic Moringa", "Probiotic Blend (2B CFU)", "Digestive Enzyme Blend", "Monk Fruit Extract"], "serving_size": "1 scoop (10g)", "servings_per_container": 30, "weight": "10.6 oz", "form": "powder"}'::jsonb
)
ON CONFLICT (sku) DO NOTHING;


-- ── BMN-008: Ultra Test ──────────────────────────────────────────────────────

INSERT INTO public.products (
  sku, name, category, subcategory, description,
  base_cost, retail_price,
  image_url, mockup_template_url, mockup_instructions,
  template_id, sort_order, metadata
) VALUES (
  'BMN-008',
  'Ultra Test',
  'supplements',
  'mens_health',
  'Premium testosterone support formula with Tongkat Ali, Fadogia Agrestis, Fenugreek, and Zinc. Designed for men seeking to optimize natural testosterone production, energy, and athletic performance. 60 capsules.',
  10.00, 44.99,
  '/images/products/BMN-008.webp',
  '/mockups/templates/BMN-008.png',
  'Place the brand logo on a supplement bottle with a bold, masculine black and red/gold label. Include "Ultra Test" text in strong typography. Show the bottle with a gym or athletic setting in the background. Powerful, performance-driven aesthetic.',
  (SELECT id FROM public.packaging_templates WHERE slug = 'supplement-bottle-60ct'),
  407,
  '{"ingredients": ["Tongkat Ali Extract (400mg)", "Fadogia Agrestis Extract (300mg)", "Fenugreek Seed Extract (300mg)", "Zinc (30mg)", "Vitamin D3 (2000 IU)", "Boron (10mg)", "BioPerine (5mg)"], "serving_size": "2 capsules", "servings_per_container": 30, "weight": "3.2 oz", "form": "capsules", "count": 60}'::jsonb
)
ON CONFLICT (sku) DO NOTHING;


-- ── BMN-009: Ultra Multivitamin For Men ───────────────────────────────────────

INSERT INTO public.products (
  sku, name, category, subcategory, description,
  base_cost, retail_price,
  image_url, mockup_template_url, mockup_instructions,
  template_id, sort_order, metadata
) VALUES (
  'BMN-009',
  'Ultra Multivitamin For Men',
  'supplements',
  'mens_health',
  'Comprehensive daily multivitamin formulated specifically for men. Features methylated B-vitamins, chelated minerals, CoQ10, Lycopene, and Saw Palmetto for prostate health. 60 tablets.',
  7.00, 34.99,
  '/images/products/BMN-009.webp',
  '/mockups/templates/BMN-009.png',
  'Place the brand logo on a supplement bottle with a strong blue and silver label design. Include "Ultra Multivitamin For Men" text. Show the bottle with tablets on a clean desk or gym bench. Clean, premium men''s health aesthetic.',
  (SELECT id FROM public.packaging_templates WHERE slug = 'supplement-bottle-60ct'),
  408,
  '{"ingredients": ["Vitamin A (2500 IU)", "Vitamin C (500mg)", "Vitamin D3 (2000 IU)", "Vitamin E (30 IU)", "Vitamin K2 (80mcg)", "Methylated B-Complex", "Zinc (25mg)", "Selenium (200mcg)", "CoQ10 (100mg)", "Lycopene (10mg)", "Saw Palmetto (320mg)"], "serving_size": "2 tablets", "servings_per_container": 30, "weight": "4.0 oz", "form": "tablets", "count": 60}'::jsonb
)
ON CONFLICT (sku) DO NOTHING;


-- ── BMN-010: Male Enhancement Formula ─────────────────────────────────────────

INSERT INTO public.products (
  sku, name, category, subcategory, description,
  base_cost, retail_price,
  image_url, mockup_template_url, mockup_instructions,
  template_id, sort_order, metadata
) VALUES (
  'BMN-010',
  'Male Enhancement Formula',
  'supplements',
  'mens_health',
  'Natural male performance support with L-Citrulline, Maca Root, Horny Goat Weed, Tribulus, and Ginseng. Formulated for stamina, blood flow, and vitality. 60 capsules.',
  12.00, 49.99,
  '/images/products/BMN-010.webp',
  '/mockups/templates/BMN-010.png',
  'Place the brand logo on a supplement bottle with a bold black and gold label design. Include "Male Enhancement Formula" in premium typography. Show the bottle on a dark marble or slate surface with dramatic lighting. Luxurious, masculine, confident aesthetic.',
  (SELECT id FROM public.packaging_templates WHERE slug = 'supplement-bottle-60ct'),
  409,
  '{"ingredients": ["L-Citrulline (1500mg)", "Maca Root Extract (1000mg)", "Horny Goat Weed Extract (500mg)", "Tribulus Terrestris (500mg)", "Panax Ginseng Extract (250mg)", "Zinc (30mg)", "BioPerine (5mg)"], "serving_size": "2 capsules", "servings_per_container": 30, "weight": "3.5 oz", "form": "capsules", "count": 60}'::jsonb
)
ON CONFLICT (sku) DO NOTHING;


-- ── BMN-011: Ultra Vita For Women ─────────────────────────────────────────────

INSERT INTO public.products (
  sku, name, category, subcategory, description,
  base_cost, retail_price,
  image_url, mockup_template_url, mockup_instructions,
  template_id, sort_order, metadata
) VALUES (
  'BMN-011',
  'Ultra Vita For Women',
  'supplements',
  'womens_health',
  'Complete daily multivitamin designed for women. Includes methylated folate, Iron, Calcium, Biotin for hair/skin/nails, Cranberry extract for urinary health, and adaptogenic Maca. 60 capsules.',
  7.00, 34.99,
  '/images/products/BMN-011.webp',
  '/mockups/templates/BMN-011.png',
  'Place the brand logo on a supplement bottle with an elegant rose-gold and white label design. Include "Ultra Vita For Women" text with a subtle floral accent. Show the bottle on a vanity or bright, airy surface. Premium, feminine wellness aesthetic.',
  (SELECT id FROM public.packaging_templates WHERE slug = 'supplement-bottle-60ct'),
  410,
  '{"ingredients": ["Vitamin A (2500 IU)", "Vitamin C (500mg)", "Vitamin D3 (2000 IU)", "Methylated Folate (800mcg)", "Iron (18mg)", "Calcium (500mg)", "Biotin (5000mcg)", "Cranberry Extract (250mg)", "Maca Root (200mg)", "Chasteberry (150mg)"], "serving_size": "2 capsules", "servings_per_container": 30, "weight": "3.8 oz", "form": "capsules", "count": 60}'::jsonb
)
ON CONFLICT (sku) DO NOTHING;


-- ── BMN-012: Creatine Monohydrate ─────────────────────────────────────────────

INSERT INTO public.products (
  sku, name, category, subcategory, description,
  base_cost, retail_price,
  image_url, mockup_template_url, mockup_instructions,
  template_id, sort_order, metadata
) VALUES (
  'BMN-012',
  'Creatine Monohydrate',
  'supplements',
  'premium_superfoods',
  'Micronized Creatine Monohydrate powder for strength, power output, and muscle recovery. 5g per serving, unflavored, mixes easily into any beverage. 30 servings. Third-party tested for purity.',
  8.00, 29.99,
  '/images/products/BMN-012.webp',
  '/mockups/templates/BMN-012.png',
  'Place the brand logo on a powder tub with a bold, clean black and white label. Include "Creatine Monohydrate" text and "5g Per Serving" callout. Show the tub with a scoop of white powder and a shaker bottle nearby. Athletic, performance-driven aesthetic.',
  (SELECT id FROM public.packaging_templates WHERE slug = 'supplement-tub-powder'),
  411,
  '{"ingredients": ["Micronized Creatine Monohydrate (5g)"], "serving_size": "1 scoop (5g)", "servings_per_container": 30, "weight": "5.3 oz", "form": "powder"}'::jsonb
)
ON CONFLICT (sku) DO NOTHING;


-- ── Summary ─────────────────────────────────────────────────────────────────
-- Seeded 12 BrandMeNow.ai reference supplement products (BMN-001 to BMN-012):
--   General Health:       BMN-001 through BMN-006 (6 products)
--   Premium Superfoods:   BMN-007, BMN-012 (2 products)
--   Men's Health:         BMN-008 through BMN-010 (3 products)
--   Women's Health:       BMN-011 (1 product)
--
-- Template assignments:
--   supplement-bottle-60ct: BMN-001 to BMN-005, BMN-008 to BMN-011 (9 products)
--   supplement-bottle-30ct: BMN-006 (1 product)
--   supplement-tub-powder:  BMN-007, BMN-012 (2 products)
-- =============================================================================
