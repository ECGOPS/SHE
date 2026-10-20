/**
 * React encodes text and attributes when a value is a JSX child or prop.
 * These helpers cover the contexts React does not encode for us: a URL
 * placed in src or href, a script string, and HTML that is actually markup.
 */

const DATA_IMAGE = /^data:image\/(jpeg|png|gif|webp);base64,[a-z0-9+/=\s]+$/i;
const RASTER = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function encodeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A quoted JavaScript string. Also escapes characters that would close a script block. */
export function encodeJs(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** http(s) only. javascript:, data:, and protocol-relative URLs are dropped. */
export function safeHttpUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, 'https://she.invalid');
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    if (value.startsWith('//')) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

/**
 * An image address we are willing to put in src. Raster data URLs and
 * same-site paths only. SVG, HTML, and script URLs are dropped.
 */
export function safeImageSrc(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (DATA_IMAGE.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !/[\u0000-\u001f\\]/.test(trimmed)) return trimmed;
  return undefined;
}

export function isRasterImageType(type: string): boolean {
  return RASTER.has(type.toLowerCase());
}

/** Object URL for a blob the API already typed as a raster image. */
export function imageSrcFromBlob(blob: Blob | undefined): string | undefined {
  if (!blob || !isRasterImageType(blob.type)) return undefined;
  return URL.createObjectURL(blob);
}
