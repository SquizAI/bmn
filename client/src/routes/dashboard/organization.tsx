import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'motion/react';
import {
  Building2,
  Users,
  UserPlus,
  Crown,
  Shield,
  Eye,
  Pencil,
  Trash2,
  Mail,
  Save,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { apiClient } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

// ------ Schemas ------

const orgSettingsSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(200),
  billing_email: z.string().email().optional().or(z.literal('')),
});

const inviteSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.enum(['admin', 'manager', 'member']),
});

type OrgSettingsForm = z.infer<typeof orgSettingsSchema>;
type InviteForm = z.infer<typeof inviteSchema>;

// ------ Types ------

interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  billing_email: string | null;
  subscription_tier: string;
  userRole: string;
}

interface OrgMember {
  id: string;
  role: string;
  joined_at: string;
  user_id: string;
  profiles: {
    id: string;
    email: string;
    full_name: string;
    avatar_url: string;
  };
}

interface Invite {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
}

// ------ Query Keys ------

const ORG_KEYS = {
  org: ['organization'] as const,
  members: (orgId: string) => ['organization', orgId, 'members'] as const,
  invites: (orgId: string) => ['organization', orgId, 'invites'] as const,
};

// ------ Role display helpers ------

const ROLE_ICONS: Record<string, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  manager: Pencil,
  member: Eye,
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  member: 'Member',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'text-warning',
  admin: 'text-primary',
  manager: 'text-info',
  member: 'text-text-secondary',
};

// ------ Component ------

export default function OrganizationPage() {
  const orgRole = useAuthStore((s) => s.orgRole);
  const addToast = useUIStore((s) => s.addToast);
  const queryClient = useQueryClient();
  const [showInviteForm, setShowInviteForm] = useState(false);

  const isOwner = orgRole === 'owner';
  const isAdmin = orgRole === 'admin' || orgRole === 'owner';

  // Fetch org
  const { data: org } = useQuery({
    queryKey: ORG_KEYS.org,
    queryFn: () => apiClient.get<Organization>('/api/v1/organizations'),
  });

  // Fetch members
  const { data: membersData } = useQuery({
    queryKey: ORG_KEYS.members(org?.id || ''),
    queryFn: () =>
      apiClient.get<{ items: OrgMember[] }>(
        `/api/v1/organizations/${org?.id}/members`
      ),
    enabled: !!org?.id && isAdmin,
  });

  // Fetch invites
  const { data: invitesData } = useQuery({
    queryKey: ORG_KEYS.invites(org?.id || ''),
    queryFn: () =>
      apiClient.get<{ items: Invite[] }>(
        `/api/v1/organizations/${org?.id}/invites`
      ),
    enabled: !!org?.id && isAdmin,
  });

  // Update org mutation
  const updateOrg = useMutation({
    mutationFn: (data: OrgSettingsForm) =>
      apiClient.patch(`/api/v1/organizations/${org?.id}`, data),
    onSuccess: () => {
      addToast({ type: 'success', title: 'Organization updated!' });
      queryClient.invalidateQueries({ queryKey: ORG_KEYS.org });
    },
    onError: () => {
      addToast({ type: 'error', title: 'Failed to update organization' });
    },
  });

  // Invite member mutation
  const inviteMember = useMutation({
    mutationFn: (data: InviteForm) =>
      apiClient.post(`/api/v1/organizations/${org?.id}/members/invite`, data),
    onSuccess: () => {
      addToast({ type: 'success', title: 'Invite sent!' });
      setShowInviteForm(false);
      queryClient.invalidateQueries({ queryKey: ORG_KEYS.invites(org?.id || '') });
      inviteForm.reset();
    },
    onError: (err: Error) => {
      addToast({ type: 'error', title: err.message || 'Failed to send invite' });
    },
  });

  // Remove member mutation
  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      apiClient.delete(`/api/v1/organizations/${org?.id}/members/${userId}`),
    onSuccess: () => {
      addToast({ type: 'success', title: 'Member removed' });
      queryClient.invalidateQueries({ queryKey: ORG_KEYS.members(org?.id || '') });
    },
    onError: () => {
      addToast({ type: 'error', title: 'Failed to remove member' });
    },
  });

  // Cancel invite mutation
  const cancelInvite = useMutation({
    mutationFn: (inviteId: string) =>
      apiClient.delete(`/api/v1/organizations/${org?.id}/invites/${inviteId}`),
    onSuccess: () => {
      addToast({ type: 'success', title: 'Invite cancelled' });
      queryClient.invalidateQueries({ queryKey: ORG_KEYS.invites(org?.id || '') });
    },
  });

  // Org settings form
  const orgForm = useForm<OrgSettingsForm>({
    resolver: zodResolver(orgSettingsSchema),
    values: {
      name: org?.name || '',
      billing_email: org?.billing_email || '',
    },
  });

  // Invite form
  const inviteForm = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'member' },
  });

  const members = membersData?.items || [];
  const invites = invitesData?.items || [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-8"
    >
      <div>
        <h1 className="text-2xl font-bold text-text">Organization</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage your organization, team members, and permissions.
        </p>
      </div>

      {/* Org Settings */}
      <Card variant="outlined" padding="lg">
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="h-5 w-5 text-primary" />
          <CardTitle>Organization Settings</CardTitle>
        </div>

        <form
          onSubmit={orgForm.handleSubmit((data) => updateOrg.mutate(data))}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Organization Name"
              placeholder="My Agency"
              error={orgForm.formState.errors.name?.message}
              disabled={!isOwner}
              {...orgForm.register('name')}
            />
            <Input
              label="Billing Email"
              type="email"
              placeholder="billing@agency.com"
              error={orgForm.formState.errors.billing_email?.message}
              disabled={!isOwner}
              leftAddon={<Mail className="h-4 w-4" />}
              {...orgForm.register('billing_email')}
            />
          </div>

          {isOwner && (
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={!orgForm.formState.isDirty}
                loading={updateOrg.isPending}
                leftIcon={<Save className="h-4 w-4" />}
              >
                Save Changes
              </Button>
            </div>
          )}
        </form>
      </Card>

      {/* Members */}
      {isAdmin && (
        <Card variant="outlined" padding="lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>Team Members</CardTitle>
              <span className="ml-2 rounded-full bg-surface-hover px-2 py-0.5 text-xs font-medium text-text-secondary">
                {members.length}
              </span>
            </div>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<UserPlus className="h-4 w-4" />}
              onClick={() => setShowInviteForm(!showInviteForm)}
            >
              Invite
            </Button>
          </div>

          {/* Invite form */}
          {showInviteForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mb-6 overflow-hidden"
            >
              <form
                onSubmit={inviteForm.handleSubmit((data) => inviteMember.mutate(data))}
                className="flex items-end gap-3 rounded-lg bg-surface-hover p-4"
              >
                <Input
                  label="Email"
                  placeholder="teammate@example.com"
                  error={inviteForm.formState.errors.email?.message}
                  className="flex-1"
                  {...inviteForm.register('email')}
                />
                <select
                  className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text"
                  {...inviteForm.register('role')}
                >
                  <option value="member">Member</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
                <Button type="submit" loading={inviteMember.isPending}>
                  Send Invite
                </Button>
              </form>
            </motion.div>
          )}

          {/* Member list */}
          <div className="flex flex-col divide-y divide-border">
            {members.map((member) => {
              const RoleIcon = ROLE_ICONS[member.role] || Eye;
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-hover text-sm font-semibold text-text-secondary">
                      {member.profiles.full_name?.[0]?.toUpperCase() ||
                        member.profiles.email[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text">
                        {member.profiles.full_name || member.profiles.email}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {member.profiles.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex items-center gap-1.5 text-xs font-medium',
                        ROLE_COLORS[member.role]
                      )}
                    >
                      <RoleIcon className="h-3.5 w-3.5" />
                      {ROLE_LABELS[member.role]}
                    </span>
                    {isOwner && member.role !== 'owner' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMember.mutate(member.user_id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-error" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pending invites */}
          {invites.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                Pending Invites
              </p>
              <div className="flex flex-col divide-y divide-border">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="text-sm text-text">{invite.email}</p>
                      <p className="text-xs text-text-secondary">
                        {ROLE_LABELS[invite.role]} &middot; Expires{' '}
                        {new Date(invite.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelInvite.mutate(invite.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-error" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </motion.div>
  );
}
