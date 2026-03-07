# Brand Me Now v2 -- System Architecture Overview

## High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Browser["Browser (app.prznl.com)"]
        Marketing["Marketing Site (prznl.com)"]
    end

    subgraph "Reverse Proxy"
        Caddy["Caddy HTTPS"]
    end

    subgraph "Application Layer"
        Client["React 19 SPA<br/>Vite 7 / TypeScript"]
        Server["Express 5 API<br/>Node 22 / JavaScript"]
        SocketIO["Socket.io Server<br/>5 Namespaces"]
    end

    subgraph "Background Processing"
        BullMQ["BullMQ<br/>16 Queues"]
        Workers["18 Workers<br/>AI + Image + Email"]
        Cron["Cron Jobs<br/>Abandonment Detection"]
    end

    subgraph "AI Models"
        Claude["Claude Sonnet/Haiku<br/>Anthropic"]
        GPT["GPT Image 1.5<br/>OpenAI"]
        Gemini["Gemini 3 Pro<br/>Google"]
        Flux["FLUX.2 Pro<br/>FAL/BFL"]
        Ideogram["Ideogram v3"]
    end

    subgraph "Data Layer"
        Supabase["Supabase<br/>PostgreSQL 17 + Auth + Storage"]
        Redis["Redis 7<br/>Cache + Queue + Rate Limit"]
    end

    subgraph "External Services"
        Stripe["Stripe<br/>Payments"]
        Resend["Resend<br/>Email"]
        Sentry["Sentry<br/>Errors"]
        PostHog["PostHog<br/>Analytics"]
    end

    Browser --> Caddy
    Marketing --> Caddy
    Caddy --> Client
    Caddy --> Server
    Browser <-->|WebSocket| SocketIO
    Client --> Server
    Server --> Supabase
    Server --> Redis
    Server --> BullMQ
    BullMQ --> Workers
    Workers --> Claude
    Workers --> GPT
    Workers --> Gemini
    Workers --> Flux
    Workers --> Ideogram
    Workers --> Supabase
    Workers --> SocketIO
    Cron --> Supabase
    Server --> Stripe
    Workers --> Resend
    Server --> Sentry
    Client --> PostHog
```

## Domain Model

```mermaid
erDiagram
    USER ||--o{ BRAND : creates
    USER ||--o| PROFILE : has
    USER ||--o| ORGANIZATION : belongs_to
    ORGANIZATION ||--o{ ORG_MEMBER : has

    BRAND ||--o| BRAND_IDENTITY : has
    BRAND ||--o{ BRAND_LOGO : has
    BRAND ||--o{ BRAND_PRODUCT : has
    BRAND ||--o{ BRAND_MOCKUP : has
    BRAND ||--o| STOREFRONT : has
    BRAND ||--o{ GENERATED_CONTENT : produces
    BRAND ||--o| WIZARD_STATE : tracks

    STOREFRONT ||--o{ STOREFRONT_SECTION : contains
    STOREFRONT ||--o{ STOREFRONT_TESTIMONIAL : has
    STOREFRONT ||--o{ STOREFRONT_FAQ : has

    USER ||--o{ CHAT_SESSION : starts
    CHAT_SESSION ||--o{ CHAT_MESSAGE : contains

    USER ||--o| SUBSCRIPTION : has
    SUBSCRIPTION ||--o{ CREDIT_USAGE : tracks
```

## Request Flow (API Call)

```mermaid
sequenceDiagram
    participant B as Browser
    participant C as Caddy
    participant E as Express Server
    participant M as Middleware Chain
    participant R as Route Handler
    participant S as Supabase
    participant Q as BullMQ Queue
    participant W as Worker
    participant IO as Socket.io

    B->>C: HTTPS Request
    C->>E: Proxy to :4847
    E->>M: Request enters middleware

    Note over M: 1. CORS<br/>2. Security Headers<br/>3. Body Parser<br/>4. Rate Limiter<br/>5. JWT Auth<br/>6. Request Logger

    M->>R: Authenticated request
    R->>S: Query/Mutation
    S-->>R: Data

    alt Async work needed
        R->>Q: Queue job
        Q-->>R: Job ID
        R-->>B: { jobId, status: "queued" }
        Q->>W: Process job
        W->>S: Write results
        W->>IO: Emit progress/complete
        IO-->>B: Real-time update
    else Sync response
        R-->>B: { success: true, data: {...} }
    end
```

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 + Vite 7 + TypeScript | SPA dashboard & wizard |
| **Backend** | Express 5 + Node 22 + JSDoc | REST API server |
| **Database** | Supabase (PostgreSQL 17) | Auth, DB, Storage, RLS |
| **Cache/Queue** | Redis 7 | BullMQ, rate limiting, caching |
| **Real-time** | Socket.io | Generation progress, chat |
| **AI Orchestration** | Anthropic Agent SDK | Chat agent with MCP tools |
| **Payments** | Stripe | Subscriptions + credits |
| **Email** | Resend | Transactional email |
| **Hosting** | DigitalOcean Droplet | Docker Compose + Caddy |
| **CI/CD** | GitHub Actions | Lint, test, build, deploy |
| **Monitoring** | Sentry + PostHog | Errors + analytics |
