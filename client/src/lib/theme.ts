/**
 * Theme management utility.
 * Persists user preference to localStorage and applies data-theme attribute on <html>.
 * Dark mode is the default for the wizard (premium AI feel).
 */

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'bmn-theme';

/**
 * Resolve which theme to actually apply based on the stored preference.
 * 'system' defers to OS preference via prefers-color-scheme.
 */
function resolveTheme(preference: Theme): 'light' | 'dark' {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return preference;
}

/**
 * Apply the resolved theme to the document.
 */
function applyTheme(resolved: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', resolved);
}

/**
 * Get the stored theme preference, defaulting to 'dark'.
 */
export function getStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'dark';
}

/**
 * Get the currently resolved (applied) theme.
 */
export function getResolvedTheme(): 'light' | 'dark' {
  return resolveTheme(getStoredTheme());
}

/**
 * Set the theme preference, persist it, and apply it immediately.
 */
export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(resolveTheme(theme));
}

/**
 * Toggle between light and dark. If currently 'system', resolve it first then toggle.
 */
export function toggleTheme(): void {
  const current = getResolvedTheme();
  setTheme(current === 'dark' ? 'light' : 'dark');
}

/**
 * Initialize theme on app load. Should be called once in the root layout.
 * Returns a cleanup function for the system preference media query listener.
 */
export function initTheme(): () => void {
  const preference = getStoredTheme();
  applyTheme(resolveTheme(preference));

  // Listen for OS theme changes when preference is 'system'
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    if (getStoredTheme() === 'system') {
      applyTheme(resolveTheme('system'));
    }
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}
