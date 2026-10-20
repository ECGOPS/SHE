import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { csrfTokensMatch } from '../../modules/auth/csrf';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    if (SAFE.has(req.method)) {
      next();
      return;
    }
    if (!csrfTokensMatch(req)) {
      throw new ForbiddenException({
        code: 'CSRF_REJECTED',
        message: 'This request was rejected.',
      });
    }
    next();
  }
}
