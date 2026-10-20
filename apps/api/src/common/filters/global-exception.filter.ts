import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuditTrailService } from '../../modules/audit-trail/audit-trail.service';
import { publicErrorMessage, redact } from '../logging/redact';

interface ErrorBody {
  success: false;
  statusCode: number;
  code: string;
  message: string | string[];
  errors?: { field: string; message: string }[];
  path: string;
  timestamp: string;
}

/**
 * Single exception handler. Callers receive a short message.
 * Authentication failures and permission denials are written to the audit trail
 * with the actor, action, time, outcome and resource path. Secrets are removed first.
 */
@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly audit?: AuditTrailService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { user?: { id?: string } }>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;
    const payload = typeof exceptionResponse === 'object' && exceptionResponse ? (exceptionResponse as Record<string, unknown>) : {};
    const code = typeof payload.code === 'string' ? payload.code : this.defaultCode(status);
    const rawMessage =
      (payload.message as string | string[] | undefined) ??
      (exception instanceof HttpException ? exception.message : 'Internal server error');
    const message = publicErrorMessage(status, rawMessage);
    const errors = Array.isArray(payload.errors) ? (payload.errors as { field: string; message: string }[]) : undefined;

    const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
    if (status >= 500) {
      this.logger.error(`outcome=FAILURE action=SERVER_ERROR resource=${request.originalUrl || request.url}`);
      if (mutating && request.user?.id) void this.writeSecurity(request, 'SERVER_ERROR', 'FAILURE', code);
    } else if (status === 401 || status === 403) {
      const action = status === 401 ? 'AUTH_FAILURE' : code === 'CSRF_REJECTED' ? 'CSRF_REJECTED' : 'PERMISSION_DENIED';
      this.logger.warn(`outcome=DENIED action=${action} actor=${request.user?.id ?? 'anonymous'} resource=${request.originalUrl || request.url}`);
      void this.writeSecurity(request, action, 'DENIED', code);
    }

    const body: ErrorBody = {
      success: false,
      statusCode: status,
      code,
      message,
      ...(errors && status < 500 ? { errors } : {}),
      path: request.originalUrl || request.url,
      timestamp: new Date().toISOString(),
    };
    response.status(status).json(body);
  }

  private async writeSecurity(
    request: Request & { user?: { id?: string } },
    action: string,
    outcome: 'DENIED' | 'FAILURE',
    code: string,
  ): Promise<void> {
    if (!this.audit) return;
    try {
      await this.audit.record({
        userId: request.user?.id ?? null,
        action,
        resource: (request.originalUrl || request.url || '').split('?')[0],
        method: request.method,
        ipAddress: request.ip ?? '',
        userAgent: typeof request.get === 'function' ? (request.get('user-agent') ?? '').slice(0, 200) : '',
        outcome,
        payload: redact({
          code,
          email: typeof request.body?.email === 'string' ? request.body.email : undefined,
        }),
      });
    } catch (error) {
      this.logger.error(`audit write failed: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }

  private defaultCode(status: number): string {
    if (status === 401) return 'UNAUTHORIZED';
    if (status === 403) return 'FORBIDDEN';
    if (status === 404) return 'NOT_FOUND';
    if (status === 400) return 'BAD_REQUEST';
    if (status >= 500) return 'INTERNAL_ERROR';
    return 'ERROR';
  }
}
