# 15 -- Marketing Site PRD

**Product:** Brand Me Now -- Marketing Website
**Date:** February 19, 2026
**Status:** Ready for development
**Depends on:** 01-PRODUCT-REQUIREMENTS.md, 09-GREENFIELD-REBUILD-BLUEPRINT.md

---

## 1. Purpose

The marketing site is a **separate Next.js 15 application** that lives alongside the Brand Builder SPA. It handles all public-facing, SEO-critical pages: landing, pricing, blog, about, contact, and legal. It bridges users to the authenticated app at `app.brandmenow.com` for login, signup, and the actual product experience.

**Domain architecture:**
- `brandmenow.com` -- Marketing site (this document)
- `app.brandmenow.com` -- Brand Builder SPA (React 19 + Vite 7)
- `api.brandmenow.com` -- Express.js API server

---

## 2. Next.js 15 Setup

### Framework Configuration

| Layer | Choice | Why |
|-------|--------|-----|
| **Framework** | Next.js 15 (App Router) | SSG/ISR for marketing pages, SEO, blog. Vercel-native deployment. |
| **Rendering** | Static Site Generation (SSG) + Incremental Static Regeneration (ISR) | Landing, about, legal pages are fully static. Pricing revalidates every 60s (in case tier changes). Blog posts build at deploy time. |
| **Styling** | Tailwind CSS 4 with shared design tokens | Same CSS variable design system as the main app. Import `@bmn/config/tailwind` from the monorepo shared package. |
| **Language** | JavaScript + JSDoc types | Consistent with the rest of the platform. No TypeScript compilation step. |
| **Runtime** | Node.js 22 LTS | Matches API server runtime. |

### Tailwind CSS 4 -- Shared Design Tokens

The marketing site and Brand Builder SPA share the same CSS variable design system. Tokens are defined once in `packages/config/tailwind/` and consumed by both apps.

```css
/* packages/config/tailwind/design-tokens.css */

@theme {
  /* Brand Colors */
  --color-brand-primary: #6C3CE9;
  --color-brand-secondary: #F97316;
  --color-brand-accent: #06B6D4;

  /* Neutrals */
  --color-neutral-50: #FAFAFA;
  --color-neutral-100: #F5F5F5;
  --color-neutral-200: #E5E5E5;
  --color-neutral-300: #D4D4D4;
  --color-neutral-400: #A3A3A3;
  --color-neutral-500: #737373;
  --color-neutral-600: #525252;
  --color-neutral-700: #404040;
  --color-neutral-800: #262626;
  --color-neutral-900: #171717;
  --color-neutral-950: #0A0A0A;

  /* Semantic */
  --color-success: #22C55E;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;

  /* Typography */
  --font-heading: 'Inter', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Spacing scale */
  --spacing-section: 6rem;
  --spacing-content: 4rem;

  /* Border radius */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;
}
```

```js
// apps/marketing/tailwind.config.js

import sharedConfig from '@bmn/config/tailwind';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [sharedConfig],
  content: [
    './app/**/*.{js,jsx,mdx}',
    './components/**/*.{js,jsx}',
  ],
};
```

---

## 3. Pages

### 3.1 Landing Page (`/`)

**Route:** `app/page.jsx`
**Rendering:** SSG (fully static, rebuilds on deploy)

#### Sections (top to bottom):

1. **Navigation Bar**
   - Logo (left)
   - Links: Features, Pricing, Blog, About
   - CTA buttons: "Log In" (ghost) + "Start Free" (primary)
   - Mobile hamburger menu
   - Sticky on scroll with backdrop blur

2. **Hero Section**
   - Headline: "Go from social media presence to branded product line in minutes, not months."
   - Subheadline: "Brand Me Now uses AI to analyze your social media, generate your brand identity, logos, and product mockups -- all in one guided session."
   - Primary CTA: "Start Building Your Brand -- Free" -> `app.brandmenow.com/signup`
   - Secondary CTA: "Watch Demo" -> scroll to demo video or modal
   - Hero visual: Animated mockup showing the wizard flow (social input -> brand identity -> logo -> mockup)

3. **Social Proof Bar**
   - "Trusted by 1,000+ creators" (update as numbers grow)
   - Platform logos: Instagram, TikTok, Facebook
   - Key stat badges: "< 15 min to full brand", "4 AI-generated logos", "Unlimited mockups"

4. **How It Works** (3-step)
   - Step 1: "Connect Your Social Media" -- illustration + brief description
   - Step 2: "AI Builds Your Brand" -- illustration showing logo/color/font generation
   - Step 3: "Get Product Mockups" -- illustration showing branded products
   - CTA: "Try It Free"

5. **Feature Showcase**
   - AI Social Analysis
   - Brand Identity Generation (vision, values, archetype, colors, fonts)
   - Logo Generation (4 AI options, refinement rounds)
   - Product Mockups (25+ products across 5 categories)
   - Profit Projections (margins, revenue tiers)
   - Each feature: title, description, screenshot/illustration, icon

6. **AI Models Powering Your Brand**
   - Brief showcase of the multi-model approach (without overwhelming non-technical users)
   - "Powered by leading AI models for every task -- the right tool for every step"
   - Visual: model logos (Claude, FLUX, GPT Image, etc.) in a tasteful grid

7. **Pricing Preview**
   - Compact version of the pricing page (4 tier cards)
   - CTA: "See Full Pricing" -> `/pricing`

8. **Testimonials / Social Proof**
   - 3 testimonial cards (photo, name, quote, platform)
   - Placeholder content for launch, replace with real testimonials post-launch

9. **FAQ**
   - Expandable accordion
   - Common questions: "How long does it take?", "Can I edit the AI results?", "What products are available?", "Do I need design experience?", "How does pricing work?"

10. **Final CTA Section**
    - Headline: "Ready to build your brand?"
    - CTA: "Start Your Free Trial" -> `app.brandmenow.com/signup`
    - Trust badges: "No credit card required", "Cancel anytime", "Your data is yours"

11. **Footer**
    - Brand Me Now logo
    - Columns: Product (Features, Pricing, Blog), Company (About, Contact, Careers), Legal (Privacy, Terms), Social (Twitter/X, Instagram, TikTok)
    - Copyright

### 3.2 Pricing Page (`/pricing`)

**Route:** `app/pricing/page.jsx`
**Rendering:** SSG with ISR (revalidate every 60 seconds for dynamic tier changes)

#### Pricing Tiers (from PRD Section 6):

| Tier | Price | Brands | Logo Gens | Mockup Gens | Key Features |
|------|-------|--------|-----------|-------------|-------------|
| **Free Trial** | $0 | 1 | 4 logos (1 round) | 4 mockups | Basic wizard, no download |
| **Starter** | $29/mo | 3 | 20 logos/mo | 30 mockups/mo | Download assets, email support |
| **Pro** | $79/mo | 10 | 50 logos/mo | 100 mockups/mo | Priority generation, video (Phase 2), chat support |
| **Agency** | $199/mo | Unlimited | 200 logos/mo | 500 mockups/mo | White-label, API access, phone support |

#### Page Sections:

1. **Pricing Header**
   - "Simple, transparent pricing"
   - Monthly / Annual toggle (annual = 2 months free)

2. **Tier Cards (4 columns, responsive to stacked on mobile)**
   - Each card: tier name, price, feature list with checkmarks, CTA button
   - Free Trial CTA: "Start Free" -> `app.brandmenow.com/signup`
   - Paid tiers CTA: "Get Started" -> `app.brandmenow.com/signup?tier={tier}`
   - Pro tier highlighted as "Most Popular"

3. **Feature Comparison Table**
   - Full feature matrix across all 4 tiers
   - Rows: brands, logo gens, mockup gens, download, support level, priority queue, video (Phase 2), white-label, API access
   - Checkmarks and limits per tier

4. **FAQ (Pricing-specific)**
   - "What happens when I run out of credits?"
   - "Can I upgrade/downgrade anytime?"
   - "Do unused credits roll over?" (No)
   - "What's the overage rate?"
   - "Is there an annual discount?"

5. **Enterprise CTA**
   - "Need more? Contact us for custom plans."
   - Link to `/contact`

### 3.3 Blog (`/blog`)

**Route:** `app/blog/page.jsx` (index), `app/blog/[slug]/page.jsx` (posts)
**Rendering:** SSG (build-time, new posts trigger redeploy via webhook)
**Content:** MDX files in `content/blog/`

#### Blog Architecture:

```
apps/marketing/
  content/
    blog/
      building-your-first-brand.mdx
      ai-logo-generation-explained.mdx
      social-media-to-product-line.mdx
      ...
```

Each MDX file has frontmatter:

```mdx
---
title: "How AI Logo Generation Actually Works"
description: "A behind-the-scenes look at the multi-model AI approach powering Brand Me Now's logo generation."
date: "2026-02-20"
author: "Matt Squarzoni"
image: "/blog/ai-logo-generation.jpg"
tags: ["AI", "Logo Design", "Technology"]
---

# Content here...
```

#### Blog Index Page:
- Grid of post cards (image, title, excerpt, date, tags)
- Filter by tag
- Pagination (12 posts per page)

#### Blog Post Page:
- Full MDX rendering with custom components (code blocks, images, callouts)
- Table of contents (auto-generated from headings)
- Author byline
- Related posts (tag-based)
- Share buttons (Twitter/X, LinkedIn, copy link)
- CTA banner at bottom: "Ready to try it? Start your free brand."

### 3.4 About Page (`/about`)

**Route:** `app/about/page.jsx`
**Rendering:** SSG

#### Sections:
1. **Mission** -- "We believe everyone deserves a professional brand"
2. **Story** -- How Brand Me Now started (Matt's story)
3. **Technology** -- Brief overview of the AI-powered approach
4. **Team** -- Founder profile (expandable for future team members)
5. **Values** -- Platform values (accessibility, quality, speed, privacy)

### 3.5 Contact / Support (`/contact`)

**Route:** `app/contact/page.jsx`
**Rendering:** SSG (form submits via API route)

#### Sections:
1. **Contact Form**
   - Fields: Name, Email, Subject (dropdown: General, Support, Sales, Partnership), Message
   - Submits to `app/api/contact/route.js` -> Resend email to support team
   - Success confirmation message

2. **Support Links**
   - "Existing customer? Log in to access chat support" -> `app.brandmenow.com/login`
   - Link to FAQ on landing page
   - Email: support@brandmenow.com

3. **Office / Social**
   - Social media links
   - Business hours (if applicable)

### 3.6 Privacy Policy (`/privacy`)

**Route:** `app/privacy/page.jsx`
**Rendering:** SSG

Content covers:
- Data collection (email, phone, name, social handles)
- AI processing (social analysis, image generation)
- Third-party services (Supabase, Anthropic, OpenAI, Google AI, BFL, Stripe, GoHighLevel, Apify, PostHog)
- Data retention (30-day job cleanup, 1-year audit logs)
- Right to deletion (GDPR Article 17)
- Cookie policy (PostHog analytics, essential cookies only)
- No password storage in CRM
- Contact for data requests

### 3.7 Terms of Service (`/terms`)

**Route:** `app/terms/page.jsx`
**Rendering:** SSG

Content covers:
- Service description
- Account responsibilities
- Subscription terms, billing, cancellation
- AI-generated content ownership (user owns their brand assets)
- Acceptable use policy
- Content moderation (NSFW filtering)
- Limitation of liability
- Dispute resolution

---

## 4. SEO

### Meta Tags Strategy

Every page uses a shared `metadata` export pattern:

```jsx
// app/pricing/page.jsx

export const metadata = {
  title: 'Pricing | Brand Me Now',
  description: 'Simple, transparent pricing for AI-powered brand creation. Start free, upgrade anytime. Plans from $0 to $199/mo.',
  openGraph: {
    title: 'Brand Me Now Pricing',
    description: 'AI-powered brand creation from $0/mo. Free trial, no credit card required.',
    url: 'https://brandmenow.com/pricing',
    siteName: 'Brand Me Now',
    images: [{ url: 'https://brandmenow.com/og/pricing.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Brand Me Now Pricing',
    description: 'AI-powered brand creation from $0/mo.',
    images: ['https://brandmenow.com/og/pricing.png'],
  },
};
```

### Structured Data (JSON-LD)

```jsx
// app/layout.jsx -- global structured data

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Brand Me Now',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          description: 'AI-powered brand creation platform. Go from social media to branded product line in minutes.',
          url: 'https://brandmenow.com',
          offers: [
            { '@type': 'Offer', name: 'Free Trial', price: '0', priceCurrency: 'USD' },
            { '@type': 'Offer', name: 'Starter', price: '29', priceCurrency: 'USD', billingPeriod: 'month' },
            { '@type': 'Offer', name: 'Pro', price: '79', priceCurrency: 'USD', billingPeriod: 'month' },
            { '@type': 'Offer', name: 'Agency', price: '199', priceCurrency: 'USD', billingPeriod: 'month' },
          ],
        })}} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Brand Me Now',
          url: 'https://brandmenow.com',
          logo: 'https://brandmenow.com/logo.png',
          sameAs: [
            'https://twitter.com/brandmenow',
            'https://instagram.com/brandmenow',
          ],
        })}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

**Blog post structured data:**

```jsx
// app/blog/[slug]/page.jsx

function generateBlogStructuredData(post) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: { '@type': 'Person', name: post.author },
    image: post.image,
    publisher: { '@type': 'Organization', name: 'Brand Me Now', logo: { '@type': 'ImageObject', url: 'https://brandmenow.com/logo.png' }},
  };
}
```

### Sitemap

```jsx
// app/sitemap.js

import { getAllBlogPosts } from '@/lib/blog';

export default async function sitemap() {
  const posts = await getAllBlogPosts();

  const staticPages = [
    { url: 'https://brandmenow.com', lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: 'https://brandmenow.com/pricing', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://brandmenow.com/about', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://brandmenow.com/contact', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://brandmenow.com/blog', lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: 'https://brandmenow.com/privacy', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: 'https://brandmenow.com/terms', lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  const blogPages = posts.map((post) => ({
    url: `https://brandmenow.com/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticPages, ...blogPages];
}
```

### robots.txt

```jsx
// app/robots.js

export default function robots() {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/'] },
    ],
    sitemap: 'https://brandmenow.com/sitemap.xml',
  };
}
```

---

## 5. Analytics -- PostHog Integration

```jsx
// app/providers.jsx

'use client';

import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false, // Manual pageview tracking below
    capture_pageleave: true,
  });
}

function PostHogPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname) {
      let url = window.origin + pathname;
      if (searchParams.toString()) url += '?' + searchParams.toString();
      posthog.capture('$pageview', { $current_url: url });
    }
  }, [pathname, searchParams]);

  return null;
}

export function Providers({ children }) {
  return (
    <PostHogProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageview />
      </Suspense>
      {children}
    </PostHogProvider>
  );
}
```

### Tracked Events

| Event | Trigger | Properties |
|-------|---------|-----------|
| `$pageview` | Every page navigation | URL, referrer |
| `pricing_tier_clicked` | User clicks "Get Started" on pricing card | `tier`, `billing_period` |
| `cta_clicked` | Any CTA button click | `location` (hero, footer, etc.), `destination` |
| `blog_post_viewed` | Blog post page load | `slug`, `tags`, `author` |
| `contact_form_submitted` | Contact form success | `subject` |
| `faq_expanded` | FAQ accordion opened | `question` |
| `demo_video_played` | Demo video play button clicked | `source` (hero, feature section) |

---

## 6. Auth Bridge

The marketing site does **not** handle authentication. All auth flows redirect to the Brand Builder app at `app.brandmenow.com`.

### Link Strategy

| Action | Marketing Site Link | Destination |
|--------|-------------------|-------------|
| "Start Free" / "Sign Up" | `https://app.brandmenow.com/signup` | App signup page |
| "Log In" | `https://app.brandmenow.com/login` | App login page |
| "Get Started" (pricing) | `https://app.brandmenow.com/signup?tier=starter` | App signup with tier pre-selected |
| "Dashboard" (if logged in) | `https://app.brandmenow.com/dashboard` | App dashboard |

### Optional: Auth-Aware Header

The marketing site can optionally detect if a user is logged in via a shared Supabase cookie (httpOnly, SameSite=Lax across `*.brandmenow.com`) to show "Dashboard" instead of "Log In" in the nav:

```jsx
// lib/supabase-server.js

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function getSession() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
```

```jsx
// components/Header.jsx

import { getSession } from '@/lib/supabase-server';

export default async function Header() {
  const session = await getSession();

  return (
    <header>
      <nav>
        {/* ... navigation links ... */}
        {session ? (
          <a href="https://app.brandmenow.com/dashboard" className="btn-primary">Dashboard</a>
        ) : (
          <>
            <a href="https://app.brandmenow.com/login" className="btn-ghost">Log In</a>
            <a href="https://app.brandmenow.com/signup" className="btn-primary">Start Free</a>
          </>
        )}
      </nav>
    </header>
  );
}
```

---

## 7. Deployment -- Vercel

### Configuration

```json
// vercel.json

{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install --filter @bmn/marketing...",
  "outputDirectory": ".next",
  "regions": ["iad1"],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ],
  "redirects": [
    { "source": "/app", "destination": "https://app.brandmenow.com", "permanent": false },
    { "source": "/login", "destination": "https://app.brandmenow.com/login", "permanent": false },
    { "source": "/signup", "destination": "https://app.brandmenow.com/signup", "permanent": false }
  ]
}
```

### Environment Variables (Vercel Dashboard)

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_APP_URL=https://app.brandmenow.com
RESEND_API_KEY=re_xxx
SUPPORT_EMAIL=support@brandmenow.com
```

### Preview Deployments

- Every PR to `main` targeting `apps/marketing/` gets a Vercel preview URL
- Preview URLs follow pattern: `bmn-marketing-{branch}-{hash}.vercel.app`
- Useful for reviewing blog posts, pricing changes, and design updates before production

### Production Deploy

- Merges to `main` auto-deploy to `brandmenow.com`
- Vercel handles SSL, CDN, edge caching for SSG pages
- ISR pages revalidate per configured interval (60s for pricing)

---

## 8. Directory Structure

```
apps/marketing/
├── app/
│   ├── layout.jsx                    # Root layout (Header, Footer, Providers)
│   ├── page.jsx                      # Landing page (/)
│   ├── providers.jsx                 # PostHog, Supabase providers
│   ├── globals.css                   # Tailwind 4 imports + design tokens
│   ├── sitemap.js                    # Dynamic sitemap generation
│   ├── robots.js                     # robots.txt generation
│   │
│   ├── pricing/
│   │   └── page.jsx                  # Pricing page (/pricing)
│   │
│   ├── blog/
│   │   ├── page.jsx                  # Blog index (/blog)
│   │   └── [slug]/
│   │       └── page.jsx              # Blog post (/blog/[slug])
│   │
│   ├── about/
│   │   └── page.jsx                  # About page (/about)
│   │
│   ├── contact/
│   │   └── page.jsx                  # Contact page (/contact)
│   │
│   ├── privacy/
│   │   └── page.jsx                  # Privacy policy (/privacy)
│   │
│   ├── terms/
│   │   └── page.jsx                  # Terms of service (/terms)
│   │
│   └── api/
│       └── contact/
│           └── route.js              # Contact form handler (Resend)
│
├── components/
│   ├── Header.jsx                    # Global nav (auth-aware)
│   ├── Footer.jsx                    # Global footer
│   ├── Hero.jsx                      # Landing page hero
│   ├── FeatureShowcase.jsx           # Landing page features
│   ├── HowItWorks.jsx               # 3-step section
│   ├── PricingCards.jsx              # Pricing tier cards (reused on landing + pricing page)
│   ├── PricingTable.jsx              # Full feature comparison table
│   ├── Testimonials.jsx              # Testimonial cards
│   ├── FAQ.jsx                       # Accordion FAQ
│   ├── CTA.jsx                       # Reusable CTA section
│   ├── BlogCard.jsx                  # Blog post card for index
│   ├── BlogContent.jsx               # MDX renderer with custom components
│   ├── TableOfContents.jsx           # Auto-generated TOC for blog posts
│   ├── ContactForm.jsx               # Contact form (client component)
│   └── ui/                           # Shared UI primitives
│       ├── Button.jsx
│       ├── Card.jsx
│       ├── Badge.jsx
│       ├── Accordion.jsx
│       └── Container.jsx
│
├── content/
│   └── blog/                         # MDX blog posts
│       ├── building-your-first-brand.mdx
│       ├── ai-logo-generation-explained.mdx
│       └── ...
│
├── lib/
│   ├── blog.js                       # Blog MDX utilities (getPostBySlug, getAllPosts)
│   ├── supabase-server.js            # Supabase SSR client (auth-aware header)
│   └── posthog.js                    # PostHog server-side helpers
│
├── public/
│   ├── logo.png                      # Brand Me Now logo
│   ├── logo.svg                      # Brand Me Now logo (vector)
│   ├── favicon.ico
│   ├── og/                           # Open Graph images
│   │   ├── default.png               # Default OG image (1200x630)
│   │   ├── pricing.png               # Pricing page OG
│   │   └── blog/                     # Blog post OG images
│   ├── blog/                         # Blog post images
│   └── illustrations/                # Landing page illustrations
│
├── next.config.js                    # Next.js configuration
├── tailwind.config.js                # Tailwind CSS 4 config (imports shared preset)
├── jsconfig.json                     # Path aliases (@/ -> ./)
├── package.json                      # Dependencies
├── vercel.json                       # Vercel deployment config
└── .env.local                        # Local env vars (not committed)
```

---

## 9. Configuration Files

### package.json

```json
{
  "name": "@bmn/marketing",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3100",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --ext .js,.jsx"
  },
  "dependencies": {
    "next": "^15.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@supabase/ssr": "^0.6.0",
    "@supabase/supabase-js": "^2.49.0",
    "posthog-js": "^1.200.0",
    "resend": "^4.2.0",
    "@next/mdx": "^15.2.0",
    "@mdx-js/react": "^3.1.0",
    "gray-matter": "^4.0.3",
    "remark-gfm": "^4.0.0",
    "rehype-slug": "^6.0.0",
    "rehype-pretty-code": "^0.14.0",
    "motion": "^12.0.0",
    "lucide-react": "^0.475.0",
    "clsx": "^2.1.0"
  },
  "devDependencies": {
    "@bmn/config": "workspace:*",
    "tailwindcss": "^4.0.0",
    "eslint": "^9.20.0",
    "eslint-config-next": "^15.2.0"
  }
}
```

### next.config.js

```js
// next.config.js

import createMDX from '@next/mdx';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypePrettyCode from 'rehype-pretty-code';

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['js', 'jsx', 'mdx'],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'brandmenow.com' },
    ],
  },

  // Strict security headers handled in vercel.json
  poweredByHeader: false,

  async rewrites() {
    return [
      // Proxy PostHog to avoid ad blockers
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ];
  },
};

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeSlug, [rehypePrettyCode, { theme: 'github-dark-default' }]],
  },
});

export default withMDX(nextConfig);
```

### jsconfig.json

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    },
    "checkJs": true
  },
  "include": ["**/*.js", "**/*.jsx"],
  "exclude": ["node_modules", ".next"]
}
```

---

## 10. Development Prompt

> You are building the Brand Me Now marketing website. It is a Next.js 15 App Router application using JavaScript + JSDoc (not TypeScript). It uses Tailwind CSS 4 with shared design tokens imported from `@bmn/config/tailwind`. All pages are statically generated (SSG) except pricing (ISR, 60s revalidation). The blog uses MDX files in `content/blog/`. PostHog is integrated for analytics. The site does NOT handle authentication -- all auth flows redirect to `app.brandmenow.com`. The contact form submits via a Next.js API route that sends email through Resend. The site deploys to Vercel with preview deployments per PR. Every page must have proper meta tags, Open Graph images, and structured data (JSON-LD). Use Motion (framer-motion successor) for animations. Use Lucide React for icons. The design system uses CSS variables shared with the main Brand Builder app.

---

## 11. Acceptance Criteria

### General
- [ ] All pages render correctly at mobile (375px), tablet (768px), and desktop (1440px) breakpoints
- [ ] Lighthouse score: Performance > 95, Accessibility > 95, SEO > 95, Best Practices > 95
- [ ] All images have alt text and are served via `next/image` with proper dimensions
- [ ] No layout shift (CLS < 0.1) on any page
- [ ] Dark mode support via CSS variables (prefers-color-scheme media query)

### Landing Page
- [ ] Hero section loads above the fold with CTA visible without scrolling
- [ ] "Start Free" CTA links to `app.brandmenow.com/signup`
- [ ] All feature sections render with illustrations/screenshots
- [ ] FAQ accordion expands/collapses smoothly
- [ ] PostHog tracks `cta_clicked` events on all CTA buttons

### Pricing Page
- [ ] All 4 tiers display correct pricing from PRD ($0, $29, $79, $199)
- [ ] Monthly/Annual toggle works and shows correct prices (annual = 2 months free)
- [ ] "Most Popular" badge on Pro tier
- [ ] Feature comparison table is horizontally scrollable on mobile
- [ ] CTA buttons pass `?tier={tier}` query param to signup URL
- [ ] ISR revalidates every 60 seconds

### Blog
- [ ] MDX posts render with proper typography, code highlighting, and images
- [ ] Blog index shows paginated post cards (12 per page)
- [ ] Tag filtering works
- [ ] Table of contents auto-generates from headings
- [ ] Each post has unique structured data (BlogPosting schema)
- [ ] Related posts section shows 3 posts with matching tags

### SEO
- [ ] Every page has unique `<title>` and `<meta name="description">`
- [ ] Open Graph tags render correctly (validate with opengraph.xyz)
- [ ] Twitter Card tags render correctly (validate with cards-dev.twitter.com)
- [ ] `sitemap.xml` includes all static pages and all blog posts
- [ ] `robots.txt` allows all pages except `/api/`
- [ ] JSON-LD structured data validates (test with Google Rich Results Test)
- [ ] Canonical URLs set on all pages

### Analytics
- [ ] PostHog loads and captures `$pageview` on every navigation
- [ ] `pricing_tier_clicked` fires when a pricing CTA is clicked
- [ ] `blog_post_viewed` fires on blog post pages
- [ ] `contact_form_submitted` fires on successful form submission
- [ ] PostHog proxy rewrite works (`/ingest/*` -> PostHog)

### Auth Bridge
- [ ] "Log In" links to `app.brandmenow.com/login`
- [ ] "Sign Up" / "Start Free" links to `app.brandmenow.com/signup`
- [ ] Pricing CTAs include `?tier=` query parameter
- [ ] `/login`, `/signup`, `/app` redirects work (vercel.json)
- [ ] Auth-aware header shows "Dashboard" for logged-in users (optional, depends on shared cookie setup)

### Deployment
- [ ] Vercel build succeeds from monorepo root
- [ ] Preview deployments work for PRs targeting `apps/marketing/`
- [ ] Production auto-deploys on merge to `main`
- [ ] All environment variables configured in Vercel dashboard
- [ ] Security headers present (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- [ ] No exposed API keys in client-side bundle

### Contact Form
- [ ] Form validates all required fields before submission
- [ ] Successful submission sends email via Resend to support team
- [ ] Success message displayed after submission
- [ ] Rate limited to prevent spam (5 submissions per IP per hour)
- [ ] Honeypot field for bot detection

---

## 12. Dependencies on Other PRDs

| PRD | Dependency |
|-----|-----------|
| 01-PRODUCT-REQUIREMENTS | Pricing tiers, feature list, product categories |
| 09-GREENFIELD-REBUILD-BLUEPRINT | Shared design tokens, domain architecture, Supabase config |
| 16-MIGRATION-GUIDE | DNS cutover plan for `brandmenow.com` |
