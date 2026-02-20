import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface StreamLine {
  id: number;
  text: string;
  x: number;
}

interface DataStreamProps {
  /** Whether data is actively streaming */
  active?: boolean;
  /** Lines to display — cycles through them. Falls back to generated data. */
  lines?: string[];
  /** Max visible lines at once */
  maxVisible?: number;
  /** Speed in ms between new lines */
  speed?: number;
  /** CSS class for container */
  className?: string;
}

const DEFAULT_LINES = [
  'Analyzing engagement patterns...',
  'Extracting color palette from feed...',
  'Mapping audience demographics...',
  'Identifying content themes...',
  'Calculating brand readiness score...',
  'Processing visual aesthetics...',
  'Detecting niche positioning...',
  'Evaluating growth trajectory...',
  'Scanning competitor landscape...',
  'Building creator profile...',
];

/**
 * Streaming text/data animation for dossier loading and analysis states.
 * Shows lines of text scrolling upward like a terminal feed.
 */
function DataStream({
  active = false,
  lines = DEFAULT_LINES,
  maxVisible = 6,
  speed = 800,
  className = '',
}: DataStreamProps) {
  const [visibleLines, setVisibleLines] = useState<StreamLine[]>([]);
  const counterRef = useRef(0);
  const lineIndexRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setVisibleLines([]);
      counterRef.current = 0;
      lineIndexRef.current = 0;
      return;
    }

    const interval = setInterval(() => {
      const text = lines[lineIndexRef.current % lines.length];
      const newLine: StreamLine = {
        id: counterRef.current++,
        text,
        x: Math.random() * 10,
      };
      lineIndexRef.current++;

      setVisibleLines((prev) => {
        const updated = [...prev, newLine];
        return updated.length > maxVisible
          ? updated.slice(-maxVisible)
          : updated;
      });
    }, speed);

    return () => clearInterval(interval);
  }, [active, lines, maxVisible, speed]);

  return (
    <div
      className={`relative overflow-hidden font-mono text-xs ${className}`}
      aria-hidden="true"
    >
      <AnimatePresence mode="popLayout">
        {visibleLines.map((line) => (
          <motion.div
            key={line.id}
            initial={{ opacity: 0, y: 12, filter: 'blur(2px)' }}
            animate={{ opacity: 0.6, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -12, filter: 'blur(2px)' }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="whitespace-nowrap py-0.5 text-text-muted"
          >
            <span className="mr-2 text-accent">{'>'}</span>
            {line.text}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Gradient fade at top and bottom */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-background to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

export { DataStream };
export type { DataStreamProps };
