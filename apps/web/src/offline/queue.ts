import Dexie, { Table } from 'dexie';
import type { AuthUser } from '@ecg-she/shared';
import { notifyOfflineQueueChanged } from './sync-events';

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
  /** Who saved it. It is only ever sent while this person is signed in. */
  userId?: string;
  /** The server refused it (e.g. not allowed, invalid). Not retried until someone chooses Retry. */
  rejected?: boolean;
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

/**
 * Whether the signed-in person may send this report. Reports remember who
 * saved them, so on a shared phone nobody else's report is filed under your
 * name. Reports saved before that existed (no userId) go with whoever is
 * signed in, as they always did.
 */
export function belongsTo(item: Pick<QueuedRequest, 'userId'>, userId: string | undefined): boolean {
  return !!userId && (!item.userId || item.userId === userId);
}

/** The signed-in person, kept up to date by the app shell; stamped on each queued report. */
let currentUserId: string | undefined;
export function setQueueUser(userId: string | undefined): void {
  currentUserId = userId;
}

export const offlineQueue = {
  async enqueue(req: Omit<QueuedRequest, 'id' | 'createdAt' | 'attempts' | 'userId' | 'rejected'>): Promise<number> {
    const id = await db.queue.add({ ...req, userId: currentUserId, createdAt: Date.now(), attempts: 0 });
    notifyOfflineQueueChanged(); // the banner shows the new count straight away
    return id;
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

  /** The server refused it; keep it (with the reason) but stop retrying it automatically. */
  async markRejected(id: number, error: string): Promise<void> {
    const item = await db.queue.get(id);
    if (item) await db.queue.put({ ...item, attempts: item.attempts + 1, lastError: error, rejected: true });
  },

  /** Put a refused report back in line to send. */
  async allowRetry(id: number): Promise<void> {
    const item = await db.queue.get(id);
    if (item) await db.queue.put({ ...item, rejected: false });
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
