# Selfnamed Product Scrape Summary

**Date:** 2026-02-24
**Account:** Ryan McFarland (ryanthementor@gmail.com)
**Status:** COMPLETE

---

## Quick Links to Output Files

| File | Description | Size |
|------|-------------|------|
| `docs/selfnamed_complete_catalog.json` | **Master file** - all products with financials, ingredients, images, bundles | Full dataset |
| `docs/selfnamed_product_catalog.csv` | Spreadsheet-friendly product list (importable to Google Sheets/Excel) | 25 rows |
| `docs/selfnamed_bundles.csv` | Bundle summary (importable) | 6 rows |
| `docs/scraped_products.json` | Raw scraped product data from selfnamed.com | 25 products |
| `docs/selfnamed_product_images/` | 135 high-res generic product images (1200px) | 26.9 MB |
| `docs/selfnamed_mockups/` | Branded mockup images from Design Studio | 18 files |

---

## 25 Products with 25%+ BMN Margin (Green in Spreadsheet)

| # | Product Name | Category | COGS | MSRP | BMN Net % | Group |
|---|---|---|---|---|---|---|
| 1 | Gentle Cleansing Milk | Cleanser | $17.96 | $20 | 27.7% | Face Care |
| 2 | Purifying Mousse | Cleanser | $17.44 | $18 | 25.3% | Face Care |
| 3 | AHA Peeling Concentrate (10% Lactic Acid + 1% HA) | Peel/Exfoliator | $18.81 | $24 | 27.8% | Face Care |
| 4 | Hydrating Toner | Toner | $16.40 | $16 | 25.6% | Face Care |
| 5 | Purifying Toner | Toner | $16.40 | $16 | 25.6% | Face Care |
| 6 | Moisturising Day Cream | Moisturizer | $20.37 | $26 | 25.4% | Face Care |
| 7 | Anti-Age Day Cream | Moisturizer | $20.78 | $32 | **33.4%** | Face Care |
| 8 | Ceramide Hydrating Night Cream | Moisturizer | $21.41 | $30 | 28.5% | Face Care |
| 9 | Collagen Anti-Age Night Cream | Moisturizer | $21.41 | $30 | 28.5% | Face Care |
| 10 | Niacinamide Gel Moisturiser | Moisturizer | $18.29 | $24 | 29.9% | Face Care |
| 11 | Retinol Alternative Moisturiser | Moisturizer | $18.29 | $24 | 29.9% | Face Care |
| 12 | Double Hydration Boost Gel | Moisturizer | $17.77 | $22 | 28.2% | Face Care |
| 13 | Natural Retinol-Alternative Oil Serum (Bakuchiol) | Serum | $20.89 | $32 | **33.1%** | Face Care |
| 14 | Pigment Perfecting Serum (Alpha-Arbutin) | Serum | $19.85 | $26 | 27.4% | Face Care |
| 15 | Peptide Serum (Hexapeptide-11) | Serum | $19.85 | $28 | 30.8% | Face Care |
| 16 | Collagen Boost Serum / Youthful Glow Serum | Serum | $20.89 | $28 | 27.1% | Face Care |
| 17 | Vitamin C Serum (2% Natural Vit C + 1% Ferulic Acid) | Serum | $19.85 | $26 | 27.4% | Face Care |
| 18 | Retinol Alternative Serum | Serum | $19.85 | $28 | 30.8% | Face Care |
| 19 | Prebiotics Jelly Serum (Lactobacillus + HA) | Serum | $17.77 | $22 | 28.2% | Face Care |
| 20 | Smoothing Eye Cream | Eye Cream | $17.35 | $22 | 30.1% | Face Care |
| 21 | Brightening Eye Cream | Eye Cream | $17.35 | $22 | 30.1% | Face Care |
| 22 | Retinol Alternative Eye Serum | Eye Cream | $18.81 | $24 | 27.8% | Face Care |
| 23 | All-in-One Facial Oil (11 Organic Oils) | Facial Oil | $19.74 | $26 | 27.8% | Face Care |
| 24 | Nourishing Facial Oil 30ml | Facial Oil | $19.74 | $26 | 27.8% | Face Care |
| 25 | Rosemary Scalp & Hair Oil | Scalp & Hair Oil | $15.69 | $22 | **37.6%** | Hair Care |

**Top 3 Margin Products:**
1. Rosemary Scalp & Hair Oil: 37.6%
2. Anti-Age Day Cream: 33.4%
3. Natural Retinol-Alternative Oil Serum: 33.1%

**Average Margin:** 28.9%
**Total MSRP (all 25 products):** $612
**Total COGS (all 25 products):** $476.72

---

## 6 Influencer Bundles (from Bundles Guide)

### Bundle 1: Anti-Aging Powerhouse (Blended Margin: 31.4%)
- Step 1 (Cleanse): Gentle Cleansing Milk - $20 MSRP
- Step 2 (Treat): Natural Retinol-Alternative Oil Serum (Bakuchiol) - $32 MSRP
- Step 3 (Moisturize): Anti-Age Day Cream - $32 MSRP

### Bundle 2: Brightening Glow Kit (Blended Margin: 28.4%)
- Step 1 (Exfoliate): AHA Peeling Concentrate - $24 MSRP
- Step 2 (Brighten): Vitamin C Serum - $26 MSRP
- Step 3 (Even Tone): Niacinamide Gel Moisturiser - $24 MSRP

### Bundle 3: Deep Hydration Ritual (Blended Margin: 27.4%)
- Step 1 (Tone): Hydrating Toner - $16 MSRP
- Step 2 (Layer): Double Hydration Boost Gel - $22 MSRP
- Step 3 (Lock In): Ceramide Hydrating Night Cream - $30 MSRP

### Bundle 4: Firm & Lifted (Blended Margin: 28.7%)
- Step 1 (Cleanse): Purifying Mousse - $18 MSRP
- Step 2 (Firm): Peptide Serum - $28 MSRP
- Step 3 (Eyes): Smoothing Eye Cream - $22 MSRP

### Bundle 5: Clear Skin Reset
- Step 1 (Purify): Purifying Toner - $16 MSRP
- Step 2 (Treat): Prebiotics Jelly Serum - $22 MSRP
- Step 3 (Protect): Retinol Alternative Moisturiser - $24 MSRP

### Bundle 6: Scalp Health & Hair Growth
- Step 1 (Exfoliate): Purifying Scalp Scrub - $24 MSRP
- Step 2 (Nourish): Rosemary Scalp & Hair Oil - $22 MSRP
- Step 3 (Mist): Keratin Hair Mist - $18 MSRP

---

## Design Studio Findings

**Account:** Logged in as Ryan McFarland

### Products with Branded Mockups (from Design Studio)

Only **2 of the 25 green products** have branded designs in the Design Studio:

| Product | Has Mockup | Design Date | Studio URL |
|---|---|---|---|
| Gentle Cleansing Milk | Yes | 24.02.2026 | /en/studio/gentle-cleansing-milk/688035 |
| Retinol Alternative Moisturiser | Yes (x2) | 23.02.2026 + 04.02.2026 | /en/studio/retinol-alternative-moisturiser/686259 |

### Other Products in Account (NOT in 25 green products)
- Moisturising Shampoo (x4) - MOCKUP NOT GENERATED
- Sensitive Skin Overnight Cream - has mockup
- Sun Protection SPF50 Stick - has mockup (NOT AVAILABLE in US)
- Gentle Baby Shampoo - has mockup
- Baby Body Wash (x5) - has mockups
- Baby Foaming Wash - has mockup

### Key Finding
**23 of the 25 green products still need branded designs created in the Design Studio.** The account currently only has designs for 2 target products.

---

## Downloaded Files Inventory

### High-Res Generic Product Images (135 files, 26.9 MB)
Saved to: `docs/selfnamed_product_images/` (organized by product subdirectory)

Each product has 4-7 high-resolution (1200px wide) images including:
- Product bottle/packaging photos (white background)
- Lifestyle/texture shots
- Ingredient detail images
- Mockup/scene compositions

### Branded Mockup Images (from Design Studio)
Saved to: `docs/selfnamed_mockups/`

- `gentle_cleansing_milk_mockup.jpg` - Branded mockup (pump bottle, bathroom scene)
- `gentle_cleansing_milk_mockup_v2.jpg` - Updated mockup
- `gentle_cleansing_milk_preview.png` - Studio preview screenshot
- `gentle_cleansing_milk_studio.png` - Studio editor screenshot
- `retinol_alt_moisturiser_mockup_1.jpg` - Branded mockup (bottle + box, green leaf design)
- `retinol_alt_moisturiser_mockup_2.jpg` - Alternate version
- `retinol_alt_moisturiser_preview.png` - Studio preview screenshot
- `retinol_alt_moisturiser_studio.png` - Studio editor screenshot

### Other Product Mockups (not in 25 green products)
- `baby_body_wash_mockup_1.jpg` through `_5.jpg`
- `baby_foaming_wash_mockup.jpg`
- `gentle_baby_shampoo_mockup.jpg`
- `sensitive_skin_overnight_cream_mockup.jpg`
- `spf50_stick_tint_mockup.jpg`

### Full Page Screenshot
- `selfnamed_my_products_page.png` - Full My Products page

---

## Product Data (from public catalog scraping)

**Master file:** `docs/selfnamed_complete_catalog.json`

Contains for each of the 25 products:
- Product name, slug, description, URL
- Financial data: COGS, MSRP, gross profit, BMN net margin %, category, group
- Full INCI ingredient list + key ingredients
- Certifications (COSMOS Natural, COSMOS Organic, etc.)
- Usage instructions and ideal skin type
- Local image file paths (generic + branded)
- Bundle membership
- Source image URLs from selfnamed.com CDN

---

## Google Drive Templates (Selfnamed Product Templates)

**Status:** DOWNLOADED (14 of 25 products matched)
**Link:** https://drive.google.com/drive/folders/1oi_7eeRXZUu_kzWvFXc4-aPMyRexGB4v?usp=sharing
**Local:** `docs/selfnamed_gdrive_templates/`
**Total:** 74 files, 69.4 MB across 14 product folders

### What's Included Per Product
Each folder typically contains:
- **Label Template (.ai)** - Adobe Illustrator label layout
- **Box Template (.ai)** - Adobe Illustrator box/packaging layout
- **Manual-LABEL (.pdf)** - PDF guide for label dimensions and placement
- **Manual-BOX (.pdf)** - PDF guide for box dimensions and placement
- **INFO (.pdf)** - Product info sheet with ingredients and specifications
- **Assets (SVGs)** - Certification icons (Vegan, Gluten Free, Nut Free, COSMOS, etc.)

### Products with Templates (14 matched)
| Product | Files | Key Templates |
|---|---|---|
| Gentle Cleansing Milk | 7 | Label .ai, Manual PDF, INFO PDF, 4 SVG icons |
| AHA Peeling Concentrate | 9 | Label .ai, Box .ai, Manual PDFs, INFO PDF, 4 SVGs |
| Hydrating Toner | 7 | Label .ai, Manual PDF, INFO PDF, 4 SVGs |
| Anti-Age Day Cream 15ml | 8 | Label .ai, Box .ai, Manual PDF, INFO PDF, 4 SVGs |
| Anti-Age Day Cream 50ml | 9 | Label .ai, Box .ai, Manual PDFs, INFO PDF, 4 SVGs |
| Collagen Boost Serum | 4 | Label .ai, Box .ai, Manual PDF, INFO PDF |
| Pigment Perfecting Serum | 4 | Label .ai, Box .ai, Manual PDF |
| Prebiotics Jelly Serum | 1 | INFO PDF |
| Double Hydration Boost Gel | 5 | Label .ai, Box .ai, Manual PDFs, INFO PDF |
| Brightening Eye Cream | 5 | Label .ai, Box .ai, Manual PDFs, INFO PDF |
| All-In-One Facial Oil | 5 | Label .ai, Box .ai, Manual PDFs, INFO PDF |
| Nourishing Facial Oil 15ml | 5 | Label .ai, Box .ai, Manual PDFs, INFO PDF |
| Nourishing Facial Oil 30ml | 4 | Label .ai, Box .ai, Manual PDF, INFO PDF |
| Ceramide Night Cream | 1 | INFO PDF |

### Products WITHOUT Templates in Google Drive (11)
- Purifying Mousse
- Purifying Toner
- Moisturising Day Cream
- Collagen Anti-Age Night Cream
- Niacinamide Gel Moisturiser
- Retinol Alternative Moisturiser
- Natural Retinol Alternative Oil Serum
- Peptide Anti-Aging Serum
- Vitamin C Serum
- Retinol Alternative Serum
- Smoothing Eye Cream
- Retinol Alternative Eye Serum
- Rosemary Hair & Scalp Strengthening Oil
