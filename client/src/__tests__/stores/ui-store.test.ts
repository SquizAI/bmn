import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useUIStore } from '@/stores/ui-store';

describe('useUIStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset store to initial state
    useUIStore.setState({
      theme: 'system',
      sidebarOpen: true,
      chatOpen: false,
      toasts: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -- Initial State --

  it('should have correct initial state', () => {
    const state = useUIStore.getState();
    expect(state.theme).toBe('system');
    expect(state.sidebarOpen).toBe(true);
    expect(state.chatOpen).toBe(false);
    expect(state.toasts).toEqual([]);
  });

  // -- Theme --

  it('should set theme to dark via setTheme()', () => {
    useUIStore.getState().setTheme('dark');
    expect(useUIStore.getState().theme).toBe('dark');
  });

  it('should set theme to light via setTheme()', () => {
    useUIStore.getState().setTheme('light');
    expect(useUIStore.getState().theme).toBe('light');
  });

  it('should set theme to system via setTheme()', () => {
    useUIStore.getState().setTheme('dark');
    useUIStore.getState().setTheme('system');
    expect(useUIStore.getState().theme).toBe('system');
  });

  // -- Sidebar --

  it('should set sidebar open state via setSidebarOpen()', () => {
    useUIStore.getState().setSidebarOpen(false);
    expect(useUIStore.getState().sidebarOpen).toBe(false);

    useUIStore.getState().setSidebarOpen(true);
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });

  it('should toggle sidebar via toggleSidebar()', () => {
    expect(useUIStore.getState().sidebarOpen).toBe(true);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(false);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });

  // -- Chat --

  it('should set chat open state via setChatOpen()', () => {
    useUIStore.getState().setChatOpen(true);
    expect(useUIStore.getState().chatOpen).toBe(true);

    useUIStore.getState().setChatOpen(false);
    expect(useUIStore.getState().chatOpen).toBe(false);
  });

  // -- Toasts --

  it('should add a toast with auto-generated ID via addToast()', () => {
    useUIStore.getState().addToast({
      type: 'success',
      title: 'Brand created',
      description: 'Your brand has been saved.',
    });
    const toasts = useUIStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].title).toBe('Brand created');
    expect(toasts[0].description).toBe('Your brand has been saved.');
    expect(toasts[0].id).toBeDefined();
    expect(typeof toasts[0].id).toBe('string');
  });

  it('should add multiple toasts', () => {
    useUIStore.getState().addToast({ type: 'info', title: 'Toast 1' });
    useUIStore.getState().addToast({ type: 'warning', title: 'Toast 2' });
    useUIStore.getState().addToast({ type: 'error', title: 'Toast 3' });
    expect(useUIStore.getState().toasts).toHaveLength(3);
  });

  it('should remove a toast by ID via removeToast()', () => {
    useUIStore.getState().addToast({ type: 'success', title: 'Keep me' });
    useUIStore.getState().addToast({ type: 'error', title: 'Remove me' });
    const toasts = useUIStore.getState().toasts;
    const removeId = toasts[1].id;

    useUIStore.getState().removeToast(removeId);
    const remaining = useUIStore.getState().toasts;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].title).toBe('Keep me');
  });

  it('should auto-remove toast after default duration (5000ms)', () => {
    useUIStore.getState().addToast({ type: 'info', title: 'Auto-dismiss' });
    expect(useUIStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(5000);
    expect(useUIStore.getState().toasts).toHaveLength(0);
  });

  it('should auto-remove toast after custom duration', () => {
    useUIStore.getState().addToast({
      type: 'warning',
      title: 'Quick toast',
      duration: 2000,
    });
    expect(useUIStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1999);
    expect(useUIStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(useUIStore.getState().toasts).toHaveLength(0);
  });

  it('should handle removing a non-existent toast gracefully', () => {
    useUIStore.getState().addToast({ type: 'info', title: 'Test' });
    useUIStore.getState().removeToast('non-existent-id');
    expect(useUIStore.getState().toasts).toHaveLength(1);
  });
});
