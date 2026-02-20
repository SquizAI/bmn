import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentSocket } from '@/lib/socket';
import { SOCKET_EVENTS } from '@/lib/constants';

type GenerationStatus = 'idle' | 'pending' | 'processing' | 'complete' | 'error';

interface ProgressEvent {
  progress?: number;
  status?: string;
  message?: string;
}

interface CompleteEvent {
  result?: unknown;
}

interface ErrorEvent {
  error?: string;
}

interface GenerationProgress {
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
      setProgress(data.progress || 0);
      setStatus((data.status as GenerationStatus) || 'processing');
      setMessage(data.message || '');
    };

    const onComplete = (data: CompleteEvent) => {
      setProgress(100);
      setStatus('complete');
      setMessage('Complete!');
      setIsComplete(true);
      setResult(data.result || data);
    };

    const onError = (data: ErrorEvent) => {
      setStatus('error');
      setIsError(true);
      setError(data.error || 'An error occurred');
      setMessage(data.error || 'Generation failed');
    };

    socket.on(SOCKET_EVENTS.GENERATION_PROGRESS, onProgress);
    socket.on(SOCKET_EVENTS.GENERATION_COMPLETE, onComplete);
    socket.on(SOCKET_EVENTS.GENERATION_ERROR, onError);
    socket.on(SOCKET_EVENTS.AGENT_TOOL_COMPLETE, onProgress);
    socket.on(SOCKET_EVENTS.AGENT_COMPLETE, onComplete);
    socket.on(SOCKET_EVENTS.AGENT_TOOL_ERROR, onError);

    return () => {
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
