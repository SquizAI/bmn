// server/src/middleware/helmet.js

import helmet from 'helmet';
import { config } from '../config/index.js';

/**
 * Security headers middleware.
 *
 * Helmet sets:
 * - Content-Security-Policy (CSP)
 * - Strict-Transport-Security (HSTS)
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - X-XSS-Protection (legacy browsers)
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy
 *
 * CSP is relaxed in development to allow hot-reload and devtools.
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: config.isDev
    ? false
    : {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https://*.supabase.co', 'https://*.r2.cloudflarestorage.com'],
          connectSrc: ["'self'", config.APP_URL, 'https://*.supabase.co', 'https://*.posthog.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});
