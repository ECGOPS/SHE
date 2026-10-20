import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { FRESH_AUTH_KEY } from '../fresh-auth.decorator';
import { FRESH_MS_DEFAULT, durationMs, hasFreshAuth } from '../session-policy';

@Injectable()
export class FreshAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(FRESH_AUTH_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required) return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const user = ctx.switchToHttp().getRequest<{ user?: SessionStamp }>().user;
    const windowMs = durationMs(this.config.get<string>('SESSION_FRESH'), FRESH_MS_DEFAULT);
    const fresh = !!user?.authenticatedAt && hasFreshAuth(
      {
        authenticatedAt: new Date(user.authenticatedAt),
        reauthenticatedAt: user.reauthenticatedAt ? new Date(user.reauthenticatedAt) : null,
      },
      Date.now(),
      windowMs,
    );
    if (!fresh) {
      throw new ForbiddenException({
        code: 'REAUTH_REQUIRED',
        message: 'Enter your password again before doing this.',
      });
    }
    return true;
  }
}

interface SessionStamp {
  authenticatedAt?: string;
  reauthenticatedAt?: string | null;
}
