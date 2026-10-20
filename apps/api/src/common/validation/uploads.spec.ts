import { inspectUpload, MAX_UPLOAD_BYTES } from './uploads';

function dataUrl(mime: string, buffer: Buffer): string {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

function jpeg(size: number): Buffer {
  const buffer = Buffer.alloc(size, 0x11);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  return buffer;
}

describe('upload validation', () => {
  it('accepts a JPEG at the 5 MB boundary', () => {
    const file = jpeg(MAX_UPLOAD_BYTES);
    const result = inspectUpload(dataUrl('image/jpeg', file), 'image/jpeg', 'image');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.buffer.length).toBe(MAX_UPLOAD_BYTES);
  });

  it('rejects one byte over 5 MB', () => {
    const result = inspectUpload(dataUrl('image/jpeg', jpeg(MAX_UPLOAD_BYTES + 1)), 'image/jpeg', 'image');
    expect(result.ok).toBe(false);
  });

  it('rejects an SVG even when labelled as an image', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const result = inspectUpload(dataUrl('image/svg+xml', svg), 'image/svg+xml', 'image');
    expect(result.ok).toBe(false);
  });

  it('rejects a PDF attached where only an image is allowed', () => {
    const pdf = Buffer.from('%PDF-1.4\n%....');
    const result = inspectUpload(dataUrl('application/pdf', pdf), 'application/pdf', 'image');
    expect(result.ok).toBe(false);
  });

  it('accepts a PDF as a document', () => {
    const pdf = Buffer.from('%PDF-1.4\n%....');
    expect(inspectUpload(dataUrl('application/pdf', pdf), 'application/pdf', 'document').ok).toBe(true);
  });

  it('rejects contents that do not match the declared type', () => {
    const result = inspectUpload(dataUrl('image/jpeg', jpeg(32)), 'image/png', 'image');
    expect(result.ok).toBe(false);
  });

  it('rejects a data URL that is not base64', () => {
    expect(inspectUpload('data:image/jpeg,not-base64', 'image/jpeg', 'image').ok).toBe(false);
  });

  it('rejects an empty payload', () => {
    expect(inspectUpload('data:image/jpeg;base64,', 'image/jpeg', 'image').ok).toBe(false);
  });
});
