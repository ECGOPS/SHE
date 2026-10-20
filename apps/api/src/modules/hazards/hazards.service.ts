import { randomUUID } from 'crypto';
import { mkdir, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuthUser,
  EscalationEntityType,
  classifyRisk,
  computeRiskScore,
  isDistrictScope,
  issueScopeForRole,
  PaginatedResult,
  Permission,
  RiskLikelihood,
  RiskSeverity,
  Role,
} from '@ecg-she/shared';
import { Hazard } from './entities/hazard.entity';
import { HazardAttachment } from './entities/hazard-attachment.entity';
import { CreateHazardDto } from './dto/create-hazard.dto';
import { ReviewHazardDto } from './dto/review-hazard.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { RbacScopeService } from '../auth/rbac-scope.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { applyStatus, orderColumn, paginate, searchTerm, statusList } from '../../common/pagination';
import { decodeUpload } from '../../common/validation/uploads';
import { CorrectiveAction } from '../corrective-actions/entities/corrective-action.entity';
import { IssueEscalation } from '../escalations/entities/issue-escalation.entity';
import { renderSheReport, reportFilename } from '../../common/pdf/she-report';
import { hazardReport } from '../../common/pdf/record-reports';

const HIGH_RISK = new Set(['HIGH', 'EXTREME']);

/** A high or extreme hazard closes only with a control, and either an action or a written decision that none is required. */
export async function assertHazardCloseable(
  capa: Repository<CorrectiveAction>,
  hazard: Pick<Hazard, 'id' | 'riskClass' | 'controlHierarchy' | 'controlMeasures'>,
  notes: string,
  noFurtherAction: boolean,
): Promise<void> {
  if (!HIGH_RISK.has(String(hazard.riskClass ?? ''))) return;
  if (!(hazard.controlHierarchy || hazard.controlMeasures?.trim())) {
    throw new BadRequestException('Record the control before closing a high or extreme hazard.');
  }
  if (noFurtherAction) {
    if (!notes.trim()) throw new BadRequestException('Say why no further action is required.');
    return;
  }
  const actions = await capa.count({ where: { sourceType: 'HAZARD', sourceId: hazard.id } });
  if (actions < 1) {
    throw new BadRequestException(
      'Raise a corrective action, or record that no further action is required, before closing a high or extreme hazard.',
    );
  }
}

@Injectable()
export class HazardsService {
  constructor(
    @InjectRepository(Hazard) private readonly hazards: Repository<Hazard>,
    @InjectRepository(HazardAttachment) private readonly attachments: Repository<HazardAttachment>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(CorrectiveAction) private readonly capa: Repository<CorrectiveAction>,
    @InjectRepository(IssueEscalation) private readonly escalations: Repository<IssueEscalation>,
    private readonly scope: RbacScopeService,
    private readonly orgs: OrganizationsService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async create(user: AuthUser, dto: CreateHazardDto): Promise<Hazard> {
    const scoped = this.scope.enforceWriteScope(user, {
      regionId: dto.regionId ?? user.regionId,
      districtId: dto.districtId ?? user.districtId,
    });
    if (!scoped.regionId) throw new BadRequestException('regionId is required');

    if (dto.offlineClientId) {
      const existing = await this.hazards.findOne({ where: { offlineClientId: dto.offlineClientId } });
      if (existing) return this.get(user, existing.id);
    }

    const region = await this.orgs.getRegion(user, scoped.regionId);
    const districtCode = scoped.districtId
      ? (await this.orgs.getDistrict(user, scoped.districtId)).code
      : 'HQ';

    const rated = dto.likelihood && dto.severity;
    const score = rated ? computeRiskScore(dto.likelihood as RiskLikelihood, dto.severity as RiskSeverity) : null;
    const riskClass = score == null ? null : classifyRisk(score);
    const residualRiskScore =
      dto.residualLikelihood && dto.residualSeverity
        ? computeRiskScore(dto.residualLikelihood as RiskLikelihood, dto.residualSeverity as RiskSeverity)
        : null;

    const { photos, ...fields } = dto;
    const hazard = this.hazards.create({
      ...fields,
      regionId: scoped.regionId,
      districtId: scoped.districtId ?? null,
      reportedById: user.id,
      referenceCode: await this.generateReferenceCode(region.code, districtCode),
      riskScore: score,
      riskClass,
      residualRiskScore,
      peopleExposed: dto.peopleExposed === true,
      targetCompletionDate: dto.targetCompletionDate ? new Date(dto.targetCompletionDate) : null,
      currentScope: issueScopeForRole(user.role),
      status: 'OPEN',
    });

    const saved = await this.hazards.save(hazard);
    if (photos?.length) await this.savePhotos(saved.id, photos);
    this.notifyHighRisk(saved, user.id);
    return this.get(user, saved.id);
  }

  async list(user: AuthUser, query: PaginationQueryDto & { riskClass?: string }): Promise<PaginatedResult<Hazard>> {
    const qb = this.hazards
      .createQueryBuilder('h')
      .leftJoinAndSelect('h.region', 'region')
      .leftJoinAndSelect('h.district', 'district')
      .leftJoin('h.reportedBy', 'reporter')
      .addSelect(['reporter.id', 'reporter.fullName']);
    this.scope.applyScopeFilter(qb, user, 'h', 'reportedById');
    applyStatus(qb, 'h', query.status);
    const classes = statusList(query.riskClass);
    if (classes.length) qb.andWhere('h.riskClass IN (:...riskClasses)', { riskClasses: classes });
    const term = searchTerm(query.search);
    if (term) {
      qb.andWhere('(LOWER(h.title) LIKE LOWER(:s) OR LOWER(h.referenceCode) LIKE LOWER(:s))', { s: term });
    }
    qb.orderBy(
      orderColumn('h', query.sortBy, ['createdAt', 'referenceCode', 'riskScore', 'status', 'title'], 'createdAt'),
      query.sortDir === 'ASC' ? 'ASC' : 'DESC',
    );
    return paginate(qb, query);
  }

  async get(user: AuthUser, id: string): Promise<Hazard> {
    const qb = this.baseQuery().where('h.id = :id', { id });
    this.scope.applyScopeFilter(qb, user, 'h', 'reportedById');
    const hazard = await qb.getOne();
    if (!hazard) throw new NotFoundException('Hazard not found');
    return hazard;
  }

  async reportPdf(user: AuthUser, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const row = await this.get(user, id);
    const [actions, history] = await Promise.all([
      this.capa.find({ where: { sourceType: 'HAZARD', sourceId: id }, relations: ['assignee'], order: { dueDate: 'ASC' } }),
      this.escalations.find({ where: { entityType: EscalationEntityType.HAZARD, entityId: id }, relations: ['fromUser'], order: { createdAt: 'ASC' } }),
    ]);
    const buffer = await renderSheReport(hazardReport(row, actions, history, user.fullName));
    return { buffer, filename: reportFilename(row.referenceCode) };
  }

  async assignees(user: AuthUser, id: string): Promise<Array<{ id: string; fullName: string; role: Role }>> {
    const hazard = await this.get(user, id);
    const qb = this.users
      .createQueryBuilder('u')
      .select(['u.id', 'u.fullName', 'u.role'])
      .where('u.active = :active', { active: true })
      .andWhere('u.role IN (:...officerRoles)', {
        officerRoles: [Role.DISTRICT_SAFETY_OFFICER, Role.REGIONAL_SAFETY_OFFICER, Role.GLOBAL_SAFETY_OFFICER],
      })
      .andWhere('(u.role = :globalOfficer OR u.regionId = :regionId)', {
        globalOfficer: Role.GLOBAL_SAFETY_OFFICER,
        regionId: hazard.regionId,
      })
      .orderBy('u.fullName', 'ASC');
    if (isDistrictScope(user.role) && hazard.districtId) {
      qb.andWhere('(u.role <> :districtOfficer OR u.districtId = :districtId)', {
        districtOfficer: Role.DISTRICT_SAFETY_OFFICER,
        districtId: hazard.districtId,
      });
    }
    return qb.getMany();
  }

  async review(user: AuthUser, id: string, dto: ReviewHazardDto): Promise<Hazard> {
    this.assertCanReview(user);
    const hazard = await this.editable(user, id);
    const likelihood = dto.likelihood ?? hazard.likelihood;
    const severity = dto.severity ?? hazard.severity;
    const rated = likelihood && severity;
    const controlHierarchy = dto.controlHierarchy === undefined ? hazard.controlHierarchy : dto.controlHierarchy || null;
    const controlMeasures = dto.controlMeasures === undefined ? hazard.controlMeasures : dto.controlMeasures || null;
    const hasControl = !!(controlHierarchy || controlMeasures?.trim());

    let mitigationOwnerId = hazard.mitigationOwnerId ?? null;
    if (dto.mitigationOwnerId !== undefined) {
      if (!dto.mitigationOwnerId) {
        mitigationOwnerId = null;
      } else {
        const allowed = await this.assignees(user, id);
        if (!allowed.some((person) => person.id === dto.mitigationOwnerId)) {
          throw new BadRequestException('That owner is outside this hazard region or district');
        }
        mitigationOwnerId = dto.mitigationOwnerId;
      }
    }

    const residualLikelihood = dto.residualLikelihood === undefined ? hazard.residualLikelihood : dto.residualLikelihood || null;
    const residualSeverity = dto.residualSeverity === undefined ? hazard.residualSeverity : dto.residualSeverity || null;

    await this.hazards.update(hazard.id, {
      likelihood: likelihood || null,
      severity: severity || null,
      riskScore: rated ? computeRiskScore(likelihood as RiskLikelihood, severity as RiskSeverity) : null,
      riskClass: rated ? classifyRisk(computeRiskScore(likelihood as RiskLikelihood, severity as RiskSeverity)) : null,
      existingControls: dto.existingControls === undefined ? hazard.existingControls : dto.existingControls || null,
      controlHierarchy,
      controlMeasures,
      residualLikelihood,
      residualSeverity,
      residualRiskScore:
        residualLikelihood && residualSeverity
          ? computeRiskScore(residualLikelihood as RiskLikelihood, residualSeverity as RiskSeverity)
          : null,
      targetCompletionDate:
        dto.targetCompletionDate === undefined
          ? hazard.targetCompletionDate
          : dto.targetCompletionDate
            ? new Date(dto.targetCompletionDate)
            : null,
      mitigationOwnerId,
      status: hasControl
        ? hazard.status === 'OPEN' ? 'MITIGATED' : hazard.status
        : hazard.status === 'MITIGATED' ? 'OPEN' : hazard.status,
    });

    const saved = await this.get(user, id);
    if (rated && HIGH_RISK.has(String(saved.riskClass)) && saved.riskClass !== hazard.riskClass) {
      this.notifyHighRisk(saved, user.id);
    }
    return saved;
  }

  async close(user: AuthUser, id: string, notes: string, noFurtherAction = false): Promise<Hazard> {
    this.assertCanReview(user);
    if (!notes.trim()) throw new BadRequestException('Say how this hazard was controlled');
    const hazard = await this.editable(user, id);
    await assertHazardCloseable(this.capa, hazard, notes, noFurtherAction);
    const closedAt = new Date();
    await this.hazards.update(hazard.id, {
      status: 'CLOSED',
      resolvedAt: closedAt,
      resolvedById: user.id,
      resolvedAtScope: issueScopeForRole(user.role),
      resolutionNotes: notes.trim(),
    });
    const saved = await this.get(user, id);
    this.tellReporter(hazard, user.id, `Hazard controlled · ${saved.referenceCode}`, notes.trim());
    return saved;
  }

  async getAttachmentFile(
    user: AuthUser,
    hazardId: string,
    attachmentId: string,
  ): Promise<{ absolutePath: string; mimeType: string; fileName: string }> {
    await this.get(user, hazardId);
    const attachment = await this.attachments.findOne({ where: { id: attachmentId, hazardId } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    const absolutePath = join(process.cwd(), 'data', attachment.storageKey);
    try {
      await stat(absolutePath);
    } catch {
      throw new NotFoundException('Attachment file not found');
    }
    return { absolutePath, mimeType: attachment.mimeType, fileName: attachment.fileName };
  }

  async stats(user: AuthUser) {
    const qb = this.hazards.createQueryBuilder('h');
    this.scope.applyScopeFilter(qb, user, 'h', 'reportedById');
    const rows = await qb
      .select('h.riskClass', 'riskClass')
      .addSelect('COUNT(*)', 'count')
      .groupBy('h.riskClass')
      .getRawMany<{ riskClass: string; count: string }>();
    return rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.riskClass] = Number(r.count);
      return acc;
    }, {});
  }

  private baseQuery() {
    return this.hazards
      .createQueryBuilder('h')
      .leftJoinAndSelect('h.region', 'region')
      .leftJoinAndSelect('h.district', 'district')
      .leftJoin('h.reportedBy', 'reporter')
      .addSelect(['reporter.id', 'reporter.fullName'])
      .leftJoin('h.mitigationOwner', 'owner')
      .addSelect(['owner.id', 'owner.fullName'])
      .leftJoinAndSelect('h.attachments', 'attachments');
  }

  private async editable(user: AuthUser, id: string): Promise<Hazard> {
    const hazard = await this.get(user, id);
    if (hazard.status === 'CLOSED' || hazard.resolvedAt) {
      throw new BadRequestException('This hazard is already closed');
    }
    return hazard;
  }

  private assertCanReview(user: AuthUser): void {
    if (user.role === Role.SYS_ADMIN || user.permissions.includes(Permission.HAZARD_APPROVE)) return;
    throw new ForbiddenException('A safety officer reviews a hazard');
  }

  private notifyHighRisk(hazard: Hazard, actorId: string): void {
    if (!HIGH_RISK.has(String(hazard.riskClass ?? ''))) return;
    this.realtime.emitToScope(hazard.regionId, hazard.districtId ?? undefined, 'hazard:high-risk', {
      id: hazard.id,
      title: hazard.title,
      riskClass: hazard.riskClass,
      riskScore: hazard.riskScore,
    });
    void this.notifications.broadcastToScope({
      topic: 'hazard.high-risk',
      title: `${hazard.riskClass} hazard · ${hazard.referenceCode}`,
      body: `${hazard.title}${hazard.riskScore ? ` (risk score ${hazard.riskScore})` : ''}`,
      regionId: hazard.regionId,
      districtId: hazard.districtId ?? null,
      payload: { hazardId: hazard.id, riskClass: hazard.riskClass, route: `/hazards/${hazard.id}` },
      priority: hazard.riskClass === 'EXTREME' ? 'CRITICAL' : 'HIGH',
      excludeUserId: actorId,
    });
  }

  private tellReporter(hazard: Hazard, actorId: string, title: string, body: string): void {
    if (!hazard.reportedById || hazard.reportedById === actorId) return;
    void this.notifications
      .notifyUser({
        recipientId: hazard.reportedById,
        topic: 'hazard.outcome',
        title,
        body,
        payload: { hazardId: hazard.id, route: `/hazards/${hazard.id}` },
        priority: 'NORMAL',
      })
      .catch(() => undefined);
  }

  private async savePhotos(
    hazardId: string,
    photos: NonNullable<CreateHazardDto['photos']>,
  ): Promise<void> {
    if (photos.length > 4) throw new BadRequestException('A hazard can include up to 4 photos');
    const uploadDir = join(process.cwd(), 'data', 'uploads', 'hazards', hazardId);
    await mkdir(uploadDir, { recursive: true });
    const rows: HazardAttachment[] = [];
    for (const photo of photos) {
      const { buffer } = decodeUpload(photo.dataUrl, photo.mimeType, 'image');
      const safeName = (photo.fileName || 'photo').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      const storedName = `${randomUUID()}-${safeName}`;
      const relativeKey = join('uploads', 'hazards', hazardId, storedName).replace(/\\/g, '/');
      await writeFile(join(uploadDir, storedName), buffer);
      rows.push(
        this.attachments.create({
          hazardId,
          fileName: photo.fileName || storedName,
          storageKey: relativeKey,
          mimeType: photo.mimeType,
          sizeBytes: buffer.byteLength,
        }),
      );
    }
    await this.attachments.save(rows);
  }

  private async generateReferenceCode(regionCode: string, districtCode: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `HZ-${year}-${regionCode}-${districtCode}-`;
    const last = await this.hazards
      .createQueryBuilder('h')
      .where('h.referenceCode LIKE :p', { p: `${prefix}%` })
      .orderBy('h.referenceCode', 'DESC')
      .getOne();
    const next = last ? Number(last.referenceCode.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(Number.isFinite(next) ? next : 1).padStart(5, '0')}`;
  }
}
