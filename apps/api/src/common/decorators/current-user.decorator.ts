import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { AuthUser } from '@ecg-she/shared';

export const CurrentUser = createParamDecorator(
  (key: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | AuthUser[keyof AuthUser] => {
    const req = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return key ? req.user[key] : req.user;
  },
);
