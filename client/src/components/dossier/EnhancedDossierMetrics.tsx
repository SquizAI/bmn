import { motion } from 'motion/react';
import { Clock, Hash, Layers, TrendingUp } from 'lucide-react';
import type { ContentAnalysis, AudienceEstimate } from '@/lib/dossier-types';
import { normalizeFormats, getPostingFrequencyLabel, isPostingFrequencyObject } from '@/lib/dossier-types';

interface EnhancedDossierMetricsProps {
  content: ContentAnalysis | null | undefined;
  audience: AudienceEstimate | null | undefined;
}

/**
 * Enhanced dossier metrics display showing:
 * - Posting frequency & consistency
 * - Hashtag strategy (top hashtags with counts)
 * - Content format breakdown (Reels %, Carousel %, Static %)
 * - Audience demographics summary (age range, gender split)
 *
 * Renders tasteful "coming soon" placeholders when data is not yet available.
 */
export default function EnhancedDossierMetrics({
  content,
  audience,
}: EnhancedDossierMetricsProps) {
  const formats = content ? normalizeFormats(content.formats) : [];
  const frequencyLabel = content ? getPostingFrequencyLabel(content.postingFrequency) : null;
  const pf = content?.postingFrequency;
  const bestDays = isPostingFrequencyObject(pf) ? pf.bestDays : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="grid gap-4 sm:grid-cols-2"
    >
      {/* Posting Frequency */}
      <div className="rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-5">
        <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[var(--bmn-tracking-wider)] text-[var(--bmn-color-text-muted)]">
          <Clock className="h-3.5 w-3.5" />
          Posting Frequency
        </h4>

        {frequencyLabel ? (
          <div className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[var(--bmn-color-text)]">
                {frequencyLabel}
              </span>
            </div>
            {content?.consistencyScore !== null && content?.consistencyScore !== undefined && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--bmn-color-text-muted)]">Consistency</span>
                  <span className="font-medium text-[var(--bmn-color-text)]">
                    {Math.round(content.consistencyScore)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--bmn-color-surface-hover)]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${content.consistencyScore}%` }}
                    transition={{ delay: 0.4, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full bg-[var(--bmn-color-accent)]"
                  />
                </div>
              </div>
            )}
            {bestDays && bestDays.length > 0 && (
              <p className="text-xs text-[var(--bmn-color-text-muted)]">
                Best days:{' '}
                <span className="font-medium text-[var(--bmn-color-text)]">
                  {bestDays.join(', ')}
                </span>
              </p>
            )}
            {content?.bestPerformingContentType && (
              <p className="text-xs text-[var(--bmn-color-text-muted)]">
                Best performing:{' '}
                <span className="font-medium capitalize text-[var(--bmn-color-text)]">
                  {content.bestPerformingContentType}
                </span>
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <TrendingUp className="h-8 w-8 text-[var(--bmn-color-border)]" />
            <p className="text-xs text-[var(--bmn-color-text-muted)]">
              Posting frequency analysis coming soon
            </p>
          </div>
        )}
      </div>

      {/* Hashtag Strategy */}
      <div className="rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-5">
        <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[var(--bmn-tracking-wider)] text-[var(--bmn-color-text-muted)]">
          <Hash className="h-3.5 w-3.5" />
          Hashtag Strategy
        </h4>

        {content?.hashtagStrategy && content.hashtagStrategy.topHashtags.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {content.hashtagStrategy.topHashtags.slice(0, 8).map((ht, i) => (
                <motion.div
                  key={ht.tag}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className="flex items-center gap-1 rounded-full border border-[var(--bmn-color-border)] px-2 py-0.5"
                >
                  <span className="text-xs font-medium text-[var(--bmn-color-primary)]">
                    #{ht.tag.replace(/^#/, '')}
                  </span>
                  <span className="text-[10px] text-[var(--bmn-color-text-muted)]">
                    {ht.count}
                  </span>
                </motion.div>
              ))}
            </div>
            {content.hashtagStrategy.avgHashtagsPerPost != null && (
              <p className="text-xs text-[var(--bmn-color-text-muted)]">
                Avg{' '}
                <span className="font-medium text-[var(--bmn-color-text)]">
                  {Math.round(content.hashtagStrategy.avgHashtagsPerPost)}
                </span>{' '}
                hashtags per post
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Hash className="h-8 w-8 text-[var(--bmn-color-border)]" />
            <p className="text-xs text-[var(--bmn-color-text-muted)]">
              Hashtag analysis coming soon
            </p>
          </div>
        )}
      </div>

      {/* Content Format Breakdown */}
      <div className="rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-5">
        <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[var(--bmn-tracking-wider)] text-[var(--bmn-color-text-muted)]">
          <Layers className="h-3.5 w-3.5" />
          Content Format Breakdown
        </h4>

        {formats.length > 0 ? (
          <div className="space-y-2.5">
            {formats.slice(0, 5).map((fmt, i) => (
              <motion.div
                key={fmt.format}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium capitalize text-[var(--bmn-color-text)]">
                    {fmt.format}
                  </span>
                  <span className="text-[var(--bmn-color-text-muted)]">
                    {Math.round(fmt.percentage)}%
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--bmn-color-surface-hover)]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${fmt.percentage}%` }}
                    transition={{ delay: 0.4 + i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full bg-gradient-to-r from-[var(--bmn-color-primary)] to-[var(--bmn-color-accent)]"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Layers className="h-8 w-8 text-[var(--bmn-color-border)]" />
            <p className="text-xs text-[var(--bmn-color-text-muted)]">
              Format breakdown coming soon
            </p>
          </div>
        )}
      </div>

      {/* Audience Demographics Summary */}
      <div className="rounded-2xl border border-[var(--bmn-color-border)] bg-[var(--bmn-color-surface)] p-5">
        <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[var(--bmn-tracking-wider)] text-[var(--bmn-color-text-muted)]">
          <TrendingUp className="h-3.5 w-3.5" />
          Audience Snapshot
        </h4>

        {audience ? (
          <div className="space-y-3">
            {/* Age Range */}
            {audience.estimatedAgeRange && (
              <div>
                <p className="text-xs text-[var(--bmn-color-text-muted)]">Primary Age Range</p>
                <p className="text-lg font-bold text-[var(--bmn-color-text)]">
                  {audience.estimatedAgeRange}
                </p>
              </div>
            )}

            {/* Gender Split mini bar */}
            {audience.genderSplit && (
              <div>
                <p className="mb-1 text-xs text-[var(--bmn-color-text-muted)]">Gender Split</p>
                <div className="flex h-3 overflow-hidden rounded-full">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${audience.genderSplit.female}%` }}
                    transition={{ delay: 0.5, duration: 0.6 }}
                    className="bg-pink-400"
                    title={`Female: ${audience.genderSplit.female}%`}
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${audience.genderSplit.male}%` }}
                    transition={{ delay: 0.6, duration: 0.6 }}
                    className="bg-blue-400"
                    title={`Male: ${audience.genderSplit.male}%`}
                  />
                  {audience.genderSplit.other > 0 && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${audience.genderSplit.other}%` }}
                      transition={{ delay: 0.7, duration: 0.6 }}
                      className="bg-purple-400"
                      title={`Other: ${audience.genderSplit.other}%`}
                    />
                  )}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-[var(--bmn-color-text-muted)]">
                  <span>F {audience.genderSplit.female}%</span>
                  <span>M {audience.genderSplit.male}%</span>
                  {audience.genderSplit.other > 0 && <span>Other {audience.genderSplit.other}%</span>}
                </div>
              </div>
            )}

            {/* Income Level */}
            {audience.incomeLevel && (
              <p className="text-xs text-[var(--bmn-color-text-muted)]">
                Income Level:{' '}
                <span className="font-semibold capitalize text-[var(--bmn-color-text)]">
                  {audience.incomeLevel}
                </span>
              </p>
            )}

            {/* Fallback if no sub-data */}
            {!audience.estimatedAgeRange && !audience.genderSplit && (
              <p className="text-xs text-[var(--bmn-color-text-muted)]">
                Demographic estimates pending deeper analysis
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <TrendingUp className="h-8 w-8 text-[var(--bmn-color-border)]" />
            <p className="text-xs text-[var(--bmn-color-text-muted)]">
              Audience demographics estimate pending
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
