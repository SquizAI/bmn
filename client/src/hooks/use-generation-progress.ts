import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentSocket } from '@/lib/socket';
import { SOCKET_EVENTS } from '@/lib/constants';

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

/**
 * Track real-time generation progress for a given job via Socket.io.
 *
 * Listens for multiple event types:
 * - `job:progress` / `job:complete` / `job:failed` (emitted by BullMQ workers)
 * - `generation:*` events (generic generation tracking)
 * - `agent:*` events (Agent SDK streaming)
 */
export function useGenerationProgress(jobId: string | null): GenerationProgress {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [message, setMessage] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isError, setIsError] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const joinedRoom = useRef<string | null>(null);

  const reset = useCallback(() => {
    setProgress(0);
    setStatus('idle');
    setMessage('');
    setIsComplete(false);
    setIsError(false);
    setResult(null);
    setError(null);
    joinedRoom.current = null;
  }, []);

  useEffect(() => {
    if (!jobId) {
      reset();
      return;
    }

    const socket = getCurrentSocket();
    if (!socket) return;

    const room = `job:${jobId}`;
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, room);
    joinedRoom.current = room;
    setStatus('pending');
    setMessage('Starting...');

    const onProgress = (data: ProgressEvent) => {
      // Filter to only our job if jobId is present in the event
      if (data.jobId && data.jobId !== jobId) return;
      setProgress(data.progress || 0);
      const mappedStatus = data.status === 'started' || data.status === 'processing'
        ? 'processing'
        : (data.status as GenerationStatus) || 'processing';
      setStatus(mappedStatus);
      setMessage(data.message || '');
    };

    const onComplete = (data: CompleteEvent) => {
      if (data.jobId && data.jobId !== jobId) return;
      setProgress(100);
      setStatus('complete');
      setMessage('Complete!');
      setIsComplete(true);
      setResult(data.result || data);
    };

    const onError = (data: ErrorEvent) => {
      if (data.jobId && data.jobId !== jobId) return;
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
      if (joinedRoom.current) {
        socket.emit(SOCKET_EVENTS.LEAVE_ROOM, joinedRoom.current);
        joinedRoom.current = null;
      }
    };
  }, [jobId, reset]);

  return { progress, status, message, isComplete, isError, result, error, reset };
}
