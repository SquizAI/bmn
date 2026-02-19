# Brand Me Now v2 -- CLAUDE.md

> **This is the most important file in the project.**
> Every Claude Code agent session should read this file first.
> It provides full context for the system architecture, conventions, and build order.

---

## Project Overview

**Brand Me Now v2** is an AI-powered brand creation platform that transforms a user's social media presence into a complete, sellable brand -- identity, logos, product mockups, bundles, and revenue projections -- in a single guided wizard session.

**One-line pitch:** "Go from social media presence to branded product line in minutes, not months."

This is a **greenfield rebuild** -- NOT a modification of an existing codebase. The old system (brand-me-now v1) is reference material only. Do not copy patterns from it; it is riddled with technical debt. Build everything fresh using the specs in `docs/prd/`.

**Monorepo structure:** Three apps in one workspace:
- `server/` -- Express 5 API server (JavaScript + JSDoc)
- `client/` -- React 19 SPA via Vite 7 (TypeScript)
- `marketing/` -- Next.js 15 marketing site (TypeScript)

---

## Tech Stack (Quick Reference)

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| **Backend** | Express.js 5 | Latest | Standalone API server -- NOT Next.js API routes |
| **Runtime** | Node.js 22 LTS | 22.x | Native fetch, test runner, Web Crypto |
| **Backend Language** | JavaScript + JSDoc types | ES2024 | NOT TypeScript on the server |
| **Frontend App** | React 19 + Vite 7 | Latest | SPA with React Router v7 |
| **Frontend Language** | TypeScript | 5.x | Strict mode enabled |
| **Marketing Site** | Next.js 15 (App Router) | Latest | SSG/ISR, separate deploy |
| **Database** | Supabase (PostgreSQL 17) | New instance | Auth, RLS, Storage, Realtime |
| **Cache / Queue** | Redis 7 | Self-hosted on DO | BullMQ job store + cache + rate limiting |
| **Job Queue** | BullMQ | Latest | ALL async work runs through BullMQ |
| **Real-time** | Socket.io | Latest | Bidirectional, room-scoped, JWT-authenticated |
| **Agent Framework** | Anthropic Agent SDK | Latest | `@anthropic-ai/claude-agent-sdk` |
| **Validation** | Zod | Latest | Shared schemas between client + server |
| **Forms** | React Hook Form | Latest | All forms, integrated with Zod |
| **Client State** | Zustand 5 | Latest | Slice pattern, no boilerplate |
| **Server State** | TanStack Query 5 | Latest | Caching, dedup, optimistic updates |
| **Styling** | Tailwind CSS 4 | Latest | Native CSS (no PostCSS), CSS variables |
| **Animations** | Motion (Framer Motion) | Latest | React animation library |
| **Icons** | Lucide React | Latest | Tree-shakable |
| **Payments** | Stripe | Latest | Subscriptions + credits + metering |
| **CRM** | GoHighLevel | OAuth 2.0 | Event-driven sync via BullMQ |
| **Email** | Resend + React Email | Latest | Transactional email |
| **Error Tracking** | Sentry | Latest | Errors + APM + source maps |
| **Analytics** | PostHog | Latest | Analytics + feature flags + session replay |
| **Logging** | pino | Latest | Structured JSON with correlation IDs |
| **Hosting** | DigitalOcean K8s | Latest | Everything Docker containerized |
| **CI/CD** | GitHub Actions | Latest | Lint, test, build, deploy |

---

## AI Model Usage

Claude is the orchestration brain. Other models are tools called BY Claude.

### Text / Reasoning Models

| Task | Primary Model | Fallback | Why |
|------|--------------|----------|-----|
| Brand vision, identity, analysis | Claude Sonnet 4.6 | Gemini 3.0 Pro | Best creative + structured output |
| Social media deep analysis | Claude Sonnet 4.6 (extended thinking) | Gemini 3.0 Pro | Complex multi-source reasoning |
| Brand name generation | Claude Sonnet 4.6 | Claude Haiku 4.5 | Creative + trademark reasoning |
| Chatbot (conversational) | Claude Haiku 4.5 | Gemini 3.0 Flash | Fast + cheap |
| Structured extraction | Claude Haiku 4.5 | Gemini 3.0 Flash | Fast + cheap |
| Validation / classification | Gemini 3.0 Flash | Claude Haiku 4.5 | Cheapest for simple tasks |
| Large context processing | Gemini 3.0 Pro | Claude Sonnet 4.6 | 1M+ token context |

### Image Generation Models

| Task | Model | Provider | Why |
|------|-------|----------|-----|
| Logo generation | FLUX.2 Pro | BFL API (direct) | Gold standard photorealism |
| Product mockups | GPT Image 1.5 | OpenAI (direct) | Best at preserving logos across edits |
| Text-in-image (typography) | Ideogram v3 | Ideogram (direct) | Most reliable legible text |
| Bundle composition / editing | Gemini 3 Pro Image | Google AI (direct) | Best compositing + editing |
| Product videos (Phase 2) | Veo 3 | Google AI (direct) | Short product showcase videos |

---

## Architecture Rules

These are non-negotiable. Every Claude Code agent MUST follow these:

1. **ALL backend code is JavaScript with JSDoc type annotations** -- NOT TypeScript. Use `/** @type {import('express').Request} */` patterns.
2. **Frontend code (client/ and marketing/) IS TypeScript** -- strict mode.
3. **Express.js 5 is a standalone API server** -- NOT Next.js API routes.
4. **Supabase for auth** -- do NOT build custom authentication.
5. **BullMQ for ALL async work** -- image generation, email sending, CRM sync, cleanup. Never do expensive work synchronously in request handlers.
6. **Socket.io for ALL real-time communication** -- generation progress, job status, live updates. No polling.
7. **Anthropic Agent SDK for AI orchestration** -- Claude runs the reasoning loop. Other models are tools called by the agent.
8. **Every skill is a subagent** -- with its own system prompt, tools, budget (`maxBudgetUsd`), and turn limit (`maxTurns`).
9. **Zod for ALL validation** -- shared schemas in `shared/schemas/`, used by both client and server.
10. **React Hook Form for ALL forms** -- integrated with Zod resolvers.
11. **Zustand 5 for client state, TanStack Query 5 for server state** -- never mix these responsibilities.
12. **Tailwind CSS 4 for styling** -- CSS variables for design tokens.

---

## Code Conventions

### General

- **ESM only** -- `import/export` everywhere. Never `require()` or `module.exports`.
- **`const` over `let`** -- never `var`.
- **async/await** -- never raw `.then()` chains.
- **File naming: kebab-case** -- `brand-controller.js`, not `brandController.js`.
- **One default export per module file**, named exports for utility files.
- **Semicolons: yes** -- always use semicolons.

### Backend (JavaScript + JSDoc)

```javascript
/** @type {import('express').Request} */
/** @param {import('express').Request} req */
/** @returns {Promise<Brand>} */
```

### API Response Format

```javascript
// Success
{ success: true, data: { /* payload */ } }

// Error
{ success: false, error: "Human-readable message" }

// Paginated
{ success: true, data: { items: [...], total: 100, page: 1, limit: 20 } }
```

---

## Build Order (Critical Path)

Follow this order strictly. Each phase depends on the previous one.

```
Phase 1 -- Backend Foundation (Weeks 1-3)
├── Week 1 (parallel):
│   ├── 03-SERVER-CORE.md      Express server, middleware chain, Docker
│   ├── 07-DATABASE.md         Supabase schema, RLS policies, migrations, seed
│   └── 12-OBSERVABILITY.md    Sentry, PostHog, pino logging
│
├── Week 2 (parallel, depends on 03):
│   ├── 08-AUTH-SECURITY.md    Auth flow, JWT middleware, security hardening
│   └── 06-REAL-TIME-JOBS.md   BullMQ workers, Socket.io namespaces
│
└── Week 3 (depends on 03 + 06):
    └── 04-AGENT-SYSTEM.md     Agent SDK, parent agent, hooks, tool registry

Phase 2 -- AI Skills (Weeks 4-6, depends on 04)
└── 05-SKILL-MODULES.md        All 7 skill subagents ported and tested

Phase 3 -- Frontend (Weeks 7-10, depends on 03 + 06)
└── 09-FRONTEND-APP.md         React SPA, wizard, dashboard, design system

Phase 4 -- Business Features (Weeks 11-14, parallel)
├── 10-PAYMENTS-BILLING.md     Stripe subscriptions, credits, metering
└── 11-INTEGRATIONS.md         GHL CRM sync, Resend email, Apify scraping

Phase 5 -- Launch (Weeks 15-16)
├── 13-DEPLOYMENT-INFRA.md     Docker, DO K8s, CI/CD, production config
├── 14-TESTING.md              Vitest, Playwright, MSW, k6 load testing
├── 15-MARKETING-SITE.md       Next.js 15 marketing site
└── 16-MIGRATION-GUIDE.md      Data migration from v1
```

**When building any component, ALWAYS read the relevant PRD doc first.**

---

## Security Rules

1. **NEVER store passwords in CRM (GoHighLevel)**.
2. **NEVER commit API keys or secrets** -- use `.env` locally, K8s Secrets in production.
3. **ALWAYS validate user input with Zod** before any processing.
4. **ALWAYS use RLS policies** -- every table has row-level security.
5. **ALWAYS sanitize AI inputs** -- use XML delimiter pattern (`<user_input>` tags).
6. **ALWAYS rate limit all endpoints** -- Redis-backed `express-rate-limit`.
7. **ALWAYS use HMAC-signed tokens** for wizard resume.
8. **ALWAYS authenticate Socket.io connections** via JWT in the handshake.
9. **ALWAYS scope database queries to the current tenant**.
10. **ALWAYS scan AI-generated images for NSFW content** before storing.

---

## What NOT to Do

- **Do NOT use TypeScript on the server** -- JavaScript + JSDoc only.
- **Do NOT use Next.js API routes for the backend** -- Express.js standalone.
- **Do NOT use a heavy ORM** (Prisma, TypeORM) -- Supabase client.
- **Do NOT poll for updates** -- use Socket.io for all real-time.
- **Do NOT do expensive work in request handlers** -- queue via BullMQ.
- **Do NOT build custom auth** -- use Supabase Auth.
- **Do NOT use LangChain or LangGraph** -- use Anthropic Agent SDK.
- **Do NOT use `require()`** -- ESM imports only.
- **Do NOT interpolate user input directly into AI prompts**.
- **Do NOT copy patterns from the v1 codebase**.

---

## PRD Documentation Reference

All specs are in `docs/prd/`. When building a component, read the relevant doc FIRST.

| Doc | Component | Phase |
|-----|-----------|-------|
| `01-PRODUCT-REQUIREMENTS.md` | Master PRD | Read first |
| `02-ARCHITECTURE-OVERVIEW.md` | System architecture | Read first |
| `03-SERVER-CORE.md` | Express server, middleware, Docker | Phase 1 |
| `04-AGENT-SYSTEM.md` | Agent SDK, parent agent, hooks | Phase 1 |
| `05-SKILL-MODULES.md` | All 7 skill subagents | Phase 2 |
| `06-REAL-TIME-JOBS.md` | BullMQ + Socket.io | Phase 1 |
| `07-DATABASE.md` | Supabase schema, RLS, migrations | Phase 1 |
| `08-AUTH-SECURITY.md` | Auth flow, security hardening | Phase 1 |
| `09-FRONTEND-APP.md` | React SPA, wizard, dashboard | Phase 3 |
| `10-PAYMENTS-BILLING.md` | Stripe subscriptions, credits | Phase 4 |
| `11-INTEGRATIONS.md` | GHL, Resend, Apify | Phase 4 |
| `12-OBSERVABILITY.md` | Sentry, PostHog, pino | Phase 1 |
| `13-DEPLOYMENT-INFRA.md` | Docker, K8s, CI/CD | Phase 5 |
| `14-TESTING.md` | Vitest, Playwright, MSW | Phase 3-5 |
| `15-MARKETING-SITE.md` | Next.js marketing site | Phase 5 |
| `16-MIGRATION-GUIDE.md` | v1 -> v2 data migration | Phase 5 |

---

## Agent Team Usage

This project uses Claude Code Agent Teams for parallel development. Custom agents are defined in `.claude/agents/`. Use them by name when spawning teammates.

### Available Agents

| Agent | Role | Build Phase |
|-------|------|-------------|
| `server-architect` | Express.js 5 server core, middleware, routes | Phase 1 |
| `database-engineer` | Supabase schema, RLS, migrations, seed data | Phase 1 |
| `auth-security` | Authentication, JWT, security hardening | Phase 1 |
| `realtime-engineer` | BullMQ queues, Socket.io namespaces, workers | Phase 1 |
| `ai-agent-engineer` | Anthropic Agent SDK, parent agent, hooks | Phase 1 |
| `skill-builder` | AI skill subagent modules | Phase 2 |
| `frontend-engineer` | React 19 + Vite 7 + Tailwind 4 SPA | Phase 3 |
| `observability-engineer` | Sentry, PostHog, pino, Bull Board | Phase 1 |
| `payments-engineer` | Stripe subscriptions, credits, metering | Phase 4 |
| `integrations-engineer` | GHL CRM, Resend email, Apify scraping | Phase 4 |
| `devops-engineer` | Docker, K8s, CI/CD, GitHub Actions | Phase 5 |
| `test-engineer` | Vitest, Playwright, MSW, k6 | Phase 3-5 |
| `reviewer` | Code review, quality assurance, security audit | All |
