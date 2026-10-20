import { createCipheriv, randomBytes } from 'node:crypto';
import { deriveKey, legacyKey, open, randomSecret, seal } from './field-cipher';
import { SERVICE_TLS } from './tls';

describe('field cipher', () => {
  const current = 'current-data-encryption-key-32chars';
  const retired = 'retired-data-encryption-key-32chars';

  it('round-trips with a random nonce so two seals differ', () => {
    const first = seal('medical note', current);
    const second = seal('medical note', current);
    expect(first.startsWith('v2.')).toBe(true);
    expect(first).not.toBe(second);
    expect(open(first, current)).toBe('medical note');
  });

  it('opens a row sealed by the previous key after rotation', () => {
    const stored = seal('mfa-seed', retired);
    expect(open(stored, current, [retired])).toBe('mfa-seed');
  });

  it('still opens ciphertext written with the old truncated key', () => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', legacyKey(current), iv);
    const ciphertext = Buffer.concat([cipher.update('legacy', 'utf8'), cipher.final()]);
    const payload = Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
    expect(open(payload, current)).toBe('legacy');
  });

  it('rejects a tampered payload', () => {
    const stored = seal('secret', current);
    const flipped = `${stored.slice(0, -2)}aa`;
    expect(() => open(flipped, current)).toThrow();
  });

  it('derives a 32-byte key from the whole secret', () => {
    const long = `${'k'.repeat(80)}tail`;
    expect(deriveKey(long)).toHaveLength(32);
    expect(deriveKey(long).equals(deriveKey(`${'k'.repeat(80)}different`))).toBe(false);
  });

  it('draws secrets from the platform random generator', () => {
    const secret = randomSecret();
    expect(secret.length).toBeGreaterThanOrEqual(42);
    expect(secret).not.toBe(randomSecret());
  });
});

describe('service TLS', () => {
  it('requires TLS 1.2 or newer and checks the server certificate', () => {
    expect(SERVICE_TLS.minVersion).toBe('TLSv1.2');
    expect(SERVICE_TLS.rejectUnauthorized).toBe(true);
  });
});
