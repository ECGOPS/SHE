import { closeSync, openSync, readSync } from 'fs';
import type { Response } from 'express';
import { sniffContentType } from '../validation/uploads';

const INLINE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);

/**
 * A download name cannot break out of the header. Quotes, newlines, and
 * non-ASCII bytes are removed so a stored file name cannot inject a second
 * header or a new content type.
 */
export function contentDisposition(kind: 'inline' | 'attachment', fileName: string): string {
  const cleaned = fileName
    .replace(/[\u0000-\u001f\u007f"%\\/<>]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_')
    .slice(0, 120) || 'download';
  return `${kind}; filename="${cleaned}"; filename*=UTF-8''${encodeURIComponent(cleaned)}`;
}

export function applyDownloadHeaders(
  res: Response,
  kind: 'inline' | 'attachment',
  fileName: string,
  contentType: string,
): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', contentDisposition(kind, fileName));
}

/**
 * Serves a stored upload. The type sent to the browser is taken from the
 * file bytes. A file whose bytes are HTML, SVG, or anything else is
 * downloaded as an opaque attachment and cannot run as a page.
 */
export function sendStoredFile(
  res: Response,
  file: { absolutePath: string; mimeType: string; fileName: string },
): void {
  const head = Buffer.alloc(16);
  const fd = openSync(file.absolutePath, 'r');
  let read = 0;
  try {
    read = readSync(fd, head, 0, 16, 0);
  } finally {
    closeSync(fd);
  }
  const sniffed = sniffContentType(head.subarray(0, read));
  const declared = file.mimeType.trim().toLowerCase();
  const inline = sniffed !== null && sniffed === declared && INLINE_TYPES.has(sniffed);
  applyDownloadHeaders(res, inline ? 'inline' : 'attachment', file.fileName, inline ? sniffed : 'application/octet-stream');
  res.sendFile(file.absolutePath);
}
