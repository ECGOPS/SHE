export function isBlankDraftValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'number' && Number.isNaN(value)) return true;
  if (value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/**
 * Keep answers the live form has not painted yet (unmounted selects, photos
 * still hydrating). A key that is present and blank is treated as the person
 * clearing the field.
 */
export function mergeDraftPreserve<T>(previous: T | null | undefined, next: unknown): T {
  if (previous == null) return next as T;
  if (next == null) return previous;

  if (Array.isArray(previous) || Array.isArray(next)) {
    if (Array.isArray(next) && next.length === 0 && Array.isArray(previous) && previous.length > 0) {
      return previous;
    }
    return next as T;
  }

  if (typeof previous === 'object' && typeof next === 'object') {
    const prevObj = previous as Record<string, unknown>;
    const nextObj = next as Record<string, unknown>;
    const keys = new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]);
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      if (!(key in nextObj)) {
        out[key] = prevObj[key];
        continue;
      }
      out[key] = mergeDraftPreserve(prevObj[key] as T, nextObj[key] as T);
    }
    return out as T;
  }

  if (isBlankDraftValue(next) && next !== '' && !isBlankDraftValue(previous)) {
    return previous;
  }
  return next as T;
}

export function jsonSafeClone<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, inner: unknown) => (typeof inner === 'number' && Number.isNaN(inner) ? null : inner)),
  ) as T;
}
