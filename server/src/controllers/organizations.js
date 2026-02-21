// server/src/controllers/organizations.js

import crypto from 'node:crypto';
import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';

/**
 * GET /api/v1/organizations
 * Get the current user's organization.
 */
export async function getMyOrg(req, res, next) {
  try {
    const orgId = req.profile.org_id;

    if (!orgId) {
      return res.status(404).json({ success: false, error: 'No organization found' });
    }

    const { data: org, error } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();

    if (error || !org) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }

    res.json({ success: true, data: { ...org, userRole: req.orgRole } });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/organizations/:orgId
 * Update org name, logo, billing email, settings.
 * Requires org owner role.
 */
export async function updateOrg(req, res, next) {
  try {
    const { orgId } = req.params;
    const updates = req.body;

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .update(updates)
      .eq('id', orgId)
      .select()
      .single();

    if (error) {
      logger.error({ error, orgId }, 'Failed to update organization');
      return res.status(500).json({ success: false, error: 'Failed to update organization' });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/organizations/:orgId/members
 * List all members of the org.
 * Requires org admin role.
 */
export async function listMembers(req, res, next) {
  try {
    const { orgId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('organization_members')
      .select(`
        id,
        role,
        joined_at,
        user_id,
        profiles:user_id (id, email, full_name, avatar_url)
      `)
      .eq('org_id', orgId)
      .order('joined_at', { ascending: true });

    if (error) {
      logger.error({ error, orgId }, 'Failed to list members');
      return res.status(500).json({ success: false, error: 'Failed to list members' });
    }

    res.json({ success: true, data: { items: data } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/organizations/:orgId/members/invite
 * Send an invite email. Creates a pending invite record.
 * Requires org admin role.
 */
export async function inviteMember(req, res, next) {
  try {
    const { orgId } = req.params;
    const { email, role } = req.body;
    const invitedBy = req.user.id;

    // Check if user is already a member
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingProfile) {
      const { data: existingMember } = await supabaseAdmin
        .from('organization_members')
        .select('id')
        .eq('org_id', orgId)
        .eq('user_id', existingProfile.id)
        .single();

      if (existingMember) {
        return res.status(409).json({ success: false, error: 'User is already a member of this organization' });
      }
    }

    // Generate secure invite token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Upsert invite (replace if re-inviting same email)
    const { data: invite, error } = await supabaseAdmin
      .from('organization_invites')
      .upsert(
        {
          org_id: orgId,
          email,
          role,
          invited_by: invitedBy,
          token,
          expires_at: expiresAt.toISOString(),
          accepted_at: null,
        },
        { onConflict: 'org_id,email' }
      )
      .select()
      .single();

    if (error) {
      logger.error({ error, orgId, email }, 'Failed to create invite');
      return res.status(500).json({ success: false, error: 'Failed to create invite' });
    }

    // TODO: Queue email via BullMQ (Resend) with invite link
    logger.info({ orgId, email, role, token }, 'Org invite created');

    res.status(201).json({ success: true, data: invite });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/organizations/:orgId/members/:userId
 * Change a member's role.
 * Requires org owner role.
 */
export async function updateMemberRole(req, res, next) {
  try {
    const { orgId, userId } = req.params;
    const { role } = req.body;

    // Cannot change the owner's role
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('owner_id')
      .eq('id', orgId)
      .single();

    if (org && org.owner_id === userId) {
      return res.status(400).json({ success: false, error: 'Cannot change the organization owner\'s role' });
    }

    const { data, error } = await supabaseAdmin
      .from('organization_members')
      .update({ role })
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/organizations/:orgId/members/:userId
 * Remove a member from the org.
 * Requires org owner role.
 */
export async function removeMember(req, res, next) {
  try {
    const { orgId, userId } = req.params;

    // Cannot remove the owner
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('owner_id')
      .eq('id', orgId)
      .single();

    if (org && org.owner_id === userId) {
      return res.status(400).json({ success: false, error: 'Cannot remove the organization owner' });
    }

    const { error } = await supabaseAdmin
      .from('organization_members')
      .delete()
      .eq('org_id', orgId)
      .eq('user_id', userId);

    if (error) {
      logger.error({ error, orgId, userId }, 'Failed to remove member');
      return res.status(500).json({ success: false, error: 'Failed to remove member' });
    }

    // Also remove any brand assignments for this user in this org
    await supabaseAdmin
      .from('brand_assignments')
      .delete()
      .eq('user_id', userId)
      .in('brand_id',
        supabaseAdmin
          .from('brands')
          .select('id')
          .eq('org_id', orgId)
      );

    res.json({ success: true, data: { message: 'Member removed' } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/organizations/invites/accept
 * Accept an invite token. Adds user to the org.
 */
export async function acceptInvite(req, res, next) {
  try {
    const { token } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    // Find the invite
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('organization_invites')
      .select('*')
      .eq('token', token)
      .is('accepted_at', null)
      .single();

    if (inviteError || !invite) {
      return res.status(404).json({ success: false, error: 'Invalid or expired invite' });
    }

    // Check expiry
    if (new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ success: false, error: 'Invite has expired' });
    }

    // Check email matches
    if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'Invite was sent to a different email address' });
    }

    // Add membership
    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        org_id: invite.org_id,
        user_id: userId,
        role: invite.role,
        invited_by: invite.invited_by,
      });

    if (memberError) {
      if (memberError.code === '23505') {
        return res.status(409).json({ success: false, error: 'Already a member of this organization' });
      }
      logger.error({ error: memberError, inviteId: invite.id }, 'Failed to accept invite');
      return res.status(500).json({ success: false, error: 'Failed to join organization' });
    }

    // Update user's org_id to the new org
    await supabaseAdmin
      .from('profiles')
      .update({ org_id: invite.org_id })
      .eq('id', userId);

    // Mark invite as accepted
    await supabaseAdmin
      .from('organization_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    res.json({ success: true, data: { org_id: invite.org_id, role: invite.role } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/organizations/:orgId/brands
 * List all brands in the org.
 * Requires org member role.
 */
export async function listOrgBrands(req, res, next) {
  try {
    const { orgId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabaseAdmin
      .from('brands')
      .select('id, name, status, wizard_step, created_at, updated_at, user_id', { count: 'exact' })
      .eq('org_id', orgId)
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error({ error, orgId }, 'Failed to list org brands');
      return res.status(500).json({ success: false, error: 'Failed to list brands' });
    }

    res.json({ success: true, data: { items: data, total: count, page, limit } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/organizations/:orgId/brands/:brandId/assign
 * Assign a brand to a member.
 * Requires org admin role.
 */
export async function assignBrand(req, res, next) {
  try {
    const { orgId, brandId } = req.params;
    const { user_id: targetUserId, role } = req.body;
    const assignedBy = req.user.id;

    // Verify brand belongs to this org
    const { data: brand } = await supabaseAdmin
      .from('brands')
      .select('id')
      .eq('id', brandId)
      .eq('org_id', orgId)
      .single();

    if (!brand) {
      return res.status(404).json({ success: false, error: 'Brand not found in this organization' });
    }

    // Verify target user is a member of the org
    const { data: member } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', targetUserId)
      .single();

    if (!member) {
      return res.status(400).json({ success: false, error: 'User is not a member of this organization' });
    }

    const { data, error } = await supabaseAdmin
      .from('brand_assignments')
      .upsert(
        {
          brand_id: brandId,
          user_id: targetUserId,
          role,
          assigned_by: assignedBy,
        },
        { onConflict: 'brand_id,user_id' }
      )
      .select()
      .single();

    if (error) {
      logger.error({ error, brandId, targetUserId }, 'Failed to assign brand');
      return res.status(500).json({ success: false, error: 'Failed to assign brand' });
    }

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/organizations/:orgId/brands/:brandId/assign/:userId
 * Remove a brand assignment.
 * Requires org admin role.
 */
export async function unassignBrand(req, res, next) {
  try {
    const { orgId, brandId, userId } = req.params;

    // Verify brand belongs to this org
    const { data: brand } = await supabaseAdmin
      .from('brands')
      .select('id')
      .eq('id', brandId)
      .eq('org_id', orgId)
      .single();

    if (!brand) {
      return res.status(404).json({ success: false, error: 'Brand not found in this organization' });
    }

    const { error } = await supabaseAdmin
      .from('brand_assignments')
      .delete()
      .eq('brand_id', brandId)
      .eq('user_id', userId);

    if (error) {
      logger.error({ error, brandId, userId }, 'Failed to unassign brand');
      return res.status(500).json({ success: false, error: 'Failed to unassign brand' });
    }

    res.json({ success: true, data: { message: 'Brand assignment removed' } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/organizations/:orgId/invites
 * List pending invites for the org.
 * Requires org admin role.
 */
export async function listInvites(req, res, next) {
  try {
    const { orgId } = req.params;

    const { data, error } = await supabaseAdmin
      .from('organization_invites')
      .select('*')
      .eq('org_id', orgId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error({ error, orgId }, 'Failed to list invites');
      return res.status(500).json({ success: false, error: 'Failed to list invites' });
    }

    res.json({ success: true, data: { items: data } });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/organizations/:orgId/invites/:inviteId
 * Cancel a pending invite.
 * Requires org admin role.
 */
export async function cancelInvite(req, res, next) {
  try {
    const { orgId, inviteId } = req.params;

    const { error } = await supabaseAdmin
      .from('organization_invites')
      .delete()
      .eq('id', inviteId)
      .eq('org_id', orgId);

    if (error) {
      logger.error({ error, orgId, inviteId }, 'Failed to cancel invite');
      return res.status(500).json({ success: false, error: 'Failed to cancel invite' });
    }

    res.json({ success: true, data: { message: 'Invite cancelled' } });
  } catch (err) {
    next(err);
  }
}
