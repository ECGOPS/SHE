import { api } from '../api/client';
import { belongsTo, offlineQueue, type QueuedRequest } from './queue';
import { notifyOfflineQueueChanged } from './sync-events';
import { useAuthStore } from '../stores/auth.store';

const ENDPOINTS: Record<QueuedRequest['kind'], string> = {
  incident: '/incidents',
  hazard: '/hazards',
  'near-miss': '/near-miss',
  jsa: '/jsa',
  inspection: '/inspections',
  'capa-progress': '/corrective-actions',
};

function axiosStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

function axiosMessage(err: unknown): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string' && message.trim()) return message;
  return err instanceof Error ? err.message : 'sync failed';
}

/** The server looked at it and said no; sending it again unchanged won't help. */
function refused(status: number | undefined): boolean {
  return status !== undefined && status >= 400 && status < 500 && ![401, 408, 429].includes(status);
}

async function replayOne(item: QueuedRequest): Promise<'flushed' | 'retry' | 'auth'> {
  if (!item.id) return 'retry';
  const endpoint = ENDPOINTS[item.kind];
  if (!endpoint) {
    await offlineQueue.incrementAttempt(item.id, `Cannot sync ${item.kind} reports yet.`);
    return 'retry';
  }
  try {
    await api.post(endpoint, item.payload);
    await offlineQueue.remove(item.id);
    return 'flushed';
  } catch (err) {
    const status = axiosStatus(err);
    if (status === 401) return 'auth';
    if (refused(status)) {
      await offlineQueue.markRejected(item.id, axiosMessage(err));
      return 'retry';
    }
    // No connection or a server fault: try again on the next pass.
    await offlineQueue.incrementAttempt(item.id, axiosMessage(err));
    return 'retry';
  }
}

let flushing: Promise<{ flushed: number; remaining: number }> | null = null;

/**
 * Send the signed-in person's queued reports. Sent ones are removed; ones
 * that couldn't reach the server stay for the next pass; ones the server
 * refused stay with the reason until someone retries or discards them.
 */
export function flushOfflineQueue(): Promise<{ flushed: number; remaining: number }> {
  // One pass at a time: the 30 s timer, sign-in and reconnect can all fire together.
  flushing ??= flushOnce().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function flushOnce(): Promise<{ flushed: number; remaining: number }> {
  // Nobody signed in (e.g. the login screen): nothing can be sent yet.
  const userId = useAuthStore.getState().session?.user.id;
  if (!userId) return { flushed: 0, remaining: await offlineQueue.size() };

  const items = (await offlineQueue.pending()).filter((item) => belongsTo(item, userId) && !item.rejected);
  if (items.length === 0) return { flushed: 0, remaining: await offlineQueue.size() };

  let flushed = 0;
  for (const item of items) {
    const result = await replayOne(item);
    if (result === 'flushed') flushed += 1;
    if (result === 'auth') break;
  }
  const remaining = await offlineQueue.size();
  // Lists refresh when something was sent; the banner updates either way.
  notifyOfflineQueueChanged({ sent: flushed });
  return { flushed, remaining };
}

let autoSyncStarted = false;

function registerBackgroundSync(): void {
  const ready = navigator.serviceWorker?.ready;
  if (!ready) return;
  void ready.then((reg) => {
    const sync = (reg as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }).sync;
    return sync?.register('ecg-she-sync');
  }).catch(() => undefined);
}

/** Wire up automatic sync on `online` and on a 30-second heartbeat. */
export function bootstrapAutoSync(): void {
  if (autoSyncStarted) {
    if (navigator.onLine) void flushOfflineQueue();
    return;
  }
  autoSyncStarted = true;

  const tryFlush = () => {
    if (navigator.onLine) void flushOfflineQueue().catch(() => undefined);
  };
  window.addEventListener('online', tryFlush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tryFlush();
  });
  navigator.serviceWorker?.addEventListener('message', (event: MessageEvent<{ type?: string }>) => {
    if (event.data?.type === 'flush-offline-queue') tryFlush();
  });
  registerBackgroundSync();
  setInterval(tryFlush, 30_000);
  tryFlush();
}
