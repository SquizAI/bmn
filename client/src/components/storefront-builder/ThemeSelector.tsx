import { useStorefrontStore } from '@/stores/storefront-store';
import { useStorefrontThemes, useUpdateStorefront } from '@/hooks/use-storefront';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { Check, Palette } from 'lucide-react';

export function ThemeSelector() {
  const { storefront } = useStorefrontStore();
  const { data: themes, isLoading } = useStorefrontThemes();
  const updateMutation = useUpdateStorefront();

  if (!storefront) return null;

  const handleSelect = (themeId: string) => {
    if (themeId === storefront.themeId) return;
    if (!confirm('Switching themes will update your store layout. Your content will be preserved. Continue?')) return;
    updateMutation.mutate({ id: storefront.id, themeId });
  };

  return (
    <div>
      <h3 className="font-semibold mb-3 flex items-center gap-2 text-text">
        <Palette className="h-4 w-4 text-accent" /> Theme
      </h3>
      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-surface-elevated animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {(themes || []).map((theme: { id: string; name: string; slug: string; baseStyles: Record<string, unknown> }) => {
            const isActive = theme.id === storefront.themeId;
            const colors = (theme.baseStyles as { colorSuggestion?: { primary?: string; accent?: string } })?.colorSuggestion;
            return (
              <motion.button
                key={theme.id}
                onClick={() => handleSelect(theme.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'relative p-0 rounded-xl border-2 text-left transition-all overflow-hidden',
                  isActive
                    ? 'border-accent ring-2 ring-accent/20 shadow-glow-accent'
                    : 'border-border/30 hover:border-accent/30 hover:shadow-sm',
                )}
              >
                {/* Gradient preview stripe */}
                <div
                  className="h-15 w-full"
                  style={{
                    background: `linear-gradient(135deg, ${colors?.primary || '#333'}, ${colors?.accent || '#999'})`,
                  }}
                />
                <div className="p-3">
                  {isActive && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent flex items-center justify-center shadow-sm">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div className="flex gap-1.5 mb-1.5">
                    <div className="w-6 h-6 rounded-lg ring-1 ring-black/10" style={{ backgroundColor: colors?.primary || '#333' }} />
                    <div className="w-6 h-6 rounded-lg ring-1 ring-black/10" style={{ backgroundColor: colors?.accent || '#999' }} />
                  </div>
                  <p className="text-xs font-medium text-text">{theme.name}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
