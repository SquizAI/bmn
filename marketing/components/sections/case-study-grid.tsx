'use client';

import { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { TrendingUp, Clock, ShoppingBag, Users } from 'lucide-react';

interface CaseStudy {
  name: string;
  handle: string;
  niche: string;
  avatar: string;
  followers: string;
  brandName: string;
  before: string;
  after: string;
  timeline: string;
  metrics: {
    revenue: string;
    productsSold: string;
    customers: string;
  };
  quote: string;
  brandColors: string[];
}

const caseStudies: CaseStudy[] = [
  {
    name: 'Maya Rodriguez',
    handle: '@mayafitlife',
    niche: 'Fitness & Wellness',
    avatar: 'MR',
    followers: '342K',
    brandName: 'APEX FIT',
    before:
      'Maya was posting workout content and supplement recommendations to her 342K Instagram followers. She had tried to start a brand twice before — once with a freelance designer ($3,000 for a logo she never used) and once with a DIY tool that produced generic results.',
    after:
      'In one 12-minute session, Brand Me Now analyzed her content, identified her high-energy motivational niche, and generated a full brand identity with 4 logos, branded supplement mockups, and apparel designs. She launched her first product drop within a week.',
    timeline: '12 minutes to brand, 7 days to first sale',
    metrics: {
      revenue: '$12,400/mo',
      productsSold: '3,200+',
      customers: '1,800+',
    },
    quote:
      'I spent $3K on a designer and got nothing. Brand Me Now gave me a complete brand in minutes — and my audience actually loved it.',
    brandColors: ['#1a1a2e', '#e94560', '#0f3460'],
  },
  {
    name: 'James Chen',
    handle: '@jchenbeauty',
    niche: 'Beauty & Skincare',
    avatar: 'JC',
    followers: '512K',
    brandName: 'Glow Theory',
    before:
      'James was reviewing beauty products on TikTok but had no brand of his own. Every attempt to create a brand felt disconnected from his content style. He wanted something that matched the clean, scientific aesthetic of his videos.',
    after:
      'The AI analyzed his TikTok profile and immediately identified his "science meets beauty" angle. It generated a clinical-yet-approachable brand identity with a muted pink and deep purple palette. The skincare product mockups looked professional enough to sell on day one.',
    timeline: '15 minutes to brand, 14 days to first sale',
    metrics: {
      revenue: '$8,700/mo',
      productsSold: '2,100+',
      customers: '1,200+',
    },
    quote:
      'The AI pulled my vibe straight from my content. My audience immediately connected with the products because they looked like a natural extension of my brand.',
    brandColors: ['#fce4ec', '#ec407a', '#4a148c'],
  },
  {
    name: 'Priya Sharma',
    handle: '@priyacooks',
    niche: 'Food & Cooking',
    avatar: 'PS',
    followers: '167K',
    brandName: 'Plate & Pour',
    before:
      'Priya shared Indian-fusion recipes on Instagram and had a loyal following, but no way to monetize beyond sponsorships. She had considered spice blends and cooking gear but felt overwhelmed by the branding process.',
    after:
      'Brand Me Now detected her warm, inviting food photography style and generated a brand with rich, earthy tones. The AI recommended spice blends, cooking aprons, and recipe journals — products that matched her audience perfectly. Her custom spice blend mockups looked ready for retail shelves.',
    timeline: '10 minutes to brand, 10 days to first sale',
    metrics: {
      revenue: '$5,200/mo',
      productsSold: '890+',
      customers: '650+',
    },
    quote:
      'I tried designing my own brand for months. Brand Me Now did it in one session and it looked 10x more professional than anything I came up with.',
    brandColors: ['#fff8e1', '#e65100', '#3e2723'],
  },
];

export function CaseStudyGrid() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <section ref={ref} className="py-12">
      <div className="mx-auto max-w-5xl space-y-12 px-4 sm:px-6 lg:px-8">
        {caseStudies.map((study, i) => (
          <motion.article
            key={study.name}
            initial={{ opacity: 0, y: 50 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.15 * i, duration: 0.6 }}
            className="overflow-hidden rounded-2xl border border-[var(--bmn-color-border)]"
          >
            {/* Brand banner */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ backgroundColor: study.brandColors[0] }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: study.brandColors[1],
                    color: '#ffffff',
                  }}
                >
                  {study.avatar}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{study.name}</p>
                  <p className="text-xs text-white/60">
                    {study.handle} &middot; {study.followers} followers
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
                {study.niche}
              </span>
            </div>

            <div className="p-6">
              {/* Brand name */}
              <h3
                className="mb-4 text-xl font-bold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                Brand: {study.brandName}
              </h3>

              {/* Color palette */}
              <div className="mb-6 flex gap-1.5">
                {study.brandColors.map((color, j) => (
                  <div
                    key={j}
                    className="h-5 w-5 rounded-full border border-[var(--bmn-color-border)]"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              {/* Before / After */}
              <div className="mb-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[var(--bmn-color-border)] p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--bmn-color-text-muted)]">
                    Before
                  </p>
                  <p className="text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                    {study.before}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--bmn-color-accent)]/30 bg-[var(--bmn-color-accent-light)] p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--bmn-color-accent)]">
                    After
                  </p>
                  <p className="text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                    {study.after}
                  </p>
                </div>
              </div>

              {/* Quote */}
              <blockquote className="mb-6 border-l-2 border-[var(--bmn-color-accent)] pl-4 text-sm italic text-[var(--bmn-color-text-secondary)]">
                &ldquo;{study.quote}&rdquo;
              </blockquote>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-[var(--bmn-color-border)] p-3 text-center">
                  <TrendingUp
                    size={16}
                    className="mx-auto mb-1 text-[var(--bmn-color-accent)]"
                  />
                  <p className="text-sm font-bold">{study.metrics.revenue}</p>
                  <p className="text-xs text-[var(--bmn-color-text-muted)]">
                    Monthly Revenue
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--bmn-color-border)] p-3 text-center">
                  <ShoppingBag
                    size={16}
                    className="mx-auto mb-1 text-[var(--bmn-color-accent)]"
                  />
                  <p className="text-sm font-bold">
                    {study.metrics.productsSold}
                  </p>
                  <p className="text-xs text-[var(--bmn-color-text-muted)]">
                    Products Sold
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--bmn-color-border)] p-3 text-center">
                  <Users
                    size={16}
                    className="mx-auto mb-1 text-[var(--bmn-color-accent)]"
                  />
                  <p className="text-sm font-bold">{study.metrics.customers}</p>
                  <p className="text-xs text-[var(--bmn-color-text-muted)]">
                    Customers
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--bmn-color-border)] p-3 text-center">
                  <Clock
                    size={16}
                    className="mx-auto mb-1 text-[var(--bmn-color-accent)]"
                  />
                  <p className="text-sm font-bold">{study.timeline.split(',')[0]}</p>
                  <p className="text-xs text-[var(--bmn-color-text-muted)]">
                    Time to Brand
                  </p>
                </div>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
