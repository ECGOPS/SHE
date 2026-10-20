import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth.store';
import { useNotificationsStore, InboxNotification } from '../stores/notifications.store';
import { sameMachineUrl } from '../api/dev-host';

const WS_URL = sameMachineUrl(import.meta.env.VITE_WS_URL ?? 'http://localhost:4000');

let socket: Socket | null = null;

/**
 * Live channel:
 *   1. Re-fetches affected queries when the server pushes domain events
 *      (incidents, hazards, CAPAs) — keeps lists / KPIs current without a
 *      polling loop.
 *   2. Receives per-user `notification:new` events and forwards them to the
 *      notifications store so the bell badge & snackbar update instantly.
 *   3. Pulls the inbox once on connect so notifications missed while offline
 *      still show up the next time the SPA opens.
 */
export function useRealtime() {
  const session = useAuthStore((s) => s.session);
  const queryClient = useQueryClient();
  const fetchInbox = useNotificationsStore((s) => s.fetch);
  const pushFromRealtime = useNotificationsStore((s) => s.pushFromRealtime);
  const resetInbox = useNotificationsStore((s) => s.reset);

  useEffect(() => {
    if (!session) {
      socket?.disconnect();
      socket = null;
      resetInbox();
      return;
    }

    void fetchInbox();

    socket = io(`${WS_URL}/ws`, {
      transports: ['websocket'],
      auth: { token: session.tokens.accessToken },
    });

    socket.on('incident:created', () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
    });
    socket.on('incident:pending-approval', () =>
      queryClient.invalidateQueries({ queryKey: ['incidents'] }),
    );
    socket.on('hazard:high-risk', () => {
      queryClient.invalidateQueries({ queryKey: ['hazards'] });
      queryClient.invalidateQueries({ queryKey: ['hazard-stats'] });
    });
    socket.on('capa:overdue', () => {
      queryClient.invalidateQueries({ queryKey: ['capa'] });
      queryClient.invalidateQueries({ queryKey: ['capa-stats'] });
    });

    socket.on('notification:new', (n: InboxNotification) => {
      pushFromRealtime(n);
    });

    return () => {
      socket?.disconnect();
      socket = null;
    };
  }, [session, queryClient, fetchInbox, pushFromRealtime, resetInbox]);
}
