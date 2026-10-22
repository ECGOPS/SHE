import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthUser, CorrectiveActionStatus, isDistrictScope, isGlobalScope, PaginatedResult, Role } from '@ecg-she/shared';
import { CorrectiveAction } from './entities/corrective-action.entity';
import { CreateCapaDto, UpdateCapaProgressDto, VerifyCapaDto } from './dto/create-capa.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { RbacScopeService } from '../auth/rbac-scope.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { Incident } from '../incidents/entities/incident.entity';
import { Hazard } from '../hazards/entities/hazard.entity';
import { NearMiss } from '../near-miss/entities/near-miss.entity';
import { Inspection } from '../inspections/entities/inspection.entity';
import { AuditFinding } from '../audits/entities/audit-finding.entity';
import { AuditRecord } from '../audits/entities/audit-record.entity';
import { EnvironmentalEvent } from '../environmental/entities/environmental-event.entity';
import { JsaRecord } from '../jsa/entities/jsa.entity';
import { ManagementRecord } from '../management-system/entities/management-record.entity';
import { applyStatus, orderColumn, paginate, searchTerm } from '../../common/pagination';
import { renderSheReport, reportFilename } from '../../common/pdf/she-report';
import { capaReport } from '../../common/pdf/record-reports';

const LINKED_SOURCES = new Set(['INCIDENT', 'HAZARD', 'NEAR_MISS', 'INSPECTION', 'AUDIT_FINDING', 'ENVIRONMENTAL_EVENT']);
const NEEDS_CAUSE = new Set(['CORRECTIVE_ACTION', 'PREVENTIVE_ACTION']);

@Injectable()
export class CorrectiveActionsService {
  constructor(
    @InjectRepository(CorrectiveAction) private readonly capa: Repository<CorrectiveAction>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Incident) private readonly incidents: Repository<Incident>,
    @InjectRepository(Hazard) private readonly hazards: Repository<Hazard>,
    @InjectRepository(NearMiss) private readonly nearMisses: Repository<NearMiss>,
    @InjectRepository(Inspection) private readonly inspections: Repository<Inspection>,
    @InjectRepository(AuditFinding) private readonly findings: Repository<AuditFinding>,
    @InjectRepository(AuditRecord) private readonly audits: Repository<AuditRecord>,
    @InjectRepository(EnvironmentalEvent) private readonly environmental: Repository<EnvironmentalEvent>,
    @InjectRepository(JsaRecord) private readonly jsas: Repository<JsaRecord>,
    @InjectRepository(ManagementRecord) private readonly management: Repository<ManagementRecord>,
    private readonly scope: RbacScopeService,
    private readonly orgs: OrganizationsService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async create(user: AuthUser, dto: CreateCapaDto): Promise<CorrectiveAction> {
    const scoped = this.scope.enforceWriteScope(user, {
      regionId: dto.regionId ?? user.regionId,
      districtId: dto.districtId ?? user.districtId,
    });
    if (!scoped.regionId) throw new BadRequestException('regionId is required');
    if (dto.assigneeId) await this.requirePerson(user, dto.assigneeId);
    if (dto.sourceType && LINKED_SOURCES.has(dto.sourceType) && !dto.sourceId) {
      throw new BadRequestException('Choose the record this action comes from');
    }
    if (dto.sourceId && dto.sourceType) await this.assertSource(user, dto.sourceType, dto.sourceId, scoped.regionId);

    const region = await this.orgs.getRegion(user, scoped.regionId);
    const districtCode = scoped.districtId
      ? (await this.orgs.getDistrict(user, scoped.districtId)).code
      : 'HQ';
    const referenceCode = await this.generateRef(region.code, districtCode);

    const action = this.capa.create({
      ...dto,
      regionId: scoped.regionId,
      districtId: scoped.districtId ?? null,
      dueDate: new Date(dto.dueDate),
      effectivenessReviewDate: dto.effectivenessReviewDate
        ? new Date(dto.effectivenessReviewDate)
        : null,
      referenceCode,
      status: dto.assigneeId ? CorrectiveActionStatus.ASSIGNED : CorrectiveActionStatus.OPEN,
      priority: dto.priority ?? 'MEDIUM',
      slaDays: dto.slaDays ?? 0,
      actionType: dto.actionType ?? 'CORRECTIVE_ACTION',
    });
    return this.capa.save(action);
  }

  async list(
    user: AuthUser,
    query: PaginationQueryDto & { sourceType?: string; sourceId?: string },
  ): Promise<PaginatedResult<CorrectiveAction>> {
    const qb = this.capa
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.assignee', 'a')
      .leftJoinAndSelect('c.region', 'r')
      .leftJoinAndSelect('c.district', 'd');
    this.scope.applyScopeFilter(qb, user, 'c');
    applyStatus(qb, 'c', query.status);
    const term = searchTerm(query.search);
    if (term) {
      qb.andWhere('(LOWER(c.title) LIKE LOWER(:s) OR LOWER(c.referenceCode) LIKE LOWER(:s))', { s: term });
    }
    if (query.sourceType) qb.andWhere('c.sourceType = :sourceType', { sourceType: query.sourceType });
    if (query.sourceId) qb.andWhere('c.sourceId = :sourceId', { sourceId: query.sourceId });
    qb.orderBy(
      orderColumn('c', query.sortBy, ['dueDate', 'createdAt', 'referenceCode', 'status', 'title'], 'dueDate'),
      query.sortDir === 'DESC' ? 'DESC' : 'ASC',
    );
    const page = await paginate(qb, query);
    const items = await Promise.all(page.items.map(async (row) => Object.assign(row, {
      sourceHref: await this.sourceHref(row),
      protocolHref: this.protocolHref(row),
    })));
    return { ...page, items };
  }

  async get(user: AuthUser, id: string): Promise<CorrectiveAction> {
    const qb = this.capa
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.assignee', 'a')
      .leftJoinAndSelect('c.region', 'r')
      .leftJoinAndSelect('c.district', 'd')
      .where('c.id = :id', { id });
    this.scope.applyScopeFilter(qb, user, 'c');
    const a = await qb.getOne();
    if (!a) throw new NotFoundException('Corrective action not found');
    return Object.assign(a, { sourceHref: await this.sourceHref(a), protocolHref: this.protocolHref(a) });
  }

  async reportPdf(user: AuthUser, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const row = await this.get(user, id);
    const buffer = await renderSheReport(capaReport(row, user.fullName));
    return { buffer, filename: reportFilename(row.referenceCode) };
  }

  async progress(user: AuthUser, id: string, dto: UpdateCapaProgressDto): Promise<CorrectiveAction> {
    const action = await this.get(user, id);
    if (action.status === CorrectiveActionStatus.CLOSED || action.status === CorrectiveActionStatus.REJECTED) {
      throw new BadRequestException('This action is already closed');
    }
    if (dto.assigneeId) {
      await this.requirePerson(user, dto.assigneeId);
      action.assigneeId = dto.assigneeId;
      if (action.status === CorrectiveActionStatus.OPEN) action.status = CorrectiveActionStatus.ASSIGNED;
    }
    if (dto.rootCauseMethod) action.rootCauseMethod = dto.rootCauseMethod;
    if (dto.rootCauseStatement?.trim()) action.rootCauseStatement = dto.rootCauseStatement.trim();
    if (dto.evidenceNotes?.trim()) action.evidenceNotes = dto.evidenceNotes.trim();
    if (dto.protocolUpdateRequired !== undefined) action.protocolUpdateRequired = dto.protocolUpdateRequired;
    if (dto.protocolUpdateNotes !== undefined) {
      action.protocolUpdateNotes = dto.protocolUpdateNotes.trim() || null;
    }
    if (dto.protocolLinkKind !== undefined) action.protocolLinkKind = dto.protocolLinkKind;
    if (dto.protocolLinkId !== undefined) action.protocolLinkId = dto.protocolLinkId;
    if (dto.status === 'IN_PROGRESS') {
      action.status = CorrectiveActionStatus.IN_PROGRESS;
    }
    if (dto.status === 'VERIFICATION') {
      if (action.status !== CorrectiveActionStatus.IN_PROGRESS && action.status !== CorrectiveActionStatus.OVERDUE) {
        throw new BadRequestException('Start the work before sending it for a check');
      }
      if (!action.evidenceNotes?.trim()) throw new BadRequestException('Record what was done');
      if (NEEDS_CAUSE.has(action.actionType) && (!action.rootCauseMethod || !action.rootCauseStatement?.trim())) {
        throw new BadRequestException('Record the cause before this action is checked');
      }
      if (action.protocolUpdateRequired) {
        if (!action.protocolUpdateNotes?.trim()) {
          throw new BadRequestException('Record which protocol, JSA, or procedure was updated');
        }
        if (!action.protocolLinkKind || !action.protocolLinkId) {
          throw new BadRequestException('Link the controlled document, JSA, hazard, or change record that was updated');
        }
        await this.assertProtocolLink(user, action.protocolLinkKind, action.protocolLinkId);
      }
      action.status = CorrectiveActionStatus.VERIFICATION;
      action.completedAt = new Date();
    }
    return this.capa.save(action);
  }

  async verify(user: AuthUser, id: string, dto: VerifyCapaDto): Promise<CorrectiveAction> {
    const action = await this.get(user, id);
    if (action.status !== CorrectiveActionStatus.VERIFICATION) {
      throw new BadRequestException('This action is not ready for a check');
    }
    if (action.assigneeId && action.assigneeId === user.id) {
      throw new BadRequestException('The person who owns the action cannot check their own work');
    }
    action.effectivenessOutcome = dto.effectivenessOutcome;
    action.effectivenessNotes = dto.notes?.trim() || null;
    action.verifiedAt = new Date();
    action.verifiedById = user.id;
    if (dto.effectivenessOutcome === 'EFFECTIVE') {
      action.status = CorrectiveActionStatus.CLOSED;
      action.closedAt = new Date();
      if (action.protocolLinkKind === 'DOCUMENT' && action.protocolLinkId) {
        await this.management.update(
          { id: action.protocolLinkId, kind: 'DOCUMENT' },
          { documentStatus: 'CURRENT' },
        );
      }
      if (action.protocolLinkKind === 'CHANGE' && action.protocolLinkId) {
        await this.management.update({ id: action.protocolLinkId, kind: 'CHANGE' }, { status: 'CLOSED' });
      }
    } else {
      action.status = CorrectiveActionStatus.IN_PROGRESS;
      action.completedAt = null;
    }
    return this.capa.save(action);
  }

  people(user: AuthUser): Promise<Array<{ id: string; fullName: string; role: Role }>> {
    const qb = this.users.createQueryBuilder('u').select(['u.id', 'u.fullName', 'u.role']).where('u.active = :active', { active: true }).orderBy('u.fullName', 'ASC');
    if (!isGlobalScope(user.role)) qb.andWhere('u.regionId = :regionId', { regionId: user.regionId });
    if (isDistrictScope(user.role)) qb.andWhere('(u.districtId = :districtId OR u.districtId IS NULL)', { districtId: user.districtId });
    return qb.getMany();
  }

  async stats(user: AuthUser) {
    const qb = this.capa.createQueryBuilder('c');
    this.scope.applyScopeFilter(qb, user, 'c');
    const rows = await qb
      .select('c.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('c.status')
      .getRawMany<{ status: string; count: string }>();
    const overdue = await this.capa
      .createQueryBuilder('c')
      .where('c.dueDate < :now', { now: new Date() })
      .andWhere('c.status NOT IN (:...closed)', {
        closed: [CorrectiveActionStatus.CLOSED, CorrectiveActionStatus.REJECTED],
      });
    this.scope.applyScopeFilter(overdue, user, 'c');
    return {
      byStatus: rows.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = Number(r.count);
        return acc;
      }, {}),
      overdue: await overdue.getCount(),
    };
  }

  /**
   * Background job — every hour mark overdue CAPAs and emit notifications.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async escalateOverdue(): Promise<void> {
    const overdue = await this.capa.find({
      where: {
        dueDate: LessThan(new Date()),
        status: In([CorrectiveActionStatus.OPEN, CorrectiveActionStatus.ASSIGNED, CorrectiveActionStatus.IN_PROGRESS]),
      },
    });
    for (const a of overdue) {
      a.status = CorrectiveActionStatus.OVERDUE;
      await this.capa.save(a);
      this.realtime.emitToScope(a.regionId, a.districtId ?? undefined, 'capa:overdue', {
        id: a.id,
        title: a.title,
        dueDate: a.dueDate,
      });
      await this.notifications.broadcastToScope({
        topic: 'capa.overdue',
        title: `Overdue corrective action · ${a.referenceCode}`,
        body: `${a.title} was due on ${a.dueDate.toISOString().slice(0, 10)}.`,
        regionId: a.regionId,
        districtId: a.districtId ?? null,
        payload: { capaId: a.id, route: `/capa/${a.id}` },
        priority: 'HIGH',
      });
    }
  }

  private async generateRef(regionCode: string, districtCode: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CAPA-${year}-${regionCode}-${districtCode}-`;
    const last = await this.capa
      .createQueryBuilder('c')
      .where('c.referenceCode LIKE :p', { p: `${prefix}%` })
      .orderBy('c.referenceCode', 'DESC')
      .getOne();
    const next = last ? Number(last.referenceCode.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(next).padStart(5, '0')}`;
  }

  private async requirePerson(user: AuthUser, id: string): Promise<void> {
    const person = await this.users.findOne({ where: { id } });
    if (!person) throw new BadRequestException('Choose a person from the list');
    if (!isGlobalScope(user.role) && person.regionId && person.regionId !== user.regionId) {
      throw new BadRequestException('That person is outside your region');
    }
  }

  private protocolHref(action: CorrectiveAction): string | null {
    if (!action.protocolLinkKind || !action.protocolLinkId) return null;
    if (action.protocolLinkKind === 'HAZARD') return `/hazards/${action.protocolLinkId}`;
    if (action.protocolLinkKind === 'JSA') return `/jsa/${action.protocolLinkId}`;
    return '/management';
  }

  private async assertProtocolLink(user: AuthUser, kind: string, id: string): Promise<void> {
    if (kind === 'HAZARD') {
      const row = await this.hazards.findOne({ where: { id } });
      if (!row) throw new BadRequestException('That hazard was not found');
      if (!isGlobalScope(user.role) && row.regionId !== user.regionId) {
        throw new BadRequestException('That hazard is outside your region');
      }
      return;
    }
    if (kind === 'JSA') {
      const row = await this.jsas.findOne({ where: { id } });
      if (!row) throw new BadRequestException('That JSA was not found');
      if (!isGlobalScope(user.role) && row.regionId !== user.regionId) {
        throw new BadRequestException('That JSA is outside your region');
      }
      return;
    }
    const expectedKind = kind === 'CHANGE' ? 'CHANGE' : 'DOCUMENT';
    const row = await this.management.findOne({ where: { id, kind: expectedKind } });
    if (!row) throw new BadRequestException('That management record was not found');
    if (!isGlobalScope(user.role) && row.regionId !== user.regionId) {
      throw new BadRequestException('That record is outside your region');
    }
  }

  private async sourceHref(action: CorrectiveAction): Promise<string | null> {
    if (!action.sourceType || !action.sourceId) return null;
    if (action.sourceType === 'INCIDENT') return `/incidents/${action.sourceId}`;
    if (action.sourceType === 'HAZARD') return `/hazards/${action.sourceId}`;
    if (action.sourceType === 'NEAR_MISS') return `/near-miss/${action.sourceId}`;
    if (action.sourceType === 'INSPECTION') return `/inspections/${action.sourceId}`;
    if (action.sourceType === 'ENVIRONMENTAL_EVENT') return `/environmental/${action.sourceId}`;
    if (action.sourceType === 'AUDIT_FINDING') {
      const finding = await this.findings.findOne({ where: { id: action.sourceId } });
      return finding ? `/audits/${finding.auditId}` : null;
    }
    return null;
  }

  private async assertSource(user: AuthUser, sourceType: string, sourceId: string, regionId: string): Promise<void> {
    let foundRegion: string | null = null;
    if (sourceType === 'INCIDENT') foundRegion = (await this.incidents.findOne({ where: { id: sourceId } }))?.regionId ?? null;
    else if (sourceType === 'HAZARD') foundRegion = (await this.hazards.findOne({ where: { id: sourceId } }))?.regionId ?? null;
    else if (sourceType === 'NEAR_MISS') foundRegion = (await this.nearMisses.findOne({ where: { id: sourceId } }))?.regionId ?? null;
    else if (sourceType === 'INSPECTION') foundRegion = (await this.inspections.findOne({ where: { id: sourceId } }))?.regionId ?? null;
    else if (sourceType === 'ENVIRONMENTAL_EVENT') foundRegion = (await this.environmental.findOne({ where: { id: sourceId } }))?.regionId ?? null;
    else if (sourceType === 'AUDIT_FINDING') {
      const finding = await this.findings.findOne({ where: { id: sourceId } });
      const audit = finding ? await this.audits.findOne({ where: { id: finding.auditId } }) : null;
      foundRegion = audit?.regionId ?? null;
    }
    if (!foundRegion) throw new BadRequestException('That source record was not found');
    if (!isGlobalScope(user.role) && foundRegion !== regionId) {
      throw new BadRequestException('That record is outside your region');
    }
  }
}
