# Dependency Audit

> **NOTE** — This audits the OLD codebase dependencies. The full rebuild uses a new stack — see [09-GREENFIELD-REBUILD-BLUEPRINT.md](09-GREENFIELD-REBUILD-BLUEPRINT.md). This document is retained for reference during migration.

**Date:** February 19, 2026

---

## Frontend Dependencies

### Brand Builder (`modules/brand-builder/frontend`)

| Package | Current Version | Latest (Feb 2026) | Status | Action |
|---------|----------------|-------------------|--------|--------|
| react | 18.2.0 | 19.x | Outdated | Upgrade to React 19 |
| react-dom | 18.2.0 | 19.x | Outdated | Upgrade with React |
| vite | 5.4.8 | 6.x | Outdated | Upgrade to Vite 6 |
| typescript | 5.4.5 | 5.7.x | Outdated | Upgrade |
| tailwindcss | 3.4.10 | 4.x | Outdated | Evaluate Tailwind 4 migration |
| framer-motion | 11.2.6 | 11.x+ | Check latest | Minor update |
| lucide-react | 0.460.0 | 0.470+ | Check latest | Minor update |
| @supabase/supabase-js | 2.90.1 | 2.x latest | Check latest | Minor update |
| react-colorful | 5.6.1 | 5.x latest | OK | Stable |
| react-responsive | 10.0.1 | 10.x latest | OK | Stable |
| vitest | 1.6.1 | 3.x | Outdated | Upgrade |

### Membership (`modules/membership/frontend`)

| Package | Current Version | Latest (Feb 2026) | Status | Action |
|---------|----------------|-------------------|--------|--------|
| react | 18.2.0 | 19.x | Outdated | Upgrade |
| react-dom | 18.2.0 | 19.x | Outdated | Upgrade |
| react-router-dom | 6.21.0 | 7.x or 6.28+ | Outdated | Evaluate React Router 7 |
| vite | 5.0.8 | 6.x | Outdated | Upgrade |
| tailwindcss | 3.4.0 | 4.x | Outdated | Evaluate |

### Missing Frontend Dependencies (Recommended)

| Package | Purpose | Priority |
|---------|---------|----------|
| react-hook-form | Form handling | P1 |
| zod | Schema validation | P1 |
| @hookform/resolvers | Zod + RHF bridge | P1 |
| @sentry/react | Error monitoring | P0 |
| @sentry/vite-plugin | Source maps | P0 |
| posthog-js | Product analytics | P2 |
| @tanstack/react-query | Data fetching + caching | P2 |

---

## Backend Dependencies

### Brand Builder (`modules/brand-builder/backend`)

| Package | Current Version | Latest (Feb 2026) | Status | Action |
|---------|----------------|-------------------|--------|--------|
| fastapi | 0.115.0 | 0.115.x+ | OK | Check for patches |
| uvicorn | 0.34.0 | 0.34.x+ | OK | Stable |
| pydantic | 2.12.3 | 2.x latest | OK | Check latest |
| agency-swarm | 1.0.1 | Check latest | Review | Evaluate alternatives |
| openai | 1.107.0 | 1.x latest | Check | Update to latest |
| supabase | 2.18.0 | 2.x latest | OK | Standardize across modules |
| httpx | 0.28.0 | 0.28.x+ | OK | Stable |
| fal-client | 0.10.0 | 0.x latest | Check | Update |
| google-genai | 0.2.0 | 0.x latest | Check | Update |
| apify-client | 1.9.0 | 1.x latest | Check | Update |
| python-whois | 0.8.0 | 0.x latest | OK | Stable |
| Pillow | 10.4.0 | 10.x+ | Check | Update |
| resend | 0.8.0 | 0.x latest | Check | Update |
| slowapi | 0.1.9 | 0.1.x | OK | Stable |
| bleach | 6.0.0 | 6.x | OK | Stable |

### Membership (`modules/membership/backend`)

| Package | Current Version | Latest (Feb 2026) | Status | Action |
|---------|----------------|-------------------|--------|--------|
| fastapi | 0.109.0+ | 0.115.x+ | Outdated | Standardize with brand-builder |
| uvicorn | 0.27.0+ | 0.34.x+ | Outdated | Update |
| pydantic | 2.5.0+ | 2.12.x+ | Outdated | Update |
| python-jose | various | various | OK | Stable |

### Shared Services

| Package | Current Version | Latest (Feb 2026) | Status | Action |
|---------|----------------|-------------------|--------|--------|
| supabase | 2.3.0+ | 2.18.0+ | Inconsistent | Standardize to 2.18.0+ |
| httpx | 0.26.0+ | 0.28.0+ | Outdated | Standardize |
| tenacity | 8.2.0 | 8.x+ | OK | Stable |

### Missing Backend Dependencies (Recommended)

| Package | Purpose | Priority |
|---------|---------|----------|
| sentry-sdk[fastapi] | Error monitoring | P0 |
| structlog | Structured logging | P0 |
| redis / upstash-redis | Caching layer | P1 |
| celery / google-cloud-tasks | Background jobs | P0 |
| anthropic | Claude API client | P2 |
| stripe | Payment processing | P2 |

---

## Dependency Version Inconsistencies

| Package | Brand Builder | Membership | Shared | Recommended |
|---------|--------------|------------|--------|-------------|
| fastapi | 0.115.0 | >=0.109.0 | >=0.109.0 | 0.115.0 (standardize) |
| supabase | >=2.18.0 | N/A | >=2.3.0 | >=2.18.0 (standardize) |
| httpx | 0.28.0 | N/A | >=0.26.0 | 0.28.0 (standardize) |
| pydantic | 2.12.3 | >=2.5.0 | >=2.5.0 | 2.12.3 (standardize) |
| uvicorn | 0.34.0 | >=0.27.0 | N/A | 0.34.0 (standardize) |

**Action:** Create a single `requirements-base.txt` in shared/ with pinned versions. Module requirements should inherit from it.

---

## Security Considerations

| Package | Concern | Action |
|---------|---------|--------|
| bleach | Deprecated upstream (archived Jan 2023) | Migrate to `nh3` (Rust-based HTML sanitizer) |
| python-jose | Low maintenance activity | Monitor for CVEs; consider PyJWT as alternative |
| Pillow | Frequent CVEs in image processing | Keep updated; monitor security advisories |
| supabase-js | Client-side anon key exposure | Expected; ensure RLS policies are tight |

---

## Package Manager

| Tool | Current | Status |
|------|---------|--------|
| pnpm | 9.0.0 | Check for 9.x updates |
| pip | system | Consider uv for faster Python package management |
| Node.js | >= 18.0.0 | Should require >= 20.x (18 is approaching EOL) |
| Python | 3.12 | Good; monitor 3.13 readiness |

---

## Recommendations Summary

### Immediate Updates (No Breaking Changes Expected)
- Standardize all Python package versions across modules
- Update Node.js minimum to 20.x
- Replace `bleach` with `nh3`
- Update all minor/patch versions

### Planned Upgrades (Breaking Changes Possible)
- React 18 → 19 (Phase 3 of modernization)
- Vite 5 → 6 (Phase 3)
- Tailwind 3 → 4 (evaluate migration effort)
- React Router 6 → 7 (evaluate if using React 19)
- Vitest 1 → 3 (should be straightforward)

### New Additions
- Sentry SDKs (Python + JS) - Phase 1
- Redis/Upstash - Phase 2
- React Hook Form + Zod - Phase 3
- Stripe SDK - Phase 6
- PostHog - Phase 6
- Anthropic SDK (Claude) - Phase 5
