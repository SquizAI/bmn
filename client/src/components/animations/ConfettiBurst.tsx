import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  size: number;
  shape: 'circle' | 'rect';
}

interface ConfettiBurstProps {
  /** Whether confetti is active */
  active?: boolean;
  /** Number of confetti pieces */
  count?: number;
  /** Duration before cleanup (ms) */
  duration?: number;
  /** CSS class for container */
  className?: string;
  /** Custom colors — defaults to brand palette */
  colors?: string[];
}

const DEFAULT_COLORS = [
  '#B8956A', // accent gold
  '#D4A574', // light gold
  '#4ade80', // success green
  '#60a5fa', // info blue
  '#fbbf24', // warning yellow
  '#f472b6', // pink
];

/**
 * Compact confetti burst animation.
 * Lighter than full-page confetti — use for inline celebrations
 * like confirming product selection or completing a phase.
 */
function ConfettiBurst({
  active = false,
  count = 24,
  duration = 2000,
  className = '',
  colors = DEFAULT_COLORS,
}: ConfettiBurstProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (!active) {
      setPieces([]);
      return;
    }

    const newPieces: ConfettiPiece[] = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      x: (Math.random() - 0.5) * 200,
      y: -(Math.random() * 150 + 50),
      rotation: Math.random() * 720 - 360,
      color: colors[i % colors.length],
      size: Math.random() * 6 + 3,
      shape: Math.random() > 0.5 ? 'circle' : 'rect',
    }));
    setPieces(newPieces);

    const timer = setTimeout(() => setPieces([]), duration);
    return () => clearTimeout(timer);
  }, [active, count, duration, colors]);

  return (
    <div
      className={`pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <AnimatePresence>
        {pieces.map((piece) => (
          <motion.div
            key={piece.id}
            className="absolute"
            style={{
              width: piece.size,
              height: piece.shape === 'rect' ? piece.size * 0.6 : piece.size,
              backgroundColor: piece.color,
              borderRadius: piece.shape === 'circle' ? '50%' : '1px',
            }}
            initial={{
              x: 0,
              y: 0,
              rotate: 0,
              scale: 0,
              opacity: 1,
            }}
            animate={{
              x: piece.x,
              y: [0, piece.y, piece.y + 80],
              rotate: piece.rotation,
              scale: [0, 1, 0.8],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: duration / 1000,
              ease: [0.22, 1, 0.36, 1],
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

export { ConfettiBurst };
export type { ConfettiBurstProps };
