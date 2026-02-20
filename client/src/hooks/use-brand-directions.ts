import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentSocket } from '@/lib/socket';
import { SOCKET_EVENTS } from '@/lib/constants';
import type { BrandDirection, BrandDirectionsResult } from './use-brand-generation';

// ── Progress phase types ─────────────────────────────────────────

export type BrandGenPhase =
  | 'idle'
  | 'queued'
  | 'analyzing'
  | 'generating'
  | 'complete'
  | 'error';

interface ProgressEvent {
  phase?: BrandGenPhase;
  progress?: number;
  message?: string;
  data?: Partial<BrandDirectionsResult>;
}

interface UseBrandDirectionsReturn {
  directions: BrandDirection[];
  socialContext: string | null;
  phase: BrandGenPhase;
  progress: number;
  message: string;
  isComplete: boolean;
  isError: boolean;
  error: string | null;
  reset: () => void;
}

/**
 * Track brand identity direction generation progress via Socket.io.
 * Receives phased updates as the brand-generator skill processes data,
 * accumulating directions as they are generated.
 *
 * Follows the same pattern as useDossier for consistency.
 */
export function useBrandDirections(jobId: string | null): UseBrandDirectionsReturn {
  const [directions, setDirections] = useState<BrandDirection[]>([]);
  const [socialContext, setSocialContext] = useState<string | null>(null);
  const [phase, setPhase] = useState<BrandGenPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const joinedRoom = useRef<string | null>(null);

  const reset = useCallback(() => {
    setDirections([]);
    setSocialContext(null);
    setPhase('idle');
    setProgress(0);
    setMessage('');
    setIsComplete(false);
    setIsError(false);
    setError(null);
    joinedRoom.current = null;
  }, []);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    const socket = getCurrentSocket();
    if (!socket) return;

    const room = `job:${jobId}`;
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, room);
    joinedRoom.current = room;
    setPhase('queued');
    setMessage('Generating brand directions...');

    const onProgress = (data: ProgressEvent | Record<string, unknown>) => {
      const progressData = data as ProgressEvent;
      if (progressData.phase) {
        setPhase(progressData.phase);
      }
      if (typeof progressData.progress === 'number') {
        setProgress(progressData.progress);
      }
      if (progressData.message) {
        setMessage(progressData.message);
      }
      if (progressData.data?.directions) {
        setDirections(progressData.data.directions);
      }
      if (progressData.data?.socialContext) {
        setSocialContext(progressData.data.socialContext);
      }
    };

    const onComplete = (data: { result?: unknown }) => {
      setProgress(100);
      setPhase('complete');
      setMessage('Brand directions ready!');
      setIsComplete(true);

      if (data.result && typeof data.result === 'object') {
        const result = data.result as Partial<BrandDirectionsResult>;
        if (result.directions && result.directions.length > 0) {
          setDirections(result.directions);
        }
        if (result.socialContext) {
          setSocialContext(result.socialContext);
        }
      }
    };

    const onError = (data: { error?: string }) => {
      setPhase('error');
      setIsError(true);
      setError(data.error || 'Brand generation failed');
      setMessage(data.error || 'Brand generation failed');
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
  }, [jobId]);

  return { directions, socialContext, phase, progress, message, isComplete, isError, error, reset };
}
