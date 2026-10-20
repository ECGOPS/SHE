import { NotFoundException } from '@nestjs/common';
import {
  isDistrictScope,
  isGlobalScope,
  isRegionalScope,
  isStaffRole,
  reportsInChosenPlace,
  ROLE_PERMISSIONS,
  type AuthUser,
  type PermissionValue,
  type Role,
} from '@ecg-she/shared';

/** The only tenant this deployment serves. A request header cannot change it. */
export const SERVER_TENANT = 'ecg';

/**
 * Tenant comes from the signed-in account. A caller-supplied tenant id is ignored
 * so a direct request cannot switch tenants.
 */
export function resolveTenant(_header: string | undefined, userTenant?: string | null): string {
  const assigned = userTenant?.trim();
  return assigned || SERVER_TENANT;
}

/**
 * Permissions are the role catalogue, optionally narrowed by the stored list.
 * A stored value outside that catalogue is dropped, so a client cannot grant
 * itself a higher role's permission.
 */
export function effectivePermissions(role: Role, stored?: readonly string[] | null): PermissionValue[] {
  const catalogue = ROLE_PERMISSIONS[role] ?? [];
  if (!stored?.length) return [...catalogue];
  const allowed = new Set<string>(catalogue);
  return stored.filter((permission): permission is PermissionValue => allowed.has(permission));
}

export interface AccessRecord {
  tenantId?: string | null;
  regionId?: string | null;
  districtId?: string | null;
}

type Actor = Pick<AuthUser, 'id' | 'role' | 'regionId' | 'districtId'>;

/**
 * Whether this account may see this row.
 * Global accounts see every row in their tenant.
 * Safety officers see their region or district.
 * Staff and reporting users also see a row they own, even when it sits in another place.
 */
export function canAccessRecord(
  user: Actor,
  record: AccessRecord,
  ownerId?: string | null,
  tenantId?: string | null,
): boolean {
  if (tenantId && record.tenantId && record.tenantId !== tenantId) return false;
  if (isGlobalScope(user.role)) return true;

  const owns = !!ownerId && ownerId === user.id;
  if (isStaffRole(user.role)) return owns;

  if (isRegionalScope(user.role)) {
    const inRegion = !!record.regionId && record.regionId === user.regionId;
    return reportsInChosenPlace(user.role) ? inRegion || owns : inRegion;
  }

  if (isDistrictScope(user.role)) {
    const inDistrict =
      !!record.regionId &&
      record.regionId === user.regionId &&
      !!record.districtId &&
      record.districtId === user.districtId;
    return reportsInChosenPlace(user.role) ? inDistrict || owns : inDistrict;
  }

  return false;
}

/** Hide the row when the caller is outside its tenant, place, or ownership. */
export function assertRecordAccess(
  user: Actor,
  record: AccessRecord,
  ownerId?: string | null,
  tenantId?: string | null,
): void {
  if (!canAccessRecord(user, record, ownerId, tenantId)) {
    throw new NotFoundException();
  }
}
