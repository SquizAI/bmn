# Brand Me Now v2 -- Master Task List

This is the comprehensive task list for the greenfield rebuild. Tasks are organized by phase and week, matching the BUILD-GUIDE.md critical path.

---

## Phase 1: Backend Foundation (Weeks 1-3)

### Week 1 -- Parallel Tasks

- [ ] **1.1** Scaffold project structure (monorepo, package.json, directories)
  - Agent: `server-architect`
  - PRD: `README.md`, `03-SERVER-CORE.md` Section 1
  - Deliverable: npm install succeeds, directory structure matches spec

- [ ] **1.2** Express.js 5 server core (all middleware, routes, health checks)
  - Agent: `server-architect`
  - PRD: `03-SERVER-CORE.md` (all sections)
  - Depends on: 1.1
  - Deliverable: Server starts, /health returns 200, /api/v1/brands returns 401

- [ ] **1.3** Database schema & migrations (all tables, RLS, functions, seed)
  - Agent: `database-engineer`
  - PRD: `07-DATABASE.md` (all sections)
  - Depends on: 1.1
  - Deliverable: 30 migration files, all tables with RLS, 20+ seed products

- [ ] **1.4** Observability layer (Sentry, PostHog, pino, Bull Board)
  - Agent: `observability-engineer`
  - PRD: `12-OBSERVABILITY.md` (all sections)
  - Depends on: 1.2
  - Deliverable: Structured JSON logs, Sentry DSN wired, /admin/queues accessible

### Week 2 -- Parallel Tasks (depend on Week 1)

- [ ] **2.1** Authentication & security hardening
  - Agent: `auth-security`
  - PRD: `08-AUTH-SECURITY.md` (all sections)
  - Depends on: 1.2, 1.3
  - Deliverable: JWT auth works, resume tokens, admin guard, input sanitization

- [ ] **2.2** Real-time engine + job queue system (BullMQ + Socket.io)
  - Agent: `realtime-engineer`
  - PRD: `06-REAL-TIME-JOBS.md` (all sections)
  - Depends on: 1.2
  - Deliverable: 8 queues, test worker, Socket.io namespaces, progress bridge

### Week 3

- [ ] **3.1** Agent framework (Anthropic Agent SDK integration)
  - Agent: `ai-agent-engineer`
  - PRD: `04-AGENT-SYSTEM.md` (all sections)
  - Depends on: 1.2, 2.2
  - Deliverable: Brand Wizard agent, lifecycle hooks, 7 stub skill configs

---

## Phase 2: AI Skills (Weeks 4-6)

- [ ] **4.1** Skill: social-analyzer (Apify scraping + Gemini analysis)
  - Agent: `skill-builder`
  - PRD: `05-SKILL-MODULES.md` (Skill 1)
  - Depends on: 3.1
  - Deliverable: config, prompts, tools, handlers, tests

- [ ] **4.2** Skill: brand-generator (vision, values, archetype, colors, fonts)
  - Agent: `skill-builder`
  - PRD: `05-SKILL-MODULES.md` (Skill 2)
  - Depends on: 3.1

- [ ] **4.3** Skill: name-generator (brand names + domain/trademark checks)
  - Agent: `skill-builder`
  - PRD: `05-SKILL-MODULES.md` (Skill 3)
  - Depends on: 3.1

- [ ] **4.4** Skill: logo-creator (FLUX.2 Pro + background removal + upload)
  - Agent: `skill-builder`
  - PRD: `05-SKILL-MODULES.md` (Skill 4)
  - Depends on: 3.1, 2.2

- [ ] **4.5** Skill: mockup-renderer (GPT Image 1.5 + Ideogram v3 + Gemini 3 Pro Image)
  - Agent: `skill-builder`
  - PRD: `05-SKILL-MODULES.md` (Skill 5)
  - Depends on: 3.1, 4.4

- [ ] **4.6** Skill: profit-calculator (pure math, no AI)
  - Agent: `skill-builder`
  - PRD: `05-SKILL-MODULES.md` (Skill 6)
  - Depends on: 3.1

- [ ] **4.7** Skill: video-creator (Veo 3, Phase 2 stub)
  - Agent: `skill-builder`
  - PRD: `05-SKILL-MODULES.md` (Skill 7)
  - Depends on: 3.1

---

## Phase 3: Frontend (Weeks 7-10)

- [ ] **5.1** Frontend app shell (React 19 + Vite 7 + Router + design system)
  - Agent: `frontend-engineer`
  - PRD: `09-FRONTEND-APP.md` (Sections 1-5)
  - Depends on: 1.2, 2.2

- [ ] **5.2** Wizard steps (all 12 steps with real-time progress)
  - Agent: `frontend-engineer`
  - PRD: `09-FRONTEND-APP.md` (Sections 6-8)
  - Depends on: 5.1

- [ ] **5.3** Dashboard pages (brand management, history, settings)
  - Agent: `frontend-engineer`
  - PRD: `09-FRONTEND-APP.md` (Sections 9-10)
  - Depends on: 5.1

- [ ] **5.4** Admin panel (user management, queue monitoring, analytics)
  - Agent: `frontend-engineer`
  - PRD: `09-FRONTEND-APP.md` (Section 11)
  - Depends on: 5.1

---

## Phase 4: Business Features (Weeks 11-14) -- Parallel

- [ ] **6.1** Payments & billing (Stripe subscriptions, credits, metering)
  - Agent: `payments-engineer`
  - PRD: `10-PAYMENTS-BILLING.md` (all sections)
  - Depends on: 1.2, 1.3

- [ ] **6.2** Integrations (GHL CRM, Resend email, Apify scraping)
  - Agent: `integrations-engineer`
  - PRD: `11-INTEGRATIONS.md` (all sections)
  - Depends on: 1.2, 2.2

---

## Phase 5: Launch (Weeks 15-16)

- [ ] **7.1** Deployment & infrastructure (Docker, K8s, CI/CD)
  - Agent: `devops-engineer`
  - PRD: `13-DEPLOYMENT-INFRA.md` (all sections)
  - Depends on: All phases

- [ ] **7.2** Testing (Vitest, Playwright, MSW, k6)
  - Agent: `test-engineer`
  - PRD: `14-TESTING.md` (all sections)
  - Depends on: 1.2, 5.1

- [ ] **7.3** Marketing site (Next.js 15)
  - Agent: `marketing-site-engineer`
  - PRD: `15-MARKETING-SITE.md` (all sections)
  - Depends on: None (independent)

- [ ] **7.4** Data migration (v1 -> v2)
  - Agent: `database-engineer`
  - PRD: `16-MIGRATION-GUIDE.md` (all sections)
  - Depends on: 1.3, all phases

---

## Task Summary

| Phase | Tasks | Agents Involved | Weeks |
|-------|-------|----------------|-------|
| Phase 1 | 7 tasks | server-architect, database-engineer, observability-engineer, auth-security, realtime-engineer, ai-agent-engineer | 1-3 |
| Phase 2 | 7 tasks | skill-builder | 4-6 |
| Phase 3 | 4 tasks | frontend-engineer | 7-10 |
| Phase 4 | 2 tasks | payments-engineer, integrations-engineer | 11-14 |
| Phase 5 | 4 tasks | devops-engineer, test-engineer, marketing-site-engineer, database-engineer | 15-16 |
| **Total** | **24 tasks** | **13 agents** | **16 weeks** |
