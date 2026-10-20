import { randomUUID } from 'crypto';
import { mkdir, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser, EnvironmentalEventType, PaginatedResult, Permission, Role } from '@ecg-she/shared';
import { EnvironmentalEvent } from './entities/environmental-event.entity';
import { EnvironmentalAttachment } from './entities/environmental-attachment.entity';
import {
  AddEnvironmentalPhotosDto,
  AssessEnvironmentalEventDto,
  CloseEnvironmentalEventDto,
  ContainEnvironmentalEventDto,
  CreateEnvironmentalEventDto,
  EnvironmentalPhotoDto,
  MATERIAL_RELEASE,
  WasteConsignmentDto,
} from './dto/environmental.dto';
import { RbacScopeService } from '../auth/rbac-scope.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { CorrectiveAction } from '../corrective-actions/entities/corrective-action.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { applyStatus, paginate, searchTerm } from '../../common/pagination';
import { decodeUpload } from '../../common/validation/uploads';
import { renderSheReport, reportFilename } from '../../common/pdf/she-report';
import { environmentalReport } from '../../common/pdf/record-reports';

const SIGNIFICANT = new Set(['MAJOR', 'CATASTROPHIC']);
const MATERIAL = new Set<string>(MATERIAL_RELEASE);

@Injectable()
export class EnvironmentalService {
  constructor(
    @InjectRepository(EnvironmentalEvent) private readonly repo: Repository<EnvironmentalEvent>,
    @InjectRepository(EnvironmentalAttachment) private readonly attachments: Repository<EnvironmentalAttachment>,
    @InjectRepository(CorrectiveAction) private readonly capas: Repository<CorrectiveAction>,
    private readonly scope: RbacScopeService,
    private readonly orgs: OrganizationsService,
  ) {}

  async create(user: AuthUser, dto: CreateEnvironmentalEventDto): Promise<EnvironmentalEvent> {
    const scoped = this.scope.enforceWriteScope(user, {
      regionId: dto.regionId ?? user.regionId ?? null,
      districtId: dto.districtId ?? user.districtId ?? null,
    });
    if (!scoped.regionId) throw new BadRequestException('regionId required');
    const containment = dto.containmentActions?.trim() || null;
    const region = await this.orgs.getRegion(user, scoped.regionId);
    const districtCode = scoped.districtId ? (await this.orgs.getDistrict(user, scoped.districtId)).code : 'HQ';
    const saved = await this.repo.save(
      this.repo.create({
        type: dto.type,
        title: dto.title.trim(),
        description: dto.description.trim(),
        occurredAt: new Date(dto.occurredAt),
        regionId: scoped.regionId,
        districtId: scoped.districtId ?? null,
        estimatedQuantity: dto.estimatedQuantity ?? null,
        quantityUnit: dto.quantityUnit?.trim() || null,
        locationName: dto.locationName?.trim() || null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        containmentActions: containment,
        substance: this.substanceName(dto.type, dto.substance, dto.substanceDetail),
        reportedById: user.id,
        status: containment ? 'CONTAINED' : 'OPEN',
        referenceCode: await this.generateReferenceCode(region.code, districtCode),
      }),
    );
    if (dto.photos?.length) await this.savePhotos(saved.id, dto.photos);
    return this.get(user, saved.id);
  }

  async contain(user: AuthUser, id: string, dto: ContainEnvironmentalEventDto): Promise<EnvironmentalEvent> {
    const event = await this.open(user, id);
    const containment = dto.containmentActions.trim();
    if (!containment) throw new BadRequestException('Describe how the release was contained');
    await this.repo.update(event.id, { containmentActions: containment, status: 'CONTAINED' });
    return this.get(user, id);
  }

  async assess(user: AuthUser, id: string, dto: AssessEnvironmentalEventDto): Promise<EnvironmentalEvent> {
    this.assertCanClose(user);
    const event = await this.open(user, id);
    if (dto.regulatoryReportable && (!dto.agencyNotifiedAt || !dto.agencyNotificationRef?.trim())) {
      throw new BadRequestException('Record when the regulator was notified and the notification reference');
    }
    await this.repo.update(event.id, {
      aspect: dto.aspect,
      impact: dto.impact,
      severity: dto.severity,
      regulatoryReportable: dto.regulatoryReportable,
      agencyNotifiedAt: dto.regulatoryReportable && dto.agencyNotifiedAt ? new Date(dto.agencyNotifiedAt) : null,
      agencyNotificationRef: dto.regulatoryReportable ? dto.agencyNotificationRef?.trim() || null : null,
    });
    return this.get(user, id);
  }

  async close(user: AuthUser, id: string, dto: CloseEnvironmentalEventDto): Promise<EnvironmentalEvent> {
    this.assertCanClose(user);
    const event = await this.open(user, id);
    if (!event.containmentActions?.trim()) {
      throw new BadRequestException('Record how the release was contained before closing it');
    }
    if (!event.aspect || !event.impact || !event.severity) {
      throw new BadRequestException('Record the aspect, the impact, and the severity');
    }
    if (event.regulatoryReportable && (!event.agencyNotifiedAt || !event.agencyNotificationRef?.trim())) {
      throw new BadRequestException('A reportable event stays open until the regulator is notified');
    }
    if (MATERIAL.has(event.type)) {
      if (!event.wasteContractor?.trim() || !event.disposalSite?.trim() || !event.waybillNumber?.trim()) {
        throw new BadRequestException('Record the waste contractor, the disposal site, and the waybill before closing');
      }
      const photos = await this.attachments.count({ where: { eventId: event.id } });
      if (!photos) throw new BadRequestException('Add a photo of the release or the cleaned ground before closing');
    }
    if (SIGNIFICANT.has(event.severity)) {
      const actions = await this.capas.count({ where: { sourceType: 'ENVIRONMENTAL_EVENT', sourceId: event.id } });
      if (!actions && !dto.noFurtherAction) {
        throw new BadRequestException('A major release needs a corrective action, or a note that no further action is required');
      }
      if (dto.noFurtherAction && !dto.notes?.trim()) {
        throw new BadRequestException('Say why no further action is required');
      }
    }
    await this.repo.update(event.id, {
      status: 'CLOSED',
      closedAt: new Date(),
      closureNotes: dto.notes?.trim() || null,
    });
    return this.get(user, id);
  }

  async reopen(user: AuthUser, id: string): Promise<EnvironmentalEvent> {
    this.assertCanClose(user);
    const event = await this.get(user, id);
    if (event.status !== 'CLOSED') throw new BadRequestException('This event is still open');
    await this.repo.update(event.id, {
      status: event.containmentActions?.trim() ? 'CONTAINED' : 'OPEN',
      closedAt: null,
      closureNotes: null,
    });
    return this.get(user, id);
  }

  async recordWaste(user: AuthUser, id: string, dto: WasteConsignmentDto): Promise<EnvironmentalEvent> {
    const event = await this.open(user, id);
    if (!MATERIAL.has(event.type)) {
      throw new BadRequestException('A consignment is recorded when oil, waste, or polluted material leaves the site');
    }
    await this.repo.update(event.id, {
      wasteContractor: dto.wasteContractor.trim(),
      disposalSite: dto.disposalSite.trim(),
      waybillNumber: dto.waybillNumber.trim(),
    });
    return this.get(user, id);
  }

  async addPhotos(user: AuthUser, id: string, dto: AddEnvironmentalPhotosDto): Promise<EnvironmentalEvent> {
    const event = await this.open(user, id);
    await this.savePhotos(event.id, dto.photos);
    return this.get(user, id);
  }

  async getAttachmentFile(
    user: AuthUser,
    eventId: string,
    attachmentId: string,
  ): Promise<{ absolutePath: string; mimeType: string; fileName: string }> {
    await this.get(user, eventId);
    const attachment = await this.attachments.findOne({ where: { id: attachmentId, eventId } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    const absolutePath = join(process.cwd(), 'data', attachment.storageKey);
    try {
      await stat(absolutePath);
    } catch {
      throw new NotFoundException('Attachment file not found');
    }
    return { absolutePath, mimeType: attachment.mimeType, fileName: attachment.fileName };
  }

  async list(user: AuthUser, query: PaginationQueryDto): Promise<PaginatedResult<EnvironmentalEvent>> {
    const qb = this.repo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.region', 'region')
      .leftJoinAndSelect('e.district', 'district')
      .leftJoin('e.reportedBy', 'reporter')
      .addSelect(['reporter.id', 'reporter.fullName'])
      .orderBy('e.occurredAt', 'DESC');
    this.scope.applyScopeFilter(qb, user, 'e', 'reportedById');
    applyStatus(qb, 'e', query.status);
    const term = searchTerm(query.search);
    if (term) qb.andWhere('(LOWER(e.referenceCode) LIKE LOWER(:s) OR LOWER(e.title) LIKE LOWER(:s))', { s: term });
    return paginate(qb, query);
  }

  async get(user: AuthUser, id: string): Promise<EnvironmentalEvent> {
    const qb = this.baseQuery().where('e.id = :id', { id });
    this.scope.applyScopeFilter(qb, user, 'e', 'reportedById');
    const event = await qb.getOne();
    if (!event) throw new NotFoundException('Environmental event not found');
    return event;
  }

  async reportPdf(user: AuthUser, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const row = await this.get(user, id);
    const actions = await this.capas.find({
      where: { sourceType: 'ENVIRONMENTAL_EVENT', sourceId: id },
      relations: ['assignee'],
      order: { dueDate: 'ASC' },
    });
    const buffer = await renderSheReport(environmentalReport(row, actions, user.fullName));
    return { buffer, filename: reportFilename(row.referenceCode) };
  }

  private baseQuery() {
    return this.repo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.region', 'region')
      .leftJoinAndSelect('e.district', 'district')
      .leftJoin('e.reportedBy', 'reporter')
      .addSelect(['reporter.id', 'reporter.fullName'])
      .leftJoinAndSelect('e.attachments', 'attachments');
  }

  private async open(user: AuthUser, id: string): Promise<EnvironmentalEvent> {
    const event = await this.get(user, id);
    if (event.status === 'CLOSED') throw new BadRequestException('This event is closed');
    return event;
  }

  private substanceName(type: EnvironmentalEventType, substance?: string, detail?: string): string | null {
    if (type === EnvironmentalEventType.NOISE) return substance === 'OTHER' ? detail?.trim() || null : substance ?? null;
    const name = substance === 'OTHER' ? detail?.trim() : substance;
    if (!name) throw new BadRequestException('Name the substance that was released');
    return name;
  }

  private async savePhotos(eventId: string, photos: EnvironmentalPhotoDto[]): Promise<void> {
    const existing = await this.attachments.count({ where: { eventId } });
    if (existing + photos.length > 4) throw new BadRequestException('An environmental event can include up to 4 photos');
    const uploadDir = join(process.cwd(), 'data', 'uploads', 'environmental', eventId);
    await mkdir(uploadDir, { recursive: true });
    const rows: EnvironmentalAttachment[] = [];
    for (const photo of photos) {
      const { buffer } = decodeUpload(photo.dataUrl, photo.mimeType, 'image');
      const safeName = (photo.fileName || 'photo').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      const storedName = `${randomUUID()}-${safeName}`;
      const relativeKey = join('uploads', 'environmental', eventId, storedName).replace(/\\/g, '/');
      await writeFile(join(uploadDir, storedName), buffer);
      rows.push(this.attachments.create({
        eventId,
        fileName: photo.fileName || storedName,
        storageKey: relativeKey,
        mimeType: photo.mimeType,
        sizeBytes: buffer.byteLength,
      }));
    }
    await this.attachments.save(rows);
  }

  private assertCanClose(user: AuthUser): void {
    if (user.role === Role.SYS_ADMIN || user.permissions.includes(Permission.ENV_CLOSE)) return;
    throw new ForbiddenException('A safety officer closes an environmental event');
  }

  private async generateReferenceCode(regionCode: string, districtCode: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ENV-${year}-${regionCode}-${districtCode}-`;
    const last = await this.repo
      .createQueryBuilder('e')
      .where('e.referenceCode LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('e.referenceCode', 'DESC')
      .getOne();
    const next = last ? Number(last.referenceCode.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(Number.isFinite(next) ? next : 1).padStart(5, '0')}`;
  }
}
