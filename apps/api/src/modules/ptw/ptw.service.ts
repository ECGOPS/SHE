import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuthUser,
  isDistrictScope,
  isGlobalScope,
  reportsInChosenPlace,
  Permission,
  PaginatedResult,
  PermitStatus,
  PermitType,
  Role,
} from '@ecg-she/shared';
import { Permit } from './entities/permit.entity';
import { CreatePermitDto, GasTestDto } from './dto/permit.dto';
import { RbacScopeService } from '../auth/rbac-scope.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { User } from '../users/entities/user.entity';
import { TrainingService } from '../training/training.service';
import { PpeService } from '../ppe/ppe.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { applyStatus, paginate, searchTerm } from '../../common/pagination';
import { renderSheReport, reportFilename } from '../../common/pdf/she-report';
import { permitReport } from '../../common/pdf/record-reports';

const SHIFT_MS = 16 * 60 * 60 * 1000;
const OPEN_STATUSES: PermitStatus[] = [
  PermitStatus.PENDING_APPROVAL,
  PermitStatus.APPROVED,
  PermitStatus.ACTIVE,
  PermitStatus.SUSPENDED,
];

@Injectable()
export class PtwService {
  constructor(
    @InjectRepository(Permit) private readonly repo: Repository<Permit>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly scope: RbacScopeService,
    private readonly orgs: OrganizationsService,
    private readonly training: TrainingService,
    private readonly ppe: PpeService,
  ) {}

  async create(user: AuthUser, dto: CreatePermitDto): Promise<Permit> {
    this.assertCanWrite(user);
    const scoped = this.scope.enforceWriteScope(user, {
      regionId: dto.regionId ?? user.regionId ?? null,
      districtId: dto.districtId ?? user.districtId ?? null,
    });
    if (!scoped.regionId) throw new BadRequestException('regionId required');
    const validFrom = new Date(dto.validFrom);
    const validTo = new Date(dto.validTo);
    this.assertWindow(validFrom, validTo);
    const hazards = this.lines(dto.hazardsIdentified);
    const controls = this.lines(dto.controlMeasures);
    if (!hazards.length || !controls.length) {
      throw new BadRequestException('Name the hazards and the precautions');
    }
    if (dto.holderId) await this.assertPerson(user, dto.holderId, scoped.regionId, scoped.districtId);
    if (dto.standbyPersonId) await this.assertPerson(user, dto.standbyPersonId, scoped.regionId, scoped.districtId);
    if (dto.authorisingManagerId) await this.assertPerson(user, dto.authorisingManagerId, scoped.regionId, scoped.districtId);

    const region = await this.orgs.getRegion(user, scoped.regionId);
    const districtCode = scoped.districtId
      ? (await this.orgs.getDistrict(user, scoped.districtId)).code
      : 'HQ';
    const watch = this.needsWatch(dto.type);

    const saved = await this.repo.save(
      this.repo.create({
        type: dto.type,
        workDescription: dto.workDescription.trim(),
        workLocation: dto.workLocation.trim(),
        validFrom,
        validTo,
        regionId: scoped.regionId,
        districtId: scoped.districtId ?? null,
        crewSize: dto.crewSize ?? null,
        isolationMethod: dto.isolationMethod ?? null,
        isolationReference: dto.isolationReference?.trim() || null,
        isolationPoints: this.lines(dto.isolationPoints),
        hazardsIdentified: hazards,
        controlMeasures: controls,
        ppeRequired: this.lines(dto.ppeRequired),
        gasTestRequired: watch || dto.gasTestRequired === true,
        holderId: dto.holderId ?? null,
        standbyPersonId: dto.standbyPersonId ?? null,
        authorisingManagerId: dto.authorisingManagerId ?? null,
        applicantId: user.id,
        referenceCode: await this.generateReferenceCode(region.code, districtCode),
        status: PermitStatus.PENDING_APPROVAL,
      }),
    );
    return this.get(user, saved.id);
  }

  async list(user: AuthUser, query: PaginationQueryDto): Promise<PaginatedResult<Permit>> {
    await this.expireStale();
    const qb = this.baseQuery().orderBy('p.validFrom', 'DESC');
    this.scope.applyScopeFilter(qb, user, 'p', 'applicantId');
    applyStatus(qb, 'p', query.status);
    const term = searchTerm(query.search);
    if (term) {
      qb.andWhere('(LOWER(p.referenceCode) LIKE LOWER(:s) OR LOWER(p.workDescription) LIKE LOWER(:s) OR LOWER(p.workLocation) LIKE LOWER(:s))', { s: term });
    }
    return paginate(qb, query);
  }

  async get(user: AuthUser, id: string): Promise<Permit> {
    await this.expireStale();
    const qb = this.baseQuery().where('p.id = :id', { id });
    this.scope.applyScopeFilter(qb, user, 'p', 'applicantId');
    const permit = await qb.getOne();
    if (!permit) throw new NotFoundException('Permit not found');
    return permit;
  }

  async reportPdf(user: AuthUser, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const row = await this.get(user, id);
    const buffer = await renderSheReport(permitReport(row, user.fullName));
    return { buffer, filename: reportFilename(row.referenceCode) };
  }

  async people(user: AuthUser): Promise<Array<{ id: string; fullName: string; role: Role }>> {
    const qb = this.users
      .createQueryBuilder('u')
      .select(['u.id', 'u.fullName', 'u.role'])
      .where('u.active = :active', { active: true })
      .orderBy('u.fullName', 'ASC');
    if (!reportsInChosenPlace(user.role)) {
      if (!isGlobalScope(user.role)) {
        qb.andWhere('u.regionId = :regionId', { regionId: user.regionId });
      }
      if (isDistrictScope(user.role)) {
        qb.andWhere('(u.districtId = :districtId OR u.districtId IS NULL)', { districtId: user.districtId });
      }
    }
    return qb.getMany();
  }

  async recordGasTest(user: AuthUser, id: string, dto: GasTestDto): Promise<Permit> {
    this.assertCanWrite(user);
    const permit = await this.get(user, id);
    if (permit.status !== PermitStatus.PENDING_APPROVAL && permit.status !== PermitStatus.APPROVED) {
      throw new BadRequestException('Record the gas test before the holder accepts the permit');
    }
    const oxygen = dto.oxygen?.trim() || '';
    const lel = dto.lel?.trim() || '';
    const toxic = dto.toxic?.trim() || '';
    if (!oxygen && !lel && !toxic) {
      throw new BadRequestException('Record oxygen, flammable gas, or a toxic reading');
    }
    const gasTestResults: Record<string, unknown> = {
      oxygen: oxygen || null,
      lel: lel || null,
      toxic: toxic || null,
      notes: dto.notes?.trim() || null,
      testedAt: new Date().toISOString(),
      testedById: user.id,
    };
    await this.repo.update(permit.id, { gasTestResults: gasTestResults as never });
    return this.get(user, id);
  }

  async issue(user: AuthUser, id: string): Promise<Permit> {
    this.assertCanApprove(user);
    const permit = await this.get(user, id);
    if (permit.status !== PermitStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Only a permit waiting for authorisation can be issued');
    }
    if (permit.applicantId === user.id) {
      throw new BadRequestException('The person who raised the permit cannot issue it');
    }
    this.assertWindow(new Date(permit.validFrom), new Date(permit.validTo));
    if (new Date(permit.validTo).getTime() < Date.now()) {
      throw new BadRequestException('This permit is past its end time');
    }
    this.assertReadyToIssue(permit);
    if (permit.holderId) {
      await this.training.assertForIssue(permit.holderId, permit.type);
      await this.ppe.assertForIssue(permit.holderId, permit.type);
    }
    await this.repo.update(permit.id, {
      status: PermitStatus.APPROVED,
      issuerId: user.id,
      approvedAt: new Date(),
      rejectionNotes: null,
    });
    return this.get(user, id);
  }

  async reject(user: AuthUser, id: string, notes: string): Promise<Permit> {
    this.assertCanApprove(user);
    if (!notes.trim()) throw new BadRequestException('Say what must change before this permit can be issued');
    const permit = await this.get(user, id);
    if (permit.status !== PermitStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Only a permit waiting for authorisation can be sent back');
    }
    await this.repo.update(permit.id, { status: PermitStatus.REJECTED, rejectionNotes: notes.trim() });
    return this.get(user, id);
  }

  async revise(user: AuthUser, id: string): Promise<Permit> {
    this.assertCanWrite(user);
    const permit = await this.get(user, id);
    if (permit.status !== PermitStatus.REJECTED) {
      throw new BadRequestException('Revise a permit after it has been sent back');
    }
    await this.repo.update(permit.id, { status: PermitStatus.PENDING_APPROVAL });
    return this.get(user, id);
  }

  async accept(user: AuthUser, id: string): Promise<Permit> {
    const permit = await this.get(user, id);
    if (permit.status !== PermitStatus.APPROVED) {
      throw new BadRequestException('Accept the permit after it has been issued');
    }
    if (user.role !== Role.SYS_ADMIN && permit.holderId !== user.id) {
      throw new ForbiddenException('The permit holder accepts it at the work site');
    }
    if (new Date(permit.validTo).getTime() < Date.now()) {
      throw new BadRequestException('This permit is past its end time');
    }
    await this.repo.update(permit.id, { status: PermitStatus.ACTIVE, holderAcceptedAt: new Date() });
    return this.get(user, id);
  }

  async suspend(user: AuthUser, id: string, notes: string): Promise<Permit> {
    if (!notes.trim()) throw new BadRequestException('Say why the work is stopping');
    const permit = await this.get(user, id);
    if (permit.status !== PermitStatus.ACTIVE) {
      throw new BadRequestException('Suspend a permit while work is underway');
    }
    this.assertHolderOrOfficer(user, permit);
    await this.repo.update(permit.id, { status: PermitStatus.SUSPENDED, suspensionNotes: notes.trim() });
    return this.get(user, id);
  }

  async resume(user: AuthUser, id: string): Promise<Permit> {
    const permit = await this.get(user, id);
    if (permit.status !== PermitStatus.SUSPENDED) {
      throw new BadRequestException('Resume a permit that has been suspended');
    }
    if (new Date(permit.validTo).getTime() < Date.now()) {
      throw new BadRequestException('This permit is past its end time');
    }
    this.assertHolderOrOfficer(user, permit);
    await this.repo.update(permit.id, { status: PermitStatus.ACTIVE });
    return this.get(user, id);
  }

  async handback(user: AuthUser, id: string, notes: string): Promise<Permit> {
    if (!notes.trim()) throw new BadRequestException('Say that the site is safe and how the isolations were left');
    const permit = await this.get(user, id);
    if (permit.status !== PermitStatus.ACTIVE && permit.status !== PermitStatus.SUSPENDED) {
      throw new BadRequestException('Hand the permit back while it is in force or suspended');
    }
    if (user.role !== Role.SYS_ADMIN && user.id !== permit.holderId && user.id !== permit.applicantId) {
      throw new ForbiddenException('The holder hands the permit back');
    }
    await this.repo.update(permit.id, { handbackNotes: notes.trim() });
    return this.get(user, id);
  }

  async close(user: AuthUser, id: string): Promise<Permit> {
    this.assertCanApprove(user);
    const permit = await this.get(user, id);
    if (permit.status !== PermitStatus.ACTIVE && permit.status !== PermitStatus.SUSPENDED) {
      throw new BadRequestException('Close a permit after it has been accepted on site');
    }
    if (user.id === permit.holderId) {
      throw new BadRequestException('The holder hands the permit back. A safety officer closes it');
    }
    if (!permit.handbackNotes?.trim()) {
      throw new BadRequestException('The holder must confirm the site is safe before this permit can be closed');
    }
    await this.repo.update(permit.id, {
      status: PermitStatus.CLOSED,
      closedAt: new Date(),
    });
    return this.get(user, id);
  }

  private baseQuery() {
    return this.repo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.region', 'region')
      .leftJoinAndSelect('p.district', 'district')
      .leftJoin('p.applicant', 'applicant')
      .addSelect(['applicant.id', 'applicant.fullName'])
      .leftJoin('p.issuer', 'issuer')
      .addSelect(['issuer.id', 'issuer.fullName'])
      .leftJoin('p.holder', 'holder')
      .addSelect(['holder.id', 'holder.fullName'])
      .leftJoin('p.standbyPerson', 'standbyPerson')
      .addSelect(['standbyPerson.id', 'standbyPerson.fullName'])
      .leftJoin('p.authorisingManager', 'authorisingManager')
      .addSelect(['authorisingManager.id', 'authorisingManager.fullName']);
  }

  private async expireStale(): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(Permit)
      .set({ status: PermitStatus.EXPIRED })
      .where('status IN (:...open)', { open: OPEN_STATUSES })
      .andWhere('validTo < :now', { now: new Date() })
      .execute();
  }

  private assertReadyToIssue(permit: Permit): void {
    if (!permit.holderId) throw new BadRequestException('Name the permit holder before it can be issued');
    if (this.needsIsolation(permit.type)) {
      const points = permit.isolationPoints ?? [];
      const method = permit.isolationMethod && permit.isolationMethod !== 'NONE';
      if (!method || (!points.length && !permit.isolationReference?.trim())) {
        throw new BadRequestException('Electrical work needs an isolation method and the lock-out points or the tag number');
      }
    }
    if (this.needsWatch(permit.type)) {
      if (!permit.standbyPersonId) {
        throw new BadRequestException('Name the standby person or fire watch before this permit can be issued');
      }
      if (!permit.authorisingManagerId || permit.authorisingManagerId === permit.applicantId) {
        throw new BadRequestException('A person other than the applicant authorises hot work and confined-space entry');
      }
    }
    if (permit.gasTestRequired || this.needsWatch(permit.type)) {
      const test = (permit.gasTestResults ?? {}) as { oxygen?: string | null; lel?: string | null; toxic?: string | null };
      if (!test.oxygen && !test.lel && !test.toxic) {
        throw new BadRequestException('Record the gas test before this permit can be issued');
      }
    }
  }

  private assertWindow(from: Date, to: Date): void {
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('The start and end of the shift are required');
    }
    if (to.getTime() <= from.getTime()) throw new BadRequestException('The permit must end after it starts');
    if (to.getTime() - from.getTime() > SHIFT_MS) {
      throw new BadRequestException('A permit covers one shift, up to 16 hours');
    }
  }

  private assertHolderOrOfficer(user: AuthUser, permit: Permit): void {
    if (user.role === Role.SYS_ADMIN) return;
    if (user.id === permit.holderId) return;
    if (user.permissions.includes(Permission.PTW_APPROVE)) return;
    throw new ForbiddenException('The holder or a safety officer can change this permit');
  }

  private assertCanWrite(user: AuthUser): void {
    if (user.role === Role.SYS_ADMIN || user.permissions.includes(Permission.PTW_CREATE)) return;
    throw new ForbiddenException('You cannot raise this permit');
  }

  private assertCanApprove(user: AuthUser): void {
    if (user.role === Role.SYS_ADMIN || user.permissions.includes(Permission.PTW_APPROVE)) return;
    throw new ForbiddenException('A safety officer issues a permit');
  }

  private async assertPerson(user: AuthUser, personId: string, regionId: string, districtId?: string | null): Promise<void> {
    const person = await this.users.findOne({ where: { id: personId, active: true } });
    if (!person) throw new BadRequestException('That person is not an active user');
    if (isGlobalScope(user.role) || isGlobalScope(person.role)) return;
    if (person.regionId !== regionId) throw new BadRequestException('That person is outside this job region');
    if (isDistrictScope(user.role) && districtId && person.districtId && person.districtId !== districtId) {
      throw new BadRequestException('That person is outside this job district');
    }
  }

  private needsIsolation(type: PermitType): boolean {
    return type === PermitType.ELECTRICAL || type === PermitType.ISOLATION;
  }

  private needsWatch(type: PermitType): boolean {
    return type === PermitType.HOT_WORK || type === PermitType.CONFINED_SPACE;
  }

  private lines(values?: string[] | null): string[] {
    return (values ?? []).map((item) => item.trim()).filter(Boolean);
  }

  private async generateReferenceCode(regionCode: string, districtCode: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PTW-${year}-${regionCode}-${districtCode}-`;
    const last = await this.repo
      .createQueryBuilder('p')
      .where('p.referenceCode LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('p.referenceCode', 'DESC')
      .getOne();
    const next = last ? Number(last.referenceCode.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(Number.isFinite(next) ? next : 1).padStart(5, '0')}`;
  }
}
