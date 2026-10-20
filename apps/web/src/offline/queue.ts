import Dexie, { Table } from 'dexie';

/**
 * Offline-first persistence layer backed by IndexedDB (Dexie).
 *
 * Each pending change is stored as a `QueuedRequest`. When the browser
 * reports `online`, `flush()` re-plays them in FIFO order against the API.
 * Any payload may include `offlineClientId` for server-side de-duplication.
 */

export interface QueuedRequest {
  id?: number;
  kind: 'incident' | 'hazard' | 'near-miss' | 'inspection' | 'capa-progress' | 'jsa';
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

class OfflineDB extends Dexie {
  queue!: Table<QueuedRequest, number>;
  draftIncidents!: Table<{ clientId: string; data: Record<string, unknown>; createdAt: number }, string>;

  constructor() {
    super('ecg-she-offline');
    this.version(1).stores({
      queue: '++id, kind, createdAt',
      draftIncidents: 'clientId, createdAt',
    });
  }
}

const db = new OfflineDB();

export const offlineQueue = {
  async enqueue(req: Omit<QueuedRequest, 'id' | 'createdAt' | 'attempts'>): Promise<number> {
    return db.queue.add({ ...req, createdAt: Date.now(), attempts: 0 });
  },

  async pending(): Promise<QueuedRequest[]> {
    return db.queue.orderBy('createdAt').toArray();
  },

  async size(): Promise<number> {
    return db.queue.count();
  },

  async remove(id: number): Promise<void> {
    await db.queue.delete(id);
  },

  async incrementAttempt(id: number, error: string): Promise<void> {
    const item = await db.queue.get(id);
    if (item) await db.queue.put({ ...item, attempts: item.attempts + 1, lastError: error });
  },
};

export { db };
