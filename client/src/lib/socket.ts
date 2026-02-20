import { io, type Socket } from 'socket.io-client';
import { supabase } from '@/lib/supabase';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

let socket: Socket | null = null;

/**
 * Returns a connected Socket.io client, creating one if needed.
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
    transports: ['websocket', 'polling'],
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
