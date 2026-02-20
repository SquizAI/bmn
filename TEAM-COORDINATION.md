# BMN v2 Overhaul — Team Coordination Plan

> **Every agent MUST read this file before starting work.**
> It defines file ownership boundaries, task streams, and conflict avoidance rules.

---

## Team Structure

| Agent Name | Stream | Primary Focus |
|------------|--------|---------------|
| `dossier-engineer` | Stream A | Creator Dossier — social scraping, analysis, dossier UI |
| `brand-engineer` | Stream B | Brand Identity — name generation, multiple directions, AI refinement |
| `product-engineer` | Stream C | Product Intelligence — AI recommendations, mockups, bundles |
| `ux-engineer` | Stream D | UX Foundation — design system, dark mode, animations, wizard structure |
| `dashboard-engineer` | Stream E | Dashboard & Retention — analytics, content gen, referrals |
| `marketing-engineer` | Stream F | Marketing Site — Next.js, demos, SEO, testimonials |

---

## FILE OWNERSHIP BOUNDARIES (CRITICAL)

**The #1 rule: NEVER modify a file owned by another agent.**

If you need a change in another agent's file, create a TODO comment in your own code noting the dependency, and message the team lead.

### Stream A: dossier-engineer

**OWNS (exclusive write access):**
```
server/src/skills/social-analyzer/          (all files)
server/src/workers/social-analysis-worker.js
server/src/routes/api/v1/wizard/social-analysis.js
client/src/routes/wizard/social-analysis.tsx
client/src/components/dossier/              (NEW directory - create it)
client/src/hooks/use-dossier.ts             (NEW)
client/src/hooks/use-social-scrape.ts       (NEW)
client/src/lib/dossier-types.ts             (NEW)
shared/schemas/social-analysis.js           (if exists, or create)
```

**MAY READ (but not write):**
```
client/src/stores/wizard-store.ts           (read store shape)
client/src/styles/design-tokens.css         (read tokens)
server/src/config/                          (read config)
```

### Stream B: brand-engineer

**OWNS (exclusive write access):**
```
server/src/skills/brand-generator/          (all files)
server/src/skills/name-generator/           (all files)
server/src/routes/api/v1/wizard/brand-identity.js
server/src/routes/api/v1/wizard/name-generation.js  (NEW)
client/src/routes/wizard/brand-identity.tsx
client/src/routes/wizard/brand-name.tsx     (NEW step)
client/src/components/brand/                (NEW directory - create it)
client/src/hooks/use-brand-generation.ts    (NEW)
client/src/hooks/use-name-generation.ts     (NEW)
shared/schemas/brand-identity.js            (if exists, or create)
```

**MAY READ (but not write):**
```
client/src/stores/wizard-store.ts
client/src/styles/design-tokens.css
client/src/components/dossier/              (read dossier data types)
```

### Stream C: product-engineer

**OWNS (exclusive write access):**
```
server/src/skills/product-recommender/      (NEW directory)
server/src/routes/api/v1/wizard/product-selection.js
server/src/routes/api/v1/wizard/mockup-generation.js
server/src/routes/api/v1/products/          (all files)
client/src/routes/wizard/product-selection.tsx
client/src/routes/wizard/mockup-review.tsx
client/src/routes/wizard/bundle-builder.tsx (NEW or existing)
client/src/components/products/             (NEW directory - create it)
client/src/hooks/use-products.ts            (NEW or existing)
client/src/hooks/use-mockup-generation.ts   (NEW)
shared/schemas/products.js                  (if exists, or create)
```

**MAY READ (but not write):**
```
client/src/stores/wizard-store.ts
client/src/styles/design-tokens.css
client/src/components/dossier/              (read dossier data for recommendations)
```

### Stream D: ux-engineer

**OWNS (exclusive write access):**
```
client/src/styles/                          (ALL files — design-tokens.css, etc.)
client/src/components/layout/               (ALL files — app-shell, header, sidebar)
client/src/components/ui/                   (ALL files — buttons, cards, inputs, etc.)
client/src/components/animations/           (NEW directory - create it)
client/src/routes/wizard/index.tsx          (wizard layout shell ONLY)
client/src/routes/wizard/onboarding.tsx     (welcome step)
client/src/routes/wizard/completion.tsx     (celebration step)
client/src/lib/animations.ts               (NEW)
client/src/lib/theme.ts                     (NEW)
```

**MAY READ (but not write):**
```
client/src/routes/wizard/*.tsx              (read other steps for context)
client/src/stores/                          (read store shape)
```

**SPECIAL RULE:** If other agents need new UI components (buttons, cards, modals), they should message the ux-engineer to create them in `client/src/components/ui/`, NOT create their own.

### Stream E: dashboard-engineer

**OWNS (exclusive write access):**
```
client/src/routes/dashboard/               (ALL files — create new ones)
client/src/components/dashboard/            (NEW directory - create it)
client/src/hooks/use-dashboard.ts           (NEW)
client/src/hooks/use-analytics.ts           (NEW)
server/src/routes/api/v1/dashboard/         (NEW directory)
server/src/routes/api/v1/analytics/         (NEW directory)
server/src/workers/analytics-worker.js      (NEW)
server/src/workers/content-gen-worker.js    (NEW)
server/src/workers/email-campaign-worker.js (NEW)
shared/schemas/dashboard.js                 (NEW)
shared/schemas/analytics.js                 (NEW)
```

**MAY READ (but not write):**
```
client/src/styles/design-tokens.css
client/src/components/ui/
client/src/stores/
server/src/config/
```

### Stream F: marketing-engineer

**OWNS (exclusive write access):**
```
marketing/                                  (ENTIRE directory — completely isolated)
```

**MAY READ (but not write):**
```
client/src/styles/design-tokens.css         (to match design tokens)
shared/schemas/                             (shared types)
docs/prd/15-MARKETING-SITE.md
```

---

## SHARED FILES — COORDINATION REQUIRED

These files may need edits from multiple agents. **Only the designated owner may edit them.**

| File | Owner | Others Request Via |
|------|-------|--------------------|
| `client/src/App.tsx` | **ux-engineer** | Message team lead |
| `client/src/stores/wizard-store.ts` | **ux-engineer** | Message team lead |
| `client/src/lib/route-guards.ts` | **ux-engineer** | Message team lead |
| `client/src/styles/design-tokens.css` | **ux-engineer** | Message team lead |
| `server/src/app.js` | **team-lead** | Message team lead |
| `server/src/routes/index.js` | **team-lead** | Message team lead |
| `package.json` (root) | **team-lead** | Message team lead |
| `client/package.json` | **ux-engineer** | Message team lead |
| `server/package.json` | **team-lead** | Message team lead |

---

## TASK STREAMS

### Stream A: Creator Dossier (Suggestions 1-20)

| ID | Task | Priority | Depends On |
|----|------|----------|------------|
| A1 | Add YouTube + X/Twitter scraping to social-analyzer skill | High | — |
| A2 | Create Creator Dossier data model (DB schema + API endpoints) | High | — |
| A3 | Build cinematic dossier loading UI with streaming data reveal | High | A2 |
| A4 | Build Creator Profile Card component | High | A2 |
| A5 | Implement niche auto-detection from content analysis | High | A1 |
| A6 | Implement audience demographics estimation | Medium | A1 |
| A7 | Build content theme analysis (top-performing topics) | Medium | A1 |
| A8 | Build Brand Readiness Score calculator | Medium | A5, A6 |
| A9 | Personalized revenue calculator (using THEIR data) | Medium | A6, A8 |
| A10 | Implement competitor analysis (similar creators) | Low | A5 |
| A11 | Build Brand Personality Quiz (alternative no-social path) | Medium | A4 |
| A12 | Add Linktree/website scraping | Low | A1 |
| A13 | Build downloadable Creator Intelligence Report PDF | Low | A4-A9 |
| A14 | Implement Instagram/TikTok OAuth for deeper analytics | Low | A1 |
| A15 | Extract feed color palette from top posts | High | A1 |
| A16 | Analyze posting frequency and consistency | Low | A1 |
| A17 | Detect content format preferences (Reels vs Carousel vs Static) | Medium | A1 |
| A18 | Extract hashtag strategy and map to market sizes | Low | A1 |
| A19 | Auto-detect existing brand name from bio/links | Medium | A1 |
| A20 | Social handle as FIRST input (restructure onboarding flow) | High | A3 |

### Stream B: Brand Identity Enhancements (Suggestions 21-40)

| ID | Task | Priority | Depends On |
|----|------|----------|------------|
| B1 | Create Brand Name Generation wizard step with domain/handle checking | High | — |
| B2 | Generate 3 brand identity directions (not just 1) | High | — |
| B3 | Build narrative brand identity presentation (story, not form) | High | B2 |
| B4 | AI mood board generation per direction | Medium | B2 |
| B5 | Brand Voice Generator (sample captions, descriptions, taglines) | Medium | B2 |
| B6 | Brand tone sliders (Casual↔Formal, Playful↔Serious, etc.) | Medium | — |
| B7 | Font pairing in-context previews (business card, social post, label) | Medium | — |
| B8 | Real-time brand identity preview sidebar | Medium | B2 |
| B9 | Brand archetype education (hover tooltips with real brand examples) | Low | — |
| B10 | AI Chat refinement button at every step | Medium | — |
| B11 | Auto-generate brand style guide PDF | Medium | B2 |
| B12 | Competitor brand analysis display | Low | Stream A dependency |
| B13 | Allow uploading inspiration images | Medium | — |
| B14 | Generate brand taglines (multiple options) | Medium | B2 |
| B15 | Brand DNA visualization (interactive diagram) | Low | B2 |
| B16 | Allow importing existing brand assets (logo, colors) | Medium | — |
| B17 | WCAG color harmony validation with warnings | Medium | — |
| B18 | Add accent/display font (3rd typography option) | Low | B7 |
| B19 | Seasonal/trend-aware brand generation | Low | B2 |
| B20 | Social handle availability checking per brand name | High | B1 |

### Stream C: Product Intelligence (Suggestions 41-55)

| ID | Task | Priority | Depends On |
|----|------|----------|------------|
| C1 | AI product recommendation engine based on dossier | High | Stream A |
| C2 | Per-product estimated revenue based on THEIR audience | High | Stream A |
| C3 | Expand product catalog beyond supplements | High | — |
| C4 | Contextual/lifestyle product imagery | Medium | — |
| C5 | Smart bundle recommendation engine | Medium | C1 |
| C6 | Interactive mockup editor (drag logo, resize, reposition) | High | — |
| C7 | Multiple mockup angles per product | Medium | — |
| C8 | Mockup on model/lifestyle photography | Medium | — |
| C9 | Quick Launch with TruvaNutra (earn commissions immediately) | Medium | — |
| C10 | Product detail pages (ingredients, materials, sizing) | Medium | C3 |
| C11 | Side-by-side product comparison | Low | C3 |
| C12 | Seasonal product recommendations | Low | C1 |
| C13 | Custom product request form | Low | — |
| C14 | Social proof per product ("selected by X creators") | Medium | — |
| C15 | Before/after mockup comparison (raw → branded) | Medium | — |

### Stream D: UX Foundation (Suggestions 56-75)

| ID | Task | Priority | Depends On |
|----|------|----------|------------|
| D1 | Dark mode design system (tokens, toggle, persistence) | High | — |
| D2 | Wizard phase restructuring (Discover → Design → Launch) | High | — |
| D3 | Cinematic AI generation animations (particles, ink, neural) | High | — |
| D4 | Micro-interactions library (hover, click, select, toggle) | High | — |
| D5 | Celebration moments at key milestones (not just completion) | Medium | D4 |
| D6 | Persistent "Brand Preview" sidebar that evolves through wizard | Medium | D2 |
| D7 | Mobile-first wizard optimization (swipe, thumb nav) | High | D2 |
| D8 | AI chatbot assistant (floating bubble, context-aware) | Medium | — |
| D9 | Exit intent detection + auto-save notification | Medium | — |
| D10 | Keyboard navigation + undo/redo system | Medium | — |
| D11 | Loading states that educate (tips during AI generation) | Medium | D3 |
| D12 | Video walkthroughs at each step (15-sec auto-play muted) | Low | — |
| D13 | Step transitions (morph/slide/dissolve between steps) | Medium | D2 |
| D14 | "Time remaining" per step indicator | Low | D2 |
| D15 | Gamification (completion score / XP bar) | Low | D2 |
| D16 | Accessibility audit (ARIA, keyboard, screen reader, reduced motion) | Medium | D1 |
| D17 | Real-time collaboration (invite friend to view wizard) | Low | — |
| D18 | Undo/redo system for all wizard edits | Medium | — |
| D19 | Save and resume magic link | Medium | — |
| D20 | Credit cost indicators before generation steps | Medium | — |

### Stream E: Dashboard & Retention (Suggestions 86-95)

| ID | Task | Priority | Depends On |
|----|------|----------|------------|
| E1 | Creator Dashboard — sales, revenue, growth charts | High | — |
| E2 | Brand Health Score (weekly, gamified) | Medium | E1 |
| E3 | AI social media content generation (posts, captions, stories) | High | — |
| E4 | Customer analytics dashboard (demographics, repeat rate) | Medium | E1 |
| E5 | Restock alerts + product expansion recommendations | Medium | E1 |
| E6 | Automated email marketing integration | Medium | — |
| E7 | Affiliate/referral program | Medium | — |
| E8 | Brand evolution recommendations (6-month refresh) | Low | E2 |
| E9 | A/B testing for product pricing | Low | E1 |
| E10 | Shopify/WooCommerce/TikTok Shop integration | High | — |

### Stream F: Marketing Site (Suggestions 76-85)

| ID | Task | Priority | Depends On |
|----|------|----------|------------|
| F1 | Interactive demo on homepage (paste handle, see preview) | High | Stream A |
| F2 | Before/after product transformer (slider) | High | — |
| F3 | Video testimonials section | Medium | — |
| F4 | Case studies with real revenue numbers | Medium | — |
| F5 | Brand gallery (showcase completed brands) | Medium | — |
| F6 | Transparent pricing page | High | — |
| F7 | Embedded ROI calculator | Medium | — |
| F8 | Fix SEO (remove noindex/nofollow, meta tags, sitemap) | High | — |
| F9 | Social proof counters (brands created, revenue generated) | Medium | — |
| F10 | Blog content strategy overhaul | Low | — |

### Stream G: Infrastructure (Suggestions 96-100)

| ID | Task | Priority | Depends On |
|----|------|----------|------------|
| G1 | Sub-3-second page loads (lazy loading, edge caching, font preload) | High | — |
| G2 | Service worker for offline wizard capability | Medium | — |
| G3 | Webhook integrations (Zapier, etc.) | Low | — |
| G4 | API access for Agency tier | Low | — |
| G5 | Real-time collaborative editing for agency tier | Low | — |

---

## DEPENDENCY GRAPH

```
Stream A (Dossier) ──────────┐
                              ├──→ Stream B (Brand Identity) uses dossier data
                              ├──→ Stream C (Products) uses dossier for recommendations
                              └──→ Stream F (Marketing) uses dossier for demo

Stream D (UX Foundation) ────→ ALL streams use design tokens, UI components
                              (D should start first or in parallel with clear API)

Stream E (Dashboard) ────────→ Independent (post-wizard, different routes)

Stream F (Marketing) ────────→ Independent (separate Next.js app)
```

**Recommended start order:**
1. Stream D (UX Foundation) + Stream A (Dossier) — start simultaneously
2. Stream B (Brand Identity) + Stream C (Products) — start after A2 completes
3. Stream E (Dashboard) + Stream F (Marketing) — can start anytime, fully independent

---

## COMMUNICATION PROTOCOL

1. **Before modifying any shared file**, message the team lead
2. **When creating a new component** that others might use, message the team
3. **When you finish a task**, mark it completed and check for the next unblocked task in your stream
4. **If you're blocked** on another stream's dependency, message that agent
5. **All new directories** should be created by the owning agent (don't create dirs for others)

---

## CONVENTIONS (from CLAUDE.md — apply everywhere)

- **Server:** JavaScript + JSDoc (NOT TypeScript)
- **Client:** TypeScript strict mode
- **ESM only** — `import/export`
- **File naming:** kebab-case
- **Validation:** Zod schemas
- **Forms:** React Hook Form + Zod
- **State:** Zustand (client) + TanStack Query (server)
- **Styling:** Tailwind CSS 4 + CSS variables
- **Animations:** Motion (Framer Motion)
- **Icons:** Lucide React
