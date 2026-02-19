# Modernization Roadmap

> **SUPERSEDED** — This incremental modernization plan has been replaced by a full platform rebuild. See [09-GREENFIELD-REBUILD-BLUEPRINT.md](09-GREENFIELD-REBUILD-BLUEPRINT.md) for the current plan. This document is retained for reference on the original analysis.

**Date:** February 19, 2026
**Goal:** Bring Brand Me Now to best-of-breed standards for 2026

---

## Current Stack vs. Recommended Stack

| Layer | Current (Feb 2026) | Recommended | Why |
|-------|-------------------|-------------|-----|
| **Frontend Framework** | React 18.2 | React 19 | Server Components, Actions, use() hook, improved performance |
| **Build Tool** | Vite 5.4 | Vite 6.x | Environment API, faster builds, better SSR |
| **CSS** | Tailwind 3.4 | Tailwind 4.x | Native CSS, faster compilation, CSS-first config |
| **State Management** | Zustand + useState | Zustand 5 + React Hook Form | Better form handling, cleaner state |
| **Backend Framework** | FastAPI 0.115 | FastAPI 0.115+ | Already good; add background workers |
| **Python** | 3.12 | 3.12+ | Current; upgrade when 3.13 has broader library support |
| **Database** | Supabase (PG 17) | Supabase (PG 17) | Already good; add caching layer |
| **Caching** | None | Redis (Upstash) | Essential for performance |
| **Background Jobs** | None | Google Cloud Tasks or Celery + Redis | Critical for image gen |
| **AI/LLM** | OpenAI GPT-4o | Claude 4.5/4.6 + OpenAI GPT-4o | Better quality, evaluate cost savings |
| **Image Gen** | Fal.ai Flux Pro | Fal.ai Flux Pro (keep) | Still best-in-class for this use case |
| **Error Monitoring** | None | Sentry | Industry standard |
| **Analytics** | None | PostHog | Open-source, self-hostable, feature flags included |
| **Payments** | None | Stripe | Industry standard |
| **Email** | Resend (chatbot only) | Resend (expand to all modules) | Already integrated; expand usage |
| **Testing** | Minimal | Vitest + Playwright | Unit + E2E |
| **CI/CD** | GitHub Actions | GitHub Actions (enhance) | Already good; add more checks |

---

## Phase 1: Foundation (Weeks 1-3)

### 1.1 Observability

**Add Sentry Error Monitoring**
```
# Backend (all modules)
pip install sentry-sdk[fastapi]

# Frontend (all modules)
npm install @sentry/react @sentry/vite-plugin
```

- Configure DSN via environment variables
- Add source map uploads in CI/CD
- Set up alerting for error rate spikes
- Add Sentry Performance for request tracing

**Add Structured Logging**
```
# Backend
pip install structlog

# Replace print() and logging.info() with structured log calls
# Add correlation IDs (request ID, user ID, session ID)
```

### 1.2 Security Quick Wins

- Stop syncing passwords to GHL custom fields
- Move GHL custom field IDs to environment variables
- Add startup validation for required environment variables
- Implement cryptographically signed resume tokens (HMAC-SHA256)
- Add rate limiting to brand builder image generation endpoints

### 1.3 Remove Dead Code

- Remove `/packages/plugin/` (WordPress plugin)
- Remove `/packages/backend/` (legacy backend)
- Remove `plugin-build.yml` GitHub Actions workflow
- Update `pnpm-workspace.yaml` to remove legacy package paths

---

## Phase 2: Data Layer Cleanup (Weeks 4-6)

### 2.1 Complete NocoDB Migration

**Audit:**
- Map all NocoDB read/write operations
- Identify any NocoDB-only data not in Supabase
- Create migration scripts for remaining data

**Execute:**
- Migrate remaining data to Supabase
- Remove `nocodb_client.py` (1,195 lines)
- Remove all `NC_*` environment variables
- Remove NocoDB from requirements

### 2.2 Add Redis Caching (Upstash)

**Why Upstash:** Serverless Redis, works great with Cloud Run, pay-per-request.

```
pip install redis  # or upstash-redis for serverless

# Cache these:
# - Product catalog (TTL: 1 hour)
# - User profiles (TTL: 5 minutes)
# - Brand details (TTL: 5 minutes, invalidate on write)
# - Social analysis results (TTL: 24 hours)
```

### 2.3 Database Improvements

- Add missing indexes based on query patterns
- Add database-level constraints (not just application-level)
- Create a proper seed script for product catalog
- Add soft-delete support consistently across all tables

---

## Phase 3: Frontend Refactor (Weeks 7-10)

### 3.1 Break Up App.tsx Mega-Component

**Target Architecture:**
```
src/
├── App.tsx                    # Just routing + provider setup
├── wizard/
│   ├── WizardProvider.tsx     # Zustand store for wizard state
│   ├── WizardRouter.tsx       # Step navigation logic
│   ├── steps/
│   │   ├── OnboardingStep.tsx
│   │   ├── SocialMediaStep.tsx
│   │   ├── BrandDetailsStep.tsx
│   │   ├── CustomizationStep.tsx
│   │   ├── LogoSelectionStep.tsx
│   │   ├── ProductSelectionStep.tsx
│   │   ├── MockupReviewStep.tsx
│   │   ├── BundleReviewStep.tsx
│   │   ├── ProfitCalculatorStep.tsx
│   │   └── FinishStep.tsx
│   └── hooks/
│       ├── useWizardState.ts  # Zustand hook for wizard
│       ├── useWizardApi.ts    # API calls for wizard
│       └── useWizardResume.ts # Resume logic
```

### 3.2 Adopt React Hook Form + Zod

```typescript
// Example: Brand Details form
const brandDetailsSchema = z.object({
  brandVision: z.string().min(10, "Vision must be at least 10 characters"),
  brandValues: z.array(z.string()).min(1, "Select at least one value"),
  targetAudience: z.string().min(5),
});

function BrandDetailsStep() {
  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(brandDetailsSchema),
  });
  // ...
}
```

### 3.3 Upgrade React 19 + Vite 6

- Update React to 19.x
- Update React DOM to 19.x
- Update Vite to 6.x
- Update React Router DOM to latest 6.x or 7.x
- Fix any breaking changes (check React 19 migration guide)
- Update Tailwind to 4.x if stable

### 3.4 Remove Mock Data Fallbacks

- Replace mock data with proper error states
- Add retry logic with exponential backoff
- Show clear degraded-mode indicators
- Add loading skeletons for all data-dependent components

---

## Phase 4: Background Processing (Weeks 11-13)

### 4.1 Implement Async Image Generation

**Recommended: Google Cloud Tasks** (already on GCP)

```
Flow:
1. Client calls POST /generate_logos
2. Backend creates Cloud Task → returns job_id immediately
3. Cloud Task worker calls Fal.ai, stores result in Supabase
4. Client polls GET /jobs/{job_id}/status
5. When complete, client fetches results

Alternative: Server-Sent Events (SSE)
1. Client calls POST /generate_logos
2. Backend starts generation in background thread
3. Backend streams progress via SSE: "queued" → "generating" → "complete"
4. Client receives results as they arrive
```

### 4.2 Add Job Queue for All AI Operations

| Operation | Current Latency | Target Latency |
|-----------|----------------|----------------|
| parse_brand | 10-20s | Return immediately, poll for result |
| generate_logos | 15-30s | Return immediately, poll for result |
| generate_mockup | 20-40s | Return immediately, poll for result |
| generate_bundle | 30-60s | Return immediately, poll for result |
| edit_logo | 15-30s | Return immediately, poll for result |

### 4.3 Add Progress Feedback

- Real-time progress bars during generation
- Step-by-step status updates ("Analyzing your style...", "Generating options...", "Refining results...")
- Estimated time remaining based on historical averages

---

## Phase 5: AI Modernization (Weeks 14-16)

### 5.1 Evaluate Claude 4.5/4.6 for Brand Analysis

**Current:** OpenAI GPT-4o for all LLM tasks
**Proposed:** Test Claude 4.5 Sonnet (or Claude 4.6 Opus) for:
- Social media analysis (potentially better reasoning)
- Brand vision generation (potentially more creative)
- Content generation (name suggestions, descriptions)

**Evaluation Criteria:**
- Output quality (blind A/B test)
- Cost per request
- Latency
- Reliability

### 5.2 Modernize AI Agent Framework

**Current:** Agency Swarm 1.0.1
**Evaluate:**
- Claude Agent SDK (Anthropic's official agent framework)
- Latest Agency Swarm version
- LangGraph (if multi-model orchestration needed)

### 5.3 Add AI-Powered Features

- **Brand name validation** - Check trademark conflicts, domain availability
- **Competitor analysis** - Find similar brands and differentiation opportunities
- **Content generation** - Social media posts, product descriptions
- **Style transfer** - Apply brand style across different product categories

---

## Phase 6: Business Features (Weeks 17-20)

### 6.1 Add Stripe Payment Processing

```
# Integration points:
1. Brand creation checkout (one-time or subscription)
2. Product ordering / print-on-demand
3. Premium AI features (more logo options, mockup variations)
4. Subscription for dashboard access + AI agents
```

### 6.2 Add PostHog Analytics

```
# Key events to track:
- wizard_started
- wizard_step_completed (with step_number)
- wizard_abandoned (with last_step)
- logo_generated
- logo_selected
- mockup_generated
- mockup_approved
- brand_completed
- brand_submitted
```

### 6.3 Add Feature Flags (PostHog)

- A/B test wizard flows
- Gradual rollout of new features
- Kill switches for expensive operations
- Beta features for select users

---

## Phase 7: Testing & Quality (Weeks 21-24)

### 7.1 Unit Testing

```
# Backend: pytest + pytest-asyncio (already configured)
# Target: 80% coverage on services and API endpoints

# Frontend: Vitest (already configured)
# Target: 80% coverage on utility functions and hooks
```

### 7.2 Component Testing

```
# Vitest + React Testing Library
# Test each wizard step in isolation
# Test form validation logic
# Test error states and loading states
```

### 7.3 E2E Testing

```
# Playwright
# Test complete wizard flow
# Test authentication flows
# Test dashboard navigation
# Test brand resumption
```

### 7.4 CI/CD Enhancements

```yaml
# Enhanced pipeline:
- Type checking (tsc --noEmit)
- Linting (eslint + ruff)
- Unit tests (vitest + pytest)
- E2E tests (playwright - on PR merge)
- Sentry source map upload
- Lighthouse performance budget
- Bundle size tracking
```

---

## Migration Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| React 19 breaking changes | Medium | High | Thorough testing, feature branch, gradual rollout |
| NocoDB data loss during migration | Low | Critical | Full backup before migration, dual-write during transition |
| Cloud Tasks integration complexity | Medium | Medium | Start with simple poll-based approach, upgrade to SSE later |
| Redis cache invalidation bugs | Medium | Medium | Conservative TTLs, monitor cache hit rates, easy cache flush |
| Stripe integration scope creep | High | Medium | Start with simple one-time payment, add subscription later |

---

## Success Metrics

| Metric | Current | Target (6 months) |
|--------|---------|-------------------|
| Wizard completion rate | Unknown | > 40% |
| P99 API latency (non-AI) | Unknown | < 500ms |
| Error rate | Unknown | < 0.1% |
| Test coverage (backend) | ~10% | > 80% |
| Test coverage (frontend) | ~0% | > 60% |
| Deployment frequency | Manual | Multiple per day |
| Mean time to detect errors | Unknown/∞ | < 5 minutes |
| NocoDB usage | Active | Removed |
| Legacy code | ~2K lines | 0 lines |
