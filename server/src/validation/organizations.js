// server/src/validation/organizations.js

import { z } from 'zod';

/**
 * PATCH /api/v1/organizations/:orgId
 */
export const updateOrgSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  logo_url: z.string().url().max(2048).optional().or(z.literal('')),
  billing_email: z.string().email().max(200).optional().or(z.literal('')),
  settings: z.record(z.unknown()).optional(),
});

/**
 * POST /api/v1/organizations/:orgId/members/invite
 */
export const inviteMemberSchema = z.object({
  email: z.string().email('Valid email is required').max(200),
  role: z.enum(['admin', 'manager', 'member']).default('member'),
});

/**
 * PATCH /api/v1/organizations/:orgId/members/:userId
 */
export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'manager', 'member']),
});

/**
 * POST /api/v1/organizations/invites/accept
 */
export const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Invite token is required'),
});

/**
 * POST /api/v1/organizations/:orgId/brands/:brandId/assign
 */
export const assignBrandSchema = z.object({
  user_id: z.string().uuid('Valid user ID is required'),
  role: z.enum(['editor', 'viewer']).default('viewer'),
});
