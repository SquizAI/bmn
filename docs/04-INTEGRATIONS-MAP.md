# Third-Party Integrations Map

> **NOTE** — This documents the OLD codebase integrations. The full rebuild replaces or restructures most of these — see [09-GREENFIELD-REBUILD-BLUEPRINT.md](09-GREENFIELD-REBUILD-BLUEPRINT.md). This document is retained for reference during migration.

**Date:** February 19, 2026

---

## Integration Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Brand Me Now                              │
│                                                                  │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌──────────────────┐  │
│  │ Auth    │  │ Database │  │ Storage │  │ Edge Functions   │  │
│  │         │  │          │  │         │  │                  │  │
│  └────┬────┘  └────┬─────┘  └────┬────┘  └────────┬─────────┘  │
│       └────────────┼─────────────┼─────────────────┘            │
│                    │     SUPABASE                                │
└────────────────────┼────────────────────────────────────────────┘
                     │
    ┌────────────────┼────────────────────────────┐
    │                │                            │
    ▼                ▼                            ▼
┌────────┐    ┌──────────┐    ┌─────────┐  ┌──────────┐  ┌────────┐
│ OpenAI │    │  Fal.ai  │    │  GHL    │  │  Resend  │  │ Apify  │
│ GPT-4o │    │ Flux Pro │    │  CRM    │  │  Email   │  │ Scrape │
└────────┘    └──────────┘    └─────────┘  └──────────┘  └────────┘

Optional/Planned:
┌─────────┐  ┌───────────┐  ┌────────────┐
│ Gemini  │  │ Ideogram  │  │ TextRazor  │
│ Google  │  │ Image Gen │  │ Text NLP   │
└─────────┘  └───────────┘  └────────────┘
```

---

## 1. Supabase (Primary Platform)

**Role:** Authentication, Database, Storage, Edge Functions
**Status:** Active - Primary infrastructure

### Authentication
| Feature | Implementation |
|---------|---------------|
| Email/Password | Supabase Auth with email confirmation disabled |
| Google OAuth | Configured via Supabase Auth providers |
| JWT Tokens | 1-hour expiry, auto-refresh |
| Session Management | Client-side via `@supabase/supabase-js` |
| Edge Function | `auth-login-handler` for custom login error handling |

### Database (PostgreSQL 17)
| Feature | Implementation |
|---------|---------------|
| RLS | Row Level Security enabled |
| PostgREST | Fluent query API via Python client |
| Max Rows | 1,000 per request |
| Schemas | `public`, `graphql_public` |

### Storage
| Bucket | Max Size | Purpose |
|--------|----------|---------|
| brand-logos | 50MB | Logo files |
| brand-mockups | 50MB | Product mockup images |
| product-images | 50MB | Catalog reference |
| product-masks | 50MB | AI generation masks |

### Environment Variables
```
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_ANON_KEY
SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY
VITE_SUPABASE_URL
```

---

## 2. OpenAI

**Role:** LLM for brand analysis, chatbot, content generation
**Status:** Active - Core AI engine

### Usage Points

| Module | Model | Purpose |
|--------|-------|---------|
| Brand Builder | GPT-4o | Social media analysis, brand vision generation |
| Brand Builder | GPT-4o | Label design prompts, logo refinement instructions |
| Chatbot | GPT-4o-mini | Conversational AI with knowledge base |
| Agency Swarm | GPT-4o | AI agent orchestration framework |

### Integration Details
- **Client:** `AsyncOpenAI` (non-blocking)
- **Library:** `openai==1.107.0`
- **Framework:** Agency Swarm 1.0.1 for agent orchestration

### Environment Variables
```
OPENAI_API_KEY
CHATBOT_OPENAI_MODEL (default: gpt-4o-mini)
```

### Recommendations (Feb 2026)
- **Evaluate Claude 4.5/4.6** for brand analysis tasks - potentially better quality at lower cost
- **GPT-4o-mini for chatbot is fine** for cost-sensitive conversational use
- **Agency Swarm 1.0.1** - check for updates or consider Claude Agent SDK for orchestration

---

## 3. Fal.ai (Image Generation)

**Role:** AI logo and product mockup generation
**Status:** Active - Core creative engine

### Usage
| Operation | Model | Purpose |
|-----------|-------|---------|
| Logo Generation | Flux Pro v1 Fill | Create brand logos |
| Mockup Generation | Flux Pro v1 Fill | Apply logos to product templates |
| Bundle Images | Flux Pro v1 Fill | Combine multiple mockups |
| Logo Editing | Flux Pro v1 Fill | Refine/modify logos |

### Integration Details
- **Client:** `fal-client==0.10.0`
- **Model:** `fal-ai/flux-pro/v1/fill` (configurable)
- **Output:** Public URLs to generated images
- **Latency:** 15-40+ seconds per generation (blocks request)

### Environment Variables
```
FAL_KEY
FAL_MODEL (default: fal-ai/flux-pro/v1/fill)
```

### Recommendations
- **Add background job processing** - 30-40s blocking requests are unacceptable
- **Evaluate alternatives:** Midjourney API, DALL-E 3, Stable Diffusion 3.5 for quality comparison
- **Add image caching** to avoid re-generating identical requests

---

## 4. GoHighLevel (CRM)

**Role:** Contact management, sales pipeline, workflow automation
**Status:** Active - Critical business integration

### Operations

| Operation | API Endpoint | Purpose |
|-----------|-------------|---------|
| Upsert Contact | `POST /contacts/upsert` | Create/find by email+phone |
| Update Contact | `PUT /contacts/{id}` | Update fields |
| Add Tags | `POST /contacts/{id}/tags` | Wizard step tracking |
| Custom Fields | via update | Brand data, asset URLs, credentials |

### Custom Fields (Hardcoded IDs)
```python
{
    "brand_vision": "7gTEXhtHJ20LXwSXP9EZ",
    "brand_info": "YYIHFkR0MJbCv40cerrU",
    "logo_url": "upQvGHd7GWg16dSQqJ73",
    "mockup_url": "SkN9Yaimnw4ZC674yWHV",
    "social_handle": "Z8cGrbi295489NAn7hHT",
    "social_url": "8BNIEqOskmnb42bYarw8",
    "product_skus": "m08fiHiqR4unBNodhGrW",
    "bmn_username": "puq0UAa4aJTAxZ4hwDYO",
    "bmn_password": "oPaUSdgHGbfAfv5J2Gd4",
}
```

### Integration Details
- **Base URL:** `https://services.leadconnectorhq.com`
- **Auth:** Bearer token + Location ID header
- **Error Handling:** Non-fatal (failures logged, never block user flow)
- **Sync:** Bidirectional via `profile_ghl_sync.py`

### Environment Variables
```
HIGHLEVEL_ACCESS_TOKEN / GHL_API_KEY
HIGHLEVEL_LOCATION_ID / GHL_LOCATION_ID
HIGHLEVEL_CALENDAR_ID
GHL_CF_BRAND_LOGO_URL_ID
GHL_CF_BRAND_MOCKUP_URL_ID
```

### Concerns
- Hardcoded custom field IDs are brittle - any GHL config change breaks the integration
- Access token doesn't rotate - security risk
- Storing `bmn_username` and `bmn_password` in GHL custom fields raises security concerns

---

## 5. Resend (Email)

**Role:** Transactional email delivery
**Status:** Active - Chatbot module only

### Operations
| Operation | Purpose |
|-----------|---------|
| Send support email | Route chatbot inquiries to admin |
| Send user copy | Confirmation email to user |

### Integration Details
- **Library:** `resend>=0.8.0`
- **Rate Limit:** 5 emails/minute per IP
- **HTML Sanitization:** bleach library

### Environment Variables
```
CHATBOT_EMAIL_API_KEY / RESEND_API_KEY
CHATBOT_SUPPORT_EMAIL
CHATBOT_FROM_EMAIL
```

---

## 6. Apify (Web Scraping)

**Role:** Social media data extraction
**Status:** Active - Brand analysis

### Usage
| Operation | Purpose |
|-----------|---------|
| Instagram scraping | Extract posts, followers, aesthetic data |
| Profile analysis | Brand influence calculation |
| Competitor research | Market analysis |

### Environment Variables
```
APIFY_API_TOKEN
APIFY_SHARED
```

---

## 7. Google Gemini (Optional)

**Role:** Alternative LLM
**Status:** Configured but extent of use unclear

### Environment Variables
```
GEMINI_API_KEY
GOOGLE_API_KEY
```

### Notes
- `google-genai==0.2.0` in requirements
- May be used as fallback or for specific tasks
- Consider consolidating to one primary LLM provider

---

## 8. Other Integrations

| Service | Purpose | Status | Env Var |
|---------|---------|--------|---------|
| Ideogram | Alternative image generation | Optional | `IDEOGRAM_API_KEY` |
| TextRazor | Text/NLP analysis | Optional | `TEXTRAZOR_API_KEY` |
| Google Fonts | Font previews | Active | Public API |
| Kalodata | Audience identification | Mentioned in Privacy Policy | Unknown |
| HypeAuditor | Influencer metrics | Mentioned in Privacy Policy | Unknown |

---

## Integration Health Assessment

| Integration | Health | Risk | Notes |
|-------------|--------|------|-------|
| Supabase | Good | Low | Well-configured, RLS enabled |
| OpenAI | Good | Medium | High costs, should evaluate alternatives |
| Fal.ai | Fair | High | Blocking requests, no retry logic |
| GHL | Fair | High | Hardcoded field IDs, credential storage |
| Resend | Good | Low | Simple, well-scoped |
| Apify | Fair | Medium | Scraping reliability varies |
| NocoDB | Poor | High | Legacy, should be removed |
| Gemini | Unknown | Low | Optional, low risk |

---

## Missing Integrations (Recommended for 2026)

| Category | Recommendation | Why |
|----------|---------------|-----|
| **Error Monitoring** | Sentry | No error tracking in production |
| **APM/Observability** | Datadog or Sentry Performance | No request tracing |
| **Structured Logging** | Pino / structlog | No centralized logging |
| **Payment Processing** | Stripe | No payment integration found |
| **Background Jobs** | Cloud Tasks / Celery / BullMQ | Image gen blocks requests |
| **CDN** | Cloudflare or existing Vercel | Image optimization/caching |
| **Analytics** | PostHog or Mixpanel | No product analytics |
| **Feature Flags** | LaunchDarkly or PostHog | No feature flag system |
