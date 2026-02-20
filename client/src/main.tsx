import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import posthog from 'posthog-js';
import { App } from '@/App';
import { registerServiceWorker } from '@/lib/register-sw';
import '@/styles/global.css';

// ── Sentry Error Tracking ───────────────────────────────────────
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_APP_ENV || 'development',
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: import.meta.env.VITE_APP_ENV === 'production' ? 0.2 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

// ── PostHog Analytics ───────────────────────────────────────────
if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    capture_pageview: true,
    capture_pageleave: true,
  });
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'Root element not found. Make sure there is a <div id="root"></div> in index.html.',
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register service worker for offline resilience (production only)
registerServiceWorker();
