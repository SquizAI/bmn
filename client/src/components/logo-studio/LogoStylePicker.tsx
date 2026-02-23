import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { Sparkles, Zap, Clock, Cpu, PartyPopper } from 'lucide-react';

const STYLE_ICONS: Record<string, React.ElementType> = {
  minimal: Sparkles,
  bold: Zap,
  vintage: Clock,
  modern: Cpu,
  playful: PartyPopper,
};

const STYLE_DESCRIPTIONS: Record<string, string> = {
  minimal: 'Clean lines, geometric precision',
  bold: 'High contrast, commanding presence',
  vintage: 'Heritage, badge & crest aesthetic',
  modern: 'Sleek, tech-forward design',
  playful: 'Rounded, energetic & fun',
};

interface LogoStylePickerProps {
  value: string;
  onChange: (style: string) => void;
  disabled?: boolean;
}

export function LogoStylePicker({ value, onChange, disabled }: LogoStylePickerProps) {
  const styles = Object.keys(STYLE_DESCRIPTIONS);

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
        Logo Style
      </label>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {styles.map((style) => {
          const Icon = STYLE_ICONS[style];
          const isActive = value === style;
          return (
            <motion.button
              key={style}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onChange(style)}
              disabled={disabled}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border-2 px-4 py-3 text-center transition-all min-w-[100px]',
                isActive
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/50 bg-surface/50 text-text-muted hover:border-border hover:text-text-secondary',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-semibold capitalize">{style}</span>
              <span className="text-[10px] leading-tight opacity-70">
                {STYLE_DESCRIPTIONS[style]}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
