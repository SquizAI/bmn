-- =============================================================================
-- 20260220000024_seed_packaging_templates.sql
-- Seed 7 packaging templates with branding zones, print specs, and
-- AI prompt templates for mockup generation.
-- =============================================================================

-- ── 1. Supplement Bottle 60ct ─────────────────────────────────────────────────

INSERT INTO public.packaging_templates (
  slug, name, category, description,
  template_image_url, template_width_px, template_height_px,
  branding_zones, print_specs, ai_prompt_template,
  is_active, sort_order
) VALUES (
  'supplement-bottle-60ct',
  'Supplement Bottle (60ct)',
  'supplements',
  'Standard white supplement bottle for capsules and tablets. 60-count size with child-resistant cap. Most popular format for daily health supplements.',
  '/images/templates/supplement-bottle-60ct.png',
  1024, 1024,
  '[
    {
      "id": "front-logo",
      "label": "Front Logo",
      "type": "logo",
      "position": { "x": 50, "y": 28, "width": 35, "height": 18 },
      "constraints": { "min_dpi": 300, "format": ["png", "svg"], "background": "transparent" },
      "style": { "z_index": 2 }
    },
    {
      "id": "brand-name",
      "label": "Brand Name",
      "type": "text",
      "position": { "x": 50, "y": 48, "width": 55, "height": 7 },
      "constraints": { "max_chars": 30, "font_weight": "bold" },
      "style": { "z_index": 2, "text_align": "center", "color": "auto" }
    },
    {
      "id": "product-name",
      "label": "Product Name",
      "type": "text",
      "position": { "x": 50, "y": 57, "width": 55, "height": 6 },
      "constraints": { "max_chars": 40 },
      "style": { "z_index": 2, "text_align": "center", "font_size": "medium" }
    },
    {
      "id": "label-bg",
      "label": "Label Background",
      "type": "color_fill",
      "position": { "x": 50, "y": 45, "width": 75, "height": 65 },
      "constraints": {},
      "style": { "z_index": -1, "opacity": 0.95, "border_radius": 4 }
    },
    {
      "id": "cap-color",
      "label": "Cap Color",
      "type": "color_fill",
      "position": { "x": 50, "y": 5, "width": 28, "height": 10 },
      "constraints": {},
      "style": { "z_index": 1 }
    }
  ]'::jsonb,
  '{
    "dpi": 300,
    "bleed_mm": 3,
    "safe_area_mm": 5,
    "color_space": "CMYK",
    "print_width_mm": 76,
    "print_height_mm": 152,
    "label_shape": "rectangle",
    "dieline_url": null,
    "file_formats": ["pdf", "png"]
  }'::jsonb,
  'Professional product photo of a {{productName}} in a white supplement bottle. The bottle has a {{primaryColor}}-tinted label with the brand logo ''{{brandName}}'' prominently displayed. {{secondaryColor}} accents on the cap and label borders. Clean studio photography, white background, 3/4 angle view. Premium health supplement packaging. 60-count capsule bottle with child-resistant cap.',
  TRUE, 10
)
ON CONFLICT (slug) DO NOTHING;


-- ── 2. Supplement Bottle 30ct ─────────────────────────────────────────────────

INSERT INTO public.packaging_templates (
  slug, name, category, description,
  template_image_url, template_width_px, template_height_px,
  branding_zones, print_specs, ai_prompt_template,
  is_active, sort_order
) VALUES (
  'supplement-bottle-30ct',
  'Supplement Bottle (30ct)',
  'supplements',
  'Smaller white supplement bottle for capsules and tablets. 30-count size with child-resistant cap. Ideal for probiotics, specialty blends, and trial sizes.',
  '/images/templates/supplement-bottle-30ct.png',
  1024, 1024,
  '[
    {
      "id": "front-logo",
      "label": "Front Logo",
      "type": "logo",
      "position": { "x": 50, "y": 30, "width": 32, "height": 16 },
      "constraints": { "min_dpi": 300, "format": ["png", "svg"], "background": "transparent" },
      "style": { "z_index": 2 }
    },
    {
      "id": "brand-name",
      "label": "Brand Name",
      "type": "text",
      "position": { "x": 50, "y": 48, "width": 50, "height": 7 },
      "constraints": { "max_chars": 30, "font_weight": "bold" },
      "style": { "z_index": 2, "text_align": "center", "color": "auto" }
    },
    {
      "id": "product-name",
      "label": "Product Name",
      "type": "text",
      "position": { "x": 50, "y": 57, "width": 50, "height": 6 },
      "constraints": { "max_chars": 40 },
      "style": { "z_index": 2, "text_align": "center", "font_size": "medium" }
    },
    {
      "id": "label-bg",
      "label": "Label Background",
      "type": "color_fill",
      "position": { "x": 50, "y": 45, "width": 70, "height": 60 },
      "constraints": {},
      "style": { "z_index": -1, "opacity": 0.95, "border_radius": 4 }
    },
    {
      "id": "cap-color",
      "label": "Cap Color",
      "type": "color_fill",
      "position": { "x": 50, "y": 6, "width": 26, "height": 10 },
      "constraints": {},
      "style": { "z_index": 1 }
    }
  ]'::jsonb,
  '{
    "dpi": 300,
    "bleed_mm": 3,
    "safe_area_mm": 5,
    "color_space": "CMYK",
    "print_width_mm": 65,
    "print_height_mm": 127,
    "label_shape": "rectangle",
    "dieline_url": null,
    "file_formats": ["pdf", "png"]
  }'::jsonb,
  'Professional product photo of a {{productName}} in a compact white supplement bottle. The bottle has a {{primaryColor}}-tinted label with the brand logo ''{{brandName}}'' prominently displayed. {{secondaryColor}} accents on the cap and label borders. Clean studio photography, white background, 3/4 angle view. Premium health supplement packaging. 30-count capsule bottle with child-resistant cap.',
  TRUE, 20
)
ON CONFLICT (slug) DO NOTHING;


-- ── 3. Supplement Tub (Powder) ────────────────────────────────────────────────

INSERT INTO public.packaging_templates (
  slug, name, category, description,
  template_image_url, template_width_px, template_height_px,
  branding_zones, print_specs, ai_prompt_template,
  is_active, sort_order
) VALUES (
  'supplement-tub-powder',
  'Supplement Tub (Powder)',
  'supplements',
  'Cylindrical powder tub for protein, creatine, greens, and other powder supplements. Wide-mouth lid with scoop included. 30-serving size.',
  '/images/templates/supplement-tub-powder.png',
  1024, 1024,
  '[
    {
      "id": "front-logo",
      "label": "Front Logo",
      "type": "logo",
      "position": { "x": 50, "y": 25, "width": 40, "height": 15 },
      "constraints": { "min_dpi": 300, "format": ["png", "svg"], "background": "transparent" },
      "style": { "z_index": 2 }
    },
    {
      "id": "brand-name",
      "label": "Brand Name",
      "type": "text",
      "position": { "x": 50, "y": 42, "width": 60, "height": 6 },
      "constraints": { "max_chars": 30, "font_weight": "bold" },
      "style": { "z_index": 2, "text_align": "center", "color": "auto" }
    },
    {
      "id": "product-name",
      "label": "Product Name",
      "type": "text",
      "position": { "x": 50, "y": 50, "width": 60, "height": 5 },
      "constraints": { "max_chars": 40 },
      "style": { "z_index": 2, "text_align": "center", "font_size": "large" }
    },
    {
      "id": "serving-info",
      "label": "Serving Info",
      "type": "text",
      "position": { "x": 50, "y": 58, "width": 50, "height": 4 },
      "constraints": { "max_chars": 50 },
      "style": { "z_index": 2, "text_align": "center", "font_size": "small" }
    },
    {
      "id": "label-bg",
      "label": "Label Background",
      "type": "color_fill",
      "position": { "x": 50, "y": 45, "width": 80, "height": 70 },
      "constraints": {},
      "style": { "z_index": -1, "opacity": 0.95 }
    },
    {
      "id": "lid-color",
      "label": "Lid Color",
      "type": "color_fill",
      "position": { "x": 50, "y": 5, "width": 45, "height": 10 },
      "constraints": {},
      "style": { "z_index": 1 }
    }
  ]'::jsonb,
  '{
    "dpi": 300,
    "bleed_mm": 3,
    "safe_area_mm": 5,
    "color_space": "CMYK",
    "print_width_mm": 127,
    "print_height_mm": 178,
    "label_shape": "rectangle",
    "dieline_url": null,
    "file_formats": ["pdf", "png"]
  }'::jsonb,
  'Professional product photo of a {{productName}} in a large cylindrical powder tub. The tub has a bold {{primaryColor}}-colored wrap-around label with the brand logo ''{{brandName}}'' and product name prominently displayed. {{secondaryColor}} accents on the lid and label highlights. Show a scoop of powder beside the tub. Clean studio photography, white background, 3/4 angle view. Premium sports nutrition aesthetic. 30 servings.',
  TRUE, 30
)
ON CONFLICT (slug) DO NOTHING;


-- ── 4. Supplement Pouch (Resealable) ──────────────────────────────────────────

INSERT INTO public.packaging_templates (
  slug, name, category, description,
  template_image_url, template_width_px, template_height_px,
  branding_zones, print_specs, ai_prompt_template,
  is_active, sort_order
) VALUES (
  'supplement-pouch',
  'Supplement Pouch (Resealable)',
  'supplements',
  'Resealable stand-up pouch for powder supplements, snack mixes, and granola. Matte finish with tear notch and zip-lock seal. Clear window option available.',
  '/images/templates/supplement-pouch.png',
  1024, 1024,
  '[
    {
      "id": "front-logo",
      "label": "Front Logo",
      "type": "logo",
      "position": { "x": 50, "y": 22, "width": 38, "height": 16 },
      "constraints": { "min_dpi": 300, "format": ["png", "svg"], "background": "transparent" },
      "style": { "z_index": 2 }
    },
    {
      "id": "brand-name",
      "label": "Brand Name",
      "type": "text",
      "position": { "x": 50, "y": 40, "width": 55, "height": 6 },
      "constraints": { "max_chars": 30, "font_weight": "bold" },
      "style": { "z_index": 2, "text_align": "center", "color": "auto" }
    },
    {
      "id": "product-name",
      "label": "Product Name",
      "type": "text",
      "position": { "x": 50, "y": 48, "width": 55, "height": 5 },
      "constraints": { "max_chars": 40 },
      "style": { "z_index": 2, "text_align": "center", "font_size": "large" }
    },
    {
      "id": "label-bg",
      "label": "Label Background",
      "type": "color_fill",
      "position": { "x": 50, "y": 40, "width": 85, "height": 55 },
      "constraints": {},
      "style": { "z_index": -1, "opacity": 0.95 }
    },
    {
      "id": "window-area",
      "label": "Window Area",
      "type": "pattern",
      "position": { "x": 50, "y": 72, "width": 50, "height": 20 },
      "constraints": { "pattern_type": "transparent_window" },
      "style": { "z_index": 0, "opacity": 0.3 }
    }
  ]'::jsonb,
  '{
    "dpi": 300,
    "bleed_mm": 3,
    "safe_area_mm": 5,
    "color_space": "CMYK",
    "print_width_mm": 152,
    "print_height_mm": 229,
    "label_shape": "custom",
    "dieline_url": null,
    "file_formats": ["pdf", "png"]
  }'::jsonb,
  'Professional product photo of a {{productName}} in a matte stand-up resealable pouch. The pouch has a {{primaryColor}}-colored design with the brand logo ''{{brandName}}'' prominently displayed on the front. {{secondaryColor}} accents on borders and text. Clear window near the bottom showing the product inside. Clean studio photography, white background, 3/4 angle view. Premium, modern supplement packaging.',
  TRUE, 40
)
ON CONFLICT (slug) DO NOTHING;


-- ── 5. Skincare Dropper Bottle ────────────────────────────────────────────────

INSERT INTO public.packaging_templates (
  slug, name, category, description,
  template_image_url, template_width_px, template_height_px,
  branding_zones, print_specs, ai_prompt_template,
  is_active, sort_order
) VALUES (
  'skincare-dropper',
  'Skincare Dropper Bottle (1oz)',
  'skincare',
  'Amber glass dropper bottle for serums, oils, and concentrated treatments. 1oz (30ml) capacity with gold or silver dropper cap. Luxury aesthetic.',
  '/images/templates/skincare-dropper.png',
  1024, 1024,
  '[
    {
      "id": "front-logo",
      "label": "Front Logo",
      "type": "logo",
      "position": { "x": 50, "y": 45, "width": 30, "height": 15 },
      "constraints": { "min_dpi": 300, "format": ["png", "svg"], "background": "transparent" },
      "style": { "z_index": 2 }
    },
    {
      "id": "brand-name",
      "label": "Brand Name",
      "type": "text",
      "position": { "x": 50, "y": 62, "width": 45, "height": 6 },
      "constraints": { "max_chars": 25, "font_weight": "bold" },
      "style": { "z_index": 2, "text_align": "center", "color": "auto", "font_style": "elegant" }
    },
    {
      "id": "product-name",
      "label": "Product Name",
      "type": "text",
      "position": { "x": 50, "y": 70, "width": 45, "height": 5 },
      "constraints": { "max_chars": 30 },
      "style": { "z_index": 2, "text_align": "center", "font_size": "small" }
    },
    {
      "id": "label-bg",
      "label": "Label Background",
      "type": "color_fill",
      "position": { "x": 50, "y": 58, "width": 55, "height": 40 },
      "constraints": {},
      "style": { "z_index": -1, "opacity": 0.9, "border_radius": 2 }
    }
  ]'::jsonb,
  '{
    "dpi": 300,
    "bleed_mm": 2,
    "safe_area_mm": 3,
    "color_space": "CMYK",
    "print_width_mm": 38,
    "print_height_mm": 51,
    "label_shape": "rectangle",
    "dieline_url": null,
    "file_formats": ["pdf", "png"]
  }'::jsonb,
  'Professional product photo of a {{productName}} in an amber glass dropper bottle. Minimalist {{primaryColor}}-tinted label with the brand logo ''{{brandName}}'' in elegant typography. Gold dropper cap with {{secondaryColor}} accents. A few golden drops on a marble surface. Soft, diffused studio lighting, white background. Luxury skincare aesthetic. 1oz serum bottle.',
  TRUE, 50
)
ON CONFLICT (slug) DO NOTHING;


-- ── 6. Skincare Jar ──────────────────────────────────────────────────────────

INSERT INTO public.packaging_templates (
  slug, name, category, description,
  template_image_url, template_width_px, template_height_px,
  branding_zones, print_specs, ai_prompt_template,
  is_active, sort_order
) VALUES (
  'skincare-jar',
  'Skincare Jar (Frosted Glass)',
  'skincare',
  'Frosted glass jar for moisturizers, masks, and body butters. 2oz (60ml) capacity with brushed metal lid. Premium spa aesthetic.',
  '/images/templates/skincare-jar.png',
  1024, 1024,
  '[
    {
      "id": "lid-logo",
      "label": "Lid Logo",
      "type": "logo",
      "position": { "x": 50, "y": 15, "width": 25, "height": 12 },
      "constraints": { "min_dpi": 300, "format": ["png", "svg"], "background": "transparent" },
      "style": { "z_index": 3, "placement": "lid_top" }
    },
    {
      "id": "front-logo",
      "label": "Front Logo",
      "type": "logo",
      "position": { "x": 50, "y": 50, "width": 28, "height": 14 },
      "constraints": { "min_dpi": 300, "format": ["png", "svg"], "background": "transparent" },
      "style": { "z_index": 2 }
    },
    {
      "id": "brand-name",
      "label": "Brand Name",
      "type": "text",
      "position": { "x": 50, "y": 66, "width": 45, "height": 6 },
      "constraints": { "max_chars": 25, "font_weight": "bold" },
      "style": { "z_index": 2, "text_align": "center", "color": "auto", "font_style": "elegant" }
    },
    {
      "id": "product-name",
      "label": "Product Name",
      "type": "text",
      "position": { "x": 50, "y": 74, "width": 45, "height": 5 },
      "constraints": { "max_chars": 30 },
      "style": { "z_index": 2, "text_align": "center", "font_size": "small" }
    },
    {
      "id": "jar-label-bg",
      "label": "Jar Label Background",
      "type": "color_fill",
      "position": { "x": 50, "y": 60, "width": 60, "height": 35 },
      "constraints": {},
      "style": { "z_index": -1, "opacity": 0.85, "border_radius": 6 }
    }
  ]'::jsonb,
  '{
    "dpi": 300,
    "bleed_mm": 2,
    "safe_area_mm": 3,
    "color_space": "CMYK",
    "print_width_mm": 51,
    "print_height_mm": 38,
    "label_shape": "oval",
    "dieline_url": null,
    "file_formats": ["pdf", "png"]
  }'::jsonb,
  'Professional product photo of a {{productName}} in a frosted glass jar with a brushed metal lid. The jar has a delicate {{primaryColor}}-tinted label with the brand logo ''{{brandName}}'' in refined typography. Brand logo also embossed on the lid top. {{secondaryColor}} accents. Jar shown slightly open with a swirl of cream visible. Soft studio lighting, white background. Premium spa skincare aesthetic. 2oz moisturizer jar.',
  TRUE, 60
)
ON CONFLICT (slug) DO NOTHING;


-- ── 7. Skincare Tube ─────────────────────────────────────────────────────────

INSERT INTO public.packaging_templates (
  slug, name, category, description,
  template_image_url, template_width_px, template_height_px,
  branding_zones, print_specs, ai_prompt_template,
  is_active, sort_order
) VALUES (
  'skincare-tube',
  'Skincare Tube (Squeeze)',
  'skincare',
  'Squeeze tube for sunscreen, cleanser, moisturizer, and body care. 3-5oz capacity with flip-top or screw cap. Clean, modern aesthetic.',
  '/images/templates/skincare-tube.png',
  1024, 1024,
  '[
    {
      "id": "front-logo",
      "label": "Front Logo",
      "type": "logo",
      "position": { "x": 50, "y": 30, "width": 32, "height": 14 },
      "constraints": { "min_dpi": 300, "format": ["png", "svg"], "background": "transparent" },
      "style": { "z_index": 2 }
    },
    {
      "id": "brand-name",
      "label": "Brand Name",
      "type": "text",
      "position": { "x": 50, "y": 46, "width": 50, "height": 6 },
      "constraints": { "max_chars": 25, "font_weight": "bold" },
      "style": { "z_index": 2, "text_align": "center", "color": "auto" }
    },
    {
      "id": "product-name",
      "label": "Product Name",
      "type": "text",
      "position": { "x": 50, "y": 54, "width": 50, "height": 5 },
      "constraints": { "max_chars": 35 },
      "style": { "z_index": 2, "text_align": "center", "font_size": "medium" }
    },
    {
      "id": "cap-color",
      "label": "Cap Color",
      "type": "color_fill",
      "position": { "x": 50, "y": 8, "width": 18, "height": 12 },
      "constraints": {},
      "style": { "z_index": 1 }
    },
    {
      "id": "tube-bg",
      "label": "Tube Background",
      "type": "color_fill",
      "position": { "x": 50, "y": 50, "width": 55, "height": 75 },
      "constraints": {},
      "style": { "z_index": -1, "opacity": 0.95 }
    }
  ]'::jsonb,
  '{
    "dpi": 300,
    "bleed_mm": 3,
    "safe_area_mm": 4,
    "color_space": "CMYK",
    "print_width_mm": 89,
    "print_height_mm": 127,
    "label_shape": "rectangle",
    "dieline_url": null,
    "file_formats": ["pdf", "png"]
  }'::jsonb,
  'Professional product photo of a {{productName}} in a sleek squeeze tube. The tube body is {{primaryColor}}-colored with the brand logo ''{{brandName}}'' and product name in clean typography. {{secondaryColor}} flip-top cap. Clean studio photography, white background, standing upright at a slight angle. Modern, clinical skincare aesthetic. Squeeze tube packaging.',
  TRUE, 70
)
ON CONFLICT (slug) DO NOTHING;


-- ── Summary ─────────────────────────────────────────────────────────────────
-- Seeded 7 packaging templates:
--   1. supplement-bottle-60ct  (supplements) - Standard 60ct capsule bottle
--   2. supplement-bottle-30ct  (supplements) - Smaller 30ct capsule bottle
--   3. supplement-tub-powder   (supplements) - Cylindrical powder tub
--   4. supplement-pouch        (supplements) - Resealable stand-up pouch
--   5. skincare-dropper        (skincare)    - Amber glass dropper bottle
--   6. skincare-jar            (skincare)    - Frosted glass jar
--   7. skincare-tube           (skincare)    - Squeeze tube
-- =============================================================================
