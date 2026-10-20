import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Permission, Role } from '@ecg-she/shared';
import { PERMISSIONS_KEY } from '../../common/decorators/roles.decorator';
import { requestContext } from '../../common/context/request-context';
import { ScopeGuard } from './guards/scope.guard';
import { RbacScopeService } from './rbac-scope.service';
import {
  assertRecordAccess,
  canAccessRecord,
  effectivePermissions,
  resolveTenant,
  SERVER_TENANT,
} from './access-control';

function actor(role: Role, id = 'me') {
  return {
    id,
    role,
    regionId: role === Role.STAFF || role === Role.SYS_ADMIN || role === Role.GLOBAL_SAFETY_OFFICER ? null : 'region-a',
    districtId: role === Role.DISTRICT_SAFETY_OFFICER || role === Role.DISTRICT_USER ? 'district-a' : null,
    permissions: effectivePermissions(role),
  };
}

function request(user: ReturnType<typeof actor>, body = {}) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, body, query: {}, params: {} }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('object access', () => {
  const row = { tenantId: SERVER_TENANT, regionId: 'region-a', districtId: 'district-a' };

  it('hides another district from a district safety officer', () => {
    const officer = actor(Role.DISTRICT_SAFETY_OFFICER);
    expect(canAccessRecord(officer, { ...row, districtId: 'district-b' }, 'someone-else', SERVER_TENANT)).toBe(false);
    expect(() => assertRecordAccess(officer, { ...row, districtId: 'district-b' }, 'someone-else', SERVER_TENANT)).toThrow(
      NotFoundException,
    );
  });

  it('allows a district safety officer to open a record in their own district', () => {
    expect(canAccessRecord(actor(Role.DISTRICT_SAFETY_OFFICER), row, 'someone-else', SERVER_TENANT)).toBe(true);
  });

  it('hides another region from a regional safety officer', () => {
    expect(
      canAccessRecord(actor(Role.REGIONAL_SAFETY_OFFICER), { ...row, regionId: 'region-b' }, 'someone-else', SERVER_TENANT),
    ).toBe(false);
  });

  it('lets staff open only a record they own', () => {
    const staff = actor(Role.STAFF, 'staff-1');
    expect(canAccessRecord(staff, { ...row, regionId: 'region-b', districtId: 'district-b' }, 'staff-2', SERVER_TENANT)).toBe(
      false,
    );
    expect(canAccessRecord(staff, { ...row, regionId: 'region-b', districtId: 'district-b' }, 'staff-1', SERVER_TENANT)).toBe(
      true,
    );
  });

  it('lets a Head Office account read any place inside the tenant', () => {
    expect(
      canAccessRecord(actor(Role.GLOBAL_SAFETY_OFFICER), { ...row, regionId: 'region-z', districtId: 'district-z' }, 'other', SERVER_TENANT),
    ).toBe(true);
  });

  it('hides a row that belongs to another tenant', () => {
    expect(canAccessRecord(actor(Role.SYS_ADMIN), { ...row, tenantId: 'other' }, 'other', SERVER_TENANT)).toBe(false);
  });
});

describe('least privilege', () => {
  it('drops a permission that the role catalogue does not include', () => {
    const permissions = effectivePermissions(Role.STAFF, [Permission.USER_MANAGE, Permission.INCIDENT_APPROVE, Permission.INCIDENT_CREATE]);
    expect(permissions).not.toContain(Permission.USER_MANAGE);
    expect(permissions).not.toContain(Permission.INCIDENT_APPROVE);
    expect(permissions).toContain(Permission.INCIDENT_CREATE);
  });

  it('ignores a tenant id supplied by the caller', () => {
    expect(resolveTenant('other-tenant', undefined)).toBe(SERVER_TENANT);
    expect(resolveTenant('other-tenant', 'ecg')).toBe(SERVER_TENANT);
  });

  it('rejects a direct call that asks for an administrator permission', () => {
    const reflector = {
      getAllAndOverride: (key: string) => (key === PERMISSIONS_KEY ? [Permission.USER_MANAGE] : undefined),
    };
    const guard = new ScopeGuard(reflector as never);
    expect(() => guard.canActivate(request(actor(Role.STAFF)))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(request(actor(Role.DISTRICT_SAFETY_OFFICER)))).toThrow(ForbiddenException);
  });

  it('rejects a direct call that asks for approval the caller does not have', () => {
    const reflector = {
      getAllAndOverride: (key: string) => (key === PERMISSIONS_KEY ? [Permission.INCIDENT_APPROVE] : undefined),
    };
    const guard = new ScopeGuard(reflector as never);
    expect(() => guard.canActivate(request(actor(Role.DISTRICT_USER)))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(request(actor(Role.DISTRICT_SAFETY_OFFICER)))).toThrow(ForbiddenException);
    expect(guard.canActivate(request(actor(Role.REGIONAL_SAFETY_OFFICER)))).toBe(true);
  });
});

describe('scoped queries', () => {
  it('adds the tenant and the caller district to a direct read', () => {
    const sql: string[] = [];
    const qb = {
      andWhere(statement: string) {
        sql.push(statement);
        return this;
      },
    };
    requestContext.run({ tenantId: SERVER_TENANT }, () => {
      new RbacScopeService().applyScopeFilter(
        qb as never,
        actor(Role.DISTRICT_SAFETY_OFFICER) as never,
        'i',
        'reportedById',
      );
    });
    expect(sql.some((statement) => statement.includes('tenantId'))).toBe(true);
    expect(sql.some((statement) => statement.includes('districtId'))).toBe(true);
  });
});
