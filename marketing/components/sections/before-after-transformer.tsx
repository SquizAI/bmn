'use client';

import { useRef, useState, useCallback } from 'react';
import { motion, useInView } from 'motion/react';
import { cn } from '@/lib/utils';

const examples = [
  {
    label: 'Supplement Jar',
    genericColor: 'from-gray-200 to-gray-300',
    brandedColor: 'from-[#B8956A] to-[#94704B]',
    genericLabel: 'Generic Product',
    brandedLabel: 'Your Brand',
  },
  {
    label: 'T-Shirt',
    genericColor: 'from-gray-200 to-gray-300',
    brandedColor: 'from-indigo-400 to-purple-500',
    genericLabel: 'Blank Apparel',
    brandedLabel: 'Branded Merch',
  },
  {
    label: 'Phone Case',
    genericColor: 'from-gray-200 to-gray-300',
    brandedColor: 'from-rose-400 to-pink-500',
    genericLabel: 'Plain Case',
    brandedLabel: 'Custom Design',
  },
];

export function BeforeAfterTransformer() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  const [activeIndex, setActiveIndex] = useState(0);
  const [sliderPosition, setSliderPosition] = useState(50);
  const sliderRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const active = examples[activeIndex];

  const handleMove = useCallback((clientX: number) => {
    if (!sliderRef.current || !dragging.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(pct);
  }, []);

  const handleMouseDown = useCallback(() => {
    dragging.current = true;
  }, []);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <section ref={ref} className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--bmn-color-accent)]"
          >
            The Transformation
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: 'var(--bmn-font-secondary)' }}
          >
            From generic to branded in seconds
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 }}
            className="mx-auto mt-3 max-w-xl text-[var(--bmn-color-text-secondary)]"
          >
            Drag the slider to see the before and after.
          </motion.p>
        </div>

        {/* Product selector tabs */}
        <div className="mb-8 flex justify-center gap-2">
          {examples.map((ex, i) => (
            <button
              key={ex.label}
              onClick={() => { setActiveIndex(i); setSliderPosition(50); }}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-all',
                activeIndex === i
                  ? 'bg-[var(--bmn-color-primary)] text-[var(--bmn-color-primary-foreground)]'
                  : 'border border-[var(--bmn-color-border)] text-[var(--bmn-color-text-secondary)] hover:border-[var(--bmn-color-border-hover)]',
              )}
            >
              {ex.label}
            </button>
          ))}
        </div>

        {/* Slider area */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3 }}
          className="mx-auto max-w-2xl"
        >
          <div
            ref={sliderRef}
            className="relative aspect-[4/3] cursor-col-resize select-none overflow-hidden rounded-2xl border border-[var(--bmn-color-border)]"
            onMouseDown={handleMouseDown}
            onMouseMove={(e) => handleMove(e.clientX)}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={(e) => handleMove(e.touches[0].clientX)}
            onTouchEnd={handleMouseUp}
          >
            {/* Branded side (background, full width) */}
            <div className={`absolute inset-0 bg-gradient-to-br ${active.brandedColor}`}>
              <div className="flex h-full flex-col items-center justify-center">
                <div className="h-32 w-24 rounded-xl bg-white/20 shadow-lg sm:h-48 sm:w-36" />
                <p className="mt-4 text-sm font-semibold text-white">
                  {active.brandedLabel}
                </p>
              </div>
            </div>

            {/* Generic side (clipped) */}
            <div
              className={`absolute inset-0 bg-gradient-to-br ${active.genericColor}`}
              style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            >
              <div className="flex h-full flex-col items-center justify-center">
                <div className="h-32 w-24 rounded-xl bg-white/60 shadow-md sm:h-48 sm:w-36" />
                <p className="mt-4 text-sm font-semibold text-gray-600">
                  {active.genericLabel}
                </p>
              </div>
            </div>

            {/* Slider handle */}
            <div
              className="absolute top-0 h-full w-0.5 bg-white shadow-lg"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[var(--bmn-color-primary)] shadow-lg">
                <span className="text-xs font-bold text-white">&harr;</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
