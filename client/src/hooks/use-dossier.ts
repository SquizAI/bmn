import { useState, useEffect, useCallback } from 'react';
import { getCurrentSocket } from '@/lib/socket';
import { SOCKET_EVENTS } from '@/lib/constants';
import type {
  CreatorDossier,
  DossierPhase,
  DossierProgressEvent,
} from '@/lib/dossier-types';

interface UseDossierReturn {
  dossier: Partial<CreatorDossier> | null;
  phase: DossierPhase;
  progress: number;
  message: string;
  isComplete: boolean;
  isError: boolean;
  error: string | null;
  reset: () => void;
}

/**
 * Track dossier generation progress via Socket.io.
 * Receives phased updates as the social analyzer processes data,
 * accumulating partial dossier data as each phase completes.
 */
export function useDossier(jobId: string | null): UseDossierReturn {
  const [dossier, setDossier] = useState<Partial<CreatorDossier> | null>(null);
  const [phase, setPhase] = useState<DossierPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setDossier(null);
    setPhase('idle');
    setProgress(0);
    setMessage('');
    setIsComplete(false);
    setIsError(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!jobId) {
      reset();
      return;
    }

    const socket = getCurrentSocket();
    if (!socket) return;

    socket.emit(SOCKET_EVENTS.JOIN_JOB, jobId);
    setPhase('scraping');
    setMessage('Starting social analysis...');

    const onProgress = (data: DossierProgressEvent | Record<string, unknown>) => {
      const progressData = data as DossierProgressEvent;
      if (progressData.phase) {
        setPhase(progressData.phase);
      }
      if (typeof progressData.progress === 'number') {
        setProgress(progressData.progress);
      }
      if (progressData.message) {
        setMessage(progressData.message);
      }
      if (progressData.data) {
        setDossier((prev) => ({ ...prev, ...progressData.data }));
      }
    };

    const onComplete = (data: { result?: unknown }) => {
      setProgress(100);
      setPhase('complete');
      setMessage('Dossier complete!');
      setIsComplete(true);
      if (data.result && typeof data.result === 'object') {
        setDossier((prev) => ({ ...prev, ...(data.result as Partial<CreatorDossier>) }));
      }
    };

    const onError = (data: { error?: string }) => {
      setPhase('error');
      setIsError(true);
      setError(data.error || 'Analysis failed');
      setMessage(data.error || 'Analysis failed');
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
      socket.emit(SOCKET_EVENTS.LEAVE_JOB, jobId);
    };
  }, [jobId, reset]);

  return { dossier, phase, progress, message, isComplete, isError, error, reset };
}
