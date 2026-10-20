import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

/**
 * Multi-strategy auth guard. Tries Entra ID first, then the local JWT
 * strategy. Either strategy can fast-fail when not configured / not the
 * issuer of the presented bearer token; whichever one accepts wins.
 *
 *   - Local-only deployments (zero-config dev): `EntraJwtStrategy` rejects
 *     fast and the local JWT is validated.
 *   - Entra-only deployments: the local strategy rejects fast.
 *   - Hybrid: both work; useful for break-glass system accounts.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard(['entra-jwt', 'jwt']) {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(ctx);
  }
}
