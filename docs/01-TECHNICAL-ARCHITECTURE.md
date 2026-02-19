# Technical Architecture

**Date:** February 19, 2026

---

## System Overview

```
                          ┌─────────────────────────────┐
                          │         Vercel CDN           │
                          │   (Static Frontend Hosting)  │
                          └──────────┬──────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
   ┌──────────▼──────────┐ ┌────────▼────────┐ ┌──────────▼──────────┐
   │  Membership App     │ │ Brand Builder   │ │  Chatbot Widget     │
   │  React + Router v6  │ │ React Wizard    │ │  React Component    │
   │  Port 5174 (dev)    │ │ Port 5173 (dev) │ │  Embedded           │
   └──────────┬──────────┘ └────────┬────────┘ └──────────┬──────────┘
              │                      │                      │
              │   Vercel Rewrites: /api/* → Cloud Run       │
              └──────────────────────┼──────────────────────┘
                                     │
                          ┌──────────▼──────────────────┐
                          │    GCP Cloud Run             │
                          │    FastAPI (Python 3.12)     │
                          │    Port 8080                 │
                          │                              │
                          │  ┌─────────────────────────┐ │
                          │  │ /api/wizard/*           │ │
                          │  │ /api/membership/*       │ │
                          │  │ /api/chatbot/*          │ │
                          │  │ /parse_brand            │ │
                          │  │ /generate_logos          │ │
                          │  │ /generate_mockup         │ │
                          │  └─────────────────────────┘ │
                          └──────┬───┬───┬───┬───┬──────┘
                                 │   │   │   │   │
              ┌──────────────────┘   │   │   │   └──────────────────┐
              │              ┌───────┘   │   └───────┐              │
   ┌──────────▼──────┐ ┌────▼────┐ ┌────▼────┐ ┌────▼────┐ ┌──────▼──────┐
   │   Supabase      │ │ OpenAI  │ │ Fal.ai  │ │  GHL    │ │   Resend    │
   │   (PostgreSQL)  │ │ GPT-4o  │ │ Flux Pro│ │  CRM    │ │   Email     │
   │   Auth+Storage  │ │         │ │         │ │         │ │             │
   └─────────────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────────┘
```

---

## Monorepo Structure

```
brand-me-now/                         # pnpm workspace root
├── modules/                          # Feature modules (active)
│   ├── brand-builder/
│   │   ├── frontend/                 # React 18 + Vite 5 + Tailwind
│   │   └── backend/                  # FastAPI + Agency Swarm
│   ├── membership/
│   │   ├── frontend/                 # React 18 + Vite 5 + Router v6
│   │   └── backend/                  # FastAPI
│   └── chatbot/
│       └── backend/                  # FastAPI + OpenAI
│
├── shared/                           # Cross-module shared code
│   ├── services/                     # Python service clients
│   │   ├── base.py                   # BaseServiceClient (singleton pattern)
│   │   ├── supabase_client.py        # Database + Auth + Storage
│   │   ├── ghl_client.py             # GoHighLevel CRM
│   │   ├── nocodb_client.py          # Legacy NocoDB (DEPRECATED)
│   │   └── profile_ghl_sync.py       # Profile ↔ GHL sync
│   ├── auth/                         # JWT middleware + dependencies
│   ├── models/                       # Shared Pydantic models
│   ├── types/                        # Shared TypeScript types
│   ├── ui/                           # Shared React components + auth store
│   └── vite-config/                  # Centralized Vite configuration
│
├── packages/                         # DEPRECATED - Legacy code
│   ├── backend/                      # Old combined backend
│   └── plugin/                       # WordPress plugin (dead code)
│
├── deploy/
│   └── backend/
│       └── main.py                   # Production aggregator (mounts all modules)
│
├── supabase/                         # Supabase configuration
│   ├── config.toml                   # Local dev config (PostgreSQL 17)
│   ├── migrations/                   # SQL migrations
│   └── functions/                    # Edge functions
│
└── .github/workflows/                # CI/CD
    ├── backend-deploy.yml            # → GCP Cloud Run
    └── plugin-build.yml              # → WordPress ZIP artifact
```

---

## Frontend Architecture

### Module: Brand Builder

**Pattern:** Single-page wizard with hash-based routing (`#step=N`)

| Step | Screen | Purpose |
|------|--------|---------|
| -1 | OnboardingScreen | Welcome/intro |
| 0 | AuthFlow | Login/signup + phone + T&C |
| 1 | SocialMediaScreen | Analyze social profiles |
| 2 | BrandDetailsScreen | Define brand vision/identity |
| 3 | BrandCustomizationScreen | Colors, fonts, logo style |
| 4 | LogoSelectionScreen | Choose from generated logos |
| 4.5 | NameLogoSelectionScreen | Alt: name-first workflow |
| 5 | LogoCustomizationScreen | Refine selected logo |
| 5.5 | QuickProductSelectionScreen | Fast product picker |
| 5.75 | ProductCategoryScreen | Detailed category selection |
| 6 | ProductReviewScreen | Review/refine mockups |
| 8 | BundleReviewScreen | Multi-product bundles |
| 8.5 | ProfitCalculatorScreen | ROI projections |
| 9 | FinishScreen | Celebration + completion |
| 10 | GHLFormScreen | CRM submission |

**State:** Single `FormData` object (~100 fields) in `App.tsx` via `useState`

### Module: Membership Dashboard

**Pattern:** React Router v6 with layout nesting

| Route | Page | Purpose |
|-------|------|---------|
| `/` | HomePage / WelcomePage | Dashboard or auth flow |
| `/brands` | BrandsPage | Brand gallery |
| `/brands/:id` | BrandDetailPage | Brand details + assets |
| `/agents` | AgentsPage | AI tools marketplace |
| `/brandbuilder` | Redirect | → Brand builder module |

**State:** `useMembershipData()` custom hook + `useAuthStore` (Zustand)

### Shared UI

**Package:** `@brand-me-now/ui`
- AuthFlow component (login + phone + T&C)
- Auth store (Zustand - cross-module session sync)
- Base components (Button, Card, Input)
- Phone validation utilities

---

## Backend Architecture

### API Module Structure

Each module follows the same pattern:
```
module/backend/
├── main.py                # Local dev entry (FastAPI + CORS + mount)
├── src/
│   ├── api/
│   │   ├── routes.py      # FastAPI router with prefix
│   │   ├── endpoints.py   # Route handlers
│   │   └── models.py      # Pydantic request/response models
│   └── services/
│       ├── supabase_client.py  # Module-specific DB operations
│       └── [other].py          # Module-specific services
└── tests/
    └── test_*.py          # pytest + pytest-asyncio
```

### Production Deployment

```python
# deploy/backend/main.py
base_app = FastAPI()
base_app.include_router(wizard_router, prefix="/api/wizard")
base_app.include_router(membership_router, prefix="/api/membership")
base_app.include_router(chatbot_router, prefix="/api/chatbot")
# Also mounts legacy brand-parsing routes at root
```

### Authentication Flow

```
Client                    Backend                     Supabase
  │                         │                            │
  │ Authorization: Bearer   │                            │
  │ ───────────────────────►│                            │
  │                         │  verify_token(jwt)         │
  │                         │ ──────────────────────────►│
  │                         │  user_id                   │
  │                         │ ◄──────────────────────────│
  │                         │  get_profile(user_id)      │
  │                         │ ──────────────────────────►│
  │                         │  profile data              │
  │                         │ ◄──────────────────────────│
  │  response               │                            │
  │ ◄───────────────────────│                            │
```

**Three dependency modes:**
- `get_current_user()` → Requires auth (401 if missing)
- `get_user_or_401()` → Same, stable error message
- `get_optional_user()` → Returns None if no token

---

## Data Architecture

### Primary Database: Supabase PostgreSQL 17

```
profiles ─────────┐
  │                │
  ├── brands       │
  │    ├── brand_assets
  │    ├── brand_mockups ──→ products
  │    └── brand_products ─→ products
  │
  ├── user_socials
  └── ghl_contacts
```

**8 tables** with RLS (Row Level Security):
- `profiles` - User accounts (linked to auth.users)
- `brands` - Brand projects with wizard state
- `brand_assets` - Logos, design files
- `brand_mockups` - Generated product mockups
- `brand_products` - Selected products (junction)
- `products` - Product catalog
- `user_socials` - Social media accounts + analysis
- `ghl_contacts` - GHL CRM sync tracking

### Storage Buckets
- `brand-logos` - Uploaded/generated logos
- `brand-mockups` - Product mockup images
- `product-images` - Catalog product photos
- `product-masks` - Masks for mockup generation

### Legacy: NocoDB
- `Wizard Data V2` table still in use for some wizard operations
- **Should be fully migrated to Supabase and removed**

---

## Deployment Pipeline

### Frontend (Vercel)

```
git push main
  → Vercel auto-build
  → pnpm build:membership (includes brand-builder merge)
  → Static deploy with API rewrites to Cloud Run
```

### Backend (GCP Cloud Run)

```
git push main (packages/backend/**)
  → GitHub Actions: backend-deploy.yml
  → pytest tests
  → Docker build (python:3.12-slim)
  → Push to Artifact Registry
  → Deploy to Cloud Run (us-west1)
```

### WordPress Plugin (Legacy)

```
git push main (packages/plugin/**)
  → GitHub Actions: plugin-build.yml
  → tsc type-check → vitest → build
  → Create ZIP artifact (30-day retention)
```

---

## Port Assignments (Local Development)

| Service | Port |
|---------|------|
| Brand Builder Frontend | 5173 |
| Membership Frontend | 5174 |
| Brand Builder Backend | 8090 |
| Membership Backend | 8091 |
| Supabase API | 54321 |
| Supabase DB | 54322 |
| Supabase Studio | 54323 |
| Supabase Inbucket (email) | 54324 |
| Preview Server | 5500 |

---

## Production URLs

| Service | URL |
|---------|-----|
| Frontend | `https://brand-me-now.vercel.app` |
| Backend (prod) | `https://brand-me-now-320531488581.us-west1.run.app` |
| Backend (staging) | `https://backend-staging-320531488581.us-central1.run.app` |
