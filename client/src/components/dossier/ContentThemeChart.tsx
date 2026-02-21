import { motion } from 'motion/react';
import { BarChart3 } from 'lucide-react';
import type { ContentAnalysis } from '@/lib/dossier-types';
import { normalizeFormats, getPostingFrequencyLabel } from '@/lib/dossier-types';

interface ContentThemeChartProps {
  content: ContentAnalysis;
}

export default function ContentThemeChart({ content }: ContentThemeChartProps) {
  const themes = content.themes.slice(0, 5);
  const maxFreq = Math.max(...themes.map((t) => t.frequency), 0.01);
  const formats = normalizeFormats(content.formats);
  const frequencyLabel = getPostingFrequencyLabel(content.postingFrequency);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[var(--bmn-tracking-wider)] text-[var(--bmn-color-text-muted)]">
        <BarChart3 className="h-3.5 w-3.5" />
        Content Themes
      </h4>

      {/* Theme bars */}
      <div className="space-y-2.5">
        {themes.map((theme, i) => (
          <motion.div
            key={theme.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium capitalize text-[var(--bmn-color-text)]">
                {theme.name}
              </span>
              <span className="text-[var(--bmn-color-text-muted)]">
                {Math.round(theme.frequency * 100)}%
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--bmn-color-surface-hover)]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(theme.frequency / maxFreq) * 100}%` }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full bg-[var(--bmn-color-primary)]"
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Content Format Breakdown */}
      {formats.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-4"
        >
          <p className="mb-1.5 text-xs text-[var(--bmn-color-text-muted)]">Content Formats</p>
          <div className="flex gap-2">
            {formats.slice(0, 4).map((fmt) => (
              <div
                key={fmt.format}
                className="flex-1 rounded-lg border border-[var(--bmn-color-border)] p-2 text-center"
              >
                <p className="text-sm font-semibold text-[var(--bmn-color-text)]">
                  {Math.round(fmt.percentage)}%
                </p>
                <p className="text-[10px] capitalize text-[var(--bmn-color-text-muted)]">
                  {fmt.format}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Posting Frequency */}
      {frequencyLabel && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-3 text-xs text-[var(--bmn-color-text-muted)]"
        >
          Posting: <span className="font-medium text-[var(--bmn-color-text)]">{frequencyLabel}</span>
        </motion.div>
      )}
    </motion.div>
  );
}
