import { Outlet, useLocation } from 'react-router';
import { useWizardStore } from '@/stores/wizard-store';
import { WIZARD_STEPS, WIZARD_PHASES } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * Wizard layout shell.
 * Three-phase structure: Discover -> Design -> Launch.
 * Dark mode by default for premium AI feel.
 */
export default function WizardLayout() {
  const currentStep = useWizardStore((s) => s.meta.currentStep);
  const location = useLocation();

  // Determine current step index from URL path
  const pathStep = location.pathname.split('/').pop() || 'onboarding';
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.path === pathStep);
  const progressPercent =
    currentIndex >= 0 ? ((currentIndex + 1) / WIZARD_STEPS.length) * 100 : 0;

  // Determine current phase
  const currentPhase = WIZARD_PHASES.find((phase) =>
    phase.steps.includes(pathStep),
  );
  const currentPhaseIndex = currentPhase
    ? WIZARD_PHASES.indexOf(currentPhase)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Progress bar — ultra thin */}
      <div className="fixed left-0 top-0 z-(--bmn-z-sticky) h-0.5 w-full bg-border/50">
        <div
          className="h-full bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Minimal header with phase indicators */}
      <header className="flex items-center justify-between px-6 py-4 md:px-10">
        <div>
          <span className="text-sm font-bold tracking-tight text-text">brand</span>
          <span className="text-sm font-light tracking-tight text-text-muted">me</span>
          <span className="text-sm font-bold tracking-tight text-text">now</span>
        </div>

        {/* Phase indicators */}
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-1 sm:flex">
            {WIZARD_PHASES.map((phase, i) => (
              <div key={phase.id} className="flex items-center gap-1">
                {i > 0 && (
                  <div
                    className={cn(
                      'mx-1 h-px w-4 transition-colors duration-300',
                      i <= currentPhaseIndex ? 'bg-accent' : 'bg-border',
                    )}
                  />
                )}
                <div
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-300',
                    i < currentPhaseIndex
                      ? 'bg-accent/15 text-accent'
                      : i === currentPhaseIndex
                        ? 'bg-primary text-primary-foreground'
                        : 'text-text-muted',
                  )}
                >
                  <span>{phase.label}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Step dots within current phase */}
          <div className="flex items-center gap-1">
            {WIZARD_STEPS.map((step, i) => (
              <div
                key={step.key}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i < currentIndex
                    ? 'w-1.5 bg-accent'
                    : i === currentIndex
                      ? 'w-4 bg-primary'
                      : 'w-1.5 bg-border',
                )}
                title={step.label}
              />
            ))}
          </div>

          <span className="hidden text-[11px] text-text-muted md:inline">
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
