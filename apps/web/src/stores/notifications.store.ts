import { create } from 'zustand';
import { api, unwrap } from '../api/client';

/**
 * Inbox notification — mirrors the backend `Notification` entity. Persists in
 * the database; we cache them client-side so the bell menu pops instantly.
 */
export interface InboxNotification {
  id: string;
  topic?: string | null;
  title: string;
  body: string;
  payload?: Record<string, unknown> | null;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  read: boolean;
  createdAt: string;
}

interface NotificationsState {
  items: InboxNotification[];
  unread: number;
  /** Most recent realtime notification — consumed by the snackbar toast. */
  toast: InboxNotification | null;
  loading: boolean;
  fetched: boolean;

  fetch: () => Promise<void>;
  pushFromRealtime: (n: InboxNotification) => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearToast: () => void;
  reset: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  unread: 0,
  toast: null,
  loading: false,
  fetched: false,

  /** Pull the inbox + unread count from the API. */
  async fetch() {
    if (get().loading) return;
    set({ loading: true });
    try {
      const [items, unread] = await Promise.all([
        unwrap<InboxNotification[]>(api.get('/notifications')),
        unwrap<{ count: number }>(api.get('/notifications/unread-count')).then((r) => r.count),
      ]);
      set({ items, unread, fetched: true, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  /**
   * Called from the websocket handler. Prepends, bumps the unread badge and
   * arms the snackbar toast.
   */
  pushFromRealtime(n) {
    set((s) => {
      // De-dup against an existing id (e.g. if the user is in two tabs and
      // the backend emits the same row twice).
      if (s.items.some((x) => x.id === n.id)) return s;
      const next: InboxNotification = { ...n, read: false };
      return {
        items: [next, ...s.items].slice(0, 100),
        unread: s.unread + 1,
        toast: next,
      };
    });
  },

  async markRead(id) {
    const target = get().items.find((n) => n.id === id);
    if (!target || target.read) return;
    // Optimistic — flip locally first, then sync.
    set((s) => ({
      items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
      unread: Math.max(0, s.unread - 1),
    }));
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      // On failure, refetch to get back in sync.
      void get().fetch();
    }
  },

  async markAllRead() {
    const ids = get()
      .items.filter((n) => !n.read)
      .map((n) => n.id);
    if (!ids.length) return;
    set((s) => ({
      items: s.items.map((n) => ({ ...n, read: true })),
      unread: 0,
    }));
    await Promise.allSettled(ids.map((id) => api.patch(`/notifications/${id}/read`)));
  },

  clearToast() {
    set({ toast: null });
  },

  reset() {
    set({ items: [], unread: 0, toast: null, fetched: false });
  },
}));
