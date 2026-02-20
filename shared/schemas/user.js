// shared/schemas/user.js
//
// Zod schemas for User and Profile records.
// Shared between client (TypeScript) and server (JavaScript + JSDoc).

import { z } from 'zod';

// ---- User Role --------------------------------------------------------------

export const UserRoleEnum = z.enum([
  'user',
  'admin',
]);

// ---- Subscription Tier ------------------------------------------------------

export const SubscriptionTierEnum = z.enum([
  'free',
  'starter',
  'pro',
  'agency',
]);

// ---- User Profile -----------------------------------------------------------

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().min(1).max(200).nullable().default(null),
  avatarUrl: z.string().url().nullable().default(null),
  role: UserRoleEnum.default('user'),
  subscriptionTier: SubscriptionTierEnum.default('free'),
  stripeCustomerId: z.string().nullable().default(null),
  onboardingComplete: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ---- Update Profile Request -------------------------------------------------

export const UpdateProfileRequestSchema = z.object({
  fullName: z.string().min(1).max(200).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

// ---- Public User (safe to expose to frontend) -------------------------------

export const PublicUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  role: UserRoleEnum,
  subscriptionTier: SubscriptionTierEnum,
  onboardingComplete: z.boolean(),
});
