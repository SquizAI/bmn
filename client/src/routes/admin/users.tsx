import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Users,
  Search,
  Shield,
  Ban,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
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

// ------ Component ------

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);

  const { data, isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.adminUsers(), { search, page }],
    queryFn: () =>
      apiClient.get<UsersResponse>('/api/v1/admin/users', {
        params: { search: search || undefined, page, limit: 20 },
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

      {/* Search */}
      <Input
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        leftAddon={<Search className="h-4 w-4" />}
      />

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
                  <tr
                    key={user.id}
                    className="border-b border-border/50 transition-colors hover:bg-surface-hover"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-text">{user.fullName}</p>
                        <p className="text-xs text-text-muted">{user.email}</p>
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
                      <span className="capitalize text-text-secondary">
                        {user.subscriptionTier}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3 text-text-muted">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
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
                            <div className="absolute right-0 top-10 z-20 w-44 rounded-lg border border-border bg-surface py-1 shadow-lg">
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
                                  Suspend
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
                                  Activate
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const newRole =
                                    user.role === 'admin' ? 'user' : 'admin';
                                  changeRole.mutate({ userId: user.id, role: newRole });
                                  setActionMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text hover:bg-surface-hover"
                              >
                                <Shield className="h-4 w-4" />
                                {user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-text-muted">
                      No users found.
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
              Page {page} of {totalPages}
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
