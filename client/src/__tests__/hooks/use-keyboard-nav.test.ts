import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useKeyboardNav } from '@/hooks/use-keyboard-nav';

/**
 * Helper to simulate keyboard events on the window.
 */
function simulateKeyDown(key: string, options: Partial<KeyboardEvent> = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  window.dispatchEvent(event);
}

describe('useKeyboardNav', () => {
  it('should call onEscape when Escape is pressed', () => {
    const onEscape = vi.fn();
    renderHook(() => useKeyboardNav({ onEscape }));

    simulateKeyDown('Escape');
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('should call onNext when Alt+ArrowRight is pressed', () => {
    const onNext = vi.fn();
    renderHook(() => useKeyboardNav({ onNext }));

    simulateKeyDown('ArrowRight', { altKey: true });
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('should call onBack when Alt+ArrowLeft is pressed', () => {
    const onBack = vi.fn();
    renderHook(() => useKeyboardNav({ onBack }));

    simulateKeyDown('ArrowLeft', { altKey: true });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('should not call onNext without Alt key', () => {
    const onNext = vi.fn();
    renderHook(() => useKeyboardNav({ onNext }));

    simulateKeyDown('ArrowRight');
    expect(onNext).not.toHaveBeenCalled();
  });

  it('should not call onBack without Alt key', () => {
    const onBack = vi.fn();
    renderHook(() => useKeyboardNav({ onBack }));

    simulateKeyDown('ArrowLeft');
    expect(onBack).not.toHaveBeenCalled();
  });

  it('should not fire callbacks when disabled', () => {
    const onEscape = vi.fn();
    const onNext = vi.fn();
    const onBack = vi.fn();
    renderHook(() => useKeyboardNav({ onEscape, onNext, onBack, enabled: false }));

    simulateKeyDown('Escape');
    simulateKeyDown('ArrowRight', { altKey: true });
    simulateKeyDown('ArrowLeft', { altKey: true });

    expect(onEscape).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('should not fire when typing in an input element', () => {
    const onEscape = vi.fn();
    renderHook(() => useKeyboardNav({ onEscape }));

    // Simulate keydown with target being an INPUT element
    const inputElement = document.createElement('input');
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'target', { value: inputElement });
    window.dispatchEvent(event);

    expect(onEscape).not.toHaveBeenCalled();
  });

  it('should not fire when typing in a textarea element', () => {
    const onEscape = vi.fn();
    renderHook(() => useKeyboardNav({ onEscape }));

    const textareaElement = document.createElement('textarea');
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'target', { value: textareaElement });
    window.dispatchEvent(event);

    expect(onEscape).not.toHaveBeenCalled();
  });

  it('should clean up event listener on unmount', () => {
    const onEscape = vi.fn();
    const { unmount } = renderHook(() => useKeyboardNav({ onEscape }));

    unmount();

    simulateKeyDown('Escape');
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('should handle missing callbacks gracefully', () => {
    // No callbacks provided -- should not throw
    renderHook(() => useKeyboardNav({}));

    expect(() => {
      simulateKeyDown('Escape');
      simulateKeyDown('ArrowRight', { altKey: true });
      simulateKeyDown('ArrowLeft', { altKey: true });
    }).not.toThrow();
  });
});
