'use client';

import { useRef, useEffect, useState } from 'react';
import { useInView } from 'motion/react';

interface CounterProps {
  end: number;
  suffix?: string;
  prefix?: string;
  label: string;
  duration?: number;
}

function AnimatedCounter({ end, suffix = '', prefix = '', label, duration = 2000 }: CounterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;

    let startTime: number | null = null;
    let rafId: number;

    function animate(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * end));

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    }

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [inView, end, duration]);

  const formatted = value.toLocaleString();

  return (
    <div ref={ref} className="text-center">
      <p
        className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
        style={{ fontFamily: 'var(--bmn-font-secondary)' }}
      >
        {prefix}
        {formatted}
        {suffix}
      </p>
      <p className="mt-2 text-sm text-[var(--bmn-color-text-secondary)]">
        {label}
      </p>
    </div>
  );
}

const counters: CounterProps[] = [
  { end: 7, label: 'AI Models Powering Your Brand' },
  { end: 150, suffix: '+', label: 'Products in Catalog' },
  { end: 30, label: 'Seconds to Analyze Your Content' },
  { end: 3, label: 'Unique Brand Directions Per Session' },
];

export function SocialProofCounters() {
  return (
    <section className="border-t border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {counters.map((counter) => (
            <AnimatedCounter key={counter.label} {...counter} />
          ))}
        </div>
      </div>
    </section>
  );
}
