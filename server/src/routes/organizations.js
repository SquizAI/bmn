// server/src/routes/organizations.js

import { Router } from 'express';
import * as orgController from '../controllers/organizations.js';
import { validate } from '../middleware/validate.js';
import { requireOrgRole } from '../middleware/auth.js';
import {
  updateOrgSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  acceptInviteSchema,
  assignBrandSchema,
} from '../validation/organizations.js';

export const organizationRoutes = Router();

// GET /api/v1/organizations -- Get current user's org
organizationRoutes.get('/', orgController.getMyOrg);

// PATCH /api/v1/organizations/:orgId -- Update org settings
organizationRoutes.patch(
  '/:orgId',
  requireOrgRole('owner'),
  validate({ body: updateOrgSchema }),
  orgController.updateOrg
);

// GET /api/v1/organizations/:orgId/members -- List members
organizationRoutes.get(
  '/:orgId/members',
  requireOrgRole('admin'),
  orgController.listMembers
);

// POST /api/v1/organizations/:orgId/members/invite -- Send invite
organizationRoutes.post(
  '/:orgId/members/invite',
  requireOrgRole('admin'),
  validate({ body: inviteMemberSchema }),
  orgController.inviteMember
);

// PATCH /api/v1/organizations/:orgId/members/:userId -- Change role
organizationRoutes.patch(
  '/:orgId/members/:userId',
  requireOrgRole('owner'),
  validate({ body: updateMemberRoleSchema }),
  orgController.updateMemberRole
);

// DELETE /api/v1/organizations/:orgId/members/:userId -- Remove member
organizationRoutes.delete(
  '/:orgId/members/:userId',
  requireOrgRole('owner'),
  orgController.removeMember
);

// POST /api/v1/organizations/invites/accept -- Accept invite token
organizationRoutes.post(
  '/invites/accept',
  validate({ body: acceptInviteSchema }),
  orgController.acceptInvite
);

// GET /api/v1/organizations/:orgId/invites -- List pending invites
organizationRoutes.get(
  '/:orgId/invites',
  requireOrgRole('admin'),
  orgController.listInvites
);

// DELETE /api/v1/organizations/:orgId/invites/:inviteId -- Cancel invite
organizationRoutes.delete(
  '/:orgId/invites/:inviteId',
  requireOrgRole('admin'),
  orgController.cancelInvite
);

// GET /api/v1/organizations/:orgId/brands -- List all org brands
organizationRoutes.get(
  '/:orgId/brands',
  requireOrgRole('member'),
  orgController.listOrgBrands
);

// POST /api/v1/organizations/:orgId/brands/:brandId/assign -- Assign brand
organizationRoutes.post(
  '/:orgId/brands/:brandId/assign',
  requireOrgRole('admin'),
  validate({ body: assignBrandSchema }),
  orgController.assignBrand
);

// DELETE /api/v1/organizations/:orgId/brands/:brandId/assign/:userId -- Unassign
organizationRoutes.delete(
  '/:orgId/brands/:brandId/assign/:userId',
  requireOrgRole('admin'),
  orgController.unassignBrand
);
