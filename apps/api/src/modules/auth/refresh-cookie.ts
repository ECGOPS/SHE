import type { Request, Response } from 'express';

export const REFRESH_COOKIE = 'ecg_she_rt';

export function refreshCookiePath(apiPrefix: string): string {
  const prefix = apiPrefix.replace(/^\/+|\/+$/g, '');
  return `/${prefix}/auth`;
}

export function refreshMaxAgeMs(ttl: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(ttl);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(match[1]);
  const unit = match[2] === 's' ? 1000 : match[2] === 'm' ? 60_000 : match[2] === 'h' ? 3_600_000 : 86_400_000;
  return n * unit;
}

export interface RefreshCookieOptions {
  secure: boolean;
  path: string;
  maxAgeMs: number;
  sameSite?: 'lax' | 'none';
}

export function setRefreshCookie(res: Response, token: string, opts: RefreshCookieOptions): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: opts.secure,
    sameSite: opts.sameSite ?? 'lax',
    path: opts.path,
    maxAge: opts.maxAgeMs,
  });
}

export function clearRefreshCookie(
  res: Response,
  opts: Pick<RefreshCookieOptions, 'secure' | 'path' | 'sameSite'>,
): void {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: opts.secure,
    sameSite: opts.sameSite ?? 'lax',
    path: opts.path,
  });
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      const value = rest.join('=');
      return value ? decodeURIComponent(value) : undefined;
    }
  }
  return undefined;
}

export function readRefreshCookie(req: Request): string | undefined {
  return readCookie(req, REFRESH_COOKIE);
}
