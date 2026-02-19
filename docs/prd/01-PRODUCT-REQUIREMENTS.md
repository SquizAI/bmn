# 01 — Product Requirements Document (PRD)

**Product:** Brand Me Now v2
**Date:** February 19, 2026
**Author:** Matt Squarzoni
**Status:** Approved for development

---

## 1. Product Vision

**Brand Me Now** is an AI-powered brand creation platform that transforms a user's social media presence into a complete, sellable brand — identity, logos, product mockups, bundles, and revenue projections — in a single guided wizard session.

**One-line pitch:** "Go from social media presence to branded product line in minutes, not months."

**v2 Goal:** Full greenfield rebuild with best-of-breed 2026 AI models, real-time generation progress, payment processing, and a modular agent architecture that scales to new capabilities without architectural changes.

---

## 2. Target Users

### Primary: Social Media Creators
- Active on Instagram, TikTok, Facebook
- Want to monetize their audience with branded products
- Non-technical — need a guided, no-code experience
- **Pain point:** Hiring a designer/agency is expensive and slow

### Secondary: Small Business Owners
- Starting or rebranding a business
- Need professional brand identity fast
- **Pain point:** DIY tools (Canva) require design skills they don't have

### Tertiary: E-commerce Entrepreneurs
- Want to launch branded product lines
- Need mockups for supplier conversations and marketing
- **Pain point:** Product visualization before manufacturing is expensive

### Admin / Internal
- Platform operators managing product catalog, reviewing brands, monitoring system health
- **Pain point:** No admin panel, no visibility into generation quality or user behavior

---

## 3. User Stories

### Onboarding (Steps 0-1)

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-001 | As a new user, I can sign up with email/password or Google OAuth so I can start building my brand. | Supabase Auth. Email + Google. Apple Sign-In ready (Phase 2). Redirect to wizard after signup. |
| US-002 | As a new user, I provide my phone number and accept terms before starting the wizard. | Phone stored in profiles. TC timestamp recorded. GHL contact created (async, non-blocking). |
| US-003 | As a returning user, I can resume my wizard from where I left off. | HMAC-signed resume token. Wizard state loaded from database. URL-based step routing (not hash). |

### Social Analysis (Steps 2-3)

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-010 | As a user, I enter my Instagram/TikTok/Facebook handle(s) and the AI analyzes my social presence. | Apify scrapes profile. Agent analyzes aesthetic, themes, audience, engagement. Results shown in < 30 seconds. |
| US-011 | As a user, I see real-time progress while my social profiles are being analyzed. | Socket.io progress events. Progress bar with status text ("Scraping profile...", "Analyzing aesthetic...", "Generating brand DNA..."). |
| US-012 | As a user, I can review and edit the AI-generated brand analysis before proceeding. | Editable fields for brand vision, values, archetype, target audience. Changes saved to database. |

### Brand Identity (Steps 3-4)

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-020 | As a user, the AI generates my brand identity (vision, values, archetype, color palette, typography). | Claude Sonnet 4.6 generates structured brand identity. JSON output parsed and displayed. |
| US-021 | As a user, I can customize my color palette by picking from AI suggestions or entering custom colors. | Color picker component. AI suggests 4-6 colors. User can modify, add, remove. |
| US-022 | As a user, I can preview and select fonts from AI-recommended options. | Font previews rendered in real-time. Google Fonts API for display. 3-5 options per category (primary, secondary). |
| US-023 | As a user, I select my preferred logo style (minimal, bold, vintage, modern, playful). | Style selector with visual examples. Selection stored in brand record. |

### Logo Generation (Steps 5-6)

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-030 | As a user, I click "Generate Logos" and see 4 AI-generated logo options with real-time progress. | BullMQ job queued. Socket.io progress (composing prompt → generating → uploading → complete). 4 logos generated via FLUX.2 Pro (BFL direct API). < 60 seconds total. |
| US-031 | As a user, I select my favorite logo and can request refinements. | Selection saved. "Refine" button triggers new generation with modification prompt. Up to 3 refinement rounds. |
| US-032 | As a user, I can regenerate all logos if none are satisfactory. | "Regenerate" button. Costs 1 generation credit. Previous logos archived (not deleted). |

### Product Selection & Mockups (Steps 7-8)

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-040 | As a user, I browse a product catalog and select products for my brand. | Product grid with categories (apparel, accessories, home goods, packaging). Filter by category. Select multiple. |
| US-041 | As a user, I see my logo on selected products as AI-generated mockups with real-time progress. | GPT Image 1.5 generates mockups. One mockup per selected product. Real-time Socket.io progress per mockup. |
| US-042 | As a user, I can approve or reject each mockup and regenerate rejected ones. | Approve/reject per mockup. Rejected mockups regenerated with adjusted prompt. |

### Bundles & Projections (Steps 9-10)

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-050 | As a user, I create product bundles from my selected products. | Drag-and-drop bundle builder. Name each bundle. Bundle composition image generated (Gemini 3 Pro Image). |
| US-051 | As a user, I see profit projections for each product and bundle. | Profit calculator shows: base cost, retail price, margin, projected monthly revenue at 3 sales tiers. |
| US-052 | As a user, I can adjust pricing to see how it affects my margins. | Interactive sliders for retail price. Real-time margin recalculation. |

### Checkout & Completion (Steps 11-12)

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-060 | As a user, I complete my brand creation by paying for the service. | Stripe Checkout. Subscription tier selection (free trial → paid). Credit allocation based on tier. |
| US-061 | As a user, I see a celebration screen with my completed brand summary. | Animation + confetti. Brand summary card with: name, logo, colors, fonts, products, bundles. Share button. |
| US-062 | As a user, I receive a confirmation email with my brand details. | Resend transactional email. React Email template. Includes logo, brand summary, dashboard link. |

### Dashboard

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-070 | As a user, I can view all my brands in a dashboard. | Brand cards with logo, name, status, creation date. Click to view details. |
| US-071 | As a user, I can view a single brand's full details (logo, mockups, bundles, projections). | Brand detail page with all assets, download options, and regeneration capabilities. |
| US-072 | As a user, I can download my brand assets (logo files, mockup images). | Download button per asset. ZIP download for all assets. Multiple formats (PNG, SVG where available). |
| US-073 | As a user, I can start a new brand from my dashboard. | "New Brand" button. Starts wizard from step 1. |

### Chatbot

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-080 | As a user, I can ask questions about branding, products, or the platform via an AI chatbot. | Claude Haiku 4.5 powered. Floating chat widget. Context-aware (knows user's brand data). Rate limited (10 messages/min). |
| US-081 | As a user, I can request human support through the chatbot. | "Talk to human" option. Creates support ticket via Resend email to support team. |

### Admin Panel

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-090 | As an admin, I can view all users, brands, and generation jobs. | Admin dashboard with user list, brand list, job queue status. Protected by admin role check. |
| US-091 | As an admin, I can manage the product catalog (add, edit, disable products). | Product CRUD. Image upload. Category management. Price management. |
| US-092 | As an admin, I can view system health (job queue depth, error rates, AI costs). | Bull Board for job monitoring. Sentry error dashboard embed. Cost tracking via audit_log aggregation. |
| US-093 | As an admin, I can review and flag AI-generated content. | Content moderation queue. Approve/flag/remove generated images. NSFW detection results displayed. |

---

## 4. Non-Functional Requirements

### Performance

| Requirement | Target | How |
|-------------|--------|-----|
| API response time (non-generation) | < 200ms p95 | Redis caching, optimized queries |
| Wizard step transition | < 100ms | Client-side routing, prefetched data |
| Logo generation (4 logos) | < 60 seconds | BullMQ parallel generation, FLUX.2 Pro |
| Mockup generation (per product) | < 30 seconds | GPT Image 1.5, parallel jobs |
| Socket.io connection | < 500ms | Direct WebSocket, no polling fallback |
| Time to Interactive (SPA) | < 2 seconds | Vite 7, code splitting, lazy routes |

### Reliability

| Requirement | Target | How |
|-------------|--------|-----|
| API uptime | 99.9% | K8s health checks, auto-restart, rolling deploys |
| Generation success rate | > 95% | Retry logic (3 attempts), model fallback chains |
| Data durability | Zero data loss | Supabase PITR, R2 backups, BullMQ job persistence |
| Session recovery | Resume from any step | Database-backed wizard state, HMAC resume tokens |

### Security

| Requirement | Target | How |
|-------------|--------|-----|
| Auth | JWT + MFA optional | Supabase Auth, PKCE OAuth |
| Data encryption | TLS 1.3 transit, AES-256 at rest | Supabase, R2, Redis encrypted volumes |
| PII handling | Minimal collection, GDPR compliant | Only email + phone + name. No passwords to CRM. Right to deletion. |
| Rate limiting | Per-user + per-endpoint | Redis-backed express-rate-limit |
| Prompt injection | XML delimiter pattern | System/user prompt separation in all skills |
| Cost controls | Per-session budget limits | Agent SDK maxBudgetUsd + credit system |

### Scalability

| Requirement | Target | How |
|-------------|--------|-----|
| Concurrent users | 500+ simultaneous | K8s horizontal pod autoscaling |
| Brands per month | 5,000+ | BullMQ queue scaling, Redis cluster |
| Storage | Unlimited generated assets | Cloudflare R2 (or DO Spaces) with CDN |

---

## 5. Product Catalog (Seed Data)

### Categories & Products

| Category | Products | Mockup Type |
|----------|----------|-------------|
| **Apparel** | T-shirt, Hoodie, Tank Top, Sweatshirt, Hat | Logo placement on garment |
| **Accessories** | Phone Case, Tote Bag, Water Bottle, Stickers, Mug | Logo on product surface |
| **Home Goods** | Throw Pillow, Canvas Print, Blanket | Logo as pattern/centerpiece |
| **Packaging** | Box, Label, Bag, Tissue Paper | Brand identity applied to packaging |
| **Digital** | Social Media Template, Business Card, Email Header | Brand applied to digital assets |

Each product needs:
- `sku` — Unique product identifier
- `name` — Display name
- `category` — Category assignment
- `base_cost` — Wholesale cost
- `retail_price` — Suggested retail
- `image_url` — Reference product photo
- `mockup_template_url` — Template for AI mockup generation
- `mockup_instructions` — Prompt instructions for GPT Image 1.5 (where to place logo, constraints)

---

## 6. Subscription Tiers

| Tier | Price | Brands | Logo Generations | Mockup Generations | Features |
|------|-------|--------|-----------------|-------------------|----------|
| **Free Trial** | $0 | 1 | 4 logos (1 round) | 4 mockups | Basic wizard, no download |
| **Starter** | $29/mo | 3 | 20 logos/mo | 30 mockups/mo | Download assets, email support |
| **Pro** | $79/mo | 10 | 50 logos/mo | 100 mockups/mo | Priority generation, video (Phase 2), chat support |
| **Agency** | $199/mo | Unlimited | 200 logos/mo | 500 mockups/mo | White-label, API access, phone support |

Credits refresh monthly. Unused credits don't roll over. Overage charged at per-unit rates.

---

## 7. Success Metrics

| Metric | Target (Month 3) | Tracking |
|--------|-------------------|----------|
| Wizard completion rate | > 40% | PostHog funnel |
| Logo generation satisfaction | > 70% (no regenerate) | PostHog event |
| Time to complete wizard | < 15 minutes | PostHog timing |
| Monthly active users | 500+ | PostHog |
| Paid conversion rate | > 5% of free trials | Stripe + PostHog |
| MRR (Monthly Recurring Revenue) | > $5,000 | Stripe dashboard |
| Generation error rate | < 5% | Sentry |
| API p95 latency | < 200ms | Sentry Performance |
| NPS | > 40 | In-app survey |

---

## 8. Out of Scope (v2 Launch)

These are **not** included in the initial rebuild but are planned for future iterations:

- Print-on-demand integration (Printful, Printify)
- Marketplace (user-to-user brand sharing)
- White-label API for agencies
- Mobile native app (iOS/Android)
- Multi-language support (i18n)
- Competitor brand analysis
- A/B testing for brand variations
- Social media post scheduling
- Affiliate/referral program
- Apple Sign-In (Phase 2)
- Veo 3 product videos (Phase 2, Months 2-3)

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| AI model quality inconsistent | Users get bad logos/mockups | Multi-model routing with fallback chains. Regeneration credits. NSFW filtering. |
| Anthropic API outages | Platform unusable | Gemini 3.0 Pro as fallback for text tasks. Graceful degradation. |
| Image gen costs spike | Margin erosion | Credit system caps per-user spend. Aggressive caching. FLUX.2 Dev as budget fallback. |
| Prompt injection | Agent executes unintended actions | XML delimiter pattern. Input sanitization. Agent budget limits. Tool allowlists. |
| GDPR complaints | Legal risk | Right to deletion built in. Minimal PII. No passwords in CRM. Audit trail. |
| Social media API changes | Scraping breaks | Apify handles scraping (they maintain scrapers). Manual fallback (user pastes data). |
| DigitalOcean reliability | Downtime | K8s self-healing pods. Multi-region if needed. Supabase is separate (cloud-hosted). |
