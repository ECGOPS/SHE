import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuthUser,
  isDistrictScope,
  isGlobalScope,
  isRegionalScope,
  isSafetyOfficer,
  Permission,
  reportsInChosenPlace,
} from '@ecg-she/shared';
import { ManagementRecord } from './entities/management-record.entity';
import { CreateManagementRecordDto, ManagementQueryDto, UpdateManagementRecordDto } from './dto/management-record.dto';
import { MANAGEMENT_COVERED, MANAGEMENT_TOPICS } from './management-system.topics';
import { RbacScopeService } from '../auth/rbac-scope.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { applyStatus, orderColumn, paginate, searchTerm } from '../../common/pagination';
import { assertRecordAccess } from '../auth/access-control';
import { getCurrentTenantId } from '../../common/context/request-context';

const PUBLISHED = ['POLICY', 'SCOPE', 'OBJECTIVE', 'COMMUNICATION'];
const HEAD_OFFICE_ONLY = new Set(['POLICY', 'SCOPE', 'CONTEXT']);
const DUE_REQUIRED = new Set(['OBJECTIVE', 'EMERGENCY', 'REVIEW', 'DOCUMENT', 'MONITORING']);

@Injectable()
export class ManagementSystemService {
  constructor(
    @InjectRepository(ManagementRecord) private readonly records: Repository<ManagementRecord>,
    private readonly scope: RbacScopeService,
    private readonly orgs: OrganizationsService,
  ) {}

  async summary(user: AuthUser) {
    const qb = this.records.createQueryBuilder('m').select('m.kind', 'kind').addSelect('COUNT(m.id)', 'count');
    this.visible(qb, user);
    qb.groupBy('m.kind');
    const rows = await qb.getRawMany<{ kind: string; count: string }>();
    const counts = new Map(rows.map((row) => [row.kind, Number(row.count)]));
    const worker = reportsInChosenPlace(user.role);
    const topics = MANAGEMENT_TOPICS.filter((topic) => !worker || PUBLISHED.includes(topic.kind) || topic.kind === 'CONSULTATION');
    return {
      topics: topics.map((topic) => ({ ...topic, count: counts.get(topic.kind) ?? 0 })),
      covered: MANAGEMENT_COVERED,
    };
  }

  async list(user: AuthUser, query: ManagementQueryDto) {
    const qb = this.records
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.region', 'region')
      .leftJoinAndSelect('m.district', 'district');
    this.visible(qb, user);
    if (query.kind) qb.andWhere('m.kind = :kind', { kind: query.kind });
    applyStatus(qb, 'm', query.status);
    const term = searchTerm(query.search);
    if (term) qb.andWhere('(m.title LIKE :term OR m.referenceCode LIKE :term OR m.clauseRef LIKE :term)', { term });
    qb.orderBy(orderColumn('m', query.sortBy, ['createdAt', 'dueOn', 'referenceCode', 'title'], 'createdAt'), query.sortDir === 'ASC' ? 'ASC' : 'DESC');
    return paginate(qb, query);
  }

  async create(user: AuthUser, dto: CreateManagementRecordDto): Promise<ManagementRecord> {
    this.assertMayCreate(user, dto.kind);
    if (dto.kind === 'OBLIGATION' && !dto.complianceResult) {
      throw new BadRequestException('Record whether this requirement is met');
    }
    if (dto.kind === 'ASPECT' && dto.significant === undefined) {
      throw new BadRequestException('Record whether the aspect is significant');
    }
    if (DUE_REQUIRED.has(dto.kind) && !dto.dueOn) {
      throw new BadRequestException('Record the date this is due or was reviewed');
    }
    if (dto.kind === 'CONTEXT' && !dto.issueOrigin) {
      throw new BadRequestException('Record whether this issue is internal or external');
    }
    if (dto.kind === 'DOCUMENT') {
      if (!dto.documentVersion?.trim()) throw new BadRequestException('Record the document version');
      if (!dto.ownerName?.trim()) throw new BadRequestException('Record who approved or owns this document');
    }
    if (dto.kind === 'COMMUNICATION') {
      if (!dto.audience?.trim()) throw new BadRequestException('Record who this is communicated to');
      if (!dto.frequency?.trim()) throw new BadRequestException('Record how often this is communicated');
    }
    if (dto.kind === 'MONITORING') {
      if (!dto.frequency?.trim()) throw new BadRequestException('Record how often this is measured');
      if (!dto.ownerName?.trim()) throw new BadRequestException('Record who reviews the measurement');
    }
    const scoped = this.scope.enforceWriteScope(user, {
      regionId: dto.regionId ?? user.regionId ?? null,
      districtId: dto.districtId ?? user.districtId ?? null,
    });
    if (!scoped.regionId) throw new BadRequestException('Choose the region');
    const region = await this.orgs.getRegion(user, scoped.regionId);
    const districtCode = scoped.districtId ? (await this.orgs.getDistrict(user, scoped.districtId)).code : 'HQ';
    const saved = await this.records.save(
      this.records.create({
        kind: dto.kind,
        standard: dto.standard,
        title: dto.title.trim(),
        description: dto.description.trim(),
        clauseRef: dto.clauseRef?.trim() || null,
        ownerName: dto.ownerName?.trim() || null,
        regionId: scoped.regionId,
        districtId: scoped.districtId ?? null,
        dueOn: dto.dueOn ? new Date(dto.dueOn) : null,
        complianceResult: dto.kind === 'OBLIGATION' ? dto.complianceResult ?? null : null,
        significant: dto.kind === 'ASPECT' && dto.significant === true,
        issueOrigin: dto.kind === 'CONTEXT' ? dto.issueOrigin ?? null : null,
        documentVersion: dto.kind === 'DOCUMENT' ? dto.documentVersion?.trim() || null : null,
        documentStatus: dto.kind === 'DOCUMENT' ? dto.documentStatus ?? 'DRAFT' : null,
        audience: dto.kind === 'COMMUNICATION' ? dto.audience?.trim() || null : null,
        frequency: dto.kind === 'COMMUNICATION' || dto.kind === 'MONITORING' ? dto.frequency?.trim() || null : null,
        status: 'OPEN',
        referenceCode: await this.nextReference(region.code, districtCode),
      }),
    );
    return this.records.findOneOrFail({ where: { id: saved.id }, relations: ['region', 'district'] });
  }

  async update(user: AuthUser, id: string, dto: UpdateManagementRecordDto): Promise<ManagementRecord> {
    if (!user.permissions.includes(Permission.IMS_MANAGE)) {
      throw new ForbiddenException('A safety officer updates this record');
    }
    const record = await this.records.findOne({ where: { id } });
    if (!record) throw new NotFoundException();
    assertRecordAccess(user, record, record.createdBy);
    if (HEAD_OFFICE_ONLY.has(record.kind) && !isGlobalScope(user.role)) {
      throw new ForbiddenException('Head Office updates the policy and the scope');
    }
    const documentStatus =
      record.kind === 'DOCUMENT' && dto.documentStatus
        ? dto.documentStatus
        : record.kind === 'DOCUMENT' && dto.status === 'CLOSED'
          ? 'SUPERSEDED'
          : undefined;
    await this.records.update(record.id, {
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.description ? { description: dto.description.trim() } : {}),
      ...(record.kind === 'OBLIGATION' && dto.complianceResult ? { complianceResult: dto.complianceResult } : {}),
      ...(documentStatus ? { documentStatus } : {}),
    });
    return this.records.findOneOrFail({ where: { id }, relations: ['region', 'district'] });
  }

  private visible(qb: ReturnType<Repository<ManagementRecord>['createQueryBuilder']>, user: AuthUser) {
    const tenantId = getCurrentTenantId();
    if (tenantId) qb.andWhere('m.tenantId = :tenantId', { tenantId });
    if (reportsInChosenPlace(user.role)) {
      qb.andWhere(
        '(m.kind IN (:...published) OR (m.kind = :consultation AND m.createdBy = :me) OR (m.kind = :document AND m.documentStatus = :current))',
        {
          published: PUBLISHED,
          consultation: 'CONSULTATION',
          me: user.id,
          document: 'DOCUMENT',
          current: 'CURRENT',
        },
      );
      return;
    }
    if (isGlobalScope(user.role)) return;
    if (isRegionalScope(user.role)) {
      qb.andWhere('(m.regionId = :region OR m.kind IN (:...published))', { region: user.regionId, published: PUBLISHED });
      return;
    }
    qb.andWhere('((m.regionId = :region AND m.districtId = :district) OR m.kind IN (:...published))', {
      region: user.regionId,
      district: user.districtId,
      published: PUBLISHED,
    });
  }

  private assertMayCreate(user: AuthUser, kind: string) {
    const manage = user.permissions.includes(Permission.IMS_MANAGE);
    if (kind === 'CONSULTATION' && (manage || user.permissions.includes(Permission.IMS_READ))) return;
    if (!manage) throw new ForbiddenException('A safety officer keeps this register');
    if (HEAD_OFFICE_ONLY.has(kind) && !isGlobalScope(user.role)) {
      throw new ForbiddenException('Head Office approves the policy and the scope');
    }
    if (kind === 'REVIEW' && isDistrictScope(user.role) && isSafetyOfficer(user.role)) {
      throw new ForbiddenException('A management review is recorded by the region or Head Office');
    }
  }

  private async nextReference(regionCode: string, districtCode: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `MS-${year}-${regionCode}-${districtCode}-`;
    const last = await this.records
      .createQueryBuilder('m')
      .where('m.referenceCode LIKE :p', { p: `${prefix}%` })
      .orderBy('m.referenceCode', 'DESC')
      .getOne();
    const next = last ? Number(last.referenceCode.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(Number.isFinite(next) ? next : 1).padStart(5, '0')}`;
  }
}
