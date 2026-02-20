'use client';

import { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { Clock, Sparkles, CheckCircle } from 'lucide-react';

interface DemoShowcase {
  label: string;
  audienceSize: string;
  niche: string;
  avatar: string;
  brandName: string;
  challenge: string;
  experience: string;
  timeline: string;
  whatYouGet: string[];
  platformQuote: string;
  brandColors: string[];
}

const demoShowcases: DemoShowcase[] = [
  {
    label: 'Fitness Creator',
    audienceSize: '300K followers',
    niche: 'Fitness & Wellness',
    avatar: 'FC',
    brandName: 'APEX FIT',
    challenge:
      'A fitness creator with 300K Instagram followers and a 3.2% engagement rate. Posts workout content and supplement recommendations. Has tried freelance designers and DIY tools but ended up with generic results that didn\'t match their content aesthetic.',
    experience:
      'In one session, Brand Me Now analyzes their content, identifies their high-energy motivational niche, and generates a full brand identity with logos, branded supplement mockups, and apparel designs — all reflecting their actual content style and audience demographics.',
    timeline: '~12 minutes from start to finish',
    whatYouGet: [
      'Complete brand identity with 3 unique directions',
      'Logo variations tailored to fitness aesthetic',
      'Supplement & apparel product mockups',
      'Revenue estimates based on real audience data',
    ],
    platformQuote:
      'The AI analyzes content style, audience demographics, and engagement patterns to generate a brand identity that feels like a natural extension of the creator\'s existing presence.',
    brandColors: ['#1a1a2e', '#e94560', '#0f3460'],
  },
  {
    label: 'Beauty Creator',
    audienceSize: '500K followers',
    niche: 'Beauty & Skincare',
    avatar: 'BC',
    brandName: 'Glow Theory',
    challenge:
      'A beauty creator reviewing skincare products on TikTok with 500K followers. Every attempt to create a personal brand felt disconnected from their content style. They wanted something that matched their clean, scientific aesthetic.',
    experience:
      'The AI analyzes their TikTok profile and identifies their "science meets beauty" angle. It generates a clinical-yet-approachable brand identity with a muted pink and deep purple palette. Skincare product mockups are designed to look retail-ready from day one.',
    timeline: '~15 minutes from start to finish',
    whatYouGet: [
      'Brand archetype matched to content voice',
      'Color palette derived from actual content',
      'Skincare product line mockups',
      'Typography & visual identity system',
    ],
    platformQuote:
      'Brand Me Now doesn\'t just pick random colors — it studies the visual patterns in your content and builds a palette that your existing audience will immediately recognize as yours.',
    brandColors: ['#fce4ec', '#ec407a', '#4a148c'],
  },
  {
    label: 'Food Creator',
    audienceSize: '170K followers',
    niche: 'Food & Cooking',
    avatar: 'FK',
    brandName: 'Plate & Pour',
    challenge:
      'A food creator sharing fusion recipes on Instagram with 170K loyal followers. Has considered spice blends and cooking gear but felt overwhelmed by the branding process — didn\'t know where to start or how to make products feel authentic.',
    experience:
      'Brand Me Now detects their warm, inviting food photography style and generates a brand with rich, earthy tones. The AI recommends spice blends, cooking aprons, and recipe journals — products matched to the audience\'s interests and purchase behavior.',
    timeline: '~10 minutes from start to finish',
    whatYouGet: [
      'Warm, niche-appropriate brand identity',
      'Product recommendations based on audience fit',
      'Branded spice blend & apron mockups',
      'Audience-aware pricing suggestions',
    ],
    platformQuote:
      'Product recommendations aren\'t random — they\'re selected based on the creator\'s niche, audience demographics, and the types of products that perform best in their category.',
    brandColors: ['#fff8e1', '#e65100', '#3e2723'],
  },
];

export function CaseStudyGrid() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <section ref={ref} className="py-12">
      <div className="mx-auto max-w-5xl space-y-12 px-4 sm:px-6 lg:px-8">
        {demoShowcases.map((demo, i) => (
          <motion.article
            key={demo.label}
            initial={{ opacity: 0, y: 50 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.15 * i, duration: 0.6 }}
            className="overflow-hidden rounded-2xl border border-[var(--bmn-color-border)]"
          >
            {/* Brand banner */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ backgroundColor: demo.brandColors[0] }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: demo.brandColors[1],
                    color: '#ffffff',
                  }}
                >
                  {demo.avatar}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    Demo: {demo.label}
                  </p>
                  <p className="text-xs text-white/60">
                    {demo.audienceSize}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
                {demo.niche}
              </span>
            </div>

            <div className="p-6">
              {/* Brand name */}
              <h3
                className="mb-4 text-xl font-bold"
                style={{ fontFamily: 'var(--bmn-font-secondary)' }}
              >
                Generated Brand: {demo.brandName}
              </h3>

              {/* Color palette */}
              <div className="mb-6 flex gap-1.5">
                {demo.brandColors.map((color, j) => (
                  <div
                    key={j}
                    className="h-5 w-5 rounded-full border border-[var(--bmn-color-border)]"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              {/* Challenge / Experience */}
              <div className="mb-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[var(--bmn-color-border)] p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--bmn-color-text-muted)]">
                    The Challenge
                  </p>
                  <p className="text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                    {demo.challenge}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--bmn-color-accent)]/30 bg-[var(--bmn-color-accent-light)] p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--bmn-color-accent)]">
                    The Brand Me Now Experience
                  </p>
                  <p className="text-sm leading-relaxed text-[var(--bmn-color-text-secondary)]">
                    {demo.experience}
                  </p>
                </div>
              </div>

              {/* Quote */}
              <blockquote className="mb-6 border-l-2 border-[var(--bmn-color-accent)] pl-4 text-sm italic text-[var(--bmn-color-text-secondary)]">
                &ldquo;{demo.platformQuote}&rdquo;
                <span className="mt-1 block text-xs not-italic text-[var(--bmn-color-text-muted)]">
                  — How the AI works
                </span>
              </blockquote>

              {/* What You'd Get + Timeline */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--bmn-color-border)] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles
                      size={16}
                      className="text-[var(--bmn-color-accent)]"
                    />
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--bmn-color-text-muted)]">
                      What You&apos;d Get
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {demo.whatYouGet.map((item, j) => (
                      <li
                        key={j}
                        className="flex items-start gap-2 text-sm text-[var(--bmn-color-text-secondary)]"
                      >
                        <CheckCircle
                          size={14}
                          className="mt-0.5 shrink-0 text-[var(--bmn-color-accent)]"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center justify-center rounded-xl border border-[var(--bmn-color-border)] p-4 text-center">
                  <div>
                    <Clock
                      size={24}
                      className="mx-auto mb-2 text-[var(--bmn-color-accent)]"
                    />
                    <p className="text-sm font-bold">{demo.timeline}</p>
                    <p className="text-xs text-[var(--bmn-color-text-muted)]">
                      Estimated session time
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
