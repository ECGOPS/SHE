import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Response } from 'express';
import { applyDownloadHeaders, contentDisposition, sendStoredFile } from './safe-download';

function response(): { res: Response; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  const res = {
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    sendFile() {
      return this;
    },
  } as unknown as Response;
  return { res, headers };
}

describe('download headers', () => {
  it('keeps a newline in a file name from becoming a second header', () => {
    const header = contentDisposition('inline', 'photo.jpg\r\nContent-Type: text/html\r\n\r\n<script>');
    expect(header).not.toMatch(/[\r\n]/);
    expect(header).not.toContain('Content-Type: text/html');
    expect(header.startsWith('inline; filename="')).toBe(true);
  });

  it('serves a real JPEG inline and a script file as a download', () => {
    const dir = mkdtempSync(join(tmpdir(), 'she-xss-'));
    const jpeg = join(dir, 'photo.bin');
    const html = join(dir, 'page.bin');
    writeFileSync(jpeg, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]));
    writeFileSync(html, Buffer.from('<script>alert(1)</script>'));

    const image = response();
    sendStoredFile(image.res, { absolutePath: jpeg, mimeType: 'image/jpeg', fileName: 'pole.jpg' });
    expect(image.headers['content-type']).toBe('image/jpeg');
    expect(image.headers['content-disposition']).toContain('inline;');
    expect(image.headers['x-content-type-options']).toBe('nosniff');
    expect(image.headers['content-security-policy']).toContain("default-src 'none'");

    const stored = response();
    sendStoredFile(stored.res, {
      absolutePath: html,
      mimeType: 'image/jpeg',
      fileName: 'notes.jpg',
    });
    expect(stored.headers['content-type']).toBe('application/octet-stream');
    expect(stored.headers['content-disposition']).toContain('attachment;');
    expect(stored.headers['content-type']).not.toContain('html');
  });

  it('puts a sandbox policy on generated reports', () => {
    const { res, headers } = response();
    applyDownloadHeaders(res, 'attachment', 'NM-1-report.pdf', 'application/pdf');
    expect(headers['content-type']).toBe('application/pdf');
    expect(headers['content-security-policy']).toContain('sandbox');
    expect(headers['x-content-type-options']).toBe('nosniff');
  });
});
