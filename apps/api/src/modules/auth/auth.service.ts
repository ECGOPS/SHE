import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { AuthTokens, AuthUser, isGlobalScope, Role } from '@ecg-she/shared';
import { effectivePermissions } from './access-control';
import { UsersService } from '../users/users.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { SessionService, type SessionMeta } from './session.service';
import type { User } from '../users/entities/user.entity';

interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  regionId: string | null;
  districtId: string | null;
  purpose?: 'mfa-setup';
}

export interface LoginResult {
  tokens: AuthTokens;
  user: AuthUser;
  requiresMfa: boolean;
  requiresMfaSetup: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly cryptoSvc: CryptoService,
    private readonly sessions: SessionService,
  ) {}

  async validatePassword(email: string, password: string): Promise<User> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException('Account temporarily locked. Try again later.');
    }
    if (!user.active) throw new UnauthorizedException('Account is disabled');

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'This account has no local password. Sign in with Microsoft instead.',
      );
    }

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      await this.noteFailedLogin(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  async login(
    email: string,
    password: string,
    mfaCode: string | undefined,
    meta: SessionMeta,
  ): Promise<LoginResult> {
    const user = await this.validatePassword(email, password);

    if (user.mfaEnabled) {
      if (!mfaCode) {
        return {
          tokens: { accessToken: '', refreshToken: '', expiresIn: 0 },
          user: this.toAuthUser(user),
          requiresMfa: true,
          requiresMfaSetup: false,
        };
      }
      if (!user.mfaSecretEncrypted) throw new UnauthorizedException('MFA not configured');
      const secret = this.cryptoSvc.decrypt(user.mfaSecretEncrypted);
      const valid = authenticator.verify({ token: mfaCode, secret });
      if (!valid) {
        await this.noteFailedLogin(user.id);
        throw new UnauthorizedException('Invalid MFA code');
      }
    } else if (this.mustEnrollMfa(user)) {
      const accessToken = await this.signMfaSetupToken(user);
      return {
        tokens: { accessToken, refreshToken: '', expiresIn: 600 },
        user: this.toAuthUser(user),
        requiresMfa: false,
        requiresMfaSetup: true,
      };
    }

    const { tokens } = await this.sessions.open(user, meta);
    await this.users.recordSuccessfulLogin(user.id, meta.ip);
    return { tokens, user: this.toAuthUser(user), requiresMfa: false, requiresMfaSetup: false };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const opened = await this.sessions.rotate(refreshToken);
    return opened.tokens;
  }

  async logout(userId: string, sessionId?: string): Promise<void> {
    if (sessionId) await this.sessions.revoke(sessionId, userId);
    else await this.sessions.revokeAll(userId);
  }

  async reauth(userId: string, password: string, sessionId: string | undefined, presented: string | undefined, meta: SessionMeta): Promise<AuthTokens> {
    const user = await this.requirePassword(userId, password);
    if (sessionId) await this.sessions.markReauthenticated(sessionId);
    if (presented) return (await this.sessions.rotate(presented)).tokens;
    return (await this.sessions.open(user, meta)).tokens;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    nextPassword: string,
    sessionId: string | undefined,
    presented: string | undefined,
    meta: SessionMeta,
  ): Promise<AuthTokens> {
    const user = await this.requirePassword(userId, currentPassword);
    await this.users.setPassword(userId, await argon2.hash(nextPassword, { type: argon2.argon2id }));
    await this.sessions.revokeAll(userId, sessionId);
    if (sessionId) await this.sessions.markReauthenticated(sessionId);
    if (presented) return (await this.sessions.rotate(presented)).tokens;
    return (await this.sessions.open(user, meta)).tokens;
  }

  async setupMfa(userId: string): Promise<{ otpauthUrl: string; qrDataUrl: string; secret: string }> {
    const user = await this.users.getOrThrow(userId);
    const issuer = this.config.get<string>('MFA_ISSUER', 'ECG-SHE');
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, issuer, secret);
    const qrDataUrl = await qrcode.toDataURL(otpauthUrl);
    await this.users.setMfaSecret(userId, this.cryptoSvc.encrypt(secret), false);
    return { otpauthUrl, qrDataUrl, secret };
  }

  async verifyMfa(userId: string, code: string, meta: SessionMeta): Promise<AuthTokens> {
    const user = await this.users.findAuthRecord(userId);
    if (!user?.mfaSecretEncrypted) throw new BadRequestException('MFA not initialised');
    const secret = this.cryptoSvc.decrypt(user.mfaSecretEncrypted);
    const valid = authenticator.verify({ token: code, secret });
    if (!valid) throw new UnauthorizedException('Invalid MFA code');
    await this.users.setMfaSecret(userId, user.mfaSecretEncrypted, true);
    user.mfaEnabled = true;
    return (await this.sessions.open(user, meta)).tokens;
  }

  /** Local Head Office and system accounts must enroll TOTP before production use. */
  private mustEnrollMfa(user: User): boolean {
    if (this.config.get<string>('NODE_ENV') !== 'production') return false;
    if (!user.passwordHash) return false;
    return isGlobalScope(user.role) || user.role === Role.GLOBAL_USER;
  }

  private async signMfaSetupToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      regionId: user.regionId,
      districtId: user.districtId,
      purpose: 'mfa-setup',
    };
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: '10m',
    });
  }

  /** A lockout ends every live session, so an old token cannot keep working. */
  private async noteFailedLogin(userId: string): Promise<void> {
    const locked = await this.users.recordFailedLogin(userId);
    if (locked) await this.sessions.revokeAll(userId);
  }

  private async requirePassword(userId: string, password: string): Promise<User> {
    const user = await this.users.findAuthRecord(userId);
    if (!user?.passwordHash) {
      throw new UnauthorizedException('This account has no local password. Sign in with Microsoft instead.');
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      regionId: user.regionId,
      districtId: user.districtId,
      permissions: effectivePermissions(user.role, user.permissions),
      mfaEnabled: user.mfaEnabled,
    };
  }
}
