import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthUser, Role } from '@ecg-she/shared';
import { UsersService } from '../../users/users.service';
import { SessionService } from '../session.service';
import { effectivePermissions, resolveTenant } from '../access-control';
import { requestContext } from '../../../common/context/request-context';

interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  regionId: string | null;
  districtId: string | null;
  sid?: string;
  purpose?: 'mfa-setup';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
    private readonly sessions: SessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.users.findById(payload.sub);
    if (!user || !user.active) throw new UnauthorizedException('Account not available');
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException('Account not available');
    }
    const setupOnly = payload.purpose === 'mfa-setup';
    const session = setupOnly ? null : await this.sessions.assertActive(payload.sid ?? '');
    const store = requestContext.getStore();
    if (store) {
      store.userId = user.id;
      store.tenantId = resolveTenant(undefined, user.tenantId);
    }
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      regionId: user.regionId,
      districtId: user.districtId,
      permissions: effectivePermissions(user.role, user.permissions),
      mfaEnabled: user.mfaEnabled,
      mfaSetupOnly: setupOnly,
      sessionId: session?.id,
      authenticatedAt: session?.authenticatedAt.toISOString(),
      reauthenticatedAt: session?.reauthenticatedAt ? new Date(session.reauthenticatedAt).toISOString() : null,
    };
  }
}
