import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser, isDistrictScope, isGlobalScope, isRegionalScope, reportsInChosenPlace, ROLE_HIERARCHY, Role } from '@ecg-she/shared';
import { ROLES_KEY, PERMISSIONS_KEY } from '../../../common/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { ALLOW_MFA_SETUP_KEY } from '../../../common/decorators/allow-mfa-setup.decorator';

/**
 * Enforces three things on every request:
 *
 *  1. Minimum role — `@Roles(Role.X)` (caller's role must be ≥ X by hierarchy).
 *  2. Permission set — `@RequirePermissions('incident:create', ...)`.
 *  3. Geographic scope — body / query parameters `regionId` and `districtId`
 *     must fall within the caller's hierarchical scope.
 *
 * District users can only mutate their own district. Regional users can mutate
 * any district within their region. Global users and SysAdmins are unrestricted.
 *
 * The Scope filter helpers in `RbacScopeService` apply the same rules to read
 * queries as TypeORM `where` clauses.
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<{
      user?: AuthUser;
      body?: Record<string, unknown>;
      query?: Record<string, unknown>;
      params?: Record<string, unknown>;
    }>();

    const user = req.user;
    if (!user) return true; // JwtAuthGuard will reject earlier when required

    if (user.mfaSetupOnly) {
      const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_MFA_SETUP_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]);
      if (!allowed) {
        throw new ForbiddenException('Finish MFA enrollment before using the application');
      }
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (requiredRoles?.length && !this.satisfiesRole(user.role, requiredRoles)) {
      throw new ForbiddenException(
        `Role ${user.role} cannot perform this action (requires ${requiredRoles.join(' or ')})`,
      );
    }

    const requiredPerms = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (requiredPerms?.length && !requiredPerms.every((p) => user.permissions.includes(p))) {
      throw new ForbiddenException(`Missing required permission(s): ${requiredPerms.join(', ')}`);
    }

    this.assertScope(user, req.body ?? {}, req.query ?? {}, req.params ?? {});
    return true;
  }

  private satisfiesRole(role: Role, allowed: Role[]): boolean {
    const min = Math.min(...allowed.map((r) => ROLE_HIERARCHY[r]));
    return ROLE_HIERARCHY[role] >= min;
  }

  private assertScope(
    user: AuthUser,
    body: Record<string, unknown>,
    query: Record<string, unknown>,
    params: Record<string, unknown>,
  ): void {
    if (isGlobalScope(user.role) || reportsInChosenPlace(user.role)) return;

    const regionId =
      (body.regionId as string | undefined) ??
      (query.regionId as string | undefined) ??
      (params.regionId as string | undefined);
    const districtId =
      (body.districtId as string | undefined) ??
      (query.districtId as string | undefined) ??
      (params.districtId as string | undefined);

    if (isRegionalScope(user.role)) {
      if (regionId && regionId !== user.regionId) {
        throw new ForbiddenException('Action targets a region outside your scope');
      }
    }

    if (isDistrictScope(user.role)) {
      if (regionId && regionId !== user.regionId) {
        throw new ForbiddenException('Action targets a region outside your scope');
      }
      if (districtId && districtId !== user.districtId) {
        throw new ForbiddenException('Action targets a district outside your scope');
      }
    }
  }
}
