import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  /** Authenticated user id (Entra ID `oid` or local user id). */
  userId?: string;
  /** Multi-tenant identifier (defaults to the ECG tenant). */
  tenantId?: string;
  /** Correlation id used for distributed tracing. */
  correlationId?: string;
  /** Source IP address. */
  ipAddress?: string;
}

/**
 * AsyncLocalStorage-backed request context propagated automatically across
 * await boundaries. Used by:
 *
 *   • the audit-columns TypeORM subscriber to fill `createdBy` / `updatedBy`
 *   • the audit-trail interceptor to attach the actor of each mutation
 *   • multi-tenant query helpers
 *
 * Populated by `RequestContextMiddleware` for every HTTP request.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
  return requestContext.getStore() ?? {};
}

export function getCurrentUserId(): string | undefined {
  return getRequestContext().userId;
}

export function getCurrentTenantId(): string | undefined {
  return getRequestContext().tenantId;
}
