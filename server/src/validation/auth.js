// server/src/validation/auth.js

import { z } from 'zod';

/**
 * POST /api/v1/auth/signup
 * Password: 8+ chars, at least 1 uppercase, at least 1 number.
 */
export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  full_name: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be at most 100 characters'),
});

/**
 * POST /api/v1/auth/login
 */
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * POST /api/v1/auth/refresh
 */
export const refreshSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required'),
});

/**
 * POST /api/v1/auth/onboarding
 * Phone: 10-20 digits. accepted_terms must be true.
 */
export const completeOnboardingSchema = z.object({
  phone: z
    .string()
    .regex(/^\+?\d{10,20}$/, 'Phone must be 10-20 digits (optional + prefix)'),
  full_name: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be at most 100 characters'),
  accepted_terms: z
    .literal(true, { errorMap: () => ({ message: 'You must accept the terms of service' }) }),
});

/**
 * POST /api/v1/auth/password-reset
 */
export const passwordResetSchema = z.object({
  email: z.string().email('Invalid email address'),
});

/**
 * PUT /api/v1/auth/me
 * All fields optional, but at least one must be provided.
 */
export const updateProfileSchema = z
  .object({
    full_name: z
      .string()
      .min(2, 'Full name must be at least 2 characters')
      .max(100, 'Full name must be at most 100 characters')
      .optional(),
    phone: z
      .string()
      .regex(/^\+?\d{10,20}$/, 'Phone must be 10-20 digits (optional + prefix)')
      .optional(),
    avatar_url: z
      .string()
      .url('Invalid avatar URL')
      .optional(),
  })
  .refine(
    (data) => data.full_name !== undefined || data.phone !== undefined || data.avatar_url !== undefined,
    { message: 'At least one field must be provided' }
  );
