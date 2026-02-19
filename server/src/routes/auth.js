// server/src/routes/auth.js

import { Router } from 'express';
import * as authController from '../controllers/auth.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rate-limit.js';
import {
  signupSchema,
  loginSchema,
  refreshSchema,
  completeOnboardingSchema,
  passwordResetSchema,
  updateProfileSchema,
} from '../validation/auth.js';

export const authRoutes = Router();

// POST /api/v1/auth/signup -- Create account
authRoutes.post(
  '/signup',
  authLimiter,
  validate({ body: signupSchema }),
  authController.signup
);

// POST /api/v1/auth/login -- Validate token, return profile
authRoutes.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  authController.login
);

// POST /api/v1/auth/refresh -- Refresh access token
authRoutes.post(
  '/refresh',
  authLimiter,
  validate({ body: refreshSchema }),
  authController.refresh
);

// POST /api/v1/auth/logout -- Invalidate session (requires auth)
authRoutes.post(
  '/logout',
  requireAuth,
  authController.logout
);

// GET /api/v1/auth/callback -- OAuth callback (Google, Apple)
authRoutes.get(
  '/callback',
  authController.oauthCallback
);

// POST /api/v1/auth/onboarding -- Complete onboarding (requires auth)
authRoutes.post(
  '/onboarding',
  requireAuth,
  validate({ body: completeOnboardingSchema }),
  authController.completeOnboarding
);

// GET /api/v1/auth/me -- Get authenticated user profile
authRoutes.get(
  '/me',
  requireAuth,
  authController.getProfile
);

// PUT /api/v1/auth/me -- Update authenticated user profile
authRoutes.put(
  '/me',
  requireAuth,
  validate({ body: updateProfileSchema }),
  authController.updateProfile
);

// POST /api/v1/auth/password-reset -- Request password reset email
authRoutes.post(
  '/password-reset',
  authLimiter,
  validate({ body: passwordResetSchema }),
  authController.passwordReset
);
