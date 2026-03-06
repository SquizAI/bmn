import { useStorefrontStore } from '@/stores/storefront-store';
import { useStorefrontThemes, useUpdateStorefront } from '@/hooks/use-storefront';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <Palette className="h-4 w-4" /> Theme
      </h3>
      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {(themes || []).map((theme: { id: string; name: string; slug: string; baseStyles: Record<string, unknown> }) => {
            const isActive = theme.id === storefront.themeId;
            const colors = (theme.baseStyles as { colorSuggestion?: { primary?: string; accent?: string } })?.colorSuggestion;
            return (
              <button
                key={theme.id}
                onClick={() => handleSelect(theme.id)}
                className={`
                  relative p-3 rounded-lg border-2 text-left transition-all
                  ${isActive ? 'border-primary ring-2 ring-primary/20' : 'border-muted hover:border-primary/30'}
                `}
              >
                {isActive && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
                <div className="flex gap-1.5 mb-2">
                  <div className="w-5 h-5 rounded" style={{ backgroundColor: colors?.primary || '#333' }} />
                  <div className="w-5 h-5 rounded" style={{ backgroundColor: colors?.accent || '#999' }} />
                </div>
                <p className="text-xs font-medium">{theme.name}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
