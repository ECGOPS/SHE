import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { AUDIT_ACTION_KEY } from '../decorators/audit.decorator';
import { redact } from '../logging/redact';
import { AuditTrailService } from '../../modules/audit-trail/audit-trail.service';

/**
 * Records every mutating request to the immutable audit trail.
 * Reads `@Audit('ACTION')` metadata or falls back to `<METHOD> <route>`.
 */
@Injectable()
export class AuditTrailInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditTrailInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const method = req.method?.toUpperCase();
    const named = this.reflector.get<string | undefined>(AUDIT_ACTION_KEY, ctx.getHandler());
    const isMutating = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';

    return next.handle().pipe(
      tap((result: unknown) => {
        const action = named ?? `${method} ${req.path}`;
        const body = req.body as { anonymous?: boolean; photos?: unknown[]; category?: string; severityPotential?: string } | undefined;
        const anonymous = action === 'NEAR_MISS_CREATE' && body?.anonymous === true;
        const loginUserId =
          named === 'AUTH_LOGIN' && result && typeof result === 'object' && 'user' in result
            ? (result as { user?: { id?: string } }).user?.id
            : undefined;
        const userId = anonymous ? null : req.user?.id ?? loginUserId;
        if ((!isMutating && !named) || userId === undefined) return;
        const payload = anonymous
          ? { anonymous: true, category: body?.category, severityPotential: body?.severityPotential }
          : redact(isMutating ? body : { id: req.params?.id });

        this.auditTrailService
          .record({
            userId,
            action,
            resource: (req.originalUrl || req.path || '').split('?')[0],
            method,
            ipAddress: anonymous ? '' : req.ip ?? '',
            userAgent: anonymous ? '' : req.get('user-agent') ?? '',
            outcome: 'SUCCESS',
            payload,
          })
          .catch((err) => this.logger.warn(`Failed to write audit trail: ${(err as Error).message}`));
      }),
    );
  }
}
