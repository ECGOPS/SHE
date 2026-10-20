import type { Request, Response } from 'express';
import { csrfTokensMatch, setCsrfCookie } from './csrf';
import { setRefreshCookie } from './refresh-cookie';
import { hasFreshAuth, sessionDeadline } from './session-policy';

describe('session deadlines', () => {
  const now = Date.parse('2026-10-18T12:00:00Z');
  const idle = 30 * 60 * 1000;
  const absolute = 12 * 60 * 60 * 1000;

  it('accepts a session inside both windows', () => {
    expect(sessionDeadline({
      createdAt: new Date(now - 60_000),
      lastSeenAt: new Date(now - 60_000),
    }, now, idle, absolute)).toBe('ok');
  });

  it('rejects an idle session one millisecond past the limit', () => {
    expect(sessionDeadline({
      createdAt: new Date(now - 60_000),
      lastSeenAt: new Date(now - idle),
    }, now, idle, absolute)).toBe('idle');
  });

  it('rejects a session at the absolute limit even if it was just used', () => {
    expect(sessionDeadline({
      createdAt: new Date(now - absolute),
      lastSeenAt: new Date(now),
    }, now, idle, absolute)).toBe('absolute');
  });

  it('treats a recent sign-in as fresh and an old one as stale', () => {
    expect(hasFreshAuth({ authenticatedAt: new Date(now - 60_000) }, now, 10 * 60_000)).toBe(true);
    expect(hasFreshAuth({
      authenticatedAt: new Date(now - 2 * 60 * 60_000),
      reauthenticatedAt: new Date(now - 60_000),
    }, now, 10 * 60_000)).toBe(true);
    expect(hasFreshAuth({ authenticatedAt: new Date(now - 2 * 60 * 60_000) }, now, 10 * 60_000)).toBe(false);
  });
});

describe('cookies and csrf', () => {
  it('sets HttpOnly, SameSite=Lax, and Secure on the session cookie', () => {
    const seen: Array<Record<string, unknown>> = [];
    const res = { cookie: (_n: string, _v: string, opts: Record<string, unknown>) => seen.push(opts) } as unknown as Response;
    setRefreshCookie(res, 'session', { secure: true, path: '/api/v1/auth', maxAgeMs: 1000 });
    expect(seen[0]).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: true });
  });

  it('rejects a missing or different csrf token and accepts an exact match', () => {
    const token = 'a'.repeat(43);
    const req = (header?: string, cookie?: string) => ({
      header: (name: string) => (name === 'x-csrf-token' ? header : undefined),
      headers: { cookie },
    }) as unknown as Request;
    expect(csrfTokensMatch(req(undefined, `ecg_she_csrf=${token}`))).toBe(false);
    expect(csrfTokensMatch(req(token, 'ecg_she_csrf=different-token-value-of-same-size!!'))).toBe(false);
    expect(csrfTokensMatch(req(token, `ecg_she_csrf=${token}`))).toBe(true);
    expect(csrfTokensMatch(req(token, `ecg_she_csrf=${'b'.repeat(43)}; ecg_she_csrf=${token}`))).toBe(true);
    const headers: Record<string, unknown> = {};
    const res = {
      cookie: () => undefined,
      setHeader: (name: string, value: unknown) => { headers[name] = value; },
    } as unknown as Response;
    setCsrfCookie(res, token, { secure: true, path: '/api/v1', maxAgeMs: 1000 });
    expect(headers['X-CSRF-Token']).toBe(token);
  });
});
