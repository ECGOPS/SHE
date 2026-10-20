import { randomUUID } from 'crypto';
import { mkdir, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser, InspectionType, PaginatedResult, Permission, Role } from '@ecg-she/shared';
import { Inspection, InspectionItem } from './entities/inspection.entity';
import { InspectionAttachment } from './entities/inspection-attachment.entity';
import { CreateInspectionDto, InspectionItemDto } from './dto/inspection.dto';
import { RbacScopeService } from '../auth/rbac-scope.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { CorrectiveAction } from '../corrective-actions/entities/corrective-action.entity';
import { Hazard } from '../hazards/entities/hazard.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { decodeUpload } from '../../common/validation/uploads';
import { applyStatus, paginate, searchTerm } from '../../common/pagination';
import { renderSheReport, reportFilename } from '../../common/pdf/she-report';
import { inspectionReport } from '../../common/pdf/record-reports';

const OUTDOOR: InspectionType[] = [InspectionType.SUBSTATION, InspectionType.TRANSFORMER, InspectionType.LINE];
const PRE_USE: InspectionType[] = [InspectionType.VEHICLE, InspectionType.PPE];

@Injectable()
export class InspectionsService {
  constructor(
    @InjectRepository(Inspection) private readonly repo: Repository<Inspection>,
    @InjectRepository(InspectionAttachment) private readonly attachments: Repository<InspectionAttachment>,
    @InjectRepository(CorrectiveAction) private readonly capas: Repository<CorrectiveAction>,
    @InjectRepository(Hazard) private readonly hazards: Repository<Hazard>,
    private readonly scope: RbacScopeService,
    private readonly orgs: OrganizationsService,
  ) {}

  async create(user: AuthUser, dto: CreateInspectionDto): Promise<Inspection> {
    this.assertCanConduct(user);
    this.assertTypeAllowed(user, dto.type);
    const scoped = this.scope.enforceWriteScope(user, {
      regionId: dto.regionId ?? user.regionId ?? null,
      districtId: dto.districtId ?? user.districtId ?? null,
    });
    if (!scoped.regionId) throw new BadRequestException('regionId required');
    if (OUTDOOR.includes(dto.type) && !dto.weatherCondition) {
      throw new BadRequestException('Record the weather for an outdoor electrical inspection');
    }
    const items = this.normalizeItems(dto.items);
    const region = await this.orgs.getRegion(user, scoped.regionId);
    const districtCode = scoped.districtId ? (await this.orgs.getDistrict(user, scoped.districtId)).code : 'HQ';
    const saved = await this.repo.save(
      this.repo.create({
        type: dto.type,
        assetOrLocation: dto.assetOrLocation.trim(),
        inspectedAt: new Date(dto.inspectedAt),
        regionId: scoped.regionId,
        districtId: scoped.districtId ?? null,
        weatherCondition: OUTDOOR.includes(dto.type) ? dto.weatherCondition ?? null : null,
        temperatureC: OUTDOOR.includes(dto.type) ? dto.temperatureC ?? null : null,
        arcFlashBoundaryM: OUTDOOR.includes(dto.type) ? dto.arcFlashBoundaryM ?? null : null,
        nfpaPpeCategory: OUTDOOR.includes(dto.type) ? dto.nfpaPpeCategory ?? null : null,
        observations: dto.observations?.trim() || null,
        items,
        scorePercent: this.score(items),
        inspectorId: user.id,
        referenceCode: await this.generateReferenceCode(region.code, districtCode),
        status: this.hasOpenFinding(items) ? 'FINDINGS' : 'COMPLETED',
      }),
    );
    if (dto.photos?.length) await this.savePhotos(saved.id, dto.photos);
    return this.get(user, saved.id);
  }

  async updateItems(user: AuthUser, id: string, items: InspectionItemDto[]): Promise<Inspection> {
    this.assertCanConduct(user);
    const inspection = await this.editable(user, id);
    const next = this.normalizeItems(items, inspection.items ?? []);
    await this.repo.update(inspection.id, {
      items: next,
      scorePercent: this.score(next),
      status: this.hasOpenFinding(next) ? 'FINDINGS' : inspection.status,
    });
    return this.get(user, id);
  }

  async close(user: AuthUser, id: string): Promise<Inspection> {
    this.assertCanConduct(user);
    const inspection = await this.editable(user, id);
    await this.assertFindingsClosed(inspection);
    await this.repo.update(inspection.id, { status: 'COMPLETED' });
    return this.get(user, id);
  }

  async getAttachmentFile(
    user: AuthUser,
    inspectionId: string,
    attachmentId: string,
  ): Promise<{ absolutePath: string; mimeType: string; fileName: string }> {
    await this.get(user, inspectionId);
    const attachment = await this.attachments.findOne({ where: { id: attachmentId, inspectionId } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    const absolutePath = join(process.cwd(), 'data', attachment.storageKey);
    try {
      await stat(absolutePath);
    } catch {
      throw new NotFoundException('Attachment file not found');
    }
    return { absolutePath, mimeType: attachment.mimeType, fileName: attachment.fileName };
  }

  async list(user: AuthUser, query: PaginationQueryDto): Promise<PaginatedResult<Inspection>> {
    const qb = this.repo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.region', 'region')
      .leftJoinAndSelect('i.district', 'district')
      .leftJoin('i.inspector', 'inspector')
      .addSelect(['inspector.id', 'inspector.fullName'])
      .orderBy('i.inspectedAt', 'DESC');
    this.scope.applyScopeFilter(qb, user, 'i', 'inspectorId');
    applyStatus(qb, 'i', query.status);
    const term = searchTerm(query.search);
    if (term) qb.andWhere('(LOWER(i.referenceCode) LIKE LOWER(:s) OR LOWER(i.assetOrLocation) LIKE LOWER(:s))', { s: term });
    return paginate(qb, query);
  }

  async get(user: AuthUser, id: string): Promise<Inspection> {
    const qb = this.baseQuery().where('i.id = :id', { id });
    this.scope.applyScopeFilter(qb, user, 'i', 'inspectorId');
    const inspection = await qb.getOne();
    if (!inspection) throw new NotFoundException('Inspection not found');
    return inspection;
  }

  async reportPdf(user: AuthUser, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const row = await this.get(user, id);
    const buffer = await renderSheReport(inspectionReport(row, user.fullName));
    return { buffer, filename: reportFilename(row.referenceCode) };
  }

  private baseQuery() {
    return this.repo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.region', 'region')
      .leftJoinAndSelect('i.district', 'district')
      .leftJoin('i.inspector', 'inspector')
      .addSelect(['inspector.id', 'inspector.fullName'])
      .leftJoinAndSelect('i.attachments', 'attachments');
  }

  private async editable(user: AuthUser, id: string): Promise<Inspection> {
    const inspection = await this.get(user, id);
    if (inspection.status === 'COMPLETED') {
      throw new BadRequestException('This inspection is already complete');
    }
    return inspection;
  }

  private async assertFindingsClosed(inspection: Inspection): Promise<void> {
    for (const item of inspection.items ?? []) {
      if (item.answer !== 'FAIL') continue;
      if (item.immediateAction?.trim()) continue;
      if (item.capaId) {
        const capa = await this.capas.findOne({
          where: { id: item.capaId, sourceType: 'INSPECTION', sourceId: inspection.id },
        });
        if (capa) continue;
      }
      if (item.hazardId) {
        const hazard = await this.hazards.findOne({ where: { id: item.hazardId } });
        if (hazard) continue;
      }
      throw new BadRequestException(`"${item.question}" failed. Correct it on the spot, or raise a hazard or a corrective action`);
    }
  }

  private normalizeItems(items: InspectionItemDto[], previous: InspectionItem[] = []): InspectionItem[] {
    const next = (items ?? [])
      .map((item) => ({
        question: item.question.trim(),
        answer: item.answer,
        notes: item.notes?.trim() || undefined,
        immediateAction: item.immediateAction?.trim() || undefined,
        capaId: item.capaId,
        hazardId: item.hazardId,
      }))
      .filter((item) => item.question);
    if (!next.length) throw new BadRequestException('Answer the checklist');
    if (!next.some((item) => item.answer === 'PASS' || item.answer === 'FAIL')) {
      throw new BadRequestException('Mark at least one item pass or fail');
    }
    for (const item of next) {
      if (item.answer === 'FAIL' && !item.notes && !item.immediateAction) {
        throw new BadRequestException(`Describe what failed: ${item.question}`);
      }
    }
    const prior = new Map(previous.map((item) => [item.question, item]));
    return next.map((item) => {
      const old = prior.get(item.question);
      return {
        ...item,
        capaId: item.capaId ?? old?.capaId,
        hazardId: item.hazardId ?? old?.hazardId,
      };
    });
  }

  private hasOpenFinding(items: InspectionItem[]): boolean {
    return items.some((item) => item.answer === 'FAIL' && !item.immediateAction?.trim() && !item.capaId && !item.hazardId);
  }

  private score(items: InspectionItem[]): number {
    const scored = items.filter((item) => item.answer !== 'NA');
    if (!scored.length) return 0;
    const passed = scored.filter((item) => item.answer === 'PASS').length;
    return Math.round((passed / scored.length) * 1000) / 10;
  }

  private assertCanConduct(user: AuthUser): void {
    if (user.role === Role.SYS_ADMIN || user.permissions.includes(Permission.INSPECTION_CONDUCT)) return;
    throw new ForbiddenException('You cannot record an inspection');
  }

  private assertTypeAllowed(user: AuthUser, type: InspectionType): void {
    const staff = user.role === Role.STAFF || user.role === Role.DISTRICT_USER || user.role === Role.REGIONAL_USER;
    if (staff && !PRE_USE.includes(type)) {
      throw new ForbiddenException('A pre-use check covers a vehicle or PPE. A safety officer inspects the network');
    }
  }

  private async savePhotos(
    inspectionId: string,
    photos: NonNullable<CreateInspectionDto['photos']>,
  ): Promise<void> {
    if (photos.length > 4) throw new BadRequestException('An inspection can include up to 4 photos');
    const uploadDir = join(process.cwd(), 'data', 'uploads', 'inspections', inspectionId);
    await mkdir(uploadDir, { recursive: true });
    const rows: InspectionAttachment[] = [];
    for (const photo of photos) {
      const { buffer } = decodeUpload(photo.dataUrl, photo.mimeType, 'image');
      const safeName = (photo.fileName || 'photo').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      const storedName = `${randomUUID()}-${safeName}`;
      const relativeKey = join('uploads', 'inspections', inspectionId, storedName).replace(/\\/g, '/');
      await writeFile(join(uploadDir, storedName), buffer);
      rows.push(
        this.attachments.create({
          inspectionId,
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
    const prefix = `INSP-${year}-${regionCode}-${districtCode}-`;
    const last = await this.repo
      .createQueryBuilder('i')
      .where('i.referenceCode LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('i.referenceCode', 'DESC')
      .getOne();
    const next = last ? Number(last.referenceCode.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(Number.isFinite(next) ? next : 1).padStart(5, '0')}`;
  }
}
