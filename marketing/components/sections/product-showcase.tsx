'use client';

import { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { Pill, Shirt, Smartphone, Gem, Home } from 'lucide-react';

const categories = [
  {
    name: 'Supplements',
    count: '8 products',
    icon: Pill,
    examples: ['Protein Powder', 'Pre-Workout', 'Vitamins', 'Collagen'],
    gradient: 'from-emerald-500/10 to-teal-500/10',
  },
  {
    name: 'Apparel',
    count: '6 products',
    icon: Shirt,
    examples: ['T-Shirts', 'Hoodies', 'Hats', 'Joggers'],
    gradient: 'from-blue-500/10 to-indigo-500/10',
  },
  {
    name: 'Accessories',
    count: '5 products',
    icon: Smartphone,
    examples: ['Phone Cases', 'Tote Bags', 'Water Bottles', 'Stickers'],
    gradient: 'from-purple-500/10 to-pink-500/10',
  },
  {
    name: 'Beauty',
    count: '4 products',
    icon: Gem,
    examples: ['Skincare Sets', 'Lip Balm', 'Face Masks', 'Serums'],
    gradient: 'from-rose-500/10 to-orange-500/10',
  },
  {
    name: 'Home',
    count: '3 products',
    icon: Home,
    examples: ['Candles', 'Mugs', 'Journals'],
    gradient: 'from-amber-500/10 to-yellow-500/10',
  },
];

export function ProductShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section
      ref={ref}
      className="border-t border-[var(--bmn-color-border)] py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--bmn-color-accent)]"
          >
            Product Catalog
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            25+ products across 5 categories
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-4 max-w-2xl text-[var(--bmn-color-text-secondary)]"
          >
            From supplements to apparel, our AI renders professional branded
            mockups for every product.
          </motion.p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {categories.map((cat, i) => {
            const Icon = cat.icon;
            return (
              <motion.div
                key={cat.name}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1 * i, duration: 0.4 }}
                className="rounded-2xl border border-[var(--bmn-color-border)] p-5 transition-shadow hover:shadow-lg"
              >
                <div
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${cat.gradient}`}
                >
                  <Icon size={20} className="text-[var(--bmn-color-text-secondary)]" />
                </div>
                <h3 className="font-semibold">{cat.name}</h3>
                <p className="mb-3 text-xs text-[var(--bmn-color-text-muted)]">
                  {cat.count}
                </p>
                <ul className="space-y-1">
                  {cat.examples.map((ex) => (
                    <li
                      key={ex}
                      className="text-xs text-[var(--bmn-color-text-secondary)]"
                    >
                      {ex}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
