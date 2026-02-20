import { motion } from 'motion/react';
import type { ReactNode } from 'react';

interface PulseGlowProps {
  /** Whether the glow pulse is active */
  active?: boolean;
  /** Glow color in rgba format */
  color?: string;
  /** Content to wrap */
  children: ReactNode;
  /** CSS class for the wrapper */
  className?: string;
}

/**
 * Wraps children with a pulsing glow ring effect.
 * Great for highlighting a selected logo or an important card.
 */
function PulseGlow({
  active = false,
  color = 'rgba(184, 149, 106, 0.4)',
  children,
  className = '',
}: PulseGlowProps) {
  return (
    <motion.div
      className={`relative inline-flex ${className}`}
      animate={
        active
          ? {
              boxShadow: [
                `0 0 0 0px ${color}`,
                `0 0 0 10px transparent`,
              ],
            }
          : { boxShadow: `0 0 0 0px transparent` }
      }
      transition={
        active
          ? {
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeOut',
            }
          : { duration: 0.3 }
      }
    >
      {children}
    </motion.div>
  );
}

export { PulseGlow };
export type { PulseGlowProps };
