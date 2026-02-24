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
  RotateCcw,
  Filter,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { QUERY_KEYS } from '@/lib/constants';
import { useUIStore } from '@/stores/ui-store';
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
  queues: string[];
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

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ------ Component ------

export default function AdminJobsPage() {
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [queueFilter, setQueueFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: [...QUERY_KEYS.adminJobs(), { status: statusFilter, queue: queueFilter, page }],
    queryFn: () =>
      apiClient.get<JobsResponse>('/api/v1/admin/jobs', {
        params: {
          status: statusFilter === 'all' ? undefined : statusFilter,
          queue: queueFilter === 'all' ? undefined : queueFilter,
          page,
          limit: 25,
        },
      }),
    refetchInterval: 5000,
  });

  const retryJob = useMutation({
    mutationFn: (jobId: string) =>
      apiClient.post(`/api/v1/admin/jobs/${jobId}/retry`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      addToast({ type: 'success', title: 'Job queued for retry' });
    },
    onError: () => addToast({ type: 'error', title: 'Failed to retry job' }),
  });

  const retryAllFailed = useMutation({
    mutationFn: () =>
      apiClient.post('/api/v1/admin/jobs/retry-all-failed', {
        queue: queueFilter === 'all' ? undefined : queueFilter,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      addToast({ type: 'success', title: 'All failed jobs queued for retry' });
    },
    onError: () => addToast({ type: 'error', title: 'Failed to retry jobs' }),
  });

  const cleanCompleted = useMutation({
    mutationFn: () =>
      apiClient.post('/api/v1/admin/jobs/clean', {
        status: 'completed',
        queue: queueFilter === 'all' ? undefined : queueFilter,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      addToast({ type: 'success', title: 'Completed jobs cleaned' });
    },
    onError: () => addToast({ type: 'error', title: 'Failed to clean jobs' }),
  });

  const jobs = data?.items || [];
  const counts = data?.counts || {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
  };
  const queues = data?.queues || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 25);
  const totalJobs = counts.waiting + counts.active + counts.completed + counts.failed + counts.delayed;

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
          {isFetching && !isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {counts.failed > 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (!confirm(`Retry all ${counts.failed} failed jobs?`)) return;
                retryAllFailed.mutate();
              }}
              loading={retryAllFailed.isPending}
              leftIcon={<RotateCcw className="h-4 w-4" />}
            >
              Retry All Failed ({counts.failed})
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!confirm('Clean all completed jobs?')) return;
              cleanCompleted.mutate();
            }}
            loading={cleanCompleted.isPending}
            leftIcon={<Trash2 className="h-4 w-4" />}
          >
            Clean Completed
          </Button>
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
              {totalJobs > 0 && (
                <p className="text-[10px] text-text-muted">
                  {((count / totalJobs) * 100).toFixed(0)}%
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Queue filter */}
      {queues.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto">
          <Filter className="h-4 w-4 shrink-0 text-text-muted" />
          <span className="text-xs text-text-muted shrink-0">Queue:</span>
          <button
            type="button"
            onClick={() => { setQueueFilter('all'); setPage(1); }}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              queueFilter === 'all'
                ? 'bg-primary text-white'
                : 'bg-surface-hover text-text-secondary hover:text-text',
            )}
          >
            All Queues
          </button>
          {queues.map((queue) => (
            <button
              key={queue}
              type="button"
              onClick={() => { setQueueFilter(queue); setPage(1); }}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 font-mono text-xs font-medium transition-colors',
                queueFilter === queue
                  ? 'bg-primary text-white'
                  : 'bg-surface-hover text-text-secondary hover:text-text',
              )}
            >
              {queue}
            </button>
          ))}
        </div>
      )}

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
                  <th className="hidden md:table-cell px-4 py-3 font-semibold text-text-muted">Duration</th>
                  <th className="hidden md:table-cell px-4 py-3 font-semibold text-text-muted">Attempts</th>
                  <th className="px-4 py-3 font-semibold text-text-muted">Created</th>
                  <th className="px-4 py-3 font-semibold text-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <>
                    <tr
                      key={job.id}
                      className={cn(
                        'border-b border-border/50 transition-colors cursor-pointer',
                        expandedJobId === job.id
                          ? 'bg-surface-hover/60'
                          : 'hover:bg-surface-hover',
                        job.status === 'failed' && 'bg-error-bg/20',
                      )}
                      onClick={() =>
                        setExpandedJobId(expandedJobId === job.id ? null : job.id)
                      }
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-text">
                          {job.id.length > 12 ? `${job.id.slice(0, 12)}...` : job.id}
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
                      <td className="hidden md:table-cell px-4 py-3 text-xs text-text-secondary">
                        {formatDuration(job.duration)}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-xs text-text-secondary">
                        {job.attemptsMade}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {formatTimeAgo(job.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {job.status === 'failed' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => retryJob.mutate(job.id)}
                              loading={retryJob.isPending}
                              title="Retry this job"
                            >
                              <RotateCcw className="h-3.5 w-3.5 text-warning" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded job detail */}
                    {expandedJobId === job.id && (
                      <tr key={`detail-${job.id}`}>
                        <td colSpan={8} className="px-4 py-0">
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="rounded-lg bg-surface-hover/50 p-4 mb-2"
                          >
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                              <div>
                                <p className="text-xs font-medium text-text-muted">Full Job ID</p>
                                <p className="font-mono text-xs text-text break-all">{job.id}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-text-muted">Created</p>
                                <p className="text-xs text-text">
                                  {new Date(job.createdAt).toLocaleString()}
                                </p>
                              </div>
                              {job.processedAt && (
                                <div>
                                  <p className="text-xs font-medium text-text-muted">Started Processing</p>
                                  <p className="text-xs text-text">
                                    {new Date(job.processedAt).toLocaleString()}
                                  </p>
                                </div>
                              )}
                              {job.completedAt && (
                                <div>
                                  <p className="text-xs font-medium text-text-muted">Completed</p>
                                  <p className="text-xs text-text">
                                    {new Date(job.completedAt).toLocaleString()}
                                  </p>
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-medium text-text-muted">Duration</p>
                                <p className="text-xs text-text">{formatDuration(job.duration)}</p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-text-muted">Attempts</p>
                                <p className="text-xs text-text">{job.attemptsMade}</p>
                              </div>
                            </div>

                            {job.failedReason && (
                              <div className="mt-3 rounded-lg bg-error-bg p-3">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <AlertTriangle className="h-3.5 w-3.5 text-error" />
                                  <span className="text-xs font-semibold text-error">Error</span>
                                </div>
                                <p className="text-xs text-error font-mono whitespace-pre-wrap break-all">
                                  {job.failedReason}
                                </p>
                              </div>
                            )}

                            {Object.keys(job.data).length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-medium text-text-muted mb-1">Job Data</p>
                                <pre className="rounded-lg bg-surface p-3 text-xs text-text-secondary overflow-auto max-h-40 font-mono">
                                  {JSON.stringify(job.data, null, 2)}
                                </pre>
                              </div>
                            )}
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}

                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-text-muted">
                      No jobs found{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}
                      {queueFilter !== 'all' ? ` in queue "${queueFilter}"` : ''}.
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

      {/* Auto-refresh indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
        Auto-refreshing every 5 seconds
      </div>
    </motion.div>
  );
}
