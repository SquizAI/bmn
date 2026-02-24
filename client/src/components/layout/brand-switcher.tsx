import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check, Plus, ArrowRight } from 'lucide-react';
import { useBrands, type Brand } from '@/hooks/use-brands';
import { useActiveBrand } from '@/hooks/use-active-brand';
import { useBrandStore, type ActiveBrand } from '@/stores/brand-store';
import { ROUTES } from '@/lib/constants';
import { cn, truncate, capitalize } from '@/lib/utils';

// ------ Status Badge (compact) ------

function StatusDot({ status }: { status: Brand['status'] }) {
  const colors: Record<Brand['status'], string> = {
    draft: 'bg-amber-400',
    active: 'bg-emerald-400',
    archived: 'bg-gray-400',
  };

  return (
    <span
      className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', colors[status])}
      title={capitalize(status)}
    />
  );
}

// ------ Color Dot / Brand Initial ------

function BrandIndicator({ brand }: { brand: ActiveBrand }) {
  if (brand.primaryColor) {
    return (
      <span
        className="inline-block h-3 w-3 shrink-0 rounded-full border border-white/10"
        style={{ backgroundColor: brand.primaryColor }}
      />
    );
  }

  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-semibold text-primary-foreground">
      {brand.name.charAt(0).toUpperCase()}
    </span>
  );
}

// ------ Main Component ------

function BrandSwitcher() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const activeBrand = useActiveBrand();
  const setActiveBrand = useBrandStore((s) => s.setActiveBrand);
  const { data, isLoading } = useBrands();
  const brands = data?.items ?? [];

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const handleSwitch = useCallback(
    (brand: Brand) => {
      const next: ActiveBrand = {
        id: brand.id,
        name: brand.name,
        status: brand.status,
        thumbnailUrl: brand.thumbnailUrl ?? null,
        primaryColor: brand.primaryColor ?? null,
      };

      setActiveBrand(next);
      setOpen(false);

      // Invalidate brand-scoped queries so dashboards refetch for the new brand
      queryClient.invalidateQueries({ queryKey: ['brand'] });
      queryClient.invalidateQueries({ queryKey: ['brand-assets'] });
      queryClient.invalidateQueries({ queryKey: ['dossier'] });
      queryClient.invalidateQueries({ queryKey: ['name-options'] });
      queryClient.invalidateQueries({ queryKey: ['product-recommendations'] });
    },
    [setActiveBrand, queryClient],
  );

  // No brands at all -- show a simple create link
  if (!isLoading && brands.length === 0) {
    return (
      <Link
        to={ROUTES.WIZARD}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Create Brand</span>
      </Link>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
          'text-text hover:bg-surface-hover active:bg-border',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          open && 'bg-surface-hover',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {activeBrand ? (
          <>
            <BrandIndicator brand={activeBrand} />
            <span className="max-w-[120px] truncate sm:max-w-[160px]">
              {truncate(activeBrand.name, 20)}
            </span>
          </>
        ) : (
          <span className="text-text-muted">Select brand</span>
        )}
        <ChevronDown
          className={cn(
            'h-3 w-3 shrink-0 text-text-muted transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <>
            {/* Invisible backdrop for mobile */}
            <div className="fixed inset-0 z-10 md:hidden" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
              role="listbox"
              aria-label="Switch brand"
            >
              {/* View All Brands link */}
              <div className="border-b border-border px-1 py-1">
                <Link
                  to={ROUTES.DASHBOARD_BRANDS}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  View All Brands
                </Link>
              </div>

              {/* Brand list */}
              <div className="max-h-64 overflow-y-auto py-1">
                {isLoading ? (
                  <div className="space-y-2 px-3 py-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="h-5 w-5 animate-pulse rounded-md bg-surface-hover" />
                        <div className="h-3 w-24 animate-pulse rounded bg-surface-hover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  brands.map((brand) => {
                    const isSelected = activeBrand?.id === brand.id;

                    return (
                      <button
                        key={brand.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSwitch(brand)}
                        className={cn(
                          'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors',
                          'hover:bg-surface-hover',
                          isSelected && 'bg-surface-hover',
                        )}
                      >
                        {/* Color dot or initial */}
                        {brand.primaryColor ? (
                          <span
                            className="inline-block h-3 w-3 shrink-0 rounded-full border border-white/10"
                            style={{ backgroundColor: brand.primaryColor }}
                          />
                        ) : (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-semibold text-primary-foreground">
                            {brand.name.charAt(0).toUpperCase()}
                          </span>
                        )}

                        {/* Name + status */}
                        <span className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="truncate font-medium text-text">
                            {brand.name}
                          </span>
                          <StatusDot status={brand.status} />
                        </span>

                        {/* Checkmark for selected */}
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Create New Brand */}
              <div className="border-t border-border px-1 py-1">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    navigate(ROUTES.WIZARD);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create New Brand
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export { BrandSwitcher };
