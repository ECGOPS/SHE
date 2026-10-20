import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { requestContext } from '../context/request-context';
import type { AuthUser } from '@ecg-she/shared';
import { SERVER_TENANT } from '../../modules/auth/access-control';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request & { user?: AuthUser }, res: Response, next: NextFunction): void {
    const correlationId =
      (req.header('x-correlation-id') as string | undefined) ?? randomUUID();
    res.setHeader('x-correlation-id', correlationId);

    // The signed-in account's tenant replaces this after authentication.
    // A client header is never accepted as the tenant.
    const tenantId = SERVER_TENANT;

    requestContext.run(
      {
        userId: req.user?.id,
        tenantId,
        correlationId,
        ipAddress: req.ip ?? req.socket.remoteAddress ?? '',
      },
      () => next(),
    );
  }
}
