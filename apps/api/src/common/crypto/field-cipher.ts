import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** New ciphertext. The prefix marks the SHA-256 derived key so an older row can still be opened. */
const VERSION = 'v2.';

/** 32-byte AES key from the secret. SHA-256 keeps every character of a long secret. */
export function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

/**
 * Key used by ciphertext written before versioning.
 * Kept only so those rows still open after a deploy.
 */
export function legacyKey(secret: string): Buffer {
  return Buffer.from(secret.padEnd(32, '0').slice(0, 32));
}

export function randomSecret(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function seal(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return VERSION + Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function open(payload: string, current: string, previous: readonly string[] = []): string {
  const secrets = [current, ...previous.filter((secret) => secret.length > 0)];
  const versioned = payload.startsWith(VERSION);
  const body = versioned ? payload.slice(VERSION.length) : payload;
  const material = versioned ? deriveKey : legacyKey;
  let failure: unknown;
  for (const secret of secrets) {
    try {
      return openRaw(body, material(secret));
    } catch (err) {
      failure = err;
    }
  }
  throw failure instanceof Error ? failure : new Error('Unable to decrypt');
}

function openRaw(payload: string, key: Buffer): string {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
