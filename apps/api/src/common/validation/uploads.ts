import { BadRequestException } from '@nestjs/common';
import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Base64 expands by 4/3, plus the data-URL prefix. Reject before allocating a huge buffer. */
export const MAX_DATA_URL_CHARS = 7_500_000;

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const DOCUMENT_MIMES = new Set([...IMAGE_MIMES, 'application/pdf']);

export type UploadKind = 'image' | 'document';

const SIGNATURE: Record<string, (buffer: Buffer) => boolean> = {
  'image/jpeg': (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  'image/png': (buffer) =>
    buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47,
  'image/gif': (buffer) => {
    const head = buffer.subarray(0, 6).toString('ascii');
    return head === 'GIF87a' || head === 'GIF89a';
  },
  'image/webp': (buffer) =>
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  'application/pdf': (buffer) => buffer.subarray(0, 5).toString('ascii') === '%PDF-',
};

export type UploadInspection =
  | { ok: true; buffer: Buffer; mime: string }
  | { ok: false; reason: string };

export function inspectUpload(dataUrl: unknown, declaredMime: unknown, kind: UploadKind): UploadInspection {
  if (typeof dataUrl !== 'string' || typeof declaredMime !== 'string') {
    return { ok: false, reason: 'file is missing' };
  }
  if (dataUrl.length > MAX_DATA_URL_CHARS) {
    return { ok: false, reason: 'file must be 5 MB or smaller' };
  }
  const match = /^data:([a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*);base64,([a-zA-Z0-9+/=\r\n]+)$/i.exec(dataUrl.trim());
  if (!match) return { ok: false, reason: 'file must be a base64 data URL' };

  const mime = match[1].toLowerCase();
  if (mime !== declaredMime.trim().toLowerCase()) {
    return { ok: false, reason: 'file type does not match its contents' };
  }
  const allowed = kind === 'image' ? IMAGE_MIMES : DOCUMENT_MIMES;
  if (!allowed.has(mime)) {
    return {
      ok: false,
      reason: kind === 'image' ? 'file must be a JPEG, PNG, WEBP, or GIF' : 'file must be a JPEG, PNG, WEBP, GIF, or PDF',
    };
  }

  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (buffer.length < 8 || buffer.length > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: 'file must be 5 MB or smaller' };
  }
  if (!SIGNATURE[mime]?.(buffer)) {
    return { ok: false, reason: 'file contents do not match the declared type' };
  }
  return { ok: true, buffer, mime };
}

/** Identifies a JPEG, PNG, GIF, WEBP, or PDF from its leading bytes. */
export function sniffContentType(buffer: Buffer): string | null {
  for (const [mime, matches] of Object.entries(SIGNATURE)) {
    if (matches(buffer)) return mime;
  }
  return null;
}

export function decodeUpload(dataUrl: string, declaredMime: string, kind: UploadKind): { buffer: Buffer; mime: string } {
  const result = inspectUpload(dataUrl, declaredMime, kind);
  if (!result.ok) throw new BadRequestException(result.reason);
  return result;
}

/** Checks the sibling `mimeType` and the data URL: allowed type, matching bytes, and a 5 MB cap. */
export function IsUpload(kind: UploadKind, options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isUpload',
      target: object.constructor,
      propertyName,
      constraints: [kind],
      options: { message: 'file must be an allowed type and 5 MB or smaller', ...options },
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const mime = (args.object as { mimeType?: unknown }).mimeType;
          return inspectUpload(value, mime, args.constraints[0] as UploadKind).ok;
        },
      },
    });
  };
}
