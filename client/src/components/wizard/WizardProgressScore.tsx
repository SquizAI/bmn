import { motion } from 'motion/react';
import { Trophy } from 'lucide-react';
import { useWizardStore } from '@/stores/wizard-store';

export function WizardProgressScore() {
  const dossier = useWizardStore((s) => s.dossier);
  const brand = useWizardStore((s) => s.brand);
  const design = useWizardStore((s) => s.design);
  const products = useWizardStore((s) => s.products);

  // Calculate completion score based on filled data
  let score = 0;
  if (dossier.profile?.displayName) score += 15;
  if (dossier.rawDossier) score += 10;
  if (brand.name) score += 15;
  if (brand.vision) score += 10;
  if (brand.archetype) score += 10;
  if (brand.values.length > 0) score += 5;
  if (design.colorPalette.length > 0) score += 10;
  if (design.fonts?.primary) score += 5;
  if (products.selectedSkus.length > 0) score += 15;
  if (products.selectedSkus.length >= 3) score += 5;

  const level =
    score >= 80
      ? 'Brand Master'
      : score >= 50
        ? 'Brand Builder'
        : score >= 20
          ? 'Brand Explorer'
          : 'Getting Started';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10">
        <Trophy className="h-4 w-4 text-warning" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-text">{level}</span>
          <span className="text-xs text-text-muted">{score}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover">
          <motion.div
            className="h-full rounded-full bg-warning"
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>
    </motion.div>
  );
}
