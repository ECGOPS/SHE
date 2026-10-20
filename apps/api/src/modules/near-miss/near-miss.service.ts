import { randomUUID } from 'crypto';
import { mkdir, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuthUser,
  EscalationEntityType,
  isDistrictScope,
  issueScopeForRole,
  PaginatedResult,
  Permission,
  Role,
} from '@ecg-she/shared';
import { NearMiss } from './entities/near-miss.entity';
import { NearMissAttachment } from './entities/near-miss-attachment.entity';
import { User } from '../users/entities/user.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { applyStatus, paginate, searchTerm } from '../../common/pagination';
import { decodeUpload } from '../../common/validation/uploads';
import { CorrectiveAction } from '../corrective-actions/entities/corrective-action.entity';
import { IssueEscalation } from '../escalations/entities/issue-escalation.entity';
import { renderSheReport, reportFilename } from '../../common/pdf/she-report';
import { nearMissReport } from '../../common/pdf/record-reports';
import { RbacScopeService } from '../auth/rbac-scope.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateNearMissDto, NearMissPhotoDto, ReviewNearMissDto } from './dto/near-miss.dto';

const HIGH_POTENTIAL = new Set(['MAJOR', 'CATASTROPHIC']);

/** A major or catastrophic near miss closes only with a cause, and either an action or an explicit decision that none is required. */
export async function assertNearMissCloseable(
  capa: Repository<CorrectiveAction>,
  nearMiss: Pick<NearMiss, 'id' | 'severityPotential' | 'immediateCause' | 'rootCause'>,
  notes: string,
  noFurtherAction: boolean,
): Promise<void> {
  const potential = String(nearMiss.severityPotential ?? '').toUpperCase();
  if (!HIGH_POTENTIAL.has(potential)) return;
  if (!(nearMiss.immediateCause?.trim() || nearMiss.rootCause?.trim())) {
    throw new BadRequestException(
      'Record an immediate or system cause before closing a major or catastrophic near miss.',
    );
  }
  if (noFurtherAction) {
    if (!notes.trim()) throw new BadRequestException('Say why no further action is required.');
    return;
  }
  const actions = await capa.count({ where: { sourceType: 'NEAR_MISS', sourceId: nearMiss.id } });
  if (actions < 1) {
    throw new BadRequestException(
      'Raise a corrective action, or record that no further action is required, before closing a major or catastrophic near miss.',
    );
  }
}

@Injectable()
export class NearMissService {
  constructor(
    @InjectRepository(NearMiss) private readonly repo: Repository<NearMiss>,
    @InjectRepository(NearMissAttachment) private readonly attachments: Repository<NearMissAttachment>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(CorrectiveAction) private readonly capa: Repository<CorrectiveAction>,
    @InjectRepository(IssueEscalation) private readonly escalations: Repository<IssueEscalation>,
    private readonly scope: RbacScopeService,
    private readonly orgs: OrganizationsService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async create(user: AuthUser, dto: CreateNearMissDto): Promise<NearMiss> {
    if (dto.offlineClientId) {
      const existing = await this.repo.findOne({ where: { offlineClientId: dto.offlineClientId } });
      if (existing) return this.get(user, existing.id);
    }

    const scoped = this.scope.enforceWriteScope(user, {
      regionId: dto.regionId ?? user.regionId,
      districtId: dto.districtId ?? user.districtId,
    });
    if (!scoped.regionId) throw new BadRequestException('regionId required');

    const region = await this.orgs.getRegion(user, scoped.regionId);
    const districtCode = scoped.districtId
      ? (await this.orgs.getDistrict(user, scoped.districtId)).code
      : 'HQ';
    const referenceCode = await this.generateReferenceCode(region.code, districtCode);
    const { photos, ...fields } = dto;

    const e = this.repo.create({
      ...fields,
      regionId: scoped.regionId,
      districtId: scoped.districtId ?? null,
      occurredAt: new Date(dto.occurredAt),
      reportedById: user.id,
      referenceCode,
      status: 'REPORTED',
      currentScope: issueScopeForRole(user.role),
      immediateCause: null,
      rootCause: null,
      witnessStatement: null,
    });
    const saved = await this.repo.save(e);
    if (photos?.length) await this.savePhotos(saved.id, photos);

    this.realtime.emitToScope(saved.regionId, saved.districtId ?? undefined, 'near-miss:created', {
      id: saved.id,
      title: saved.title,
      severityPotential: saved.severityPotential,
      regionId: saved.regionId,
      districtId: saved.districtId,
    });

    const potential = String(saved.severityPotential ?? '').toUpperCase();
    const priority = potential === 'CATASTROPHIC' ? 'CRITICAL' : HIGH_POTENTIAL.has(potential) ? 'HIGH' : 'NORMAL';
    void this.notifications.broadcastToScope({
      topic: 'near-miss.created',
      title: `Near-miss · ${saved.referenceCode}`,
      body: `${potential || 'Unrated'} potential — ${saved.title}`,
      regionId: saved.regionId,
      districtId: saved.districtId ?? null,
      payload: { nearMissId: saved.id, route: `/near-miss/${saved.id}` },
      priority,
      excludeUserId: user.id,
    });

    return this.get(user, saved.id);
  }

  async list(user: AuthUser, query: PaginationQueryDto): Promise<PaginatedResult<NearMiss>> {
    const qb = this.repo
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.region', 'region')
      .leftJoinAndSelect('n.district', 'district')
      .leftJoin('n.reportedBy', 'reporter')
      .addSelect(['reporter.id', 'reporter.fullName'])
      .orderBy('n.occurredAt', 'DESC');
    this.scope.applyScopeFilter(qb, user, 'n', 'reportedById');
    applyStatus(qb, 'n', query.status);
    const term = searchTerm(query.search);
    if (term) qb.andWhere('(LOWER(n.title) LIKE LOWER(:s) OR LOWER(n.referenceCode) LIKE LOWER(:s))', { s: term });
    const page = await paginate(qb, query);
    return { ...page, items: page.items.map((row) => this.present(row, user)) };
  }

  async get(user: AuthUser, id: string): Promise<NearMiss> {
    const qb = this.baseQuery().where('n.id = :id', { id });
    this.scope.applyScopeFilter(qb, user, 'n', 'reportedById');
    const e = await qb.getOne();
    if (!e) throw new NotFoundException('Not found');
    return this.present(e, user);
  }

  async reportPdf(user: AuthUser, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const row = await this.get(user, id);
    const [actions, history] = await Promise.all([
      this.capa.find({ where: { sourceType: 'NEAR_MISS', sourceId: id }, relations: ['assignee'], order: { dueDate: 'ASC' } }),
      this.escalations.find({ where: { entityType: EscalationEntityType.NEAR_MISS, entityId: id }, relations: ['fromUser'], order: { createdAt: 'ASC' } }),
    ]);
    const buffer = await renderSheReport(nearMissReport(row, actions, history, user.fullName));
    return { buffer, filename: reportFilename(row.referenceCode) };
  }

  async assignees(user: AuthUser, id: string): Promise<Array<{ id: string; fullName: string; role: Role }>> {
    const nearMiss = await this.get(user, id);
    const qb = this.users
      .createQueryBuilder('u')
      .select(['u.id', 'u.fullName', 'u.role'])
      .where('u.active = :active', { active: true })
      .andWhere('u.role IN (:...officerRoles)', {
        officerRoles: [Role.DISTRICT_SAFETY_OFFICER, Role.REGIONAL_SAFETY_OFFICER, Role.GLOBAL_SAFETY_OFFICER],
      })
      .andWhere('(u.role = :globalOfficer OR u.regionId = :regionId)', {
        globalOfficer: Role.GLOBAL_SAFETY_OFFICER,
        regionId: nearMiss.regionId,
      })
      .orderBy('u.fullName', 'ASC');
    if (isDistrictScope(user.role) && nearMiss.districtId) {
      qb.andWhere('(u.role <> :districtOfficer OR u.districtId = :districtId)', {
        districtOfficer: Role.DISTRICT_SAFETY_OFFICER,
        districtId: nearMiss.districtId,
      });
    }
    return qb.getMany();
  }

  async review(user: AuthUser, id: string, dto: ReviewNearMissDto): Promise<NearMiss> {
    this.assertCanReview(user);
    const nearMiss = await this.editable(user, id);
    const patch: Partial<NearMiss> = {};
    if (dto.immediateCause !== undefined) patch.immediateCause = dto.immediateCause || null;
    if (dto.rootCause !== undefined) patch.rootCause = dto.rootCause || null;
    if (dto.witnessStatement !== undefined) patch.witnessStatement = dto.witnessStatement || null;
    if (dto.severityPotential) patch.severityPotential = dto.severityPotential;
    if (nearMiss.status === 'OPEN' || nearMiss.status === 'REPORTED') patch.status = 'UNDER_REVIEW';
    await this.repo.update(nearMiss.id, patch);
    return this.get(user, id);
  }

  async assign(user: AuthUser, id: string, investigatorId: string): Promise<NearMiss> {
    this.assertCanReview(user);
    const nearMiss = await this.editable(user, id);
    const allowed = await this.assignees(user, id);
    if (!allowed.some((person) => person.id === investigatorId)) {
      throw new BadRequestException('That person is outside this near-miss region or district');
    }
    const previous = nearMiss.investigatorId;
    const patch: Partial<NearMiss> = { investigatorId };
    if (nearMiss.status === 'OPEN' || nearMiss.status === 'REPORTED') patch.status = 'UNDER_REVIEW';
    await this.repo.update(nearMiss.id, patch);
    const saved = await this.get(user, id);
    if (investigatorId !== previous && investigatorId !== user.id) {
      void this.notifications
        .notifyUser({
          recipientId: investigatorId,
          topic: 'near-miss.assigned',
          title: `Near-miss assigned to you · ${saved.referenceCode}`,
          body: `${saved.severityPotential ?? 'Unrated'} potential — ${saved.title}`,
          payload: { nearMissId: saved.id, route: `/near-miss/${saved.id}` },
          priority: 'HIGH',
        })
        .catch(() => undefined);
    }
    return saved;
  }

  async close(user: AuthUser, id: string, notes: string, noFurtherAction = false): Promise<NearMiss> {
    this.assertCanReview(user);
    if (!notes.trim()) throw new BadRequestException('Say how this near-miss was reviewed');
    const nearMiss = await this.editable(user, id);
    await assertNearMissCloseable(this.capa, nearMiss, notes, noFurtherAction);
    const closedAt = new Date();
    await this.repo.update(nearMiss.id, {
      status: 'CLOSED',
      closedAt,
      resolvedAt: closedAt,
      resolvedById: user.id,
      resolvedAtScope: issueScopeForRole(user.role),
      resolutionNotes: notes.trim(),
    });
    const saved = await this.get(user, id);
    this.tellReporter(
      nearMiss,
      user.id,
      `Near-miss reviewed · ${saved.referenceCode}`,
      notes.trim(),
    );
    return saved;
  }

  async getAttachmentFile(
    user: AuthUser,
    nearMissId: string,
    attachmentId: string,
  ): Promise<{ absolutePath: string; mimeType: string; fileName: string }> {
    await this.get(user, nearMissId);
    const attachment = await this.attachments.findOne({ where: { id: attachmentId, nearMissId } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    const absolutePath = join(process.cwd(), 'data', attachment.storageKey);
    try {
      await stat(absolutePath);
    } catch {
      throw new NotFoundException('Attachment file not found');
    }
    return { absolutePath, mimeType: attachment.mimeType, fileName: attachment.fileName };
  }

  private baseQuery() {
    return this.repo
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.region', 'region')
      .leftJoinAndSelect('n.district', 'district')
      .leftJoin('n.reportedBy', 'reporter')
      .addSelect(['reporter.id', 'reporter.fullName'])
      .leftJoin('n.investigator', 'investigator')
      .addSelect(['investigator.id', 'investigator.fullName'])
      .leftJoinAndSelect('n.attachments', 'attachments');
  }

  /**
   * A confidential report keeps the reporter on file for the safety officer and for
   * outcome feedback. Everyone else sees the report without a name.
   */
  private present(row: NearMiss, viewer: AuthUser): NearMiss {
    const canSeeName = !row.anonymous || this.canReview(viewer) || row.reportedById === viewer.id;
    if (canSeeName) return row;
    row.reportedById = null;
    row.reportedBy = null;
    row.createdBy = null;
    for (const photo of row.attachments ?? []) {
      photo.createdBy = null;
      photo.updatedBy = null;
    }
    return row;
  }

  private tellReporter(nearMiss: NearMiss, actorId: string, title: string, body: string): void {
    if (!nearMiss.reportedById || nearMiss.reportedById === actorId) return;
    void this.notifications
      .notifyUser({
        recipientId: nearMiss.reportedById,
        topic: 'near-miss.outcome',
        title,
        body,
        payload: { nearMissId: nearMiss.id, route: `/near-miss/${nearMiss.id}` },
        priority: 'NORMAL',
      })
      .catch(() => undefined);
  }

  private async editable(user: AuthUser, id: string): Promise<NearMiss> {
    const nearMiss = await this.get(user, id);
    if (nearMiss.status === 'CLOSED' || nearMiss.status === 'CONVERTED' || nearMiss.resolvedAt) {
      throw new BadRequestException('This near-miss is already closed');
    }
    return nearMiss;
  }

  private canReview(user: AuthUser): boolean {
    const allowed = [Permission.INCIDENT_UPDATE, Permission.INCIDENT_INVESTIGATE, Permission.INCIDENT_APPROVE];
    return allowed.some((permission) => user.permissions.includes(permission));
  }

  private assertCanReview(user: AuthUser): void {
    if (!this.canReview(user)) throw new ForbiddenException('A safety officer reviews a near-miss');
  }

  private async generateReferenceCode(regionCode: string, districtCode: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `NM-${year}-${regionCode}-${districtCode}-`;
    const last = await this.repo
      .createQueryBuilder('n')
      .where('n.referenceCode LIKE :p', { p: `${prefix}%` })
      .orderBy('n.referenceCode', 'DESC')
      .getOne();
    const next = last ? Number(last.referenceCode.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(Number.isFinite(next) ? next : 1).padStart(5, '0')}`;
  }

  private async savePhotos(nearMissId: string, photos: NearMissPhotoDto[]): Promise<void> {
    if (photos.length > 4) throw new BadRequestException('A near-miss can include up to 4 photos');
    const uploadDir = join(process.cwd(), 'data', 'uploads', 'near-miss', nearMissId);
    await mkdir(uploadDir, { recursive: true });
    const rows: NearMissAttachment[] = [];
    for (const photo of photos) {
      const { buffer } = decodeUpload(photo.dataUrl, photo.mimeType, 'image');
      const safeName = (photo.fileName || 'photo').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      const storedName = `${randomUUID()}-${safeName}`;
      const relativeKey = join('uploads', 'near-miss', nearMissId, storedName).replace(/\\/g, '/');
      await writeFile(join(uploadDir, storedName), buffer);
      rows.push(
        this.attachments.create({
          nearMissId,
          fileName: photo.fileName || storedName,
          storageKey: relativeKey,
          mimeType: photo.mimeType,
          sizeBytes: buffer.byteLength,
        }),
      );
    }
    await this.attachments.save(rows);
  }
}
