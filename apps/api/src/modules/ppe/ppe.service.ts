import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThan, Repository } from 'typeorm';
import { AuthUser, PaginatedResult, ppeForPermit, Role, isDistrictScope, isGlobalScope } from '@ecg-she/shared';
import { PpeIssuance, PpeItem } from './entities/ppe.entity';
import { CreatePpeItemDto, IssuePpeDto, WithdrawPpeDto } from './dto/ppe.dto';
import { RbacScopeService } from '../auth/rbac-scope.service';
import { assertRecordAccess } from '../auth/access-control';
import { getCurrentTenantId } from '../../common/context/request-context';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { paginate, searchTerm } from '../../common/pagination';

const SIZED = new Set(['HAND', 'FOOT', 'BODY', 'FALL_PROTECTION']);
const SERIALISED = new Set(['INSULATING', 'FALL_PROTECTION']);
const RETESTED = new Set(['INSULATING', 'FALL_PROTECTION']);
const ARC_MARK = /61482|F1959|F2178|arc-flash|Arc-rated/i;

@Injectable()
export class PpeService {
  constructor(
    @InjectRepository(PpeItem) private readonly items: Repository<PpeItem>,
    @InjectRepository(PpeIssuance) private readonly issuance: Repository<PpeIssuance>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly scope: RbacScopeService,
    private readonly notifications: NotificationsService,
  ) {}

  async createItem(user: AuthUser, dto: CreatePpeItemDto): Promise<PpeItem> {
    const scoped = this.scope.enforceWriteScope(user, {
      regionId: dto.regionId ?? user.regionId ?? null,
      districtId: dto.districtId ?? user.districtId ?? null,
    });
    if (!scoped.regionId) throw new BadRequestException('regionId required');
    if (dto.category === 'INSULATING' && !dto.voltageClass) {
      throw new BadRequestException('Insulating gloves need a voltage class');
    }
    if (RETESTED.has(dto.category) && !dto.retestIntervalMonths) {
      throw new BadRequestException('Set how many months pass before the next test');
    }
    const arcMarked = ARC_MARK.test(`${dto.enStandard ?? ''} ${dto.ansiStandard ?? ''}`);
    if (arcMarked && !dto.nfpaArcCategory) {
      throw new BadRequestException('Arc-rated clothing needs an NFPA 70E category');
    }
    const sku = dto.sku.trim();
    if (await this.items.findOne({ where: { sku } })) throw new BadRequestException('That part code is already in use');
    return this.items.save(this.items.create({
      sku,
      name: dto.name.trim(),
      category: dto.category,
      stockOnHand: dto.stockOnHand,
      reorderLevel: dto.reorderLevel ?? 0,
      shelfLifeMonths: dto.shelfLifeMonths ?? null,
      retestIntervalMonths: dto.retestIntervalMonths ?? null,
      regionId: scoped.regionId,
      districtId: scoped.districtId ?? null,
      manufacturer: dto.manufacturer?.trim() || null,
      modelNumber: dto.modelNumber?.trim() || null,
      enStandard: dto.enStandard ?? null,
      ansiStandard: dto.ansiStandard ?? null,
      nfpaArcCategory: dto.nfpaArcCategory ?? null,
      voltageClass: dto.voltageClass ?? null,
    }));
  }

  async listItems(user: AuthUser, query: PaginationQueryDto & { stockLow?: boolean }): Promise<PaginatedResult<PpeItem & { stockLow: boolean }>> {
    const qb = this.items.createQueryBuilder('p').leftJoinAndSelect('p.region', 'region').leftJoinAndSelect('p.district', 'district').orderBy('p.name', 'ASC');
    this.applyCatalogueScope(qb, user);
    const term = searchTerm(query.search);
    if (term) qb.andWhere('(LOWER(p.name) LIKE LOWER(:s) OR LOWER(p.sku) LIKE LOWER(:s))', { s: term });
    if (query.stockLow) qb.andWhere('p.reorderLevel > 0 AND p.stockOnHand <= p.reorderLevel');
    const page = await paginate(qb, query);
    return {
      ...page,
      items: page.items.map((item) => Object.assign(item, { stockLow: item.reorderLevel > 0 && item.stockOnHand <= item.reorderLevel })),
    };
  }

  async getItem(user: AuthUser, id: string): Promise<Record<string, unknown>> {
    const item = await this.visibleItem(user, id);
    const holders = await this.issuance
      .createQueryBuilder('i')
      .leftJoin('i.employee', 'employee')
      .addSelect(['employee.id', 'employee.fullName'])
      .where('i.ppeItemId = :id', { id })
      .orderBy('i.issuedOn', 'DESC')
      .getMany();
    return { ...item, stockLow: item.reorderLevel > 0 && item.stockOnHand <= item.reorderLevel, issues: holders.map((row) => this.presentIssue(row)) };
  }

  async issue(user: AuthUser, dto: IssuePpeDto): Promise<Record<string, unknown>> {
    const item = await this.visibleItem(user, dto.ppeItemId);
    await this.requireEmployee(user, dto.employeeId);
    const serial = dto.serialNumber?.trim() || null;
    const size = dto.size?.trim() || null;
    if (SERIALISED.has(item.category)) {
      if (!serial) throw new BadRequestException('This item needs a serial number');
      if (dto.quantity !== 1) throw new BadRequestException('A serialised item is issued one at a time');
      const open = await this.issuance.findOne({ where: { serialNumber: serial, status: 'ISSUED' } });
      if (open) throw new BadRequestException('That serial number is already out with someone');
    }
    if (SIZED.has(item.category) && !size) throw new BadRequestException('Record the size');
    if (item.stockOnHand < dto.quantity) throw new BadRequestException('There are not enough of this item in stock');
    const scoped = this.scope.enforceWriteScope(user, {
      regionId: dto.regionId ?? item.regionId,
      districtId: dto.districtId ?? user.districtId ?? null,
    });
    const saved = await this.issuance.save(this.issuance.create({
      ppeItemId: item.id,
      employeeId: dto.employeeId,
      issuedOn: dto.issuedOn,
      quantity: dto.quantity,
      size,
      serialNumber: serial,
      batchNumber: dto.batchNumber?.trim() || null,
      issueReason: dto.issueReason ?? null,
      inspectionNotes: dto.inspectionNotes?.trim() || null,
      expiresOn: this.addMonths(dto.issuedOn, item.shelfLifeMonths),
      nextTestOn: this.addMonths(dto.issuedOn, item.retestIntervalMonths),
      status: 'ISSUED',
      regionId: scoped.regionId!,
      districtId: scoped.districtId ?? null,
    }));
    const remaining = item.stockOnHand - dto.quantity;
    await this.items.update(item.id, { stockOnHand: remaining });
    if (item.reorderLevel > 0 && item.stockOnHand > item.reorderLevel && remaining <= item.reorderLevel) {
      await this.notifications.broadcastToScope({
        topic: 'ppe.low-stock',
        title: `${item.name} is low in stock`,
        body: `${remaining} left. Reorder at ${item.reorderLevel}.`,
        regionId: item.regionId,
        districtId: item.districtId,
        priority: 'HIGH',
        payload: { ppeItemId: item.id },
      }).catch(() => undefined);
    }
    return { id: saved.id, ppeItemId: item.id };
  }

  async withdraw(user: AuthUser, id: string, dto: WithdrawPpeDto): Promise<Record<string, unknown>> {
    const row = await this.issuance.findOne({ where: { id }, relations: { item: true } });
    if (!row) throw new NotFoundException('Issue not found');
    assertRecordAccess(user, row, row.employeeId, getCurrentTenantId());
    await this.visibleItem(user, row.ppeItemId);
    if (row.status !== 'ISSUED') throw new BadRequestException('Only equipment that is still out can be closed');
    await this.issuance.update(id, {
      status: dto.status,
      inspectionNotes: dto.inspectionNotes?.trim() || row.inspectionNotes,
    });
    if (dto.status === 'RETURNED' && this.serviceable(row) && row.item) {
      await this.items.update(row.item.id, { stockOnHand: row.item.stockOnHand + row.quantity });
    }
    return this.getItem(user, row.ppeItemId);
  }

  async due(user: AuthUser, query: PaginationQueryDto): Promise<PaginatedResult<Record<string, unknown>>> {
    const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const qb = this.issuance
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.item', 'item')
      .leftJoin('i.employee', 'employee')
      .addSelect(['employee.id', 'employee.fullName'])
      .where('i.status = :status', { status: 'ISSUED' })
      .andWhere('(i.expiresOn <= :soon OR i.nextTestOn <= :soon)', { soon })
      .orderBy('i.expiresOn', 'ASC');
    this.scope.applyScopeFilter(qb, user, 'i');
    const page = await paginate(qb, query);
    return { ...page, items: page.items.map((row) => this.presentIssue(row)) };
  }

  async holderKit(employeeId: string, category: 'FALL_PROTECTION' | 'INSULATING'): Promise<Record<string, unknown>> {
    if (category !== 'FALL_PROTECTION' && category !== 'INSULATING') {
      throw new BadRequestException('Choose fall protection or insulating gloves');
    }
    const catalogue = await this.items.count({ where: { category } });
    if (!catalogue) return { required: false, category, state: 'NONE' };
    const rows = await this.issuance.find({
      where: { employeeId, status: 'ISSUED' },
      relations: { item: true },
      order: { issuedOn: 'DESC' },
    });
    const ofKind = rows.filter((row) => row.item?.category === category);
    const match = ofKind.find((row) => this.serviceable(row)) ?? ofKind[0];
    if (!match) return { required: true, category, state: 'NONE' };
    return {
      required: true,
      category,
      state: this.stateOf(match),
      itemName: match.item?.name,
      serialNumber: match.serialNumber,
      expiresOn: match.expiresOn ? String(match.expiresOn).slice(0, 10) : null,
      nextTestOn: match.nextTestOn ? String(match.nextTestOn).slice(0, 10) : null,
    };
  }

  async assertForIssue(employeeId: string, permitType: string): Promise<void> {
    const category = ppeForPermit(permitType);
    if (!category) return;
    const result = await this.holderKit(employeeId, category);
    if (!result.required || result.state === 'CURRENT' || result.state === 'EXPIRING' || result.state === 'TEST_SOON') return;
    const label = category === 'FALL_PROTECTION' ? 'fall-protection PPE' : 'insulating gloves';
    if (result.state === 'TEST_DUE') throw new BadRequestException(`The holder's ${label} are past their test date`);
    if (result.state === 'EXPIRED') throw new BadRequestException(`The holder's ${label} have expired`);
    throw new BadRequestException(`The holder has no current ${label}`);
  }

  people(user: AuthUser): Promise<Array<{ id: string; fullName: string; role: Role }>> {
    const qb = this.users.createQueryBuilder('u').select(['u.id', 'u.fullName', 'u.role']).where('u.active = :active', { active: true }).orderBy('u.fullName', 'ASC');
    if (!isGlobalScope(user.role)) qb.andWhere('u.regionId = :regionId', { regionId: user.regionId });
    if (isDistrictScope(user.role)) qb.andWhere('(u.districtId = :districtId OR u.districtId IS NULL)', { districtId: user.districtId });
    return qb.getMany();
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async refreshIssueStatus(): Promise<void> {
    await this.issuance.update({ status: 'ISSUED', expiresOn: LessThan(new Date()) }, { status: 'EXPIRED' });
  }

  private serviceable(row: PpeIssuance): boolean {
    return this.stateOf(row) === 'CURRENT' || this.stateOf(row) === 'EXPIRING' || this.stateOf(row) === 'TEST_SOON';
  }

  private stateOf(row: PpeIssuance): 'CURRENT' | 'EXPIRING' | 'EXPIRED' | 'TEST_SOON' | 'TEST_DUE' | 'CLOSED' {
    if (row.status === 'RETURNED' || row.status === 'DAMAGED' || row.status === 'LOST') return 'CLOSED';
    const today = new Date().toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
    const expires = row.expiresOn ? String(row.expiresOn).slice(0, 10) : '';
    const test = row.nextTestOn ? String(row.nextTestOn).slice(0, 10) : '';
    if (row.status === 'EXPIRED' || (expires && expires < today)) return 'EXPIRED';
    if (test && test < today) return 'TEST_DUE';
    if (test && test <= soon) return 'TEST_SOON';
    if (expires && expires <= soon) return 'EXPIRING';
    return 'CURRENT';
  }

  private presentIssue(row: PpeIssuance): Record<string, unknown> {
    return {
      id: row.id,
      status: row.status,
      state: this.stateOf(row),
      quantity: row.quantity,
      size: row.size,
      serialNumber: row.serialNumber,
      issuedOn: row.issuedOn ? String(row.issuedOn).slice(0, 10) : null,
      expiresOn: row.expiresOn ? String(row.expiresOn).slice(0, 10) : null,
      nextTestOn: row.nextTestOn ? String(row.nextTestOn).slice(0, 10) : null,
      employee: row.employee ? { id: row.employee.id, fullName: row.employee.fullName } : { id: row.employeeId },
      item: row.item ? { id: row.item.id, name: row.item.name, sku: row.item.sku, category: row.item.category } : { id: row.ppeItemId },
    };
  }

  private async visibleItem(user: AuthUser, id: string): Promise<PpeItem> {
    const qb = this.items.createQueryBuilder('p').where('p.id = :id', { id });
    this.applyCatalogueScope(qb, user);
    const item = await qb.getOne();
    if (!item) throw new NotFoundException('PPE item not found');
    return item;
  }

  private applyCatalogueScope(qb: { andWhere: (sql: string, params?: object) => unknown }, user: AuthUser): void {
    if (isGlobalScope(user.role)) return;
    qb.andWhere('p.regionId = :regionId', { regionId: user.regionId });
    if (isDistrictScope(user.role)) qb.andWhere('(p.districtId IS NULL OR p.districtId = :districtId)', { districtId: user.districtId });
  }

  private async requireEmployee(user: AuthUser, id: string): Promise<void> {
    const person = await this.users.findOne({ where: { id } });
    if (!person) throw new BadRequestException('Choose a person from the list');
    if (!isGlobalScope(user.role) && person.regionId && person.regionId !== user.regionId) {
      throw new BadRequestException('That person is outside your region');
    }
  }

  private addMonths(from: string, months?: number | null): string | null {
    if (!months) return null;
    const date = new Date(from);
    date.setMonth(date.getMonth() + months);
    return date.toISOString().slice(0, 10);
  }
}
