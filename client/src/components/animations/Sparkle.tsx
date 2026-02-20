import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SparkleInstance {
  id: number;
  x: number;
  y: number;
  size: number;
  rotation: number;
}

interface SparkleProps {
  /** Whether sparkles are active */
  active?: boolean;
  /** Number of sparkles */
  count?: number;
  /** Sparkle color */
  color?: string;
  /** CSS class for container */
  className?: string;
  /** Duration before auto-dismiss (ms). 0 = no auto-dismiss. */
  duration?: number;
}

/**
 * Small sparkle burst effect — great for confirming a brand name
 * or any moment of delight.
 */
function Sparkle({
  active = false,
  count = 8,
  color = 'var(--bmn-color-accent)',
  className = '',
  duration = 1500,
}: SparkleProps) {
  const [sparkles, setSparkles] = useState<SparkleInstance[]>([]);

  useEffect(() => {
    if (!active) {
      setSparkles([]);
      return;
    }

    const newSparkles: SparkleInstance[] = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      x: (Math.random() - 0.5) * 80,
      y: (Math.random() - 0.5) * 80,
      size: Math.random() * 8 + 4,
      rotation: Math.random() * 360,
    }));
    setSparkles(newSparkles);

    if (duration > 0) {
      const timer = setTimeout(() => setSparkles([]), duration);
      return () => clearTimeout(timer);
    }
  }, [active, count, duration]);

  return (
    <div
      className={`pointer-events-none absolute inset-0 flex items-center justify-center ${className}`}
      aria-hidden="true"
    >
      <AnimatePresence>
        {sparkles.map((s) => (
          <motion.svg
            key={s.id}
            width={s.size}
            height={s.size}
            viewBox="0 0 24 24"
            className="absolute"
            initial={{
              x: 0,
              y: 0,
              scale: 0,
              rotate: 0,
              opacity: 1,
            }}
            animate={{
              x: s.x,
              y: s.y,
              scale: [0, 1.2, 0.8],
              rotate: s.rotation,
              opacity: [0, 1, 0],
            }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{
              duration: 0.8,
              ease: 'easeOut',
            }}
          >
            <path
              d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
              fill={color}
            />
          </motion.svg>
        ))}
      </AnimatePresence>
    </div>
  );
}

export { Sparkle };
export type { SparkleProps };
