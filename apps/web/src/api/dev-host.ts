/**
 * The page can be opened as localhost or as this computer's network address.
 * A localhost API address only works for the first of those. When the page
 * was opened by IP, use that same computer for the API.
 *
 * On a deployed host the SPA must call /api/v1 on this same origin. iPhone
 * Safari treats a cookie from another site (for example Render) as a
 * third-party cookie and drops it, so sign-in returns "This request was
 * rejected."
 */

const DEFAULT_API = 'http://localhost:4000/api/v1';

export function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
}

export function isLanHost(host: string): boolean {
  if (isLoopbackHost(host)) return true;
  const parts = host.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function sameMachineUrl(
  configured: string,
  pageHost = typeof window === 'undefined' ? '' : window.location.hostname,
): string {
  if (!pageHost || isLoopbackHost(pageHost)) return configured;
  try {
    const url = new URL(configured);
    if (isLoopbackHost(url.hostname)) {
      url.hostname = pageHost;
      return url.toString().replace(/\/$/, '');
    }
  } catch {
    return configured;
  }
  return configured;
}

export function apiBaseUrl(
  configured = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API,
  page: { hostname: string; origin: string } | undefined = typeof window === 'undefined' ? undefined : window.location,
): string {
  if (!page) return configured;
  if (isLanHost(page.hostname)) return sameMachineUrl(configured, page.hostname);
  return `${page.origin.replace(/\/$/, '')}/api/v1`;
}
