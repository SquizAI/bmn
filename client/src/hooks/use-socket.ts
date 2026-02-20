import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Manages the Socket.io connection lifecycle.
 * Connects when the user is authenticated, disconnects when they log out.
 */
export function useSocket() {
  const user = useAuthStore((s) => s.user);
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      disconnectSocket();
      setIsConnected(false);
      socketRef.current = null;
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const sock = await getSocket();
        if (cancelled) return;
        socketRef.current = sock;

        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);

        sock.on('connect', onConnect);
        sock.on('disconnect', onDisconnect);
        setIsConnected(sock.connected);
      } catch (err) {
        console.error('[useSocket] Failed to connect:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { isConnected, socket: socketRef.current };
}
