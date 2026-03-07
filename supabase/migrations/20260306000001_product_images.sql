-- =============================================================================
-- 20260306000001_product_images.sql
-- Update product catalog with real product images (Unsplash CDN).
-- Replaces placeholder paths like '/products/tshirt.jpg' with actual URLs.
-- =============================================================================

-- ── Apparel ──────────────────────────────────────────────────────────────────

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=600&fit=crop'
WHERE sku = 'APR-TSHIRT-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&h=600&fit=crop'
WHERE sku = 'APR-HOODIE-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1503341504253-dff4f94032fc?w=600&h=600&fit=crop'
WHERE sku = 'APR-TANK-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=600&h=600&fit=crop'
WHERE sku = 'APR-SWEAT-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1588850561407-ed78c334e67a?w=600&h=600&fit=crop'
WHERE sku = 'APR-HAT-001';

-- ── Accessories ──────────────────────────────────────────────────────────────

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1601593346740-925612772716?w=600&h=600&fit=crop'
WHERE sku = 'ACC-PHONE-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&h=600&fit=crop'
WHERE sku = 'ACC-TOTE-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&h=600&fit=crop'
WHERE sku = 'ACC-BOTTLE-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=600&fit=crop'
WHERE sku = 'ACC-STICKER-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&h=600&fit=crop'
WHERE sku = 'ACC-MUG-001';

-- ── Home Goods ───────────────────────────────────────────────────────────────

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=600&h=600&fit=crop'
WHERE sku = 'HOM-PILLOW-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&h=600&fit=crop'
WHERE sku = 'HOM-CANVAS-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=600&h=600&fit=crop'
WHERE sku = 'HOM-POSTER-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1602028915047-37269d1a73f7?w=600&h=600&fit=crop'
WHERE sku = 'HOM-BLANKET-001';

-- ── Packaging ────────────────────────────────────────────────────────────────

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=600&h=600&fit=crop'
WHERE sku = 'PKG-MAILER-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=600&h=600&fit=crop'
WHERE sku = 'PKG-BOX-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&h=600&fit=crop'
WHERE sku = 'PKG-TAPE-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&h=600&fit=crop'
WHERE sku = 'PKG-TISSUE-001';

-- ── Digital ──────────────────────────────────────────────────────────────────

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=600&h=600&fit=crop'
WHERE sku = 'DIG-BCARD-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600&h=600&fit=crop'
WHERE sku = 'DIG-SOCIAL-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&h=600&fit=crop'
WHERE sku = 'DIG-LHEAD-001';

-- ── Supplements ──────────────────────────────────────────────────────────────

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=600&h=600&fit=crop'
WHERE sku = 'SUP-WHEY-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1616671276441-2f2c277b8bf6?w=600&h=600&fit=crop'
WHERE sku = 'SUP-PRE-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=600&h=600&fit=crop'
WHERE sku = 'SUP-CREATINE-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1505576399279-0f00f0542f83?w=600&h=600&fit=crop'
WHERE sku = 'SUP-MULTI-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=600&h=600&fit=crop'
WHERE sku = 'SUP-OMEGA-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=600&h=600&fit=crop'
WHERE sku = 'SUP-COLLAGEN-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=600&h=600&fit=crop'
WHERE sku = 'SUP-BCAA-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1625677437069-7c3b3b5b7b0e?w=600&h=600&fit=crop'
WHERE sku = 'SUP-GREENS-001';

-- ── Skincare ─────────────────────────────────────────────────────────────────

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=600&fit=crop'
WHERE sku = 'SKN-SERUM-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=600&h=600&fit=crop'
WHERE sku = 'SKN-CREAM-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=600&h=600&fit=crop'
WHERE sku = 'SKN-CLEANSER-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?w=600&h=600&fit=crop'
WHERE sku = 'SKN-SUNSCREEN-001';

-- ── Wellness ─────────────────────────────────────────────────────────────────

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=600&h=600&fit=crop'
WHERE sku = 'WEL-DIFFUSER-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&h=600&fit=crop'
WHERE sku = 'WEL-ROLLER-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1596178060671-7a80dc8059ea?w=600&h=600&fit=crop'
WHERE sku = 'WEL-BATH-001';

-- ── Food & Beverage ──────────────────────────────────────────────────────────

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1563822249366-3efb23b8e0c9?w=600&h=600&fit=crop'
WHERE sku = 'FB-TEA-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&h=600&fit=crop'
WHERE sku = 'FB-BAR-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&h=600&fit=crop'
WHERE sku = 'FB-HONEY-001';

-- ── Journals ─────────────────────────────────────────────────────────────────

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=600&h=600&fit=crop'
WHERE sku = 'JRN-GRATITUDE-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=600&h=600&fit=crop'
WHERE sku = 'JRN-FITNESS-001';

-- ── Candles ──────────────────────────────────────────────────────────────────

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1602607688066-7d0e828f10e0?w=600&h=600&fit=crop'
WHERE sku = 'CND-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=600&h=600&fit=crop'
WHERE sku = 'CND-002';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1599751449128-eb7249c3d6b1?w=600&h=600&fit=crop'
WHERE sku = 'CND-003';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&h=600&fit=crop'
WHERE sku = 'CND-004';

-- ── Digital Downloads ────────────────────────────────────────────────────────

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&h=600&fit=crop'
WHERE sku = 'DDL-EBOOK-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=600&h=600&fit=crop'
WHERE sku = 'DDL-PRESET-001';

UPDATE public.products SET image_url = 'https://images.unsplash.com/photo-1542621334-a254cf47733d?w=600&h=600&fit=crop'
WHERE sku = 'DDL-TEMPLATE-001';

-- ── Catch-all: Any remaining products with placeholder paths ────────────────

UPDATE public.products
SET image_url = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop'
WHERE image_url IS NULL
   OR image_url LIKE '/products/%'
   OR image_url LIKE '/images/products/%'
   OR image_url LIKE '/mockups/%';
