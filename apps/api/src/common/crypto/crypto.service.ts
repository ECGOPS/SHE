import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { open, seal } from './field-cipher';

/**
 * AES-256-GCM for fields that must stay confidential at rest
 * (health notes, MFA secrets).
 *
 * New values are sealed with DATA_ENCRYPTION_KEY.
 * DATA_ENCRYPTION_KEY_PREVIOUS, a comma-separated list, can still open rows
 * sealed before the last rotation. It cannot seal new rows.
 */
@Injectable()
export class CryptoService {
  private readonly current: string;
  private readonly previous: string[];

  constructor(config: ConfigService) {
    this.current = config.getOrThrow<string>('DATA_ENCRYPTION_KEY');
    this.previous = (config.get<string>('DATA_ENCRYPTION_KEY_PREVIOUS', '') ?? '')
      .split(',')
      .map((secret) => secret.trim())
      .filter((secret) => secret.length > 0);
  }

  encrypt(plain: string): string {
    return seal(plain, this.current);
  }

  decrypt(payload: string): string {
    return open(payload, this.current, this.previous);
  }

  hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}