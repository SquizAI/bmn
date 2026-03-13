import { io, type Socket } from 'socket.io-client';
import { supabase } from '@/lib/supabase';

const SOCKET_URL =
  import.meta.env.VITE_WS_URL ||
  import.meta.env.VITE_API_URL ||
  '';

let socket: Socket | null = null;

/**
 * Returns a connected Socket.io client (default namespace), creating one if needed.
 * Authenticates using the current Supabase session JWT.
 */
export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Cannot connect socket: not authenticated');

  socket = io(SOCKET_URL, {
    path: '/socket.io',
    auth: { token: session.access_token },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    if (import.meta.env.DEV) {
      console.log('[Socket] Connected:', socket?.id);
    }
  });

  socket.on('disconnect', (reason) => {
    if (import.meta.env.DEV) {
      console.warn('[Socket] Disconnected:', reason);
    }
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
  });

  // Keep socket auth token in sync with Supabase session refreshes
  supabase.auth.onAuthStateChange((_event, session) => {
    if (socket && session?.access_token) {
      socket.auth = { token: session.access_token };
    }
  });

  return socket;
}

/**
 * Disconnect and clean up the socket connection.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Returns the current socket instance (may be null if not connected).
 */
export function getCurrentSocket(): Socket | null {
  return socket;
}

// ==========================================================================
// Wizard namespace (/wizard) — used by all generation workers
// ==========================================================================

let wizardSocket: Socket | null = null;

/**
 * Returns a connected Socket.io client on the /wizard namespace, creating one if needed.
 * Uses the same Supabase JWT auth as the default socket.
 *
 * Server workers emit all generation events (job:progress, job:complete, job:failed,
 * generation:*, agent:*) to the /wizard namespace, so wizard-flow hooks MUST use this.
 */
export async function getWizardSocket(): Promise<Socket> {
  if (wizardSocket?.connected) return wizardSocket;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Cannot connect wizard socket: not authenticated');

  wizardSocket = io(`${SOCKET_URL}/wizard`, {
    path: '/socket.io',
    auth: { token: session.access_token },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    timeout: 10000,
  });

  wizardSocket.on('connect', () => {
    if (import.meta.env.DEV) {
      console.log('[Socket/wizard] Connected:', wizardSocket?.id);
    }
  });

  wizardSocket.on('disconnect', (reason) => {
    if (import.meta.env.DEV) {
      console.warn('[Socket/wizard] Disconnected:', reason);
    }
  });

  wizardSocket.on('connect_error', (err) => {
    console.error('[Socket/wizard] Connection error:', err.message);
  });

  // Keep wizard socket auth token in sync with Supabase session refreshes
  supabase.auth.onAuthStateChange((_event, session) => {
    if (wizardSocket && session?.access_token) {
      wizardSocket.auth = { token: session.access_token };
    }
  });

  return wizardSocket;
}

/**
 * Returns the current wizard namespace socket instance (may be null if not connected).
 */
export function getCurrentWizardSocket(): Socket | null {
  return wizardSocket;
}

/**
 * Disconnect and clean up the wizard namespace socket.
 */
export function disconnectWizardSocket(): void {
  if (wizardSocket) {
    wizardSocket.disconnect();
    wizardSocket = null;
  }
}
