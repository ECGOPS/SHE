import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { SERVICE_TLS } from '../crypto/tls';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Minimal Redis-like interface used by the rest of the codebase.
 * In zero-config local mode (no Redis available) we install an in-memory
 * stub that satisfies the same contract so cache reads / pub-sub no-ops
 * succeed without crashing.
 */
class InMemoryRedisStub {
  private readonly logger = new Logger('InMemoryRedis');
  private readonly store = new Map<string, { value: string; expiresAt?: number }>();

  constructor() {
    this.logger.warn(
      'Redis disabled (REDIS_ENABLED=false) - using in-memory stub. Real-time pub/sub is local to this process only.',
    );
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(
    key: string,
    value: string,
    mode?: string,
    ttlSeconds?: number,
  ): Promise<'OK'> {
    const expiresAt =
      mode?.toUpperCase() === 'EX' && ttlSeconds
        ? Date.now() + ttlSeconds * 1000
        : undefined;
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const k of keys) if (this.store.delete(k)) n++;
    return n;
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const next = (current ? parseInt(current, 10) : 0) + 1;
    await this.set(key, String(next));
    return next;
  }

  async expire(key: string, ttlSeconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + ttlSeconds * 1000;
    return 1;
  }

  async publish(): Promise<number> {
    return 0;
  }

  on(): this {
    return this;
  }

  duplicate(): InMemoryRedisStub {
    return this;
  }

  async quit(): Promise<'OK'> {
    return 'OK';
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const enabled = config.get<boolean>('REDIS_ENABLED', false);
        if (!enabled) return new InMemoryRedisStub();

        const tls = config.get<boolean>('REDIS_TLS', false);
        return new Redis({
          host: config.get<string>('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT'),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
          lazyConnect: false,
          ...(tls ? { tls: { minVersion: SERVICE_TLS.minVersion, rejectUnauthorized: true } } : {}),
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
