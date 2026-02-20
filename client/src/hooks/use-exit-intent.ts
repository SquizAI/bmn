import { useEffect, useCallback } from 'react';
import { useWizardStore } from '@/stores/wizard-store';

export function useExitIntent() {
  const brandName = useWizardStore((s) => s.brand.name);
  const step = useWizardStore((s) => s.meta.currentStep);

  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    // Only warn if they have meaningful progress
    if (!brandName && !step) return;

    e.preventDefault();
    // Modern browsers ignore custom messages but still show a generic prompt
    e.returnValue = '';
  }, [brandName, step]);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [handleBeforeUnload]);
}
