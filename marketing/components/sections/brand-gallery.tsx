'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface SampleBrand {
  name: string;
  tagline: string;
  niche: string;
  colors: string[];
  products: string[];
  followers: string;
  creator: string;
}

const niches = ['All', 'Fitness', 'Beauty', 'Wellness', 'Food', 'Fashion', 'Tech'];

const sampleBrands: SampleBrand[] = [
  {
    name: 'APEX FIT',
    tagline: 'Engineered for Performance',
    niche: 'Fitness',
    colors: ['#1a1a2e', '#16213e', '#e94560', '#0f3460'],
    products: ['Pre-Workout', 'Protein Powder', 'Compression Tee'],
    followers: '342K',
    creator: '@alexmoves',
  },
  {
    name: 'Glow Theory',
    tagline: 'Science Meets Radiance',
    niche: 'Beauty',
    colors: ['#fce4ec', '#f8bbd0', '#ec407a', '#ad1457'],
    products: ['Face Serum', 'Lip Balm Set', 'Eye Cream'],
    followers: '189K',
    creator: '@skinbyrena',
  },
  {
    name: 'NutraVibe',
    tagline: 'Nourish Your Potential',
    niche: 'Wellness',
    colors: ['#e8f5e9', '#66bb6a', '#2e7d32', '#1b5e20'],
    products: ['Multivitamin', 'Sleep Formula', 'Collagen Powder'],
    followers: '95K',
    creator: '@wellnesswithjo',
  },
  {
    name: 'Plate & Pour',
    tagline: 'Elevated Everyday Dining',
    niche: 'Food',
    colors: ['#fff8e1', '#ffb74d', '#e65100', '#3e2723'],
    products: ['Spice Blends', 'Cooking Apron', 'Recipe Journal'],
    followers: '278K',
    creator: '@chefnova',
  },
  {
    name: 'STRUK',
    tagline: 'Streetwear That Speaks',
    niche: 'Fashion',
    colors: ['#000000', '#212121', '#ff6f00', '#ffffff'],
    products: ['Oversized Hoodie', 'Dad Hat', 'Crossbody Bag'],
    followers: '512K',
    creator: '@jfitsnyc',
  },
  {
    name: 'ByteShift',
    tagline: 'Tech for the Bold',
    niche: 'Tech',
    colors: ['#0d1117', '#161b22', '#58a6ff', '#c9d1d9'],
    products: ['Phone Case', 'Laptop Sleeve', 'Cable Organizer'],
    followers: '134K',
    creator: '@devdiana',
  },
  {
    name: 'FlexForm',
    tagline: 'Move Without Limits',
    niche: 'Fitness',
    colors: ['#1a237e', '#283593', '#42a5f5', '#e3f2fd'],
    products: ['Creatine', 'Training Shorts', 'Shaker Bottle'],
    followers: '421K',
    creator: '@mikelifts',
  },
  {
    name: 'Aura Botanics',
    tagline: 'Nature, Refined',
    niche: 'Beauty',
    colors: ['#f3e5f5', '#ce93d8', '#7b1fa2', '#4a148c'],
    products: ['Essential Oil Set', 'Face Mask', 'Body Scrub'],
    followers: '67K',
    creator: '@botanic.babe',
  },
  {
    name: 'ZenFuel',
    tagline: 'Balanced Energy, Every Day',
    niche: 'Wellness',
    colors: ['#e0f2f1', '#80cbc4', '#00695c', '#004d40'],
    products: ['Adaptogen Blend', 'Calm Tea', 'Journal'],
    followers: '156K',
    creator: '@zenwithlily',
  },
];

export function BrandGallery() {
  const [activeNiche, setActiveNiche] = useState('All');

  const filtered =
    activeNiche === 'All'
      ? sampleBrands
      : sampleBrands.filter((b) => b.niche === activeNiche);

  return (
    <section className="py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {niches.map((niche) => (
            <button
              key={niche}
              onClick={() => setActiveNiche(niche)}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-all',
                activeNiche === niche
                  ? 'bg-[var(--bmn-color-primary)] text-[var(--bmn-color-primary-foreground)]'
                  : 'border border-[var(--bmn-color-border)] text-[var(--bmn-color-text-secondary)] hover:border-[var(--bmn-color-border-hover)]',
              )}
            >
              {niche}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((brand) => (
            <div
              key={brand.name}
              className="group overflow-hidden rounded-2xl border border-[var(--bmn-color-border)] transition-shadow hover:shadow-lg"
            >
              {/* Brand header / logo area */}
              <div
                className="flex h-40 items-center justify-center"
                style={{ backgroundColor: brand.colors[0] }}
              >
                <div className="text-center">
                  <h3
                    className="text-2xl font-bold tracking-wider"
                    style={{ color: brand.colors[3] || '#ffffff', fontFamily: 'var(--bmn-font-secondary)' }}
                  >
                    {brand.name}
                  </h3>
                  <p
                    className="mt-1 text-xs tracking-wide"
                    style={{ color: `${brand.colors[3] || '#ffffff'}99` }}
                  >
                    {brand.tagline}
                  </p>
                </div>
              </div>

              {/* Brand details */}
              <div className="p-5">
                {/* Color palette */}
                <div className="mb-4 flex gap-1.5">
                  {brand.colors.map((color, i) => (
                    <div
                      key={i}
                      className="h-6 w-6 rounded-full border border-[var(--bmn-color-border)]"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>

                {/* Meta */}
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-full bg-[var(--bmn-color-accent-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--bmn-color-accent)]">
                    {brand.niche}
                  </span>
                  <span className="text-xs text-[var(--bmn-color-text-muted)]">
                    {brand.creator} &middot; {brand.followers}
                  </span>
                </div>

                {/* Products */}
                <div className="flex flex-wrap gap-1.5">
                  {brand.products.map((product) => (
                    <span
                      key={product}
                      className="rounded-md border border-[var(--bmn-color-border)] px-2 py-0.5 text-xs text-[var(--bmn-color-text-secondary)]"
                    >
                      {product}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
