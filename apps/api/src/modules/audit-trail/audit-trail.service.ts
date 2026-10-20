import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { PaginatedResult } from '@ecg-she/shared';
import { redact } from '../../common/logging/redact';
import { AuditLog } from './entities/audit-log.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { paginate, searchTerm } from '../../common/pagination';

@Injectable()
export class AuditTrailService {
  private readonly logger = new Logger(AuditTrailService.name);
  private readonly securityHits: number[] = [];

  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
    private readonly config: ConfigService,
  ) {}

  /**
   * Append a new entry, chaining its hash to the previous one for tamper-evidence.
   */
  async record(payload: {
    userId: string | null;
    action: string;
    resource: string;
    method: string;
    ipAddress: string;
    userAgent: string;
    outcome?: string;
    payload?: unknown;
  }): Promise<AuditLog> {
    const last = await this.repo.findOne({ where: {}, order: { createdAt: 'DESC' } });
    const prevHash = last?.hash ?? null;
    const outcome = payload.outcome ?? 'SUCCESS';
    const safePayload = redact(payload.payload);
    const createdAt = new Date().toISOString();
    const hash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          prevHash,
          userId: payload.userId,
          action: payload.action,
          resource: payload.resource,
          method: payload.method,
          outcome,
          payload: safePayload,
          ts: createdAt,
        }),
      )
      .digest('hex');

    const saved = await this.repo.save(
      this.repo.create({
        userId: payload.userId,
        action: payload.action,
        resource: payload.resource,
        method: payload.method,
        outcome,
        ipAddress: payload.ipAddress,
        userAgent: payload.userAgent,
        payload: safePayload as Record<string, unknown>,
        prevHash,
        hash,
      }),
    );
    this.noteSecurity(payload.action, outcome);
    return saved;
  }

  /**
   * Rows are not deleted here. Removing them would break the hash chain.
   * Operators archive a copy, then this warning says which rows are past the retention window.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async retentionNotice(): Promise<void> {
    const days = this.config.get<number>('AUDIT_RETENTION_DAYS', 365);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const stale = await this.repo.count({ where: { createdAt: LessThan(cutoff) } });
    if (stale > 0) {
      this.logger.warn(`SECURITY_ALERT action=AUDIT_RETENTION outcome=NOTICE rows=${stale} olderThanDays=${days}`);
    }
  }

  private noteSecurity(action: string, outcome: string): void {
    if (outcome !== 'DENIED') return;
    const now = Date.now();
    const windowMs = this.config.get<number>('AUDIT_ALERT_WINDOW_MINUTES', 15) * 60 * 1000;
    const limit = this.config.get<number>('AUDIT_ALERT_AUTH_FAILURES', 10);
    this.securityHits.push(now);
    const recent = this.securityHits.filter((at) => now - at < windowMs);
    this.securityHits.length = 0;
    this.securityHits.push(...recent);
    if (recent.length === limit) {
      this.logger.error(`SECURITY_ALERT action=${action} outcome=DENIED count=${recent.length} windowMinutes=${windowMs / 60000}`);
    }
  }

  async list(query: PaginationQueryDto): Promise<PaginatedResult<AuditLog>> {
    const qb = this.repo.createQueryBuilder('log').orderBy('log.createdAt', 'DESC');
    const term = searchTerm(query.search);
    if (term) qb.andWhere('(LOWER(log.action) LIKE LOWER(:s) OR LOWER(log.resource) LIKE LOWER(:s))', { s: term });
    const page = await paginate(qb, query);
    return {
      ...page,
      items: page.items.map((row) => {
        row.payload = redact(row.payload) as Record<string, unknown>;
        return row;
      }),
    };
  }
}
