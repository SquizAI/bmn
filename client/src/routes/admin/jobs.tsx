import { useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Hourglass,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS } from '@/lib/constants';
import { cn, capitalize } from '@/lib/utils';

// ------ Types ------

type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';

interface AdminJob {
  id: string;
  queueName: string;
  status: JobStatus;
  progress: number;
  attemptsMade: number;
  data: Record<string, unknown>;
  createdAt: string;
  processedAt: string | null;
  completedAt: string | null;
  failedReason: string | null;
  duration: number | null;
}

interface JobsResponse {
  items: AdminJob[];
  total: number;
  page: number;
  limit: number;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
}

// ------ Status helpers ------

const statusConfig: Record<
  JobStatus,
  { icon: React.ReactNode; color: string; bg: string }
> = {
  waiting: {
    icon: <Hourglass className="h-3.5 w-3.5" />,
    color: 'text-text-muted',
    bg: 'bg-surface-hover',
  },
  active: {
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    color: 'text-primary',
    bg: 'bg-primary-light',
  },
  completed: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: 'text-success',
    bg: 'bg-success-bg',
  },
  failed: {
    icon: <XCircle className="h-3.5 w-3.5" />,
    color: 'text-error',
    bg: 'bg-error-bg',
  },
  delayed: {
    icon: <Clock className="h-3.5 w-3.5" />,
    color: 'text-warning',
    bg: 'bg-warning-bg',
  },
};

function StatusBadge({ status }: { status: JobStatus }) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.color,
        config.bg,
      )}
    >
      {config.icon}
      {capitalize(status)}
    </span>
  );
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '--';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// ------ Component ------

export default function AdminJobsPage() {
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: [...QUERY_KEYS.adminJobs(), { status: statusFilter, page }],
    queryFn: () =>
      apiClient.get<JobsResponse>('/api/v1/admin/jobs', {
        params: {
          status: statusFilter === 'all' ? undefined : statusFilter,
          page,
          limit: 25,
        },
      }),
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const jobs = data?.items || [];
  const counts = data?.counts || {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
  };
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 25);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-text">Job Monitor</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          loading={isFetching}
          leftIcon={<RefreshCw className="h-4 w-4" />}
        >
          Refresh
        </Button>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(
          [
            { key: 'waiting', label: 'Waiting', count: counts.waiting },
            { key: 'active', label: 'Active', count: counts.active },
            { key: 'completed', label: 'Completed', count: counts.completed },
            { key: 'failed', label: 'Failed', count: counts.failed },
            { key: 'delayed', label: 'Delayed', count: counts.delayed },
          ] as const
        ).map(({ key, label, count }) => {
          const config = statusConfig[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setStatusFilter(statusFilter === key ? 'all' : key);
                setPage(1);
              }}
              className={cn(
                'rounded-xl border p-3 text-left transition-all',
                statusFilter === key
                  ? 'border-primary bg-primary-light'
                  : 'border-border bg-surface hover:bg-surface-hover',
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className={config.color}>{config.icon}</span>
                <span className="text-xs font-medium text-text-secondary">{label}</span>
              </div>
              <p className="mt-1 text-xl font-bold text-text">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Jobs table */}
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
                  <th className="px-4 py-3 font-semibold text-text-muted">Job ID</th>
                  <th className="px-4 py-3 font-semibold text-text-muted">Queue</th>
                  <th className="px-4 py-3 font-semibold text-text-muted">Status</th>
                  <th className="px-4 py-3 font-semibold text-text-muted">Progress</th>
                  <th className="px-4 py-3 font-semibold text-text-muted">Duration</th>
                  <th className="px-4 py-3 font-semibold text-text-muted">Attempts</th>
                  <th className="px-4 py-3 font-semibold text-text-muted">Created</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="border-b border-border/50 transition-colors hover:bg-surface-hover"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-text">
                        {job.id.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-surface-hover px-2 py-0.5 font-mono text-xs text-text-secondary">
                        {job.queueName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3">
                      {job.status === 'active' ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-hover">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-text-muted">{job.progress}%</span>
                        </div>
                      ) : job.status === 'completed' ? (
                        <span className="text-xs text-success">100%</span>
                      ) : (
                        <span className="text-xs text-text-muted">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">
                      {formatDuration(job.duration)}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary">
                      {job.attemptsMade}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}

                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-text-muted">
                      No jobs found{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}.
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

      {/* Failed job details */}
      {jobs.some((j) => j.status === 'failed' && j.failedReason) && (
        <Card variant="outlined" padding="md">
          <h3 className="mb-3 text-sm font-semibold text-error">Recent Failures</h3>
          <div className="space-y-2">
            {jobs
              .filter((j) => j.status === 'failed' && j.failedReason)
              .slice(0, 5)
              .map((job) => (
                <div
                  key={job.id}
                  className="rounded-lg bg-error-bg p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-text">{job.id.slice(0, 8)}</span>
                    <span className="text-xs text-text-muted">{job.queueName}</span>
                  </div>
                  <p className="mt-1 text-xs text-error">{job.failedReason}</p>
                </div>
              ))}
          </div>
        </Card>
      )}
    </motion.div>
  );
}
