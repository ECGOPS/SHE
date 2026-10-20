import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { type AuthTokens, type Role } from '@ecg-she/shared';
import { AuditTrailService } from '../audit-trail/audit-trail.service';
import { User } from '../users/entities/user.entity';
import { UserSession } from './entities/user-session.entity';
import {
  ABSOLUTE_MS_DEFAULT,
  durationMs,
  IDLE_MS_DEFAULT,
  sessionDeadline,
} from './session-policy';

export interface SessionMeta {
  ip: string;
  userAgent: string;
}

interface AccessClaims {
  sub: string;
  email: string;
  role: Role;
  regionId: string | null;
  districtId: string | null;
  sid: string;
}

export interface OpenSession {
  tokens: AuthTokens;
  sessionId: string;
}

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(UserSession) private readonly sessions: Repository<UserSession>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditTrailService,
  ) {}

  idleMs(): number {
    return durationMs(this.config.get<string>('SESSION_IDLE'), IDLE_MS_DEFAULT);
  }

  absoluteMs(): number {
    return durationMs(this.config.get<string>('SESSION_ABSOLUTE'), ABSOLUTE_MS_DEFAULT);
  }

  /** A new random session after sign-in. Other sessions stay so they can be reviewed. */
  async open(user: User, meta: SessionMeta): Promise<OpenSession> {
    const now = new Date();
    const secret = newSecret();
    const row = await this.sessions.save(
      this.sessions.create({
        userId: user.id,
        secretHash: hashSecret(secret),
        authenticatedAt: now,
        lastSeenAt: now,
        reauthenticatedAt: now,
        ip: clip(meta.ip, 64),
        userAgent: clip(meta.userAgent, 200),
      }),
    );
    await this.noteConcurrent(user.id, row);
    const tokens = await this.sign(user, row.id, secret);
    return { tokens, sessionId: row.id };
  }

  /**
   * Replaces the cookie secret. The session id stays, so the access token
   * still names the same session, and the previous cookie cannot be replayed.
   */
  async rotate(presented: string): Promise<OpenSession> {
    const parsed = parsePresented(presented);
    if (!parsed) throw new UnauthorizedException('Invalid refresh token');
    const row = await this.sessions.findOne({ where: { id: parsed.id } });
    if (!row) throw new UnauthorizedException('Session expired');
    this.assertAlive(row);

    const presentedHash = hashSecret(parsed.secret);
    if (!hashesMatch(row.secretHash, presentedHash)) {
      await this.sessions.update({ id: row.id }, { revokedAt: new Date() });
      await this.audit.record({
        userId: row.userId,
        action: 'AUTH_SESSION_REUSE',
        resource: `user_sessions/${row.id}`,
        method: 'POST',
        ipAddress: row.ip ?? '',
        userAgent: row.userAgent ?? '',
      }).catch(() => undefined);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const secret = newSecret();
    const nextHash = hashSecret(secret);
    const updated = await this.sessions.update(
      { id: row.id, secretHash: row.secretHash },
      { secretHash: nextHash, lastSeenAt: new Date() },
    );
    if (!updated.affected) {
      await this.sessions.update({ id: row.id }, { revokedAt: new Date() });
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const user = await this.sessions.manager.getRepository(User).findOne({ where: { id: row.userId } });
    if (!user || !user.active) {
      await this.sessions.update({ id: row.id }, { revokedAt: new Date() });
      throw new UnauthorizedException('Account is disabled');
    }
    return { tokens: await this.sign(user, row.id, secret), sessionId: row.id };
  }

  /** Rejects a revoked, idle, or expired session and records that it was used. */
  async assertActive(sessionId: string): Promise<UserSession> {
    const row = await this.sessions.findOne({ where: { id: sessionId } });
    if (!row) throw new UnauthorizedException('Session expired');
    this.assertAlive(row);
    if (Date.now() - new Date(row.lastSeenAt).getTime() >= 60_000) {
      await this.sessions.update({ id: row.id }, { lastSeenAt: new Date() });
    }
    return row;
  }

  async markReauthenticated(sessionId: string): Promise<void> {
    await this.sessions.update({ id: sessionId }, { reauthenticatedAt: new Date() });
  }

  async revoke(sessionId: string, userId: string): Promise<void> {
    await this.sessions.update({ id: sessionId, userId }, { revokedAt: new Date() });
  }

  async revokeAll(userId: string, exceptId?: string): Promise<void> {
    const qb = this.sessions
      .createQueryBuilder()
      .update(UserSession)
      .set({ revokedAt: new Date() })
      .where('userId = :userId', { userId })
      .andWhere('revokedAt IS NULL');
    if (exceptId) qb.andWhere('id != :exceptId', { exceptId });
    await qb.execute();
  }

  async revokeDisabledUsers(): Promise<void> {
    await this.sessions
      .createQueryBuilder()
      .update(UserSession)
      .set({ revokedAt: new Date() })
      .where('revokedAt IS NULL')
      .andWhere('userId IN (SELECT id FROM users WHERE active = :active)', { active: false })
      .execute();
  }

  async list(userId: string, currentId?: string) {
    const rows = await this.sessions.find({
      where: { userId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    const current = rows.find((row) => row.id === currentId);
    return rows.map((row) => ({
      id: row.id,
      current: row.id === currentId,
      createdAt: row.createdAt,
      lastSeenAt: row.lastSeenAt,
      ip: row.ip ?? null,
      userAgent: row.userAgent ?? null,
      unusual: !!current?.ip && !!row.ip && row.ip !== current.ip,
    }));
  }

  private assertAlive(row: UserSession): void {
    const reason = sessionDeadline(row, Date.now(), this.idleMs(), this.absoluteMs());
    if (reason === 'ok') return;
    if (reason !== 'revoked') {
      void this.sessions.update({ id: row.id }, { revokedAt: new Date() });
    }
    throw new UnauthorizedException(reason === 'idle' ? 'Session timed out' : 'Session expired');
  }

  private async noteConcurrent(userId: string, opened: UserSession): Promise<void> {
    const others = await this.sessions.find({ where: { userId, revokedAt: IsNull() } });
    const differentIp = others.some((row) => row.id !== opened.id && row.ip && opened.ip && row.ip !== opened.ip);
    if (!differentIp) return;
    await this.audit.record({
      userId,
      action: 'AUTH_CONCURRENT_SESSION',
      resource: `user_sessions/${opened.id}`,
      method: 'POST',
      ipAddress: opened.ip ?? '',
      userAgent: opened.userAgent ?? '',
      payload: { otherSessions: others.filter((row) => row.id !== opened.id).length },
    }).catch(() => undefined);
  }

  private async sign(user: User, sessionId: string, secret: string): Promise<AuthTokens> {
    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const claims: AccessClaims = {
      sub: user.id,
      email: user.email,
      role: user.role,
      regionId: user.regionId,
      districtId: user.districtId,
      sid: sessionId,
    };
    const accessToken = await this.jwt.signAsync(claims, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessTtl,
    });
    return {
      accessToken,
      refreshToken: `${sessionId}.${secret}`,
      expiresIn: Math.round(durationMs(accessTtl, 15 * 60 * 1000) / 1000),
    };
  }
}

function newSecret(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function hashesMatch(stored: string, presented: string): boolean {
  const left = Buffer.from(stored, 'hex');
  const right = Buffer.from(presented, 'hex');
  if (left.length === 0 || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function parsePresented(value: string): { id: string; secret: string } | null {
  const dot = value.indexOf('.');
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const secret = value.slice(dot + 1);
  if (!/^[0-9a-f-]{36}$/i.test(id) || secret.length < 32) return null;
  return { id, secret };
}

function clip(value: string, max: number): string {
  return value.replace(/[\u0000-\u001f]/g, '').slice(0, max);
}
