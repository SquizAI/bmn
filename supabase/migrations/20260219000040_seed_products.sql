-- =============================================================================
-- 40_seed_products.sql — Product catalog seed data
-- =============================================================================

INSERT INTO public.products (sku, name, category, description, base_cost, retail_price, image_url, mockup_template_url, mockup_instructions, sort_order) VALUES

-- ── Apparel (5 products) ──────────────────────────────────────────────────
('APR-TSHIRT-001', 'Classic T-Shirt', 'apparel',
 'Unisex crew neck cotton t-shirt. Available in 20+ colors.',
 8.50, 29.99, '/products/tshirt.jpg', '/templates/tshirt.png',
 'Place the brand logo centered on the chest area of the t-shirt. Logo should be approximately 8 inches wide. Maintain the t-shirt''s fabric texture and natural folds. The logo should appear screen-printed, not digitally overlaid. Keep lighting consistent with the garment.',
 10),

('APR-HOODIE-001', 'Pullover Hoodie', 'apparel',
 'Heavyweight pullover hoodie with kangaroo pocket. Unisex fit.',
 18.00, 54.99, '/products/hoodie.jpg', '/templates/hoodie.png',
 'Place the brand logo centered on the chest of the hoodie, above the kangaroo pocket. Logo should be approximately 10 inches wide. Respect the hoodie''s fabric texture, drawstrings, and hood shadow. Screen-print aesthetic.',
 20),

('APR-TANK-001', 'Tank Top', 'apparel',
 'Lightweight racerback tank top. Ideal for athletic or casual branding.',
 6.00, 24.99, '/products/tank.jpg', '/templates/tank.png',
 'Place the brand logo centered on the chest of the tank top. Logo should be approximately 6 inches wide. Maintain the tank''s lightweight fabric texture. Logo should appear as a heat-transfer print.',
 30),

('APR-SWEAT-001', 'Crewneck Sweatshirt', 'apparel',
 'Midweight fleece crewneck sweatshirt. Unisex.',
 14.00, 44.99, '/products/sweatshirt.jpg', '/templates/sweatshirt.png',
 'Place the brand logo centered on the chest of the sweatshirt. Logo should be approximately 9 inches wide. Embroidered look preferred. Maintain fleece texture and natural garment folds.',
 40),

('APR-HAT-001', 'Snapback Hat', 'apparel',
 'Structured 6-panel snapback cap with flat brim.',
 5.50, 27.99, '/products/hat.jpg', '/templates/hat.png',
 'Place the brand logo centered on the front panel of the hat. Logo should be approximately 3.5 inches wide. Embroidered look. Maintain the hat''s structure, stitching, and brim curvature.',
 50),

-- ── Accessories (5 products) ──────────────────────────────────────────────
('ACC-PHONE-001', 'Phone Case', 'accessories',
 'Slim protective phone case. Compatible with iPhone and Samsung.',
 3.50, 19.99, '/products/phone-case.jpg', '/templates/phone-case.png',
 'Place the brand logo centered on the back of the phone case. Logo should cover approximately 60% of the case surface. The case should have a glossy finish. Show the phone case at a slight angle to show depth.',
 60),

('ACC-TOTE-001', 'Canvas Tote Bag', 'accessories',
 'Heavy-duty canvas tote bag with reinforced handles.',
 4.00, 22.99, '/products/tote.jpg', '/templates/tote.png',
 'Place the brand logo centered on one side of the tote bag. Logo should be approximately 8 inches wide. Screen-printed look on natural canvas. Show the bag slightly open with handles visible.',
 70),

('ACC-BOTTLE-001', 'Water Bottle', 'accessories',
 'Insulated stainless steel water bottle. 20oz capacity.',
 6.00, 24.99, '/products/bottle.jpg', '/templates/bottle.png',
 'Place the brand logo as a wrap-around design on the water bottle. Logo should be visible on the front-facing surface. Maintain the metallic/matte finish of the bottle. Show condensation for realism.',
 80),

('ACC-STICKER-001', 'Sticker Pack', 'accessories',
 'Set of 5 die-cut vinyl stickers in various sizes.',
 1.00, 9.99, '/products/stickers.jpg', '/templates/stickers.png',
 'Create a set of 5 die-cut stickers featuring the brand logo and brand colors. Vary the sizes (2-4 inches). Show them arranged on a flat surface as if freshly peeled. Include the logo as-is plus stylistic variations.',
 90),

('ACC-MUG-001', 'Ceramic Mug', 'accessories',
 '11oz white ceramic mug. Dishwasher and microwave safe.',
 3.50, 16.99, '/products/mug.jpg', '/templates/mug.png',
 'Place the brand logo on the front-facing side of the white ceramic mug. Logo should be approximately 3 inches wide. Show the mug with a slight angle, handle visible. The logo should appear as a sublimation print.',
 100),

-- ── Home Goods (4 products) ──────────────────────────────────────────────
('HOM-PILLOW-001', 'Throw Pillow', 'home_goods',
 '18x18 inch throw pillow with removable cover.',
 7.00, 29.99, '/products/pillow.jpg', '/templates/pillow.png',
 'Place the brand logo as the centerpiece design on the throw pillow. Use brand colors for the background. The logo should be approximately 10 inches wide. Show the pillow on a couch or styled setting. Fabric texture visible.',
 110),

('HOM-CANVAS-001', 'Canvas Print', 'home_goods',
 '16x20 inch gallery-wrapped canvas print.',
 9.00, 39.99, '/products/canvas.jpg', '/templates/canvas.png',
 'Create a canvas print featuring the brand logo as wall art. Use brand colors for a stylized background. Show the canvas hanging on a light-colored wall. Gallery wrap visible at edges. Slight shadow for depth.',
 120),

('HOM-BLANKET-001', 'Fleece Blanket', 'home_goods',
 '50x60 inch fleece throw blanket.',
 12.00, 44.99, '/products/blanket.jpg', '/templates/blanket.png',
 'Place the brand logo as a large centered design on the fleece blanket. Use brand colors. Logo should be approximately 20 inches wide. Show the blanket draped over furniture. Soft fleece texture visible.',
 130),

('HOM-POSTER-001', 'Poster Print', 'home_goods',
 '18x24 inch matte poster print.',
 4.00, 19.99, '/products/poster.jpg', '/templates/poster.png',
 'Create a poster design featuring the brand logo prominently. Include brand name, tagline, and color palette. Modern minimal design. Show the poster in a frame or hanging on a wall.',
 140),

-- ── Packaging (5 products) ────────────────────────────────────────────────
('PKG-BOX-001', 'Shipping Box', 'packaging',
 'Branded corrugated shipping box. 12x10x6 inches.',
 2.50, 8.99, '/products/box.jpg', '/templates/box.png',
 'Apply the brand logo and brand colors to a corrugated shipping box. Logo on top flap and one side. Include brand name. Show the box closed at a 3/4 angle. Professional product packaging aesthetic.',
 150),

('PKG-LABEL-001', 'Product Label', 'packaging',
 'Self-adhesive product label. 3x5 inches.',
 0.50, 2.99, '/products/label.jpg', '/templates/label.png',
 'Design a product label featuring the brand logo, brand name, and brand colors. 3x5 inch label. Include placeholder text for product details. Show the label applied to a generic product container.',
 160),

('PKG-BAG-001', 'Shopping Bag', 'packaging',
 'Branded paper shopping bag with rope handles.',
 1.50, 5.99, '/products/bag.jpg', '/templates/bag.png',
 'Apply the brand logo centered on the front of a paper shopping bag. Include brand name below the logo. Use brand colors for accents. Show the bag standing upright with rope handles visible. Luxury retail aesthetic.',
 170),

('PKG-TISSUE-001', 'Tissue Paper', 'packaging',
 'Custom printed tissue paper for gift wrapping.',
 0.75, 3.99, '/products/tissue.jpg', '/templates/tissue.png',
 'Create a repeating pattern of the brand logo on tissue paper. Logo should be small (1 inch) and repeated in a diagonal grid. Use one brand color on white paper. Show the tissue paper partially crumpled in a gift bag.',
 180),

('PKG-MAILER-001', 'Poly Mailer', 'packaging',
 'Branded poly mailer bag. 10x13 inches.',
 1.00, 4.99, '/products/mailer.jpg', '/templates/mailer.png',
 'Apply the brand logo and brand colors to a poly mailer bag. Logo centered on the front. Include brand name and website URL below. Show the mailer flat with a slight curl at edges.',
 190),

-- ── Digital (5 products) ──────────────────────────────────────────────────
('DIG-SOCIAL-001', 'Social Media Template Pack', 'digital',
 'Set of 10 branded social media post templates (Instagram, TikTok, Facebook).',
 0.00, 14.99, '/products/social-templates.jpg', '/templates/social-pack.png',
 'Create a social media post template using the brand logo, brand colors, and fonts. Instagram square format (1080x1080). Include areas for headline text and product image. Modern, clean design. Show 3-4 template variations.',
 200),

('DIG-BIZCARD-001', 'Business Card', 'digital',
 'Double-sided business card design. Standard 3.5x2 inches.',
 0.00, 9.99, '/products/business-card.jpg', '/templates/bizcard.png',
 'Design a double-sided business card using the brand logo, colors, and fonts. Front: logo centered. Back: placeholder for name, title, phone, email, website. Modern minimal design. Show front and back at slight angle.',
 210),

('DIG-EMAIL-001', 'Email Header', 'digital',
 'Branded email header/banner template. 600px wide.',
 0.00, 7.99, '/products/email-header.jpg', '/templates/email-header.png',
 'Create an email header banner (600x200px) featuring the brand logo and brand colors. Logo on the left, brand name on the right. Clean, professional design suitable for marketing emails.',
 220),

('DIG-WATERMARK-001', 'Photo Watermark', 'digital',
 'Transparent PNG watermark overlay for photos.',
 0.00, 4.99, '/products/watermark.jpg', '/templates/watermark.png',
 'Create a semi-transparent watermark version of the brand logo. White with 30% opacity. Show it overlaid on a sample photo. The watermark should be subtle but visible.',
 230),

('DIG-FAVICON-001', 'Favicon & App Icon', 'digital',
 'Favicon (16x16, 32x32) and app icon (512x512) from brand logo.',
 0.00, 4.99, '/products/favicon.jpg', '/templates/favicon.png',
 'Create a simplified favicon version of the brand logo. Must be recognizable at 16x16px. Show at multiple sizes: 16x16, 32x32, 180x180 (Apple touch), and 512x512 (Android). Clean, iconic design.',
 240);
