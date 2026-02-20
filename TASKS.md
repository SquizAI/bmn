# Brand Me Now v2 -- Master Task List

> **100 Suggestions to Demolish v1 -- Full Implementation Plan**
> Generated from codebase audit on 2026-02-19.
> Each phase must be completed before moving to the next.
> Tasks within a phase can run in parallel where noted.

---

## Current State Summary

| Layer | Status | Notes |
|-------|--------|-------|
| Server (149 files, 21K LOC) | Substantially built | Real controllers, services, workers |
| Client (100 files, 15K+ LOC) | Substantially built | Full wizard + dashboard + admin |
| Marketing (25 files) | Scaffolded | All content is placeholder/fake |
| Database (25 migrations) | Complete | Schema + RLS + seed data |
| Shared (5 schemas) | Partial | Client never imports from shared/ |
| Infrastructure | Partial | Docker + CI/CD exist, gaps remain |

**Scorecard: 36 implemented / 19 partial / 44 missing out of 99 items.**

---

## PHASE 0 -- Critical Infrastructure Fixes (Do First)

> These block everything else. Fix before any feature work.

### 0.1 Workspace & Config Fixes

- [ ] **FIX: Workspace mismatch** -- Root `package.json` registers `web` as workspace but real client is in `client/`. Either rename `client/` to `web/` or update workspace config. Remove the `web/` stub directory.
- [ ] **FIX: Port inconsistency** -- Root `.env` says `PORT=4847`, client `.env.example` says `VITE_API_BASE_URL=http://localhost:3001`, Vite config proxies to `localhost:3001`. Reconcile all ports to one consistent value.
- [ ] **FIX: Shared schemas not imported** -- Client never imports from `shared/`. Wire Zod schemas from `shared/schemas/` into client-side form validation and API response typing.
- [ ] **FIX: Missing shared schemas** -- Add `brand.js`, `user.js`, `wizard.js`, `payment.js` to `shared/schemas/` as specified in PRD.

### 0.2 Missing Client Dependencies

- [ ] **Install `@stripe/stripe-js` and `@stripe/react-stripe-js`** -- Stripe checkout is broken on the frontend without these.
- [ ] **Install `@sentry/react`** -- No client-side error tracking. Wire Sentry init in `main.tsx`.
- [ ] **Install `posthog-js`** -- No client-side analytics. Wire PostHog init in `main.tsx` using `VITE_POSTHOG_KEY`.
- [ ] **Install `react-dropzone`** -- Needed for image upload features (inspiration images, existing assets).
- [ ] **Install `react-colorful`** -- Needed for interactive color palette editing.
- [ ] **Install `dompurify`** -- Needed for HTML sanitization on user-generated content display.

### 0.3 Backend Wiring Gaps

- [ ] **FIX: Socket.io not passed to webhook controller** -- Multiple TODO comments in `webhooks.js` for emitting subscription/credit events. Pass `io` instance to webhook routes.
- [ ] **FIX: CRM sync calls commented out in auth controller** -- Uncomment `dispatchJob('crm-sync', ...)` in signup/login flows (lines 57-58, 279-280).
- [ ] **FIX: GHL env var mismatch** -- `.env.example` uses static `HIGHLEVEL_ACCESS_TOKEN` but code expects OAuth 2.0 (`GHL_CLIENT_ID`, `GHL_CLIENT_SECRET`, `GHL_REDIRECT_URI`). Align env with code.
- [ ] **FIX: Missing email templates** -- Add `subscription-confirmed`, `subscription-cancelled`, `generation-failed` templates to `server/src/emails/` (referenced in webhooks but don't exist).
- [ ] **FIX: YouTube/X in service layer** -- `apify.js` only has IG/TikTok/Facebook. Add YouTube and X/Twitter handlers to match skill tools layer.
- [ ] **FIX: Stripe Price IDs** -- Replace `price_REPLACE_*` placeholders in seed data with real Stripe Price IDs or env-driven config.
- [ ] **FIX: Remove Fal.ai prototyping leftover** -- Clean up `FAL_KEY` and `FAL_MODEL` from `.env.example`. Production uses direct BFL API.

### 0.4 Robots & SEO Fix

- [ ] **FIX: Remove `noindex, nofollow`** -- v1 site has `robots: "noindex, nofollow"` in meta. Ensure v2 marketing site does NOT have this. The marketing `robots.ts` already has `Allow: /` -- verify it deploys correctly. **(Suggestion #85)**

---

## PHASE 1 -- Replace Mock Data with Live AI (Critical Path)

> The wizard works end-to-end but uses hardcoded mock data in two critical steps.
> This phase makes the AI pipeline real. No new UI -- just wire the backend.

### 1.1 Live Brand Name Generation (Suggestion #24)

- [ ] **Wire `brand-name.tsx` to real API** -- Replace `MOCK_SUGGESTIONS` (8 hardcoded names) with live response from `POST /wizard/:brandId/generate-names`.
- [ ] **Verify name-generator skill** -- Ensure `server/src/skills/name-generator/` returns domain availability, trademark checks, social handle availability for each name.
- [ ] **Add real domain availability check** -- Integrate WHOIS/domain API in name-generator tools.
- [ ] **Add real social handle checks** -- Check @BrandName on Instagram, TikTok, YouTube, X, Facebook. **(Suggestion #25)**
- [ ] **Remove mock fallback** -- Delete the `shuffleMockData` fallback in `handleRegenerate`.

### 1.2 Live Brand Identity Generation (Suggestion #22)

- [ ] **Wire `brand-identity.tsx` to real API** -- Replace `MOCK_DIRECTIONS` (3 hardcoded directions) with live response from `POST /wizard/:brandId/generate-identity`.
- [ ] **Verify brand-generator skill** -- Ensure it returns 3 distinct brand directions with archetype, colors, fonts, voice, narrative, tagline.
- [ ] **Feed dossier data into generation** -- Pass social analysis results (niche, aesthetic, colors, audience) as context to the brand-generator prompt.
- [ ] **Remove hardcoded direction data** -- Delete `MOCK_DIRECTIONS` constant.

### 1.3 Live Product Recommendations (Suggestion #41)

- [ ] **Verify product-recommender skill integration** -- Ensure `POST /wizard/:brandId/recommend-products` returns AI-ranked products personalized to the dossier (niche, audience demographics, content themes).
- [ ] **Add reasoning per recommendation** -- Each recommended product should include WHY it's recommended based on their data.
- [ ] **Add estimated revenue per product tied to THEIR data** -- Use follower count + engagement rate from dossier to personalize revenue projections. **(Suggestion #42)**

### 1.4 Revenue Calculator Personalization (Suggestion #11)

- [ ] **Wire profit calculator to dossier data** -- Replace generic slider defaults with actual follower count and engagement rate from social analysis.
- [ ] **Show personalized "Money Left on the Table" message** -- "With your 47,000 followers and 3.2% engagement rate, creators like you earn $X-$Y/month."

---

## PHASE 2 -- Complete Onboarding & Social Scraping (Suggestions 1-20)

> Enhance the dossier pipeline and add missing scraping features.
> Can run multiple tasks in parallel.

### 2.1 Onboarding Flow Polish

- [ ] **Social handle as FIRST input** -- Currently step 2. Either make it step 1 (merge with onboarding) or remove the onboarding welcome step and go straight to handle input. **(Suggestion #1)**
- [ ] **Brand Personality Quiz alternative path** -- For users without social media, add a 5-question visual quiz (mood board images, vibe words, dream customer) that generates equivalent dossier data. **(Suggestion #12)**
- [ ] **Linktree/website paste option** -- Add a URL input field alongside social handles. Scrape via Firecrawl/Apify to extract existing brand colors, products, and aesthetic. **(Suggestion #13)**
- [ ] **Auto-detect existing brand name** -- Parse bio text and linked URLs for existing brand names. Pre-populate brand name field if detected. **(Suggestion #14)**

### 2.2 Enhanced Social Analysis

- [ ] **Audio/video tone analysis** -- Analyze TikTok video captions and audio transcripts for tone (funny, serious, educational, motivational). Feed into brand voice generation. **(Suggestion #4)**
- [ ] **Audience demographics estimate** -- Build age/gender/location estimation from engagement patterns, hashtags, and comment analysis. Display in dossier. Backend `AudienceDemographics` component exists but has no data source. **(Suggestion #6)**
- [ ] **Posting frequency and consistency** -- Calculate posts/week and consistency % from timestamp data. Display metric in dossier. **(Suggestion #17)**
- [ ] **Hashtag strategy analysis** -- Map most-used hashtags to niches with market size. Show "You use #homeworkout (14.2M posts) -- that's a $2.1B market." **(Suggestion #18)**
- [ ] **Content format preferences** -- Detect Reel vs Carousel vs Static vs Story percentages. Display breakdown in dossier. **(Suggestion #19)**

### 2.3 Competitor & Market Analysis

- [ ] **Auto-analyze competitors** -- Based on niche and follow patterns, identify 3-5 similar creators with product lines. Show what they sell and market breakdown. **(Suggestion #9)**
- [ ] **Connect Account OAuth flow** -- Add Instagram Graph API and TikTok OAuth for deeper analytics (stories, saved posts, DM themes). Optional enhancement over handle scraping. **(Suggestion #16)**

### 2.4 Dossier Export

- [ ] **Downloadable dossier PDF** -- Generate a polished "Creator Intelligence Report" PDF with all dossier data (profile card, niche, themes, colors, readiness score, demographics). This is the viral growth loop. **(Suggestion #20)**

---

## PHASE 3 -- Brand Identity & AI Generation (Suggestions 21-40)

> Enhance the brand identity step with richer AI capabilities.
> Depends on Phase 1 (live AI) being complete.

### 3.1 Visual Enhancements

- [ ] **AI-generated mood boards** -- For each brand direction, generate a visual collage using creator's content + matched stock imagery. **(Suggestion #23)**
- [ ] **Font pairing previews in context** -- Show fonts applied to actual brand assets (business card, social post, product label), not just isolated preview boxes. **(Suggestion #26)**
- [ ] **Upload inspiration images** -- Add dropzone for mood board inspiration. Extract colors, fonts, patterns from uploaded images using Gemini vision. **(Suggestion #27)**
- [ ] **Real-time brand identity preview** -- As they edit colors/fonts/archetype, show live preview of a product label + social post + website header updating instantly. **(Suggestion #29)**
- [ ] **"Brand DNA" visualization** -- Interactive diagram: archetype at center, values radiating, colors as rings, audience as outer nodes. **(Suggestion #39)**

### 3.2 AI Refinement

- [ ] **"Refine with AI Chat" button** -- Floating chat at every step. "Make the palette more feminine" or "I want the name to sound more premium." Build the chat component that `chatOpen` state already supports. **(Suggestion #33)**
- [ ] **Brand archetype education with real examples** -- Show real brand logos/examples when hovering archetypes ("Think: Apple, Lego, Adobe"). **(Suggestion #30)**
- [ ] **Competitor brand analysis** -- Show 3 similar creators' brand aesthetics side by side. Position AI-generated identity as differentiated. **(Suggestion #34)**
- [ ] **Cultural/seasonal awareness** -- Factor current trends and seasonal colors into brand generation prompts. **(Suggestion #37)**
- [ ] **Multiple tagline generation** -- Dedicated tagline selection with 5-10 AI-generated options per brand direction. **(Suggestion #38)**

### 3.3 Advanced Customization

- [ ] **Three-font typography system** -- Add accent/display font option beyond heading + body. **(Suggestion #35)**
- [ ] **Color palette harmony validation** -- WCAG accessibility scores, harmony analysis (complementary, analogous, triadic), clash warnings. **(Suggestion #31)**
- [ ] **Import existing brand assets** -- Upload existing logo/colors. AI builds identity AROUND existing assets. **(Suggestion #40)**

### 3.4 Brand Outputs

- [ ] **Auto-generate brand style guide PDF** -- After identity step, generate polished PDF with logo usage rules, color codes (HEX/RGB/CMYK), font specs, voice guidelines, do's and don'ts. **(Suggestion #32)**
- [ ] **Brand Voice Generator samples** -- Show sample social caption, product description, email subject line, tagline in brand voice. Component exists (`BrandVoiceSamples`) -- ensure it's fed live AI data. **(Suggestion #28)**

---

## PHASE 4 -- Product Selection & Mockups (Suggestions 41-55)

> Enhance product experience and mockup generation.
> Can run in parallel with Phase 3 where no dependency exists.

### 4.1 Product Catalog Expansion

- [ ] **Expand beyond supplements** -- Ensure seed data covers: apparel, accessories, digital products (workout plans, meal plans), skincare, wellness devices, home goods, journals, candles, coffee/tea. Current seed has 24 products -- expand to 50+. **(Suggestion #43)**
- [ ] **Seasonal product recommendations** -- Time-aware suggestions ("Summer is coming -- swimwear and hydration see 3x sales May-August"). **(Suggestion #52)**
- [ ] **Custom product requests** -- "Don't see what you need?" form that captures demand signals. **(Suggestion #53)**
- [ ] **Social proof per product** -- Show "Selected by X creators" count and "Top-selling in [niche]" badges. **(Suggestion #54)**
- [ ] **Product detail with ingredients/materials** -- Full ingredient panels for supplements, fabric composition + sizing charts for apparel. Update seed data. **(Suggestion #50)**

### 4.2 Mockup Enhancements

- [ ] **Multiple mockup angles** -- Generate front, back, side, lifestyle, flatlay, in-hand views per product. **(Suggestion #47)**
- [ ] **Lifestyle/contextual photography** -- AI-generate contextual product shots (on kitchen counter, in gym bag, on nightstand) matching creator's aesthetic. **(Suggestion #44)**
- [ ] **Mockups on model photography** -- For apparel, show someone wearing it, not just flat images. Use AI to place logo on realistic apparel photos. **(Suggestion #48)**
- [ ] **Before/after mockup polish** -- The `MockupComparison` component exists. Ensure it shows raw vs branded side by side for every product. **(Suggestion #55)**

### 4.3 Business Features

- [ ] **Bundle recommendation engine** -- AI-suggested bundles ("Morning Starter Pack", "Recovery Bundle") based on niche data with revenue boost estimates. The wizard step exists -- verify AI drives it. **(Suggestion #45)**
- [ ] **"Quick Launch" with TruvaNutra** -- Let creators sell with in-house brand immediately while custom brand is being finalized. Earn commissions from day one. **(Suggestion #49)**
- [ ] **Side-by-side product comparison** -- `ProductCompare` component exists. Verify it works with real data and includes trend interest comparison. **(Suggestion #51)**

---

## PHASE 5 -- UX / Design / Flow (Suggestions 56-75)

> Polish the wizard experience. NO style changes to existing design system.
> Existing Tailwind 4 + dark mode + design tokens stay as-is.

### 5.1 Celebration & Engagement

- [ ] **Celebration moments at key milestones** -- Add confetti/sparkle effects when: brand name chosen, logo selected, first product picked. Currently only fires on wizard completion. **(Suggestion #63)**
- [ ] **Gamify the wizard** -- Add completion score / XP bar. Optional fields earn bonus points. "Brand Builder Level 3!" drives completion. **(Suggestion #71)**
- [ ] **"Time remaining" per step** -- Show "This step takes about 2 minutes" to reduce anxiety. **(Suggestion #65)**
- [ ] **Loading states that educate** -- During AI generation waits, show tips: "Did you know? Brands with consistent color palettes are 80% more recognizable." **(Suggestion #75)**

### 5.2 AI Assistant

- [ ] **Build AI chatbot component** -- `chatOpen` state exists in UI store, `chat_messages` DB table exists. Build the floating chat bubble UI + wire to backend. Context-aware help throughout wizard. **(Suggestion #64)**

### 5.3 Navigation & Controls

- [ ] **Keyboard navigation** -- Tab through wizard options, Enter to select, Escape to go back. **(Suggestion #66)**
- [ ] **Undo/redo system** -- Implement command pattern or state snapshots. Ctrl+Z for color changes, name swaps, etc. **(Suggestion #67)**
- [ ] **Persistent "Brand Preview" sidebar** -- Sticky sidebar showing evolving brand: logo thumbnail, color swatches, selected products. Updates in real-time as wizard progresses. **(Suggestion #70)**
- [ ] **Exit intent detection** -- On tab close mid-wizard: "Your brand is 60% complete! We've saved your progress." Email resume link. **(Suggestion #73)**

### 5.4 Mobile & Accessibility

- [ ] **Mobile-first wizard optimization** -- Thumb-friendly navigation, swipe gestures between steps, mobile-optimized inputs. **(Suggestion #68)**
- [ ] **Full accessibility** -- `prefers-reduced-motion` support, skip-to-content link, screen reader announcements for step changes, comprehensive ARIA labels. **(Suggestion #74)**
- [ ] **Video walkthroughs per step** -- 15-second auto-playing (muted) video showing what each step does. **(Suggestion #69)**

### 5.5 Collaboration

- [ ] **Real-time collaboration (share session)** -- "Share this session" link. Others see brand being built live via Socket.io. **(Suggestion #59)**
- [ ] **Purposeful step transitions** -- Already implemented with AnimatePresence. Audit and ensure all transitions feel like progress (slide forward, morph, dissolve). **(Suggestion #72)**

---

## PHASE 6 -- Marketing Site & Conversion (Suggestions 76-85)

> Replace ALL placeholder content with real data. No more fake testimonials.
> Marketing site must have production content before launch.

### 6.1 Real Content (Replace ALL Placeholders)

- [ ] **Real testimonials with video** -- Replace fabricated "Sarah J." testimonials with real creator videos/quotes. Get 5-10 real creators on camera. The v1 site has Sarah J. testimonial -- get permission or replace. **(Suggestion #78)**
- [ ] **Case studies with real revenue numbers** -- Replace fabricated case study data with real creator stories. "Meet Alex, 23K followers, $8,400 in 3 months." Full breakdown with permission. **(Suggestion #79)**
- [ ] **Brand Gallery with real brands** -- Replace placeholder brands with actual brands created on the platform. Let visitors browse completed work. **(Suggestion #80)**
- [ ] **Blog content with real articles** -- Replace 6 fake blog post cards with real SEO-driven content: "How [Creator] launched a $10K/month brand", "5 best niches for creator brands in 2026". **(Suggestion #83)**
- [ ] **Social proof counters with real numbers** -- Replace hardcoded fake numbers (12,847 brands, $4.2M revenue) with real database-driven counts or honest early-stage numbers. **(Suggestion #84)**

### 6.2 Interactive Features

- [ ] **Live wizard demo on homepage** -- Interactive shortened demo: paste a handle, see 30 seconds of analysis. Free taste of the magic. **(Suggestion #76)**
- [ ] **Interactive before/after transformation** -- `BeforeAfterTransformer` component exists. Ensure it uses real product images from the v1 catalog, not stock photos. **(Suggestion #77)**
- [ ] **ROI calculator enhancement** -- Current calculator exists. Pull real product pricing, use v1 commission structure ($84.89B market data, 92% trust stat, 11X ROI). **(Suggestion #82)**

### 6.3 Pricing & SEO

- [ ] **Transparent pricing page** -- Already built. Verify all 4 tiers match real Stripe pricing and feature lists are accurate. **(Suggestion #81)**
- [ ] **Marketing site in Docker/CI** -- Currently excluded from docker-compose and CI/CD pipelines. Add it. **(Infrastructure gap)**

---

## PHASE 7 -- Post-Wizard Dashboard & Retention (Suggestions 86-95)

> Make creators come back daily. Revenue-driving features.

### 7.1 Dashboard Enhancements

- [ ] **Brand Health Score that evolves** -- `BrandHealthGauge` component exists with mock data. Wire to real weekly recalculation: product sales, customer reviews, social mentions, inventory status. **(Suggestion #87)**
- [ ] **Customer analytics dashboard** -- Analytics page exists with Recharts. Wire to real Stripe/order data: who's buying, where, repeat purchase rate. **(Suggestion #89)**
- [ ] **Restock and new product alerts** -- "Your Ashwagandha is #1. Add Magnesium? Similar brands see 30% revenue boost." Push notification + dashboard card. **(Suggestion #90)**

### 7.2 Content & Marketing Tools

- [ ] **Automated social media content generation** -- `ContentGenerator` + `ContentCalendar` exist. Wire to AI: generate Instagram posts, TikTok captions, Stories templates with their branded products placed. "Here's your content for this week." **(Suggestion #88)**
- [ ] **Automated email marketing** -- `email-campaign-worker.js` exists. Build self-service campaign builder UI: new product launches, seasonal promotions, restock notifications. All AI-generated in brand voice. **(Suggestion #92)**

### 7.3 Growth Features

- [ ] **Affiliate/referral program** -- Referral page UI exists. Wire backend: track referral codes, calculate commissions, process payouts. "Share your brand link. When followers sign up, you earn $X." **(Suggestion #93)**
- [ ] **A/B testing for product pricing** -- "Try $39 vs $44 -- we'll split-test and tell you which converts better." **(Suggestion #91)**
- [ ] **Brand evolution tools** -- "Your brand is 6 months old. Audience has changed. Consider refreshing palette or adding trending products." AI-driven brand refresh suggestions. **(Suggestion #94)**

---

## PHASE 8 -- Technical & Infrastructure (Suggestions 96-100)

> Production hardening and enterprise features.

### 8.1 Reliability

- [ ] **Offline-capable with service worker** -- Register service worker, cache critical assets. Queue wizard changes during connectivity loss. **(Suggestion #96)**
- [ ] **Offline resilience** -- If internet drops mid-wizard, don't lose work. Queue changes and sync on reconnect. **(Suggestion #97)**

### 8.2 Enterprise Features

- [ ] **Real-time collaborative editing (Agency tier)** -- Multi-user editing with live cursors and presence indicators. **(Suggestion #98)**
- [ ] **Webhook integrations for power users** -- "When a sale happens, trigger a Zapier webhook." Connect Google Sheets, Notion, Slack. **(Suggestion #99)**
- [ ] **API access for Agency tier** -- Programmatic brand creation for agencies. Batch create brands, bulk generate mockups, export assets via REST API. **(Suggestion #100)**

### 8.3 Testing & Quality

- [ ] **Unit tests (200-400)** -- Vitest unit tests for all services, controllers, utils. Currently only 3 test files exist.
- [ ] **Component tests (80-120)** -- Testing Library component tests for all wizard steps and dashboard pages.
- [ ] **Integration tests (50-80)** -- Vitest + supertest API integration tests for all endpoints.
- [ ] **E2E tests (15-25)** -- Install Playwright. Write end-to-end scenarios for signup, wizard flow, dashboard.
- [ ] **Load tests** -- Install k6. Write load test scripts per PRD spec.
- [ ] **Cloudflare R2 for production assets** -- PRD specifies R2 for generated assets CDN. Currently using Supabase Storage only.

---

## Execution Rules

1. **Complete each phase before starting the next** -- Phases are ordered by dependency.
2. **Tasks within a phase can run in parallel** -- Use agent teams for independent work streams.
3. **No mock data in production** -- Every placeholder must be replaced with real AI output or real content.
4. **Do not change existing design system** -- Tailwind 4 tokens, dark mode, animations, component styles all stay as-is.
5. **Test as you go** -- Each completed feature should have at least basic verification before moving on.
6. **Read the relevant PRD doc before building** -- Always check `docs/prd/` for the spec.

---

## Phase Dependency Graph

```
Phase 0 (Infrastructure Fixes)
    |
    v
Phase 1 (Replace Mock Data with Live AI)
    |
    v
Phase 2 (Onboarding & Scraping) ----+
    |                                |
    v                                v
Phase 3 (Brand Identity)      Phase 4 (Products & Mockups)
    |                                |
    +----------+---------------------+
               |
               v
         Phase 5 (UX Polish)
               |
               v
         Phase 6 (Marketing Site)
               |
               v
         Phase 7 (Dashboard & Retention)
               |
               v
         Phase 8 (Technical & Enterprise)
```

---

## Quick Reference: All 100 Suggestions Mapped

| # | Suggestion | Phase | Status |
|---|-----------|-------|--------|
| 1 | Social handle as first input | 2 | IMPLEMENTED (step 2, move to step 1) |
| 2 | Real-time Creator Dossier | -- | IMPLEMENTED |
| 3 | Scrape YouTube and X/Twitter | 0 | PARTIAL (skill tools yes, service layer no) |
| 4 | Audio/video tone analysis | 2 | MISSING |
| 5 | Auto-detect niche | -- | IMPLEMENTED |
| 6 | Audience demographics estimate | 2 | PARTIAL (UI exists, no data) |
| 7 | Top-performing content themes | -- | IMPLEMENTED |
| 8 | Extract brand colors from feed | -- | IMPLEMENTED |
| 9 | Analyze competitors | 2 | MISSING |
| 10 | Brand Readiness Score | -- | IMPLEMENTED |
| 11 | Money Left on the Table calculator | 1 | PARTIAL (generic, not personalized) |
| 12 | Brand Personality Quiz | 2 | MISSING |
| 13 | Paste Linktree/website | 2 | MISSING |
| 14 | Auto-detect existing brand name | 2 | MISSING |
| 15 | Creator Profile Card | -- | IMPLEMENTED |
| 16 | OAuth flow for IG/TikTok | 2 | MISSING |
| 17 | Posting frequency/consistency | 2 | PARTIAL |
| 18 | Hashtag strategy analysis | 2 | PARTIAL |
| 19 | Content format preferences | 2 | MISSING |
| 20 | Downloadable dossier PDF | 2 | MISSING |
| 21 | Brand identity as story | -- | IMPLEMENTED |
| 22 | 3 brand identity directions | 1 | IMPLEMENTED (mock data, needs live AI) |
| 23 | AI-generated mood boards | 3 | MISSING |
| 24 | Dedicated brand name step | 1 | IMPLEMENTED (mock data, needs live AI) |
| 25 | Social handle availability | 1 | IMPLEMENTED (needs real API) |
| 26 | Font pairing in context | 3 | PARTIAL |
| 27 | Upload inspiration images | 3 | MISSING |
| 28 | Brand Voice Generator | 3 | IMPLEMENTED (verify live data) |
| 29 | Real-time identity preview | 3 | PARTIAL |
| 30 | Archetype education | 3 | PARTIAL |
| 31 | Color harmony validation | 3 | MISSING |
| 32 | Auto brand style guide PDF | 3 | MISSING |
| 33 | Refine with AI Chat | 3 | STUB |
| 34 | Competitor brand analysis | 3 | MISSING |
| 35 | Three-font typography | 3 | PARTIAL |
| 36 | Brand tone sliders | -- | IMPLEMENTED |
| 37 | Cultural/seasonal awareness | 3 | MISSING |
| 38 | Multiple tagline options | 3 | PARTIAL |
| 39 | Brand DNA visualization | 3 | MISSING |
| 40 | Import existing brand assets | 3 | MISSING |
| 41 | AI-recommended products | 1 | IMPLEMENTED (verify personalization) |
| 42 | Revenue per product (personalized) | 1 | IMPLEMENTED (verify dossier data) |
| 43 | Expand beyond supplements | 4 | IMPLEMENTED (needs more products) |
| 44 | Products in lifestyle context | 4 | MISSING |
| 45 | Bundle recommendation engine | 4 | IMPLEMENTED (verify AI drives it) |
| 46 | Interactive mockup editor | -- | IMPLEMENTED |
| 47 | Multiple mockup angles | 4 | MISSING |
| 48 | Mockups on model photography | 4 | MISSING |
| 49 | Quick Launch with TruvaNutra | 4 | MISSING |
| 50 | Product detail with ingredients | 4 | PARTIAL |
| 51 | Side-by-side comparison | 4 | IMPLEMENTED |
| 52 | Seasonal product recs | 4 | MISSING |
| 53 | Custom product requests | 4 | MISSING |
| 54 | Social proof per product | 4 | MISSING |
| 55 | Before/after mockup comparison | -- | IMPLEMENTED |
| 56 | Kill WordPress aesthetic | -- | IMPLEMENTED |
| 57 | Dark mode from start | -- | IMPLEMENTED |
| 58 | Cinematic AI generation | -- | IMPLEMENTED |
| 59 | Real-time collaboration | 5 | MISSING |
| 60 | Save and resume magic link | -- | IMPLEMENTED |
| 61 | Progressive disclosure (3 phases) | -- | IMPLEMENTED |
| 62 | Micro-interactions everywhere | -- | IMPLEMENTED |
| 63 | Celebration at milestones | 5 | PARTIAL |
| 64 | AI chatbot assistant | 5 | STUB |
| 65 | Time remaining per step | 5 | MISSING |
| 66 | Keyboard navigation | 5 | PARTIAL |
| 67 | Undo/redo | 5 | MISSING |
| 68 | Mobile-first wizard | 5 | PARTIAL |
| 69 | Video walkthroughs | 5 | MISSING |
| 70 | Persistent brand preview sidebar | 5 | MISSING |
| 71 | Gamify wizard | 5 | MISSING |
| 72 | Purposeful step transitions | -- | IMPLEMENTED |
| 73 | Exit intent detection | 5 | MISSING |
| 74 | Accessibility | 5 | PARTIAL |
| 75 | Loading states that educate | 5 | PARTIAL |
| 76 | Live wizard demo on homepage | 6 | MISSING |
| 77 | Interactive before/after | 6 | IMPLEMENTED (verify real images) |
| 78 | Real video testimonials | 6 | STUB (fake data) |
| 79 | Case studies with real numbers | 6 | STUB (fake data) |
| 80 | Brand Gallery real brands | 6 | STUB (fake data) |
| 81 | Transparent pricing page | 6 | IMPLEMENTED (verify accuracy) |
| 82 | ROI calculator | 6 | IMPLEMENTED (enhance with real data) |
| 83 | Blog content strategy | 6 | STUB (fake data) |
| 84 | Social proof counters | 6 | IMPLEMENTED (fake numbers) |
| 85 | Remove noindex/nofollow | 0 | IMPLEMENTED (verify deployment) |
| 86 | Real creator dashboard | -- | IMPLEMENTED |
| 87 | Brand Health Score evolves | 7 | PARTIAL (mock data) |
| 88 | Automated social content | 7 | IMPLEMENTED (verify AI wiring) |
| 89 | Customer analytics dashboard | 7 | IMPLEMENTED (wire real data) |
| 90 | Restock/new product alerts | 7 | MISSING |
| 91 | A/B testing pricing | 7 | MISSING |
| 92 | Automated email marketing | 7 | PARTIAL (worker exists, no UI) |
| 93 | Affiliate/referral program | 7 | IMPLEMENTED (wire backend) |
| 94 | Brand evolution tools | 7 | MISSING |
| 95 | (text cut off) | -- | -- |
| 96 | Offline-capable | 8 | MISSING |
| 97 | Offline resilience | 8 | MISSING |
| 98 | Real-time collaborative editing | 8 | MISSING |
| 99 | Webhook integrations | 8 | MISSING |
| 100 | API access Agency tier | 8 | MISSING |
