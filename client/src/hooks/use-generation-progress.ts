import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCurrentSocket } from '@/lib/socket';
import { apiClient } from '@/lib/api';
import { SOCKET_EVENTS, QUERY_KEYS } from '@/lib/constants';

type GenerationStatus = 'idle' | 'pending' | 'processing' | 'complete' | 'error';

interface ProgressEvent {
  jobId?: string;
  progress?: number;
  status?: string;
  message?: string;
}

interface CompleteEvent {
  jobId?: string;
  result?: unknown;
}

interface ErrorEvent {
  jobId?: string;
  error?: string;
  retriesLeft?: number;
}

interface JobStatusResponse {
  status: 'active' | 'waiting' | 'completed' | 'failed' | 'delayed';
  progress: number;
  result: unknown;
  error: string | null;
  queue: string;
}

export interface GenerationProgress {
  progress: number;
  status: GenerationStatus;
  message: string;
  isComplete: boolean;
  isError: boolean;
  result: unknown;
  error: string | null;
  reset: () => void;
}

/** How long (ms) without a Socket.io event before activating the polling fallback. */
const SOCKET_SILENCE_THRESHOLD = 10_000;

/** Polling interval (ms) for the HTTP fallback. */
const POLL_INTERVAL = 5_000;

/**
 * Track real-time generation progress for a given job via Socket.io,
 * with an HTTP polling fallback for missed events.
 *
 * Primary channel: Socket.io events
 * - `job:progress` / `job:complete` / `job:failed` (emitted by BullMQ workers)
 * - `generation:*` events (generic generation tracking)
 * - `agent:*` events (Agent SDK streaming)
 *
 * Fallback channel: GET /api/v1/jobs/:jobId/status (polled every 5s)
 * Activated when:
 * - Socket.io is disconnected, OR
 * - No Socket.io events received for 10+ seconds
 *
 * Automatically deactivated when Socket.io events resume.
 */
export function useGenerationProgress(jobId: string | null): GenerationProgress {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [message, setMessage] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isError, setIsError] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  // Track whether polling should be active
  const [shouldPoll, setShouldPoll] = useState(false);

  // Timestamp of last Socket.io event for this job
  const lastSocketEventRef = useRef<number>(0);

  // Whether the job has reached a terminal state (complete or error)
  const isTerminalRef = useRef(false);

  const reset = useCallback(() => {
    setProgress(0);
    setStatus('idle');
    setMessage('');
    setIsComplete(false);
    setIsError(false);
    setResult(null);
    setError(null);
    setShouldPoll(false);
    lastSocketEventRef.current = 0;
    isTerminalRef.current = false;
  }, []);

  // ------------------------------------------------------------------
  // Socket.io listener effect (primary channel)
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!jobId) {
      reset();
      return;
    }

    const socket = getCurrentSocket();
    if (!socket) return;

    socket.emit(SOCKET_EVENTS.JOIN_JOB, jobId);
    setStatus('pending');
    setMessage('Starting...');
    lastSocketEventRef.current = Date.now();

    const markSocketActivity = () => {
      lastSocketEventRef.current = Date.now();
      // Socket is delivering events -- disable polling fallback
      setShouldPoll(false);
    };

    const onProgress = (data: ProgressEvent) => {
      if (data.jobId && data.jobId !== jobId) return;
      markSocketActivity();
      setProgress(data.progress || 0);
      const mappedStatus = data.status === 'started' || data.status === 'processing'
        ? 'processing'
        : (data.status as GenerationStatus) || 'processing';
      setStatus(mappedStatus);
      setMessage(data.message || '');
    };

    const onComplete = (data: CompleteEvent) => {
      if (data.jobId && data.jobId !== jobId) return;
      markSocketActivity();
      isTerminalRef.current = true;
      setProgress(100);
      setStatus('complete');
      setMessage('Complete!');
      setIsComplete(true);
      setResult(data.result || data);
    };

    const onError = (data: ErrorEvent) => {
      if (data.jobId && data.jobId !== jobId) return;
      markSocketActivity();
      isTerminalRef.current = true;
      setStatus('error');
      setIsError(true);
      setError(data.error || 'An error occurred');
      setMessage(data.error || 'Generation failed');
    };

    // BullMQ worker events (primary -- what brand-wizard worker emits)
    socket.on(SOCKET_EVENTS.JOB_PROGRESS, onProgress);
    socket.on(SOCKET_EVENTS.JOB_COMPLETE, onComplete);
    socket.on(SOCKET_EVENTS.JOB_FAILED, onError);

    // Generic generation events (alternate pipeline)
    socket.on(SOCKET_EVENTS.GENERATION_PROGRESS, onProgress);
    socket.on(SOCKET_EVENTS.GENERATION_COMPLETE, onComplete);
    socket.on(SOCKET_EVENTS.GENERATION_ERROR, onError);

    // Agent SDK events
    socket.on(SOCKET_EVENTS.AGENT_TOOL_COMPLETE, onProgress);
    socket.on(SOCKET_EVENTS.AGENT_COMPLETE, onComplete);
    socket.on(SOCKET_EVENTS.AGENT_TOOL_ERROR, onError);

    return () => {
      socket.off(SOCKET_EVENTS.JOB_PROGRESS, onProgress);
      socket.off(SOCKET_EVENTS.JOB_COMPLETE, onComplete);
      socket.off(SOCKET_EVENTS.JOB_FAILED, onError);
      socket.off(SOCKET_EVENTS.GENERATION_PROGRESS, onProgress);
      socket.off(SOCKET_EVENTS.GENERATION_COMPLETE, onComplete);
      socket.off(SOCKET_EVENTS.GENERATION_ERROR, onError);
      socket.off(SOCKET_EVENTS.AGENT_TOOL_COMPLETE, onProgress);
      socket.off(SOCKET_EVENTS.AGENT_COMPLETE, onComplete);
      socket.off(SOCKET_EVENTS.AGENT_TOOL_ERROR, onError);
      socket.emit(SOCKET_EVENTS.LEAVE_JOB, jobId);
    };
  }, [jobId, reset]);

  // ------------------------------------------------------------------
  // Silence detection: activate polling when Socket.io goes quiet
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!jobId || isTerminalRef.current) return;

    const interval = setInterval(() => {
      // If the job already finished, stop checking
      if (isTerminalRef.current) {
        setShouldPoll(false);
        return;
      }

      const socket = getCurrentSocket();
      const socketDisconnected = !socket || !socket.connected;
      const silenceDuration = Date.now() - lastSocketEventRef.current;
      const isSilent = silenceDuration > SOCKET_SILENCE_THRESHOLD;

      setShouldPoll(socketDisconnected || isSilent);
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [jobId]);

  // ------------------------------------------------------------------
  // HTTP polling fallback (TanStack Query)
  // ------------------------------------------------------------------
  useQuery<JobStatusResponse>({
    queryKey: QUERY_KEYS.jobStatus(jobId ?? ''),
    queryFn: () => apiClient.get<JobStatusResponse>(`/api/v1/jobs/${jobId}/status`),
    enabled: Boolean(jobId) && shouldPoll && !isTerminalRef.current,
    refetchInterval: POLL_INTERVAL,
    refetchIntervalInBackground: false,
    // Avoid stale cache interfering with fresh polls
    gcTime: 0,
    staleTime: 0,
    select: (data) => {
      // Apply polled status to the same state Socket.io events would update.
      // This runs inside the render cycle via `select`, so we schedule
      // state updates via a microtask to avoid setting state during render.
      queueMicrotask(() => applyPolledStatus(data));
      return data;
    },
  });

  /**
   * Map a polled job status response into the same React state that
   * Socket.io event handlers would set.
   */
  const applyPolledStatus = useCallback((data: JobStatusResponse) => {
    if (!data || isTerminalRef.current) return;

    if (data.status === 'completed') {
      isTerminalRef.current = true;
      setProgress(100);
      setStatus('complete');
      setMessage('Complete!');
      setIsComplete(true);
      setResult(data.result);
      setShouldPoll(false);
    } else if (data.status === 'failed') {
      isTerminalRef.current = true;
      setStatus('error');
      setIsError(true);
      setError(data.error || 'An error occurred');
      setMessage(data.error || 'Generation failed');
      setShouldPoll(false);
    } else if (data.status === 'active') {
      setProgress(data.progress || 0);
      setStatus('processing');
      setMessage('Processing...');
    } else if (data.status === 'waiting' || data.status === 'delayed') {
      setStatus('pending');
      setMessage('Waiting to start...');
    }
  }, []);

  return { progress, status, message, isComplete, isError, result, error, reset };
}
