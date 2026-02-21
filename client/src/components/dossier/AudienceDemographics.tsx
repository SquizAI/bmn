import { motion } from 'motion/react';
import { Users, MapPin, DollarSign, Heart } from 'lucide-react';
import type { AudienceEstimate } from '@/lib/dossier-types';

interface AudienceDemographicsProps {
  audience: AudienceEstimate;
}

export default function AudienceDemographics({ audience }: AudienceDemographicsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[var(--bmn-tracking-wider)] text-[var(--bmn-color-text-muted)]">
        <Users className="h-3.5 w-3.5" />
        Audience Insights
      </h4>

      <div className="space-y-4">
        {/* Age Range */}
        {audience.estimatedAgeRange && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <p className="text-xs text-[var(--bmn-color-text-muted)]">Age Range</p>
            <p className="text-sm font-semibold text-[var(--bmn-color-text)]">
              {audience.estimatedAgeRange}
            </p>
          </motion.div>
        )}

        {/* Gender Split */}
        {audience.genderSplit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <p className="mb-1 text-xs text-[var(--bmn-color-text-muted)]">Gender Split</p>
            <div className="flex h-3 overflow-hidden rounded-full">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${audience.genderSplit.female}%` }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="bg-pink-400"
                title={`Female: ${audience.genderSplit.female}%`}
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${audience.genderSplit.male}%` }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="bg-blue-400"
                title={`Male: ${audience.genderSplit.male}%`}
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${audience.genderSplit.other}%` }}
                transition={{ delay: 0.6, duration: 0.6 }}
                className="bg-purple-400"
                title={`Other: ${audience.genderSplit.other}%`}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-[var(--bmn-color-text-muted)]">
              <span>F {audience.genderSplit.female}%</span>
              <span>M {audience.genderSplit.male}%</span>
              {audience.genderSplit.other > 0 && <span>Other {audience.genderSplit.other}%</span>}
            </div>
          </motion.div>
        )}

        {/* Interests */}
        {audience.primaryInterests?.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <p className="mb-1.5 flex items-center gap-1 text-xs text-[var(--bmn-color-text-muted)]">
              <Heart className="h-3 w-3" />
              Top Interests
            </p>
            <div className="flex flex-wrap gap-1.5">
              {audience.primaryInterests.slice(0, 6).map((interest, i) => (
                <motion.span
                  key={interest}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.05 }}
                  className="rounded-full border border-[var(--bmn-color-border)] px-2 py-0.5 text-xs text-[var(--bmn-color-text-secondary)]"
                >
                  {interest}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Geography */}
        {audience.geographicIndicators?.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <p className="mb-1 flex items-center gap-1 text-xs text-[var(--bmn-color-text-muted)]">
              <MapPin className="h-3 w-3" />
              Geographic Signals
            </p>
            <p className="text-sm text-[var(--bmn-color-text)]">
              {audience.geographicIndicators.join(', ')}
            </p>
          </motion.div>
        )}

        {/* Income Level */}
        {audience.incomeLevel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-1.5"
          >
            <DollarSign className="h-3.5 w-3.5 text-[var(--bmn-color-text-muted)]" />
            <span className="text-xs text-[var(--bmn-color-text-muted)]">Income Level:</span>
            <span className="text-xs font-semibold capitalize text-[var(--bmn-color-text)]">
              {audience.incomeLevel}
            </span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
