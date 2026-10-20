export const IDLE_MS_DEFAULT = 30 * 60 * 1000;
export const ABSOLUTE_MS_DEFAULT = 12 * 60 * 60 * 1000;
export const FRESH_MS_DEFAULT = 10 * 60 * 1000;

export function durationMs(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) return fallback;
  const n = Number(match[1]);
  const unit = match[2] === 's' ? 1000 : match[2] === 'm' ? 60_000 : match[2] === 'h' ? 3_600_000 : 86_400_000;
  return n * unit;
}

export type SessionDeadline = 'ok' | 'revoked' | 'idle' | 'absolute';

export function sessionDeadline(
  session: { revokedAt?: Date | null; createdAt: Date; lastSeenAt: Date },
  now: number,
  idleMs: number,
  absoluteMs: number,
): SessionDeadline {
  if (session.revokedAt) return 'revoked';
  if (now - new Date(session.createdAt).getTime() >= absoluteMs) return 'absolute';
  if (now - new Date(session.lastSeenAt).getTime() >= idleMs) return 'idle';
  return 'ok';
}

/** A high-risk action is allowed only after a recent sign-in or password check. */
export function hasFreshAuth(
  session: { authenticatedAt: Date; reauthenticatedAt?: Date | null },
  now: number,
  windowMs: number,
): boolean {
  const marks = [session.authenticatedAt, session.reauthenticatedAt].filter((mark): mark is Date => !!mark);
  return marks.some((mark) => now - new Date(mark).getTime() < windowMs);
}
