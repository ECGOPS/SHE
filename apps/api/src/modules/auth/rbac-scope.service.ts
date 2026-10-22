import { BadRequestException, Injectable } from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import {
  AuthUser,
  isDistrictScope,
  isGlobalScope,
  isRegionalScope,
  isUnscopedReporter,
  reportsInChosenPlace,
} from '@ecg-she/shared';
import { getCurrentTenantId } from '../../common/context/request-context';

/**
 * Helper used by every read query in the SHE modules to apply hierarchical
 * row-level filtering directly inside SQL. Use it like:
 *
 *   const qb = this.repo.createQueryBuilder('i');
 *   this.scope.applyScopeFilter(qb, user, 'i');
 */
@Injectable()
export class RbacScopeService {
  applyScopeFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    user: AuthUser,
    alias: string,
    ownColumn?: string,
  ): SelectQueryBuilder<T> {
    const tenantId = getCurrentTenantId();
    if (tenantId) {
      qb.andWhere(`${alias}.tenantId = :__tenantId`, { __tenantId: tenantId });
    }
    // Head Office staff and ordinary staff: own reports only, never nationwide lists.
    if (isUnscopedReporter(user.role)) {
      if (ownColumn) qb.andWhere(`${alias}.${ownColumn} = :__ownUser`, { __ownUser: user.id });
      else qb.andWhere('1 = 0');
      return qb;
    }
    if (isGlobalScope(user.role)) return qb;
    if (isRegionalScope(user.role)) {
      if (reportsInChosenPlace(user.role) && ownColumn) {
        qb.andWhere(`(${alias}.regionId = :__scopeRegion OR ${alias}.${ownColumn} = :__ownUser)`, {
          __scopeRegion: user.regionId,
          __ownUser: user.id,
        });
      } else {
        qb.andWhere(`${alias}.regionId = :__scopeRegion`, { __scopeRegion: user.regionId });
      }
    } else if (isDistrictScope(user.role)) {
      if (reportsInChosenPlace(user.role) && ownColumn) {
        qb.andWhere(
          `((${alias}.regionId = :__scopeRegion AND ${alias}.districtId = :__scopeDistrict) OR ${alias}.${ownColumn} = :__ownUser)`,
          { __scopeRegion: user.regionId, __scopeDistrict: user.districtId, __ownUser: user.id },
        );
      } else {
        qb.andWhere(`${alias}.regionId = :__scopeRegion`, { __scopeRegion: user.regionId }).andWhere(
          `${alias}.districtId = :__scopeDistrict`,
          { __scopeDistrict: user.districtId },
        );
      }
    }
    return qb;
  }

  /** Keep the place a reporter chose. A safety officer stays inside the scope they were assigned. */
  enforceWriteScope<T extends { regionId?: string | null; districtId?: string | null }>(
    user: AuthUser,
    payload: T,
  ): T {
    if (reportsInChosenPlace(user.role)) {
      if (!payload.regionId || !payload.districtId) {
        throw new BadRequestException('Choose the region and the district where this happened');
      }
      return payload;
    }
    if (isDistrictScope(user.role)) {
      payload.regionId = user.regionId;
      payload.districtId = user.districtId;
    } else if (isRegionalScope(user.role) && !payload.regionId) {
      payload.regionId = user.regionId;
    }
    return payload;
  }
}
