import { useEffect, useCallback } from 'react';

interface UseKeyboardNavOptions {
  onNext?: () => void;
  onBack?: () => void;
  onEscape?: () => void;
  enabled?: boolean;
}

export function useKeyboardNav({ onNext, onBack, onEscape, enabled = true }: UseKeyboardNavOptions) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Don't capture when typing in inputs
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key === 'Escape' && onEscape) {
      e.preventDefault();
      onEscape();
    }

    // Alt+Right for next step
    if (e.altKey && e.key === 'ArrowRight' && onNext) {
      e.preventDefault();
      onNext();
    }

    // Alt+Left for previous step
    if (e.altKey && e.key === 'ArrowLeft' && onBack) {
      e.preventDefault();
      onBack();
    }
  }, [enabled, onNext, onBack, onEscape]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
