import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// ------ Types ------

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  size: number;
  delay: number;
  duration: number;
  shape: 'square' | 'circle' | 'triangle';
}

interface ConfettiProps {
  active?: boolean;
  duration?: number;
  particleCount?: number;
  colors?: string[];
  className?: string;
}

// ------ Constants ------

const DEFAULT_COLORS = [
  '#6366f1', // indigo
  '#f43f5e', // rose
  '#10b981', // emerald
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
];

const SHAPES: ConfettiPiece['shape'][] = ['square', 'circle', 'triangle'];

// ------ Generate Pieces ------

function generatePieces(count: number, colors: string[]): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -(Math.random() * 20 + 10),
    rotation: Math.random() * 360,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: Math.random() * 8 + 4,
    delay: Math.random() * 0.8,
    duration: Math.random() * 2 + 2,
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
  }));
}

// ------ Piece Shape ------

function PieceShape({ piece }: { piece: ConfettiPiece }) {
  if (piece.shape === 'circle') {
    return (
      <div
        className="rounded-full"
        style={{
          width: piece.size,
          height: piece.size,
          backgroundColor: piece.color,
        }}
      />
    );
  }

  if (piece.shape === 'triangle') {
    return (
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: `${piece.size / 2}px solid transparent`,
          borderRight: `${piece.size / 2}px solid transparent`,
          borderBottom: `${piece.size}px solid ${piece.color}`,
        }}
      />
    );
  }

  // square
  return (
    <div
      className="rounded-sm"
      style={{
        width: piece.size,
        height: piece.size * 0.6,
        backgroundColor: piece.color,
      }}
    />
  );
}

// ------ Confetti Component ------

function Confetti({
  active = true,
  duration = 4000,
  particleCount = 60,
  colors = DEFAULT_COLORS,
  className,
}: ConfettiProps) {
  const [visible, setVisible] = useState(active);
  const pieces = useMemo(
    () => (active ? generatePieces(particleCount, colors) : []),
    [active, particleCount, colors],
  );

  useEffect(() => {
    if (active) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), duration);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [active, duration]);

  return (
    <AnimatePresence>
      {visible && (
        <div className={`pointer-events-none fixed inset-0 z-50 overflow-hidden ${className || ''}`}>
          {pieces.map((piece) => (
            <motion.div
              key={piece.id}
              initial={{
                left: `${piece.x}%`,
                top: `${piece.y}%`,
                rotate: 0,
                opacity: 1,
              }}
              animate={{
                top: '110%',
                rotate: piece.rotation + Math.random() * 720,
                opacity: [1, 1, 0],
                x: [0, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 300],
              }}
              transition={{
                duration: piece.duration,
                delay: piece.delay,
                ease: 'easeOut',
              }}
              className="absolute"
            >
              <PieceShape piece={piece} />
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

export { Confetti };
export type { ConfettiProps };
