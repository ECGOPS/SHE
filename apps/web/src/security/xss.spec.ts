import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from '../../csp';
import { sanitizeRichHtml } from './html';
import { encodeHtml, encodeJs, isRasterImageType, safeHttpUrl, safeImageSrc } from './output';

const PAYLOAD = `<img src=x onerror=alert(1)>`;
const SCRIPT = `<script>alert(1)</script>`;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (path.endsWith('.spec.ts') || path.endsWith('.spec.tsx')) return [];
    return path.endsWith('.ts') || path.endsWith('.tsx') ? [path] : [];
  });
}

describe('output encoding', () => {
  it('encodes a stored payload as HTML text', () => {
    expect(encodeHtml(PAYLOAD)).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(encodeHtml(`a&b "c" 'd'`)).toBe('a&amp;b &quot;c&quot; &#39;d&#39;');
  });

  it('encodes a payload placed in a script string', () => {
    const encoded = encodeJs('</script><script>alert(1)</script>');
    expect(encoded.startsWith('"')).toBe(true);
    expect(encoded.includes('</')).toBe(false);
  });

  it('renders API text and attributes through React so the payload stays text', () => {
    const html = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement('h1', null, PAYLOAD),
        createElement('input', { value: SCRIPT, readOnly: true }),
        createElement('a', { href: '/near-miss?search=Makola', title: PAYLOAD }, 'Open'),
      ),
    );
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html.includes('<img')).toBe(false);
    expect(html.includes('<script')).toBe(false);
  });
});

describe('addresses', () => {
  it('drops script, HTML, and SVG addresses', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeHttpUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined();
    expect(safeHttpUrl('//evil.example/phish')).toBeUndefined();
    expect(safeHttpUrl('https://ecg.com.gh/she')).toBe('https://ecg.com.gh/she');
    expect(safeImageSrc('javascript:alert(1)')).toBeUndefined();
    expect(safeImageSrc('data:text/html;base64,PHNjcmlwdD4=')).toBeUndefined();
    expect(safeImageSrc('data:image/svg+xml;base64,PHN2Zz4=')).toBeUndefined();
    expect(safeImageSrc('data:image/png;base64,aaaa')).toBe('data:image/png;base64,aaaa');
    expect(isRasterImageType('image/svg+xml')).toBe(false);
    expect(isRasterImageType('image/jpeg')).toBe(true);
  });
});

describe('rich html', () => {
  it('keeps an allowlisted note and removes scripts, handlers, and script links', () => {
    const clean = sanitizeRichHtml(
      `<p onclick="alert(1)">Wear <strong>gloves</strong></p><script>alert(1)</script><a href="javascript:alert(1)">x</a><a href="https://ecg.com.gh">ECG</a>`,
    );
    expect(clean).toContain('<p>Wear <strong>gloves</strong></p>');
    expect(clean).toContain('href="https://ecg.com.gh"');
    expect(clean.includes('<script')).toBe(false);
    expect(clean.includes('onclick')).toBe(false);
    expect(clean.includes('javascript:')).toBe(false);
  });
});

describe('views', () => {
  it('does not write HTML or run strings in any screen', () => {
    const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
    const hits = sourceFiles(root).flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      const found = [
        'dangerouslySetInnerHTML',
        '.innerHTML',
        '.outerHTML',
        'document.write',
        'insertAdjacentHTML',
        'createContextualFragment',
        'eval(',
        'new Function(',
      ].filter((token) => text.includes(token));
      return found.map((token) => `${file} ${token}`);
    });
    expect(hits).toEqual([]);
  });
});

describe('content security policy', () => {
  it('blocks object embedding and inline event handlers', () => {
    const production = contentSecurityPolicy(false);
    expect(production).toContain("script-src 'self'");
    expect(production.includes("'unsafe-inline'")).toBe(true);
    expect(production).toContain("script-src-attr 'none'");
    expect(production).toContain("object-src 'none'");
    expect(production).toContain("frame-ancestors 'none'");
    expect(production.split(';').some((part) => part.trim().startsWith("script-src ") && part.includes('unsafe-inline'))).toBe(false);
  });
});
