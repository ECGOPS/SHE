import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { randomUUID } from 'crypto';
import { copyFile, mkdir, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  AuthUser,
  EscalationEntityType,
  IncidentStatus,
  isDistrictScope,
  isGlobalScope,
  reportsInChosenPlace,
  issueScopeForRole,
  PaginatedResult,
  Permission,
  Role,
} from '@ecg-she/shared';
import { Incident } from './entities/incident.entity';
import { Witness } from './entities/witness.entity';
import { InvestigationFinding } from './entities/investigation-finding.entity';
import { IncidentAttachment } from './entities/incident-attachment.entity';
import { User } from '../users/entities/user.entity';
import { NearMiss } from '../near-miss/entities/near-miss.entity';
import { CreateIncidentDto, FindingInputDto, WitnessInputDto } from './dto/create-incident.dto';
import { IncidentQueryDto } from './dto/incident-query.dto';
import { RbacScopeService } from '../auth/rbac-scope.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { CorrectiveAction } from '../corrective-actions/entities/corrective-action.entity';
import { IssueEscalation } from '../escalations/entities/issue-escalation.entity';
import { buildIncidentReport } from './incident-report';
import { orderColumn, searchTerm } from '../../common/pagination';
import { decodeUpload } from '../../common/validation/uploads';

@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(Incident) private readonly incidents: Repository<Incident>,
    @InjectRepository(Witness) private readonly witnesses: Repository<Witness>,
    @InjectRepository(InvestigationFinding) private readonly findings: Repository<InvestigationFinding>,
    @InjectRepository(IncidentAttachment) private readonly attachments: Repository<IncidentAttachment>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(NearMiss) private readonly nearMisses: Repository<NearMiss>,
    @InjectRepository(CorrectiveAction) private readonly actions: Repository<CorrectiveAction>,
    @InjectRepository(IssueEscalation) private readonly escalations: Repository<IssueEscalation>,
    private readonly scope: RbacScopeService,
    private readonly orgs: OrganizationsService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async create(user: AuthUser, dto: CreateIncidentDto): Promise<Incident> {
    const source = dto.sourceNearMissId ? await this.loadConvertibleNearMiss(user, dto.sourceNearMissId) : null;
    const { photos, ...incidentDto } = dto;
    const scoped = this.scope.enforceWriteScope(user, {
      regionId: incidentDto.regionId ?? user.regionId,
      districtId: incidentDto.districtId ?? user.districtId,
    });
    if (!scoped.regionId) throw new BadRequestException('regionId is required');

    if (dto.offlineClientId) {
      const existing = await this.incidents.findOne({ where: { offlineClientId: dto.offlineClientId } });
      if (existing) return existing;
    }

    const region = await this.orgs.getRegion(user, scoped.regionId);
    const districtCode = scoped.districtId
      ? (await this.orgs.getDistrict(user, scoped.districtId)).code
      : 'HQ';

    const referenceCode = await this.generateReferenceCode(region.code, districtCode);

    // Initial escalation tier mirrors the reporter's seat on the org chart:
    //   • District officer's report  → DISTRICT
    //   • Regional officer's report  → REGIONAL
    //   • Global / sys-admin report  → HEAD_OFFICE
    const initialScope = issueScopeForRole(user.role);

    const entity = this.incidents.create({
      ...incidentDto,
      regionId: scoped.regionId,
      districtId: scoped.districtId ?? null,
      occurredAt: new Date(incidentDto.occurredAt),
      referenceCode,
      status: IncidentStatus.REPORTED,
      reportedById: user.id,
      currentScope: initialScope,
      sourceNearMissId: source?.id ?? null,
      witnesses: incidentDto.witnesses?.map((w) => this.witnesses.create(w)),
    });
    const saved = await this.incidents.save(entity);
    if (photos?.length) {
      await this.savePhotos(saved.id, photos);
    }
    if (source) await this.adoptNearMiss(user, saved, source);

    this.realtime.emitToScope(saved.regionId, saved.districtId ?? undefined, 'incident:created', {
      id: saved.id,
      title: saved.title,
      severity: saved.severity,
      type: saved.type,
      regionId: saved.regionId,
      districtId: saved.districtId,
    });

    // Persist + push a personal notification to every user in scope.
    // Severity is mapped onto the notification priority so HIGH+ severities
    // also dispatch via SMTP / web-push when those channels are configured.
    const sev = String(saved.severity ?? '').toUpperCase();
    const priority =
      sev === 'CATASTROPHIC' || sev === 'CRITICAL'
        ? 'CRITICAL'
        : sev === 'MAJOR' || sev === 'HIGH'
          ? 'HIGH'
          : 'NORMAL';
    void this.notifications.broadcastToScope({
      topic: 'incident.created',
      title: `New incident · ${saved.referenceCode}`,
      body: `${saved.severity} ${saved.type} — ${saved.title}`,
      regionId: saved.regionId,
      districtId: saved.districtId ?? null,
      payload: { incidentId: saved.id, severity: saved.severity, route: `/incidents/${saved.id}` },
      priority,
      excludeUserId: user.id,
    });
    return this.get(user, saved.id);
  }

  private async loadConvertibleNearMiss(user: AuthUser, id: string): Promise<NearMiss> {
    const nearMiss = await this.nearMisses.findOne({ where: { id }, relations: { attachments: true } });
    if (!nearMiss) throw new NotFoundException('Near miss not found');
    if (!isGlobalScope(user.role)) {
      const homeRegion = nearMiss.regionId === user.regionId;
      const homeDistrict = !isDistrictScope(user.role) || nearMiss.districtId === user.districtId;
      const ownReport = reportsInChosenPlace(user.role) && nearMiss.reportedById === user.id;
      if (!(homeRegion && homeDistrict) && !ownReport) {
        throw new ForbiddenException('Near miss is outside your district');
      }
    }
    if (nearMiss.convertedIncidentId || nearMiss.status === 'CONVERTED') {
      throw new BadRequestException('This near miss was already filed as an incident');
    }
    if (nearMiss.status === 'CLOSED' || nearMiss.resolvedAt) {
      throw new BadRequestException('This near miss is already closed');
    }
    return nearMiss;
  }

  private async adoptNearMiss(user: AuthUser, incident: Incident, nearMiss: NearMiss): Promise<void> {
    const photos = nearMiss.attachments ?? [];
    if (photos.length) {
      const uploadDir = join(process.cwd(), 'data', 'uploads', 'incidents', incident.id);
      await mkdir(uploadDir, { recursive: true });
      const rows: IncidentAttachment[] = [];
      for (const photo of photos) {
        const storedName = `${randomUUID()}-${photo.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)}`;
        const relativeKey = join('uploads', 'incidents', incident.id, storedName).replace(/\\/g, '/');
        await copyFile(join(process.cwd(), 'data', photo.storageKey), join(uploadDir, storedName));
        rows.push(
          this.attachments.create({
            incidentId: incident.id,
            kind: 'photo',
            fileName: photo.fileName,
            storageKey: relativeKey,
            mimeType: photo.mimeType,
            sizeBytes: photo.sizeBytes,
          }),
        );
      }
      await this.attachments.save(rows);
    }

    const closedAt = new Date();
    await this.nearMisses.update(nearMiss.id, {
      status: 'CONVERTED',
      convertedIncidentId: incident.id,
      closedAt,
      resolvedAt: closedAt,
      resolvedById: user.id,
      resolvedAtScope: issueScopeForRole(user.role),
      resolutionNotes: `Filed as incident ${incident.referenceCode}`,
    });
    if (nearMiss.reportedById && nearMiss.reportedById !== user.id) {
      void this.notifications
        .notifyUser({
          recipientId: nearMiss.reportedById,
          topic: 'near-miss.outcome',
          title: `Near-miss filed as an incident · ${nearMiss.referenceCode}`,
          body: `This was recorded as incident ${incident.referenceCode}.`,
          payload: { nearMissId: nearMiss.id, incidentId: incident.id, route: `/incidents/${incident.id}` },
          priority: 'HIGH',
        })
        .catch(() => undefined);
    }
  }

  private async savePhotos(
    incidentId: string,
    photos: NonNullable<CreateIncidentDto['photos']>,
  ): Promise<void> {
    const uploadDir = join(process.cwd(), 'data', 'uploads', 'incidents', incidentId);
    await mkdir(uploadDir, { recursive: true });

    const rows: IncidentAttachment[] = [];
    for (const photo of photos) {
      const { buffer } = decodeUpload(photo.dataUrl, photo.mimeType, 'image');

      const ext = this.extensionForMime(photo.mimeType);
      const safeOriginalName = photo.fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      const storedName = `${randomUUID()}-${safeOriginalName || `photo.${ext}`}`;
      const relativeKey = join('uploads', 'incidents', incidentId, storedName).replace(/\\/g, '/');
      await writeFile(join(uploadDir, storedName), buffer);

      rows.push(
        this.attachments.create({
          incidentId,
          kind: 'photo',
          fileName: photo.fileName,
          storageKey: relativeKey,
          mimeType: photo.mimeType,
          sizeBytes: buffer.byteLength,
          capturedLat: photo.capturedLat ?? null,
          capturedLng: photo.capturedLng ?? null,
        }),
      );
    }

    await this.attachments.save(rows);
  }

  private extensionForMime(mimeType: string): string {
    switch (mimeType) {
      case 'image/jpeg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      default:
        return 'img';
    }
  }

  async list(user: AuthUser, query: IncidentQueryDto): Promise<PaginatedResult<Incident>> {
    const qb = this.incidents
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.region', 'r')
      .leftJoinAndSelect('i.district', 'd')
      .leftJoinAndSelect('i.reportedBy', 'rb');

    this.scope.applyScopeFilter(qb, user, 'i', 'reportedById');

    if (query.type) qb.andWhere('i.type = :type', { type: query.type });
    if (query.severity) qb.andWhere('i.severity = :severity', { severity: query.severity });
    const statuses = (query.status ?? '').split(',').map((item) => item.trim()).filter((item) => item in IncidentStatus);
    if (statuses.length === 1) qb.andWhere('i.status = :status', { status: statuses[0] });
    else if (statuses.length > 1) qb.andWhere('i.status IN (:...statuses)', { statuses });
    if (query.regionId) qb.andWhere('i.regionId = :regionId', { regionId: query.regionId });
    if (query.districtId) qb.andWhere('i.districtId = :districtId', { districtId: query.districtId });
    if (query.investigatorId) qb.andWhere('i.investigatorId = :investigatorId', { investigatorId: query.investigatorId });
    if (query.from) qb.andWhere('i.occurredAt >= :from', { from: query.from });
    if (query.to) qb.andWhere('i.occurredAt <= :to', { to: query.to });
    const term = searchTerm(query.search);
    if (term) {
      qb.andWhere(
        '(LOWER(i.title) LIKE LOWER(:s) OR LOWER(i.referenceCode) LIKE LOWER(:s) OR LOWER(i.description) LIKE LOWER(:s))',
        { s: term },
      );
    }

    qb.orderBy(
      orderColumn('i', query.sortBy, ['occurredAt', 'createdAt', 'referenceCode', 'severity', 'status', 'title'], 'occurredAt'),
      query.sortDir === 'ASC' ? 'ASC' : 'DESC',
    );
    qb.skip((query.page - 1) * query.pageSize).take(query.pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async get(user: AuthUser, id: string): Promise<Incident> {
    const qb = this.incidents
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.region', 'r')
      .leftJoinAndSelect('i.district', 'd')
      .leftJoinAndSelect('i.reportedBy', 'rb')
      .leftJoinAndSelect('i.investigator', 'inv')
      .leftJoinAndSelect('i.witnesses', 'w')
      .leftJoinAndSelect('i.findings', 'f')
      .leftJoinAndSelect('i.attachments', 'a')
      .where('i.id = :id', { id });
    this.scope.applyScopeFilter(qb, user, 'i', 'reportedById');
    const incident = await qb.getOne();
    if (!incident) throw new NotFoundException('Incident not found');
    return incident;
  }

  async reportPdf(user: AuthUser, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const incident = await this.get(user, id);
    const [actions, history] = await Promise.all([
      this.actions.find({
        where: { sourceType: 'INCIDENT', sourceId: id },
        relations: ['assignee'],
        order: { dueDate: 'ASC' },
      }),
      this.escalations.find({
        where: { entityType: EscalationEntityType.INCIDENT, entityId: id },
        relations: ['fromUser'],
        order: { createdAt: 'ASC' },
      }),
    ]);
    const buffer = await buildIncidentReport({
      incident,
      actions,
      history,
      preparedBy: user.fullName,
    });
    const safeName = incident.referenceCode.replace(/[^\w.-]+/g, '_');
    return { buffer, filename: `${safeName}-report.pdf` };
  }

  async getAttachmentFile(
    user: AuthUser,
    incidentId: string,
    attachmentId: string,
  ): Promise<{ absolutePath: string; mimeType: string; fileName: string }> {
    await this.get(user, incidentId);
    const attachment = await this.attachments.findOne({
      where: { id: attachmentId, incidentId, kind: 'photo' },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    const absolutePath = join(process.cwd(), 'data', attachment.storageKey);
    try {
      await stat(absolutePath);
    } catch {
      throw new NotFoundException('Attachment file not found');
    }

    return {
      absolutePath,
      mimeType: attachment.mimeType,
      fileName: attachment.fileName,
    };
  }

  async assignees(user: AuthUser, id: string): Promise<Array<{ id: string; fullName: string; role: Role }>> {
    this.assertCanRecord(user);
    const incident = await this.get(user, id);
    const qb = this.users
      .createQueryBuilder('u')
      .select(['u.id', 'u.fullName', 'u.role'])
      .where('u.active = :active', { active: true })
      .andWhere('u.role IN (:...officerRoles)', {
        officerRoles: [Role.DISTRICT_SAFETY_OFFICER, Role.REGIONAL_SAFETY_OFFICER, Role.GLOBAL_SAFETY_OFFICER],
      })
      .andWhere(
        '(u.role = :globalOfficer OR u.regionId = :regionId)',
        { globalOfficer: Role.GLOBAL_SAFETY_OFFICER, regionId: incident.regionId },
      )
      .orderBy('u.fullName', 'ASC');
    if (isDistrictScope(user.role) && incident.districtId) {
      qb.andWhere(
        '(u.role <> :districtOfficer OR u.districtId = :districtId)',
        { districtOfficer: Role.DISTRICT_SAFETY_OFFICER, districtId: incident.districtId },
      );
    }
    return qb.getMany();
  }

  async addWitness(user: AuthUser, id: string, dto: WitnessInputDto): Promise<Incident> {
    this.assertCanRecord(user);
    const incident = await this.get(user, id);
    this.assertOpen(incident);
    await this.witnesses.save(this.witnesses.create({ ...dto, incidentId: id }));
    return this.get(user, id);
  }

  async addFinding(user: AuthUser, id: string, dto: FindingInputDto): Promise<Incident> {
    this.assertCanRecord(user);
    const incident = await this.get(user, id);
    this.assertOpen(incident);
    await this.findings.save(
      this.findings.create({
        incidentId: id,
        category: dto.category,
        description: dto.description,
        recommendation: dto.recommendation ?? null,
      }),
    );
    return this.get(user, id);
  }

  async assignInvestigator(user: AuthUser, id: string, investigatorId: string): Promise<Incident> {
    this.assertCanRecord(user);
    const incident = await this.get(user, id);
    this.assertOpen(incident);
    const allowed = await this.assignees(user, id);
    if (!allowed.some((person) => person.id === investigatorId)) {
      throw new BadRequestException('That person is outside this incident’s region or district');
    }
    const previousInvestigatorId = incident.investigatorId;
    const status =
      incident.status === IncidentStatus.REPORTED || incident.status === IncidentStatus.DRAFT
        ? IncidentStatus.UNDER_INVESTIGATION
        : incident.status;
    // Update the column directly. Saving the loaded record writes the old investigator relation back.
    await this.incidents.update(incident.id, {
      investigatorId,
      status,
      updatedBy: user.id,
    });
    const saved = await this.get(user, id);
    if (investigatorId !== previousInvestigatorId && investigatorId !== user.id) {
      void this.notifications
        .notifyUser({
          recipientId: investigatorId,
          topic: 'incident.assigned',
          title: `Incident assigned to you · ${saved.referenceCode}`,
          body: `${saved.severity} ${String(saved.type).replaceAll('_', ' ')} — ${saved.title}`,
          payload: { incidentId: saved.id, route: `/incidents/${saved.id}` },
          priority: 'HIGH',
        })
        .catch(() => undefined);
    }
    return saved;
  }

  async submitForApproval(user: AuthUser, id: string): Promise<Incident> {
    const incident = await this.get(user, id);
    this.assertOpen(incident);
    incident.status = IncidentStatus.PENDING_APPROVAL;
    const saved = await this.incidents.save(incident);
    this.realtime.emitToScope(saved.regionId, saved.districtId ?? undefined, 'incident:pending-approval', {
      id: saved.id,
    });
    void this.notifications.broadcastToScope({
      topic: 'incident.pending-approval',
      title: `Incident awaiting approval · ${saved.referenceCode}`,
      body: `${saved.title} is ready for sign-off.`,
      regionId: saved.regionId,
      districtId: saved.districtId ?? null,
      payload: { incidentId: saved.id, route: `/incidents/${saved.id}` },
      priority: 'HIGH',
      excludeUserId: user.id,
    });
    return saved;
  }

  async closeIncident(user: AuthUser, id: string): Promise<Incident> {
    const incident = await this.get(user, id);
    incident.status = IncidentStatus.CLOSED;
    incident.closedAt = new Date();
    if (!incident.resolvedAt) {
      incident.resolvedAt = new Date();
      incident.resolvedById = user.id;
      incident.resolvedAtScope = incident.currentScope;
      incident.resolutionNotes = incident.resolutionNotes ?? 'Closed after approval.';
    }
    await this.incidents.save(incident);
    return this.get(user, id);
  }

  async stats(user: AuthUser, from?: Date, to?: Date) {
    const qb = this.incidents.createQueryBuilder('i');
    this.scope.applyScopeFilter(qb, user, 'i', 'reportedById');
    if (from) qb.andWhere('i.occurredAt >= :from', { from });
    if (to) qb.andWhere('i.occurredAt <= :to', { to });
    const [total, fatalities, openIncidents] = await Promise.all([
      qb.clone().getCount(),
      qb
        .clone()
        .select('COALESCE(SUM(i.fatalities), 0)', 'sum')
        .getRawOne<{ sum: string }>()
        .then((r) => Number(r?.sum ?? 0)),
      qb
        .clone()
        .andWhere('i.status NOT IN (:...closed)', { closed: [IncidentStatus.CLOSED, IncidentStatus.REJECTED] })
        .getCount(),
    ]);
    return { total, fatalities, openIncidents };
  }

  async bulkSync(user: AuthUser, payloads: CreateIncidentDto[]): Promise<{ accepted: string[]; conflicts: string[] }> {
    const accepted: string[] = [];
    const conflicts: string[] = [];
    const clientIds = payloads.map((p) => p.offlineClientId).filter(Boolean) as string[];
    const existing = clientIds.length
      ? await this.incidents.find({ where: { offlineClientId: In(clientIds) } })
      : [];
    const existingIds = new Set(existing.map((e) => e.offlineClientId));

    for (const payload of payloads) {
      try {
        if (payload.offlineClientId && existingIds.has(payload.offlineClientId)) {
          conflicts.push(payload.offlineClientId);
          continue;
        }
        const created = await this.create(user, payload);
        if (payload.offlineClientId) accepted.push(payload.offlineClientId);
        else accepted.push(created.id);
      } catch {
        if (payload.offlineClientId) conflicts.push(payload.offlineClientId);
      }
    }
    return { accepted, conflicts };
  }

  private async generateReferenceCode(regionCode: string, districtCode: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INC-${year}-${regionCode}-${districtCode}-`;
    const last = await this.incidents
      .createQueryBuilder('i')
      .where('i.referenceCode LIKE :p', { p: `${prefix}%` })
      .orderBy('i.referenceCode', 'DESC')
      .getOne();
    const next = last ? Number(last.referenceCode.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(next).padStart(5, '0')}`;
  }

  private assertCanRecord(user: AuthUser): void {
    const allowed = [
      Permission.INCIDENT_UPDATE,
      Permission.INCIDENT_INVESTIGATE,
      Permission.INCIDENT_APPROVE,
    ];
    if (!allowed.some((permission) => user.permissions.includes(permission))) {
      throw new ForbiddenException('You cannot update this investigation');
    }
  }

  private assertOpen(incident: Incident): void {
    if (incident.status === IncidentStatus.CLOSED || incident.status === IncidentStatus.REJECTED) {
      throw new BadRequestException('This incident is already closed');
    }
  }
}
