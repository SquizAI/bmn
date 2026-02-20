/**
 * Service Worker registration helper.
 * Only registers in production builds to avoid caching issues during development.
 */
export function registerServiceWorker(): void {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });
        console.log('[SW] Registered:', registration.scope);

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              console.log('[SW] New version activated');
            }
          });
        });
      } catch (err) {
        console.warn('[SW] Registration failed:', err);
      }
    });
  }
}
