import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@ecg-she/shared';
import { ScopeGuard } from './scope.guard';

function ctxFor(user: unknown, body = {}, query = {}, params = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, body, query, params }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('ScopeGuard', () => {
  const reflector = new Reflector();
  const guard = new ScopeGuard(reflector);

  it('allows Head Office staff to report in any region', () => {
    const user = {
      id: 'u1',
      role: Role.GLOBAL_USER,
      regionId: null,
      districtId: null,
      permissions: [],
    };
    expect(guard.canActivate(ctxFor(user, { regionId: 'R1', districtId: 'D1' }))).toBe(true);
  });

  it('allows district staff to report in another district', () => {
    const user = {
      id: 'u2',
      role: Role.DISTRICT_USER,
      regionId: 'R1',
      districtId: 'D1',
      permissions: [],
    };
    expect(guard.canActivate(ctxFor(user, { regionId: 'R2', districtId: 'D9' }))).toBe(true);
  });

  it('rejects a district safety officer targeting another district', () => {
    const user = {
      id: 'u5',
      role: Role.DISTRICT_SAFETY_OFFICER,
      regionId: 'R1',
      districtId: 'D1',
      permissions: [],
    };
    expect(() => guard.canActivate(ctxFor(user, { regionId: 'R1', districtId: 'D9' }))).toThrow(ForbiddenException);
  });

  it('blocks MFA enrollment tokens from ordinary routes', () => {
    const user = {
      id: 'u3',
      role: Role.SYS_ADMIN,
      regionId: null,
      districtId: null,
      permissions: [],
      mfaSetupOnly: true,
    };
    expect(() => guard.canActivate(ctxFor(user))).toThrow(ForbiddenException);
  });

  it('allows staff to report in any district', () => {
    const user = {
      id: 'u4',
      role: Role.STAFF,
      regionId: null,
      districtId: null,
      permissions: [],
    };
    expect(guard.canActivate(ctxFor(user, { regionId: 'R9', districtId: 'D9' }))).toBe(true);
  });

  it('allows district users targeting their own scope', () => {
    const user = {
      id: 'u2',
      role: Role.DISTRICT_USER,
      regionId: 'R1',
      districtId: 'D1',
      permissions: [],
    };
    expect(guard.canActivate(ctxFor(user, { regionId: 'R1', districtId: 'D1' }))).toBe(true);
  });
});
