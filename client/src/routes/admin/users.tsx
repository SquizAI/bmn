import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Search,
  Shield,
  Ban,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  UserCheck,
  UserX,
  Filter,
  Mail,
  Calendar,
  CreditCard,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS } from '@/lib/constants';
import { useUIStore } from '@/stores/ui-store';
import { cn, capitalize } from '@/lib/utils';

// ------ Types ------

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: 'user' | 'admin' | 'moderator';
  status: 'active' | 'suspended';
  brandsCount: number;
  subscriptionTier: string;
  createdAt: string;
  lastSignIn: string | null;
}

interface UsersResponse {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

type RoleFilter = 'all' | 'user' | 'admin' | 'moderator';

// ------ Role Badge ------

function RoleBadge({ role }: { role: AdminUser['role'] }) {
  const styles = {
    admin: 'bg-primary-light text-primary',
    moderator: 'bg-warning-bg text-warning',
    user: 'bg-surface-hover text-text-secondary',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles[role],
      )}
    >
      {role === 'admin' && <Shield className="h-3 w-3" />}
      {capitalize(role)}
    </span>
  );
}

// ------ Status Badge ------

function UserStatusBadge({ status }: { status: AdminUser['status'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        status === 'active' ? 'bg-success-bg text-success' : 'bg-error-bg text-error',
      )}
    >
      {status === 'active' ? (
        <UserCheck className="h-3 w-3" />
      ) : (
        <UserX className="h-3 w-3" />
      )}
      {capitalize(status)}
    </span>
  );
}

// ------ Tier Badge ------

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    free: 'bg-surface-hover text-text-muted',
    starter: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    pro: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    agency: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        styles[tier] || 'bg-surface-hover text-text-secondary',
      )}
    >
      <CreditCard className="h-3 w-3" />
      {tier}
    </span>
  );
}

// ------ User Detail Row ------

function UserDetailPanel({ user }: { user: AdminUser }) {
  return (
    <motion.tr
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <td colSpan={7} className="px-4 py-0">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="rounded-lg bg-surface-hover/50 p-4 mb-2"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
              <div>
                <p className="text-xs font-medium text-text-muted">Email</p>
                <p className="text-sm text-text">{user.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
              <div>
                <p className="text-xs font-medium text-text-muted">Joined</p>
                <p className="text-sm text-text">
                  {new Date(user.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
              <div>
                <p className="text-xs font-medium text-text-muted">Last Sign In</p>
                <p className="text-sm text-text">
                  {user.lastSignIn
                    ? new Date(user.lastSignIn).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Never'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Layers className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
              <div>
                <p className="text-xs font-medium text-text-muted">Brands Created</p>
                <p className="text-sm text-text">{user.brandsCount}</p>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3 border-t border-border/50 pt-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Role:</span>
              <RoleBadge role={user.role} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Status:</span>
              <UserStatusBadge status={user.status} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Tier:</span>
              <TierBadge tier={user.subscriptionTier} />
            </div>
            <div className="text-xs text-text-muted">
              ID: <span className="font-mono">{user.id.slice(0, 12)}...</span>
            </div>
          </div>
        </motion.div>
      </td>
    </motion.tr>
  );
}

// ------ Component ------

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [page, setPage] = useState(1);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.adminUsers(), { search, role: roleFilter, page }],
    queryFn: () =>
      apiClient.get<UsersResponse>('/api/v1/admin/users', {
        params: {
          search: search || undefined,
          role: roleFilter === 'all' ? undefined : roleFilter,
          page,
          limit: 20,
        },
      }),
  });

  const suspendUser = useMutation({
    mutationFn: (userId: string) =>
      apiClient.post(`/api/v1/admin/users/${userId}/suspend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      addToast({ type: 'success', title: 'User suspended' });
    },
    onError: () => addToast({ type: 'error', title: 'Failed to suspend user' }),
  });

  const activateUser = useMutation({
    mutationFn: (userId: string) =>
      apiClient.post(`/api/v1/admin/users/${userId}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      addToast({ type: 'success', title: 'User activated' });
    },
    onError: () => addToast({ type: 'error', title: 'Failed to activate user' }),
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiClient.patch(`/api/v1/admin/users/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      addToast({ type: 'success', title: 'Role updated' });
    },
    onError: () => addToast({ type: 'error', title: 'Failed to change role' }),
  });

  const users = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  const handleRowClick = (userId: string) => {
    setExpandedUserId(expandedUserId === userId ? null : userId);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-text">User Management</h1>
        </div>
        <span className="text-sm text-text-muted">{total} users</span>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            leftAddon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 shrink-0 text-text-muted" />
          {(['all', 'user', 'admin', 'moderator'] as const).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => {
                setRoleFilter(role);
                setPage(1);
              }}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                roleFilter === role
                  ? 'bg-primary text-white'
                  : 'bg-surface-hover text-text-secondary hover:text-text',
              )}
            >
              {capitalize(role)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card variant="outlined" padding="none" className="overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-hover">
                  <th className="px-4 py-3 font-semibold text-text-muted">User</th>
                  <th className="px-4 py-3 font-semibold text-text-muted">Role</th>
                  <th className="px-4 py-3 font-semibold text-text-muted">Status</th>
                  <th className="hidden md:table-cell px-4 py-3 font-semibold text-text-muted">Brands</th>
                  <th className="hidden md:table-cell px-4 py-3 font-semibold text-text-muted">Tier</th>
                  <th className="hidden lg:table-cell px-4 py-3 font-semibold text-text-muted">Joined</th>
                  <th className="px-4 py-3 font-semibold text-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <>
                    <tr
                      key={user.id}
                      className={cn(
                        'border-b border-border/50 transition-colors cursor-pointer',
                        expandedUserId === user.id
                          ? 'bg-surface-hover/60'
                          : 'hover:bg-surface-hover',
                      )}
                      onClick={() => handleRowClick(user.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {expandedUserId === user.id ? (
                            <ChevronUp className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                          )}
                          <div>
                            <p className="font-medium text-text">{user.fullName}</p>
                            <p className="text-xs text-text-muted">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="px-4 py-3">
                        <UserStatusBadge status={user.status} />
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-text-secondary">{user.brandsCount}</td>
                      <td className="hidden md:table-cell px-4 py-3">
                        <TierBadge tier={user.subscriptionTier} />
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 text-text-muted">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setActionMenuId(actionMenuId === user.id ? null : user.id)
                            }
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>

                          {actionMenuId === user.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setActionMenuId(null)}
                              />
                              <div className="absolute right-0 top-10 z-20 w-48 rounded-lg border border-border bg-surface py-1 shadow-lg">
                                {/* Role change options */}
                                <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                                  Change Role
                                </p>
                                {(['user', 'moderator', 'admin'] as const).map((role) => (
                                  <button
                                    key={role}
                                    type="button"
                                    disabled={user.role === role}
                                    onClick={() => {
                                      changeRole.mutate({ userId: user.id, role });
                                      setActionMenuId(null);
                                    }}
                                    className={cn(
                                      'flex w-full items-center gap-2 px-3 py-2 text-sm',
                                      user.role === role
                                        ? 'cursor-not-allowed bg-surface-hover text-text-muted'
                                        : 'text-text hover:bg-surface-hover',
                                    )}
                                  >
                                    {role === 'admin' && <Shield className="h-3.5 w-3.5" />}
                                    {role === 'moderator' && <Shield className="h-3.5 w-3.5 text-warning" />}
                                    {role === 'user' && <Users className="h-3.5 w-3.5" />}
                                    {capitalize(role)}
                                    {user.role === role && (
                                      <span className="ml-auto text-[10px] text-text-muted">(current)</span>
                                    )}
                                  </button>
                                ))}

                                <div className="my-1 border-t border-border" />

                                {/* Suspend / Activate */}
                                {user.status === 'active' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      suspendUser.mutate(user.id);
                                      setActionMenuId(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-error hover:bg-error-bg"
                                  >
                                    <Ban className="h-4 w-4" />
                                    Suspend User
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      activateUser.mutate(user.id);
                                      setActionMenuId(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-success hover:bg-success-bg"
                                  >
                                    <UserCheck className="h-4 w-4" />
                                    Activate User
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expandable detail row */}
                    <AnimatePresence>
                      {expandedUserId === user.id && (
                        <UserDetailPanel key={`detail-${user.id}`} user={user} />
                      )}
                    </AnimatePresence>
                  </>
                ))}

                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-text-muted">
                      {search || roleFilter !== 'all'
                        ? 'No users match your search filters.'
                        : 'No users found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-xs text-text-muted">
              Page {page} of {totalPages} ({total} total)
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                leftIcon={<ChevronLeft className="h-4 w-4" />}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                rightIcon={<ChevronRight className="h-4 w-4" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
