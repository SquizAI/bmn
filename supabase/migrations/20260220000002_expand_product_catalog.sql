-- =============================================================================
-- 20260220000002_expand_product_catalog.sql
-- Expand product catalog from 24 to 54 products (30 new)
-- Adds 5 new categories: supplements, skincare, wellness, food_beverage, journals
-- =============================================================================

-- ── Step 1: Expand the category CHECK constraint ────────────────────────────
-- The existing constraint only allows: apparel, accessories, home_goods, packaging, digital
-- We need to add: supplements, skincare, wellness, food_beverage, journals

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_category_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_category_check
  CHECK (category IN (
    'apparel', 'accessories', 'home_goods', 'packaging', 'digital',
    'supplements', 'skincare', 'wellness', 'food_beverage', 'journals'
  ));

-- ── Step 2: Insert new products ─────────────────────────────────────────────

-- ── Supplements & Nutrition (8 products) ────────────────────────────────────

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('SUP-001', 'Protein Powder (30 servings)', 'supplements',
 'Premium whey protein isolate powder with 25g protein per serving. Available in vanilla, chocolate, and strawberry flavors. Clean label with no artificial sweeteners.',
 12.00, 44.99,
 '/images/products/SUP-001.webp', '/mockups/templates/SUP-001.png',
 'Place the brand logo prominently on the front of a cylindrical protein powder tub (2lb size). Use brand colors for the label design. Include product name "Protein Powder" below the logo. Show nutritional highlights (25g protein, 30 servings). Photograph the tub at a 3/4 angle on a gym or kitchen countertop with a scoop of powder beside it. Clean, premium supplement branding.',
 250,
 '{"ingredients": ["Whey Protein Isolate", "Natural Flavoring", "Sunflower Lecithin", "Stevia Leaf Extract", "Sea Salt"], "serving_size": "1 scoop (33g)", "servings_per_container": 30, "weight": "2.2 lbs"}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('SUP-002', 'Pre-Workout Formula', 'supplements',
 'High-performance pre-workout powder with caffeine, beta-alanine, and citrulline for explosive energy and pump. Fruit punch flavor.',
 10.00, 39.99,
 '/images/products/SUP-002.webp', '/mockups/templates/SUP-002.png',
 'Place the brand logo on the front of a pre-workout supplement tub with an energetic, bold label design. Use brand colors with high-contrast accents. Include "Pre-Workout" text and lightning bolt or energy motifs. Show the tub with a shaker bottle nearby. Dynamic, high-energy aesthetic.',
 251,
 '{"ingredients": ["L-Citrulline Malate", "Beta-Alanine", "Caffeine Anhydrous (200mg)", "L-Tyrosine", "Taurine", "Vitamin B12"], "serving_size": "1 scoop (12g)", "servings_per_container": 30, "weight": "12.7 oz"}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('SUP-003', 'Ashwagandha Complex', 'supplements',
 'Adaptogenic ashwagandha root extract with black pepper for enhanced absorption. Supports stress relief, focus, and hormonal balance. 60 vegetable capsules.',
 8.00, 34.99,
 '/images/products/SUP-003.webp', '/mockups/templates/SUP-003.png',
 'Place the brand logo on a sleek supplement bottle with capsules. Use earthy, calming brand colors. Include "Ashwagandha Complex" text and botanical leaf illustration. Show the bottle with a few capsules scattered beside it on a natural stone or wood surface. Wellness-focused, premium aesthetic.',
 252,
 '{"ingredients": ["Ashwagandha Root Extract (KSM-66, 600mg)", "Black Pepper Extract (BioPerine, 5mg)", "Vegetable Cellulose Capsule"], "serving_size": "2 capsules", "servings_per_container": 30, "form": "capsules", "count": 60}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('SUP-004', 'Collagen Peptides', 'supplements',
 'Hydrolyzed collagen peptides powder sourced from grass-fed bovine. Supports skin, hair, nails, and joint health. Unflavored, mixes into any drink.',
 11.00, 42.99,
 '/images/products/SUP-004.webp', '/mockups/templates/SUP-004.png',
 'Place the brand logo on a minimalist, elegant collagen peptides pouch or tub. Use soft, feminine brand colors with clean typography. Include "Collagen Peptides" text. Show the product with a glass of water and a scoop of white powder. Bright, airy lifestyle photography style.',
 253,
 '{"ingredients": ["Hydrolyzed Bovine Collagen Peptides (Type I & III)", "Vitamin C", "Hyaluronic Acid"], "serving_size": "1 scoop (11g)", "servings_per_container": 30, "weight": "11.6 oz", "source": "Grass-Fed Bovine"}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('SUP-005', 'Multivitamin Gummies', 'supplements',
 'Daily multivitamin gummies with essential vitamins and minerals. Natural fruit flavors, pectin-based, and gelatin-free. 60 gummies per bottle.',
 6.00, 29.99,
 '/images/products/SUP-005.webp', '/mockups/templates/SUP-005.png',
 'Place the brand logo on a cheerful, colorful gummy vitamin bottle. Use brand colors with a playful but premium label design. Include "Multivitamin Gummies" text and a small illustration of fruit. Show the bottle with a few colorful gummies spilled beside it on a bright background.',
 254,
 '{"ingredients": ["Vitamin A", "Vitamin C", "Vitamin D3", "Vitamin E", "Vitamin B6", "Vitamin B12", "Folate", "Biotin", "Zinc", "Iodine", "Pectin", "Natural Fruit Flavors"], "serving_size": "2 gummies", "servings_per_container": 30, "form": "gummies", "count": 60}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('SUP-006', 'BCAA Recovery Mix', 'supplements',
 'Branch-chain amino acid recovery powder in a 2:1:1 ratio. Helps reduce muscle soreness and supports recovery. Watermelon flavor.',
 9.00, 36.99,
 '/images/products/SUP-006.webp', '/mockups/templates/SUP-006.png',
 'Place the brand logo on an athletic-styled BCAA supplement tub. Use bold brand colors with clean lines. Include "BCAA Recovery Mix" text and a ratio callout (2:1:1). Show the tub next to a gym towel and filled shaker bottle. Sporty, performance-driven aesthetic.',
 255,
 '{"ingredients": ["L-Leucine (3g)", "L-Isoleucine (1.5g)", "L-Valine (1.5g)", "Coconut Water Powder", "Electrolyte Blend", "Natural Flavoring"], "serving_size": "1 scoop (9g)", "servings_per_container": 30, "weight": "9.5 oz"}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('SUP-007', 'Greens Superfood Powder', 'supplements',
 'Organic greens blend with 30+ superfoods, probiotics, and digestive enzymes. Supports immunity, energy, and gut health. Naturally sweetened.',
 13.00, 49.99,
 '/images/products/SUP-007.webp', '/mockups/templates/SUP-007.png',
 'Place the brand logo on a greens supplement tub with a natural, organic-inspired label design. Use green brand tones with earth-colored accents. Include "Greens Superfood" text and highlight "30+ Superfoods" callout. Show the tub with a green smoothie glass nearby and scattered spinach/kale leaves. Fresh, health-conscious aesthetic.',
 256,
 '{"ingredients": ["Organic Wheatgrass", "Organic Spirulina", "Organic Chlorella", "Organic Barley Grass", "Matcha Green Tea", "Ashwagandha", "Turmeric", "Probiotic Blend (1B CFU)", "Digestive Enzyme Blend"], "serving_size": "1 scoop (10g)", "servings_per_container": 30, "weight": "10.6 oz"}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('SUP-008', 'Magnesium Sleep Complex', 'supplements',
 'Magnesium glycinate with L-theanine and melatonin for restful sleep. Gentle on the stomach. 60 capsules, 30-day supply.',
 7.00, 32.99,
 '/images/products/SUP-008.webp', '/mockups/templates/SUP-008.png',
 'Place the brand logo on a calming, nighttime-themed supplement bottle. Use deep purple or navy brand colors with moonlight accents. Include "Sleep Complex" text and a crescent moon icon. Show the bottle on a nightstand beside a book and dim lamp. Serene, restful aesthetic.',
 257,
 '{"ingredients": ["Magnesium Glycinate (400mg)", "L-Theanine (200mg)", "Melatonin (3mg)", "Chamomile Extract", "Passionflower Extract", "GABA"], "serving_size": "2 capsules", "servings_per_container": 30, "form": "capsules", "count": 60}')

ON CONFLICT (sku) DO NOTHING;


-- ── Skincare & Beauty (6 products) ──────────────────────────────────────────

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('SKN-001', 'Vitamin C Serum', 'skincare',
 'Brightening facial serum with 20% Vitamin C, hyaluronic acid, and vitamin E. Targets dark spots, fine lines, and uneven skin tone. 1 fl oz dropper bottle.',
 5.00, 38.99,
 '/images/products/SKN-001.webp', '/mockups/templates/SKN-001.png',
 'Place the brand logo on a sleek amber glass dropper bottle with a minimalist white label. Include "Vitamin C Serum" in elegant typography. Show the bottle with a few golden drops on a marble surface beside citrus slices. Luxury skincare aesthetic with soft, diffused lighting.',
 260,
 '{"ingredients": ["L-Ascorbic Acid (Vitamin C, 20%)", "Hyaluronic Acid", "Vitamin E (Tocopherol)", "Ferulic Acid", "Aloe Vera Extract", "Jojoba Oil"], "volume": "1 fl oz (30ml)", "skin_type": "All skin types"}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('SKN-002', 'Hyaluronic Acid Moisturizer', 'skincare',
 'Lightweight daily moisturizer with triple-weight hyaluronic acid for deep hydration. Non-comedogenic, fragrance-free. 2 fl oz.',
 6.00, 42.99,
 '/images/products/SKN-002.webp', '/mockups/templates/SKN-002.png',
 'Place the brand logo on a frosted glass jar with a clean, minimal label. Include "Hyaluronic Moisturizer" text. Show the jar open with a swirl of cream visible, on a clean white surface with water droplets for a hydration theme. Dermatologist-grade aesthetic with soft natural light.',
 261,
 '{"ingredients": ["Triple-Weight Hyaluronic Acid", "Squalane", "Ceramide Complex", "Niacinamide (Vitamin B3)", "Aloe Vera", "Green Tea Extract"], "volume": "2 fl oz (60ml)", "skin_type": "All skin types, fragrance-free"}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('SKN-003', 'Retinol Night Cream', 'skincare',
 'Anti-aging night cream with encapsulated retinol and peptides. Reduces wrinkles and improves skin elasticity while you sleep. 1.7 fl oz.',
 7.00, 44.99,
 '/images/products/SKN-003.webp', '/mockups/templates/SKN-003.png',
 'Place the brand logo on a luxurious dark-toned jar with gold or silver accents. Include "Retinol Night Cream" in refined typography. Show the jar on a vanity surface with soft evening lighting, perhaps beside a silk pillowcase. Premium, anti-aging skincare aesthetic.',
 262,
 '{"ingredients": ["Encapsulated Retinol (0.5%)", "Peptide Complex", "Shea Butter", "Vitamin E", "Squalane", "Bakuchiol"], "volume": "1.7 fl oz (50ml)", "skin_type": "Mature / aging skin, PM use only"}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('SKN-004', 'SPF 50 Sunscreen', 'skincare',
 'Broad-spectrum SPF 50 mineral sunscreen. Lightweight, non-greasy formula with no white cast. Reef-safe and water-resistant (80 min). 3 fl oz.',
 4.00, 28.99,
 '/images/products/SKN-004.webp', '/mockups/templates/SKN-004.png',
 'Place the brand logo on a squeeze tube of sunscreen with a bright, summery label design. Use brand colors with sun/beach motifs. Include "SPF 50" prominently and "Broad Spectrum" text. Show the tube on sand or beside sunglasses with bright natural sunlight. Active, outdoor lifestyle aesthetic.',
 263,
 '{"ingredients": ["Zinc Oxide (20%)", "Vitamin E", "Green Tea Extract", "Aloe Vera", "Coconut Oil", "Shea Butter"], "volume": "3 fl oz (89ml)", "spf": 50, "skin_type": "All skin types, reef-safe"}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('SKN-005', 'Lip Balm Set (3-pack)', 'skincare',
 'Moisturizing lip balm trio in vanilla, mint, and berry flavors. Made with beeswax, coconut oil, and vitamin E. Natural ingredients, long-lasting hydration.',
 2.00, 14.99,
 '/images/products/SKN-005.webp', '/mockups/templates/SKN-005.png',
 'Place the brand logo on three lip balm tubes arranged in a row or triangular formation. Each tube has a slightly different color accent (vanilla=cream, mint=green, berry=pink). Minimalist label with brand logo and flavor name. Show on a flat-lay with flowers or fruit. Cute, giftable aesthetic.',
 264,
 '{"ingredients": ["Beeswax", "Coconut Oil", "Shea Butter", "Vitamin E", "Natural Flavor Oils"], "count": 3, "flavors": ["Vanilla", "Mint", "Berry"]}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('SKN-006', 'Face Cleanser', 'skincare',
 'Gentle daily face cleanser with salicylic acid and green tea. Removes impurities without stripping moisture. Suitable for all skin types. 5 fl oz.',
 4.00, 26.99,
 '/images/products/SKN-006.webp', '/mockups/templates/SKN-006.png',
 'Place the brand logo on a sleek pump bottle with a clean, dermatological label design. Include "Face Cleanser" text. Show the bottle with a foam pump dispenser, a small amount of foamy cleanser on fingertips nearby. Bathroom counter setting with a towel and small plant. Clean, spa-like aesthetic.',
 265,
 '{"ingredients": ["Salicylic Acid (2%)", "Green Tea Extract", "Aloe Vera", "Chamomile Extract", "Glycerin", "Coconut-Derived Surfactants"], "volume": "5 fl oz (148ml)", "skin_type": "All skin types"}')

ON CONFLICT (sku) DO NOTHING;


-- ── Wellness & Fitness (6 products) ─────────────────────────────────────────

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('WEL-001', 'Resistance Band Set', 'wellness',
 'Set of 5 latex resistance bands with varying tension levels (5-40 lbs). Includes carrying pouch and exercise guide. Color-coded by resistance level.',
 8.00, 34.99,
 '/images/products/WEL-001.webp', '/mockups/templates/WEL-001.png',
 'Place the brand logo on the carrying pouch and on each resistance band near the handle area. Show 5 color-coded bands (light to heavy) fanned out with the branded pouch. Include brand name on the pouch flap. Gym floor or yoga mat setting. Active, fitness-focused aesthetic.',
 270,
 '{"materials": ["Natural Latex", "Nylon Handles", "Polyester Carrying Pouch"], "count": 5, "resistance_levels": ["Extra Light (5 lbs)", "Light (10 lbs)", "Medium (20 lbs)", "Heavy (30 lbs)", "Extra Heavy (40 lbs)"]}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('WEL-002', 'Yoga Mat (Premium)', 'wellness',
 'Extra-thick 6mm premium yoga mat with non-slip surface and alignment markings. Includes carrying strap. 72 x 26 inches.',
 12.00, 54.99,
 '/images/products/WEL-002.webp', '/mockups/templates/WEL-002.png',
 'Place the brand logo in the bottom-right corner of a rolled-out yoga mat. Logo should be embossed or printed subtly. Use brand colors for the mat itself. Show the mat partially rolled with the carrying strap, in a bright studio or outdoor zen garden setting. Calm, mindful aesthetic.',
 271,
 '{"materials": ["TPE (Thermoplastic Elastomer)", "Non-Slip Surface Layer", "Nylon Carrying Strap"], "dimensions": "72 x 26 x 0.24 inches (6mm)", "weight": "2.5 lbs"}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('WEL-003', 'Shaker Bottle', 'wellness',
 'BPA-free shaker bottle with wire whisk ball and leak-proof lid. 28oz capacity with measurement markings. Perfect for protein shakes and supplements.',
 3.00, 18.99,
 '/images/products/WEL-003.webp', '/mockups/templates/WEL-003.png',
 'Place the brand logo prominently on the front of the shaker bottle. Use brand colors for the bottle body or lid accent. Include brand name. Show the bottle with the whisk ball visible inside, lid open, on a gym bench or kitchen counter. Functional, sporty aesthetic.',
 272,
 '{"materials": ["BPA-Free Tritan Plastic", "Stainless Steel Whisk Ball", "Silicone Seal"], "capacity": "28 oz (828ml)", "features": ["Leak-Proof Lid", "Measurement Markings", "Dishwasher Safe"]}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('WEL-004', 'Gym Towel Set', 'wellness',
 'Set of 2 quick-dry microfiber gym towels. One large (24x48") and one small (16x28"). Lightweight, ultra-absorbent, and machine washable.',
 5.00, 24.99,
 '/images/products/WEL-004.webp', '/mockups/templates/WEL-004.png',
 'Place the brand logo embroidered in one corner of each folded gym towel. Show both towels (large and small) neatly folded and stacked. Use brand colors for the towel or the embroidery. Gym locker room or clean bench setting. Premium athletic aesthetic.',
 273,
 '{"materials": ["Microfiber (80% Polyester, 20% Polyamide)"], "count": 2, "dimensions": {"large": "24 x 48 inches", "small": "16 x 28 inches"}, "features": ["Quick-Dry", "Ultra-Absorbent", "Machine Washable"]}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('WEL-005', 'Massage Gun (Mini)', 'wellness',
 'Compact percussive massage gun with 4 speed settings and 4 interchangeable heads. USB-C rechargeable with 6-hour battery life. Weighs only 1.2 lbs.',
 25.00, 89.99,
 '/images/products/WEL-005.webp', '/mockups/templates/WEL-005.png',
 'Place the brand logo on the body of a compact massage gun and on the carrying case. Use brand colors for accent details. Show the massage gun with all 4 heads displayed beside it and the carrying case open. Clean, tech-forward aesthetic on a dark surface with dramatic lighting.',
 274,
 '{"materials": ["ABS Plastic Body", "Silicone Massage Heads", "Lithium Battery"], "features": ["4 Speed Settings", "4 Interchangeable Heads", "USB-C Charging", "6-Hour Battery", "Quiet Motor (<45dB)"], "weight": "1.2 lbs"}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('WEL-006', 'Foam Roller', 'wellness',
 'High-density EVA foam roller for muscle recovery and myofascial release. Textured surface for deep tissue massage. 18 inches long, 6 inches diameter.',
 7.00, 29.99,
 '/images/products/WEL-006.webp', '/mockups/templates/WEL-006.png',
 'Place the brand logo printed along the length of the foam roller. Use brand colors for the roller itself. Show the roller on a yoga mat or gym floor, possibly with someone''s foot resting on it. Include the textured grid pattern detail. Active recovery, fitness aesthetic.',
 275,
 '{"materials": ["High-Density EVA Foam", "PVC Core"], "dimensions": "18 x 6 inches (diameter)", "weight": "1.5 lbs", "features": ["Textured Grid Surface", "High-Density Core", "Lightweight & Portable"]}')

ON CONFLICT (sku) DO NOTHING;


-- ── Food & Beverage (5 products) ────────────────────────────────────────────

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('FNB-001', 'Branded Coffee Blend (12oz)', 'food_beverage',
 'Small-batch roasted coffee blend. Medium roast with notes of chocolate, caramel, and toasted nuts. Whole bean or ground. Sourced from single-origin farms.',
 6.00, 24.99,
 '/images/products/FNB-001.webp', '/mockups/templates/FNB-001.png',
 'Place the brand logo on a craft-style resealable coffee bag (12oz). Use brand colors with a premium, artisanal label design. Include "Coffee Blend" text and tasting notes. Show the bag with scattered coffee beans on a rustic wooden surface beside a filled coffee cup. Warm, artisan coffeehouse aesthetic.',
 280,
 '{"ingredients": ["100% Arabica Coffee Beans", "Single-Origin Blend"], "weight": "12 oz (340g)", "roast": "Medium", "tasting_notes": ["Chocolate", "Caramel", "Toasted Nuts"], "options": ["Whole Bean", "Ground"]}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('FNB-002', 'Herbal Tea Collection (20 bags)', 'food_beverage',
 'Curated collection of 20 herbal tea bags in 4 blends: chamomile lavender, peppermint, ginger lemon, and hibiscus berry. Individually wrapped for freshness.',
 3.00, 16.99,
 '/images/products/FNB-002.webp', '/mockups/templates/FNB-002.png',
 'Place the brand logo on an elegant tea box with a hinged lid (partially open showing tea bags inside). Use brand colors with botanical illustrations for each blend. Include "Herbal Tea Collection" text. Show the box with a steaming teacup and dried herbs nearby. Cozy, wellness-oriented aesthetic.',
 281,
 '{"ingredients": ["Chamomile", "Lavender", "Peppermint", "Ginger", "Lemon Peel", "Hibiscus", "Berry Blend"], "count": 20, "blends": ["Chamomile Lavender", "Peppermint", "Ginger Lemon", "Hibiscus Berry"], "caffeine_free": true}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('FNB-003', 'Protein Bar Box (12-pack)', 'food_beverage',
 'Box of 12 protein bars with 20g protein each. Double chocolate chip flavor. Gluten-free, no added sugar. Perfect for on-the-go nutrition.',
 10.00, 36.99,
 '/images/products/FNB-003.webp', '/mockups/templates/FNB-003.png',
 'Place the brand logo on both the box and individual bar wrapper. Show a display box with one bar unwrapped in front, revealing the chocolate texture. Use brand colors with bold "20g Protein" callout. Gym bag or kitchen counter setting. Energetic, snackable aesthetic.',
 282,
 '{"ingredients": ["Whey Protein Isolate", "Dark Chocolate Chips", "Almonds", "Chicory Root Fiber", "Coconut Oil", "Sea Salt"], "count": 12, "protein_per_bar": "20g", "dietary": ["Gluten-Free", "No Added Sugar"]}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('FNB-004', 'Electrolyte Drink Mix (30 servings)', 'food_beverage',
 'Zero-sugar electrolyte drink mix with sodium, potassium, and magnesium. Tropical mango flavor. Individual stick packs for convenience.',
 5.00, 28.99,
 '/images/products/FNB-004.webp', '/mockups/templates/FNB-004.png',
 'Place the brand logo on a box of stick packs with a few individual packets fanned out in front. Use bright, tropical brand colors with mango/tropical fruit imagery. Include "Electrolyte Mix" and "Zero Sugar" callouts. Show with a glass of yellow-tinted water. Active, hydration-focused aesthetic.',
 283,
 '{"ingredients": ["Sodium Citrate (1000mg)", "Potassium Citrate (200mg)", "Magnesium Citrate (60mg)", "Vitamin C", "Natural Mango Flavor", "Stevia"], "count": 30, "form": "stick packs", "dietary": ["Zero Sugar", "Keto-Friendly", "Vegan"]}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('FNB-005', 'Honey Jar (Raw, 16oz)', 'food_beverage',
 'Raw, unfiltered wildflower honey sourced from local apiaries. Rich in enzymes and antioxidants. Glass jar with wooden dipper included.',
 4.00, 22.99,
 '/images/products/FNB-005.webp', '/mockups/templates/FNB-005.png',
 'Place the brand logo on a hexagonal or classic mason-style glass honey jar with a cloth top and twine. Use warm, golden brand colors with a rustic label. Include "Raw Honey" text and a honeycomb illustration. Show the jar with a wooden honey dipper dripping honey. Farmhouse, artisanal aesthetic with warm lighting.',
 284,
 '{"ingredients": ["100% Raw Wildflower Honey"], "weight": "16 oz (454g)", "features": ["Unfiltered", "Unpasteurized", "Wooden Dipper Included"], "source": "Local Apiaries"}')

ON CONFLICT (sku) DO NOTHING;


-- ── Journals & Books (5 products) ───────────────────────────────────────────

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('JNL-001', 'Branded Journal (Hardcover)', 'journals',
 'Premium hardcover journal with 200 lined pages, ribbon bookmark, and elastic closure. Lay-flat binding for comfortable writing. Acid-free paper.',
 4.00, 24.99,
 '/images/products/JNL-001.webp', '/mockups/templates/JNL-001.png',
 'Place the brand logo debossed or foil-stamped on the front cover of a hardcover journal. Use brand colors for the cover material (leather-look or linen). Show the journal closed at a slight angle with the ribbon bookmark visible, on a desk with a pen beside it. Premium stationery aesthetic with warm, natural lighting.',
 290,
 '{"materials": ["Hardcover (Faux Leather or Linen)", "Acid-Free Paper", "Satin Ribbon Bookmark", "Elastic Closure"], "pages": 200, "dimensions": "5.5 x 8.25 inches (A5)", "ruling": "Lined"}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('JNL-002', 'Workout Log Book', 'journals',
 'Structured workout log with sections for exercises, sets, reps, weights, and personal records. 120 workout entries with progress tracking pages. Spiral-bound for gym use.',
 3.00, 18.99,
 '/images/products/JNL-002.webp', '/mockups/templates/JNL-002.png',
 'Place the brand logo on the front cover of a spiral-bound workout log book. Use bold, athletic brand colors. Include "Workout Log" text. Show the book open to a sample page with workout entries, a pen, and a dumbbell in the background. Gym or home workout setting. Motivational fitness aesthetic.',
 291,
 '{"materials": ["Cardstock Cover", "70lb Paper", "Metal Spiral Binding"], "pages": 120, "dimensions": "6 x 9 inches", "features": ["Exercise Tracking", "Set/Rep/Weight Logging", "Personal Records Page", "Progress Charts"]}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('JNL-003', 'Meal Planner', 'journals',
 'Weekly meal planner with grocery lists, macronutrient tracking, and recipe note sections. 52 weeks of planning pages. Perforated grocery lists for easy tear-out.',
 3.00, 16.99,
 '/images/products/JNL-003.webp', '/mockups/templates/JNL-003.png',
 'Place the brand logo on the front cover of a softcover meal planner. Use fresh, food-inspired brand colors (greens, warm tones). Include "Meal Planner" text. Show the planner open to a weekly spread with colorful meal entries, beside fresh vegetables and a cutting board. Kitchen lifestyle aesthetic.',
 292,
 '{"materials": ["Softcover (Matte Laminate)", "70lb Paper", "Perfect Binding", "Perforated Grocery Lists"], "pages": 112, "dimensions": "7 x 10 inches", "features": ["52 Weekly Spreads", "Grocery Lists", "Macronutrient Tracking", "Recipe Notes"]}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('JNL-004', 'Gratitude Journal', 'journals',
 'Daily gratitude journal with morning and evening prompts. Includes weekly reflection pages and inspirational quotes. 90-day guided format for building a gratitude habit.',
 3.00, 19.99,
 '/images/products/JNL-004.webp', '/mockups/templates/JNL-004.png',
 'Place the brand logo on the front cover of a softcover gratitude journal with a calming, mindful design. Use soft, serene brand colors (pastels, earth tones). Include "Gratitude Journal" in handwritten-style typography. Show the journal with a cup of tea, candle, and cozy blanket. Peaceful morning routine aesthetic.',
 293,
 '{"materials": ["Softcover (Matte Laminate)", "Cream 70lb Paper", "Perfect Binding"], "pages": 96, "dimensions": "5.5 x 8.25 inches (A5)", "features": ["90-Day Guided Format", "Morning & Evening Prompts", "Weekly Reflections", "Inspirational Quotes"]}')

ON CONFLICT (sku) DO NOTHING;

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order, metadata) VALUES

('JNL-005', 'Recipe Book (Blank)', 'journals',
 'Blank recipe book with structured pages for ingredients, instructions, cook time, and ratings. Tabbed sections for appetizers, mains, desserts, and drinks. 80 recipe pages.',
 4.00, 22.99,
 '/images/products/JNL-005.webp', '/mockups/templates/JNL-005.png',
 'Place the brand logo on the front cover of a hardcover recipe book with a kitchen-inspired design. Use warm brand colors with a subtle food pattern background. Include "Recipe Book" text. Show the book open to a blank recipe page with a handwritten recipe, beside mixing bowls and wooden spoons. Cozy, homemade cooking aesthetic.',
 294,
 '{"materials": ["Hardcover (Wipeable Surface)", "Heavy 80lb Paper", "Tabbed Dividers", "Lay-Flat Binding"], "pages": 80, "dimensions": "7 x 10 inches", "features": ["Structured Recipe Pages", "Tabbed Sections (Appetizers, Mains, Desserts, Drinks)", "Rating System", "Cook Time Tracking", "Wipeable Cover"]}')

ON CONFLICT (sku) DO NOTHING;


-- ── Summary ─────────────────────────────────────────────────────────────────
-- Added 30 new products across 5 new categories:
--   Supplements & Nutrition:  8 products (SUP-001 through SUP-008)
--   Skincare & Beauty:        6 products (SKN-001 through SKN-006)
--   Wellness & Fitness:       6 products (WEL-001 through WEL-006)
--   Food & Beverage:          5 products (FNB-001 through FNB-005)
--   Journals & Books:         5 products (JNL-001 through JNL-005)
-- Total catalog: 24 existing + 30 new = 54 products
-- =============================================================================
