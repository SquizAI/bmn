// server/src/middleware/security-headers.js

import helmet from 'helmet';
import { config } from '../config/index.js';

/**
 * Enhanced security headers via Helmet.
 *
 * Full CSP configuration per PRD Section 5:
 * - Scripts: self, Stripe.js, PostHog
 * - Styles: self, Google Fonts, unsafe-inline (for Tailwind)
 * - Images: self, Supabase Storage, R2, OpenAI, Fal, Ideogram
 * - Connect: self, Supabase, Socket.io, PostHog, Sentry, Stripe
 * - Fonts: self, Google Fonts
 * - Frames: self, app.prznl.com, api.prznl.com
 * - Frame-Ancestors: self, app.prznl.com
 *
 * HSTS: 1 year, includeSubDomains, preload
 * Referrer: strict-origin-when-cross-origin
 *
 * @returns {import('express').RequestHandler}
 */
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: config.isDev
      ? false
      : {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
              "'self'",
              'https://js.stripe.com',
              'https://us.posthog.com',
              'https://us-assets.i.posthog.com',
            ],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              'https://fonts.googleapis.com',
            ],
            imgSrc: [
              "'self'",
              'data:',
              config.API_URL,
              'https://*.supabase.co',
              'https://*.r2.cloudflarestorage.com',
              'https://oaidalleapiprodscus.blob.core.windows.net',
              'https://*.fal.ai',
              'https://api.ideogram.ai',
              'https://images.unsplash.com',
            ],
            connectSrc: [
              "'self'",
              config.APP_URL,
              config.API_URL,
              'https://*.supabase.co',
              'wss://*.supabase.co',
              'https://us.posthog.com',
              'https://*.ingest.sentry.io',
              'https://api.stripe.com',
            ],
            fontSrc: [
              "'self'",
              'https://fonts.gstatic.com',
            ],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: [
              "'self'",
              'https://app.prznl.com',
              'https://api.prznl.com',
            ],
            frameAncestors: [
              "'self'",
              'https://app.prznl.com',
            ],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: [],
          },
        },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'sameorigin',
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    xContentTypeOptions: true,
  });
}

/**
 * Permissions-Policy header middleware.
 * Denies access to camera, microphone, and geolocation APIs.
 *
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function permissionsPolicy(_req, res, next) {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self)'
  );
  next();
}
