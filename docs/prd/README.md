# Brand Me Now v2 — Product Requirements & Development Specs

**Created:** February 19, 2026
**Status:** Ready for development
**Master Blueprint:** [../09-GREENFIELD-REBUILD-BLUEPRINT.md](../09-GREENFIELD-REBUILD-BLUEPRINT.md)

---

## How to Use This Package

This folder contains everything needed to build Brand Me Now v2 from scratch. Each document is a **self-contained development spec** with:

- **Requirements** — What needs to be built and why
- **Technical Specification** — Exactly how to build it
- **Code Examples** — Key patterns and implementations
- **File Manifest** — Every file that needs to be created
- **Environment Variables** — Required config
- **Development Prompt** — A ready-to-use prompt for Claude Code to build the component
- **Acceptance Criteria** — How to verify it works
- **Dependencies** — What must be built first

### Starting a New Project

```bash
# 1. Create new project
mkdir brand-me-now-v2 && cd brand-me-now-v2
git init

# 2. Copy docs
cp -r /path/to/brand-me-now/docs .

# 3. Follow the build order below
```

---

## Document Index

### Core Product

| Doc | Component | Build Phase | Dependencies |
|-----|-----------|-------------|--------------|
| [01-PRODUCT-REQUIREMENTS.md](01-PRODUCT-REQUIREMENTS.md) | Master PRD — vision, users, stories, acceptance criteria | Read First | None |
| [02-ARCHITECTURE-OVERVIEW.md](02-ARCHITECTURE-OVERVIEW.md) | System diagram, data flow, component relationships | Read First | 01 |

### Backend (Build Phase 1 — Weeks 1-3)

| Doc | Component | Build Phase | Dependencies |
|-----|-----------|-------------|--------------|
| [03-SERVER-CORE.md](03-SERVER-CORE.md) | Express.js 5 server, middleware chain, config, Docker | Phase 1, Week 1 | None |
| [07-DATABASE.md](07-DATABASE.md) | Supabase schema, RLS policies, migrations, seed data | Phase 1, Week 1 | None |
| [08-AUTH-SECURITY.md](08-AUTH-SECURITY.md) | Auth flow, JWT, security hardening, all middleware | Phase 1, Week 1-2 | 03, 07 |
| [06-REAL-TIME-JOBS.md](06-REAL-TIME-JOBS.md) | BullMQ workers, Socket.io namespaces, progress events | Phase 1, Week 2-3 | 03 |
| [04-AGENT-SYSTEM.md](04-AGENT-SYSTEM.md) | Anthropic Agent SDK, parent agent, hooks, tool registry | Phase 1, Week 2-3 | 03, 06 |
| [12-OBSERVABILITY.md](12-OBSERVABILITY.md) | Sentry, PostHog, pino structured logging | Phase 1, Week 1 | 03 |

### AI Skills (Build Phase 2 — Weeks 4-6)

| Doc | Component | Build Phase | Dependencies |
|-----|-----------|-------------|--------------|
| [05-SKILL-MODULES.md](05-SKILL-MODULES.md) | All 7 skill subagents — specs, prompts, tools, handlers | Phase 2 | 04, 06, 07 |

### Frontend (Build Phase 3 — Weeks 7-10)

| Doc | Component | Build Phase | Dependencies |
|-----|-----------|-------------|--------------|
| [09-FRONTEND-APP.md](09-FRONTEND-APP.md) | React 19 SPA — wizard routes, dashboard, design system | Phase 3 | 03, 06 (API + Socket.io ready) |

### Business Features (Build Phase 4 — Weeks 11-14)

| Doc | Component | Build Phase | Dependencies |
|-----|-----------|-------------|--------------|
| [10-PAYMENTS-BILLING.md](10-PAYMENTS-BILLING.md) | Stripe subscriptions, credits, metering, webhooks | Phase 4 | 03, 07 |
| [11-INTEGRATIONS.md](11-INTEGRATIONS.md) | GHL CRM sync, Resend email, Apify scraping | Phase 4 | 03, 06 |

### Launch (Build Phase 5 — Weeks 15-16)

| Doc | Component | Build Phase | Dependencies |
|-----|-----------|-------------|--------------|
| [13-DEPLOYMENT-INFRA.md](13-DEPLOYMENT-INFRA.md) | Docker, DO K8s, CI/CD, production config | Phase 5 | All |
| [14-TESTING.md](14-TESTING.md) | Vitest, Playwright, MSW, k6 load testing | Phase 3-5 | 03, 09 |
| [15-MARKETING-SITE.md](15-MARKETING-SITE.md) | Next.js 15 marketing site | Phase 5 | None (independent) |
| [16-MIGRATION-GUIDE.md](16-MIGRATION-GUIDE.md) | Data migration from old system | Phase 5 | 07, All |

---

## Build Order (Critical Path)

```
Week 1:  03-SERVER-CORE + 07-DATABASE + 12-OBSERVABILITY (parallel)
         └── Express server boots, DB ready, Sentry connected

Week 2:  08-AUTH-SECURITY + 06-REAL-TIME-JOBS (parallel, depends on 03)
         └── Auth middleware works, BullMQ + Socket.io wired

Week 3:  04-AGENT-SYSTEM (depends on 03 + 06)
         └── Brand Wizard agent runs, tools execute, subagents spawn

Week 4-6: 05-SKILL-MODULES (depends on 04)
         └── All 7 skills ported, tested, generating real output

Week 7-10: 09-FRONTEND-APP (depends on 03 + 06)
         └── Wizard works end-to-end, real-time progress, dashboard

Week 11-14: 10-PAYMENTS + 11-INTEGRATIONS (parallel)
         └── Stripe billing + GHL sync + email flows

Week 15-16: 13-DEPLOYMENT + 14-TESTING + 15-MARKETING + 16-MIGRATION
         └── Production deploy, E2E tests, marketing site, cutover
```

---

## Tech Stack Quick Reference

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend App** | React 19 + Vite 7 | Latest |
| **Marketing Site** | Next.js 15 | Latest |
| **API Server** | Express.js 5 | Latest |
| **Agent Framework** | Anthropic Agent SDK | Latest |
| **Job Queue** | BullMQ | Latest |
| **Real-time** | Socket.io | Latest |
| **Database** | Supabase (PostgreSQL 17) | New instance |
| **Cache/Jobs** | Redis 7 | Self-hosted on DO |
| **Auth** | Supabase Auth | Supabase instance |
| **Payments** | Stripe | Latest |
| **CRM** | GoHighLevel | OAuth 2.0 |
| **Email** | Resend + React Email | Latest |
| **Error Tracking** | Sentry | Latest |
| **Analytics** | PostHog | Latest |
| **Hosting** | DigitalOcean (all infra) | K8s or Droplets |
| **CI/CD** | GitHub Actions | Latest |
| **Containers** | Docker + Docker Compose | Latest |

## AI Models

| Model | Provider | Role |
|-------|----------|------|
| **Claude Sonnet 4.6** | Anthropic | Primary workhorse — brand vision, analysis, creative |
| **Claude Haiku 4.5** | Anthropic | Fast/cheap — chat, extraction, classification |
| **Gemini 3.0 Flash** | Google | Lightweight — validation, batch processing |
| **Gemini 3.0 Pro** | Google | Large context — massive input analysis |
| **FLUX.2 Pro** | BFL (direct API) | Logo generation |
| **GPT Image 1.5** | OpenAI (direct) | Product mockups |
| **Ideogram v3** | Ideogram (direct) | Text-in-image (typography) |
| **Gemini 3 Pro Image** | Google (direct) | Bundle composition/editing |
| **Veo 3** | Google (direct) | Product videos (Phase 2) |

---

## Environment Variables (Complete List)

```bash
# === Supabase (NEW instance) ===
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# === Redis ===
REDIS_URL=redis://redis:6379

# === AI Providers ===
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_API_KEY=
BFL_API_KEY=
IDEOGRAM_API_KEY=

# === Payments ===
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# === CRM ===
GHL_CLIENT_ID=
GHL_CLIENT_SECRET=
GHL_LOCATION_ID=

# === Email ===
RESEND_API_KEY=
FROM_EMAIL=hello@brandmenow.com
SUPPORT_EMAIL=support@brandmenow.com

# === Scraping ===
APIFY_API_TOKEN=

# === Observability ===
SENTRY_DSN=
POSTHOG_API_KEY=
POSTHOG_HOST=https://app.posthog.com

# === App Config ===
NODE_ENV=production
PORT=3000
API_URL=https://api.brandmenow.com
APP_URL=https://app.brandmenow.com
MARKETING_URL=https://brandmenow.com

# === Security ===
RESUME_TOKEN_SECRET=     # HMAC secret for wizard resume tokens
CORS_ORIGINS=https://app.brandmenow.com,https://brandmenow.com

# === DigitalOcean ===
DO_REGISTRY=registry.digitalocean.com/brandmenow
DO_CLUSTER_NAME=bmn-k8s
```

---

## Reference Documents (Old Codebase Analysis)

These docs analyze the **current** Brand Me Now codebase. Use them for reference when migrating data, understanding current behavior, and porting prompts:

| Doc | What It Covers |
|-----|---------------|
| [../00-EXECUTIVE-SUMMARY.md](../00-EXECUTIVE-SUMMARY.md) | High-level overview of current system |
| [../01-TECHNICAL-ARCHITECTURE.md](../01-TECHNICAL-ARCHITECTURE.md) | Current architecture details |
| [../02-COMPONENT-INVENTORY.md](../02-COMPONENT-INVENTORY.md) | All components in current codebase |
| [../03-DATABASE-SCHEMA.md](../03-DATABASE-SCHEMA.md) | Current Supabase + NocoDB schema |
| [../04-INTEGRATIONS-MAP.md](../04-INTEGRATIONS-MAP.md) | Current third-party integrations |
| [../05-TECHNICAL-DEBT-AND-PAIN-POINTS.md](../05-TECHNICAL-DEBT-AND-PAIN-POINTS.md) | Known issues to avoid repeating |
| [../06-BUSINESS-MODEL-ANALYSIS.md](../06-BUSINESS-MODEL-ANALYSIS.md) | Business model analysis |
| [../09-GREENFIELD-REBUILD-BLUEPRINT.md](../09-GREENFIELD-REBUILD-BLUEPRINT.md) | **Master blueprint** (detailed tech decisions) |
