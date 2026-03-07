# Data Flow Map -- Every Component Traced

## End-to-End User Journey: Registration to Storefront

```mermaid
graph TD
    subgraph "1. Registration"
        A1[User visits app.prznl.com] --> A2[Supabase Google OAuth]
        A2 --> A3[Profile created in profiles table]
        A3 --> A4[Organization auto-created]
        A4 --> A5[Redirected to /dashboard]
    end

    subgraph "2. Brand Wizard"
        B1[User clicks Create Brand] --> B2[/wizard/onboarding]
        B2 --> B3[Enter social URLs]
        B3 --> B4[/wizard/social-analysis]
        B4 -->|Queue: social-analysis| B5[Social Analysis Worker]
        B5 -->|Claude Sonnet| B6[Analyze social presence]
        B6 --> B7[Write dossier to wizard_state]
        B7 -->|Socket.io: generation:complete| B8[Show results]
        B8 --> B9[/wizard/brand-quiz]
        B9 --> B10[AI quiz for preferences]
        B10 --> B11[/wizard/brand-identity]
        B11 -->|Queue: brand-wizard| B12[Brand Identity Worker]
        B12 -->|Claude Sonnet| B13[Generate identity]
        B13 --> B14[Write to brand_identities table]
        B14 --> B15[/wizard/brand-name]
        B15 -->|Claude Sonnet| B16[Generate brand names]
        B16 --> B17[User picks name]
        B17 --> B18[/wizard/logo-generation]
        B18 -->|Queue: logo-generation| B19[Logo Worker]
        B19 -->|FLUX.2 Pro / Ideogram| B20[Generate 4 logos]
        B20 --> B21[Upload to Supabase Storage]
        B21 --> B22[Write to brand_logos table]
        B22 --> B23[/wizard/product-selection]
        B23 --> B24[User picks products]
        B24 --> B25[/wizard/mockup-generation]
        B25 -->|Queue: mockup-generation| B26[Mockup Worker]
        B26 -->|GPT Image 1.5| B27[Generate mockups]
        B27 --> B28[Upload to Supabase Storage]
        B28 --> B29[Write to brand_mockups table]
        B29 --> B30[/wizard/completion]
        B30 --> B31[Brand status: complete]
    end

    subgraph "3. Dashboard"
        C1[/dashboard - Overview] --> C2[Brand Health Score]
        C1 --> C3[Revenue KPIs]
        C1 --> C4[Quick Actions]
    end

    subgraph "4. Storefront Builder"
        D1[/dashboard/storefront] --> D2[Load storefront sections]
        D2 --> D3[Edit Hero, Welcome, etc.]
        D3 --> D4[Save sections to storefront_sections]
        D4 --> D5[Publish Store]
        D5 --> D6[brandname.brandmenow.store]
    end

    A5 --> B1
    B31 --> C1
    C4 --> D1
```

## API Route Map

### Dashboard Routes (`/api/v1/dashboard/`)

| Route | Method | Handler File | Data Source | Writes To | Queue |
|-------|--------|-------------|-------------|-----------|-------|
| `/dashboard/overview` | GET | `server/src/routes/api/v1/dashboard/overview.js` | brands, brand_products, orders | - | - |
| `/dashboard/content` | GET | `server/src/routes/api/v1/dashboard/content.js` | generated_content | - | - |
| `/dashboard/content/generate` | POST | `server/src/routes/api/v1/dashboard/content.js` | brands, wizard_state | generated_content | `content-gen` |
| `/dashboard/analytics` | GET | `server/src/routes/api/v1/dashboard/analytics.js` | brands, brand_analytics | - | - |

### Brand Routes (`/api/v1/brands/`)

| Route | Method | Handler | Data Source | Writes To | Queue |
|-------|--------|---------|-------------|-----------|-------|
| `/brands` | GET | brands controller | brands | - | - |
| `/brands/:id` | GET | brands controller | brands, brand_identities, brand_logos, brand_products, brand_mockups | - | - |
| `/brands` | POST | brands controller | - | brands | - |
| `/brands/:id` | PATCH | brands controller | brands | brands | - |
| `/brands/:id` | DELETE | brands controller | brands | brands (soft delete) | - |
| `/brands/:id/identity` | GET/PATCH | brands controller | brand_identities | brand_identities | - |
| `/brands/:id/logos` | GET | brands controller | brand_logos | - | - |
| `/brands/:id/generate/logos` | POST | brands controller | brands | - | `logo-generation` |
| `/brands/:id/generate/mockups` | POST | brands controller | brands | - | `mockup-generation` |
| `/brands/:id/mockups/:mid` | PATCH | brands controller | brand_mockups | brand_mockups | - |

### Wizard Routes (`/api/v1/wizard/`)

| Route | Method | Handler | Data Source | Writes To | Queue |
|-------|--------|---------|-------------|-----------|-------|
| `/wizard/start` | POST | wizard controller | - | brands, wizard_state | - |
| `/wizard/:brandId/step` | PATCH | wizard controller | wizard_state | wizard_state | Various |
| `/wizard/:brandId/state` | GET | wizard controller | wizard_state | - | - |
| `/wizard/:brandId/resume` | GET | wizard controller | wizard_state | - | - |

### Storefront Routes (`/api/v1/storefronts/`)

| Route | Method | Handler | Data Source | Writes To |
|-------|--------|---------|-------------|-----------|
| `/storefronts` | GET | storefront controller | storefronts | - |
| `/storefronts/:id` | GET | storefront controller | storefronts, storefront_sections | - |
| `/storefronts/:id/sections` | GET/PUT | storefront controller | storefront_sections | storefront_sections |
| `/storefronts/:id/publish` | POST | storefront controller | storefronts | storefronts |
| `/storefronts/:id/testimonials` | GET/POST | storefront controller | storefront_testimonials | storefront_testimonials |
| `/storefronts/:id/faqs` | GET/POST | storefront controller | storefront_faqs | storefront_faqs |

### Auth Routes (`/api/v1/auth/`)

| Route | Method | Handler | Data Source | Writes To |
|-------|--------|---------|-------------|-----------|
| `/auth/me` | GET | auth controller | Supabase Auth, profiles | - |
| `/auth/profile` | PATCH | auth controller | profiles | profiles |

### Payment Routes (`/api/v1/payments/`)

| Route | Method | Handler | Data Source | Writes To |
|-------|--------|---------|-------------|-----------|
| `/payments/checkout` | POST | payments controller | profiles | Stripe session |
| `/payments/portal` | POST | payments controller | profiles | Stripe portal |
| `/payments/webhook` | POST | payments controller | Stripe events | subscriptions, profiles |

## BullMQ Queue and Worker Map

```mermaid
graph LR
    subgraph "Queues (16)"
        Q1[social-analysis]
        Q2[brand-wizard]
        Q3[logo-generation]
        Q4[mockup-generation]
        Q5[content-gen]
        Q6[bundle-composition]
        Q7[video-generation]
        Q8[image-upload]
        Q9[print-export]
        Q10[email-send]
        Q11[email-campaign]
        Q12[crm-sync]
        Q13[analytics]
        Q14[storefront-analytics]
        Q15[storefront-contact]
        Q16[cleanup]
    end

    subgraph "Workers (18)"
        W1[social-analysis-worker.js<br/>Claude Sonnet + Extended Thinking]
        W2[brand-wizard.js<br/>Claude Sonnet]
        W3[logo-generation.js<br/>FLUX.2 Pro / Ideogram v3]
        W4[mockup-generation.js<br/>GPT Image 1.5]
        W5[content-gen-worker.js<br/>Claude Haiku]
        W6[bundle-composition.js<br/>Gemini 3 Pro Image]
        W7[video-generation.js<br/>Veo 3]
        W8[image-upload.js<br/>Supabase Storage]
        W9[print-export.js<br/>PDF/Print generation]
        W10[email-send.js<br/>Resend API]
        W11[email-campaign-worker.js<br/>Resend API]
        W12[crm-sync.js<br/>GoHighLevel API]
        W13[analytics-worker.js<br/>Claude Haiku]
        W14[storefront-analytics.js<br/>Analytics tracking]
        W15[storefront-contact.js<br/>Contact form handler]
        W16[cleanup.js<br/>Old job cleanup]
        W17[dead-letter.js<br/>Failed job handler]
    end

    Q1 --> W1
    Q2 --> W2
    Q3 --> W3
    Q4 --> W4
    Q5 --> W5
    Q6 --> W6
    Q7 --> W7
    Q8 --> W8
    Q9 --> W9
    Q10 --> W10
    Q11 --> W11
    Q12 --> W12
    Q13 --> W13
    Q14 --> W14
    Q15 --> W15
    Q16 --> W16
```

## Socket.io Namespace Map

```mermaid
graph TB
    subgraph "Default Namespace /"
        NS1_R1[Room: user:userId]
        NS1_E1["Events IN: join:job, leave:job"]
        NS1_E2["Events OUT: generation:progress, generation:complete, generation:error"]
    end

    subgraph "/wizard Namespace"
        NS2_R1[Room: user:userId]
        NS2_R2[Room: brand:brandId]
        NS2_R3[Room: job:jobId]
        NS2_E1["Events IN: join:brand, leave:brand, join:job, leave:job"]
        NS2_E2["Events OUT: job:progress, job:complete, job:failed"]
    end

    subgraph "/dashboard Namespace"
        NS3_R1[Room: user:userId]
        NS3_R2[Room: brand:brandId]
        NS3_E1["Events IN: join:brand, leave:brand"]
        NS3_E2["Events OUT: brand:updated, brand:asset:ready"]
    end

    subgraph "/chat Namespace"
        NS4_R1[Room: chat:userId]
        NS4_E1["Events IN: chat:send, chat:cancel, chat:history, chat:new-session"]
        NS4_E2["Events OUT: chat:message-start, chat:message-delta, chat:message-end, chat:error"]
    end

    subgraph "/admin Namespace"
        NS5_R1[Room: admin]
        NS5_E1["Events OUT: job:stats"]
    end
```

## Client State Management

```mermaid
graph TD
    subgraph "Zustand Stores (Client State)"
        S1["auth-store<br/>user, session, isAdmin"]
        S2["brand-store<br/>activeBrand, brands[]"]
        S3["wizard-store<br/>currentStep, formData, rawDossier"]
        S4["ui-store<br/>sidebar, toasts, theme"]
        S5["chat-store<br/>sessions, messages, isOpen"]
    end

    subgraph "TanStack Query (Server State)"
        TQ1["brands query<br/>GET /api/v1/brands"]
        TQ2["brand detail query<br/>GET /api/v1/brands/:id"]
        TQ3["overview query<br/>GET /api/v1/dashboard/overview"]
        TQ4["content query<br/>GET /api/v1/dashboard/content"]
        TQ5["analytics query<br/>GET /api/v1/dashboard/analytics"]
    end

    subgraph "Custom Hooks"
        H1["useActiveBrand<br/>Reads brand-store"]
        H2["useBrandDetail<br/>Wraps TQ2"]
        H3["useGenerationProgress<br/>Socket.io + polling"]
        H4["useChatSocket<br/>Socket.io /chat"]
        H5["useSocket<br/>Connection lifecycle"]
    end

    S1 --> H5
    S2 --> H1
    H1 --> TQ2
    H3 --> |"Socket.io events"| S4
```

## AI Agent Architecture

```mermaid
graph TD
    subgraph "Chat Agent (Anthropic Agent SDK)"
        CA[Chat Agent<br/>Claude Sonnet]
        CA --> T1[brand_lookup tool]
        CA --> T2[update_brand tool]
        CA --> T3[list_products tool]
        CA --> T4[generate_content tool]
        CA --> T5[get_analytics tool]
    end

    subgraph "Skill Subagents"
        SK1[Social Analyzer<br/>Deep social media analysis]
        SK2[Brand Generator<br/>Identity + naming]
        SK3[Logo Creator<br/>Prompt engineering for FLUX/Ideogram]
        SK4[Product Recommender<br/>Product selection + pricing]
        SK5[Mockup Designer<br/>GPT Image prompt crafting]
        SK6[Content Writer<br/>Social media content]
        SK7[Revenue Projector<br/>Financial modeling]
    end

    subgraph "Worker Integration"
        W1[brand-wizard worker<br/>Orchestrates SK1-SK7]
        W2[content-gen worker<br/>Uses SK6]
        W3[analytics worker<br/>Uses SK7]
    end

    CA -->|MCP tools| W1
    W1 --> SK1
    W1 --> SK2
    W1 --> SK3
    W1 --> SK4
    W1 --> SK5
    W2 --> SK6
    W3 --> SK7
```

## Middleware Chain (server/src/app.js)

```
Request
  |
  v
1. CORS (cors) -- Allow app.prznl.com, api.prznl.com origins
  |
  v
2. Security Headers (security-headers.js) -- CSP, HSTS, X-Frame-Options
  |
  v
3. Body Parser (express.json) -- Parse JSON bodies, 10MB limit
  |
  v
4. Request ID (x-request-id header) -- Correlation ID for tracing
  |
  v
5. Request Logger (pino) -- Structured JSON logging
  |
  v
6. Rate Limiter (express-rate-limit + Redis) -- Per-IP rate limiting
  |
  v
7. Stripe Webhook (raw body) -- /api/v1/payments/webhook only
  |
  v
8. Auth Middleware (JWT verification) -- Supabase JWT, attaches req.user
  |
  v
9. Route Handler -- Business logic
  |
  v
10. Error Handler -- Sentry capture + JSON error response
```

## Deployment Pipeline

```mermaid
graph LR
    A[git push main] --> B[GitHub Actions CI]
    B --> C{Lint}
    B --> D{Server Tests}
    B --> E{Client Build}
    C --> F{Docker Build}
    D --> F
    E --> F
    F --> G[Deploy Workflow Triggers]
    G --> H[SSH to DigitalOcean]
    H --> I[git pull on server]
    I --> J[Inject secrets to .env.production]
    J --> K[docker compose build]
    K --> L[docker compose down]
    L --> M[docker compose up -d]
    M --> N[Health check]
```
