import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lightbulb } from 'lucide-react';
import { BRAND_TIPS } from '@/lib/constants';

interface LoadingTipProps {
  intervalMs?: number;
}

export function LoadingTip({ intervalMs = 5000 }: LoadingTipProps) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * BRAND_TIPS.length));

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % BRAND_TIPS.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return (
    <div className="mx-auto max-w-md">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex items-start gap-3 rounded-xl bg-surface-hover/50 px-4 py-3"
        >
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-sm text-text-secondary">{BRAND_TIPS[index]}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
