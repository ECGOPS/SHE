import Dexie, { Table } from 'dexie';
import type { AuthUser } from '@ecg-she/shared';

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

interface CachedSession {
  id: 'current';
  user: AuthUser;
  provider: 'local' | 'entra';
  cachedAt: number;
}

export interface FormDraftRecord {
  id: string;
  formKey: string;
  userId: string;
  data: unknown;
  updatedAt: number;
}

class OfflineDB extends Dexie {
  queue!: Table<QueuedRequest, number>;
  draftIncidents!: Table<{ clientId: string; data: Record<string, unknown>; createdAt: number }, string>;
  sessionCache!: Table<CachedSession, string>;
  formDrafts!: Table<FormDraftRecord, string>;

  constructor() {
    super('ecg-she-offline');
    this.version(1).stores({
      queue: '++id, kind, createdAt',
      draftIncidents: 'clientId, createdAt',
    });
    this.version(2).stores({
      queue: '++id, kind, createdAt',
      draftIncidents: 'clientId, createdAt',
      sessionCache: 'id',
    });
    this.version(3).stores({
      queue: '++id, kind, createdAt',
      draftIncidents: 'clientId, createdAt',
      sessionCache: 'id',
      formDrafts: 'id, formKey, userId, updatedAt',
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

export function formDraftId(userId: string, formKey: string): string {
  return `${userId}:${formKey}`;
}

export const formDrafts = {
  async get<T>(userId: string, formKey: string): Promise<FormDraftRecord & { data: T } | undefined> {
    const row = await db.formDrafts.get(formDraftId(userId, formKey));
    return row as (FormDraftRecord & { data: T }) | undefined;
  },

  async save(userId: string, formKey: string, data: unknown): Promise<number> {
    const updatedAt = Date.now();
    await db.formDrafts.put({
      id: formDraftId(userId, formKey),
      formKey,
      userId,
      data,
      updatedAt,
    });
    return updatedAt;
  },

  async clear(userId: string, formKey: string): Promise<void> {
    await db.formDrafts.delete(formDraftId(userId, formKey));
  },
};

export const offlineSession = {
  async save(user: AuthUser, provider: 'local' | 'entra'): Promise<void> {
    await db.sessionCache.put({ id: 'current', user, provider, cachedAt: Date.now() });
  },

  async load(): Promise<CachedSession | undefined> {
    return db.sessionCache.get('current');
  },

  async clear(): Promise<void> {
    await db.sessionCache.delete('current');
  },
};

export { db };
