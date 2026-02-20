import { motion } from 'motion/react';

interface InkSpreadProps {
  /** Whether the ink is actively spreading */
  active?: boolean;
  /** CSS class for the container */
  className?: string;
  /** Ink color */
  color?: string;
  /** Number of ink blobs */
  blobs?: number;
  /** Callback when the spread animation completes */
  onComplete?: () => void;
}

/**
 * Ink spreading animation — organic blobs that expand and merge.
 * Great for logo reveal moments.
 */
function InkSpread({
  active = false,
  className = '',
  color = 'var(--bmn-color-primary)',
  blobs = 5,
  onComplete,
}: InkSpreadProps) {
  const blobData = Array.from({ length: blobs }, (_, i) => ({
    id: i,
    cx: 50 + (Math.random() - 0.5) * 30,
    cy: 50 + (Math.random() - 0.5) * 30,
    delay: i * 0.15,
  }));

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <defs>
          <filter id="ink-blur">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
            />
          </filter>
        </defs>
        <g filter="url(#ink-blur)">
          {blobData.map((blob, i) => (
            <motion.circle
              key={blob.id}
              cx={blob.cx}
              cy={blob.cy}
              fill={color}
              initial={{ r: 0, opacity: 0 }}
              animate={
                active
                  ? {
                      r: [0, 15 + Math.random() * 10, 25 + Math.random() * 15],
                      opacity: [0, 0.6, 0.3],
                    }
                  : { r: 0, opacity: 0 }
              }
              transition={{
                duration: 1.8,
                delay: blob.delay,
                ease: [0.22, 1, 0.36, 1],
              }}
              onAnimationComplete={
                i === blobs - 1 ? onComplete : undefined
              }
            />
          ))}
        </g>
      </svg>
    </div>
  );
}

export { InkSpread };
export type { InkSpreadProps };
