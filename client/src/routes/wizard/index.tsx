import { Outlet, useLocation } from 'react-router';
import { useWizardStore } from '@/stores/wizard-store';
import { WIZARD_STEPS } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * Wizard layout shell.
 * Minimal chrome — thin progress bar, subtle header, clean content area.
 */
export default function WizardLayout() {
  const currentStep = useWizardStore((s) => s.meta.currentStep);
  const location = useLocation();

  // Determine current step index from URL path
  const pathStep = location.pathname.split('/').pop() || 'onboarding';
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.path === pathStep);
  const progressPercent =
    currentIndex >= 0 ? ((currentIndex + 1) / WIZARD_STEPS.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Progress bar — ultra thin */}
      <div className="fixed left-0 top-0 z-(--bmn-z-sticky) h-0.5 w-full bg-border/50">
        <div
          className="h-full bg-[#111] transition-[width] duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Minimal header */}
      <header className="flex items-center justify-between px-6 py-4 md:px-10">
        <div>
          <span className="text-sm font-bold tracking-tight text-text">brand</span>
          <span className="text-sm font-light tracking-tight text-text-muted">me</span>
          <span className="text-sm font-bold tracking-tight text-text">now</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Step dots */}
          <div className="flex items-center gap-1">
            {WIZARD_STEPS.map((step, i) => (
              <div
                key={step.key}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i < currentIndex
                    ? 'w-1.5 bg-[#B8956A]'
                    : i === currentIndex
                      ? 'w-4 bg-[#111]'
                      : 'w-1.5 bg-border',
                )}
                title={step.label}
              />
            ))}
          </div>
          <span className="hidden text-[11px] text-text-muted sm:inline">
            {WIZARD_STEPS[currentIndex]?.label ?? currentStep}
          </span>
        </div>
      </header>

      {/* Step content */}
      <div className="mx-auto max-w-(--bmn-max-width-wizard) px-6 py-8 md:px-10 md:py-12">
        <Outlet />
      </div>
    </div>
  );
}
