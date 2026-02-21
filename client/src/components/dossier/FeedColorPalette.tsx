import { motion } from 'motion/react';
import { Palette } from 'lucide-react';
import type { AestheticProfile } from '@/lib/dossier-types';

interface FeedColorPaletteProps {
  aesthetic: AestheticProfile;
}

export default function FeedColorPalette({ aesthetic }: FeedColorPaletteProps) {
  const palette = aesthetic.naturalPalette.length > 0
    ? aesthetic.naturalPalette
    : aesthetic.dominantColors.map((c) => c.hex);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[var(--bmn-tracking-wider)] text-[var(--bmn-color-text-muted)]">
        <Palette className="h-3.5 w-3.5" />
        Your Natural Palette
      </h4>

      {/* Color swatches */}
      <div className="flex gap-2">
        {palette.slice(0, 6).map((hex, i) => (
          <motion.div
            key={hex}
            initial={{ opacity: 0, scale: 0, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              delay: 0.1 + i * 0.1,
              duration: 0.5,
              type: 'spring',
              stiffness: 300,
              damping: 20,
            }}
            className="group flex flex-1 flex-col items-center gap-1.5"
          >
            <div
              className="aspect-square w-full rounded-xl shadow-[var(--bmn-shadow-sm)] ring-1 ring-black/5 transition-transform duration-200 group-hover:scale-110"
              style={{ backgroundColor: hex }}
            />
            <span className="text-xs font-mono text-[var(--bmn-color-text-muted)]">
              {hex}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Color details */}
      {aesthetic.dominantColors.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-4 space-y-2"
        >
          {aesthetic.dominantColors.slice(0, 4).map((color, i) => (
            <div key={`${color.hex}-${i}`} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: color.hex }}
              />
              <span className="flex-1 text-xs text-[var(--bmn-color-text-secondary)]">
                {color.name}
              </span>
              <span className="text-xs text-[var(--bmn-color-text-muted)]">
                {Math.round(color.percentage)}%
              </span>
            </div>
          ))}
        </motion.div>
      )}

      {/* Aesthetic summary */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-3 text-xs italic text-[var(--bmn-color-text-muted)]"
      >
        {aesthetic.overallAesthetic}
      </motion.p>
    </motion.div>
  );
}
