import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { Role, type AuthUser } from '@ecg-she/shared';
import { UsersService } from '../../users/users.service';
import { loadEntraConfig } from './entra.config';
import { effectivePermissions, resolveTenant } from '../access-control';
import { requestContext } from '../../../common/context/request-context';

/**
 * Entra ID payload we rely on. Microsoft sends substantially more fields, but
 * these are the ones the application uses for identity decisions.
 */
interface EntraJwtPayload {
  oid: string;          // Stable Entra object id — primary key
  tid: string;          // Entra tenant id
  preferred_username?: string;
  upn?: string;
  email?: string;
  name?: string;
  roles?: string[];
  groups?: string[];
  scp?: string;
  iat?: number;
}

/**
 * Validates JSON Web Tokens issued by Microsoft Entra ID by:
 *   1. Fetching the tenant signing keys from JWKS (cached automatically)
 *   2. Verifying issuer + audience claims
 *   3. Resolving the local user record (auto-provisioning on first login)
 *
 * Registered as Passport strategy `entra-jwt`. Used by the `JwtAuthGuard`
 * alongside the existing local strategy when `AUTH_PROVIDER` is `entra` or
 * `hybrid`.
 */
@Injectable()
export class EntraJwtStrategy extends PassportStrategy(Strategy, 'entra-jwt') {
  private readonly entraEnabled: boolean;

  constructor(config: ConfigService, private readonly users: UsersService) {
    const cfg = loadEntraConfig(config);
    // Use safe placeholders when Entra is not configured so the strategy
    // can still be instantiated. The guard chain falls through to the local
    // JWT strategy in that case; this strategy will simply reject tokens.
    const safeJwksUri =
      cfg.jwksUri && cfg.tenantId
        ? cfg.jwksUri
        : 'https://login.microsoftonline.com/common/discovery/v2.0/keys';
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      audience: cfg.audience || 'api://entra-disabled',
      issuer: cfg.issuer || 'https://login.microsoftonline.com/disabled/v2.0',
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: safeJwksUri,
      }),
      passReqToCallback: false,
    });
    this.entraEnabled = cfg.enabled;
  }

  async validate(payload: EntraJwtPayload): Promise<AuthUser> {
    if (!this.entraEnabled) throw new UnauthorizedException('Entra ID not configured');
    if (!payload.oid) throw new UnauthorizedException('Missing Entra object id');

    const email =
      payload.preferred_username ?? payload.upn ?? payload.email ?? `${payload.oid}@ecg.com.gh`;
    const fullName = payload.name ?? email;

    // Auto-provision: create or update the local mirror record. Group → role
    // mapping happens in `EntraUserSyncService`; we still need a user record
    // even if mapping has not yet run.
    const user = await this.users.upsertFromEntra({
      entraObjectId: payload.oid,
      email,
      fullName,
      groups: payload.groups ?? [],
      roles: payload.roles ?? [],
    });

    if (!user.active || (user.lockedUntil && user.lockedUntil.getTime() > Date.now())) {
      throw new UnauthorizedException('Account not available');
    }
    const store = requestContext.getStore();
    if (store) {
      store.userId = user.id;
      store.tenantId = resolveTenant(undefined, user.tenantId);
    }
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as Role,
      regionId: user.regionId,
      districtId: user.districtId,
      permissions: effectivePermissions(user.role as Role, user.permissions),
      mfaEnabled: user.mfaEnabled,
      authenticatedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : undefined,
    };
  }
}
