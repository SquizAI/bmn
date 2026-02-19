# Technical Debt & Pain Points

> **NOTE** — This documents tech debt in the OLD codebase. The full rebuild addresses all of these issues by design — see [09-GREENFIELD-REBUILD-BLUEPRINT.md](09-GREENFIELD-REBUILD-BLUEPRINT.md). This document is retained for reference.

**Date:** February 19, 2026

---

## Severity Legend

- **P0 (Critical):** Actively causing production issues or blocking growth
- **P1 (High):** Significant risk or developer pain; should fix within weeks
- **P2 (Medium):** Code quality / maintainability concern; fix within quarter
- **P3 (Low):** Nice-to-have improvement; fix opportunistically

---

## P0 - Critical Issues

### 1. Image Generation Blocks HTTP Requests
**Location:** `/modules/brand-builder/backend/new_api.py`
**Problem:** Logo and mockup generation via Fal.ai takes 15-40+ seconds and runs synchronously within the HTTP request. This blocks the FastAPI worker, degrades throughput, and risks Cloud Run request timeouts.

**Impact:** Poor UX (spinning for 40+ seconds), worker starvation under load, potential timeout failures.

**Fix:** Implement background job processing:
- **Option A:** Google Cloud Tasks (native to GCP) - fire-and-forget with webhook callback
- **Option B:** Celery + Redis - standard Python async task queue
- **Option C:** SSE/WebSocket - stream progress updates to client
- Return a job ID immediately, poll or push status updates

### 2. 165KB Mega-Component (App.tsx)
**Location:** `modules/brand-builder/frontend/src/App.tsx`
**Problem:** The entire brand builder wizard (16+ steps, ~100 state fields, all business logic) lives in a single ~165KB file. This is unmaintainable, untestable, and creates massive re-render issues.

**Impact:** Developer velocity near zero for wizard changes; impossible to unit test; every change risks breaking unrelated steps.

**Fix:**
- Extract each wizard step into its own component with clearly defined props/callbacks
- Move wizard state to a Zustand store or React Context with reducer
- Create a `WizardController` that manages step navigation and state persistence
- Each step receives only the data it needs (no 100-field prop drilling)

### 3. NocoDB Still Active Alongside Supabase
**Location:** `/shared/services/nocodb_client.py` (1,195 lines)
**Problem:** Two databases storing overlapping data. Some operations write to both, creating consistency risks. The NocoDB client is enormous for a system being replaced.

**Impact:** Data can drift between systems; double maintenance; confusion about source of truth; 1,195 lines of code to maintain for a dying system.

**Fix:**
- Audit all NocoDB read/write paths
- Migrate remaining NocoDB-only data to Supabase
- Remove `nocodb_client.py` entirely
- Remove `NC_*` environment variables

### 4. No Error Monitoring / Observability
**Location:** Entire application
**Problem:** No Sentry, no structured logging, no APM, no alerting. Production errors are invisible unless a user reports them.

**Impact:** Bugs go undetected; no way to measure error rates or performance; flying blind in production.

**Fix:**
- Add Sentry for error tracking (Python + JavaScript SDKs)
- Add structured logging with correlation IDs
- Add Sentry Performance or Datadog APM for request tracing
- Set up alerting for error spikes

---

## P1 - High Priority

### 5. No Caching Layer
**Location:** All backend services
**Problem:** Every API request hits Supabase directly. No Redis, no in-memory caching, no HTTP caching headers (except static assets on Vercel).

**Impact:** Unnecessary database load; higher latency; higher Supabase costs; poor performance for repeated queries (like product catalog browsing).

**Fix:**
- Add Redis (or Upstash for serverless) for frequently-read data
- Cache product catalog, brand details, user profiles
- Add cache invalidation on writes
- Consider Supabase Realtime for cache invalidation triggers

### 6. Mock Data Fallback in Membership Dashboard
**Location:** `modules/membership/frontend/src/hooks/useMembershipData.ts`
**Problem:** When API calls fail, the dashboard silently shows mock/demo data. Users don't know they're seeing fake information.

**Impact:** Users make decisions based on fake data; errors are masked; debugging is harder because the UI looks "fine."

**Fix:**
- Show proper error states when APIs fail
- Add retry logic with exponential backoff
- Display a clear banner when operating in degraded mode
- Remove mock data from production builds

### 7. Resume Tokens Are Not Cryptographically Secure
**Location:** Resume token generation in wizard
**Problem:** Resume tokens are simple encodings of session IDs. Anyone who guesses or intercepts a token can access another user's wizard state.

**Impact:** Potential unauthorized access to brand data and wizard progress.

**Fix:**
- Use cryptographically signed tokens (HMAC or JWT with short expiry)
- Add server-side token validation with expiry
- Rate-limit token resolution endpoint
- Log token usage for audit

### 8. GHL Custom Field IDs Hardcoded
**Location:** `/shared/services/ghl_client.py`
**Problem:** 9 custom field IDs are hardcoded as string constants. If anyone changes the GHL configuration, the integration silently fails.

**Impact:** Brittle integration; silent data loss; no way to detect misconfiguration.

**Fix:**
- Move field IDs to environment variables
- Add startup validation that confirms field IDs exist in GHL
- Add monitoring for GHL sync failures
- Consider using GHL field names (with lookup) instead of raw IDs

### 9. Credentials Stored in GHL Custom Fields
**Location:** GHL client syncing `bmn_username` and `bmn_password`
**Problem:** User credentials are being pushed to GoHighLevel CRM custom fields. This is a security anti-pattern.

**Impact:** Credential exposure if GHL is compromised; violates security best practices; potential compliance issues.

**Fix:**
- Stop syncing passwords to GHL immediately
- Remove password custom field from GHL
- If GHL needs login capability, use a secure OAuth flow or magic link

### 10. No Form Library
**Location:** All frontend forms
**Problem:** Custom validation logic scattered across components. No standard approach to form state, validation rules, error display, or submission handling.

**Impact:** Inconsistent validation; duplicated logic; hard to add new fields; error-prone; no accessibility support.

**Fix:**
- Adopt React Hook Form (lightweight, performant)
- Define validation schemas with Zod (already TypeScript-friendly)
- Create reusable field components that integrate with the form library

---

## P2 - Medium Priority

### 11. React 18 End of Life
**Problem:** React 18 is no longer the latest stable. React 19 has been stable since December 2024 with significant improvements (Server Components, Actions, use() hook).

**Fix:** Upgrade to React 19. Test thoroughly as some patterns changed.

### 12. Vite 5 → Vite 6
**Problem:** Vite 6 released December 2025 with better performance and Environment API.

**Fix:** Upgrade Vite. Generally straightforward migration.

### 13. No Frontend Test Coverage
**Location:** `modules/brand-builder/frontend/`, `modules/membership/frontend/`
**Problem:** Vitest configured but minimal test files. The mega-component App.tsx is essentially untestable.

**Fix:**
- First, refactor App.tsx (P0 #2) to make components testable
- Write unit tests for utility functions
- Write component tests for each wizard step
- Add integration tests for critical user flows

### 14. WordPress Plugin Dead Code
**Location:** `/packages/plugin/`
**Problem:** WordPress plugin code exists in the monorepo with its own build pipeline (GitHub Actions). It appears inactive/legacy.

**Impact:** Build complexity, dependency maintenance, CI time for unused code.

**Fix:**
- Confirm plugin is no longer needed
- Archive to a separate repo if needed for reference
- Remove from monorepo and CI pipeline

### 15. Legacy `/packages/backend/` Directory
**Location:** `/packages/backend/`
**Problem:** Old combined backend exists alongside the new modular backend. The deploy pipeline references it.

**Fix:**
- Verify all functionality has been migrated to modules
- Update deploy pipeline to use `deploy/backend/main.py`
- Remove legacy backend directory

### 16. No Rate Limiting on Brand Builder APIs
**Location:** `/modules/brand-builder/backend/`
**Problem:** Only the chatbot module has rate limiting (via slowapi). Brand builder endpoints (which call expensive AI services) have no rate limits.

**Impact:** Abuse potential; runaway costs from image generation; no protection against automated attacks.

**Fix:**
- Add slowapi rate limiting to all brand builder endpoints
- Especially limit `/generate_logos`, `/generate_mockup`, `/edit_mockup`
- Consider user-based (not just IP-based) rate limits for authenticated endpoints

### 17. No Payment Integration
**Problem:** The platform has a profit calculator and product catalog but no payment processing.

**Fix:**
- Integrate Stripe for brand creation fees and product orders
- Add subscription management if moving to SaaS model
- Implement webhook handlers for payment events

### 18. Supabase Python Client Version Inconsistency
**Problem:** Brand builder uses `supabase>=2.18.0`, shared uses `supabase>=2.3.0`. Different minimum versions across modules.

**Fix:** Standardize on the latest Supabase Python client version across all modules.

---

## P3 - Low Priority

### 19. setTimeout Hack in Auth Store
**Location:** `shared/ui/src/stores/authStore.ts`
**Problem:** Uses `setTimeout` to defer async operations, documented as workaround for Supabase `onAuthStateChange` deadlock bug.

**Fix:** Check if this Supabase bug has been fixed in latest versions. If so, remove the workaround.

### 20. No TypeScript on Backend
**Problem:** FastAPI + Pydantic provides runtime type safety but no static analysis. Large backends benefit from static typing.

**Fix (Low Priority):** This is acceptable for the current size. If the backend grows significantly, consider:
- pyright/mypy for static type checking
- Pydantic models are already strongly typed

### 21. Google Fonts Loaded in HTML
**Problem:** 18 Google Fonts loaded in the HTML head, even if only 2-3 are used on a given page.

**Fix:**
- Lazy-load fonts only when needed (when user is in font picker)
- Use `font-display: swap` for better loading performance
- Consider self-hosting critical fonts

### 22. CORS Configuration
**Problem:** CORS origins parsed from environment or set to `*`. In development, `*` is fine but needs to be locked down in production.

**Fix:** Verify production CORS is restricted to actual frontend domains only.

### 23. No API Versioning
**Problem:** No `/v1/` prefix on API routes. Future breaking changes will be hard to roll out.

**Fix:** Add version prefix when making the next breaking API change.

---

## Technical Debt Summary

| Priority | Count | Effort Estimate |
|----------|-------|----------------|
| P0 Critical | 4 | 4-6 weeks |
| P1 High | 6 | 4-6 weeks |
| P2 Medium | 8 | 6-8 weeks |
| P3 Low | 5 | 2-4 weeks |
| **Total** | **23** | **16-24 weeks** |

---

## Recommended Attack Order

### Sprint 1 (Weeks 1-2): Observability + Quick Wins
- [ ] Add Sentry (P0 #4)
- [ ] Remove mock data fallback (P1 #6)
- [ ] Move GHL field IDs to env vars (P1 #8)
- [ ] Stop syncing passwords to GHL (P1 #9)

### Sprint 2 (Weeks 3-4): Data Layer Cleanup
- [ ] Complete NocoDB migration (P0 #3)
- [ ] Add Redis caching (P1 #5)
- [ ] Fix resume token security (P1 #7)

### Sprint 3-4 (Weeks 5-8): Frontend Refactor
- [ ] Break up App.tsx mega-component (P0 #2)
- [ ] Adopt React Hook Form + Zod (P1 #10)
- [ ] Add rate limiting to brand builder (P2 #16)

### Sprint 5-6 (Weeks 9-12): Background Processing + Modernization
- [ ] Implement background job processing for image generation (P0 #1)
- [ ] Upgrade React 19 + Vite 6 (P2 #11, #12)
- [ ] Remove legacy code (P2 #14, #15)

### Sprint 7+ (Weeks 13+): Testing + Scaling
- [ ] Add frontend test coverage (P2 #13)
- [ ] Payment integration (P2 #17)
- [ ] Remaining P3 items
