import { api } from '../api/client';
import { offlineQueue } from './queue';

const ENDPOINTS: Record<string, string> = {
  incident: '/incidents/sync',
  hazard: '/hazards',
  'near-miss': '/near-miss',
  jsa: '/jsa',
  inspection: '/inspections',
  'capa-progress': '/corrective-actions',
};

/**
 * Replay queued mutations against the API. Items that succeed are removed.
 * Items that fail (HTTP 4xx/5xx other than 401) have their attempt counter incremented.
 *
 * Bulk endpoints — like `/incidents/sync` — accept an array under `items`,
 * which lets the server resolve duplicates atomically using `offlineClientId`.
 */
export async function flushOfflineQueue(): Promise<{ flushed: number; remaining: number }> {
  const items = await offlineQueue.pending();
  if (items.length === 0) return { flushed: 0, remaining: 0 };

  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    const list = grouped.get(item.kind) ?? [];
    list.push(item);
    grouped.set(item.kind, list);
  }

  let flushed = 0;
  for (const [kind, list] of grouped) {
    const endpoint = ENDPOINTS[kind];
    if (!endpoint) continue;
    try {
      if (kind === 'incident') {
        await api.post(endpoint, { items: list.map((i) => i.payload) });
      } else {
        for (const i of list) {
          await api.post(endpoint, i.payload);
        }
      }
      await Promise.all(list.map((i) => i.id && offlineQueue.remove(i.id)));
      flushed += list.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'sync failed';
      await Promise.all(list.map((i) => i.id && offlineQueue.incrementAttempt(i.id, msg)));
    }
  }
  const remaining = await offlineQueue.size();
  return { flushed, remaining };
}

/** Wire up automatic sync on `online` and on a 30-second heartbeat. */
export function bootstrapAutoSync(): void {
  const tryFlush = () => {
    if (navigator.onLine) flushOfflineQueue().catch(() => undefined);
  };
  window.addEventListener('online', tryFlush);
  setInterval(tryFlush, 30_000);
  tryFlush();
}
