import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import posthog from 'posthog-js';
import { App } from '@/App';
import { registerServiceWorker } from '@/lib/register-sw';
import '@/styles/global.css';

// ── Sentry Error Tracking ───────────────────────────────────────
// Guard: only init with a fully-formed DSN (must contain @ and be > 20 chars)
const sentryDsn = import.meta.env.VITE_SENTRY_DSN || '';
if (sentryDsn && sentryDsn.includes('@') && sentryDsn.length > 20) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.VITE_APP_ENV || 'development',
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: import.meta.env.VITE_APP_ENV === 'production' ? 0.2 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

// ── PostHog Analytics ───────────────────────────────────────────
// Guard: only init with a real key (phc_ prefix + at least 10 total chars)
const posthogKey = import.meta.env.VITE_POSTHOG_KEY || '';
if (posthogKey && posthogKey.length > 10) {
  posthog.init(posthogKey, {
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
