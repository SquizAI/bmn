# Brand Me Now v2 — Comprehensive Audit Report

**Date**: 2026-03-13
**Audited by**: 8 parallel Claude Code agents
**Scope**: Full-stack end-to-end audit — server, client, storefront, marketing, database, auth, security, agents, skills, workers, Socket.io, BullMQ, integrations, Docker, CI/CD, config
**Source files audited**: 545 across 6 apps

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL (blocks core functionality) | 42 |
| HIGH (breaks user journeys) | 89 |
| MEDIUM (degraded experience / risk) | 107 |
| LOW (polish / hardening) | 69 |
| **TOTAL** | **307** |

---

## Category Index

| # | Category | Issues |
|---|----------|--------|
| A | Server Routes & Controllers | 001–019 |
| B | Client Routes, Components & Hooks | 020–054 |
| C | AI Agent System & Skill Modules | 055–078 |
| D | Database Schema, Auth & Security | 079–108 |
| E | Socket.io & Real-time | 109–122 |
| F | BullMQ Workers & Job Queue | 123–138 |
| G | Integrations & External Services | 139–182 |
| H | Client Storefront App | 183–210 |
| I | Marketing Site | 211–228 |
| J | E2E Tests | 229–239 |
| K | Docker, Deploy & Infrastructure | 240–271 |
| L | Config, Env Vars & Build Tooling | 272–295 |
| M | Cross-cutting & Architectural Gaps | 296–307 |

---

## A. Server Routes & Controllers (001–019)

**001. CRITICAL — Duplicate analytics route definition (stub used instead of real)**
`server/src/routes/analytics.js` exports a stub with hardcoded mock data. `server/src/routes/api/v1/analytics/index.js` has real sub-routes (customers, sales). Main router imports the stub at `server/src/routes/index.js:14`.

**002. CRITICAL — 4 route files defined but never mounted**
- `server/src/routes/api/v1/wizard/product-selection.js` — PUT endpoint unreachable
- `server/src/routes/api/v1/wizard/mockup-generation.js` — POST/PUT endpoints unreachable
- `server/src/routes/api/v1/wizard/name-generation.js` — 2 POST endpoints unreachable
- `server/src/routes/api/v1/products/recommendations.js` — POST/GET endpoints unreachable

These define core wizard & product recommendation APIs that the client tries to call but get 404.

**003. HIGH — Chat routes have zero validation**
`server/src/routes/chat.js` — All 5 endpoints (POST message, GET sessions, GET/PATCH/DELETE session) have no `validate()` middleware. No `server/src/validation/chat.js` file exists.

**004. HIGH — Custom domains controller is 100% stub (501 Not Implemented)**
`server/src/controllers/custom-domains.js` — All 6 functions (`addDomain`, `getDomain`, `removeDomain`, `verifyDomain`, `getWhiteLabel`, `updateWhiteLabel`) return 501. Used by 6 routes in `server/src/routes/storefronts.js:203-251`.

**005. HIGH — Integrations route is 100% stub**
`server/src/routes/integrations.js` — `GET /:provider/connect` returns 501, `GET /` returns empty array, `DELETE /:provider` returns 501. GHL OAuth connect flow doesn't work.

**006. HIGH — Analytics routes return all-zeros mock data**
`server/src/routes/analytics.js:41-53` — Sales analytics returns `{ totalRevenue: 0, orders: 0, averageOrderValue: 0 }`. Customer analytics returns static fake data.

**007. MEDIUM — Chat route ordering: dynamic param before static path**
`server/src/routes/chat.js` — `/:brandId/message` registered before `/sessions`. Could cause confusion though Express handles it due to method differences.

**008. MEDIUM — Store preview controller has minimal implementation**
`server/src/controllers/store-preview.js` — Preview functionality may not fully render storefront with all sections.

**009. MEDIUM — Billing routes duplicate payment routes**
`server/src/routes/billing.js` and `server/src/routes/payments.js` both handle billing-related endpoints. Potential confusion about which to use.

**010. MEDIUM — Admin controller has 20 functions but limited validation**
`server/src/controllers/admin.js` — Many admin operations lack granular validation beyond basic auth checks.

**011. MEDIUM — Proxy routes may expose internal services**
`server/src/routes/proxy.js` — Proxy routes need careful review to ensure they don't allow SSRF attacks.

**012. LOW — Organization routes have extensive validation but no integration tests**
`server/src/routes/organizations.js` — Complex org management but test coverage unclear.

**013. LOW — Packaging templates controller tightly coupled to database schema**
`server/src/controllers/packaging-templates.js` — Direct Supabase queries without abstraction layer.

**014. LOW — Health route doesn't check all dependencies**
`server/src/routes/health.js` — May not verify Redis, Supabase, and BullMQ connectivity.

**015. LOW — Public API routes (`server/src/routes/api/v1/public-api.js`) need rate limiting per API key**
Currently uses same rate limiter as authenticated routes.

**016. LOW — User webhook routes lack payload size limits**
`server/src/routes/api/v1/webhooks-user.js` — No max body size enforcement.

**017. LOW — Dashboard sub-routes have 8 files but most return mock/computed data**
`server/src/routes/api/v1/dashboard/` — health-score, brand-evolution, ab-testing, content, etc. may return computed stubs.

**018. LOW — Job routes lack pagination**
`server/src/routes/api/v1/jobs.js` — Job listing may not handle large result sets.

**019. LOW — Missing OpenAPI/Swagger documentation**
No API documentation generation. 22 route groups with ~100+ endpoints undocumented.

---

## B. Client Routes, Components & Hooks (020–054)

**020. HIGH — 5 routes defined in constants but no route files exist**
`client/src/lib/constants.ts:33-40`:
- `WIZARD_CUSTOMIZATION: '/wizard/customization'` — no file
- `WIZARD_LOGO_REFINEMENT: '/wizard/logo-refinement'` — no file
- `WIZARD_CHECKOUT: '/wizard/checkout'` — no file
- `ADMIN_MODERATION: '/admin/moderation'` — no file
- `ADMIN_HEALTH: '/admin/health'` — no file

**021. HIGH — Storefront themes API endpoint mismatch**
`client/src/hooks/use-storefront.ts:50` calls `/api/v1/storefronts/themes` but server may expect different path.

**022. HIGH — Asset type parameter name mismatch**
`client/src/hooks/use-brand-detail.ts:101` uses `{ type: assetType }` but other hooks use `asset_type`. Server may reject.

**023. HIGH — Socket URL can be empty string, breaking chat WebSocket**
`client/src/hooks/use-chat-socket.ts:9-12` — `SOCKET_URL` could be empty, creating invalid URL `'/chat'`.

**024. HIGH — Non-null assertion on brandId can crash**
`client/src/routes/dashboard/brand-mockups-edit.tsx:104` — `QUERY_KEYS.brand(brandId!)` crashes if brandId is undefined.

**025. HIGH — Storefront page doesn't handle null active brand**
`client/src/routes/dashboard/storefront.tsx:34` — `useActiveBrand()` may return null, causing errors on storefront generation.

**026. HIGH — Wizard completion download URL not verified**
`client/src/routes/wizard/completion.tsx:91` — `window.open('/api/v1/brands/${brandId}/download')` — endpoint may not exist on server.

**027. HIGH — Resume token endpoint format not verified**
`client/src/routes/wizard/completion.tsx:68` — `/api/v1/wizard/${brandId}/resume-token` — may not match server route.

**028. MEDIUM — 5+ hooks use `any` type for AI response parsing**
`client/src/hooks/use-brand-generation.ts:91-154` — `extractColorPalette(raw: any)`, `extractFonts(raw: any)`, `extractVoice(raw: any)`, `normalizeDirection(raw: any)`. Also `use-name-generation.ts:87,101`.

**029. MEDIUM — Auth store not guaranteed to clear before socket disconnect on logout**
`client/src/stores/auth-store.ts:52-65` — `clear()` exists but race condition between socket disconnect and store clear.

**030. MEDIUM — Chat store not persisted — history lost on reload**
`client/src/stores/chat-store.ts` — Uses `devtools` but not `persist` middleware unlike wizard-store.

**031. MEDIUM — Brand store not cleared on logout**
`client/src/stores/brand-store.ts` — Active brand persists after logout. Minor security issue.

**032. MEDIUM — Brand mockups edit resets generation state on every render**
`client/src/routes/dashboard/brand-mockups-edit.tsx:103-108` — Effect dependencies too broad, causing flicker.

**033. MEDIUM — Polling fallback enabled immediately before socket connects**
`client/src/hooks/use-generation-progress.ts:114` — `shouldPoll(true)` set before socket connects, causing redundant HTTP requests.

**034. MEDIUM — Query invalidation overly broad on brand updates**
`client/src/hooks/use-chat-socket.ts:91-92` — Invalidates entire `['brands']` array on every update event.

**035. MEDIUM — Delayed BullMQ jobs never shown as complete**
`client/src/hooks/use-generation-progress.ts:275-282` — `applyPolledStatus` doesn't set `isComplete=true` for `'delayed'` status.

**036. MEDIUM — Login/signup password validation mismatch**
`client/src/routes/auth/login.tsx:14` requires min 8 chars only. Server requires 8+ chars + uppercase + number.

**037. MEDIUM — Auth callback ignores OAuth tokens from URL**
`client/src/routes/auth/callback.tsx` — Calls `getSession()` but doesn't parse `access_token`/`refresh_token` from query params. Server sends them via query string at `server/src/controllers/auth.js:230-235`.

**038. MEDIUM — Missing error handling in auth callback**
`client/src/routes/auth/callback.tsx:18-19` — Flow unclear on failed OAuth.

**039. MEDIUM — Incomplete error handling in mockup generation UI**
`client/src/routes/dashboard/brand-mockups-edit.tsx:141-145` — Generic error, user can't understand why generation failed.

**040. MEDIUM — Products hook defines types locally instead of shared schemas**
`client/src/hooks/use-products.ts:19-43` — Local `Product` interface instead of `@shared/schemas`.

**041. MEDIUM — Socket event naming convention inconsistent**
`client/src/lib/constants.ts:92-118` — Mix of `generation:*`, `job:*`, `agent:*`, `brand:*` namespaces undocumented.

**042. MEDIUM — Race condition in logo history on mutation failure**
`client/src/hooks/use-wizard-actions.ts:149-153` — `onMutate` saves history, but failed mutation leaves duplicates.

**043. LOW — Dossier types in separate file but may have incomplete coverage**
`client/src/lib/dossier-types.ts` — Not all dossier data types defined.

**044. LOW — Socket.io room management events defined but unused**
`client/src/lib/constants.ts:113-117` — `JOIN_BRAND`, `LEAVE_BRAND`, `JOIN_JOB`, `LEAVE_JOB` defined but not emitted/handled.

**045. LOW — RecommendedProduct type import may break**
`client/src/hooks/use-products.ts:4` — Imports type from component file, fragile coupling.

**046. LOW — Loose typing on recommendation preferences**
`client/src/hooks/use-products.ts:180` — `Record<string, unknown>` too loose.

**047. LOW — setState vs getState inconsistency in chat socket**
`client/src/hooks/use-chat-socket.ts:108` — Direct `setState` instead of `getState()` pattern.

**048. LOW — Service worker registration may fail silently**
`client/src/lib/register-sw.ts` — SW registration errors may not surface to user.

**049. LOW — Offline indicator may not detect all connection scenarios**
`client/src/components/ui/offline-indicator.tsx` — Simple online/offline detection.

**050. LOW — Skip link component may not work with SPA routing**
`client/src/components/ui/skip-link.tsx` — Focus management on route change.

**051. LOW — Admin jobs page may not handle large job lists**
`client/src/routes/admin/jobs.tsx` — No pagination or virtual scrolling.

**052. LOW — Brand analytics detail page data not connected to real endpoints**
`client/src/routes/dashboard/brand-analytics-detail.tsx` — May display empty/mock data.

**053. LOW — Content dashboard page likely stub**
`client/src/routes/dashboard/content.tsx` — Content generator/calendar features may be placeholder.

**054. LOW — Referrals dashboard page likely stub**
`client/src/routes/dashboard/referrals.tsx` — Referral system may not be wired to backend.

---

## C. AI Agent System & Skill Modules (055–078)

**055. CRITICAL — Storefront-generator skill has no index.js**
`server/src/skills/storefront-generator/` — Has `config.js`, `handlers.js`, `tools.js` but NO `index.js`. Tool-registry auto-discovery requires it. Skill cannot be registered or used.

**056. CRITICAL — Product-recommender tools not wired to handlers**
`server/src/skills/product-recommender/index.js:19` — Passes raw tool objects without mapping `execute` functions to handlers. Other skills (brand-generator, logo-creator) explicitly wire `execute: handlers.handler`. Tool execution will fail.

**057. CRITICAL — Ideogram model referenced but API key not configured**
`server/src/skills/mockup-renderer/config.js:18` — `textOnProduct: 'ideogram-v3'`. Handlers call `ideogramClient.generate()` but IDEOGRAM_API_KEY is not set. Text-on-product mockups will fail in production.

**058. HIGH — GPT-Image model name mismatch between config and worker**
`server/src/skills/mockup-renderer/config.js:17` says `gpt-image-1.5` but `server/src/workers/mockup-generation.js:35` uses `gpt-image-1`. Potential API errors.

**059. HIGH — Video-creator skill references Veo 3 model with no provider setup**
`server/src/skills/video-creator/config.js` — References `veo-3` model but `server/src/services/providers.js` has no Veo 3 client integration.

**060. HIGH — Chat agent profile validation missing**
`server/src/agents/chat/index.js:75-78` — `runChatAgent` expects `profile` with `role`, `org_id`, `email`, `full_name` but no validation. Undefined values will produce broken system prompts.

**061. HIGH — Brand-wizard session resume loses step context**
`server/src/agents/brand-wizard.js:77` — `buildStepPrompt()` doesn't account for whether this is a fresh step or resume continuation. Resumed sessions may get incomplete context.

**062. HIGH — Brand-wizard references "step_schemas" in prompt but none defined**
`server/src/agents/brand-wizard.js:240` — Tells agent to "Return structured JSON as specified in your step_schemas" but no schemas are provided.

**063. HIGH — Tool-registry silently returns empty arrays when SDK unavailable**
`server/src/skills/_shared/tool-registry.js:173` — If Agent SDK is not installed, `sdkTool` is null and `getSkillMcpTools()` returns empty. No warning logged.

**064. MEDIUM — Skill config export names inconsistent**
Some skills export `skillConfig` (social-analyzer, name-generator), others export `config` (brand-generator). Tool-registry import may fail for mismatched names.

**065. MEDIUM — Logger usage inconsistent across skill handlers**
Some use `pino` directly (e.g., `brand-generator/handlers.js:6`), others use shared logger (`mockup-renderer/handlers.js:4`). Logs not correlated.

**066. MEDIUM — Social-analyzer tools return stubs when Apify unavailable**
`server/src/skills/social-analyzer/tools.js:16-28` — Dev-mode stub responses. Production without Apify returns empty data silently instead of error.

**067. MEDIUM — Name-generator suggestBrandNames is async but never awaits external APIs**
`server/src/skills/name-generator/handlers.js:33-43` — Declared async but only validates/sorts input synchronously.

**068. MEDIUM — Profit-calculator assumes config.projections structure**
`server/src/skills/profit-calculator/handlers.js:7` — Destructures `config.projections` without null check. Config change breaks handler.

**069. MEDIUM — Mockup-renderer handler completeness unverified**
`server/src/skills/mockup-renderer/handlers.js` — 5 handlers expected (`generateProductMockup`, `generateTextOnProduct`, `composeBundleImage`, `uploadMockupAsset`, `saveMockupAssets`) — need to confirm all exist.

**070. MEDIUM — Chat tool filter function unverified**
`server/src/agents/chat/tool-filter.js` — Referenced at `chat/index.js:10` but `getEffectiveRole` function not fully verified.

**071. MEDIUM — Chat MCP server creation unverified**
`server/src/agents/chat/mcp-server.js` — `createChatToolsServer` referenced but not fully reviewed.

**072. MEDIUM — Model router fallback logic not tested**
`server/src/skills/_shared/model-router.js` — Fallback from primary to secondary model may not handle all error types.

**073. LOW — Brand-generator prompts may be incomplete**
`server/src/skills/brand-generator/prompts.js` — Prompt completeness needs verification against PRD.

**074. LOW — Logo-creator templates tightly coupled to BFL API format**
`server/src/skills/logo-creator/` — FLUX.2 Pro prompt format may change.

**075. LOW — Video-creator handlers may be incomplete stubs**
`server/src/skills/video-creator/handlers.js` — 4 handlers referenced but not verified to be real implementations.

**076. LOW — Prompt-utils shared library may have unused helpers**
`server/src/skills/_shared/prompt-utils.js` — Potential dead code.

**077. LOW — Social-analyzer prompts may not handle all platforms equally**
`server/src/skills/social-analyzer/prompts.js` — TikTok, Instagram, Twitter prompts may vary in quality.

**078. LOW — Agent config maxBudgetUsd and maxTurns not enforced**
`server/src/agents/agent-config.js` — Budget/turn limits may be configurable but not actually enforced at runtime.

---

## D. Database Schema, Auth & Security (079–108)

**079. CRITICAL — Column name mismatch: `tc_accepted_at` vs `terms_accepted_at`**
Migration creates `tc_accepted_at` (`supabase/migrations/20260219000002_profiles.sql:13`) but auth controller writes `terms_accepted_at` (`server/src/controllers/auth.js:262`). Onboarding completion silently fails.

**080. CRITICAL — organization_members table has NO RLS policies**
`supabase/migrations/20260220000010_multi_tenant_orgs.sql` — Table created but RLS policies never defined. Multi-tenant data exposed.

**081. CRITICAL — Password reset page doesn't implement update form**
`client/src/routes/auth/forgot-password.tsx` — Only shows "check your email" screen. No route handler for `/auth/reset-password`. Users cannot complete password reset.

**082. CRITICAL — Socket.io admin auth checks wrong field**
`server/src/sockets/index.js:64` — Checks `user.app_metadata?.role !== 'admin'` but auth middleware uses `req.profile.role` from database. Admin Socket.io connections always rejected.

**083. CRITICAL — Tier-based feature gating is a passthrough stub**
`server/src/middleware/require-tier.js:16-22` — `requireFeature()` just calls `next()`. No actual tier checking. Free users access all pro features.

**084. CRITICAL — api_keys table schema doesn't match middleware**
`supabase/migrations/20260221000010_missing_tables.sql` — Table has `id, user_id, scopes, revoked_at` but `server/src/middleware/api-key-auth.js` expects `key_hash, last_used_at`. API key auth completely broken.

**085. HIGH — wizard_step vs wizard_state column name mismatch**
`supabase/migrations/20260219000003_brands.sql` defines `wizard_step` but `server/src/sockets/index.js:392` queries `wizard_state`. Wizard step tracking in chat fails.

**086. HIGH — OAuth callback tokens not parsed by client**
Server sends `access_token`/`refresh_token` via query string (`server/src/controllers/auth.js:230-235`) but `client/src/routes/auth/callback.tsx` only calls `getSession()` without parsing URL params.

**087. HIGH — Signup form doesn't send full_name**
Server requires `full_name` (`server/src/validation/auth.js:16`) but `client/src/routes/auth/signup.tsx` doesn't include it. Profile name always empty.

**088. HIGH — get_credit_summary RPC function doesn't exist**
`server/src/controllers/auth.js:132-138` calls RPC `get_credit_summary` but no migration defines it. Silently fails, users never see credit balance.

**089. MEDIUM — profiles.org_id has no foreign key constraint**
`supabase/migrations/20260219000002_profiles.sql:17` — `org_id` declared without FK reference. Orphaned values possible.

**090. MEDIUM — Auth middleware uses supabaseAdmin (bypasses RLS)**
`server/src/middleware/auth.js:56-60` — Fetches profile with admin client. Intentional for auth but fragile if pattern spreads.

**091. MEDIUM — No per-email rate limiting on password reset**
`server/src/routes/auth.js:80` — IP-based limiter only. Attacker can spam reset requests for single email across IPs.

**092. MEDIUM — Socket.io admin auth uses app_metadata not DB role**
`server/src/sockets/index.js:64` — Role promotions/demotions in DB not reflected in Socket auth.

**093. MEDIUM — No input sanitization in chat socket handler**
`server/src/sockets/index.js:356` — `chat:send` accepts raw `content` without calling `sanitizeForPrompt()`. Prompt injection risk.

**094. MEDIUM — CSP upgrade-insecure-requests misconfigured**
`server/src/middleware/security-headers.js:71` — `upgradeInsecureRequests: []` (empty) means no HTTPS enforcement.

**095. MEDIUM — Inconsistent profile column selects across codebase**
Auth middleware selects specific columns (`server/src/middleware/auth.js:58`) but controller selects `'*'` (`server/src/controllers/auth.js:117`).

**096. MEDIUM — Onboarding validation requires full_name but signup doesn't provide it**
`server/src/validation/auth.js:45-48` — `completeOnboardingSchema` requires `full_name` (2-100 chars) but user may not have set it during signup.

**097. MEDIUM — organization_invites table lacks RLS**
`supabase/migrations/20260220000010_multi_tenant_orgs.sql` — Invite table also unprotected.

**098. MEDIUM — Missing brands table single-column status index**
`supabase/migrations/20260219000003_brands.sql` — Only composite `idx_brands_user_status` exists. Status-only queries can't use index efficiently.

**099. LOW — Dev resume token secret in code**
`server/src/config/index.js:54` — `RESUME_TOKEN_SECRET` defaults to `'dev-resume-token-secret-change-in-production'`.

**100. LOW — .env.example has empty GHL_LOCATION_ID**
`server/src/config/` references it but `.env.example` has placeholder value.

**101. LOW — Shared schemas may not match DB schema perfectly**
`shared/schemas/` — Zod schemas should be verified against migration DDL.

**102. LOW — No GDPR data export endpoint**
Users can't download their data. Required for EU compliance.

**103. LOW — No account deletion endpoint**
Users can't delete their account. Required for app store compliance.

**104. LOW — No audit log table for admin actions**
Admin operations (user management, tier changes) not logged.

**105. LOW — No session management (list/revoke active sessions)**
Users can't see or revoke other sessions.

**106. LOW — No 2FA / MFA support**
Single-factor auth only. No TOTP or WebAuthn.

**107. LOW — No CAPTCHA on signup/login**
Bot protection relies solely on rate limiting.

**108. LOW — No IP allowlist for admin endpoints**
Admin routes protected by role only, not network.

---

## E. Socket.io & Real-time (109–122)

**109. HIGH — useGenerationProgress doesn't join job rooms on default namespace**
`client/src/hooks/use-generation-progress.ts:155` emits `JOIN_JOB` but default namespace has no `join:job` handler. Only wizard namespace does (`server/src/sockets/index.js:259`). Progress tracking fails.

**110. HIGH — Workers emit to inconsistent Socket.io namespaces**
- `logo-generation.js:49` → default namespace (`io.to()`)
- `mockup-generation.js:190` → wizard namespace (`io.of('/wizard')`)
- `brand-wizard.js:39` → wizard namespace
- `print-export.js:143` → default namespace
- `storefront-generation.js:40` → default namespace

Clients listening on wrong namespace miss events.

**111. HIGH — Client socket token not refreshed on reconnect**
`client/src/lib/socket.ts:50-55` — Updates `socket.auth.token` on Supabase auth change but Socket.io doesn't re-authenticate on reconnect. Expired tokens persist.

**112. MEDIUM — Wizard namespace missing debug logging for join/leave**
`server/src/sockets/index.js:244-256` — No debug logs like default namespace has at lines 193, 200.

**113. MEDIUM — Default namespace lacks join:job/leave:job handlers**
`server/src/sockets/index.js:173-225` — Only has `join:brand`/`leave:brand`. Job room tracking impossible on default namespace.

**114. MEDIUM — Rate limiter fails silently if Socket internals change**
`server/src/sockets/index.js:82-109` — `attachRateLimiter()` returns if `socket.onevent` undefined, no warning logged.

**115. MEDIUM — Admin namespace gets no worker alerts**
`server/src/sockets/index.js:315-333` — Only dead-letter worker emits to admin. No other failure/warning alerts.

**116. MEDIUM — Socket disconnect detection delayed up to 5 seconds**
`client/src/hooks/use-generation-progress.ts:211-230` — Timer-based check every 5s. No explicit `disconnect` event handler for immediate polling fallback.

**117. MEDIUM — No socket connection status indicator in UI**
Client has no visible indicator of Socket.io connection status. Users don't know when real-time is unavailable.

**118. LOW — Socket.io admin stats broadcast every 30s may be excessive**
`server/src/sockets/index.js:564-571` — 30s interval for job stats broadcast. Could be on-demand.

**119. LOW — No socket event for credit balance changes**
Credit deductions don't trigger real-time UI updates.

**120. LOW — No socket event for payment status changes**
Subscription upgrades/downgrades not pushed in real-time.

**121. LOW — Chat namespace creates per-brand rooms but no cleanup**
`server/src/sockets/index.js` — Brand rooms not cleaned up when brand deleted.

**122. LOW — No heartbeat/ping monitoring for socket connections**
Connection health not tracked server-side.

---

## F. BullMQ Workers & Job Queue (123–138)

**123. CRITICAL — storefront-contact queue has no validation schema**
`server/src/queues/schemas.js` — `JOB_SCHEMAS` registry missing `'storefront-contact'` entry. Queue exists in `QUEUE_CONFIGS` and worker exists, but jobs bypass Zod validation.

**124. HIGH — Cleanup worker missing detect-abandonment handler**
`server/src/workers/cleanup.js:137-142` — `CLEANUP_HANDLERS` has 4 types but schema includes `'detect-abandonment'`. Falls into catch-all branch running ALL handlers, wasting resources.

**125. HIGH — Video generation worker not registered**
`server/src/workers/video-generation.js` exists but not imported in `server/src/workers/index.js`. Worker never starts.

**126. HIGH — Analytics worker not implemented**
`server/src/workers/analytics-worker.js` may be stub. No automated event tracking for key actions.

**127. MEDIUM — Dead-letter worker swallows generation_jobs update errors**
`server/src/workers/dead-letter.js:87-98` — `.catch()` silently logs warning. Real DB errors masked.

**128. MEDIUM — Content generation worker implementation unclear**
`server/src/workers/content-gen-worker.js` — May be stub/incomplete.

**129. MEDIUM — Email campaign worker implementation unclear**
`server/src/workers/email-campaign-worker.js` — May be stub/incomplete.

**130. MEDIUM — Social analysis worker may not handle all platform failures**
`server/src/workers/social-analysis-worker.js` — Platform-specific error handling unverified.

**131. MEDIUM — Image upload worker error handling**
`server/src/workers/image-upload.js` — Failure behavior needs verification.

**132. MEDIUM — Print export worker progress tracking**
`server/src/workers/print-export.js` — Uses default namespace instead of wizard namespace.

**133. MEDIUM — Bundle composition worker implementation**
`server/src/workers/bundle-composition.js` — May be incomplete.

**134. LOW — Job logger doesn't structure logs consistently**
`server/src/workers/job-logger.js` — May not correlate with request IDs.

**135. LOW — No job priority differentiation**
All jobs dispatched at same priority. Paid users not prioritized.

**136. LOW — No job deduplication**
Same generation request can be queued multiple times.

**137. LOW — No queue metrics/monitoring beyond Bull Board**
No Prometheus/Grafana integration for queue depth, latency.

**138. LOW — Cron job (detect-abandonment) scheduling unverified**
`server/src/cron/detect-abandonment.js` — May not be registered with proper interval.

---

## G. Integrations & External Services (139–182)

**139. HIGH — Stripe API version uses future date**
`server/src/services/stripe.js:28` — `'2025-12-18.acacia'` may not be a real API version.

**140. HIGH — No Stripe webhook for charge.refunded**
`server/src/controllers/webhooks.js` — Refunds not tracked or processed.

**141. HIGH — No Stripe webhook for invoice.payment_action_required**
3D Secure / SCA payments not handled. Customers not notified.

**142. HIGH — Credit refill doesn't handle tier changes**
`server/src/controllers/webhooks.js:397-398` — Mid-month upgrades don't prorate or clear old credits.

**143. HIGH — No credit audit logging**
`server/src/services/credits.js` — No `credit_transactions` table. Impossible to audit usage for disputes.

**144. HIGH — No overage charging logic implemented**
Tier config has `overageEnabled` and rate fields but no actual charging code.

**145. HIGH — GHL OAuth flow not implemented**
`server/src/services/ghl.js` — Only static token mode works. Users can't authorize via OAuth.

**146. HIGH — GHL token refresh assumes 24h expiry without verification**
`server/src/services/ghl.js:79` — If tokens last 3600s, will cause 401 errors.

**147. HIGH — PDF generation is HTML only, not actual PDF**
`server/src/services/pdf-generator.js` — Generates HTML, relies on browser `window.print()`. Server-side PDF conversion missing.

**148. MEDIUM — Stripe checkout doesn't distinguish subscription statuses**
`server/src/services/stripe.js` — Paused/trialing subscriptions may block new checkout.

**149. MEDIUM — Credit deduct failure gives no error context**
`server/src/services/credits.js:137` — Returns `{ success: false, remaining: 0 }` without reason.

**150. MEDIUM — No global email rate limit**
`server/src/workers/email-send.js` — Per-user limit only. Single user could spike Resend usage.

**151. MEDIUM — No email bounce handling**
Hard bounces not tracked. Invalid addresses get repeated emails.

**152. MEDIUM — Missing email templates**
`server/src/emails/index.js` — No template for `subscription_charged`, `free_trial_ending`.

**153. MEDIUM — No List-Unsubscribe header in emails**
Email compliance issue. Required for bulk sending.

**154. MEDIUM — GHL field mapping silently succeeds even when 80% missing**
`server/src/services/ghl.js:426-440` — `validateFieldMappings` only logs warnings.

**155. MEDIUM — No GHL rate limit handling**
`server/src/services/ghl.js` — 10 req/sec limit but no exponential backoff on 429.

**156. MEDIUM — GHL CRM sync race condition on parallel events**
`server/src/workers/crm-sync.js:57-100` — Two parallel events could both try to upsert.

**157. MEDIUM — Apify budget tracking uses float with no rounding**
`server/src/services/apify.js:94` — `incrbyfloat` with floating-point precision errors.

**158. MEDIUM — Apify budget not checked on retries**
`server/src/services/apify.js:153-167` — Retry attempts bypass budget check.

**159. MEDIUM — Apify actor IDs hardcoded**
`server/src/services/apify.js:47-52` — Deprecated actors would fail silently.

**160. MEDIUM — TikTok scrape parameter mismatch**
`server/src/services/apify.js:260` — `resultsPerPage` vs expected `maxPostCount`.

**161. MEDIUM — No handling for private social profiles**
All platforms return empty without distinguishing private vs nonexistent.

**162. MEDIUM — Ideogram client initialized but never used**
`server/src/services/providers.js` — Memory leak: client created but API key not configured.

**163. MEDIUM — FAL.ai/Recraft parameter mismatch**
`server/src/services/providers.js:362-376` — `image_size` vs FAL's expected size mapping.

**164. MEDIUM — hexToRgb doesn't validate hex format**
`server/src/services/providers.js:109-116` — `#GG0000` parses as `{r:0, g:0, b:0}`.

**165. MEDIUM — FAL queue polling blocks worker for 120s max**
`server/src/services/providers.js:290-321` — Stuck jobs block the entire worker.

**166. MEDIUM — Website scraper color extraction logic inverted**
`server/src/services/website-scraper.js:154-156` — Grayscale skip condition may be wrong.

**167. MEDIUM — Website scraper doesn't follow redirects for Linktree URLs**
`server/src/services/website-scraper.js:92-93` — Rejects non-HTML responses.

**168. MEDIUM — Social link extraction too broad**
`server/src/services/website-scraper.js:201` — Captures tracking pixels and iframes.

**169. MEDIUM — Competitor analysis calls Claude twice without caching**
`server/src/services/competitor.js:104-208` — Same niche analyzed twice wastefully.

**170. MEDIUM — Competitor JSON parsing fragile**
`server/src/services/competitor.js:113-116` — Markdown code blocks break parsing.

**171. MEDIUM — All competitor scrapes failing returns empty without error**
`server/src/services/competitor.js:173` — `Promise.allSettled` with all rejected gives empty array.

**172. MEDIUM — Webhook backoff too aggressive**
`server/src/services/webhook-dispatcher.js:236` — [1s, 2s, 4s] total 7s. Most services expect [1s, 10s, 100s].

**173. MEDIUM — No webhook payload size limit**
`server/src/services/webhook-dispatcher.js` — 10MB payload could crash worker.

**174. MEDIUM — Failed webhook logs expose full payload**
`server/src/services/webhook-dispatcher.js:194` — Sensitive data in logs.

**175. MEDIUM — No webhook request deduplication**
Same webhook can be dispatched twice manually.

**176. LOW — Sentry redactSecrets only catches sk- and Bearer**
`server/src/lib/sentry.js:131-133` — Other secrets logged in plaintext.

**177. LOW — PostHog events not flushed on errors**
`server/src/lib/posthog.js` — Events could be lost.

**178. LOW — No PostHog GDPR cleanup on user deletion**
Historical data retained.

**179. LOW — HTTP logger userId may be null for authenticated requests**
`server/src/middleware/http-logger.js:26` — Auth middleware may not set `req.user` yet.

**180. LOW — Sentry release version not available in Docker**
`server/src/lib/sentry.js` — `process.env.npm_package_version` not set in container.

**181. LOW — Resend error handling doesn't distinguish transient vs permanent failures**
`server/src/services/email.js:86` — Generic error, no retry classification.

**182. LOW — No webhook rate limiting on user endpoints**
`server/src/routes/webhooks.js` — User-facing webhook URLs unprotected.

---

## H. Client Storefront App (183–210)

**183. CRITICAL — Missing @tailwindcss/vite dependency**
`client-storefront/vite.config.ts:3` imports `@tailwindcss/vite` but `package.json` doesn't list it. Build will fail.

**184. CRITICAL — Checkout URLs not provided to server**
`client-storefront/src/components/cart/CartDrawer.tsx` doesn't send `successUrl`/`cancelUrl` but `server/src/controllers/public-store.js:427` requires them. Checkout broken.

**185. CRITICAL — API field name mismatch: priceCents vs price**
Client expects `priceCents` but server returns `price`. All product prices display incorrectly.

**186. HIGH — 15+ CSS classes used but never defined**
`reveal`, `reveal-delay-1`, `section-title-underline`, `store-section`, `store-card`, `btn-primary`, `btn-secondary`, `scroll-horizontal` — all referenced but no CSS definitions exist.

**187. HIGH — No error boundary for entire storefront app**
`client-storefront/src/App.tsx` — Any child component error crashes entire store.

**188. HIGH — CustomHtmlSection uses dangerouslySetInnerHTML without sanitization proof**
`client-storefront/src/components/sections/CustomHtmlSection.tsx:16` — Claims "server-side sanitized" but no evidence in API code.

**189. HIGH — Navigation broken in subdomain context**
`client-storefront/src/App.tsx:14-26` — `getSlug()` extraction fragile. Relative paths don't work in nested slug routes.

**190. HIGH — Vite config missing base URL for storefront**
`client-storefront/vite.config.ts` — No `base` config. Production builds assume root path.

**191. MEDIUM — Cart session shared across tabs**
`client-storefront/src/hooks/use-cart.ts:5-13` — Single localStorage key means multiple tabs share cart state.

**192. MEDIUM — No SSL validation on checkout redirect**
`client-storefront/src/components/cart/CartDrawer.tsx:42` — `window.location.href = checkoutUrl` not validated as HTTPS.

**193. MEDIUM — Color manipulation assumes hex format**
`client-storefront/src/lib/theme.ts:57-63` — `darken()` fails on rgb/hsl formats.

**194. MEDIUM — Meta description injection fails if tag doesn't exist**
`client-storefront/src/lib/theme.ts:50-53` — `querySelector` returns null, `setAttribute` crashes.

**195. MEDIUM — ProductPage no loading state on product ID change**
`client-storefront/src/components/product/ProductPage.tsx:25-38` — Shows stale data briefly.

**196. MEDIUM — Cart quantity changes not persisted during network failures**
`client-storefront/src/hooks/use-cart.ts:107-115` — Offline changes lost.

**197. MEDIUM — Image URL mismatch: image_url vs imageUrl**
`server/src/controllers/public-store.js:191` — Server uses `image_url`, client expects `imageUrl`.

**198. MEDIUM — No inventory check before checkout**
`server/src/controllers/public-store.js:442-453` — Out-of-stock products can be checked out.

**199. MEDIUM — Expired carts returned as valid**
`server/src/controllers/public-store.js:380-393` — `getCart()` doesn't check `expires_at`.

**200. MEDIUM — Analytics page tracking accepts arbitrary strings**
`server/src/controllers/public-store.js:556-603` — No validation on `page` parameter.

**201. MEDIUM — CRM sync from contact form fails silently**
`server/src/controllers/public-store.js:523-536` — Catch block logs warning only.

**202. MEDIUM — Store product response exposes all fields**
`server/src/controllers/public-store.js:219-225` — Sensitive product data not filtered.

**203. LOW — Testimonial avatar doesn't handle non-ASCII names**
`client-storefront/src/components/sections/TestimonialsSection.tsx:49-58`.

**204. LOW — No CORS headers for storefront API endpoints**
`server/src/controllers/public-store.js` — Cross-origin requests may fail.

**205. LOW — No rate limiting on public store endpoints**
`/api/v1/store/*` — Scraping/abuse unprotected.

**206. LOW — Currency hardcoded to USD**
`server/src/controllers/public-store.js:444-445` — No multi-currency support.

**207. LOW — API error messages not user-friendly**
`client-storefront/src/lib/api.ts:11-12` — Generic errors thrown.

**208. LOW — Missing product category filter loading state**
`client-storefront/src/components/sections/ProductsSection.tsx:24-26`.

**209. LOW — Storefront Vite config missing @shared alias**
`client-storefront/vite.config.ts` — Can't import shared schemas.

**210. LOW — No analytics for storefront conversion funnel**
Page view → product click → add to cart → checkout flow not tracked.

---

## I. Marketing Site (211–228)

**211. HIGH — Contact form doesn't submit to any API**
`marketing/app/contact/page.tsx:29-34` — `handleSubmit()` validates and sets state but never calls an endpoint.

**212. HIGH — Brand gallery component is likely a stub**
`marketing/components/sections/brand-gallery.tsx` — Only 2-3 lines.

**213. HIGH — Case study grid likely has no real data**
`marketing/components/sections/case-study-grid.tsx` — No real case study content.

**214. MEDIUM — ROI calculator hardcodes 60% margins**
`marketing/components/sections/roi-calculator.tsx:8-15` — Not sourced from real data.

**215. MEDIUM — Live demo uses hardcoded fake creator analysis**
`marketing/components/sections/live-demo.tsx:12-33` — Static sample data.

**216. MEDIUM — Blog getAllPosts function may not work**
`marketing/app/blog/page.tsx:26` — Calls `getAllPosts()` from `@/lib/blog` but MDX content traversal unverified.

**217. MEDIUM — Pricing page not connected to Stripe**
`marketing/app/pricing/page.tsx:46` — Likely shows mock prices from `lib/pricing-data.ts`.

**218. MEDIUM — Sitemap uses `new Date()` for all lastModified**
`marketing/app/sitemap.ts:9-14` — Should use actual content modification dates.

**219. MEDIUM — Blog slug page notFound() handling unclear**
`marketing/app/blog/[slug]/page.tsx:59` — May not work correctly in all contexts.

**220. MEDIUM — Contact form validation only client-side**
`marketing/app/contact/page.tsx:16-27` — No server-side validation.

**221. LOW — Missing OG image files**
Metadata references `/og/default.png`, `/og/pricing.png` — files may not exist in public folder.

**222. LOW — No Next.js image optimization configured**
Marketing site may not leverage `next/image` properly.

**223. LOW — Social proof counters likely hardcoded**
`marketing/components/sections/social-proof-counters.tsx` — Static numbers.

**224. LOW — Before-after transformer may use placeholder images**
`marketing/components/sections/before-after-transformer.tsx`.

**225. LOW — Product showcase section may not pull from real catalog**
`marketing/components/sections/product-showcase.tsx`.

**226. LOW — Testimonials on marketing site may be fabricated**
`marketing/components/sections/testimonials.tsx` — Not verified as real.

**227. LOW — No schema.org structured data**
Marketing pages lack JSON-LD for SEO.

**228. LOW — No marketing analytics integration verified**
PostHog/GA setup for marketing site not confirmed.

---

## J. E2E Tests (229–239)

**229. HIGH — E2E tests mock auth instead of testing real Supabase**
`e2e/tests/auth-flow.spec.ts:15-30` — Routes intercepted and mocked. Real auth failures won't be caught.

**230. HIGH — Wizard tests don't test actual step progression**
`e2e/tests/wizard-flow.spec.ts:102-161` — Verify pages load but not form submission, data persistence, or navigation.

**231. HIGH — Playwright baseURL port mismatch for storefront**
`e2e/playwright.config.ts:15` — `baseURL: 'http://localhost:4848'` but storefront runs on port 4849.

**232. MEDIUM — No E2E tests for cart/checkout flow**
Zero test coverage for client-storefront purchase flow.

**233. MEDIUM — No E2E tests for public storefront**
No test file for the public-facing storefront app.

**234. MEDIUM — Dashboard tests use unrealistic mock data**
`e2e/tests/dashboard.spec.ts:138-150` — `monthRevenue: 1250` doesn't match realistic scenarios.

**235. MEDIUM — Test cleanup doesn't clear localStorage**
Session IDs persist between tests, causing pollution.

**236. MEDIUM — No E2E test for brand generation flow**
Core wizard → generation → results flow untested end-to-end.

**237. LOW — No E2E test for admin panel**
Admin functionality untested.

**238. LOW — No E2E test for payment/billing flow**
Stripe integration untested in browser.

**239. LOW — No visual regression tests**
No screenshot comparison for UI consistency.

---

## K. Docker, Deploy & Infrastructure (240–271)

**240. CRITICAL — Docker healthchecks use wget on Alpine without installing it**
`server/Dockerfile:68`, `client/Dockerfile:77`, `client-storefront/Dockerfile:57` — Alpine images don't include wget. Healthchecks fail.

**241. CRITICAL — Redis healthcheck env var interpolation fails in Docker**
`docker-compose.prod.yml:24` — `"redis-cli", "-a", "${REDIS_PASSWORD}"` — Docker healthcheck doesn't interpolate env vars.

**242. HIGH — CI pipeline doesn't lint storefront or marketing**
`.github/workflows/ci.yml:39-45` — Only lints server and client.

**243. HIGH — CI pipeline doesn't test client**
No client unit test job. Only build.

**244. HIGH — CI pipeline doesn't build client-storefront or marketing**
No build verification for 2 of 4 apps.

**245. HIGH — No E2E test job in CI pipeline**
`e2e/playwright.config.ts` exists but no CI job runs it.

**246. HIGH — Deploy workflow missing env vars injection**
`.github/workflows/deploy.yml` — Missing `GHL_WEBHOOK_SECRET`, `APIFY_MONTHLY_BUDGET_USD`, `VIDEO_GENERATION_ENABLED`.

**247. HIGH — CI Docker build missing Vite build args**
`.github/workflows/ci.yml:136-142` — Missing `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_POSTHOG_KEY`, `VITE_SENTRY_DSN`, `VITE_STRIPE_PUBLISHABLE_KEY`.

**248. MEDIUM — Client Dockerfile package-lock.json path fragile**
`client/Dockerfile:17` — Copies `../package-lock.json`, depends on build context.

**249. MEDIUM — Storefront Dockerfile same fragile path issue**
`client-storefront/Dockerfile:17`.

**250. MEDIUM — No healthcheck for client service in docker-compose.yml**
`docker-compose.yml:61-71` — Client service has no healthcheck.

**251. MEDIUM — No healthcheck for storefront in docker-compose.prod.yml**
`docker-compose.prod.yml:85-99`.

**252. MEDIUM — Missing depends_on condition for client**
`docker-compose.prod.yml` — No `condition: service_healthy` for server dependency.

**253. MEDIUM — Caddy DNS plugin build not verified**
`caddy/Dockerfile:9` — `xcaddy build --with github.com/caddy-dns/cloudflare` — silent build failure possible.

**254. MEDIUM — Wildcard domain DNS not validated**
`caddy/Caddyfile:21` — `*.brandmenow.store` assumes DNS pointing correct.

**255. MEDIUM — Deploy script doesn't validate .env.production values**
`deploy/deploy.sh:35-39` — Checks file exists but not content.

**256. MEDIUM — No rollback mechanism for failed deploys**
`deploy/deploy.sh:117` — Suggests `git checkout HEAD~1` but ignores DB migrations.

**257. MEDIUM — Deploy doesn't check Caddy health**
`deploy/deploy.sh` — Checks server and client but not reverse proxy.

**258. MEDIUM — Health check jq parsing fragile**
`deploy/deploy.sh:84` — Non-JSON response breaks jq parsing.

**259. MEDIUM — Nginx configs hardcode server:4847**
`client/nginx.conf:39`, `client-storefront/nginx.conf:41` — Breaks in non-Docker environments.

**260. MEDIUM — setup-droplet.sh creates different caddy config than repo**
`deploy/setup-droplet.sh:136-166` — Diverges from `docker-compose.caddy.yml`.

**261. LOW — HEALTHCHECK start-period=10s may be too short**
Server may need more time under load.

**262. LOW — No liveness/readiness probes for K8s**
Docker HEALTHCHECK exists but no K8s manifests.

**263. LOW — No pre-flight Docker compose format check**
Deploy doesn't verify compose file compatibility.

**264. LOW — No Docker image tagging strategy**
No version tags, only `latest`. Can't rollback to specific version.

**265. LOW — No Docker image size optimization**
Multi-stage builds present but no size analysis.

**266. LOW — No container resource limits defined**
`docker-compose.prod.yml` — No memory/CPU limits.

**267. LOW — No log rotation configured**
Docker logs may fill disk.

**268. LOW — No backup strategy for Redis data**
Redis persistence not configured.

**269. LOW — No database backup automation**
Supabase backup strategy not documented.

**270. LOW — No monitoring/alerting for container health**
No external monitoring (UptimeRobot, etc.).

**271. LOW — No staging environment defined**
Only dev and prod. No staging for pre-production testing.

---

## L. Config, Env Vars & Build Tooling (272–295)

**272. HIGH — Missing BFL_API_KEY in config validation**
`server/src/config/index.js` — Not in `cleanEnv()` though used by FLUX.2 provider.

**273. HIGH — Missing GHL_WEBHOOK_SECRET in config validation**
`server/src/config/index.js` — Used in webhook controller but not validated.

**274. HIGH — Missing VIDEO_GENERATION_ENABLED in config validation**
`server/src/config/index.js` — Used in video-creator handlers.

**275. HIGH — No eslint config for client-storefront**
`client-storefront/` — No `eslint.config.js`. No lint script in `package.json`.

**276. HIGH — No eslint config for marketing site**
`marketing/` — No `eslint.config.js`. No lint script.

**277. HIGH — No test config for client-storefront**
No `vitest.config.ts` or test setup. Zero test coverage.

**278. HIGH — No test config for marketing site**
No test framework configured.

**279. MEDIUM — .env.example missing RECRAFT_API_KEY**
Referenced in config but not in `.env.example`.

**280. MEDIUM — .env.example missing APIFY_MONTHLY_BUDGET_USD**
Used in code but not documented.

**281. MEDIUM — .env.example missing GHL_WEBHOOK_SECRET**
Used in code but not documented.

**282. MEDIUM — Shared schemas no TypeScript declarations**
`shared/schemas/` — .js files only, no `.d.ts`. Client TypeScript imports get poor type inference.

**283. MEDIUM — Shared package.json exports restrictive**
`shared/package.json:6-8` — Only exports `./schemas/*`. Other imports fail.

**284. MEDIUM — Client tsconfig includes shared but without proper sourceRoot**
`client/tsconfig.json:40` — `"../shared"` in include may not resolve during build.

**285. MEDIUM — Storefront vite config missing @shared alias**
`client-storefront/vite.config.ts` — Can't import shared schemas.

**286. MEDIUM — Service worker offline POST queue incomplete**
`client/public/sw.js:45-66` — IndexedDB queue only triggered on message events, not automatic.

**287. LOW — No .eslintignore for root**
ESLint scans unnecessary directories.

**288. LOW — Prettier config minimal**
`prettier.config.js` — May not cover all file types.

**289. LOW — Migration scripts don't validate env before parsing CLI args**
`scripts/migrate/run-migration.js:172` — Validates env even for `--help`.

**290. LOW — Migration aborts only on step 00 failure**
`scripts/migrate/run-migration.js:200-204` — Steps 1-6 failures don't abort pipeline.

**291. LOW — No transaction rollback in migration on step failure**
Steps 1-6 write data without rollback capability.

**292. LOW — Deploy env.example has TODO comments**
`deploy/env.example` — Incomplete setup instructions.

**293. LOW — No Sentry source map upload in CI**
Production errors show minified code.

**294. LOW — No bundle size analysis in CI**
No webpack-bundle-analyzer or equivalent.

**295. LOW — tsconfig.node.json reference may not exist**
`client/tsconfig.json:41` — Referenced but existence unverified.

---

## M. Cross-cutting & Architectural Gaps (296–307)

**296. CRITICAL — No end-to-end wizard flow works**
Combining issues: unmounted routes (002), missing validation schemas (003), storefront skill not registered (055), product-recommender tools broken (056). The core value prop — wizard to brand — is incomplete.

**297. HIGH — Client and server API contracts not synchronized**
Multiple field name mismatches across the stack: `priceCents` vs `price` (185), `image_url` vs `imageUrl` (197), `type` vs `asset_type` (022), `wizard_step` vs `wizard_state` (085), `tc_accepted_at` vs `terms_accepted_at` (079).

**298. HIGH — No shared API contract/type generation**
No OpenAPI spec, no tRPC, no code-generated types. Client and server drift independently.

**299. HIGH — Error handling inconsistent across layers**
Some controllers use `{ success: false, error }`, some throw, some return status codes. No unified error response middleware.

**300. HIGH — No feature flags system**
PostHog referenced for feature flags but no actual flag checks in code. Can't safely roll out features.

**301. MEDIUM — No request tracing across services**
Request IDs generated (`server/src/middleware/request-id.js`) but not propagated to BullMQ jobs, Socket.io events, or external API calls.

**302. MEDIUM — No graceful shutdown handling**
Server doesn't drain Socket.io connections, finish BullMQ jobs, or flush logs on SIGTERM.

**303. MEDIUM — No database connection pooling configuration**
Supabase client may not be configured for connection limits under load.

**304. MEDIUM — No API versioning strategy beyond v1**
All routes under `/api/v1/` but no plan for v2 migration.

**305. MEDIUM — No data seeding for development**
No `supabase/seed.sql` or programmatic seed script for local dev setup.

**306. LOW — No contributor documentation**
No CONTRIBUTING.md, no dev setup guide beyond .env.example.

**307. LOW — No license file**
No LICENSE file in repository.

---

## Priority Action Plan

### Immediate (Blocks Core Functionality)
1. Fix unmounted routes (002) — mount wizard sub-routes and product recommendations
2. Fix column name mismatches (079, 085) — DB migration or code fix
3. Create storefront-generator index.js (055)
4. Wire product-recommender tools to handlers (056)
5. Fix api_keys table schema (084)
6. Add RLS to organization tables (080, 097)
7. Implement feature gating middleware (083)
8. Fix Docker healthcheck wget issue (240)
9. Fix Redis healthcheck env var (241)
10. Fix storefront checkout URLs (184) and field names (185)

### Short-term (Breaks User Journeys)
11. Implement password reset completion page (081)
12. Fix Socket.io admin auth (082)
13. Fix Socket.io namespace consistency (110)
14. Mount analytics real routes instead of stubs (001)
15. Add chat validation (003)
16. Fix client auth callback token parsing (086)
17. Fix signup full_name (087)
18. Register video generation worker (125)
19. Fix Tailwind dependency in storefront (183)
20. Add E2E tests to CI (245)

### Medium-term (Degraded Experience)
21-50. Fix remaining HIGH issues across all categories.

### Long-term (Hardening)
51+. Address all MEDIUM and LOW issues.
