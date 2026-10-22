import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import {
  AuthUser,
  isDistrictScope,
  isRegionalScope,
  isUnscopedSeat,
  Role,
  ROLE_PERMISSIONS,
} from '@ecg-she/shared';
import { assertRecordAccess } from '../auth/access-control';
import { getCurrentTenantId } from '../../common/context/request-context';
import { User } from './entities/user.entity';

export interface CreateUserInput {
  email: string;
  fullName: string;
  phone?: string;
  password: string;
  role: Role;
  regionId?: string | null;
  districtId?: string | null;
}

export interface UpsertFromEntraInput {
  entraObjectId: string;
  email: string;
  fullName: string;
  groups?: string[];
  roles?: string[];
  department?: string;
  jobTitle?: string;
  employeeId?: string;
  managerEntraObjectId?: string;
  /** Map of Entra group → application role. */
  groupRoleMap?: Record<string, string>;
}

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async create(input: CreateUserInput): Promise<User> {
    if (isUnscopedSeat(input.role)) {
      input.regionId = null;
      input.districtId = null;
    }
    this.assertScopeMatchesRole(input.role, input.regionId, input.districtId);
    const exists = await this.users.findOne({ where: { email: input.email } });
    if (exists) throw new BadRequestException('User with this email already exists');

    const user = this.users.create({
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      phone: input.phone ?? null,
      passwordHash: await argon2.hash(input.password, { type: argon2.argon2id }),
      role: input.role,
      regionId: input.regionId ?? null,
      districtId: input.districtId ?? null,
      permissions: ROLE_PERMISSIONS[input.role],
      optionalContactConsent: false,
    });
    return this.users.save(user);
  }

  /**
   * Idempotent identity provisioning from Microsoft Entra ID.
   *
   * Creates the user on first sign-in as staff, with no region or district.
   * A later sign-in refreshes the name and email only. The role and the
   * scope stay as the administrator assigned them.
   */
  async upsertFromEntra(input: UpsertFromEntraInput): Promise<User> {
    let user = await this.users.findOne({
      where: [{ entraObjectId: input.entraObjectId }, { email: input.email.toLowerCase() }],
      relations: ['region', 'district'],
    });

    if (!user) {
      user = this.users.create({
        entraObjectId: input.entraObjectId,
        email: input.email.toLowerCase(),
        fullName: input.fullName,
        role: Role.STAFF,
        permissions: ROLE_PERMISSIONS[Role.STAFF],
        regionId: null,
        districtId: null,
        active: true,
      });
    } else {
      user.entraObjectId = input.entraObjectId;
      user.email = input.email.toLowerCase();
      user.fullName = input.fullName;
    }

    if (input.department !== undefined) user.department = input.department;
    if (input.jobTitle !== undefined) user.jobTitle = input.jobTitle;
    if (input.employeeId !== undefined) user.employeeId = input.employeeId;
    if (input.managerEntraObjectId !== undefined) user.managerEntraObjectId = input.managerEntraObjectId;
    user.entraGroups = input.groups ?? null;
    user.lastEntraSyncAt = new Date();

    return this.users.save(user);
  }

  /** Mass-deactivate users no longer present in Entra ID. */
  async deactivateMissing(activeEntraObjectIds: string[]): Promise<number> {
    if (activeEntraObjectIds.length === 0) return 0;
    const result = await this.users
      .createQueryBuilder()
      .update(User)
      .set({ active: false })
      .where('entraObjectId IS NOT NULL')
      .andWhere('entraObjectId NOT IN (:...ids)', { ids: activeEntraObjectIds })
      .andWhere('active = :active', { active: true })
      .execute();
    return result.affected ?? 0;
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id }, relations: ['region', 'district'] });
  }

  /** Loads password, refresh-token hash, and MFA secret (columns are select:false). */
  findAuthRecord(id: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('u')
      .addSelect(['u.passwordHash', 'u.refreshTokenHash', 'u.mfaSecretEncrypted'])
      .where('u.id = :id', { id })
      .getOne();
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('u')
      .addSelect(['u.passwordHash', 'u.refreshTokenHash', 'u.mfaSecretEncrypted'])
      .leftJoinAndSelect('u.region', 'r')
      .leftJoinAndSelect('u.district', 'd')
      .where('LOWER(u.email) = LOWER(:email)', { email })
      .getOne();
  }

  findByEntraObjectId(oid: string): Promise<User | null> {
    return this.users.findOne({ where: { entraObjectId: oid }, relations: ['region', 'district'] });
  }

  async getOrThrow(id: string): Promise<User> {
    const u = await this.findById(id);
    if (!u) throw new NotFoundException('User not found');
    return u;
  }

  /** A direct request for another account still has to match tenant and scope. */
  async getForActor(actor: AuthUser, id: string): Promise<User> {
    const user = await this.getOrThrow(id);
    assertRecordAccess(actor, user, user.id, getCurrentTenantId());
    return user;
  }

  async setPassword(userId: string, passwordHash: string): Promise<void> {
    await this.users.update({ id: userId }, { passwordHash });
  }

  async setActive(id: string, active: boolean): Promise<User> {
    await this.getOrThrow(id);
    await this.users.update({ id }, { active });
    return this.getOrThrow(id);
  }

  async setRefreshTokenHash(userId: string, hash: string | null): Promise<void> {
    await this.users.update({ id: userId }, { refreshTokenHash: hash });
  }

  async recordSuccessfulLogin(userId: string, ip: string): Promise<void> {
    await this.users.update(
      { id: userId },
      { lastLoginAt: new Date(), lastLoginIp: ip, failedLoginAttempts: 0, lockedUntil: null },
    );
  }

  async recordFailedLogin(userId: string): Promise<boolean> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return false;
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const locked = attempts >= 5;
    const lockedUntil = locked ? new Date(Date.now() + 15 * 60_000) : null;
    await this.users.update({ id: userId }, { failedLoginAttempts: attempts, lockedUntil });
    return locked;
  }

  async setMfaSecret(userId: string, encrypted: string | null, enabled: boolean): Promise<void> {
    await this.users.update(
      { id: userId },
      { mfaSecretEncrypted: encrypted, mfaEnabled: enabled },
    );
  }

  list({ regionId, districtId, search }: { regionId?: string; districtId?: string; search?: string }): Promise<User[]> {
    const qb = this.users
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.region', 'r')
      .leftJoinAndSelect('u.district', 'd');
    const tenantId = getCurrentTenantId();
    if (tenantId) qb.andWhere('u.tenantId = :tenantId', { tenantId });
    if (regionId) qb.andWhere('u.regionId = :regionId', { regionId });
    if (districtId) qb.andWhere('u.districtId = :districtId', { districtId });
    const needle = search?.trim().toLowerCase();
    if (needle) {
      qb.andWhere('(LOWER(u.email) LIKE :needle OR LOWER(u.fullName) LIKE :needle)', { needle: `%${needle}%` });
    }
    qb.orderBy('u.fullName', 'ASC');
    return qb.getMany();
  }

  /** An administrator sets the role and the scope. Staff stay unscoped. */
  async assign(id: string, input: { role: Role; regionId?: string | null; districtId?: string | null }): Promise<User> {
    await this.getOrThrow(id);
    const regionId = isUnscopedSeat(input.role) ? null : input.regionId ?? null;
    const districtId = isUnscopedSeat(input.role) || isRegionalScope(input.role) ? null : input.districtId ?? null;
    this.assertScopeMatchesRole(input.role, regionId, districtId);
    await this.users.update(
      { id },
      { role: input.role, regionId, districtId, permissions: ROLE_PERMISSIONS[input.role] },
    );
    return this.getOrThrow(id);
  }

  private assertScopeMatchesRole(role: Role, regionId?: string | null, districtId?: string | null): void {
    if (isDistrictScope(role) && !districtId) {
      throw new BadRequestException('District staff and safety officers must be assigned a district');
    }
    if (isRegionalScope(role) && !regionId) {
      throw new BadRequestException('Regional staff and safety officers must be assigned a region');
    }
    if (isUnscopedSeat(role) && (regionId || districtId)) {
      throw new BadRequestException('Head Office, staff, and admin users must not be scoped to a region or district');
    }
  }
}
