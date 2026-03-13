import { useState, useEffect, useCallback } from 'react';
import { getWizardSocket, getCurrentWizardSocket } from '@/lib/socket';
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
 * Track dossier generation progress via Socket.io on the /wizard namespace.
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

    let cancelled = false;
    let attachedSocket: import('socket.io-client').Socket | null = null;

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

    function attachListeners(socket: import('socket.io-client').Socket) {
      attachedSocket = socket;
      socket.emit(SOCKET_EVENTS.JOIN_JOB, jobId);

      socket.on(SOCKET_EVENTS.GENERATION_PROGRESS, onProgress);
      socket.on(SOCKET_EVENTS.GENERATION_COMPLETE, onComplete);
      socket.on(SOCKET_EVENTS.GENERATION_ERROR, onError);
      socket.on(SOCKET_EVENTS.AGENT_TOOL_COMPLETE, onProgress);
      socket.on(SOCKET_EVENTS.AGENT_COMPLETE, onComplete);
      socket.on(SOCKET_EVENTS.AGENT_TOOL_ERROR, onError);
    }

    function detachListeners(socket: import('socket.io-client').Socket) {
      socket.off(SOCKET_EVENTS.GENERATION_PROGRESS, onProgress);
      socket.off(SOCKET_EVENTS.GENERATION_COMPLETE, onComplete);
      socket.off(SOCKET_EVENTS.GENERATION_ERROR, onError);
      socket.off(SOCKET_EVENTS.AGENT_TOOL_COMPLETE, onProgress);
      socket.off(SOCKET_EVENTS.AGENT_COMPLETE, onComplete);
      socket.off(SOCKET_EVENTS.AGENT_TOOL_ERROR, onError);
      socket.emit(SOCKET_EVENTS.LEAVE_JOB, jobId);
    }

    setPhase('scraping');
    setMessage('Starting social analysis...');

    // Try sync first (fast path if wizard socket already connected)
    const existingSocket = getCurrentWizardSocket();
    if (existingSocket?.connected) {
      attachListeners(existingSocket);
    } else {
      // Async path: await wizard socket connection, then attach
      getWizardSocket()
        .then((socket) => {
          if (cancelled) return;
          attachListeners(socket);
        })
        .catch((err) => {
          console.error('[useDossier] Failed to connect wizard socket:', err);
          setPhase('error');
          setIsError(true);
          setError('Failed to connect to server');
        });
    }

    return () => {
      cancelled = true;
      if (attachedSocket) {
        detachListeners(attachedSocket);
      }
    };
  }, [jobId, reset]);

  return { dossier, phase, progress, message, isComplete, isError, error, reset };
}
