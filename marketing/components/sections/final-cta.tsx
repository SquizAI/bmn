'use client';

import { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { ArrowRight, Shield, CreditCard, Lock } from 'lucide-react';
import { APP_URL } from '@/lib/utils';

export function FinalCta() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section
      ref={ref}
      className="relative overflow-hidden py-24"
      style={{
        background:
          'linear-gradient(135deg, var(--bmn-color-primary) 0%, #1a1a1a 100%)',
      }}
    >
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
          style={{ fontFamily: 'var(--bmn-font-secondary)' }}
        >
          Ready to build your brand?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.1 }}
          className="mt-4 text-lg text-white/70"
        >
          Join thousands of creators who have turned their following into a
          branded product line.
        </motion.p>
        <motion.a
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          href={`${APP_URL}/signup`}
          className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-[#111111] shadow-xl transition-all hover:bg-gray-100 hover:shadow-2xl"
        >
          Start Your Free Trial
          <ArrowRight
            size={16}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </motion.a>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.4 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-white/50"
        >
          <span className="flex items-center gap-1.5">
            <CreditCard size={14} />
            No credit card required
          </span>
          <span className="flex items-center gap-1.5">
            <Shield size={14} />
            Cancel anytime
          </span>
          <span className="flex items-center gap-1.5">
            <Lock size={14} />
            Your data is yours
          </span>
        </motion.div>
      </div>
    </section>
  );
}
