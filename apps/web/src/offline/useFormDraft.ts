import { useCallback, useEffect, useRef, useState } from 'react';
import { jsonSafeClone, mergeDraftPreserve } from './draft-merge';
import { formDrafts } from './queue';

const SAVE_WAIT_MS = 400;

function snapshot(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}

/**
 * Keeps a create-form on this phone so a closed tab, a locked screen, or a
 * dead battery does not wipe the answers. Restores the last draft on open.
 */
export function useFormDraft<T>(options: {
  formKey: string;
  userId?: string;
  value: T;
  restore: (data: T) => void;
  enabled?: boolean;
}): {
  ready: boolean;
  hasDraft: boolean;
  restoredAt: number | null;
  savedAt: number | null;
  discard: () => Promise<void>;
  clear: () => Promise<void>;
} {
  const { formKey, userId, value, restore, enabled = true } = options;
  const [ready, setReady] = useState(false);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;
  const valueRef = useRef(value);
  valueRef.current = value;
  const hydratedRef = useRef(false);
  const lastJsonRef = useRef('');
  const lastDataRef = useRef<T | undefined>(undefined);
  const pausedRef = useRef(false);
  const armPauseRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const persist = useCallback(async (next: T, force = false) => {
    if (!userId || !enabled || !hydratedRef.current) return;
    if (pausedRef.current) return;
    const merged = jsonSafeClone(mergeDraftPreserve(lastDataRef.current, next));
    const json = snapshot(merged);
    if (!force && json === lastJsonRef.current) return;
    try {
      const updatedAt = await formDrafts.save(userId, formKey, merged);
      lastJsonRef.current = json;
      lastDataRef.current = merged;
      pausedRef.current = false;
      setSavedAt(updatedAt);
    } catch {
      // Quota or a private-mode block — keep typing; the next save can retry.
    }
  }, [enabled, formKey, userId]);

  const clear = useCallback(async () => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    pausedRef.current = true;
    armPauseRef.current = true;
    lastDataRef.current = undefined;
    lastJsonRef.current = '';
    if (userId) await formDrafts.clear(userId, formKey);
    setRestoredAt(null);
    setSavedAt(null);
  }, [formKey, userId]);

  useEffect(() => {
    hydratedRef.current = false;
    setReady(false);
    if (!userId || !enabled) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void formDrafts.get<T>(userId, formKey).then((row) => {
      if (cancelled) return;
      if (row) {
        lastDataRef.current = row.data;
        lastJsonRef.current = snapshot(row.data);
        restoreRef.current(row.data);
        setRestoredAt(row.updatedAt);
        setSavedAt(row.updatedAt);
      } else {
        lastDataRef.current = valueRef.current;
        lastJsonRef.current = snapshot(valueRef.current);
      }
      hydratedRef.current = true;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, formKey, userId]);

  useEffect(() => {
    if (!ready || !userId || !enabled) return;
    const json = snapshot(value);
    if (pausedRef.current) {
      if (armPauseRef.current) {
        lastJsonRef.current = json;
        armPauseRef.current = false;
        return;
      }
      if (json === lastJsonRef.current) return;
      pausedRef.current = false;
    }
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void persist(value);
    }, SAVE_WAIT_MS);
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, [enabled, persist, ready, userId, value]);

  useEffect(() => {
    if (!userId || !enabled) return;
    const flush = () => {
      void persist(valueRef.current, true);
    };
    return () => {
      flush();
    };
  }, [enabled, persist, userId]);

  useEffect(() => {
    if (!userId || !enabled) return;
    const flush = () => {
      void persist(valueRef.current, true);
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [enabled, persist, userId]);

  return {
    ready,
    hasDraft: savedAt != null,
    restoredAt,
    savedAt,
    discard: clear,
    clear,
  };
}
