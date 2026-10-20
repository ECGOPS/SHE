import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser, PaginatedResult, Permission, Role, isDistrictScope, isGlobalScope } from '@ecg-she/shared';
import { HealthRecord } from './entities/health-record.entity';
import { CreateHealthRecordDto } from './dto/health.dto';
import { RbacScopeService } from '../auth/rbac-scope.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { User } from '../users/entities/user.entity';
import { renderSheReport, reportFilename } from '../../common/pdf/she-report';
import { healthReport } from '../../common/pdf/record-reports';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { paginate, searchTerm } from '../../common/pagination';

@Injectable()
export class HealthService {
  constructor(
    @InjectRepository(HealthRecord) private readonly repo: Repository<HealthRecord>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly scope: RbacScopeService,
    private readonly crypto: CryptoService,
    private readonly orgs: OrganizationsService,
  ) {}

  async create(user: AuthUser, dto: CreateHealthRecordDto): Promise<Record<string, unknown>> {
    const scoped = this.scope.enforceWriteScope(user, {
      regionId: dto.regionId ?? user.regionId ?? null,
      districtId: dto.districtId ?? user.districtId ?? null,
    });
    if (!scoped.regionId) throw new BadRequestException('regionId required');
    const fields = this.certificate(dto);
    if (fields.employeeId) await this.requireEmployee(user, fields.employeeId);
    const region = await this.orgs.getRegion(user, scoped.regionId);
    const districtCode = scoped.districtId ? (await this.orgs.getDistrict(user, scoped.districtId)).code : 'HQ';
    const notes = dto.clinicalNotes?.trim();
    const saved = await this.repo.save(
      this.repo.create({
        ...fields,
        regionId: scoped.regionId,
        districtId: scoped.districtId ?? null,
        status: 'CURRENT',
        referenceCode: await this.generateReferenceCode(region.code, districtCode),
        encryptedDataPayload: notes ? this.crypto.encrypt(notes) : null,
      }),
    );
    await this.supersede(saved);
    return this.get(user, saved.id);
  }

  async list(user: AuthUser, query: PaginationQueryDto): Promise<PaginatedResult<Record<string, unknown>>> {
    const qb = this.baseQuery().orderBy('h.recordDate', 'DESC');
    this.scope.applyScopeFilter(qb, user, 'h');
    const term = searchTerm(query.search);
    if (term) {
      qb.andWhere('(LOWER(h.referenceCode) LIKE LOWER(:s) OR LOWER(h.campaignTitle) LIKE LOWER(:s) OR LOWER(employee.fullName) LIKE LOWER(:s))', { s: term });
    }
    const page = await paginate(qb, query);
    return { ...page, items: page.items.map((row) => this.present(row, false)) };
  }

  async get(user: AuthUser, id: string): Promise<Record<string, unknown>> {
    const qb = this.baseQuery().where('h.id = :id', { id });
    this.scope.applyScopeFilter(qb, user, 'h');
    const row = await qb.getOne();
    if (!row) throw new NotFoundException('Health record not found');
    return this.present(row, this.canReadNotes(user));
  }

  async reportPdf(user: AuthUser, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const row = await this.get(user, id);
    const reference = String(row.referenceCode ?? 'health');
    const buffer = await renderSheReport(healthReport(row as Parameters<typeof healthReport>[0], user.fullName));
    return { buffer, filename: reportFilename(reference) };
  }

  async people(user: AuthUser): Promise<Array<{ id: string; fullName: string; role: Role }>> {
    const qb = this.users
      .createQueryBuilder('u')
      .select(['u.id', 'u.fullName', 'u.role'])
      .where('u.active = :active', { active: true })
      .orderBy('u.fullName', 'ASC');
    if (!isGlobalScope(user.role)) {
      qb.andWhere('u.regionId = :regionId', { regionId: user.regionId });
    }
    if (isDistrictScope(user.role)) {
      qb.andWhere('(u.districtId = :districtId OR u.districtId IS NULL)', { districtId: user.districtId });
    }
    return qb.getMany();
  }

  private certificate(dto: CreateHealthRecordDto) {
    const employeeId = dto.employeeId ?? null;
    const nextReviewDate = dto.nextReviewDate ?? null;
    const restrictions = dto.restrictions?.trim() || null;
    const clinician = dto.clinician?.trim() || null;
    const locationName = dto.locationName?.trim() || null;
    if (dto.recordType === 'CAMPAIGN') {
      const title = dto.campaignTitle?.trim();
      if (!title || !locationName) throw new BadRequestException('Name the campaign and where it was held');
      return {
        recordType: dto.recordType,
        recordDate: dto.recordDate,
        employeeId: null,
        campaignTitle: title,
        locationName,
        attendeeCount: dto.attendeeCount ?? null,
        clinician,
      };
    }
    if (dto.recordType === 'EXPOSURE_MONITORING') {
      if (!dto.exposureAgent || !dto.exposureReading?.trim()) {
        throw new BadRequestException('Record the agent and the reading');
      }
      if (!employeeId && !locationName) {
        throw new BadRequestException('Name the worker or the workplace that was measured');
      }
      return {
        recordType: dto.recordType,
        recordDate: dto.recordDate,
        employeeId,
        exposureAgent: dto.exposureAgent,
        exposureReading: dto.exposureReading.trim(),
        locationName,
        nextReviewDate,
        clinician,
      };
    }
    if (!employeeId) throw new BadRequestException('Choose the worker');
    if (!nextReviewDate) throw new BadRequestException('Set the date this must be reviewed again');
    if (dto.recordType === 'FITNESS_FOR_DUTY') {
      if (!dto.duty || !dto.fitnessOutcome) throw new BadRequestException('Record the duty and the fitness result');
      if (dto.fitnessOutcome === 'FIT_WITH_RESTRICTIONS' && !restrictions) {
        throw new BadRequestException('Write the restriction the supervisor must follow');
      }
      return {
        recordType: dto.recordType,
        recordDate: dto.recordDate,
        employeeId,
        duty: dto.duty,
        fitnessOutcome: dto.fitnessOutcome,
        restrictions,
        nextReviewDate,
        clinician,
      };
    }
    if (dto.recordType === 'MEDICAL_SURVEILLANCE') {
      if (!dto.surveillanceTest) throw new BadRequestException('Choose the test');
      return {
        recordType: dto.recordType,
        recordDate: dto.recordDate,
        employeeId,
        surveillanceTest: dto.surveillanceTest,
        fitnessOutcome: dto.fitnessOutcome ?? null,
        restrictions,
        nextReviewDate,
        clinician,
      };
    }
    const vaccine = dto.vaccine === 'OTHER' ? dto.vaccineDetail?.trim() : dto.vaccine;
    if (!vaccine || !dto.dose || !dto.batchNumber?.trim()) {
      throw new BadRequestException('Record the vaccine, the dose, and the batch');
    }
    return {
      recordType: dto.recordType,
      recordDate: dto.recordDate,
      employeeId,
      vaccine,
      dose: dto.dose,
      batchNumber: dto.batchNumber.trim(),
      nextReviewDate,
      clinician,
    };
  }

  private async supersede(saved: HealthRecord): Promise<void> {
    if (!saved.employeeId || saved.recordType === 'CAMPAIGN') return;
    const qb = this.repo
      .createQueryBuilder()
      .update(HealthRecord)
      .set({ status: 'SUPERSEDED' })
      .where('id != :id', { id: saved.id })
      .andWhere('employeeId = :employeeId', { employeeId: saved.employeeId })
      .andWhere('recordType = :recordType', { recordType: saved.recordType })
      .andWhere('status = :status', { status: 'CURRENT' });
    if (saved.duty) qb.andWhere('duty = :duty', { duty: saved.duty });
    if (saved.surveillanceTest) qb.andWhere('surveillanceTest = :test', { test: saved.surveillanceTest });
    if (saved.vaccine) qb.andWhere('vaccine = :vaccine', { vaccine: saved.vaccine });
    if (saved.exposureAgent) qb.andWhere('exposureAgent = :agent', { agent: saved.exposureAgent });
    await qb.execute();
  }

  private async requireEmployee(user: AuthUser, id: string): Promise<void> {
    const person = await this.users.findOne({ where: { id } });
    if (!person) throw new BadRequestException('Choose a worker from the list');
    if (!isGlobalScope(user.role) && person.regionId && person.regionId !== user.regionId) {
      throw new BadRequestException('That worker is outside your region');
    }
  }

  private canReadNotes(user: AuthUser): boolean {
    return user.role === Role.SYS_ADMIN || user.permissions.includes(Permission.HEALTH_CREATE);
  }

  private present(record: HealthRecord, includeNotes: boolean): Record<string, unknown> {
    const clinicalNotes = includeNotes && record.encryptedDataPayload
      ? this.crypto.decrypt(record.encryptedDataPayload)
      : undefined;
    const { encryptedDataPayload: _hidden, ...certificate } = record;
    return {
      ...certificate,
      reviewState: this.reviewState(record),
      ...(includeNotes ? { clinicalNotes: clinicalNotes ?? null } : {}),
    };
  }

  private reviewState(record: HealthRecord): string {
    if (record.status === 'SUPERSEDED') return 'SUPERSEDED';
    const due = record.nextReviewDate ? String(record.nextReviewDate).slice(0, 10) : '';
    const today = new Date().toISOString().slice(0, 10);
    if (due && due < today) return 'OVERDUE';
    return 'CURRENT';
  }

  private baseQuery() {
    return this.repo
      .createQueryBuilder('h')
      .leftJoinAndSelect('h.region', 'region')
      .leftJoinAndSelect('h.district', 'district')
      .leftJoin('h.employee', 'employee')
      .addSelect(['employee.id', 'employee.fullName']);
  }

  private async generateReferenceCode(regionCode: string, districtCode: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `OH-${year}-${regionCode}-${districtCode}-`;
    const last = await this.repo
      .createQueryBuilder('h')
      .where('h.referenceCode LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('h.referenceCode', 'DESC')
      .getOne();
    const next = last?.referenceCode ? Number(last.referenceCode.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(Number.isFinite(next) ? next : 1).padStart(5, '0')}`;
  }
}
