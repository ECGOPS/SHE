/**
 * Document policy for the web app. React renders text, so this is the
 * second line of defense if a value is ever written as HTML.
 * MUI inserts style rules at runtime, so styles allow inline CSS.
 * Script handlers in attributes stay blocked.
 */
export function contentSecurityPolicy(dev: boolean): string {
  const script = dev ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'";
  const connect = dev
    ? "connect-src 'self' https: wss: http: ws:"
    : "connect-src 'self' https: wss:";
  return [
    "default-src 'self'",
    script,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
    connect,
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ');
}
