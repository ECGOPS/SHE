import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuthUser,
  classifyRisk,
  computeRiskScore,
  isDistrictScope,
  isGlobalScope,
  isSafetyOfficer,
  reportsInChosenPlace,
  Permission,
  PaginatedResult,
  PermitStatus,
  RiskLikelihood,
  RiskSeverity,
  Role,
} from '@ecg-she/shared';
import { JsaCrewMember, JsaRecord, JsaStep } from './entities/jsa.entity';
import { CreateJsaDto, JsaCrewDto, JsaStepDto, UpdateJsaDto } from './dto/jsa.dto';
import { RbacScopeService } from '../auth/rbac-scope.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { User } from '../users/entities/user.entity';
import { Permit } from '../ptw/entities/permit.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { applyStatus, paginate, searchTerm } from '../../common/pagination';
import { renderSheReport, reportFilename } from '../../common/pdf/she-report';
import { jsaReport } from '../../common/pdf/record-reports';

@Injectable()
export class JsaService {
  constructor(
    @InjectRepository(JsaRecord) private readonly repo: Repository<JsaRecord>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Permit) private readonly permits: Repository<Permit>,
    private readonly scope: RbacScopeService,
    private readonly orgs: OrganizationsService,
  ) {}

  async create(user: AuthUser, dto: CreateJsaDto): Promise<JsaRecord> {
    if (dto.offlineClientId) {
      const existing = await this.repo.findOne({ where: { offlineClientId: dto.offlineClientId } });
      if (existing) return this.get(user, existing.id);
    }
    const scoped = this.scope.enforceWriteScope(user, {
      regionId: dto.regionId ?? user.regionId ?? null,
      districtId: dto.districtId ?? user.districtId ?? null,
    });
    if (!scoped.regionId) throw new BadRequestException('regionId required');
    const steps = this.normalizeSteps(dto.steps);
    if (!steps.length) throw new BadRequestException('Add at least one step with a hazard and a control');

    const region = await this.orgs.getRegion(user, scoped.regionId);
    const districtCode = scoped.districtId
      ? (await this.orgs.getDistrict(user, scoped.districtId)).code
      : 'HQ';
    if (dto.permitId) await this.assertPermit(user, dto.permitId, scoped.regionId);
    if (dto.supervisorId) await this.assertPerson(user, dto.supervisorId, scoped.regionId, scoped.districtId);

    const saved = await this.repo.save(
      this.repo.create({
        workActivity: dto.workActivity.trim(),
        jobLocation: dto.jobLocation.trim(),
        jobDate: new Date(dto.jobDate),
        regionId: scoped.regionId,
        districtId: scoped.districtId ?? null,
        crewSize: dto.crewSize ?? dto.crew?.length ?? null,
        supervisorId: dto.supervisorId ?? null,
        ppeRequired: dto.ppeRequired ?? [],
        toolsAndEquipment: dto.toolsAndEquipment ?? [],
        permitRequired: dto.permitRequired === true,
        permitId: dto.permitId ?? null,
        emergencyProcedures: dto.emergencyProcedures?.trim() || null,
        steps,
        crew: this.normalizeCrew(dto.crew),
        createdById: user.id,
        offlineClientId: dto.offlineClientId ?? null,
        referenceCode: await this.generateReferenceCode(region.code, districtCode),
        status: 'DRAFT',
      }),
    );
    return this.get(user, saved.id);
  }

  async update(user: AuthUser, id: string, dto: UpdateJsaDto): Promise<JsaRecord> {
    this.assertCanWrite(user);
    const jsa = await this.editable(user, id);
    if (dto.permitId) await this.assertPermit(user, dto.permitId, jsa.regionId);
    if (dto.supervisorId) await this.assertPerson(user, dto.supervisorId, jsa.regionId, jsa.districtId);
    const steps = dto.steps ? this.normalizeSteps(dto.steps) : jsa.steps;
    await this.repo.update(jsa.id, {
      workActivity: dto.workActivity?.trim() || jsa.workActivity,
      jobLocation: dto.jobLocation?.trim() || jsa.jobLocation,
      jobDate: dto.jobDate ? new Date(dto.jobDate) : jsa.jobDate,
      crewSize: dto.crewSize ?? jsa.crewSize,
      supervisorId: dto.supervisorId === undefined ? jsa.supervisorId : dto.supervisorId,
      ppeRequired: dto.ppeRequired ?? jsa.ppeRequired,
      toolsAndEquipment: dto.toolsAndEquipment ?? jsa.toolsAndEquipment,
      permitRequired: dto.permitRequired ?? jsa.permitRequired,
      permitId: dto.permitId === undefined ? jsa.permitId : dto.permitId,
      emergencyProcedures:
        dto.emergencyProcedures === undefined ? jsa.emergencyProcedures : dto.emergencyProcedures.trim() || null,
      steps,
      crew: dto.crew ? this.normalizeCrew(dto.crew) : jsa.crew,
    });
    return this.get(user, id);
  }

  async submit(user: AuthUser, id: string): Promise<JsaRecord> {
    this.assertCanWrite(user);
    const jsa = await this.editable(user, id);
    this.assertReady(jsa);
    await this.repo.update(jsa.id, { status: 'PENDING_APPROVAL', rejectionNotes: null });
    return this.get(user, id);
  }

  async approve(user: AuthUser, id: string): Promise<JsaRecord> {
    this.assertCanApprove(user);
    const jsa = await this.get(user, id);
    if (jsa.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Submit the briefing for acceptance before approving it');
    }
    this.assertReady(jsa);
    if (jsa.permitRequired && jsa.createdById === user.id) {
      throw new BadRequestException('High-risk work needs a second person to accept the briefing');
    }
    await this.repo.update(jsa.id, {
      status: 'APPROVED',
      approvedById: user.id,
      approvedAt: new Date(),
      rejectionNotes: null,
    });
    return this.get(user, id);
  }

  async reject(user: AuthUser, id: string, notes: string): Promise<JsaRecord> {
    this.assertCanApprove(user);
    if (!notes.trim()) throw new BadRequestException('Say what must change before this briefing can be accepted');
    const jsa = await this.get(user, id);
    if (jsa.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Only a briefing waiting for acceptance can be sent back');
    }
    await this.repo.update(jsa.id, { status: 'REJECTED', rejectionNotes: notes.trim() });
    return this.get(user, id);
  }

  async revise(user: AuthUser, id: string): Promise<JsaRecord> {
    this.assertCanWrite(user);
    const jsa = await this.get(user, id);
    if (jsa.status !== 'APPROVED' && jsa.status !== 'REJECTED') {
      throw new BadRequestException('Revise a briefing after it has been accepted or sent back');
    }
    await this.repo.update(jsa.id, {
      status: 'DRAFT',
      approvedById: null,
      approvedAt: null,
    });
    return this.get(user, id);
  }

  async list(user: AuthUser, query: PaginationQueryDto): Promise<PaginatedResult<JsaRecord>> {
    const qb = this.baseQuery().orderBy('j.createdAt', 'DESC');
    this.scope.applyScopeFilter(qb, user, 'j', 'createdById');
    applyStatus(qb, 'j', query.status);
    const term = searchTerm(query.search);
    if (term) {
      qb.andWhere('(LOWER(j.referenceCode) LIKE LOWER(:s) OR LOWER(j.workActivity) LIKE LOWER(:s) OR LOWER(j.jobLocation) LIKE LOWER(:s))', { s: term });
    }
    return paginate(qb, query);
  }

  async get(user: AuthUser, id: string): Promise<JsaRecord> {
    const qb = this.baseQuery().where('j.id = :id', { id });
    this.scope.applyScopeFilter(qb, user, 'j', 'createdById');
    const j = await qb.getOne();
    if (!j) throw new NotFoundException('JSA not found');
    return j;
  }

  async reportPdf(user: AuthUser, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const row = await this.get(user, id);
    const buffer = await renderSheReport(jsaReport(row, user.fullName));
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

  private baseQuery() {
    return this.repo
      .createQueryBuilder('j')
      .leftJoinAndSelect('j.region', 'region')
      .leftJoinAndSelect('j.district', 'district')
      .leftJoin('j.supervisor', 'supervisor')
      .addSelect(['supervisor.id', 'supervisor.fullName'])
      .leftJoin('j.permit', 'permit')
      .addSelect(['permit.id', 'permit.referenceCode', 'permit.type', 'permit.status']);
  }

  private async editable(user: AuthUser, id: string): Promise<JsaRecord> {
    const jsa = await this.get(user, id);
    if (jsa.status !== 'DRAFT' && jsa.status !== 'REJECTED') {
      throw new BadRequestException('This briefing can be edited while it is a draft or after it is sent back');
    }
    return jsa;
  }

  private assertReady(jsa: JsaRecord): void {
    if (!jsa.workActivity?.trim() || !jsa.jobLocation?.trim() || !jsa.jobDate) {
      throw new BadRequestException('The job, the place, and the date are required');
    }
    if (!jsa.supervisorId) throw new BadRequestException('Name the supervisor for this job');
    const steps = jsa.steps ?? [];
    if (!steps.length || steps.some((step) => !step.step?.trim() || !step.hazards?.some((h) => h.trim()) || !step.controls?.some((c) => c.trim()))) {
      throw new BadRequestException('Every step needs a hazard and a control');
    }
    if (!(jsa.crew ?? []).some((person) => person.acknowledgedAt)) {
      throw new BadRequestException('At least one person on the crew must acknowledge the briefing');
    }
    if (jsa.permitRequired && !jsa.permitId) {
      throw new BadRequestException('Link the permit before this high-risk briefing can be accepted');
    }
  }

  private assertCanWrite(user: AuthUser): void {
    if (user.role === Role.SYS_ADMIN || user.permissions.includes(Permission.JSA_CREATE)) return;
    throw new ForbiddenException('You cannot change this briefing');
  }

  private assertCanApprove(user: AuthUser): void {
    if (user.role === Role.SYS_ADMIN || user.permissions.includes(Permission.JSA_APPROVE)) return;
    throw new ForbiddenException('A safety officer accepts a briefing');
  }

  private async assertPermit(user: AuthUser, permitId: string, regionId: string): Promise<void> {
    const permit = await this.permits.findOne({ where: { id: permitId } });
    if (!permit) throw new BadRequestException('Permit not found');
    if (permit.status !== PermitStatus.APPROVED && permit.status !== PermitStatus.ACTIVE) {
      throw new BadRequestException('Link a permit that has been issued');
    }
    if (permit.validTo && new Date(permit.validTo).getTime() < Date.now()) {
      throw new BadRequestException('That permit has passed its end time');
    }
    if (!isGlobalScope(user.role) && permit.regionId !== regionId) {
      throw new ForbiddenException('Permit is outside this job region');
    }
    if (isSafetyOfficer(user.role) && isDistrictScope(user.role) && permit.districtId && permit.districtId !== user.districtId) {
      throw new ForbiddenException('Permit is outside your district');
    }
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

  private normalizeSteps(steps: JsaStepDto[]): JsaStep[] {
    return (steps ?? [])
      .map((step) => {
        const hazards = (step.hazards ?? []).map((item) => item.trim()).filter(Boolean);
        const controls = (step.controls ?? []).map((item) => item.trim()).filter(Boolean);
        const likelihood = step.likelihood?.trim() || null;
        const severity = step.severity?.trim() || null;
        const rated = likelihood && severity;
        return {
          step: step.step.trim(),
          hazards,
          controls,
          likelihood,
          severity,
          riskScore: rated ? computeRiskScore(likelihood as RiskLikelihood, severity as RiskSeverity) : null,
          riskClass: rated ? classifyRisk(computeRiskScore(likelihood as RiskLikelihood, severity as RiskSeverity)) : null,
        };
      })
      .filter((step) => step.step || step.hazards.length || step.controls.length);
  }

  private normalizeCrew(crew?: JsaCrewDto[]): JsaCrewMember[] {
    return (crew ?? [])
      .map((person) => ({
        name: person.name.trim(),
        userId: person.userId ?? null,
        acknowledgedAt: person.acknowledgedAt ?? null,
      }))
      .filter((person) => person.name);
  }

  private async generateReferenceCode(regionCode: string, districtCode: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `JSA-${year}-${regionCode}-${districtCode}-`;
    const last = await this.repo
      .createQueryBuilder('j')
      .where('j.referenceCode LIKE :p', { p: `${prefix}%` })
      .orderBy('j.referenceCode', 'DESC')
      .getOne();
    const next = last ? Number(last.referenceCode.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(Number.isFinite(next) ? next : 1).padStart(5, '0')}`;
  }
}
