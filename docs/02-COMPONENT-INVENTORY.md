# Component Inventory

**Date:** February 19, 2026

---

## Brand Builder Frontend Components

### Screen Components (Wizard Steps)

| Component | File | Step | Purpose |
|-----------|------|------|---------|
| OnboardingScreen | `modules/brand-builder/frontend/src/screens/OnboardingScreen.tsx` | -1 | Animated intro cards, value props |
| AuthFlow | `shared/ui/src/AuthFlow.tsx` | 0 | Login/signup + phone + T&C collection |
| SocialMediaScreen | `modules/brand-builder/frontend/src/screens/SocialMediaScreen.tsx` | 1 | Social profile input & analysis |
| BrandDetailsScreen | `modules/brand-builder/frontend/src/screens/BrandDetailsScreen.tsx` | 2 | Brand vision, identity definition |
| BrandCustomizationScreen | `modules/brand-builder/frontend/src/screens/BrandCustomizationScreen.tsx` | 3 | Logo style, colors, fonts |
| LogoSelectionScreen | `modules/brand-builder/frontend/src/screens/LogoSelectionScreen.tsx` | 4 | Generated logo grid + selection |
| NameLogoSelectionScreen | `modules/brand-builder/frontend/src/screens/NameLogoSelectionScreen.tsx` | 4.5 | Alt workflow: name-first logo selection |
| LogoCustomizationScreen | `modules/brand-builder/frontend/src/screens/LogoCustomizationScreen.tsx` | 5 | Color/shape refinement of selected logo |
| QuickProductSelectionScreen | `modules/brand-builder/frontend/src/screens/QuickProductSelectionScreen.tsx` | 5.5 | Fast product picker |
| ProductCategoryScreen | `modules/brand-builder/frontend/src/screens/ProductCategoryScreen.tsx` | 5.75 | Detailed product category browsing |
| ProductReviewScreen | `modules/brand-builder/frontend/src/screens/ProductReviewScreen.tsx` | 6 | Mockup review with style variants |
| BundleReviewScreen | `modules/brand-builder/frontend/src/screens/BundleReviewScreen.tsx` | 8 | Multi-product bundle gallery |
| ProfitCalculatorScreen | `modules/brand-builder/frontend/src/screens/ProfitCalculatorScreen.tsx` | 8.5 | Sales projections & ROI |
| FinishScreen | `modules/brand-builder/frontend/src/screens/FinishScreen.tsx` | 9 | Celebration with confetti |
| GHLFormScreen | `modules/brand-builder/frontend/src/screens/GHLFormScreen.tsx` | 10 | CRM form submission |

### UI Components

| Component | File | Purpose |
|-----------|------|---------|
| App | `modules/brand-builder/frontend/src/App.tsx` | **MEGA-COMPONENT** - All wizard state + logic (~165KB) |
| Button | `modules/brand-builder/frontend/src/components/Button.tsx` | Styled button with variants |
| Input | `modules/brand-builder/frontend/src/components/Input.tsx` | Text input with validation + glow effect |
| Textarea | `modules/brand-builder/frontend/src/components/Textarea.tsx` | Multiline text input |
| Card | `modules/brand-builder/frontend/src/components/Card.tsx` | Glass morphism card wrapper |
| Modal | `modules/brand-builder/frontend/src/components/Modal.tsx` | Overlay dialog |
| ProgressBar | `modules/brand-builder/frontend/src/components/ProgressBar.tsx` | Multi-step progress indicator |
| ColorPicker | `modules/brand-builder/frontend/src/components/ColorPicker.tsx` | Color selection interface |
| ColorPickerModal | `modules/brand-builder/frontend/src/components/ColorPickerModal.tsx` | Full-screen color picker |
| FontPickerModal | `modules/brand-builder/frontend/src/components/FontPickerModal.tsx` | Font browser (18 Google Fonts) |
| GeneratedLogoCard | `modules/brand-builder/frontend/src/components/GeneratedLogoCard.tsx` | Logo preview with actions |
| GeneratedMockupCard | `modules/brand-builder/frontend/src/components/GeneratedMockupCard.tsx` | Mockup preview card |
| WizardContainer | `modules/brand-builder/frontend/src/components/WizardContainer.tsx` | Layout wrapper for wizard steps |
| Header | `modules/brand-builder/frontend/src/components/Header.tsx` | Page header |
| Footer | `modules/brand-builder/frontend/src/components/Footer.tsx` | Page footer |
| LoadingScreen | `modules/brand-builder/frontend/src/components/LoadingScreen.tsx` | Skeleton loader with gradient |
| AnimatedBackground | `modules/brand-builder/frontend/src/components/AnimatedBackground.tsx` | Parallax gradient background |
| FileUpload | `modules/brand-builder/frontend/src/components/FileUpload.tsx` | File input for logos |
| SearchInput | `modules/brand-builder/frontend/src/components/SearchInput.tsx` | Searchable input field |
| NameTag | `modules/brand-builder/frontend/src/components/NameTag.tsx` | Name display badge |
| Confetti | `modules/brand-builder/frontend/src/components/Confetti.tsx` | Celebration particle effect |
| ChatbotWidget | `modules/brand-builder/frontend/src/components/ChatbotWidget.tsx` | Floating chat interface |
| ChatbotErrorBoundary | `modules/brand-builder/frontend/src/components/ChatbotErrorBoundary.tsx` | Error boundary for chatbot |

### Utilities

| Utility | File | Purpose |
|---------|------|---------|
| api | `src/utils/api.ts` | Backend API client (parseBrand, generateLogos, etc.) |
| ghl | `src/utils/ghl.ts` | GoHighLevel integration helpers |
| authBridge | `src/utils/authBridge.ts` | 401 handling + logout trigger |
| membershipHandoff | `src/utils/membershipHandoff.ts` | Post-wizard redirect to dashboard |
| wizardUrl | `src/utils/wizardUrl.ts` | Hash-based step URL management |

---

## Membership Frontend Components

### Pages

| Component | File | Route | Purpose |
|-----------|------|-------|---------|
| WelcomePage | `modules/membership/frontend/src/pages/WelcomePage.tsx` | `/` (unauth) | Auth flow entry |
| HomePage | `modules/membership/frontend/src/pages/HomePage.tsx` | `/` (auth) | Main dashboard |
| BrandsPage | `modules/membership/frontend/src/pages/BrandsPage.tsx` | `/brands` | Brand gallery |
| BrandDetailPage | `modules/membership/frontend/src/pages/BrandDetailPage.tsx` | `/brands/:id` | Brand deep-dive |
| AgentsPage | `modules/membership/frontend/src/pages/AgentsPage.tsx` | `/agents` | AI tools marketplace |
| BrandBuilderRedirect | `modules/membership/frontend/src/pages/BrandBuilderRedirect.tsx` | `/brandbuilder` | Redirect to wizard |

### Dashboard Components

| Component | File | Purpose |
|-----------|------|---------|
| DashboardLayout | `src/components/layout/DashboardLayout.tsx` | Shell with responsive sidebar |
| Sidebar | `src/components/layout/Sidebar.tsx` | Navigation + user profile + logout |
| BrandStatusCard | `src/components/home/BrandStatusCard.tsx` | Brand progress carousel |
| TaskCard | `src/components/home/TaskCard.tsx` | Actionable task item |
| SalesTracker | `src/components/home/SalesTracker.tsx` | Revenue chart/leaderboard |
| LeaderboardCard | `src/components/home/LeaderboardCard.tsx` | Top performers display |
| MilestonesCard | `src/components/home/MilestonesCard.tsx` | Progress milestone badges |
| QuickActionCard | `src/components/home/QuickActionCard.tsx` | CTA cards |
| BrandCard | `src/components/brands/BrandCard.tsx` | Brand preview in grid |
| EmptyBrandsState | `src/components/brands/EmptyBrandsState.tsx` | Empty state with CTA |

### Hooks

| Hook | File | Purpose |
|------|------|---------|
| useMembershipData | `src/hooks/useMembershipData.ts` | Fetch profile + brands from API |

### Utilities

| Utility | File | Purpose |
|---------|------|---------|
| membershipApi | `src/utils/membershipApi.ts` | API client for membership endpoints |

---

## Shared UI Components

| Component | File | Purpose |
|-----------|------|---------|
| AuthFlow | `shared/ui/src/AuthFlow.tsx` | Complete auth flow (login + phone + T&C) |
| LoginScreen | `shared/ui/src/LoginScreen.tsx` | Email/password + Google OAuth |
| PhoneCollectionScreen | `shared/ui/src/PhoneCollectionScreen.tsx` | Phone input with country picker |
| TermsAcceptanceScreen | `shared/ui/src/TermsAcceptanceScreen.tsx` | T&C acceptance UI |
| TermsCheckbox | `shared/ui/src/TermsCheckbox.tsx` | Checkbox with legal link |
| LegalDocumentsPage | `shared/ui/src/LegalDocumentsPage.tsx` | Full T&C + Privacy Policy |
| Button | `shared/ui/src/Button.tsx` | Base button component |
| Card | `shared/ui/src/Card.tsx` | Base card component |
| Input | `shared/ui/src/Input.tsx` | Base input component |

### Stores

| Store | File | Purpose |
|-------|------|---------|
| authStore | `shared/ui/src/stores/authStore.ts` | Zustand auth state (cross-module) |

### Utilities

| Utility | File | Purpose |
|---------|------|---------|
| auth | `shared/ui/src/utils/auth.ts` | Supabase client setup |
| phoneValidation | `shared/ui/src/utils/phoneValidation.ts` | Phone number validation |
| loginUrlParams | `shared/ui/src/utils/loginUrlParams.ts` | URL param parsing for silent signup |
| urlStorageAlignment | `shared/ui/src/utils/urlStorageAlignment.ts` | URL ↔ localStorage sync |

---

## Backend Services

### Shared Services

| Service | File | Purpose |
|---------|------|---------|
| BaseServiceClient | `shared/services/base.py` | Abstract base (singleton + env validation) |
| SupabaseClient | `shared/services/supabase_client.py` | DB + Auth + Storage operations |
| GHLClient | `shared/services/ghl_client.py` | GoHighLevel CRM integration |
| NocoDBClient | `shared/services/nocodb_client.py` | **DEPRECATED** - Legacy NocoDB access |
| ProfileGHLSync | `shared/services/profile_ghl_sync.py` | Profile ↔ GHL bidirectional sync |

### Auth Dependencies

| Dependency | File | Purpose |
|------------|------|---------|
| get_current_user | `shared/auth/dependencies.py` | Required JWT auth |
| get_user_or_401 | `shared/auth/dependencies.py` | Required auth (stable 401) |
| get_optional_user | `shared/auth/dependencies.py` | Optional auth |
| AuthMiddleware | `shared/auth/middleware.py` | Request-level auth injection |

### Module-Specific Services

| Service | Module | Purpose |
|---------|--------|---------|
| BrandBuilderSupabase | brand-builder | Brand + asset + mockup CRUD |
| EmailSender | chatbot | Resend email integration |
| StorageService | brand-builder | File upload (Supabase + local fallback) |

---

## API Endpoints

### Brand Builder (`/api/wizard/*`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/wizard/state` | Optional | Get wizard state |
| POST | `/api/wizard/contact` | No | Create/update contact |
| POST | `/api/wizard/sync-profile-to-ghl` | Required | GHL profile sync |
| POST | `/api/wizard/brand-info` | Optional | Save brand data |
| PATCH | `/api/wizard/profile` | Optional | Update profile fields |
| POST | `/api/wizard/logo` | Optional | Upload logo image |
| POST | `/api/wizard/logo-from-url` | Optional | Download + upload logo |
| POST | `/api/wizard/mockup` | Optional | Upload mockup |
| POST | `/api/wizard/product-skus` | Optional | Save product selections |
| POST | `/api/wizard/approve-mockups` | Optional | Mark mockups approved |
| POST | `/api/wizard/submit-for-review` | Optional | Complete submission |
| GET | `/api/wizard/resolve-resume-token` | No | Resolve resume token |

### Brand Parsing (root-level)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/parse_brand` | No | Analyze social media + generate vision |
| GET | `/proxy_image` | No | Proxy external images |
| POST | `/get_names` | No | Generate brand names |
| POST | `/generate_logos` | No | Generate logo variations |
| POST | `/edit_logo` | No | Revise logo |
| POST | `/get_products` | No | Search product catalog |
| POST | `/generate_mockup` | No | Generate product mockup |
| POST | `/edit_mockup` | No | Revise mockup |
| POST | `/generate_mockup_from_reference` | No | Style-matched mockup |
| POST | `/generate_bundle_image` | No | Combine multiple mockups |
| POST | `/create_brand` | No | Full brand creation |

### Membership (`/api/membership/*`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/membership/contact` | No | Find/create contact |
| POST | `/api/membership/sync-profile-to-ghl` | Required | GHL sync |
| GET | `/api/membership/me` | Required | Get current user profile |
| PATCH | `/api/membership/me` | Required | Update profile |
| GET | `/api/membership/brands` | Required | List user's brands |
| GET | `/api/membership/brands/:id` | Required | Get brand details |
| GET | `/api/membership/brands/:id/assets` | Required | Get brand assets |
| GET | `/api/membership/brands/:id/mockups` | Required | Get brand mockups |
| PATCH | `/api/membership/brands/:id` | Required | Update brand |
| DELETE | `/api/membership/brands/:id` | Required | Soft-delete brand |

### Chatbot (`/api/chatbot/*`)

| Method | Path | Auth | Rate Limit | Purpose |
|--------|------|------|------------|---------|
| GET | `/api/chatbot/health` | No | None | Health check |
| POST | `/api/chatbot/chat` | No | 30/min | LLM chat with knowledge base |
| POST | `/api/chatbot/send-email` | No | 5/min | Support email via Resend |
