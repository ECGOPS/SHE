import { ConfigService } from '@nestjs/config';

export type CookieSameSite = 'lax' | 'none';

export function cookieFlagsFromEnv(
  config: ConfigService,
  path: string,
): { secure: boolean; sameSite: CookieSameSite; path: string } {
  const sameSite: CookieSameSite = config.get<string>('COOKIE_SAMESITE') === 'none' ? 'none' : 'lax';
  const forced = config.get<string>('COOKIE_SECURE');
  const secure =
    forced === 'true' ||
    sameSite === 'none' ||
    (forced !== 'false' && config.get<string>('NODE_ENV') === 'production');
  return { secure, sameSite, path };
}
