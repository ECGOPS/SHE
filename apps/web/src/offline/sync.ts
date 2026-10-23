import { api } from '../api/client';
import { offlineQueue, type QueuedRequest } from './queue';
import { notifyOfflineQueueChanged } from './sync-events';

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
    await offlineQueue.incrementAttempt(item.id, axiosMessage(err));
    return 'retry';
  }
}

/**
 * Replay queued mutations against the API. Items that succeed are removed.
 * Failed items stay on the device so a later reconnect can retry them.
 */
export async function flushOfflineQueue(): Promise<{ flushed: number; remaining: number }> {
  const items = await offlineQueue.pending();
  if (items.length === 0) return { flushed: 0, remaining: 0 };

  let flushed = 0;
  for (const item of items) {
    const result = await replayOne(item);
    if (result === 'flushed') flushed += 1;
    if (result === 'auth') break;
  }
  const remaining = await offlineQueue.size();
  notifyOfflineQueueChanged();
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
