import { Injectable } from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { getCurrentTenantId } from '../context/request-context';

/**
 * Applies the active tenant filter to any TypeORM query builder.
 * Use this from every read service — combined with `RbacScopeService` —
 * to guarantee complete tenant isolation in multi-tenant deployments.
 */
@Injectable()
export class TenantScopeService {
  applyTenantFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
  ): SelectQueryBuilder<T> {
    const tenantId = getCurrentTenantId();
    if (tenantId) {
      qb.andWhere(`${alias}.tenantId = :__tenantId`, { __tenantId: tenantId });
    }
    return qb;
  }
}
