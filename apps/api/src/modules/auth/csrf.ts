import * as crypto from 'crypto';
import type { Request, Response } from 'express';

export const CSRF_COOKIE = 'ecg_she_csrf';
export const CSRF_HEADER = 'x-csrf-token';

export function newCsrfToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function setCsrfCookie(
  res: Response,
  token: string,
  opts: { secure: boolean; path: string; maxAgeMs: number },
): void {
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: true,
    secure: opts.secure,
    sameSite: 'lax',
    path: opts.path,
    maxAge: opts.maxAgeMs,
  });
  res.setHeader('X-CSRF-Token', token);
}

export function clearCsrfCookie(res: Response, opts: { secure: boolean; path: string }): void {
  res.clearCookie(CSRF_COOKIE, {
    httpOnly: true,
    secure: opts.secure,
    sameSite: 'lax',
    path: opts.path,
  });
}

function readNamedCookies(req: Request, name: string): string[] {
  const header = req.headers.cookie;
  if (!header) return [];
  const values: string[] = [];
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      const value = rest.join('=');
      if (value) values.push(decodeURIComponent(value));
    }
  }
  return values;
}

export function csrfTokensMatch(req: Request): boolean {
  const header = req.header(CSRF_HEADER);
  if (!header) return false;
  const right = Buffer.from(header);
  return readNamedCookies(req, CSRF_COOKIE).some((cookie) => {
    const left = Buffer.from(cookie);
    return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
  });
}
