import { useCallback } from 'react';
import { motion } from 'motion/react';

// ── Types ────────────────────────────────────────────────────────

export interface ToneValues {
  casualToFormal: number;
  playfulToSerious: number;
  boldToSubtle: number;
  traditionalToModern: number;
}

interface BrandToneSlidersProps {
  values: ToneValues;
  onChange: (values: ToneValues) => void;
}

// ── Slider Component ─────────────────────────────────────────────

function ToneSlider({
  label,
  leftLabel,
  rightLabel,
  value,
  onChange,
}: {
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted">{label}</span>
        <span className="text-xs text-text-muted">{value}%</span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full cursor-pointer appearance-none bg-transparent
            [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-border
            [&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110
            [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-border
            [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-surface [&::-moz-range-thumb]:shadow-sm"
        />
        {/* Track fill */}
        <div
          className="pointer-events-none absolute left-0 top-[calc(50%-4px)] h-2 rounded-full bg-primary/30"
          style={{ width: `${value}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-text-muted">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────

export function BrandToneSliders({ values, onChange }: BrandToneSlidersProps) {
  const handleChange = useCallback(
    (key: keyof ToneValues) => (value: number) => {
      onChange({ ...values, [key]: value });
    },
    [values, onChange],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-surface p-6"
    >
      <h3 className="mb-1 text-base font-bold text-text">Fine-Tune Your Tone</h3>
      <p className="mb-5 text-xs text-text-muted">
        Adjust these sliders to refine your brand personality. Changes will update voice samples and color suggestions.
      </p>

      <div className="space-y-6">
        <ToneSlider
          label="Formality"
          leftLabel="Casual"
          rightLabel="Formal"
          value={values.casualToFormal}
          onChange={handleChange('casualToFormal')}
        />

        <ToneSlider
          label="Energy"
          leftLabel="Playful"
          rightLabel="Serious"
          value={values.playfulToSerious}
          onChange={handleChange('playfulToSerious')}
        />

        <ToneSlider
          label="Intensity"
          leftLabel="Bold"
          rightLabel="Subtle"
          value={values.boldToSubtle}
          onChange={handleChange('boldToSubtle')}
        />

        <ToneSlider
          label="Aesthetic"
          leftLabel="Traditional"
          rightLabel="Modern"
          value={values.traditionalToModern}
          onChange={handleChange('traditionalToModern')}
        />
      </div>
    </motion.div>
  );
}
