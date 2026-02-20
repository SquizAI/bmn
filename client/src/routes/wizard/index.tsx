import { Outlet, useLocation } from 'react-router';
import { Sparkles } from 'lucide-react';
import { useWizardStore } from '@/stores/wizard-store';
import { WIZARD_STEPS } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * Wizard layout shell.
 * Provides the progress bar, background, and navigation chrome.
 * The actual step content renders via <Outlet />.
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
    <div className="min-h-screen bg-wizard-bg">
      {/* Progress bar */}
      <div
        className="fixed left-0 top-0 z-[var(--bmn-z-sticky)] h-[var(--bmn-wizard-progress-height)] w-full bg-wizard-step-upcoming"
      >
        <div
          className="h-full bg-wizard-step-active transition-[width] duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Wizard header */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:px-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold text-text">Brand Me Now</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">
            Step {currentIndex + 1} of {WIZARD_STEPS.length}
          </span>
          <span className="text-xs font-medium text-text-secondary">
            {WIZARD_STEPS[currentIndex]?.label ?? currentStep}
          </span>
        </div>
      </header>

      {/* Step indicators */}
      <div className="flex justify-center gap-1.5 border-b border-border bg-surface px-4 py-2">
        {WIZARD_STEPS.map((step, i) => (
          <div
            key={step.key}
            className={cn(
              'h-2 w-2 rounded-full transition-colors',
              i < currentIndex
                ? 'bg-wizard-step-complete'
                : i === currentIndex
                  ? 'bg-wizard-step-active'
                  : 'bg-wizard-step-upcoming',
            )}
            title={step.label}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="mx-auto max-w-[var(--bmn-max-width-wizard)] px-4 py-8 md:px-6">
        <Outlet />
      </div>
    </div>
  );
}
