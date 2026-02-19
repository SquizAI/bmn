# 09 — Frontend Application Specification

**Product:** Brand Me Now v2 — React 19 + Vite 7 SPA
**Date:** February 19, 2026
**Status:** Approved for development
**Covers:** Brand Builder Wizard, Dashboard, Admin Panel, Design System

---

## 1. Project Setup

### 1.1 package.json

```json
{
  "name": "@bmn/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write 'src/**/*.{js,jsx,css,json}'",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "typecheck": "tsc --noEmit --allowJs --checkJs"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router": "^7.3.0",
    "zustand": "^5.0.3",
    "@tanstack/react-query": "^5.68.0",
    "@tanstack/react-query-devtools": "^5.68.0",
    "react-hook-form": "^7.54.2",
    "@hookform/resolvers": "^4.1.3",
    "zod": "^3.24.2",
    "socket.io-client": "^4.8.1",
    "@supabase/supabase-js": "^2.49.1",
    "@radix-ui/react-dialog": "^1.1.6",
    "@radix-ui/react-dropdown-menu": "^2.1.6",
    "@radix-ui/react-select": "^2.1.6",
    "@radix-ui/react-checkbox": "^1.1.4",
    "@radix-ui/react-radio-group": "^1.2.3",
    "@radix-ui/react-toast": "^1.2.6",
    "@radix-ui/react-progress": "^1.1.2",
    "@radix-ui/react-tooltip": "^1.1.8",
    "@radix-ui/react-tabs": "^1.1.3",
    "@radix-ui/react-switch": "^1.1.3",
    "@radix-ui/react-slider": "^1.2.3",
    "@radix-ui/react-popover": "^1.1.6",
    "@radix-ui/react-avatar": "^1.1.3",
    "@radix-ui/react-separator": "^1.1.2",
    "@radix-ui/react-scroll-area": "^1.2.3",
    "@radix-ui/react-visually-hidden": "^1.1.2",
    "motion": "^12.4.7",
    "lucide-react": "^0.475.0",
    "@stripe/stripe-js": "^5.5.0",
    "@stripe/react-stripe-js": "^3.5.0",
    "dompurify": "^3.2.4",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "react-dropzone": "^14.3.8",
    "react-colorful": "^5.6.1",
    "recharts": "^2.15.1",
    "posthog-js": "^1.210.0"
  },
  "devDependencies": {
    "vite": "^7.0.0",
    "@vitejs/plugin-react": "^4.4.1",
    "tailwindcss": "^4.0.6",
    "@tailwindcss/vite": "^4.0.6",
    "eslint": "^9.20.0",
    "@eslint/js": "^9.20.0",
    "eslint-plugin-react-hooks": "^5.1.0",
    "eslint-plugin-react-refresh": "^0.4.19",
    "globals": "^15.14.0",
    "prettier": "^3.5.2",
    "prettier-plugin-tailwindcss": "^0.6.11",
    "vitest": "^3.0.5",
    "@vitest/ui": "^3.0.5",
    "@vitest/coverage-v8": "^3.0.5",
    "@testing-library/react": "^16.2.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^26.0.0",
    "msw": "^2.7.3",
    "typescript": "^5.7.3"
  }
}
```

### 1.2 Vite 7 Configuration

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@routes': resolve(__dirname, 'src/routes'),
      '@stores': resolve(__dirname, 'src/stores'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@lib': resolve(__dirname, 'src/lib'),
      '@styles': resolve(__dirname, 'src/styles'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-toast',
          ],
          'vendor-data': ['zustand', '@tanstack/react-query', 'zod'],
          'vendor-motion': ['motion'],
          'vendor-charts': ['recharts'],
        },
      },
    },
  },
});
```

### 1.3 Tailwind CSS 4 Configuration

Tailwind CSS 4 uses native CSS — no `tailwind.config.js`. Configuration lives in the CSS entry point:

```css
/* src/styles/global.css */
@import 'tailwindcss';
@import './design-tokens.css';
@import './animations.css';

/* Tailwind 4 theme extension via @theme */
@theme {
  /* Map CSS variables to Tailwind utilities */
  --color-primary: var(--bmn-color-primary);
  --color-primary-hover: var(--bmn-color-primary-hover);
  --color-primary-active: var(--bmn-color-primary-active);
  --color-secondary: var(--bmn-color-secondary);
  --color-secondary-hover: var(--bmn-color-secondary-hover);
  --color-accent: var(--bmn-color-accent);
  --color-accent-hover: var(--bmn-color-accent-hover);
  --color-background: var(--bmn-color-background);
  --color-surface: var(--bmn-color-surface);
  --color-surface-elevated: var(--bmn-color-surface-elevated);
  --color-surface-overlay: var(--bmn-color-surface-overlay);
  --color-border: var(--bmn-color-border);
  --color-border-hover: var(--bmn-color-border-hover);
  --color-text: var(--bmn-color-text);
  --color-text-secondary: var(--bmn-color-text-secondary);
  --color-text-muted: var(--bmn-color-text-muted);
  --color-text-inverse: var(--bmn-color-text-inverse);
  --color-error: var(--bmn-color-error);
  --color-error-bg: var(--bmn-color-error-bg);
  --color-success: var(--bmn-color-success);
  --color-success-bg: var(--bmn-color-success-bg);
  --color-warning: var(--bmn-color-warning);
  --color-warning-bg: var(--bmn-color-warning-bg);
  --color-info: var(--bmn-color-info);
  --color-info-bg: var(--bmn-color-info-bg);

  --font-family-primary: var(--bmn-font-primary);
  --font-family-secondary: var(--bmn-font-secondary);
  --font-family-mono: var(--bmn-font-mono);

  --radius-sm: var(--bmn-radius-sm);
  --radius-md: var(--bmn-radius-md);
  --radius-lg: var(--bmn-radius-lg);
  --radius-xl: var(--bmn-radius-xl);
  --radius-full: var(--bmn-radius-full);

  --shadow-sm: var(--bmn-shadow-sm);
  --shadow-md: var(--bmn-shadow-md);
  --shadow-lg: var(--bmn-shadow-lg);
  --shadow-xl: var(--bmn-shadow-xl);

  --animate-fade-in: fade-in 0.2s ease-out;
  --animate-fade-out: fade-out 0.2s ease-in;
  --animate-slide-up: slide-up 0.3s ease-out;
  --animate-slide-down: slide-down 0.3s ease-out;
  --animate-scale-in: scale-in 0.2s ease-out;
  --animate-spin-slow: spin 3s linear infinite;
  --animate-pulse-soft: pulse-soft 2s ease-in-out infinite;
  --animate-progress: progress-fill 1.5s ease-out forwards;
  --animate-confetti: confetti-pop 0.6s ease-out forwards;
}

/* Base layer overrides */
@layer base {
  html {
    font-family: var(--bmn-font-primary);
    color: var(--bmn-color-text);
    background-color: var(--bmn-color-background);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    min-height: 100dvh;
  }

  ::selection {
    background-color: var(--bmn-color-primary);
    color: var(--bmn-color-text-inverse);
  }

  :focus-visible {
    outline: 2px solid var(--bmn-color-primary);
    outline-offset: 2px;
  }
}
```

### 1.4 ESLint + Prettier Configuration

```javascript
// eslint.config.js
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2025,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
```

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### 1.5 Directory Structure

```
apps/web/
├── index.html
├── package.json
├── vite.config.js
├── eslint.config.js
├── .prettierrc
├── jsconfig.json
├── public/
│   ├── favicon.ico
│   ├── og-image.png
│   └── fonts/
│       ├── inter-var.woff2
│       └── space-grotesk-var.woff2
│
└── src/
    ├── main.jsx                           # App entry point — renders <App />
    ├── App.jsx                            # Router setup + all providers
    │
    ├── routes/
    │   ├── root-layout.jsx                # Root layout (toast provider, socket connection)
    │   ├── auth/
    │   │   ├── login.jsx                  # Email/password + Google OAuth login
    │   │   ├── signup.jsx                 # Registration form (email, phone, TC)
    │   │   ├── forgot-password.jsx        # Password reset request
    │   │   └── callback.jsx               # OAuth callback handler
    │   ├── wizard/
    │   │   ├── layout.jsx                 # Wizard shell (progress bar, bg, nav)
    │   │   ├── onboarding.jsx             # Step 1: Welcome + sign-up prompt
    │   │   ├── social-analysis.jsx        # Step 2: Enter social handles, see analysis
    │   │   ├── brand-identity.jsx         # Step 3: Review/edit brand vision, values
    │   │   ├── customization.jsx          # Step 4: Colors, fonts, logo style
    │   │   ├── logo-generation.jsx        # Step 5: Generate 4 logos, select
    │   │   ├── logo-refinement.jsx        # Step 6: Refine selected logo
    │   │   ├── product-selection.jsx      # Step 7: Browse and select products
    │   │   ├── mockup-review.jsx          # Step 8: Review mockups, approve/reject
    │   │   ├── bundle-builder.jsx         # Step 9: Create product bundles
    │   │   ├── profit-calculator.jsx      # Step 10: Pricing and revenue projections
    │   │   ├── checkout.jsx               # Step 11: Stripe checkout, tier selection
    │   │   └── complete.jsx               # Step 12: Celebration, share
    │   ├── dashboard/
    │   │   ├── layout.jsx                 # Dashboard shell (sidebar, header)
    │   │   ├── brands.jsx                 # Brand list (cards grid)
    │   │   ├── brand-detail.jsx           # Single brand: all assets, downloads
    │   │   └── settings.jsx               # User profile, subscription, deletion
    │   └── admin/
    │       ├── layout.jsx                 # Admin shell (admin sidebar)
    │       ├── users.jsx                  # User management table
    │       ├── products.jsx               # Product catalog CRUD
    │       ├── jobs.jsx                   # Bull Board embed, job monitoring
    │       ├── moderation.jsx             # Content moderation queue
    │       └── health.jsx                 # System health dashboard
    │
    ├── components/
    │   ├── ui/
    │   │   ├── Button.jsx                 # Button (primary, secondary, ghost, danger)
    │   │   ├── Input.jsx                  # Input (label, error, help text)
    │   │   ├── Textarea.jsx               # Textarea with character count
    │   │   ├── Select.jsx                 # Select dropdown (Radix)
    │   │   ├── Checkbox.jsx               # Checkbox (Radix)
    │   │   ├── Radio.jsx                  # Radio group (Radix)
    │   │   ├── Switch.jsx                 # Toggle switch (Radix)
    │   │   ├── Slider.jsx                 # Range slider (Radix)
    │   │   ├── Card.jsx                   # Card container
    │   │   ├── Modal.jsx                  # Dialog modal (Radix)
    │   │   ├── Drawer.jsx                 # Slide-in drawer (Radix Dialog)
    │   │   ├── Toast.jsx                  # Toast notifications (Radix)
    │   │   ├── ToastProvider.jsx          # Toast context provider
    │   │   ├── ProgressBar.jsx            # Progress bar with percentage
    │   │   ├── Skeleton.jsx               # Skeleton loader
    │   │   ├── Avatar.jsx                 # User avatar (Radix)
    │   │   ├── Badge.jsx                  # Status badge
    │   │   ├── Tooltip.jsx                # Tooltip (Radix)
    │   │   ├── Tabs.jsx                   # Tab group (Radix)
    │   │   ├── Separator.jsx              # Horizontal/vertical rule (Radix)
    │   │   ├── ScrollArea.jsx             # Custom scrollbar (Radix)
    │   │   ├── DropdownMenu.jsx           # Dropdown menu (Radix)
    │   │   ├── Popover.jsx                # Popover (Radix)
    │   │   ├── FileUpload.jsx             # Dropzone file upload
    │   │   ├── EmptyState.jsx             # Empty state illustration + CTA
    │   │   ├── ErrorBoundary.jsx          # React error boundary
    │   │   ├── LoadingSpinner.jsx         # Animated loading spinner
    │   │   └── VisuallyHidden.jsx         # Screen-reader-only text (Radix)
    │   │
    │   ├── wizard/
    │   │   ├── WizardProgressBar.jsx      # Multi-step progress indicator
    │   │   ├── StepNavigation.jsx         # Back / Next / Skip buttons
    │   │   ├── GenerationProgress.jsx     # Real-time AI generation progress
    │   │   ├── SocialHandleInput.jsx      # Social media handle input with validation
    │   │   ├── ColorPalettePicker.jsx     # Color palette selection/customization
    │   │   ├── FontSelector.jsx           # Font preview and selection
    │   │   ├── LogoStyleSelector.jsx      # Visual logo style cards
    │   │   ├── LogoGrid.jsx              # 4-logo grid with selection
    │   │   ├── LogoRefinementPanel.jsx    # Logo modification controls
    │   │   ├── ProductGrid.jsx            # Product catalog browsable grid
    │   │   ├── ProductCard.jsx            # Single product with select toggle
    │   │   ├── MockupViewer.jsx           # Mockup image with approve/reject
    │   │   ├── BundleBuilder.jsx          # Drag-and-drop bundle creation
    │   │   ├── ProfitChart.jsx            # Revenue projection chart (Recharts)
    │   │   ├── PricingSlider.jsx          # Interactive retail price slider
    │   │   ├── TierSelector.jsx           # Subscription tier selection cards
    │   │   ├── CelebrationAnimation.jsx   # Confetti + celebration on completion
    │   │   └── BrandSummaryCard.jsx       # Final brand summary overview
    │   │
    │   ├── brand/
    │   │   ├── BrandCard.jsx              # Brand list card (dashboard)
    │   │   ├── BrandStatusBadge.jsx       # Draft/Active/Complete badge
    │   │   ├── AssetGallery.jsx           # Image gallery with download
    │   │   ├── ColorPaletteDisplay.jsx    # Read-only color palette
    │   │   ├── FontDisplay.jsx            # Typography preview
    │   │   └── BrandDetailHeader.jsx      # Brand hero section
    │   │
    │   ├── chat/
    │   │   ├── ChatWidget.jsx             # Floating chat button + drawer
    │   │   ├── ChatMessage.jsx            # Single chat message bubble
    │   │   ├── ChatInput.jsx              # Message input with send
    │   │   └── TypingIndicator.jsx        # AI typing dots animation
    │   │
    │   ├── admin/
    │   │   ├── UserTable.jsx              # User management data table
    │   │   ├── ProductForm.jsx            # Product CRUD form
    │   │   ├── ModerationCard.jsx         # Content review card
    │   │   ├── JobMonitor.jsx             # BullMQ job status display
    │   │   └── HealthMetrics.jsx          # System health cards
    │   │
    │   └── layout/
    │       ├── AppHeader.jsx              # Top nav (logo, user menu)
    │       ├── DashboardSidebar.jsx       # Dashboard side navigation
    │       ├── AdminSidebar.jsx           # Admin side navigation
    │       ├── MobileNav.jsx              # Mobile hamburger menu
    │       ├── Footer.jsx                 # App footer
    │       └── ConnectionStatus.jsx       # Socket.io connection indicator
    │
    ├── stores/
    │   ├── wizard-store.js                # Zustand: wizard state (brand, design, assets, products, meta)
    │   ├── auth-store.js                  # Zustand: user session, isAdmin
    │   └── ui-store.js                    # Zustand: theme, sidebar, toast queue
    │
    ├── hooks/
    │   ├── use-socket.js                  # Socket.io connection management
    │   ├── use-generation-progress.js     # Real-time generation tracking via socket
    │   ├── use-brand-updates.js           # Live brand status via socket
    │   ├── use-brands.js                  # TanStack Query: brand list + CRUD
    │   ├── use-brand-detail.js            # TanStack Query: single brand + assets
    │   ├── use-products.js                # TanStack Query: product catalog
    │   ├── use-generation.js              # TanStack Query: start/track generation jobs
    │   ├── use-user-profile.js            # TanStack Query: user profile + subscription
    │   ├── use-admin.js                   # TanStack Query: admin queries + mutations
    │   ├── use-chat.js                    # Chatbot message send/receive
    │   ├── use-auth.js                    # Auth flow hooks (login, signup, logout)
    │   ├── use-toast.js                   # Toast notification trigger
    │   ├── use-media-query.js             # Responsive breakpoint detection
    │   └── use-local-storage.js           # Type-safe localStorage hook
    │
    ├── lib/
    │   ├── api-client.js                  # Fetch wrapper with auth headers, error handling
    │   ├── socket-client.js               # Socket.io client singleton + JWT auth
    │   ├── supabase-client.js             # Supabase browser client
    │   ├── stripe-client.js               # Stripe.js loader
    │   ├── posthog-client.js              # PostHog analytics init
    │   ├── validation-schemas.js          # Shared Zod schemas (re-exported from @bmn/shared)
    │   ├── constants.js                   # App-wide constants (routes, tiers, steps)
    │   ├── utils.js                       # Utility functions (cn, formatCurrency, etc.)
    │   └── route-guards.js                # Auth + admin route guard loaders
    │
    └── styles/
        ├── design-tokens.css              # CSS variables: colors, typography, spacing
        ├── global.css                     # Tailwind 4 imports + @theme + base
        └── animations.css                 # Keyframe animations
```

### 1.6 Environment Variables

All client-side env vars use the `VITE_` prefix (exposed to browser bundle by Vite):

```bash
# .env.local (development)
VITE_API_BASE_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_POSTHOG_KEY=phc_...
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_APP_ENV=development
VITE_SENTRY_DSN=https://...@sentry.io/...
```

```bash
# .env.production
VITE_API_BASE_URL=https://api.brandmenow.com
VITE_SOCKET_URL=https://api.brandmenow.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_POSTHOG_KEY=phc_...
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_APP_ENV=production
VITE_SENTRY_DSN=https://...@sentry.io/...
```

### 1.7 jsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2025",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "checkJs": true,
    "allowJs": true,
    "noEmit": true,
    "strict": false,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@routes/*": ["src/routes/*"],
      "@stores/*": ["src/stores/*"],
      "@hooks/*": ["src/hooks/*"],
      "@lib/*": ["src/lib/*"],
      "@styles/*": ["src/styles/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 2. Design System

### 2.1 Design Tokens (CSS Variables)

```css
/* src/styles/design-tokens.css */

:root {
  /* ========================================================
     COLORS — Light Mode (Default)
     ======================================================== */

  /* Primary — Brand purple */
  --bmn-color-primary: #7c3aed;
  --bmn-color-primary-hover: #6d28d9;
  --bmn-color-primary-active: #5b21b6;
  --bmn-color-primary-light: #ede9fe;
  --bmn-color-primary-foreground: #ffffff;

  /* Secondary — Slate blue */
  --bmn-color-secondary: #475569;
  --bmn-color-secondary-hover: #334155;
  --bmn-color-secondary-active: #1e293b;
  --bmn-color-secondary-light: #f1f5f9;
  --bmn-color-secondary-foreground: #ffffff;

  /* Accent — Vibrant teal */
  --bmn-color-accent: #14b8a6;
  --bmn-color-accent-hover: #0d9488;
  --bmn-color-accent-active: #0f766e;
  --bmn-color-accent-light: #ccfbf1;
  --bmn-color-accent-foreground: #ffffff;

  /* Background & Surface */
  --bmn-color-background: #fafafa;
  --bmn-color-surface: #ffffff;
  --bmn-color-surface-elevated: #ffffff;
  --bmn-color-surface-overlay: rgba(0, 0, 0, 0.5);
  --bmn-color-surface-hover: #f5f5f5;

  /* Border */
  --bmn-color-border: #e2e8f0;
  --bmn-color-border-hover: #cbd5e1;
  --bmn-color-border-focus: #7c3aed;

  /* Text */
  --bmn-color-text: #0f172a;
  --bmn-color-text-secondary: #475569;
  --bmn-color-text-muted: #94a3b8;
  --bmn-color-text-inverse: #ffffff;
  --bmn-color-text-link: #7c3aed;
  --bmn-color-text-link-hover: #6d28d9;

  /* Semantic — Error */
  --bmn-color-error: #ef4444;
  --bmn-color-error-hover: #dc2626;
  --bmn-color-error-bg: #fef2f2;
  --bmn-color-error-border: #fecaca;
  --bmn-color-error-foreground: #ffffff;

  /* Semantic — Success */
  --bmn-color-success: #22c55e;
  --bmn-color-success-hover: #16a34a;
  --bmn-color-success-bg: #f0fdf4;
  --bmn-color-success-border: #bbf7d0;
  --bmn-color-success-foreground: #ffffff;

  /* Semantic — Warning */
  --bmn-color-warning: #f59e0b;
  --bmn-color-warning-hover: #d97706;
  --bmn-color-warning-bg: #fffbeb;
  --bmn-color-warning-border: #fde68a;
  --bmn-color-warning-foreground: #000000;

  /* Semantic — Info */
  --bmn-color-info: #3b82f6;
  --bmn-color-info-hover: #2563eb;
  --bmn-color-info-bg: #eff6ff;
  --bmn-color-info-border: #bfdbfe;
  --bmn-color-info-foreground: #ffffff;

  /* Wizard-specific */
  --bmn-color-wizard-bg: #f8fafc;
  --bmn-color-wizard-step-active: #7c3aed;
  --bmn-color-wizard-step-complete: #22c55e;
  --bmn-color-wizard-step-upcoming: #e2e8f0;
  --bmn-color-wizard-step-text: #ffffff;

  /* ========================================================
     TYPOGRAPHY
     ======================================================== */

  /* Font families */
  --bmn-font-primary: 'Inter', system-ui, -apple-system, sans-serif;
  --bmn-font-secondary: 'Space Grotesk', system-ui, sans-serif;
  --bmn-font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Font sizes */
  --bmn-text-xs: 0.75rem;      /* 12px */
  --bmn-text-sm: 0.875rem;     /* 14px */
  --bmn-text-base: 1rem;       /* 16px */
  --bmn-text-lg: 1.125rem;     /* 18px */
  --bmn-text-xl: 1.25rem;      /* 20px */
  --bmn-text-2xl: 1.5rem;      /* 24px */
  --bmn-text-3xl: 1.875rem;    /* 30px */
  --bmn-text-4xl: 2.25rem;     /* 36px */
  --bmn-text-5xl: 3rem;        /* 48px */
  --bmn-text-6xl: 3.75rem;     /* 60px */

  /* Line heights */
  --bmn-leading-none: 1;
  --bmn-leading-tight: 1.25;
  --bmn-leading-snug: 1.375;
  --bmn-leading-normal: 1.5;
  --bmn-leading-relaxed: 1.625;
  --bmn-leading-loose: 2;

  /* Font weights */
  --bmn-font-thin: 100;
  --bmn-font-light: 300;
  --bmn-font-normal: 400;
  --bmn-font-medium: 500;
  --bmn-font-semibold: 600;
  --bmn-font-bold: 700;
  --bmn-font-extrabold: 800;

  /* Letter spacing */
  --bmn-tracking-tighter: -0.05em;
  --bmn-tracking-tight: -0.025em;
  --bmn-tracking-normal: 0em;
  --bmn-tracking-wide: 0.025em;
  --bmn-tracking-wider: 0.05em;
  --bmn-tracking-widest: 0.1em;

  /* ========================================================
     SPACING SCALE
     ======================================================== */

  --bmn-space-0: 0;
  --bmn-space-px: 1px;
  --bmn-space-0-5: 0.125rem;   /* 2px */
  --bmn-space-1: 0.25rem;      /* 4px */
  --bmn-space-1-5: 0.375rem;   /* 6px */
  --bmn-space-2: 0.5rem;       /* 8px */
  --bmn-space-2-5: 0.625rem;   /* 10px */
  --bmn-space-3: 0.75rem;      /* 12px */
  --bmn-space-3-5: 0.875rem;   /* 14px */
  --bmn-space-4: 1rem;         /* 16px */
  --bmn-space-5: 1.25rem;      /* 20px */
  --bmn-space-6: 1.5rem;       /* 24px */
  --bmn-space-7: 1.75rem;      /* 28px */
  --bmn-space-8: 2rem;         /* 32px */
  --bmn-space-9: 2.25rem;      /* 36px */
  --bmn-space-10: 2.5rem;      /* 40px */
  --bmn-space-11: 2.75rem;     /* 44px */
  --bmn-space-12: 3rem;        /* 48px */
  --bmn-space-14: 3.5rem;      /* 56px */
  --bmn-space-16: 4rem;        /* 64px */
  --bmn-space-20: 5rem;        /* 80px */
  --bmn-space-24: 6rem;        /* 96px */
  --bmn-space-28: 7rem;        /* 112px */
  --bmn-space-32: 8rem;        /* 128px */
  --bmn-space-36: 9rem;        /* 144px */
  --bmn-space-40: 10rem;       /* 160px */
  --bmn-space-44: 11rem;       /* 176px */
  --bmn-space-48: 12rem;       /* 192px */
  --bmn-space-52: 13rem;       /* 208px */
  --bmn-space-56: 14rem;       /* 224px */
  --bmn-space-60: 15rem;       /* 240px */
  --bmn-space-64: 16rem;       /* 256px */
  --bmn-space-72: 18rem;       /* 288px */
  --bmn-space-80: 20rem;       /* 320px */
  --bmn-space-96: 24rem;       /* 384px */

  /* ========================================================
     BORDER RADIUS
     ======================================================== */

  --bmn-radius-none: 0;
  --bmn-radius-sm: 0.25rem;    /* 4px */
  --bmn-radius-md: 0.5rem;     /* 8px */
  --bmn-radius-lg: 0.75rem;    /* 12px */
  --bmn-radius-xl: 1rem;       /* 16px */
  --bmn-radius-2xl: 1.5rem;    /* 24px */
  --bmn-radius-full: 9999px;

  /* ========================================================
     SHADOWS
     ======================================================== */

  --bmn-shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --bmn-shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);
  --bmn-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
  --bmn-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
  --bmn-shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  --bmn-shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  --bmn-shadow-inner: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);
  --bmn-shadow-glow-primary: 0 0 20px rgba(124, 58, 237, 0.3);
  --bmn-shadow-glow-success: 0 0 20px rgba(34, 197, 94, 0.3);

  /* ========================================================
     TRANSITIONS
     ======================================================== */

  --bmn-transition-fast: 100ms ease;
  --bmn-transition-base: 200ms ease;
  --bmn-transition-slow: 300ms ease;
  --bmn-transition-slower: 500ms ease;
  --bmn-transition-spring: 500ms cubic-bezier(0.34, 1.56, 0.64, 1);

  /* ========================================================
     Z-INDEX SCALE
     ======================================================== */

  --bmn-z-base: 0;
  --bmn-z-dropdown: 10;
  --bmn-z-sticky: 20;
  --bmn-z-overlay: 30;
  --bmn-z-modal: 40;
  --bmn-z-toast: 50;
  --bmn-z-tooltip: 60;
  --bmn-z-chat: 70;

  /* ========================================================
     LAYOUT
     ======================================================== */

  --bmn-max-width-content: 1280px;
  --bmn-max-width-wizard: 960px;
  --bmn-max-width-form: 640px;
  --bmn-sidebar-width: 280px;
  --bmn-header-height: 64px;
  --bmn-wizard-progress-height: 4px;

  /* ========================================================
     BREAKPOINTS (reference — Tailwind handles actual queries)
     ======================================================== */

  --bmn-screen-sm: 640px;
  --bmn-screen-md: 768px;
  --bmn-screen-lg: 1024px;
  --bmn-screen-xl: 1280px;
  --bmn-screen-2xl: 1536px;
}

/* ========================================================
   DARK MODE
   Swaps CSS variable values. Applied via class on <html>.
   ======================================================== */

:root.dark {
  /* Background & Surface */
  --bmn-color-background: #0a0a0f;
  --bmn-color-surface: #18181b;
  --bmn-color-surface-elevated: #27272a;
  --bmn-color-surface-overlay: rgba(0, 0, 0, 0.7);
  --bmn-color-surface-hover: #27272a;

  /* Primary — Lighter for dark bg */
  --bmn-color-primary: #a78bfa;
  --bmn-color-primary-hover: #8b5cf6;
  --bmn-color-primary-active: #7c3aed;
  --bmn-color-primary-light: #1e1b4b;
  --bmn-color-primary-foreground: #000000;

  /* Secondary */
  --bmn-color-secondary: #94a3b8;
  --bmn-color-secondary-hover: #cbd5e1;
  --bmn-color-secondary-active: #e2e8f0;
  --bmn-color-secondary-light: #1e293b;
  --bmn-color-secondary-foreground: #000000;

  /* Accent */
  --bmn-color-accent: #2dd4bf;
  --bmn-color-accent-hover: #14b8a6;
  --bmn-color-accent-active: #0d9488;
  --bmn-color-accent-light: #042f2e;

  /* Border */
  --bmn-color-border: #3f3f46;
  --bmn-color-border-hover: #52525b;
  --bmn-color-border-focus: #a78bfa;

  /* Text */
  --bmn-color-text: #fafafa;
  --bmn-color-text-secondary: #a1a1aa;
  --bmn-color-text-muted: #71717a;
  --bmn-color-text-inverse: #0a0a0f;
  --bmn-color-text-link: #a78bfa;
  --bmn-color-text-link-hover: #c4b5fd;

  /* Semantic */
  --bmn-color-error: #f87171;
  --bmn-color-error-bg: #1c0a0a;
  --bmn-color-error-border: #7f1d1d;
  --bmn-color-success: #4ade80;
  --bmn-color-success-bg: #052e16;
  --bmn-color-success-border: #166534;
  --bmn-color-warning: #fbbf24;
  --bmn-color-warning-bg: #1c1305;
  --bmn-color-warning-border: #854d0e;
  --bmn-color-info: #60a5fa;
  --bmn-color-info-bg: #0a1628;
  --bmn-color-info-border: #1e40af;

  /* Wizard */
  --bmn-color-wizard-bg: #0f0f14;
  --bmn-color-wizard-step-active: #a78bfa;
  --bmn-color-wizard-step-complete: #4ade80;
  --bmn-color-wizard-step-upcoming: #3f3f46;

  /* Shadows — darker for dark mode */
  --bmn-shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.4);
  --bmn-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.4);
  --bmn-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.4);
  --bmn-shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
  --bmn-shadow-glow-primary: 0 0 20px rgba(167, 139, 250, 0.3);
  --bmn-shadow-glow-success: 0 0 20px rgba(74, 222, 128, 0.3);
}
```

### 2.2 Animations

```css
/* src/styles/animations.css */

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slide-down {
  from { opacity: 0; transform: translateY(-16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slide-in-right {
  from { opacity: 0; transform: translateX(100%); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes slide-out-right {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(100%); }
}

@keyframes scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes pulse-soft {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes progress-fill {
  from { width: 0%; }
  to { width: var(--progress-width, 100%); }
}

@keyframes progress-indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes confetti-pop {
  0% { transform: scale(0) rotate(0deg); opacity: 1; }
  50% { transform: scale(1.2) rotate(180deg); opacity: 1; }
  100% { transform: scale(1) rotate(360deg); opacity: 1; }
}

@keyframes bounce-in {
  0% { transform: scale(0.3); opacity: 0; }
  50% { transform: scale(1.05); }
  70% { transform: scale(0.9); }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes typing-dot {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
}
```

### 2.3 Component Primitives

#### Button

```jsx
// src/components/ui/Button.jsx

import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

/**
 * @typedef {'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline'} ButtonVariant
 * @typedef {'sm' | 'md' | 'lg' | 'icon'} ButtonSize
 */

/**
 * @param {Object} props
 * @param {ButtonVariant} [props.variant='primary']
 * @param {ButtonSize} [props.size='md']
 * @param {boolean} [props.loading=false]
 * @param {boolean} [props.disabled=false]
 * @param {boolean} [props.fullWidth=false]
 * @param {import('react').ReactNode} [props.leftIcon]
 * @param {import('react').ReactNode} [props.rightIcon]
 * @param {import('react').ReactNode} props.children
 */
const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled = false, fullWidth = false, leftIcon, rightIcon, children, className, ...props },
  ref,
) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-200 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variants = {
    primary:
      'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active shadow-sm hover:shadow-md',
    secondary:
      'bg-secondary text-secondary-foreground hover:bg-secondary-hover active:bg-secondary-active shadow-sm',
    ghost:
      'bg-transparent text-text-secondary hover:bg-surface-hover active:bg-border',
    danger:
      'bg-error text-error-foreground hover:bg-error-hover active:bg-red-800 shadow-sm',
    success:
      'bg-success text-success-foreground hover:bg-success-hover shadow-sm',
    outline:
      'bg-transparent text-text border border-border hover:bg-surface-hover active:bg-border',
  };

  const sizes = {
    sm: 'h-8 px-3 text-sm gap-1.5',
    md: 'h-10 px-4 text-sm gap-2',
    lg: 'h-12 px-6 text-base gap-2.5',
    icon: 'h-10 w-10 p-0',
  };

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(baseStyles, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : leftIcon ? (
        <span className="shrink-0">{leftIcon}</span>
      ) : null}
      {size !== 'icon' && <span>{children}</span>}
      {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
});

export { Button };
```

#### Input

```jsx
// src/components/ui/Input.jsx

import { forwardRef, useId } from 'react';
import { clsx } from 'clsx';

/**
 * @param {Object} props
 * @param {string} [props.label]
 * @param {string} [props.error]
 * @param {string} [props.helpText]
 * @param {import('react').ReactNode} [props.leftAddon]
 * @param {import('react').ReactNode} [props.rightAddon]
 * @param {boolean} [props.required=false]
 */
const Input = forwardRef(function Input(
  { label, error, helpText, leftAddon, rightAddon, required = false, className, id: providedId, ...props },
  ref,
) {
  const generatedId = useId();
  const id = providedId || generatedId;
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {leftAddon && (
          <span className="absolute left-3 text-text-muted">{leftAddon}</span>
        )}
        <input
          ref={ref}
          id={id}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helpText ? helpId : undefined}
          className={clsx(
            'h-10 w-full rounded-lg border bg-surface px-3 text-sm text-text transition-all duration-200',
            'placeholder:text-text-muted',
            'hover:border-border-hover',
            'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error
              ? 'border-error focus:border-error focus:ring-error/20'
              : 'border-border',
            leftAddon && 'pl-10',
            rightAddon && 'pr-10',
            className,
          )}
          {...props}
        />
        {rightAddon && (
          <span className="absolute right-3 text-text-muted">{rightAddon}</span>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-xs text-error" role="alert">
          {error}
        </p>
      )}
      {!error && helpText && (
        <p id={helpId} className="text-xs text-text-muted">
          {helpText}
        </p>
      )}
    </div>
  );
});

export { Input };
```

#### Card

```jsx
// src/components/ui/Card.jsx

import { clsx } from 'clsx';

/**
 * @param {Object} props
 * @param {'default' | 'elevated' | 'outlined' | 'interactive'} [props.variant='default']
 * @param {'sm' | 'md' | 'lg' | 'none'} [props.padding='md']
 * @param {import('react').ReactNode} props.children
 */
function Card({ variant = 'default', padding = 'md', children, className, ...props }) {
  const variants = {
    default: 'bg-surface border border-border shadow-sm',
    elevated: 'bg-surface-elevated shadow-lg',
    outlined: 'bg-transparent border border-border',
    interactive:
      'bg-surface border border-border shadow-sm hover:shadow-md hover:border-border-hover transition-all duration-200 cursor-pointer',
  };

  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div className={clsx('rounded-xl', variants[variant], paddings[padding], className)} {...props}>
      {children}
    </div>
  );
}

function CardHeader({ children, className, ...props }) {
  return (
    <div className={clsx('mb-4 flex items-center justify-between', className)} {...props}>
      {children}
    </div>
  );
}

function CardTitle({ children, className, ...props }) {
  return (
    <h3 className={clsx('text-lg font-semibold text-text', className)} {...props}>
      {children}
    </h3>
  );
}

function CardDescription({ children, className, ...props }) {
  return (
    <p className={clsx('text-sm text-text-secondary', className)} {...props}>
      {children}
    </p>
  );
}

function CardContent({ children, className, ...props }) {
  return (
    <div className={clsx(className)} {...props}>
      {children}
    </div>
  );
}

function CardFooter({ children, className, ...props }) {
  return (
    <div className={clsx('mt-4 flex items-center gap-3', className)} {...props}>
      {children}
    </div>
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
```

#### Modal

```jsx
// src/components/ui/Modal.jsx

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string} [props.title]
 * @param {string} [props.description]
 * @param {'sm' | 'md' | 'lg' | 'xl' | 'full'} [props.size='md']
 * @param {import('react').ReactNode} props.children
 */
function Modal({ open, onOpenChange, title, description, size = 'md', children, className }) {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[90vw]',
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--bmn-z-overlay)] bg-surface-overlay data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <Dialog.Content
          className={clsx(
            'fixed left-1/2 top-1/2 z-[var(--bmn-z-modal)] -translate-x-1/2 -translate-y-1/2',
            'w-[calc(100%-2rem)] rounded-xl bg-surface p-6 shadow-xl',
            'data-[state=open]:animate-scale-in',
            'focus:outline-none',
            sizes[size],
            className,
          )}
        >
          {title && (
            <Dialog.Title className="text-lg font-semibold text-text">
              {title}
            </Dialog.Title>
          )}
          {description && (
            <Dialog.Description className="mt-1 text-sm text-text-secondary">
              {description}
            </Dialog.Description>
          )}
          <div className="mt-4">{children}</div>
          <Dialog.Close asChild>
            <button
              className="absolute right-4 top-4 rounded-md p-1 text-text-muted hover:text-text transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { Modal };
```

#### Toast

```jsx
// src/components/ui/Toast.jsx

import * as ToastPrimitive from '@radix-ui/react-toast';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * @typedef {'success' | 'error' | 'warning' | 'info'} ToastType
 */

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const toastStyles = {
  success: 'border-success-border bg-success-bg text-text',
  error: 'border-error-border bg-error-bg text-text',
  warning: 'border-warning-border bg-warning-bg text-text',
  info: 'border-info-border bg-info-bg text-text',
};

const iconStyles = {
  success: 'text-success',
  error: 'text-error',
  warning: 'text-warning',
  info: 'text-info',
};

/**
 * @param {Object} props
 * @param {ToastType} props.type
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 */
function Toast({ type = 'info', title, description, open, onOpenChange }) {
  const Icon = icons[type];

  return (
    <ToastPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      className={clsx(
        'flex items-start gap-3 rounded-lg border p-4 shadow-lg',
        'data-[state=open]:animate-slide-up',
        'data-[state=closed]:animate-fade-out',
        toastStyles[type],
      )}
    >
      <Icon className={clsx('mt-0.5 h-5 w-5 shrink-0', iconStyles[type])} />
      <div className="flex-1">
        <ToastPrimitive.Title className="text-sm font-medium">{title}</ToastPrimitive.Title>
        {description && (
          <ToastPrimitive.Description className="mt-1 text-xs text-text-secondary">
            {description}
          </ToastPrimitive.Description>
        )}
      </div>
      <ToastPrimitive.Close className="rounded-md p-1 text-text-muted hover:text-text transition-colors">
        <X className="h-4 w-4" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

function ToastViewport() {
  return (
    <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[var(--bmn-z-toast)] flex max-w-md flex-col gap-2" />
  );
}

export { Toast, ToastViewport, ToastPrimitive };
```

#### ProgressBar

```jsx
// src/components/ui/ProgressBar.jsx

import * as Progress from '@radix-ui/react-progress';
import { clsx } from 'clsx';

/**
 * @param {Object} props
 * @param {number} props.value — 0 to 100
 * @param {string} [props.statusText]
 * @param {boolean} [props.indeterminate=false]
 * @param {'sm' | 'md' | 'lg'} [props.size='md']
 * @param {'primary' | 'success' | 'warning' | 'error'} [props.color='primary']
 * @param {boolean} [props.showPercentage=true]
 * @param {boolean} [props.animated=true]
 */
function ProgressBar({
  value = 0,
  statusText,
  indeterminate = false,
  size = 'md',
  color = 'primary',
  showPercentage = true,
  animated = true,
  className,
}) {
  const heights = { sm: 'h-1.5', md: 'h-3', lg: 'h-4' };

  const barColors = {
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    error: 'bg-error',
  };

  const bgColors = {
    primary: 'bg-primary-light',
    success: 'bg-success-bg',
    warning: 'bg-warning-bg',
    error: 'bg-error-bg',
  };

  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {(statusText || showPercentage) && (
        <div className="flex items-center justify-between">
          {statusText && (
            <span className="text-sm text-text-secondary">{statusText}</span>
          )}
          {showPercentage && !indeterminate && (
            <span className="text-sm font-medium text-text tabular-nums">
              {Math.round(value)}%
            </span>
          )}
        </div>
      )}
      <Progress.Root
        value={indeterminate ? undefined : value}
        className={clsx('relative w-full overflow-hidden rounded-full', bgColors[color], heights[size])}
      >
        {indeterminate ? (
          <div
            className={clsx(
              'absolute h-full w-1/4 rounded-full animate-[progress-indeterminate_1.5s_ease-in-out_infinite]',
              barColors[color],
            )}
          />
        ) : (
          <Progress.Indicator
            className={clsx(
              'h-full rounded-full',
              barColors[color],
              animated && 'transition-[width] duration-500 ease-out',
            )}
            style={{ width: `${value}%` }}
          />
        )}
      </Progress.Root>
    </div>
  );
}

export { ProgressBar };
```

#### Skeleton

```jsx
// src/components/ui/Skeleton.jsx

import { clsx } from 'clsx';

/**
 * @param {Object} props
 * @param {'text' | 'circle' | 'rect' | 'card'} [props.variant='text']
 * @param {string} [props.width]
 * @param {string} [props.height]
 * @param {number} [props.lines=1] — For text variant
 */
function Skeleton({ variant = 'text', width, height, lines = 1, className }) {
  const baseStyles =
    'animate-pulse rounded-md bg-gradient-to-r from-border via-surface-hover to-border bg-[length:200%_100%] animate-[shimmer_2s_infinite]';

  if (variant === 'circle') {
    return (
      <div
        className={clsx(baseStyles, 'rounded-full', className)}
        style={{ width: width || '40px', height: height || '40px' }}
      />
    );
  }

  if (variant === 'card') {
    return (
      <div className={clsx(baseStyles, 'rounded-xl', className)} style={{ width: width || '100%', height: height || '200px' }} />
    );
  }

  if (variant === 'rect') {
    return (
      <div className={clsx(baseStyles, className)} style={{ width: width || '100%', height: height || '40px' }} />
    );
  }

  // Text variant — multiple lines
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={clsx(baseStyles, 'h-4', className)}
          style={{ width: i === lines - 1 && lines > 1 ? '75%' : width || '100%' }}
        />
      ))}
    </div>
  );
}

export { Skeleton };
```

#### FileUpload (Dropzone)

```jsx
// src/components/ui/FileUpload.jsx

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileImage } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * @param {Object} props
 * @param {(files: File[]) => void} props.onFilesAccepted
 * @param {string[]} [props.acceptedTypes=['image/png', 'image/jpeg', 'image/svg+xml']]
 * @param {number} [props.maxSizeMb=10]
 * @param {number} [props.maxFiles=1]
 * @param {string} [props.label='Drop files here or click to browse']
 * @param {File[]} [props.files=[]]
 * @param {(index: number) => void} [props.onRemoveFile]
 */
function FileUpload({
  onFilesAccepted,
  acceptedTypes = ['image/png', 'image/jpeg', 'image/svg+xml'],
  maxSizeMb = 10,
  maxFiles = 1,
  label = 'Drop files here or click to browse',
  files = [],
  onRemoveFile,
  className,
}) {
  const onDrop = useCallback(
    (accepted) => {
      onFilesAccepted(accepted);
    },
    [onFilesAccepted],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: Object.fromEntries(acceptedTypes.map((t) => [t, []])),
    maxSize: maxSizeMb * 1024 * 1024,
    maxFiles,
  });

  return (
    <div className={clsx('flex flex-col gap-3', className)}>
      <div
        {...getRootProps()}
        className={clsx(
          'flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 transition-all duration-200',
          isDragActive && !isDragReject && 'border-primary bg-primary-light',
          isDragReject && 'border-error bg-error-bg',
          !isDragActive && 'border-border hover:border-border-hover hover:bg-surface-hover',
        )}
      >
        <input {...getInputProps()} />
        <Upload className={clsx('h-8 w-8', isDragActive ? 'text-primary' : 'text-text-muted')} />
        <p className="text-sm text-text-secondary text-center">{label}</p>
        <p className="text-xs text-text-muted">Max {maxSizeMb}MB per file</p>
      </div>

      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((file, i) => (
            <li key={i} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
              <FileImage className="h-5 w-5 text-text-muted shrink-0" />
              <span className="flex-1 truncate text-sm text-text">{file.name}</span>
              <span className="text-xs text-text-muted">
                {(file.size / 1024).toFixed(0)} KB
              </span>
              {onRemoveFile && (
                <button
                  onClick={() => onRemoveFile(i)}
                  className="rounded-md p-1 text-text-muted hover:text-error transition-colors"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { FileUpload };
```

#### Select, Checkbox, Radio, Drawer

```jsx
// src/components/ui/Select.jsx

import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * @param {Object} props
 * @param {string} [props.label]
 * @param {string} [props.error]
 * @param {string} [props.placeholder='Select an option...']
 * @param {Array<{value: string, label: string}>} props.options
 * @param {string} [props.value]
 * @param {(value: string) => void} props.onValueChange
 * @param {boolean} [props.required=false]
 */
function Select({ label, error, placeholder = 'Select an option...', options, value, onValueChange, required = false, className }) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label && (
        <label className="text-sm font-medium text-text">
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </label>
      )}
      <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
        <SelectPrimitive.Trigger
          className={clsx(
            'flex h-10 w-full items-center justify-between rounded-lg border bg-surface px-3 text-sm transition-all duration-200',
            'hover:border-border-hover focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'data-[placeholder]:text-text-muted',
            error ? 'border-error' : 'border-border',
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon>
            <ChevronDown className="h-4 w-4 text-text-muted" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="z-[var(--bmn-z-dropdown)] overflow-hidden rounded-lg border border-border bg-surface shadow-lg animate-scale-in"
            position="popper"
            sideOffset={4}
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className="relative flex h-9 cursor-pointer items-center rounded-md px-8 text-sm text-text outline-none hover:bg-surface-hover data-[highlighted]:bg-surface-hover data-[state=checked]:text-primary"
                >
                  <SelectPrimitive.ItemIndicator className="absolute left-2">
                    <Check className="h-4 w-4" />
                  </SelectPrimitive.ItemIndicator>
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

export { Select };
```

```jsx
// src/components/ui/Checkbox.jsx

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * @param {Object} props
 * @param {string} props.label
 * @param {boolean} [props.checked]
 * @param {(checked: boolean) => void} [props.onCheckedChange]
 * @param {string} [props.error]
 */
function Checkbox({ label, checked, onCheckedChange, error, className, ...props }) {
  return (
    <div className={clsx('flex items-start gap-2', className)}>
      <CheckboxPrimitive.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={clsx(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all duration-200',
          'hover:border-primary focus-visible:outline-2 focus-visible:outline-primary',
          checked ? 'border-primary bg-primary' : 'border-border bg-surface',
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator>
          <Check className="h-3.5 w-3.5 text-primary-foreground" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <label className="text-sm text-text leading-5 cursor-pointer" onClick={() => onCheckedChange?.(!checked)}>
        {label}
      </label>
    </div>
  );
}

export { Checkbox };
```

```jsx
// src/components/ui/Radio.jsx

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { clsx } from 'clsx';

/**
 * @param {Object} props
 * @param {string} [props.label]
 * @param {Array<{value: string, label: string, description?: string}>} props.options
 * @param {string} [props.value]
 * @param {(value: string) => void} props.onValueChange
 * @param {'vertical' | 'horizontal'} [props.orientation='vertical']
 */
function Radio({ label, options, value, onValueChange, orientation = 'vertical', className }) {
  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      {label && <span className="text-sm font-medium text-text">{label}</span>}
      <RadioGroupPrimitive.Root
        value={value}
        onValueChange={onValueChange}
        className={clsx('flex gap-3', orientation === 'horizontal' ? 'flex-row' : 'flex-col')}
      >
        {options.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-start gap-2">
            <RadioGroupPrimitive.Item
              value={option.value}
              className={clsx(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200',
                'hover:border-primary focus-visible:outline-2 focus-visible:outline-primary',
                value === option.value ? 'border-primary' : 'border-border',
              )}
            >
              <RadioGroupPrimitive.Indicator className="h-2.5 w-2.5 rounded-full bg-primary" />
            </RadioGroupPrimitive.Item>
            <div>
              <span className="text-sm text-text">{option.label}</span>
              {option.description && (
                <p className="text-xs text-text-muted">{option.description}</p>
              )}
            </div>
          </label>
        ))}
      </RadioGroupPrimitive.Root>
    </div>
  );
}

export { Radio };
```

```jsx
// src/components/ui/Drawer.jsx

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 * @param {string} [props.title]
 * @param {'left' | 'right'} [props.side='right']
 * @param {'sm' | 'md' | 'lg'} [props.size='md']
 * @param {import('react').ReactNode} props.children
 */
function Drawer({ open, onOpenChange, title, side = 'right', size = 'md', children }) {
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--bmn-z-overlay)] bg-surface-overlay data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <Dialog.Content
          className={clsx(
            'fixed top-0 z-[var(--bmn-z-modal)] h-full w-full bg-surface shadow-xl focus:outline-none',
            sizes[size],
            side === 'right' && 'right-0 data-[state=open]:animate-[slide-in-right_0.3s_ease-out]',
            side === 'left' && 'left-0 data-[state=open]:animate-[slide-in-right_0.3s_ease-out]',
          )}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              {title && <Dialog.Title className="text-lg font-semibold text-text">{title}</Dialog.Title>}
              <Dialog.Close className="rounded-md p-1 text-text-muted hover:text-text transition-colors">
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { Drawer };
```

---

## 3. Routing (React Router v7)

### 3.1 App Entry Point + Provider Stack

```jsx
// src/main.jsx

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import '@styles/global.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

```jsx
// src/App.jsx

import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ToastProvider } from '@components/ui/ToastProvider.jsx';
import { LoadingSpinner } from '@components/ui/LoadingSpinner.jsx';
import { ErrorBoundary } from '@components/ui/ErrorBoundary.jsx';
import { initPostHog } from '@lib/posthog-client.js';
import { requireAuth, requireAdmin, redirectIfAuthed } from '@lib/route-guards.js';

// Initialize analytics
initPostHog();

// --- Lazy route imports (code-split per route) ---
const RootLayout = lazy(() => import('@routes/root-layout.jsx'));
const Login = lazy(() => import('@routes/auth/login.jsx'));
const Signup = lazy(() => import('@routes/auth/signup.jsx'));
const ForgotPassword = lazy(() => import('@routes/auth/forgot-password.jsx'));
const AuthCallback = lazy(() => import('@routes/auth/callback.jsx'));
const WizardLayout = lazy(() => import('@routes/wizard/layout.jsx'));
const Onboarding = lazy(() => import('@routes/wizard/onboarding.jsx'));
const SocialAnalysis = lazy(() => import('@routes/wizard/social-analysis.jsx'));
const BrandIdentity = lazy(() => import('@routes/wizard/brand-identity.jsx'));
const Customization = lazy(() => import('@routes/wizard/customization.jsx'));
const LogoGeneration = lazy(() => import('@routes/wizard/logo-generation.jsx'));
const LogoRefinement = lazy(() => import('@routes/wizard/logo-refinement.jsx'));
const ProductSelection = lazy(() => import('@routes/wizard/product-selection.jsx'));
const MockupReview = lazy(() => import('@routes/wizard/mockup-review.jsx'));
const BundleBuilder = lazy(() => import('@routes/wizard/bundle-builder.jsx'));
const ProfitCalculator = lazy(() => import('@routes/wizard/profit-calculator.jsx'));
const Checkout = lazy(() => import('@routes/wizard/checkout.jsx'));
const Complete = lazy(() => import('@routes/wizard/complete.jsx'));
const DashboardLayout = lazy(() => import('@routes/dashboard/layout.jsx'));
const Brands = lazy(() => import('@routes/dashboard/brands.jsx'));
const BrandDetail = lazy(() => import('@routes/dashboard/brand-detail.jsx'));
const Settings = lazy(() => import('@routes/dashboard/settings.jsx'));
const AdminLayout = lazy(() => import('@routes/admin/layout.jsx'));
const AdminUsers = lazy(() => import('@routes/admin/users.jsx'));
const AdminProducts = lazy(() => import('@routes/admin/products.jsx'));
const AdminJobs = lazy(() => import('@routes/admin/jobs.jsx'));
const AdminModeration = lazy(() => import('@routes/admin/moderation.jsx'));
const AdminHealth = lazy(() => import('@routes/admin/health.jsx'));

// --- Query Client ---
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      gcTime: 1000 * 60 * 10,   // 10 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// --- Route Tree ---
const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      // --- Auth routes (redirect if already logged in) ---
      {
        loader: redirectIfAuthed,
        children: [
          { path: '/login', element: <Login /> },
          { path: '/signup', element: <Signup /> },
          { path: '/forgot-password', element: <ForgotPassword /> },
        ],
      },
      { path: '/auth/callback', element: <AuthCallback /> },

      // --- Wizard routes (auth required) ---
      {
        path: '/wizard',
        loader: requireAuth,
        element: <WizardLayout />,
        children: [
          { index: true, element: <Onboarding /> },
          { path: 'onboarding', element: <Onboarding /> },
          { path: 'social-analysis', element: <SocialAnalysis /> },
          { path: 'brand-identity', element: <BrandIdentity /> },
          { path: 'customization', element: <Customization /> },
          { path: 'logo-generation', element: <LogoGeneration /> },
          { path: 'logo-refinement', element: <LogoRefinement /> },
          { path: 'product-selection', element: <ProductSelection /> },
          { path: 'mockup-review', element: <MockupReview /> },
          { path: 'bundle-builder', element: <BundleBuilder /> },
          { path: 'profit-calculator', element: <ProfitCalculator /> },
          { path: 'checkout', element: <Checkout /> },
          { path: 'complete', element: <Complete /> },
        ],
      },

      // --- Dashboard routes (auth required) ---
      {
        path: '/dashboard',
        loader: requireAuth,
        element: <DashboardLayout />,
        children: [
          { index: true, element: <Brands /> },
          { path: 'brands/:brandId', element: <BrandDetail /> },
          { path: 'settings', element: <Settings /> },
        ],
      },

      // --- Admin routes (auth + admin required) ---
      {
        path: '/admin',
        loader: requireAdmin,
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminUsers /> },
          { path: 'users', element: <AdminUsers /> },
          { path: 'products', element: <AdminProducts /> },
          { path: 'jobs', element: <AdminJobs /> },
          { path: 'moderation', element: <AdminModeration /> },
          { path: 'health', element: <AdminHealth /> },
        ],
      },

      // --- Catch-all: redirect to dashboard ---
      { path: '*', element: <Brands /> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Suspense fallback={<LoadingSpinner fullPage />}>
          <RouterProvider router={router} />
        </Suspense>
      </ToastProvider>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
```

### 3.2 Route Guards

```javascript
// src/lib/route-guards.js

import { redirect } from 'react-router';
import { supabase } from '@lib/supabase-client.js';

/**
 * Loader guard: redirects to /login if not authenticated.
 * Attach to any route that requires a logged-in user.
 */
export async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw redirect('/login');
  }
  return { session };
}

/**
 * Loader guard: redirects to /login if not authenticated,
 * redirects to /dashboard if not admin.
 */
export async function requireAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw redirect('/login');
  }

  // Check admin role from user metadata or profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (profile?.role !== 'admin') {
    throw redirect('/dashboard');
  }

  return { session, profile };
}

/**
 * Loader guard: redirects to /dashboard if already logged in.
 * Attach to auth pages (login, signup).
 */
export async function redirectIfAuthed() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    throw redirect('/dashboard');
  }
  return null;
}
```

### 3.3 Root Layout

```jsx
// src/routes/root-layout.jsx

import { Outlet, useNavigation } from 'react-router';
import { useEffect } from 'react';
import { ToastViewport } from '@components/ui/Toast.jsx';
import { ConnectionStatus } from '@components/layout/ConnectionStatus.jsx';
import { ChatWidget } from '@components/chat/ChatWidget.jsx';
import { useAuthStore } from '@stores/auth-store.js';
import { useSocket } from '@hooks/use-socket.js';
import { supabase } from '@lib/supabase-client.js';

export default function RootLayout() {
  const navigation = useNavigation();
  const setUser = useAuthStore((s) => s.setUser);
  const setSession = useAuthStore((s) => s.setSession);
  const user = useAuthStore((s) => s.user);

  // Connect socket when authenticated
  useSocket();

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      },
    );
    return () => subscription.unsubscribe();
  }, [setUser, setSession]);

  return (
    <div className="min-h-screen bg-background">
      {/* Route transition loading bar */}
      {navigation.state === 'loading' && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-primary animate-[progress-indeterminate_1s_ease-in-out_infinite]" />
      )}

      <Outlet />

      {/* Global overlays */}
      {user && <ChatWidget />}
      <ConnectionStatus />
      <ToastViewport />
    </div>
  );
}
```

### 3.4 Wizard Layout (Nesting: Root Layout > Wizard Layout > Step)

```jsx
// src/routes/wizard/layout.jsx

import { Outlet, useLocation, useNavigate } from 'react-router';
import { WizardProgressBar } from '@components/wizard/WizardProgressBar.jsx';
import { StepNavigation } from '@components/wizard/StepNavigation.jsx';
import { AppHeader } from '@components/layout/AppHeader.jsx';
import { useWizardStore } from '@stores/wizard-store.js';
import { WIZARD_STEPS } from '@lib/constants.js';

export default function WizardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentStep = useWizardStore((s) => s.meta.currentStep);
  const setStep = useWizardStore((s) => s.setStep);

  // Derive step index from URL
  const currentPath = location.pathname.split('/wizard/')[1] || 'onboarding';
  const stepIndex = WIZARD_STEPS.findIndex((s) => s.path === currentPath);

  const handleNext = () => {
    if (stepIndex < WIZARD_STEPS.length - 1) {
      const nextPath = WIZARD_STEPS[stepIndex + 1].path;
      setStep(nextPath);
      navigate(`/wizard/${nextPath}`);
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      const prevPath = WIZARD_STEPS[stepIndex - 1].path;
      setStep(prevPath);
      navigate(`/wizard/${prevPath}`);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-wizard-bg">
      <AppHeader />
      <WizardProgressBar
        steps={WIZARD_STEPS}
        currentIndex={stepIndex}
      />

      <main className="mx-auto flex w-full max-w-[var(--bmn-max-width-wizard)] flex-1 flex-col px-4 py-8">
        <Outlet context={{ handleNext, handleBack, stepIndex }} />
      </main>

      <StepNavigation
        stepIndex={stepIndex}
        totalSteps={WIZARD_STEPS.length}
        onNext={handleNext}
        onBack={handleBack}
      />
    </div>
  );
}
```

### 3.5 Constants (Wizard Steps + Routes)

```javascript
// src/lib/constants.js

/**
 * @typedef {Object} WizardStepDef
 * @property {string} path — URL segment (e.g. 'social-analysis')
 * @property {string} label — Display name (e.g. 'Social Analysis')
 * @property {string} description — Short description
 * @property {number} index — 0-based step index
 * @property {boolean} [skippable=false] — Whether the step can be skipped
 */

/** @type {WizardStepDef[]} */
export const WIZARD_STEPS = [
  { path: 'onboarding', label: 'Welcome', description: 'Get started', index: 0 },
  { path: 'social-analysis', label: 'Social Analysis', description: 'Analyze your presence', index: 1 },
  { path: 'brand-identity', label: 'Brand Identity', description: 'Your brand DNA', index: 2 },
  { path: 'customization', label: 'Customization', description: 'Colors, fonts, style', index: 3 },
  { path: 'logo-generation', label: 'Logo Generation', description: 'Create your logo', index: 4 },
  { path: 'logo-refinement', label: 'Logo Refinement', description: 'Perfect your logo', index: 5, skippable: true },
  { path: 'product-selection', label: 'Products', description: 'Choose your products', index: 6 },
  { path: 'mockup-review', label: 'Mockups', description: 'Review product mockups', index: 7 },
  { path: 'bundle-builder', label: 'Bundles', description: 'Create bundles', index: 8, skippable: true },
  { path: 'profit-calculator', label: 'Profits', description: 'Revenue projections', index: 9 },
  { path: 'checkout', label: 'Checkout', description: 'Choose your plan', index: 10 },
  { path: 'complete', label: 'Complete', description: 'Your brand is ready!', index: 11 },
];

/** Subscription tier definitions */
export const SUBSCRIPTION_TIERS = [
  { id: 'free', name: 'Free Trial', price: 0, brands: 1, logos: 4, mockups: 4, features: ['Basic wizard', 'No download'] },
  { id: 'starter', name: 'Starter', price: 29, brands: 3, logos: 20, mockups: 30, features: ['Download assets', 'Email support'] },
  { id: 'pro', name: 'Pro', price: 79, brands: 10, logos: 50, mockups: 100, features: ['Priority generation', 'Video (Phase 2)', 'Chat support'] },
  { id: 'agency', name: 'Agency', price: 199, brands: -1, logos: 200, mockups: 500, features: ['White-label', 'API access', 'Phone support'] },
];

/** Product categories */
export const PRODUCT_CATEGORIES = ['Apparel', 'Accessories', 'Home Goods', 'Packaging', 'Digital'];

/** Logo style options */
export const LOGO_STYLES = [
  { id: 'minimal', label: 'Minimal', description: 'Clean lines, simple shapes', preview: '/images/styles/minimal.png' },
  { id: 'bold', label: 'Bold', description: 'Strong, impactful, eye-catching', preview: '/images/styles/bold.png' },
  { id: 'vintage', label: 'Vintage', description: 'Classic, timeless, retro', preview: '/images/styles/vintage.png' },
  { id: 'modern', label: 'Modern', description: 'Contemporary, sleek, forward', preview: '/images/styles/modern.png' },
  { id: 'playful', label: 'Playful', description: 'Fun, energetic, creative', preview: '/images/styles/playful.png' },
];

/** Brand archetype options */
export const BRAND_ARCHETYPES = [
  'The Creator', 'The Explorer', 'The Sage', 'The Hero',
  'The Rebel', 'The Magician', 'The Lover', 'The Caregiver',
  'The Jester', 'The Ruler', 'The Innocent', 'The Everyman',
];

/** Socket event names */
export const SOCKET_EVENTS = {
  AGENT_TOOL_COMPLETE: 'agent:tool-complete',
  AGENT_TOOL_ERROR: 'agent:tool-error',
  AGENT_MESSAGE: 'agent:message',
  AGENT_COMPLETE: 'agent:complete',
  GENERATION_PROGRESS: 'generation:progress',
  GENERATION_COMPLETE: 'generation:complete',
  GENERATION_ERROR: 'generation:error',
  BRAND_UPDATED: 'brand:updated',
  CHAT_MESSAGE: 'chat:message',
  CHAT_TYPING: 'chat:typing',
};
```

---

## 4. Wizard Routes (12 Steps)

### Step 1: `/wizard/onboarding` — Welcome

**Component:** `src/routes/wizard/onboarding.jsx`

**Data requirements:** Auth session from Supabase. Checks if user has an existing in-progress brand (resume flow).

**Form fields:** Phone number (if not already on profile), Terms & Conditions acceptance.

**Zod Schema:**

```javascript
// In src/lib/validation-schemas.js (onboarding section)

import { z } from 'zod';

export const onboardingSchema = z.object({
  phone: z
    .string()
    .min(10, 'Phone number must be at least 10 digits')
    .max(15, 'Phone number too long')
    .regex(/^\+?[1-9]\d{9,14}$/, 'Enter a valid phone number'),
  termsAccepted: z
    .boolean()
    .refine((val) => val === true, 'You must accept the Terms & Conditions'),
});
```

**API calls:**
- `GET /api/v1/brands?status=draft` — Check for in-progress brands (TanStack Query)
- `PATCH /api/v1/users/profile` — Save phone number, TC accepted timestamp
- `POST /api/v1/brands` — Create new brand record (returns `brandId`)

**Socket.io events:** None at this step.

**Navigation logic:**
- If existing draft brand found: offer "Resume" button that navigates to the saved `wizard_step`
- After form submission: creates brand record, saves `brandId` to wizard store, navigates to `social-analysis`
- No "Back" button on this step (first step)

**UI description:** Welcome hero section with animated brand creation illustration. Heading: "Let's build your brand." Subheading: "From your social media presence to a complete branded product line in minutes." Phone input with country code selector. Terms & Conditions checkbox with link to full terms. "Start Building" CTA button. Below: "Already started? Resume your brand" link if draft exists.

**Component:**

```jsx
// src/routes/wizard/onboarding.jsx

import { useOutletContext, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@components/ui/Button.jsx';
import { Input } from '@components/ui/Input.jsx';
import { Checkbox } from '@components/ui/Checkbox.jsx';
import { Card } from '@components/ui/Card.jsx';
import { useWizardStore } from '@stores/wizard-store.js';
import { useAuthStore } from '@stores/auth-store.js';
import { useToast } from '@hooks/use-toast.js';
import { apiClient } from '@lib/api-client.js';
import { onboardingSchema } from '@lib/validation-schemas.js';

export default function Onboarding() {
  const { handleNext } = useOutletContext();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setMeta = useWizardStore((s) => s.setMeta);
  const { showToast } = useToast();

  // Check for existing draft brands
  const { data: draftBrands } = useQuery({
    queryKey: ['brands', 'drafts'],
    queryFn: () => apiClient.get('/api/v1/brands', { params: { status: 'draft' } }),
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      phone: user?.phone || '',
      termsAccepted: false,
    },
  });

  // Save profile mutation
  const updateProfile = useMutation({
    mutationFn: (data) => apiClient.patch('/api/v1/users/profile', data),
  });

  // Create brand mutation
  const createBrand = useMutation({
    mutationFn: () => apiClient.post('/api/v1/brands'),
    onSuccess: (brand) => {
      setMeta({ brandId: brand.id, currentStep: 'social-analysis' });
      handleNext();
    },
    onError: (err) => {
      showToast({ type: 'error', title: 'Failed to create brand', description: err.message });
    },
  });

  const onSubmit = async (data) => {
    await updateProfile.mutateAsync({
      phone: data.phone,
      tc_accepted_at: new Date().toISOString(),
    });
    await createBrand.mutateAsync();
  };

  const handleResume = (brand) => {
    setMeta({ brandId: brand.id, currentStep: brand.wizard_step });
    navigate(`/wizard/${brand.wizard_step}`);
  };

  const termsAccepted = watch('termsAccepted');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center gap-8"
    >
      {/* Hero */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light"
        >
          <Sparkles className="h-8 w-8 text-primary" />
        </motion.div>
        <h1 className="text-3xl font-bold text-text">Let's build your brand</h1>
        <p className="mt-2 text-lg text-text-secondary">
          From your social media presence to a complete branded product line in minutes.
        </p>
      </div>

      {/* Resume existing brand */}
      {draftBrands?.length > 0 && (
        <Card variant="outlined" className="w-full max-w-md">
          <p className="text-sm font-medium text-text">Continue where you left off?</p>
          {draftBrands.map((brand) => (
            <button
              key={brand.id}
              onClick={() => handleResume(brand)}
              className="mt-2 flex w-full items-center justify-between rounded-lg border border-border p-3 hover:bg-surface-hover transition-colors"
            >
              <span className="text-sm text-text">{brand.name || 'Untitled Brand'}</span>
              <ArrowRight className="h-4 w-4 text-text-muted" />
            </button>
          ))}
        </Card>
      )}

      {/* Onboarding form */}
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-md space-y-6">
        <Input
          label="Phone Number"
          placeholder="+1 (555) 123-4567"
          error={errors.phone?.message}
          required
          {...register('phone')}
        />

        <Checkbox
          label={
            <>
              I agree to the{' '}
              <a href="/terms" target="_blank" className="text-text-link hover:text-text-link-hover underline">
                Terms & Conditions
              </a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" className="text-text-link hover:text-text-link-hover underline">
                Privacy Policy
              </a>
            </>
          }
          checked={termsAccepted}
          onCheckedChange={(checked) => setValue('termsAccepted', checked, { shouldValidate: true })}
          error={errors.termsAccepted?.message}
        />

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={updateProfile.isPending || createBrand.isPending}
          rightIcon={<ArrowRight className="h-5 w-5" />}
        >
          Start Building
        </Button>
      </form>
    </motion.div>
  );
}
```

---

### Step 2: `/wizard/social-analysis` — Social Media Analysis

**Component:** `src/routes/wizard/social-analysis.jsx`

**Data requirements:** `brandId` from wizard store. Current brand record from API.

**Form fields:** Social media handles (Instagram, TikTok, Facebook). At least one required.

**Zod Schema:**

```javascript
export const socialAnalysisSchema = z.object({
  instagram: z
    .string()
    .regex(/^@?[a-zA-Z0-9._]{1,30}$/, 'Enter a valid Instagram handle')
    .optional()
    .or(z.literal('')),
  tiktok: z
    .string()
    .regex(/^@?[a-zA-Z0-9._]{1,24}$/, 'Enter a valid TikTok handle')
    .optional()
    .or(z.literal('')),
  facebook: z
    .string()
    .min(1)
    .optional()
    .or(z.literal('')),
}).refine(
  (data) => data.instagram || data.tiktok || data.facebook,
  { message: 'At least one social media handle is required', path: ['instagram'] },
);
```

**API calls:**
- `POST /api/v1/wizard/analyze-social` — Submits handles, starts BullMQ job. Returns `{ jobId }`.
- `GET /api/v1/brands/:brandId` — Fetch current brand to check if analysis already done.

**Socket.io events:**
- Joins room: `job:{jobId}` on `/wizard` namespace
- Listens to `generation:progress` — `{ status: string, progress: number, message: string }`
- Listens to `generation:complete` — `{ result: { vision, values, archetype, targetAudience, socialData } }`
- Listens to `generation:error` — `{ error: string }`

**Navigation logic:**
- After analysis completes: auto-navigates to `brand-identity` after 1.5-second delay (lets user see 100% completion)
- Back: returns to `onboarding`
- Cannot proceed until analysis completes or has been skipped with manual entry

**UI description:** Three social media handle inputs with platform icons (Instagram pink, TikTok black, Facebook blue). "Analyze My Presence" CTA button. After submission: GenerationProgress component shows real-time analysis phases: "Scraping Instagram profile..." -> "Analyzing visual aesthetic..." -> "Extracting brand DNA..." -> "Generating brand identity..." -> "Complete!" with green checkmark. Progress bar fills in real time via Socket.io events.

**Component:**

```jsx
// src/routes/wizard/social-analysis.jsx

import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { Instagram, Music2, Facebook, Search } from 'lucide-react';
import { Button } from '@components/ui/Button.jsx';
import { Input } from '@components/ui/Input.jsx';
import { GenerationProgress } from '@components/wizard/GenerationProgress.jsx';
import { SocialHandleInput } from '@components/wizard/SocialHandleInput.jsx';
import { useWizardStore } from '@stores/wizard-store.js';
import { useGenerationProgress } from '@hooks/use-generation-progress.js';
import { useToast } from '@hooks/use-toast.js';
import { apiClient } from '@lib/api-client.js';
import { socialAnalysisSchema } from '@lib/validation-schemas.js';

export default function SocialAnalysis() {
  const { handleNext, handleBack } = useOutletContext();
  const brandId = useWizardStore((s) => s.meta.brandId);
  const setBrand = useWizardStore((s) => s.setBrand);
  const setMeta = useWizardStore((s) => s.setMeta);
  const { showToast } = useToast();
  const [jobId, setJobId] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(socialAnalysisSchema),
    defaultValues: { instagram: '', tiktok: '', facebook: '' },
  });

  // Real-time generation progress via Socket.io
  const { progress, status, message, isComplete, isError, result, error } =
    useGenerationProgress(jobId);

  // Start analysis mutation
  const startAnalysis = useMutation({
    mutationFn: (data) =>
      apiClient.post('/api/v1/wizard/analyze-social', { brandId, handles: data }),
    onSuccess: (response) => {
      setJobId(response.jobId);
      setMeta({ activeJobId: response.jobId });
    },
    onError: (err) => {
      showToast({ type: 'error', title: 'Analysis failed', description: err.message });
    },
  });

  // When generation completes, save to store and advance
  if (isComplete && result) {
    setBrand({
      name: result.name,
      vision: result.vision,
      archetype: result.archetype,
      values: result.values,
      targetAudience: result.targetAudience,
    });
    // Auto-advance after brief delay to let user see completion
    setTimeout(() => handleNext(), 1500);
  }

  const onSubmit = (data) => {
    // Clean handles: remove @ prefix if present
    const handles = {
      instagram: data.instagram?.replace(/^@/, '') || undefined,
      tiktok: data.tiktok?.replace(/^@/, '') || undefined,
      facebook: data.facebook || undefined,
    };
    startAnalysis.mutate(handles);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-8"
    >
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text">Analyze Your Social Presence</h1>
        <p className="mt-2 text-text-secondary">
          We'll analyze your social media to understand your aesthetic, audience, and brand DNA.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!jobId ? (
          <motion.form
            key="form"
            exit={{ opacity: 0, y: -20 }}
            onSubmit={handleSubmit(onSubmit)}
            className="w-full max-w-md space-y-4"
          >
            <SocialHandleInput
              label="Instagram"
              icon={<Instagram className="h-5 w-5 text-pink-500" />}
              placeholder="@yourhandle"
              error={errors.instagram?.message}
              {...register('instagram')}
            />

            <SocialHandleInput
              label="TikTok"
              icon={<Music2 className="h-5 w-5" />}
              placeholder="@yourhandle"
              error={errors.tiktok?.message}
              {...register('tiktok')}
            />

            <SocialHandleInput
              label="Facebook"
              icon={<Facebook className="h-5 w-5 text-blue-600" />}
              placeholder="Your page name or URL"
              error={errors.facebook?.message}
              {...register('facebook')}
            />

            {errors.instagram?.type === 'custom' && (
              <p className="text-sm text-error">{errors.instagram.message}</p>
            )}

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={startAnalysis.isPending}
              leftIcon={<Search className="h-5 w-5" />}
            >
              Analyze My Presence
            </Button>
          </motion.form>
        ) : (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <GenerationProgress
              progress={progress}
              status={status}
              message={message}
              isComplete={isComplete}
              isError={isError}
              error={error}
              onRetry={() => {
                setJobId(null);
                setMeta({ activeJobId: null });
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
```

---

### Step 3: `/wizard/brand-identity` — Review/Edit Brand Identity

**Component:** `src/routes/wizard/brand-identity.jsx`

**Data requirements:** Brand data from wizard store (populated by social analysis step). Brand record from API for persistence.

**Form fields:** Brand name, vision statement, archetype (select), values (multi-select/tags), target audience (textarea).

**Zod Schema:**

```javascript
export const brandIdentitySchema = z.object({
  name: z
    .string()
    .min(2, 'Brand name must be at least 2 characters')
    .max(50, 'Brand name must be under 50 characters'),
  vision: z
    .string()
    .min(20, 'Vision statement should be at least 20 characters')
    .max(500, 'Vision statement must be under 500 characters'),
  archetype: z
    .string()
    .min(1, 'Please select a brand archetype'),
  values: z
    .array(z.string().min(1))
    .min(2, 'Select at least 2 brand values')
    .max(6, 'Select up to 6 brand values'),
  targetAudience: z
    .string()
    .min(10, 'Describe your target audience (at least 10 characters)')
    .max(300, 'Target audience description must be under 300 characters'),
});
```

**API calls:**
- `PATCH /api/v1/brands/:brandId` — Save edited brand identity fields
- `GET /api/v1/brands/:brandId` — Fetch brand if wizard store is empty (resume flow)

**Socket.io events:** None at this step.

**Navigation logic:**
- Back: returns to `social-analysis`
- Next: saves brand identity to database, then navigates to `customization`
- All fields pre-populated from AI analysis; user can edit any field

**UI description:** Form with all AI-generated brand identity fields pre-filled and editable. Brand name in large prominent input. Vision statement in textarea with character count. Archetype as visual card selector (12 cards in 3x4 grid, each with icon and description). Values as interactive tag buttons (user can toggle on/off, add custom). Target audience as textarea. "AI-Generated" badge on each field indicating it came from analysis, with "Edit" pencil icon to modify. "Save & Continue" button at bottom.

**Component:**

```jsx
// src/routes/wizard/brand-identity.jsx

import { useEffect } from 'react';
import { useOutletContext } from 'react-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Sparkles, PenLine, ArrowRight } from 'lucide-react';
import { Button } from '@components/ui/Button.jsx';
import { Input } from '@components/ui/Input.jsx';
import { Card } from '@components/ui/Card.jsx';
import { Badge } from '@components/ui/Badge.jsx';
import { useWizardStore } from '@stores/wizard-store.js';
import { useToast } from '@hooks/use-toast.js';
import { apiClient } from '@lib/api-client.js';
import { brandIdentitySchema } from '@lib/validation-schemas.js';
import { BRAND_ARCHETYPES } from '@lib/constants.js';

const VALUE_SUGGESTIONS = [
  'Authenticity', 'Innovation', 'Quality', 'Community', 'Sustainability',
  'Creativity', 'Empowerment', 'Luxury', 'Simplicity', 'Trust',
  'Adventure', 'Inclusivity', 'Excellence', 'Fun', 'Wellness',
];

export default function BrandIdentity() {
  const { handleNext, handleBack } = useOutletContext();
  const brand = useWizardStore((s) => s.brand);
  const brandId = useWizardStore((s) => s.meta.brandId);
  const setBrand = useWizardStore((s) => s.setBrand);
  const { showToast } = useToast();

  // Resume flow: fetch from API if store is empty
  const { data: apiBrand } = useQuery({
    queryKey: ['brand', brandId],
    queryFn: () => apiClient.get(`/api/v1/brands/${brandId}`),
    enabled: !!brandId && !brand.name,
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
    reset,
  } = useForm({
    resolver: zodResolver(brandIdentitySchema),
    defaultValues: {
      name: brand.name || '',
      vision: brand.vision || '',
      archetype: brand.archetype || '',
      values: brand.values || [],
      targetAudience: brand.targetAudience || '',
    },
  });

  // Populate form from API brand (resume flow)
  useEffect(() => {
    if (apiBrand && !brand.name) {
      const defaults = {
        name: apiBrand.name || '',
        vision: apiBrand.vision || '',
        archetype: apiBrand.archetype || '',
        values: apiBrand.brand_values || [],
        targetAudience: apiBrand.target_audience || '',
      };
      reset(defaults);
      setBrand(defaults);
    }
  }, [apiBrand, brand.name, reset, setBrand]);

  const saveBrand = useMutation({
    mutationFn: (data) =>
      apiClient.patch(`/api/v1/brands/${brandId}`, {
        name: data.name,
        vision: data.vision,
        archetype: data.archetype,
        brand_values: data.values,
        target_audience: data.targetAudience,
        wizard_step: 'customization',
      }),
    onSuccess: () => {
      handleNext();
    },
    onError: (err) => {
      showToast({ type: 'error', title: 'Failed to save', description: err.message });
    },
  });

  const onSubmit = (data) => {
    setBrand(data);
    saveBrand.mutate(data);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-8"
    >
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text">Your Brand Identity</h1>
        <p className="mt-2 text-text-secondary">
          We've generated your brand DNA from your social presence. Review and customize.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mx-auto w-full max-w-2xl space-y-6">
        {/* Brand Name */}
        <div className="relative">
          <Badge className="absolute -top-2 right-0 z-10" variant="secondary">
            <Sparkles className="mr-1 h-3 w-3" /> AI-Generated
          </Badge>
          <Input
            label="Brand Name"
            placeholder="Your brand name"
            error={errors.name?.message}
            required
            {...register('name')}
          />
        </div>

        {/* Vision */}
        <div className="relative">
          <Badge className="absolute -top-2 right-0 z-10" variant="secondary">
            <Sparkles className="mr-1 h-3 w-3" /> AI-Generated
          </Badge>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">
              Vision Statement <span className="text-error">*</span>
            </label>
            <textarea
              {...register('vision')}
              rows={4}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted hover:border-border-hover focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder="What does your brand stand for?"
            />
            {errors.vision && <p className="text-xs text-error">{errors.vision.message}</p>}
          </div>
        </div>

        {/* Archetype */}
        <Controller
          name="archetype"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text">
                Brand Archetype <span className="text-error">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {BRAND_ARCHETYPES.map((arch) => (
                  <button
                    type="button"
                    key={arch}
                    onClick={() => field.onChange(arch)}
                    className={`rounded-lg border p-3 text-center text-xs font-medium transition-all ${
                      field.value === arch
                        ? 'border-primary bg-primary-light text-primary'
                        : 'border-border bg-surface text-text-secondary hover:border-border-hover'
                    }`}
                  >
                    {arch}
                  </button>
                ))}
              </div>
              {errors.archetype && <p className="text-xs text-error">{errors.archetype.message}</p>}
            </div>
          )}
        />

        {/* Values */}
        <Controller
          name="values"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-text">
                Brand Values <span className="text-error">*</span>
                <span className="ml-1 text-xs text-text-muted">(select 2-6)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {VALUE_SUGGESTIONS.map((val) => {
                  const selected = field.value.includes(val);
                  return (
                    <button
                      type="button"
                      key={val}
                      onClick={() => {
                        if (selected) {
                          field.onChange(field.value.filter((v) => v !== val));
                        } else if (field.value.length < 6) {
                          field.onChange([...field.value, val]);
                        }
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                        selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-surface text-text-secondary hover:border-border-hover'
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
              {errors.values && <p className="text-xs text-error">{errors.values.message}</p>}
            </div>
          )}
        />

        {/* Target Audience */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">
            Target Audience <span className="text-error">*</span>
          </label>
          <textarea
            {...register('targetAudience')}
            rows={3}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted hover:border-border-hover focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            placeholder="Who is your brand for? Describe your ideal customer."
          />
          {errors.targetAudience && (
            <p className="text-xs text-error">{errors.targetAudience.message}</p>
          )}
        </div>

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={saveBrand.isPending}
          rightIcon={<ArrowRight className="h-5 w-5" />}
        >
          Save & Continue
        </Button>
      </form>
    </motion.div>
  );
}
```

---

### Step 4: `/wizard/customization` — Colors, Fonts, Logo Style

**Component:** `src/routes/wizard/customization.jsx`

**Data requirements:** Brand record from API (AI-suggested color palette, fonts). Brand archetype and vision for context.

**Form fields:** Color palette (array of 4-6 hex colors), primary font, secondary font, logo style selection.

**Zod Schema:**

```javascript
export const customizationSchema = z.object({
  colorPalette: z
    .array(
      z.object({
        hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'),
        name: z.string().min(1, 'Color name required'),
        role: z.enum(['primary', 'secondary', 'accent', 'background', 'text', 'custom']),
      }),
    )
    .min(3, 'Select at least 3 colors')
    .max(8, 'Maximum 8 colors'),
  fonts: z.object({
    primary: z.string().min(1, 'Select a primary font'),
    secondary: z.string().min(1, 'Select a secondary font'),
  }),
  logoStyle: z.enum(['minimal', 'bold', 'vintage', 'modern', 'playful'], {
    required_error: 'Select a logo style',
  }),
});
```

**API calls:**
- `PATCH /api/v1/brands/:brandId` — Save customization choices
- `GET /api/v1/brands/:brandId` — Fetch AI suggestions (if not in store)

**Socket.io events:** None.

**Navigation logic:**
- Back: returns to `brand-identity`
- Next: saves customization, navigates to `logo-generation`
- All selections default to AI suggestions; user can modify any

**UI description:** Three sections in vertical layout. **Colors:** Grid of AI-suggested color swatches with hex codes and role labels. Each swatch is clickable to open a color picker (react-colorful). Add/remove buttons. **Fonts:** Two font preview cards (primary/secondary). Each shows the font name rendered in that font with sample text "The quick brown fox...". Clicking opens a dropdown with 5 AI-recommended options. **Logo Style:** 5 visual style cards in a horizontal row. Each card shows a sample logo in that style with the style name and description. Selected card has purple border and checkmark.

---

### Step 5: `/wizard/logo-generation` — Generate 4 Logos

**Component:** `src/routes/wizard/logo-generation.jsx`

**Data requirements:** `brandId`, brand name, color palette, fonts, logo style from wizard store. Used to compose the generation prompt server-side.

**Form fields:** None (generation trigger only).

**Zod Schema:** None (no form input).

**API calls:**
- `POST /api/v1/generation/logos` — Starts logo generation BullMQ job. Sends `{ brandId }`. Returns `{ jobId }`.
- `GET /api/v1/brands/:brandId/assets?type=logo` — Fetch previously generated logos (resume flow).

**Socket.io events:**
- Joins room: `job:{jobId}` on `/wizard` namespace
- Listens to `generation:progress` — `{ status, progress, message, logoIndex }` (progress for each of 4 logos)
- Listens to `generation:complete` — `{ result: { logos: Array<{ id, url, thumbnailUrl, metadata }> } }`
- Listens to `generation:error` — `{ error: string, logoIndex?: number }`

**Navigation logic:**
- Back: returns to `customization`
- Next: requires one logo to be selected. Navigates to `logo-refinement`.
- "Skip Refinement" button: navigates directly to `product-selection` if user is happy with logo as-is
- "Regenerate All" button: starts a new generation job (consumes 1 generation credit)

**UI description:** "Generate Your Logos" heading with "Generate" CTA button. After clicking: full-width GenerationProgress component showing phases ("Composing prompt...", "Generating logo 1 of 4...", "Generating logo 2 of 4...", etc.). When complete: 2x2 grid of logo cards, each showing the generated logo image at high resolution. Hovering a card shows a subtle scale animation. Clicking a card selects it (purple border, checkmark overlay). Selected logo has "Refine" and "Use This Logo" buttons below grid. "Regenerate All" button in secondary style. Credit count displayed: "4 of 20 logo credits used this month."

**Component:**

```jsx
// src/routes/wizard/logo-generation.jsx

import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { Wand2, Check, RefreshCw, ArrowRight, SkipForward } from 'lucide-react';
import { Button } from '@components/ui/Button.jsx';
import { Card } from '@components/ui/Card.jsx';
import { GenerationProgress } from '@components/wizard/GenerationProgress.jsx';
import { LogoGrid } from '@components/wizard/LogoGrid.jsx';
import { useWizardStore } from '@stores/wizard-store.js';
import { useGenerationProgress } from '@hooks/use-generation-progress.js';
import { useToast } from '@hooks/use-toast.js';
import { apiClient } from '@lib/api-client.js';

export default function LogoGeneration() {
  const { handleNext } = useOutletContext();
  const brandId = useWizardStore((s) => s.meta.brandId);
  const assets = useWizardStore((s) => s.assets);
  const setAssets = useWizardStore((s) => s.setAssets);
  const selectLogo = useWizardStore((s) => s.selectLogo);
  const setMeta = useWizardStore((s) => s.setMeta);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState(null);

  // Check for existing logos (resume flow)
  const { data: existingLogos } = useQuery({
    queryKey: ['brand-assets', brandId, 'logo'],
    queryFn: () => apiClient.get(`/api/v1/brands/${brandId}/assets`, { params: { type: 'logo' } }),
    enabled: !!brandId,
  });

  // Real-time generation progress
  const { progress, status, message, isComplete, isError, result, error } =
    useGenerationProgress(jobId);

  // Start generation mutation
  const startGeneration = useMutation({
    mutationFn: () => apiClient.post('/api/v1/generation/logos', { brandId }),
    onSuccess: (response) => {
      setJobId(response.jobId);
      setMeta({ activeJobId: response.jobId });
    },
    onError: (err) => {
      showToast({ type: 'error', title: 'Generation failed', description: err.message });
    },
  });

  // When generation completes, update store
  useEffect(() => {
    if (isComplete && result?.logos) {
      setAssets({ logos: result.logos });
      queryClient.invalidateQueries({ queryKey: ['brand-assets', brandId, 'logo'] });
    }
  }, [isComplete, result, setAssets, brandId, queryClient]);

  // Use existing logos if available
  const logos = isComplete && result?.logos ? result.logos : existingLogos || assets.logos;
  const hasLogos = logos.length > 0;
  const selectedLogoId = assets.selectedLogoId;

  const handleSelectLogo = (logoId) => {
    selectLogo(logoId);
  };

  const handleContinue = () => {
    if (!selectedLogoId) {
      showToast({ type: 'warning', title: 'Select a logo', description: 'Please select a logo before continuing.' });
      return;
    }
    handleNext();
  };

  const handleSkipRefinement = () => {
    if (!selectedLogoId) {
      showToast({ type: 'warning', title: 'Select a logo first' });
      return;
    }
    // Skip logo refinement, go to product selection
    setMeta({ currentStep: 'product-selection' });
    // Navigate 2 steps ahead handled by wizard layout
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-8"
    >
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text">Generate Your Logos</h1>
        <p className="mt-2 text-text-secondary">
          We'll create 4 unique logo options based on your brand identity.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {/* No logos yet and no active job — show generate button */}
        {!hasLogos && !jobId && (
          <motion.div key="trigger" exit={{ opacity: 0 }} className="text-center">
            <Button
              size="lg"
              onClick={() => startGeneration.mutate()}
              loading={startGeneration.isPending}
              leftIcon={<Wand2 className="h-5 w-5" />}
            >
              Generate 4 Logos
            </Button>
          </motion.div>
        )}

        {/* Generation in progress */}
        {jobId && !hasLogos && (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <GenerationProgress
              progress={progress}
              status={status}
              message={message}
              isComplete={isComplete}
              isError={isError}
              error={error}
              onRetry={() => {
                setJobId(null);
                startGeneration.mutate();
              }}
            />
          </motion.div>
        )}

        {/* Logos ready — show grid */}
        {hasLogos && (
          <motion.div
            key="logos"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl"
          >
            <LogoGrid
              logos={logos}
              selectedId={selectedLogoId}
              onSelect={handleSelectLogo}
            />

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                onClick={handleContinue}
                size="lg"
                disabled={!selectedLogoId}
                rightIcon={<ArrowRight className="h-5 w-5" />}
              >
                Refine This Logo
              </Button>
              <Button
                variant="ghost"
                onClick={handleSkipRefinement}
                disabled={!selectedLogoId}
                rightIcon={<SkipForward className="h-4 w-4" />}
              >
                Skip Refinement
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setJobId(null);
                  startGeneration.mutate();
                }}
                loading={startGeneration.isPending}
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Regenerate All
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
```

---

### Step 6: `/wizard/logo-refinement` — Refine Selected Logo

**Component:** `src/routes/wizard/logo-refinement.jsx`

**Data requirements:** Selected logo from wizard store (ID, URL). Brand name, colors, style. Refinement round count (max 3).

**Form fields:** Refinement instructions (textarea describing desired changes).

**Zod Schema:**

```javascript
export const logoRefinementSchema = z.object({
  instructions: z
    .string()
    .min(10, 'Please describe the changes you want (at least 10 characters)')
    .max(500, 'Keep instructions under 500 characters'),
});
```

**API calls:**
- `POST /api/v1/generation/logos/refine` — Sends `{ brandId, logoId, instructions }`. Starts BullMQ job. Returns `{ jobId }`.

**Socket.io events:**
- Joins room: `job:{jobId}` on `/wizard` namespace
- Listens to `generation:progress` — refinement progress
- Listens to `generation:complete` — `{ result: { logo: { id, url, thumbnailUrl, metadata } } }` (single refined logo)
- Listens to `generation:error`

**Navigation logic:**
- Back: returns to `logo-generation`
- Next: navigates to `product-selection`
- Maximum 3 refinement rounds. Counter shows "Round 1 of 3", "Round 2 of 3", "Round 3 of 3"
- After 3 rounds: refinement form disabled, only "Continue" button available
- Skip: can proceed to `product-selection` at any time

**UI description:** Two-column layout. **Left column:** Current selected logo displayed large (512x512). Below: previous versions in a small thumbnail strip (showing refinement history). **Right column:** "Round X of 3" indicator. Textarea for refinement instructions with placeholder "Make the text larger, change the icon to..., adjust the color to be more...". "Refine Logo" button. Below: GenerationProgress when refinement is running. After refinement completes: new logo appears on left, user can accept or try again. "I'm Happy With This" button to proceed.

---

### Step 7: `/wizard/product-selection` — Browse and Select Products

**Component:** `src/routes/wizard/product-selection.jsx`

**Data requirements:** Product catalog from API. Brand's existing product selections (resume flow). `brandId` from wizard store.

**Form fields:** Product multi-select (checkboxes on product cards). Category filter.

**Zod Schema:**

```javascript
export const productSelectionSchema = z.object({
  selectedSkus: z
    .array(z.string().min(1))
    .min(1, 'Select at least 1 product')
    .max(20, 'Maximum 20 products per brand'),
});
```

**API calls:**
- `GET /api/v1/products?active=true` — Fetch active product catalog (TanStack Query, cached 10 min)
- `POST /api/v1/brands/:brandId/products` — Save selected product SKUs
- `GET /api/v1/brands/:brandId/products` — Fetch previously selected products (resume flow)

**Socket.io events:** None.

**Navigation logic:**
- Back: returns to `logo-refinement` (or `logo-generation` if refinement was skipped)
- Next: saves product selections, navigates to `mockup-review`
- Cannot proceed with 0 products selected

**UI description:** Category filter tabs across top (All, Apparel, Accessories, Home Goods, Packaging, Digital). Below: responsive product grid (3 columns on desktop, 2 on tablet, 1 on mobile). Each ProductCard shows: product image, name, category badge, base cost, suggested retail price. Clicking a card toggles selection (checkmark overlay, purple border). Selected count shown in sticky footer bar: "5 products selected" with "Continue" button. Each card animates on selection (subtle scale bounce).

**Component:**

```jsx
// src/routes/wizard/product-selection.jsx

import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Package, ArrowRight, Check } from 'lucide-react';
import { Button } from '@components/ui/Button.jsx';
import { Tabs } from '@components/ui/Tabs.jsx';
import { Card } from '@components/ui/Card.jsx';
import { Badge } from '@components/ui/Badge.jsx';
import { useWizardStore } from '@stores/wizard-store.js';
import { useToast } from '@hooks/use-toast.js';
import { apiClient } from '@lib/api-client.js';
import { PRODUCT_CATEGORIES } from '@lib/constants.js';

export default function ProductSelection() {
  const { handleNext } = useOutletContext();
  const brandId = useWizardStore((s) => s.meta.brandId);
  const selectedSkus = useWizardStore((s) => s.products.selectedSkus);
  const setProducts = useWizardStore((s) => s.setProducts);
  const { showToast } = useToast();
  const [activeCategory, setActiveCategory] = useState('All');

  // Fetch product catalog
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', 'active'],
    queryFn: () => apiClient.get('/api/v1/products', { params: { active: true } }),
    staleTime: 1000 * 60 * 10, // Cache 10 minutes
  });

  // Filter by category
  const filteredProducts = useMemo(() => {
    if (activeCategory === 'All') return products;
    return products.filter((p) => p.category === activeCategory);
  }, [products, activeCategory]);

  // Toggle product selection
  const toggleProduct = (sku) => {
    const current = new Set(selectedSkus);
    if (current.has(sku)) {
      current.delete(sku);
    } else {
      if (current.size >= 20) {
        showToast({ type: 'warning', title: 'Maximum 20 products' });
        return;
      }
      current.add(sku);
    }
    setProducts({ selectedSkus: Array.from(current) });
  };

  // Save selections mutation
  const saveSelections = useMutation({
    mutationFn: () =>
      apiClient.post(`/api/v1/brands/${brandId}/products`, { skus: selectedSkus }),
    onSuccess: () => handleNext(),
    onError: (err) =>
      showToast({ type: 'error', title: 'Failed to save', description: err.message }),
  });

  const handleContinue = () => {
    if (selectedSkus.length === 0) {
      showToast({ type: 'warning', title: 'Select at least 1 product' });
      return;
    }
    saveSelections.mutate();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6"
    >
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text">Choose Your Products</h1>
        <p className="mt-2 text-text-secondary">
          Select the products you want to brand. We'll generate mockups for each one.
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap justify-center gap-2">
        {['All', ...PRODUCT_CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
              activeCategory === cat
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-surface text-text-secondary hover:border-border-hover'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredProducts.map((product) => {
          const isSelected = selectedSkus.includes(product.sku);
          return (
            <motion.div
              key={product.sku}
              whileTap={{ scale: 0.98 }}
              onClick={() => toggleProduct(product.sku)}
            >
              <Card
                variant="interactive"
                padding="none"
                className={isSelected ? 'ring-2 ring-primary' : ''}
              >
                <div className="relative aspect-square overflow-hidden rounded-t-xl bg-surface-hover">
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary"
                    >
                      <Check className="h-4 w-4 text-primary-foreground" />
                    </motion.div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-text">{product.name}</h3>
                    <Badge variant="secondary">{product.category}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-text-muted">
                    <span>Cost: ${product.base_cost}</span>
                    <span>Retail: ${product.retail_price}</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 flex items-center justify-between rounded-xl border border-border bg-surface p-4 shadow-lg">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-text-muted" />
          <span className="text-sm font-medium text-text">
            {selectedSkus.length} product{selectedSkus.length !== 1 ? 's' : ''} selected
          </span>
        </div>
        <Button
          onClick={handleContinue}
          loading={saveSelections.isPending}
          disabled={selectedSkus.length === 0}
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          Continue
        </Button>
      </div>
    </motion.div>
  );
}
```

---

### Step 8: `/wizard/mockup-review` — Review AI-Generated Mockups

**Component:** `src/routes/wizard/mockup-review.jsx`

**Data requirements:** Selected products from wizard store. `brandId`, selected logo URL. Existing mockups from API (resume flow).

**Form fields:** None (approve/reject actions per mockup).

**Zod Schema:** None (no form input).

**API calls:**
- `POST /api/v1/generation/mockups` — Starts mockup generation BullMQ job for all selected products. Returns `{ jobId }`.
- `PATCH /api/v1/brands/:brandId/mockups/:mockupId` — Approve or reject individual mockup.
- `POST /api/v1/generation/mockups/regenerate` — Regenerate a rejected mockup. Returns `{ jobId }`.
- `GET /api/v1/brands/:brandId/assets?type=mockup` — Fetch existing mockups (resume flow).

**Socket.io events:**
- Joins room: `job:{jobId}` on `/wizard` namespace
- Listens to `generation:progress` — `{ status, progress, message, productSku, mockupIndex }` (per-product progress)
- Listens to `generation:complete` — `{ result: { mockups: Array<{ id, url, productSku, status }> } }`
- Listens to `generation:error`

**Navigation logic:**
- Back: returns to `product-selection`
- Next: requires all mockups to be approved or regenerated. Navigates to `bundle-builder`.
- "Approve All" shortcut button when all mockups look good

**UI description:** Grid of mockup cards (2 columns). Each card shows: product name, mockup image (large), two action buttons below: green "Approve" (checkmark) and red "Reject" (X). Approved mockups have green border and checkmark badge. Rejected mockups show "Regenerating..." with progress bar, then new mockup replaces old one. Top of page: progress summary "7 of 8 mockups approved". GenerationProgress component shown during initial batch generation. After all generated, grid appears with staggered animation.

---

### Step 9: `/wizard/bundle-builder` — Create Product Bundles

**Component:** `src/routes/wizard/bundle-builder.jsx`

**Data requirements:** Selected products with approved mockups. `brandId`. Product pricing data.

**Form fields:** Bundle name, selected products per bundle (multi-select from approved products).

**Zod Schema:**

```javascript
export const bundleSchema = z.object({
  name: z
    .string()
    .min(2, 'Bundle name required')
    .max(50, 'Bundle name must be under 50 characters'),
  productSkus: z
    .array(z.string())
    .min(2, 'A bundle needs at least 2 products')
    .max(10, 'Maximum 10 products per bundle'),
});

export const bundleBuilderSchema = z.object({
  bundles: z
    .array(bundleSchema)
    .min(0)
    .max(5, 'Maximum 5 bundles'),
});
```

**API calls:**
- `POST /api/v1/brands/:brandId/bundles` — Save bundle definitions. Returns bundle IDs.
- `POST /api/v1/generation/bundle-composition` — Generate bundle composition image (Gemini 3 Pro Image). Returns `{ jobId }`.

**Socket.io events:**
- Joins room: `job:{jobId}` on `/wizard` namespace
- Listens to `generation:progress` — composition image generation progress
- Listens to `generation:complete` — `{ result: { compositionUrl } }`

**Navigation logic:**
- Back: returns to `mockup-review`
- Next: saves bundles, navigates to `profit-calculator`
- Skippable: user can skip bundle creation entirely

**UI description:** "Create Bundles" heading with "Add Bundle" button. Each bundle is a Card with: editable name input at top, horizontal scrolling strip of product thumbnails (from approved mockups). "Add Product" button opens a popover showing available products as clickable thumbnails. Remove product by clicking X on thumbnail. Bundle composition preview generated when user clicks "Generate Preview" (shows all products arranged artistically together). Bundle pricing auto-calculated (sum of base costs, suggested bundle discount). "Skip Bundles" ghost button available.

---

### Step 10: `/wizard/profit-calculator` — Revenue Projections

**Component:** `src/routes/wizard/profit-calculator.jsx`

**Data requirements:** Selected products with pricing. Bundles (if created). Brand data.

**Form fields:** Retail price per product (editable via slider), monthly sales volume estimates.

**Zod Schema:**

```javascript
export const profitCalculatorSchema = z.object({
  products: z.array(
    z.object({
      sku: z.string(),
      retailPrice: z
        .number()
        .min(0.01, 'Price must be positive')
        .max(9999.99, 'Price too high'),
      monthlySales: z
        .number()
        .int()
        .min(0, 'Sales cannot be negative')
        .max(99999, 'Sales volume too high'),
    }),
  ),
});
```

**API calls:**
- `POST /api/v1/wizard/projections` — Calculate and save revenue projections. Returns `{ projections }`.
- `PATCH /api/v1/brands/:brandId` — Save customized pricing.

**Socket.io events:** None (pure computation, no AI generation needed).

**Navigation logic:**
- Back: returns to `bundle-builder`
- Next: saves projections, navigates to `checkout`

**UI description:** Two-section layout. **Top section:** Product pricing table. Each row: product name, base cost (fixed), retail price (Radix Slider, draggable, $0.01 to $999.99), margin percentage (auto-calculated, green if > 50%, yellow if 20-50%, red if < 20%), monthly sales input (number stepper). **Bottom section:** Revenue projections with Recharts bar chart. Three scenarios: "Conservative" (0.5x sales estimate), "Target" (1x), "Optimistic" (2x). Chart shows monthly revenue and monthly profit. Summary cards: "Total Monthly Revenue", "Total Monthly Profit", "Average Margin %". All calculations update in real-time as user adjusts sliders.

**Component:**

```jsx
// src/routes/wizard/profit-calculator.jsx

import { useMemo } from 'react';
import { useOutletContext } from 'react-router';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { DollarSign, TrendingUp, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Button } from '@components/ui/Button.jsx';
import { Card, CardTitle, CardContent } from '@components/ui/Card.jsx';
import { Input } from '@components/ui/Input.jsx';
import { useWizardStore } from '@stores/wizard-store.js';
import { useToast } from '@hooks/use-toast.js';
import { apiClient } from '@lib/api-client.js';
import { profitCalculatorSchema } from '@lib/validation-schemas.js';

export default function ProfitCalculator() {
  const { handleNext } = useOutletContext();
  const brandId = useWizardStore((s) => s.meta.brandId);
  const selectedSkus = useWizardStore((s) => s.products.selectedSkus);
  const { showToast } = useToast();

  // Fetch product details for selected SKUs
  const { data: products = [] } = useQuery({
    queryKey: ['products', 'selected', selectedSkus],
    queryFn: () => apiClient.get('/api/v1/products', { params: { skus: selectedSkus.join(',') } }),
    enabled: selectedSkus.length > 0,
  });

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm({
    resolver: zodResolver(profitCalculatorSchema),
    defaultValues: {
      products: products.map((p) => ({
        sku: p.sku,
        retailPrice: Number(p.retail_price) || Number(p.base_cost) * 2.5,
        monthlySales: 50,
      })),
    },
  });

  const watchedProducts = watch('products');

  // Calculate projections in real-time
  const projections = useMemo(() => {
    if (!watchedProducts?.length || !products.length) return null;

    let totalRevenue = 0;
    let totalProfit = 0;
    let totalCost = 0;

    const perProduct = watchedProducts.map((wp, i) => {
      const product = products[i];
      if (!product) return null;
      const baseCost = Number(product.base_cost);
      const margin = wp.retailPrice - baseCost;
      const marginPct = wp.retailPrice > 0 ? (margin / wp.retailPrice) * 100 : 0;
      const revenue = wp.retailPrice * wp.monthlySales;
      const profit = margin * wp.monthlySales;

      totalRevenue += revenue;
      totalProfit += profit;
      totalCost += baseCost * wp.monthlySales;

      return {
        name: product.name,
        sku: product.sku,
        baseCost,
        retailPrice: wp.retailPrice,
        margin,
        marginPct,
        monthlySales: wp.monthlySales,
        revenue,
        profit,
      };
    }).filter(Boolean);

    const avgMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

    // Chart data: 3 scenarios
    const chartData = [
      { scenario: 'Conservative', revenue: totalRevenue * 0.5, profit: totalProfit * 0.5 },
      { scenario: 'Target', revenue: totalRevenue, profit: totalProfit },
      { scenario: 'Optimistic', revenue: totalRevenue * 2, profit: totalProfit * 2 },
    ];

    return { perProduct, totalRevenue, totalProfit, avgMargin, chartData };
  }, [watchedProducts, products]);

  const saveProjections = useMutation({
    mutationFn: (data) =>
      apiClient.post(`/api/v1/wizard/projections`, { brandId, products: data.products }),
    onSuccess: () => handleNext(),
    onError: (err) =>
      showToast({ type: 'error', title: 'Save failed', description: err.message }),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-8"
    >
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text">Profit Projections</h1>
        <p className="mt-2 text-text-secondary">
          Adjust pricing to see your potential revenue and margins.
        </p>
      </div>

      <form onSubmit={handleSubmit((data) => saveProjections.mutate(data))} className="space-y-8">
        {/* Product pricing table */}
        <Card>
          <CardTitle>Product Pricing</CardTitle>
          <CardContent>
            <div className="space-y-4">
              {products.map((product, index) => (
                <div key={product.sku} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:gap-6">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-text">{product.name}</p>
                    <p className="text-xs text-text-muted">Cost: ${product.base_cost}</p>
                  </div>

                  <Controller
                    name={`products.${index}.retailPrice`}
                    control={control}
                    render={({ field }) => (
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-text-muted w-8">$</span>
                        <SliderPrimitive.Root
                          value={[field.value]}
                          onValueChange={([val]) => field.onChange(val)}
                          min={Number(product.base_cost) * 1.1}
                          max={Number(product.base_cost) * 5}
                          step={0.5}
                          className="relative flex w-40 items-center"
                        >
                          <SliderPrimitive.Track className="relative h-1.5 w-full rounded-full bg-border">
                            <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
                          </SliderPrimitive.Track>
                          <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-primary bg-surface shadow-sm focus:outline-none" />
                        </SliderPrimitive.Root>
                        <span className="w-16 text-right text-sm font-medium text-text tabular-nums">
                          ${field.value.toFixed(2)}
                        </span>
                      </div>
                    )}
                  />

                  <Controller
                    name={`products.${index}.monthlySales`}
                    control={control}
                    render={({ field }) => (
                      <Input
                        type="number"
                        min={0}
                        max={99999}
                        className="w-24"
                        value={field.value}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    )}
                  />

                  {/* Live margin indicator */}
                  {projections?.perProduct[index] && (
                    <span className={`text-xs font-bold tabular-nums ${
                      projections.perProduct[index].marginPct > 50
                        ? 'text-success'
                        : projections.perProduct[index].marginPct > 20
                          ? 'text-warning'
                          : 'text-error'
                    }`}>
                      {projections.perProduct[index].marginPct.toFixed(0)}% margin
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Summary cards */}
        {projections && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card variant="elevated" className="text-center">
              <DollarSign className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-2 text-2xl font-bold text-text tabular-nums">
                ${projections.totalRevenue.toFixed(0)}
              </p>
              <p className="text-xs text-text-muted">Monthly Revenue</p>
            </Card>
            <Card variant="elevated" className="text-center">
              <TrendingUp className="mx-auto h-8 w-8 text-success" />
              <p className="mt-2 text-2xl font-bold text-success tabular-nums">
                ${projections.totalProfit.toFixed(0)}
              </p>
              <p className="text-xs text-text-muted">Monthly Profit</p>
            </Card>
            <Card variant="elevated" className="text-center">
              <p className="text-2xl font-bold text-text tabular-nums">
                {projections.avgMargin.toFixed(0)}%
              </p>
              <p className="text-xs text-text-muted">Average Margin</p>
            </Card>
          </div>
        )}

        {/* Revenue chart */}
        {projections && (
          <Card>
            <CardTitle>Revenue Scenarios</CardTitle>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={projections.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bmn-color-border)" />
                  <XAxis dataKey="scenario" stroke="var(--bmn-color-text-muted)" fontSize={12} />
                  <YAxis stroke="var(--bmn-color-text-muted)" fontSize={12} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--bmn-color-surface)', border: '1px solid var(--bmn-color-border)', borderRadius: '8px' }}
                    formatter={(value) => [`$${value.toFixed(0)}`]}
                  />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="var(--bmn-color-primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Profit" fill="var(--bmn-color-success)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Button
          type="submit"
          fullWidth
          size="lg"
          loading={saveProjections.isPending}
          rightIcon={<ArrowRight className="h-5 w-5" />}
        >
          Continue to Checkout
        </Button>
      </form>
    </motion.div>
  );
}
```

---

### Step 11: `/wizard/checkout` — Stripe Checkout

**Component:** `src/routes/wizard/checkout.jsx`

**Data requirements:** Brand summary data, subscription tiers, current user profile.

**Form fields:** Tier selection (radio cards).

**Zod Schema:**

```javascript
export const checkoutSchema = z.object({
  tierId: z.enum(['free', 'starter', 'pro', 'agency'], {
    required_error: 'Select a subscription tier',
  }),
});
```

**API calls:**
- `POST /api/v1/payments/create-checkout-session` — Creates Stripe Checkout session. Sends `{ tierId, brandId }`. Returns `{ sessionUrl }`.
- `GET /api/v1/users/subscription` — Fetch current subscription status.

**Socket.io events:** None.

**Navigation logic:**
- Back: returns to `profit-calculator`
- On tier select: redirects to Stripe Checkout (hosted page). On success, Stripe redirects back to `/wizard/complete?session_id=...`
- Free tier: skips Stripe, goes directly to `complete`

**UI description:** "Choose Your Plan" heading. Four tier cards in horizontal row (responsive, stacks on mobile). Each card: tier name, price ("/mo"), feature list with checkmarks, brand/logo/mockup limits, highlighted "Popular" badge on Pro tier. CTA button per tier: "Start Free Trial", "Subscribe - $29/mo", "Subscribe - $79/mo", "Subscribe - $199/mo". Selected tier has purple border + glow shadow. Below cards: feature comparison table (collapsible). Fine print: "Cancel anytime. Credits refresh monthly."

---

### Step 12: `/wizard/complete` — Celebration

**Component:** `src/routes/wizard/complete.jsx`

**Data requirements:** Brand summary (name, logo, colors, products, bundles). Payment confirmation (Stripe session ID from URL). `brandId`.

**Form fields:** None.

**Zod Schema:** None.

**API calls:**
- `POST /api/v1/wizard/complete` — Marks brand as complete. Triggers confirmation email. Updates CRM. Returns `{ brand }`.
- `GET /api/v1/brands/:brandId` — Fetch complete brand data.

**Socket.io events:** None.

**Navigation logic:**
- No "Back" button
- "Go to Dashboard" button navigates to `/dashboard/brands/:brandId`
- "Create Another Brand" button navigates to `/wizard/onboarding`
- "Share" button opens native share sheet or copy-link modal

**UI description:** Full-screen celebration. Confetti animation (Motion library) triggers on mount. Large animated checkmark that bounces in. "Your Brand is Ready!" heading with brand name highlighted in primary color. BrandSummaryCard component: logo preview, color palette strip, font samples, product thumbnails, bundle names, projected monthly revenue. Three CTA buttons: "View Dashboard" (primary), "Create Another Brand" (secondary), "Share Your Brand" (ghost with share icon). Below: "A confirmation email has been sent to {email}."

---

## 5. Dashboard Routes

### `/dashboard` — Brand List

**Component:** `src/routes/dashboard/brands.jsx`

**Data requirements:** All brands for current user. Brand logos, status, creation dates.

**API calls:**
- `GET /api/v1/brands` — Fetch all user brands. Returns array of brand summaries.

**UI description:** Dashboard header with "My Brands" title and "New Brand" button (navigates to `/wizard/onboarding`). Below: responsive grid of BrandCard components (3 columns desktop, 2 tablet, 1 mobile). Each BrandCard shows: logo thumbnail (or placeholder icon), brand name, status badge (Draft/Active/Complete), creation date, product count. Cards are clickable (navigate to brand detail). Empty state if no brands: illustration + "Create Your First Brand" CTA.

### `/dashboard/brands/:brandId` — Brand Detail

**Component:** `src/routes/dashboard/brand-detail.jsx`

**Data requirements:** Complete brand record including: identity (name, vision, archetype, values), design (colors, fonts), assets (logos, mockups, bundles), projections, subscription status.

**API calls:**
- `GET /api/v1/brands/:brandId` — Full brand detail
- `GET /api/v1/brands/:brandId/assets` — All assets (logos, mockups, bundles)
- `POST /api/v1/generation/logos` — Regenerate logos (from detail page)
- `GET /api/v1/brands/:brandId/assets/download` — Download ZIP of all assets

**UI description:** Hero section with brand logo (large), brand name, vision statement, color palette strip. Tabbed content below: **Identity** tab (archetype, values, target audience, full vision), **Logos** tab (all logo versions with download buttons, "Regenerate" button), **Mockups** tab (product mockup gallery, each with download), **Bundles** tab (bundle cards with composition images), **Projections** tab (profit calculator chart). Top-right: "Download All Assets" button (ZIP), "Edit Brand" button (returns to wizard), "Delete Brand" button (danger, confirmation modal).

### `/dashboard/settings` — User Settings

**Component:** `src/routes/dashboard/settings.jsx`

**Data requirements:** User profile, subscription details, active brands count.

**Form fields:** Name, email (read-only), phone, theme preference, notification settings.

**Zod Schema:**

```javascript
export const settingsSchema = z.object({
  fullName: z.string().min(1, 'Name is required').max(100),
  phone: z.string().optional(),
  theme: z.enum(['light', 'dark', 'system']),
  emailNotifications: z.boolean(),
});
```

**API calls:**
- `GET /api/v1/users/profile` — Fetch current profile
- `PATCH /api/v1/users/profile` — Update profile fields
- `GET /api/v1/users/subscription` — Fetch subscription details
- `POST /api/v1/payments/create-portal-session` — Opens Stripe Customer Portal (for plan changes, cancellation)
- `DELETE /api/v1/users/account` — Account deletion (GDPR right to erasure)

**UI description:** Two-column layout on desktop. Left column: **Profile** card (name input, email read-only, phone input, "Save" button). **Preferences** card (theme toggle: Light/Dark/System, email notification toggle). Right column: **Subscription** card (current tier name, price, renewal date, usage bar: "12 of 50 logo credits used", "Manage Subscription" button opens Stripe Portal). **Danger Zone** card (red border): "Delete Account" button with confirmation modal warning about permanent data loss.

---

## 6. State Management (Zustand 5)

### 6.1 Wizard Store (Complete)


```javascript
// src/stores/wizard-store.js

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

/**
 * @typedef {Object} ColorEntry
 * @property {string} hex
 * @property {string} name
 * @property {'primary'|'secondary'|'accent'|'background'|'text'|'custom'} role
 */

/**
 * @typedef {Object} FontConfig
 * @property {string} primary
 * @property {string} secondary
 */

/**
 * @typedef {Object} LogoAsset
 * @property {string} id
 * @property {string} url
 * @property {string} [thumbnailUrl]
 * @property {Object} metadata
 * @property {number} [refinementRound]
 */

/**
 * @typedef {Object} MockupAsset
 * @property {string} id
 * @property {string} url
 * @property {string} productSku
 * @property {'pending'|'approved'|'rejected'} status
 */

/**
 * @typedef {Object} BundleDef
 * @property {string} [id]
 * @property {string} name
 * @property {string[]} productSkus
 * @property {string} [compositionUrl]
 */

export const useWizardStore = create(
  devtools(
    persist(
      (set, get) => ({
        // === Brand Identity Slice ===
        brand: {
          name: null,
          vision: null,
          archetype: null,
          values: [],
          targetAudience: null,
        },

        // === Design Slice ===
        design: {
          colorPalette: [],
          fonts: null,
          logoStyle: null,
        },

        // === Assets Slice ===
        assets: {
          logos: [],
          selectedLogoId: null,
          mockups: [],
          selectedMockups: {},
        },

        // === Products Slice ===
        products: {
          selectedSkus: [],
          bundles: [],
        },

        // === Meta Slice ===
        meta: {
          brandId: null,
          currentStep: 'onboarding',
          activeJobId: null,
          sessionId: null,
        },

        // === Slice Setters ===
        setBrand: (data) =>
          set((state) => ({ brand: { ...state.brand, ...data } }), false, 'setBrand'),

        setDesign: (data) =>
          set((state) => ({ design: { ...state.design, ...data } }), false, 'setDesign'),

        setAssets: (data) =>
          set((state) => ({ assets: { ...state.assets, ...data } }), false, 'setAssets'),

        setProducts: (data) =>
          set((state) => ({ products: { ...state.products, ...data } }), false, 'setProducts'),

        setMeta: (data) =>
          set((state) => ({ meta: { ...state.meta, ...data } }), false, 'setMeta'),

        // === Logo Actions ===
        addLogo: (logo) =>
          set(
            (state) => ({
              assets: { ...state.assets, logos: [...state.assets.logos, logo] },
            }),
            false, 'addLogo',
          ),

        selectLogo: (id) =>
          set((state) => ({ assets: { ...state.assets, selectedLogoId: id } }), false, 'selectLogo'),

        // === Mockup Actions ===
        addMockup: (mockup) =>
          set(
            (state) => ({
              assets: { ...state.assets, mockups: [...state.assets.mockups, mockup] },
            }),
            false, 'addMockup',
          ),

        setMockupStatus: (mockupId, status) =>
          set(
            (state) => ({
              assets: {
                ...state.assets,
                mockups: state.assets.mockups.map((m) =>
                  m.id === mockupId ? { ...m, status } : m,
                ),
              },
            }),
            false, 'setMockupStatus',
          ),

        // === Bundle Actions ===
        addBundle: (bundle) =>
          set(
            (state) => ({
              products: { ...state.products, bundles: [...state.products.bundles, bundle] },
            }),
            false, 'addBundle',
          ),

        removeBundle: (index) =>
          set(
            (state) => ({
              products: {
                ...state.products,
                bundles: state.products.bundles.filter((_, i) => i !== index),
              },
            }),
            false, 'removeBundle',
          ),

        // === Convenience ===
        setStep: (step) =>
          set((state) => ({ meta: { ...state.meta, currentStep: step } }), false, 'setStep'),

        setActiveJob: (jobId) =>
          set((state) => ({ meta: { ...state.meta, activeJobId: jobId } }), false, 'setActiveJob'),

        // === Full Reset ===
        reset: () =>
          set(
            {
              brand: { name: null, vision: null, archetype: null, values: [], targetAudience: null },
              design: { colorPalette: [], fonts: null, logoStyle: null },
              assets: { logos: [], selectedLogoId: null, mockups: [], selectedMockups: {} },
              products: { selectedSkus: [], bundles: [] },
              meta: { brandId: null, currentStep: 'onboarding', activeJobId: null, sessionId: null },
            },
            false, 'reset',
          ),
      }),
      {
        name: 'bmn-wizard',
        version: 1,
        partialize: (state) => ({
          brand: state.brand,
          design: state.design,
          products: state.products,
          meta: state.meta,
        }),
      },
    ),
    { name: 'WizardStore' },
  ),
);
```

### 6.2 Auth Store

```javascript
// src/stores/auth-store.js

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export const useAuthStore = create(
  devtools(
    (set) => ({
      user: null,
      session: null,
      isAdmin: false,
      isLoading: true,

      setUser: (user) => set({ user }, false, 'setUser'),
      setSession: (session) => set({ session }, false, 'setSession'),
      setIsAdmin: (isAdmin) => set({ isAdmin }, false, 'setIsAdmin'),
      setLoading: (isLoading) => set({ isLoading }, false, 'setLoading'),

      clear: () =>
        set({ user: null, session: null, isAdmin: false, isLoading: false }, false, 'clearAuth'),
    }),
    { name: 'AuthStore' },
  ),
);
```

### 6.3 UI Store

```javascript
// src/stores/ui-store.js

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export const useUIStore = create(
  devtools(
    persist(
      (set, get) => ({
        theme: 'system',
        sidebarOpen: true,
        chatOpen: false,
        toasts: [],

        setTheme: (theme) => {
          set({ theme }, false, 'setTheme');
          const root = document.documentElement;
          if (theme === 'dark') {
            root.classList.add('dark');
          } else if (theme === 'light') {
            root.classList.remove('dark');
          } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.classList.toggle('dark', prefersDark);
          }
        },

        setSidebarOpen: (open) => set({ sidebarOpen: open }, false, 'setSidebarOpen'),
        toggleSidebar: () =>
          set((s) => ({ sidebarOpen: !s.sidebarOpen }), false, 'toggleSidebar'),
        setChatOpen: (open) => set({ chatOpen: open }, false, 'setChatOpen'),

        addToast: (toast) => {
          const id = crypto.randomUUID();
          set(
            (state) => ({ toasts: [...state.toasts, { ...toast, id }] }),
            false, 'addToast',
          );
          setTimeout(() => get().removeToast(id), toast.duration || 5000);
        },

        removeToast: (id) =>
          set(
            (state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }),
            false, 'removeToast',
          ),
      }),
      {
        name: 'bmn-ui',
        partialize: (state) => ({ theme: state.theme, sidebarOpen: state.sidebarOpen }),
      },
    ),
    { name: 'UIStore' },
  ),
);
```

---

## 7. Server State (TanStack Query 5)

### 7.1 API Client

```javascript
// src/lib/api-client.js

import { supabase } from '@lib/supabase-client.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

class ApiClientError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

async function request(path, options = {}) {
  const { method = 'GET', body, params, headers: extraHeaders } = options;

  const url = new URL(path, BASE_URL);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...extraHeaders,
  };

  const response = await fetch(url.toString(), {
    method,
    headers,
    ...(body && { body: JSON.stringify(body) }),
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = isJson ? data.error || data.message : 'Request failed';
    throw new ApiClientError(message, response.status, data?.code);
  }

  return isJson && data.success !== undefined ? data.data : data;
}

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
};
```

### 7.2 Query Key Conventions

```
['brands']                          — All brands for current user
['brands', { status: 'draft' }]    — Brands filtered by status
['brand', brandId]                  — Single brand detail
['brand-assets', brandId, 'logo']   — Logo assets for a brand
['brand-assets', brandId, 'mockup'] — Mockup assets for a brand
['brand-assets', brandId, 'bundle'] — Bundle assets for a brand
['products', 'active']              — Active product catalog
['products', 'selected', skus]      — Products by SKU list
['user-profile']                    — Current user profile
['user-subscription']               — Current user subscription
['generation-job', jobId]           — Single generation job status
['admin', 'users']                  — Admin: all users
['admin', 'jobs']                   — Admin: all jobs
```

### 7.3 Brand Query Hooks

```javascript
// src/hooks/use-brands.js

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@lib/api-client.js';
import { useToast } from '@hooks/use-toast.js';

export function useBrands(filters = {}) {
  return useQuery({
    queryKey: ['brands', filters],
    queryFn: () => apiClient.get('/api/v1/brands', { params: filters }),
  });
}

export function useBrand(brandId) {
  return useQuery({
    queryKey: ['brand', brandId],
    queryFn: () => apiClient.get(`/api/v1/brands/${brandId}`),
    enabled: !!brandId,
  });
}

export function useBrandAssets(brandId, assetType) {
  return useQuery({
    queryKey: ['brand-assets', brandId, assetType],
    queryFn: () => apiClient.get(`/api/v1/brands/${brandId}/assets`, { params: { type: assetType } }),
    enabled: !!brandId && !!assetType,
  });
}

export function useUpdateBrand(brandId) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (data) => apiClient.patch(`/api/v1/brands/${brandId}`, data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['brand', brandId] });
      const previous = queryClient.getQueryData(['brand', brandId]);
      queryClient.setQueryData(['brand', brandId], (old) => ({ ...old, ...data }));
      return { previous };
    },
    onError: (err, _vars, context) => {
      queryClient.setQueryData(['brand', brandId], context.previous);
      showToast({ type: 'error', title: 'Update failed', description: err.message });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['brand', brandId] });
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    },
  });
}

export function useDeleteBrand() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (brandId) => apiClient.delete(`/api/v1/brands/${brandId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      showToast({ type: 'success', title: 'Brand deleted' });
    },
    onError: (err) => {
      showToast({ type: 'error', title: 'Delete failed', description: err.message });
    },
  });
}
```

### 7.4 Generation Hooks

```javascript
// src/hooks/use-generation.js

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@lib/api-client.js';
import { useWizardStore } from '@stores/wizard-store.js';
import { useToast } from '@hooks/use-toast.js';

export function useStartLogoGeneration() {
  const setActiveJob = useWizardStore((s) => s.setActiveJob);
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (brandId) => apiClient.post('/api/v1/generation/logos', { brandId }),
    onSuccess: (response) => setActiveJob(response.jobId),
    onError: (err) =>
      showToast({ type: 'error', title: 'Generation failed', description: err.message }),
  });
}

export function useStartMockupGeneration() {
  const setActiveJob = useWizardStore((s) => s.setActiveJob);
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (brandId) => apiClient.post('/api/v1/generation/mockups', { brandId }),
    onSuccess: (response) => setActiveJob(response.jobId),
    onError: (err) =>
      showToast({ type: 'error', title: 'Mockup generation failed', description: err.message }),
  });
}

export function useRefineLogo() {
  const setActiveJob = useWizardStore((s) => s.setActiveJob);
  return useMutation({
    mutationFn: ({ brandId, logoId, instructions }) =>
      apiClient.post('/api/v1/generation/logos/refine', { brandId, logoId, instructions }),
    onSuccess: (response) => setActiveJob(response.jobId),
  });
}

export function useUpdateMockupStatus(brandId) {
  const setMockupStatus = useWizardStore((s) => s.setMockupStatus);
  return useMutation({
    mutationFn: ({ mockupId, status }) =>
      apiClient.patch(`/api/v1/brands/${brandId}/mockups/${mockupId}`, { status }),
    onMutate: ({ mockupId, status }) => setMockupStatus(mockupId, status),
  });
}
```

### 7.5 Cache Invalidation Strategy

| Action | Invalidate |
|--------|-----------|
| Create brand | `['brands']` |
| Update brand | `['brand', brandId]`, `['brands']` |
| Delete brand | `['brands']` |
| Generate logos | `['brand-assets', brandId, 'logo']` |
| Generate mockups | `['brand-assets', brandId, 'mockup']` |
| Save bundles | `['brand-assets', brandId, 'bundle']` |
| Update profile | `['user-profile']` |
| Change subscription | `['user-subscription']` |
| Admin update product | `['products']`, `['products', 'active']` |

---

## 8. Socket.io Integration

### 8.1 Socket Client Setup

```javascript
// src/lib/socket-client.js

import { io } from 'socket.io-client';
import { supabase } from '@lib/supabase-client.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL;

let socket = null;

export async function getSocket() {
  if (socket?.connected) return socket;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Cannot connect socket: not authenticated');

  socket = io(SOCKET_URL, {
    path: '/socket.io',
    auth: { token: session.access_token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: 10000,
  });

  socket.on('connect', () => console.log('[Socket] Connected:', socket.id));
  socket.on('disconnect', (reason) => console.warn('[Socket] Disconnected:', reason));
  socket.on('connect_error', (err) => console.error('[Socket] Error:', err.message));

  return socket;
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}

export function getCurrentSocket() { return socket; }
```

### 8.2 useSocket Hook

```javascript
// src/hooks/use-socket.js

import { useEffect, useRef, useState } from 'react';
import { getSocket, disconnectSocket } from '@lib/socket-client.js';
import { useAuthStore } from '@stores/auth-store.js';

export function useSocket() {
  const user = useAuthStore((s) => s.user);
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      setIsConnected(false);
      socketRef.current = null;
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const sock = await getSocket();
        if (cancelled) return;
        socketRef.current = sock;
        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);
        sock.on('connect', onConnect);
        sock.on('disconnect', onDisconnect);
        setIsConnected(sock.connected);
      } catch (err) {
        console.error('[useSocket] Failed:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  return { isConnected, socket: socketRef.current };
}
```

### 8.3 useGenerationProgress Hook

```javascript
// src/hooks/use-generation-progress.js

import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentSocket } from '@lib/socket-client.js';
import { SOCKET_EVENTS } from '@lib/constants.js';

export function useGenerationProgress(jobId) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isError, setIsError] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const joinedRoom = useRef(null);

  const reset = useCallback(() => {
    setProgress(0);
    setStatus('idle');
    setMessage('');
    setIsComplete(false);
    setIsError(false);
    setResult(null);
    setError(null);
    joinedRoom.current = null;
  }, []);

  useEffect(() => {
    if (!jobId) { reset(); return; }

    const socket = getCurrentSocket();
    if (!socket) return;

    const room = `job:${jobId}`;
    socket.emit('join:room', room);
    joinedRoom.current = room;
    setStatus('pending');
    setMessage('Starting...');

    const onProgress = (data) => {
      setProgress(data.progress || 0);
      setStatus(data.status || 'processing');
      setMessage(data.message || '');
    };

    const onComplete = (data) => {
      setProgress(100);
      setStatus('complete');
      setMessage('Complete!');
      setIsComplete(true);
      setResult(data.result || data);
    };

    const onError = (data) => {
      setStatus('error');
      setIsError(true);
      setError(data.error || 'An error occurred');
      setMessage(data.error || 'Generation failed');
    };

    socket.on(SOCKET_EVENTS.GENERATION_PROGRESS, onProgress);
    socket.on(SOCKET_EVENTS.GENERATION_COMPLETE, onComplete);
    socket.on(SOCKET_EVENTS.GENERATION_ERROR, onError);
    socket.on(SOCKET_EVENTS.AGENT_TOOL_COMPLETE, onProgress);
    socket.on(SOCKET_EVENTS.AGENT_COMPLETE, onComplete);
    socket.on(SOCKET_EVENTS.AGENT_TOOL_ERROR, onError);

    return () => {
      socket.off(SOCKET_EVENTS.GENERATION_PROGRESS, onProgress);
      socket.off(SOCKET_EVENTS.GENERATION_COMPLETE, onComplete);
      socket.off(SOCKET_EVENTS.GENERATION_ERROR, onError);
      socket.off(SOCKET_EVENTS.AGENT_TOOL_COMPLETE, onProgress);
      socket.off(SOCKET_EVENTS.AGENT_COMPLETE, onComplete);
      socket.off(SOCKET_EVENTS.AGENT_TOOL_ERROR, onError);
      if (joinedRoom.current) {
        socket.emit('leave:room', joinedRoom.current);
        joinedRoom.current = null;
      }
    };
  }, [jobId, reset]);

  return { progress, status, message, isComplete, isError, result, error, reset };
}
```

### 8.4 useBrandUpdates Hook

```javascript
// src/hooks/use-brand-updates.js

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getCurrentSocket } from '@lib/socket-client.js';
import { SOCKET_EVENTS } from '@lib/constants.js';

export function useBrandUpdates(brandId) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getCurrentSocket();
    if (!socket) return;

    const room = brandId ? `brand:${brandId}` : 'user:brands';
    socket.emit('join:room', room);

    const onBrandUpdated = (data) => {
      if (data.brandId) {
        queryClient.invalidateQueries({ queryKey: ['brand', data.brandId] });
        queryClient.invalidateQueries({ queryKey: ['brand-assets', data.brandId] });
      }
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    };

    socket.on(SOCKET_EVENTS.BRAND_UPDATED, onBrandUpdated);

    return () => {
      socket.off(SOCKET_EVENTS.BRAND_UPDATED, onBrandUpdated);
      socket.emit('leave:room', room);
    };
  }, [brandId, queryClient]);
}
```

### 8.5 Connection Status UI

```jsx
// src/components/layout/ConnectionStatus.jsx

import { useSocket } from '@hooks/use-socket.js';
import { WifiOff } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export function ConnectionStatus() {
  const { isConnected } = useSocket();

  return (
    <AnimatePresence>
      {!isConnected && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-4 left-4 z-[var(--bmn-z-toast)] flex items-center gap-2 rounded-lg border border-warning-border bg-warning-bg px-3 py-2 shadow-md"
        >
          <WifiOff className="h-4 w-4 text-warning" />
          <span className="text-xs font-medium text-text">Reconnecting...</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```


---

## 9. Real-Time Generation UI

### 9.1 GenerationProgress Component

```jsx
// src/components/wizard/GenerationProgress.jsx

import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { ProgressBar } from '@components/ui/ProgressBar.jsx';
import { Button } from '@components/ui/Button.jsx';
import { Card } from '@components/ui/Card.jsx';

/**
 * @param {Object} props
 * @param {number} props.progress — 0-100
 * @param {string} props.status — 'pending'|'composing'|'generating'|'uploading'|'saving'|'complete'|'error'
 * @param {string} props.message — Human-readable status text
 * @param {boolean} props.isComplete
 * @param {boolean} props.isError
 * @param {string|null} [props.error]
 * @param {() => void} [props.onRetry]
 * @param {() => void} [props.onCancel]
 */
export function GenerationProgress({
  progress,
  status,
  message,
  isComplete,
  isError,
  error,
  onRetry,
  onCancel,
}) {
  const statusMessages = {
    pending: 'Preparing...',
    composing: 'Composing AI prompt...',
    generating: 'Generating with AI...',
    uploading: 'Uploading assets...',
    saving: 'Saving to your brand...',
    complete: 'Complete!',
    error: 'Something went wrong',
  };

  const displayMessage = message || statusMessages[status] || 'Processing...';

  // Estimated time remaining (rough heuristic)
  const estimatedSeconds = isComplete
    ? 0
    : Math.max(0, Math.round(((100 - progress) / Math.max(progress, 1)) * 10));

  return (
    <Card variant="elevated" className="overflow-hidden">
      <div className="p-6">
        {/* Status icon */}
        <div className="mb-4 flex justify-center">
          <AnimatePresence mode="wait">
            {isComplete ? (
              <motion.div
                key="complete"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <CheckCircle2 className="h-12 w-12 text-success" />
              </motion.div>
            ) : isError ? (
              <motion.div
                key="error"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
              >
                <AlertCircle className="h-12 w-12 text-error" />
              </motion.div>
            ) : (
              <motion.div
                key="loading"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
              >
                <Loader2 className="h-12 w-12 text-primary" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Progress bar */}
        <ProgressBar
          value={progress}
          statusText={displayMessage}
          color={isError ? 'error' : isComplete ? 'success' : 'primary'}
          showPercentage={!isError}
          animated
        />

        {/* Time estimate */}
        {!isComplete && !isError && estimatedSeconds > 0 && (
          <p className="mt-2 text-center text-xs text-text-muted">
            Estimated time remaining: ~{estimatedSeconds}s
          </p>
        )}

        {/* Actions */}
        <div className="mt-4 flex justify-center gap-3">
          {isError && onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Try Again
            </Button>
          )}
          {!isComplete && !isError && onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>

        {/* Error detail */}
        {isError && error && (
          <p className="mt-3 rounded-md bg-error-bg p-3 text-center text-xs text-error">
            {error}
          </p>
        )}
      </div>
    </Card>
  );
}
```

### 9.2 Socket-to-Progress Connection Flow

```
1. User clicks "Generate" button
2. Frontend calls POST /api/v1/generation/logos { brandId }
3. API returns { jobId } in < 50ms (job queued in BullMQ)
4. Frontend sets jobId in state -> useGenerationProgress(jobId) activates
5. Hook joins Socket.io room `job:{jobId}`
6. BullMQ worker picks up job, emits progress via Socket.io:
   - { status: 'composing', progress: 10, message: 'Composing prompt...' }
   - { status: 'generating', progress: 40, message: 'Generating logo 1 of 4...' }
   - { status: 'generating', progress: 55, message: 'Generating logo 2 of 4...' }
   - { status: 'generating', progress: 70, message: 'Generating logo 3 of 4...' }
   - { status: 'generating', progress: 85, message: 'Generating logo 4 of 4...' }
   - { status: 'uploading', progress: 92, message: 'Uploading to storage...' }
   - { status: 'complete', progress: 100, result: { logos: [...] } }
7. GenerationProgress component renders each update in real-time
8. On complete: result is saved to wizard store, UI transitions to logo grid
```

### 9.3 Disconnection Handling

If the Socket.io connection drops during generation:

1. `useSocket` sets `isConnected = false`
2. `ConnectionStatus` component shows "Reconnecting..." banner
3. Socket.io auto-reconnects (up to 10 attempts, exponential backoff)
4. On reconnect: socket re-joins the job room
5. Server replays latest progress state (job status is in Redis/BullMQ, not lost)
6. If user navigates away and returns: `useGenerationProgress` can poll `GET /api/v1/generation/jobs/:jobId` as fallback

---

## 10. Chatbot Widget

### 10.1 Chat Widget Component

```jsx
// src/components/chat/ChatWidget.jsx

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, User, Bot, Headphones } from 'lucide-react';
import { Button } from '@components/ui/Button.jsx';
import { useUIStore } from '@stores/ui-store.js';
import { useChat } from '@hooks/use-chat.js';
import { ChatMessage } from '@components/chat/ChatMessage.jsx';
import { TypingIndicator } from '@components/chat/TypingIndicator.jsx';

export function ChatWidget() {
  const chatOpen = useUIStore((s) => s.chatOpen);
  const setChatOpen = useUIStore((s) => s.setChatOpen);
  const { messages, isTyping, sendMessage, requestHumanSupport } = useChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <AnimatePresence>
        {!chatOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setChatOpen(true)}
            className="fixed bottom-6 right-6 z-[var(--bmn-z-chat)] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary-hover transition-colors"
            aria-label="Open chat"
          >
            <MessageCircle className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat drawer */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[var(--bmn-z-chat)] flex h-[500px] w-[380px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-primary px-4 py-3">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary-foreground" />
                <span className="text-sm font-semibold text-primary-foreground">Brand Assistant</span>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="rounded-md p-1 text-primary-foreground/70 hover:text-primary-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-sm text-text-muted py-8">
                  <Bot className="mx-auto mb-2 h-8 w-8" />
                  <p>Hi! I'm your brand assistant.</p>
                  <p className="mt-1">Ask me anything about branding, products, or the platform.</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <ChatMessage key={i} message={msg} />
              ))}
              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-3">
              <div className="flex items-center gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  rows={1}
                  className="flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
                <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <button
                onClick={requestHumanSupport}
                className="mt-2 flex w-full items-center justify-center gap-1.5 text-xs text-text-muted hover:text-text-link transition-colors"
              >
                <Headphones className="h-3 w-3" />
                Talk to a human
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
```

### 10.2 useChat Hook

```javascript
// src/hooks/use-chat.js

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@lib/api-client.js';
import { useToast } from '@hooks/use-toast.js';

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const { showToast } = useToast();

  const sendMutation = useMutation({
    mutationFn: (content) =>
      apiClient.post('/api/v1/chat/message', { content, history: messages.slice(-10) }),
    onMutate: (content) => {
      setMessages((prev) => [...prev, { role: 'user', content }]);
      setIsTyping(true);
    },
    onSuccess: (response) => {
      setIsTyping(false);
      setMessages((prev) => [...prev, { role: 'assistant', content: response.message }]);
    },
    onError: (err) => {
      setIsTyping(false);
      showToast({ type: 'error', title: 'Chat error', description: err.message });
    },
  });

  const sendMessage = useCallback(
    (content) => sendMutation.mutate(content),
    [sendMutation],
  );

  const requestHumanSupport = useCallback(async () => {
    try {
      await apiClient.post('/api/v1/chat/support-request');
      showToast({ type: 'success', title: 'Support request sent', description: 'Our team will get back to you via email.' });
    } catch (err) {
      showToast({ type: 'error', title: 'Failed to send request' });
    }
  }, [showToast]);

  return { messages, isTyping, sendMessage, requestHumanSupport };
}
```

### 10.3 ChatMessage + TypingIndicator

```jsx
// src/components/chat/ChatMessage.jsx

import { Bot, User } from 'lucide-react';
import DOMPurify from 'dompurify';

export function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const sanitized = DOMPurify.sanitize(message.content);

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
        isUser ? 'bg-primary' : 'bg-surface-hover'
      }`}>
        {isUser ? <User className="h-4 w-4 text-primary-foreground" /> : <Bot className="h-4 w-4 text-text-muted" />}
      </div>
      <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
        isUser ? 'bg-primary text-primary-foreground' : 'bg-surface-hover text-text'
      }`}>
        <span dangerouslySetInnerHTML={{ __html: sanitized }} />
      </div>
    </div>
  );
}
```

```jsx
// src/components/chat/TypingIndicator.jsx

export function TypingIndicator() {
  return (
    <div className="flex gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-hover">
        <span className="text-xs">...</span>
      </div>
      <div className="flex items-center gap-1 rounded-xl bg-surface-hover px-3 py-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-text-muted"
            style={{ animation: `typing-dot 1.4s infinite ${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## 11. Admin Panel

### 11.1 Admin Layout

```jsx
// src/routes/admin/layout.jsx

import { Outlet } from 'react-router';
import { AppHeader } from '@components/layout/AppHeader.jsx';
import { AdminSidebar } from '@components/layout/AdminSidebar.jsx';

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <div className="flex flex-1">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

### 11.2 User Management (`/admin/users`)

**API calls:**
- `GET /api/v1/admin/users?search=&page=&limit=` — Paginated user list with search
- `PATCH /api/v1/admin/users/:userId` — Update user role, tier, status

**UI:** DataTable with columns: Name, Email, Tier, Brands Count, Created At, Actions. Search bar filters by name/email. Click row to expand user detail (brands, subscription, credits). Admin can change tier, disable account.

### 11.3 Product Catalog CRUD (`/admin/products`)

**API calls:**
- `GET /api/v1/admin/products` — All products (including inactive)
- `POST /api/v1/admin/products` — Create product
- `PATCH /api/v1/admin/products/:productId` — Update product
- `DELETE /api/v1/admin/products/:productId` — Soft delete

**Zod Schema:**

```javascript
export const adminProductSchema = z.object({
  sku: z.string().min(3).max(20).regex(/^[A-Z0-9-]+$/, 'SKU must be uppercase alphanumeric'),
  name: z.string().min(2).max(100),
  category: z.enum(['Apparel', 'Accessories', 'Home Goods', 'Packaging', 'Digital']),
  baseCost: z.number().min(0.01).max(9999.99),
  retailPrice: z.number().min(0.01).max(9999.99),
  imageUrl: z.string().url().optional(),
  mockupTemplateUrl: z.string().url().optional(),
  mockupInstructions: z.string().max(1000).optional(),
  isActive: z.boolean(),
});
```

**UI:** Product table with inline edit capability. "Add Product" button opens modal with ProductForm. Each row: SKU, Name, Category, Cost, Retail, Status toggle. Image upload via FileUpload component.

### 11.4 Job Monitoring (`/admin/jobs`)

**API calls:**
- `GET /api/v1/admin/jobs?status=&type=&page=` — Paginated job list
- `POST /api/v1/admin/jobs/:jobId/retry` — Retry failed job
- `DELETE /api/v1/admin/jobs/:jobId` — Remove job

**UI:** Table of BullMQ jobs with columns: ID, Type, Status (badge: queued/processing/complete/failed), Brand, User, Progress, Created, Duration. Filter tabs: All, Active, Completed, Failed. Failed jobs have "Retry" button. Real-time updates via Socket.io `/admin` namespace. Optional: embedded Bull Board iframe at `/admin/bull-board` for the full BullMQ dashboard.

### 11.5 Content Moderation (`/admin/moderation`)

**API calls:**
- `GET /api/v1/admin/moderation?status=pending` — Queue of flagged content
- `PATCH /api/v1/admin/moderation/:assetId` — Approve or reject

**UI:** Card grid of AI-generated images pending review. Each ModerationCard shows: image preview (large), brand name, user email, generation type (logo/mockup), NSFW detection score, timestamp. Two action buttons: "Approve" (green) and "Flag & Remove" (red). Flagged items are removed from user's brand and logged in audit trail.

### 11.6 System Health (`/admin/health`)

**API calls:**
- `GET /api/v1/admin/health` — System metrics (uptime, queue depth, error rates)
- `GET /api/v1/admin/costs` — AI cost aggregation from audit_log

**UI:** Dashboard grid of metric cards. **Queue Health:** Active jobs, waiting jobs, failed (last 24h), completed (last 24h). **API Health:** Uptime %, p95 latency, error rate (last hour). **AI Costs:** Total spend today, spend this month, cost per brand average, cost breakdown by model (Claude, FLUX.2, GPT Image). **Sentry embed:** Iframe linking to Sentry dashboard for error detail.

---

## 12. File Manifest

Complete file listing for `apps/web/src/` with descriptions:

```
src/
├── main.jsx                              # ReactDOM.createRoot entry point
├── App.jsx                               # Router + QueryClient + providers
│
├── routes/
│   ├── root-layout.jsx                   # Root layout: auth listener, toast, socket
│   ├── auth/
│   │   ├── login.jsx                     # Email/password + Google OAuth login page
│   │   ├── signup.jsx                    # Registration: email, password, phone, TC
│   │   ├── forgot-password.jsx           # Password reset request form
│   │   └── callback.jsx                  # OAuth callback handler (Google redirect)
│   ├── wizard/
│   │   ├── layout.jsx                    # Wizard shell: progress bar, step nav, bg
│   │   ├── onboarding.jsx               # Step 1: Welcome, phone, TC, create brand
│   │   ├── social-analysis.jsx           # Step 2: Enter handles, real-time analysis
│   │   ├── brand-identity.jsx            # Step 3: Review/edit AI brand identity
│   │   ├── customization.jsx             # Step 4: Colors, fonts, logo style picker
│   │   ├── logo-generation.jsx           # Step 5: Generate 4 logos, select favorite
│   │   ├── logo-refinement.jsx           # Step 6: Refine selected logo (3 rounds)
│   │   ├── product-selection.jsx         # Step 7: Browse catalog, select products
│   │   ├── mockup-review.jsx            # Step 8: View mockups, approve/reject
│   │   ├── bundle-builder.jsx            # Step 9: Create product bundles
│   │   ├── profit-calculator.jsx         # Step 10: Interactive pricing + revenue
│   │   ├── checkout.jsx                  # Step 11: Stripe checkout, tier selection
│   │   └── complete.jsx                  # Step 12: Celebration, summary, share
│   ├── dashboard/
│   │   ├── layout.jsx                    # Dashboard shell: sidebar, header
│   │   ├── brands.jsx                    # Brand list grid (all user brands)
│   │   ├── brand-detail.jsx              # Single brand: all assets, downloads
│   │   └── settings.jsx                  # Profile, subscription, account deletion
│   └── admin/
│       ├── layout.jsx                    # Admin shell: admin sidebar
│       ├── users.jsx                     # User management data table
│       ├── products.jsx                  # Product catalog CRUD
│       ├── jobs.jsx                      # BullMQ job monitoring
│       ├── moderation.jsx                # Content moderation queue
│       └── health.jsx                    # System health dashboard
│
├── components/
│   ├── ui/
│   │   ├── Button.jsx                    # Button: primary/secondary/ghost/danger/outline
│   │   ├── Input.jsx                     # Input: label, error, help text, addons
│   │   ├── Textarea.jsx                  # Textarea with character count
│   │   ├── Select.jsx                    # Radix select dropdown
│   │   ├── Checkbox.jsx                  # Radix checkbox with label
│   │   ├── Radio.jsx                     # Radix radio group with descriptions
│   │   ├── Switch.jsx                    # Radix toggle switch
│   │   ├── Slider.jsx                    # Radix range slider
│   │   ├── Card.jsx                      # Card + CardHeader/Title/Content/Footer
│   │   ├── Modal.jsx                     # Radix dialog modal
│   │   ├── Drawer.jsx                    # Radix dialog as side drawer
│   │   ├── Toast.jsx                     # Radix toast notification + viewport
│   │   ├── ToastProvider.jsx             # Toast context with useToast hook
│   │   ├── ProgressBar.jsx              # Progress bar: percentage, status, animated
│   │   ├── Skeleton.jsx                  # Skeleton loader: text/circle/rect/card
│   │   ├── Avatar.jsx                    # Radix avatar with fallback
│   │   ├── Badge.jsx                     # Status badge (variants, colors)
│   │   ├── Tooltip.jsx                   # Radix tooltip
│   │   ├── Tabs.jsx                      # Radix tabs
│   │   ├── Separator.jsx                 # Horizontal/vertical separator
│   │   ├── ScrollArea.jsx                # Radix custom scrollbar
│   │   ├── DropdownMenu.jsx              # Radix dropdown menu
│   │   ├── Popover.jsx                   # Radix popover
│   │   ├── FileUpload.jsx               # react-dropzone file upload area
│   │   ├── EmptyState.jsx               # Illustration + CTA for empty states
│   │   ├── ErrorBoundary.jsx            # React error boundary with fallback UI
│   │   ├── LoadingSpinner.jsx           # Animated spinner (fullPage option)
│   │   └── VisuallyHidden.jsx           # Screen-reader-only text
│   ├── wizard/
│   │   ├── WizardProgressBar.jsx         # Multi-step progress indicator
│   │   ├── StepNavigation.jsx            # Back/Next/Skip step buttons
│   │   ├── GenerationProgress.jsx        # Real-time AI generation progress card
│   │   ├── SocialHandleInput.jsx         # Social handle input with platform icon
│   │   ├── ColorPalettePicker.jsx        # Color palette editor (react-colorful)
│   │   ├── FontSelector.jsx              # Font preview + selection dropdown
│   │   ├── LogoStyleSelector.jsx         # Visual logo style card selector
│   │   ├── LogoGrid.jsx                  # 2x2 logo grid with selection
│   │   ├── LogoRefinementPanel.jsx       # Refinement controls + history
│   │   ├── ProductGrid.jsx              # Product catalog browsable grid
│   │   ├── ProductCard.jsx              # Single product with select toggle
│   │   ├── MockupViewer.jsx             # Mockup image with approve/reject
│   │   ├── BundleBuilder.jsx            # Bundle creation with product picker
│   │   ├── ProfitChart.jsx              # Revenue projection chart (Recharts)
│   │   ├── PricingSlider.jsx            # Interactive retail price slider
│   │   ├── TierSelector.jsx             # Subscription tier selection cards
│   │   ├── CelebrationAnimation.jsx     # Confetti + bounce-in celebration
│   │   └── BrandSummaryCard.jsx         # Final brand summary overview
│   ├── brand/
│   │   ├── BrandCard.jsx                # Brand list card (logo, name, status)
│   │   ├── BrandStatusBadge.jsx          # Draft/Active/Complete status badge
│   │   ├── AssetGallery.jsx             # Image gallery with download buttons
│   │   ├── ColorPaletteDisplay.jsx      # Read-only color palette strip
│   │   ├── FontDisplay.jsx             # Read-only typography preview
│   │   └── BrandDetailHeader.jsx        # Brand hero: logo, name, vision
│   ├── chat/
│   │   ├── ChatWidget.jsx               # Floating chat button + drawer
│   │   ├── ChatMessage.jsx              # Single message bubble (user/assistant)
│   │   ├── ChatInput.jsx               # Message input with send button
│   │   └── TypingIndicator.jsx          # AI typing dots animation
│   ├── admin/
│   │   ├── UserTable.jsx               # User management data table + search
│   │   ├── ProductForm.jsx             # Product CRUD form (modal)
│   │   ├── ModerationCard.jsx           # Content review card (approve/flag)
│   │   ├── JobMonitor.jsx              # BullMQ job status display
│   │   └── HealthMetrics.jsx           # System health metric cards
│   └── layout/
│       ├── AppHeader.jsx               # Top nav: logo, user menu, theme toggle
│       ├── DashboardSidebar.jsx        # Dashboard side navigation
│       ├── AdminSidebar.jsx            # Admin side navigation
│       ├── MobileNav.jsx              # Mobile hamburger menu drawer
│       ├── Footer.jsx                 # App footer (copyright, links)
│       └── ConnectionStatus.jsx       # Socket.io connection indicator
│
├── stores/
│   ├── wizard-store.js                # Zustand: wizard state (5 slices + actions)
│   ├── auth-store.js                  # Zustand: user, session, isAdmin
│   └── ui-store.js                    # Zustand: theme, sidebar, toasts
│
├── hooks/
│   ├── use-socket.js                  # Socket.io connection lifecycle
│   ├── use-generation-progress.js     # Real-time generation tracking via socket
│   ├── use-brand-updates.js           # Live brand status invalidation
│   ├── use-brands.js                  # TanStack: brand list, detail, CRUD
│   ├── use-brand-detail.js            # TanStack: single brand + assets
│   ├── use-products.js               # TanStack: product catalog queries
│   ├── use-generation.js             # TanStack: start/track generation jobs
│   ├── use-user-profile.js           # TanStack: profile + subscription
│   ├── use-admin.js                  # TanStack: admin queries + mutations
│   ├── use-chat.js                   # Chatbot message send/receive
│   ├── use-auth.js                   # Auth flow (login, signup, logout, OAuth)
│   ├── use-toast.js                  # Toast notification trigger
│   ├── use-media-query.js            # Responsive breakpoint detection
│   └── use-local-storage.js          # Type-safe localStorage hook
│
├── lib/
│   ├── api-client.js                 # Fetch wrapper: auth headers, error handling
│   ├── socket-client.js              # Socket.io client singleton + JWT auth
│   ├── supabase-client.js            # Supabase browser client init
│   ├── stripe-client.js              # Stripe.js loader + Elements provider
│   ├── posthog-client.js             # PostHog analytics initialization
│   ├── validation-schemas.js         # All Zod schemas (re-exports from @bmn/shared)
│   ├── constants.js                  # Routes, steps, tiers, categories, events
│   ├── utils.js                      # cn(), formatCurrency(), formatDate(), etc.
│   └── route-guards.js              # requireAuth, requireAdmin, redirectIfAuthed
│
└── styles/
    ├── design-tokens.css             # CSS variables: colors, typography, spacing, etc.
    ├── global.css                    # Tailwind 4 @import + @theme + @layer base
    └── animations.css                # @keyframes: fade, slide, scale, shimmer, confetti
```

---

## 13. Development Prompt

The following prompt can be pasted directly into a Claude Code session to build the complete frontend:

```
Read docs/prd/09-FRONTEND-APP.md in full. This is the complete frontend specification
for the Brand Me Now v2 React 19 + Vite 7 SPA.

Build the entire apps/web/ directory following the spec exactly.

Implementation order:
1. Initialize Vite 7 project with React 19, install all dependencies from package.json
2. Create vite.config.js, eslint.config.js, .prettierrc, jsconfig.json
3. Create styles/ directory: design-tokens.css, global.css, animations.css
4. Create lib/ directory: api-client.js, socket-client.js, supabase-client.js,
   stripe-client.js, posthog-client.js, constants.js, utils.js, route-guards.js,
   validation-schemas.js (all Zod schemas)
5. Create stores/ directory: wizard-store.js, auth-store.js, ui-store.js
6. Create hooks/ directory: all custom hooks
7. Create components/ui/ directory: all design system primitives
8. Create components/layout/ directory: AppHeader, sidebars, footer, ConnectionStatus
9. Create components/wizard/ directory: all wizard-specific components
10. Create components/brand/ directory: all brand display components
11. Create components/chat/ directory: ChatWidget, ChatMessage, TypingIndicator
12. Create components/admin/ directory: all admin components
13. Create routes/auth/ directory: login, signup, forgot-password, callback
14. Create routes/wizard/ directory: layout + all 12 wizard step pages
15. Create routes/dashboard/ directory: layout, brands, brand-detail, settings
16. Create routes/admin/ directory: layout, users, products, jobs, moderation, health
17. Create root-layout.jsx
18. Create App.jsx with complete router and provider stack
19. Create main.jsx entry point
20. Verify build succeeds: npm run build

Rules:
- JavaScript + JSDoc types (NOT TypeScript) per the blueprint spec
- Every component must use the design token CSS variables (never hardcoded colors)
- Every form uses React Hook Form + Zod resolver
- Every API call uses TanStack Query via the hooks
- Real-time features use Socket.io via the hooks
- All wizard state lives in the Zustand wizard store
- Motion library for all animations
- Lucide React for all icons
- Radix UI primitives for all accessible components
- Tailwind CSS 4 for all styling (no CSS modules, no styled-components)
- Code-split every route with lazy() imports
- Do NOT abbreviate any file — write complete implementations
```

---

## 14. Acceptance Criteria

### 14.1 Wizard End-to-End Flow

| Test | Steps | Expected Result |
|------|-------|----------------|
| **New user signup** | Navigate to /signup, fill form, submit | Account created, redirected to /wizard/onboarding |
| **Onboarding** | Fill phone, accept TC, click "Start Building" | Brand record created in DB, navigated to /wizard/social-analysis |
| **Social analysis** | Enter Instagram handle, click "Analyze" | Progress bar shows real-time updates via Socket.io, completes in < 30s |
| **Brand identity** | Review pre-filled AI data, edit name, proceed | Brand identity saved to DB, all fields persisted |
| **Customization** | Select colors, fonts, logo style | Design choices saved, navigated to logo generation |
| **Logo generation** | Click "Generate 4 Logos" | Real-time progress via Socket.io, 4 logos appear in < 60s |
| **Logo selection** | Click a logo to select, click "Refine" | Selected logo ID saved, navigated to refinement |
| **Logo refinement** | Enter refinement instructions, click "Refine" | New logo generated, displayed alongside original |
| **Product selection** | Filter by category, select 5 products | Selected SKUs saved, count badge shows "5 selected" |
| **Mockup review** | Wait for mockup generation, approve all | All mockups marked approved in DB |
| **Bundle builder** | Create 1 bundle with 3 products, name it | Bundle saved with composition image |
| **Profit calculator** | Adjust pricing sliders, verify chart updates | Revenue chart updates in real-time, projections saved |
| **Checkout (free)** | Select Free Trial tier | Brand marked complete, navigated to /wizard/complete |
| **Checkout (paid)** | Select Starter tier, complete Stripe Checkout | Stripe subscription created, redirected to /wizard/complete |
| **Completion** | Verify celebration screen | Confetti animation, brand summary displayed, email sent |

### 14.2 Dashboard Tests

| Test | Steps | Expected Result |
|------|-------|----------------|
| **Brand list** | Navigate to /dashboard | All user brands displayed as cards |
| **Brand detail** | Click a brand card | Full brand detail with all assets, download buttons |
| **Asset download** | Click "Download All Assets" | ZIP file downloads with logos, mockups |
| **New brand** | Click "New Brand" button | Redirected to /wizard/onboarding, wizard store reset |
| **Settings** | Navigate to /dashboard/settings | Profile form displayed, subscription card visible |
| **Theme toggle** | Switch theme to Dark | All CSS variables swap, entire UI re-themes |

### 14.3 Admin Tests

| Test | Steps | Expected Result |
|------|-------|----------------|
| **Admin access** | Non-admin navigates to /admin | Redirected to /dashboard |
| **Admin access** | Admin navigates to /admin | Admin panel loads with user table |
| **User search** | Type in search bar | Table filters by name/email |
| **Product CRUD** | Add new product, edit, toggle active | Product appears/updates in catalog |
| **Job monitoring** | View active/failed jobs | Real-time job status updates |

### 14.4 Real-Time Tests

| Test | Steps | Expected Result |
|------|-------|----------------|
| **Socket auth** | Login, check WebSocket connection | Socket connected with JWT in handshake |
| **Progress events** | Start logo generation, observe | Progress bar updates smoothly in real-time |
| **Reconnection** | Disconnect network, reconnect | "Reconnecting..." banner appears, auto-reconnects |
| **Multi-tab** | Open wizard in 2 tabs, generate in tab 1 | Tab 2 receives progress updates via Socket.io room |

### 14.5 Performance Tests

| Metric | Target | How to Verify |
|--------|--------|---------------|
| Time to Interactive | < 2 seconds | Lighthouse audit on production build |
| Bundle size (gzipped) | < 250 KB initial | `vite build` output, check chunk sizes |
| Wizard step transition | < 100ms | React DevTools profiler on route change |
| Socket.io connection | < 500ms | Browser DevTools Network tab |
| Largest Contentful Paint | < 2.5 seconds | Lighthouse audit |

### 14.6 Accessibility Tests

| Test | Expected Result |
|------|----------------|
| Keyboard navigation through wizard | All steps navigable with Tab, Enter, Escape |
| Screen reader on form fields | All inputs have labels, errors announced via aria-invalid |
| Color contrast ratio | All text meets WCAG 2.1 AA (4.5:1 for body, 3:1 for large) |
| Focus indicators | All interactive elements show visible focus outline |
| Modal/Drawer trap focus | Focus stays inside modal when open, returns on close |
