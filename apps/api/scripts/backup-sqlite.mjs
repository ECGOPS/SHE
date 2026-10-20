/**
 * Writes an AES-256-GCM copy of the local SQLite file.
 * The sealed file uses the same v2 format as field encryption, with DATA_ENCRYPTION_KEY.
 * Run from apps/api. Do not point this at a production database.
 */
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const secret = process.env.DATA_ENCRYPTION_KEY;
if (!secret || secret.length < 32) {
  console.error('DATA_ENCRYPTION_KEY is required. The backup is not written.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && process.env.DB_TYPE && process.env.DB_TYPE !== 'sqlite') {
  console.error('This script backs up the local SQLite file only. Use the host’s encrypted database backup for production.');
  process.exit(1);
}

const source = resolve(process.argv[2] ?? 'data/ecg-she.db');
const target = resolve(process.argv[3] ?? 'data/backups/ecg-she.db.enc');
const plain = readFileSync(source);
const iv = randomBytes(12);
const key = createHash('sha256').update(secret, 'utf8').digest();
const cipher = createCipheriv('aes-256-gcm', key, iv);
const ciphertext = Buffer.concat([cipher.update(plain.toString('base64'), 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();
const sealed = `v2.${Buffer.concat([iv, tag, ciphertext]).toString('base64')}`;
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, sealed, { mode: 0o600 });
console.log(`sealed backup bytes=${sealed.length} target=${target}`);
