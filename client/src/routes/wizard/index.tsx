import { lazy, Suspense } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useWizardStore } from '@/stores/wizard-store';
import { useExitIntent } from '@/hooks/use-exit-intent';
import { WIZARD_STEPS, WIZARD_PHASES, ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { ArrowLeft, X, MessageSquare } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';

const ChatSidebar = lazy(() =>
  import('@/components/chat/ChatSidebar').then((m) => ({ default: m.ChatSidebar })),
);

/**
 * Wizard layout shell.
 * Three-phase structure: Discover -> Design -> Launch.
 * Dark mode by default for premium AI feel.
 */
export default function WizardLayout() {
  useExitIntent();
  const navigate = useNavigate();

  const currentStep = useWizardStore((s) => s.meta.currentStep);
  const brandId = useWizardStore((s) => s.meta.brandId);
  const sessionId = useWizardStore((s) => s.meta.sessionId);
  const location = useLocation();

  // Determine current step index from URL path
  const pathStep = location.pathname.split('/').pop() || 'onboarding';
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.path === pathStep);
  const progressPercent =
    currentIndex >= 0 ? ((currentIndex + 1) / WIZARD_STEPS.length) * 100 : 0;

  // Determine current phase
  const currentPhase = WIZARD_PHASES.find((phase) =>
    (phase.steps as readonly string[]).includes(pathStep),
  );
  const currentPhaseIndex = currentPhase
    ? WIZARD_PHASES.indexOf(currentPhase)
    : 0;

  // Navigate back to the previous wizard step
  const handleBack = () => {
    if (currentIndex > 0) {
      const prevStep = WIZARD_STEPS[currentIndex - 1];
      navigate(`/wizard/${prevStep.path}`);
    } else {
      navigate(ROUTES.DASHBOARD);
    }
  };

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
      <header className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 md:px-10">
        {/* Left: Back button + Logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="flex h-11 w-11 sm:h-8 sm:w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-border/50 hover:text-text"
            title={currentIndex > 0 ? 'Previous step' : 'Back to dashboard'}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <span className="text-sm font-bold tracking-tight text-text">brand</span>
            <span className="text-sm font-light tracking-tight text-text-muted">me</span>
            <span className="text-sm font-bold tracking-tight text-text">now</span>
          </div>
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
                    'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 sm:py-1 text-xs sm:text-[11px] font-medium transition-all duration-300',
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

          <span className="hidden text-xs sm:text-[11px] text-text-muted md:inline">
            {WIZARD_STEPS[currentIndex]?.label ?? currentStep}
          </span>
        </div>

        {/* Right: Chat toggle + Exit button */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => useUIStore.getState().setChatOpen(!useUIStore.getState().chatOpen)}
            className="flex h-11 w-11 sm:h-8 sm:w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-border/50 hover:text-text"
            title="Toggle Brand Assistant"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.DASHBOARD)}
            className="flex h-11 w-11 sm:h-8 sm:w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-border/50 hover:text-text"
            title="Save & exit to dashboard"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Step content */}
      <div className="mx-auto max-w-(--bmn-max-width-wizard) px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-12">
        <Outlet />
      </div>

      {/* Chat sidebar — fixed position, outside main content flow */}
      <Suspense fallback={null}>
        <ChatSidebar />
      </Suspense>
    </div>
  );
}
