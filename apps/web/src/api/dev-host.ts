/**
 * The page can be opened as localhost or as this computer's network address.
 * A localhost API address only works for the first of those. When the page
 * was opened by IP, use that same computer for the API.
 */
export function sameMachineUrl(configured: string): string {
  if (typeof window === 'undefined') return configured;
  const pageHost = window.location.hostname;
  if (pageHost === 'localhost' || pageHost === '127.0.0.1') return configured;
  try {
    const url = new URL(configured);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      url.hostname = pageHost;
      return url.toString().replace(/\/$/, '');
    }
  } catch {
    return configured;
  }
  return configured;
}
