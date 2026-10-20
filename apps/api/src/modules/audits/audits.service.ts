import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditStatus, AuthUser, isDistrictScope, isGlobalScope, PaginatedResult, Permission, PermissionValue, Role } from '@ecg-she/shared';
import { AuditCheckItem, AuditRecord } from './entities/audit-record.entity';
import { AuditFinding } from './entities/audit-finding.entity';
import { AuditCheckItemDto, CreateAuditDto } from './dto/audit.dto';
import { RbacScopeService } from '../auth/rbac-scope.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { User } from '../users/entities/user.entity';
import { CorrectiveAction } from '../corrective-actions/entities/corrective-action.entity';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { applyStatus, paginate, searchTerm } from '../../common/pagination';
import { renderSheReport, reportFilename } from '../../common/pdf/she-report';
import { auditReport } from '../../common/pdf/record-reports';

const NC = new Set(['MINOR_NC', 'MAJOR_NC', 'CRITICAL']);

@Injectable()
export class AuditsService {
  constructor(
    @InjectRepository(AuditRecord) private readonly audits: Repository<AuditRecord>,
    @InjectRepository(AuditFinding) private readonly findings: Repository<AuditFinding>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(CorrectiveAction) private readonly capas: Repository<CorrectiveAction>,
    private readonly scope: RbacScopeService,
    private readonly orgs: OrganizationsService,
  ) {}

  async create(user: AuthUser, dto: CreateAuditDto): Promise<AuditRecord> {
    this.assertCan(user, Permission.AUDIT_CONDUCT, 'You cannot plan an audit');
    const name = dto.leadAuditorName.trim();
    if (!name) throw new BadRequestException('Name the lead auditor');
    if (dto.leadAuditorId) {
      const auditor = await this.users.findOne({ where: { id: dto.leadAuditorId } });
      if (!auditor) throw new BadRequestException('Lead auditor was not found');
    }
    const scoped = this.scope.enforceWriteScope(user, {
      regionId: dto.regionId ?? user.regionId ?? null,
      districtId: dto.districtId ?? user.districtId ?? null,
    });
    if (!scoped.regionId) throw new BadRequestException('regionId required');
    const clauses = [...new Set(dto.criteria.map((clause) => clause.trim()).filter(Boolean))];
    if (!clauses.length) throw new BadRequestException('Choose the clauses to audit');
    const region = await this.orgs.getRegion(user, scoped.regionId);
    const districtCode = scoped.districtId ? (await this.orgs.getDistrict(user, scoped.districtId)).code : 'HQ';
    const saved = await this.audits.save(
      this.audits.create({
        type: dto.type,
        scope: dto.scope.trim(),
        objectives: dto.objectives.trim(),
        auditee: dto.auditee.trim(),
        criteria: clauses.join('\n'),
        methods: [...new Set(dto.methods)].join('\n'),
        scheduledDate: new Date(dto.scheduledDate),
        regionId: scoped.regionId,
        districtId: scoped.districtId ?? null,
        leadAuditorId: dto.leadAuditorId ?? null,
        leadAuditorName: name,
        checklist: clauses.map((clause) => ({ clause })),
        status: AuditStatus.PLANNED,
        referenceCode: await this.generateReferenceCode(region.code, districtCode),
      }),
    );
    return this.get(user, saved.id);
  }

  async start(user: AuthUser, id: string): Promise<AuditRecord> {
    this.assertCan(user, Permission.AUDIT_CONDUCT, 'You cannot conduct an audit');
    const audit = await this.get(user, id);
    if (audit.status !== AuditStatus.PLANNED) throw new BadRequestException('This audit is already underway');
    await this.audits.update(audit.id, { status: AuditStatus.IN_PROGRESS, startedAt: new Date() });
    return this.get(user, id);
  }

  async saveChecklist(user: AuthUser, id: string, items: AuditCheckItemDto[]): Promise<AuditRecord> {
    this.assertCan(user, Permission.AUDIT_CONDUCT, 'You cannot conduct an audit');
    const audit = await this.get(user, id);
    if (audit.status !== AuditStatus.IN_PROGRESS) {
      throw new BadRequestException('Walk the clauses while the audit is in progress');
    }
    const next = this.normalizeChecklist(audit.checklist ?? [], items);
    await this.syncFindings(audit.id, next);
    await this.audits.update(audit.id, { checklist: next });
    return this.get(user, id);
  }

  async report(user: AuthUser, id: string): Promise<AuditRecord> {
    this.assertCan(user, Permission.AUDIT_CONDUCT, 'You cannot issue the audit report');
    const audit = await this.get(user, id);
    if (audit.status !== AuditStatus.IN_PROGRESS) throw new BadRequestException('Start the audit before issuing the report');
    const checklist = audit.checklist ?? [];
    if (!checklist.length || checklist.some((item) => !item.result)) {
      throw new BadRequestException('Mark every clause conform, nonconform, or not applicable');
    }
    if (!checklist.some((item) => item.result === 'CONFORM' || item.result === 'NONCONFORM')) {
      throw new BadRequestException('Mark at least one clause conform or nonconform');
    }
    await this.audits.update(audit.id, { status: AuditStatus.REPORTING, finishedAt: new Date() });
    return this.get(user, id);
  }

  async respond(user: AuthUser, id: string, findingId: string, notes: string): Promise<AuditRecord> {
    const audit = await this.get(user, id);
    if (audit.status !== AuditStatus.REPORTING && audit.status !== AuditStatus.IN_PROGRESS) {
      throw new BadRequestException('The auditee responds while the audit is open');
    }
    const text = notes.trim();
    if (!text) throw new BadRequestException('Record what the auditee said');
    const finding = await this.finding(audit.id, findingId);
    const observation = finding.severity === 'OBSERVATION';
    await this.findings.update(finding.id, {
      auditeeResponse: text,
      status: observation ? 'CLOSED' : finding.status,
    });
    return this.get(user, id);
  }

  async linkAction(user: AuthUser, id: string, findingId: string, capaId: string): Promise<AuditRecord> {
    const canLink = user.role === Role.SYS_ADMIN
      || user.permissions.includes(Permission.AUDIT_CONDUCT)
      || user.permissions.includes(Permission.CAPA_CREATE);
    if (!canLink) throw new ForbiddenException('You cannot raise an action on this finding');
    const audit = await this.get(user, id);
    if (audit.status === AuditStatus.CLOSED || audit.status === AuditStatus.PLANNED) {
      throw new BadRequestException('Raise the action while the audit is underway or being reported');
    }
    const finding = await this.finding(audit.id, findingId);
    const capa = await this.capas.findOne({ where: { id: capaId, sourceType: 'AUDIT_FINDING', sourceId: finding.id } });
    if (!capa) throw new BadRequestException('The corrective action must be raised from this finding');
    await this.findings.update(finding.id, { capaId, status: 'CLOSED' });
    return this.get(user, id);
  }

  async close(user: AuthUser, id: string): Promise<AuditRecord> {
    this.assertCan(user, Permission.AUDIT_CLOSE, 'You cannot close an audit');
    const audit = await this.get(user, id);
    if (audit.status !== AuditStatus.REPORTING) throw new BadRequestException('Issue the report before closing the audit');
    for (const finding of audit.findings ?? []) {
      if (finding.status === 'CLOSED' && (finding.capaId || finding.severity === 'OBSERVATION')) continue;
      if (finding.capaId) {
        const capa = await this.capas.findOne({
          where: { id: finding.capaId, sourceType: 'AUDIT_FINDING', sourceId: finding.id },
        });
        if (capa) continue;
      }
      if (finding.severity === 'OBSERVATION' && finding.auditeeResponse?.trim()) continue;
      const needs = NC.has(finding.severity) ? 'a corrective action' : 'a corrective action or the auditee response';
      throw new BadRequestException(`"${finding.clauseRef ?? 'Finding'}" still needs ${needs}`);
    }
    await this.audits.update(audit.id, { status: AuditStatus.CLOSED, closedAt: new Date() });
    return this.get(user, id);
  }

  async list(user: AuthUser, query: PaginationQueryDto): Promise<PaginatedResult<AuditRecord>> {
    const qb = this.audits
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.region', 'region')
      .leftJoinAndSelect('a.district', 'district')
      .leftJoin('a.leadAuditor', 'lead')
      .addSelect(['lead.id', 'lead.fullName'])
      .orderBy('a.scheduledDate', 'DESC');
    this.scope.applyScopeFilter(qb, user, 'a');
    applyStatus(qb, 'a', query.status);
    const term = searchTerm(query.search);
    if (term) qb.andWhere('(LOWER(a.referenceCode) LIKE LOWER(:s) OR LOWER(a.scope) LIKE LOWER(:s) OR LOWER(a.auditee) LIKE LOWER(:s))', { s: term });
    return paginate(qb, query);
  }

  async get(user: AuthUser, id: string): Promise<AuditRecord> {
    const qb = this.audits
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.region', 'region')
      .leftJoinAndSelect('a.district', 'district')
      .leftJoinAndSelect('a.findings', 'findings')
      .leftJoin('a.leadAuditor', 'lead')
      .addSelect(['lead.id', 'lead.fullName'])
      .where('a.id = :id', { id });
    this.scope.applyScopeFilter(qb, user, 'a');
    const audit = await qb.getOne();
    if (!audit) throw new NotFoundException('Audit not found');
    return audit;
  }

  async reportPdf(user: AuthUser, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const row = await this.get(user, id);
    const buffer = await renderSheReport(auditReport(row, user.fullName));
    return { buffer, filename: reportFilename(row.referenceCode) };
  }

  async people(user: AuthUser): Promise<Array<{ id: string; fullName: string; role: Role }>> {
    const qb = this.users
      .createQueryBuilder('u')
      .select(['u.id', 'u.fullName', 'u.role'])
      .where('u.active = :active', { active: true })
      .orderBy('u.fullName', 'ASC');
    if (!isGlobalScope(user.role)) qb.andWhere('u.regionId = :regionId', { regionId: user.regionId });
    if (isDistrictScope(user.role)) {
      qb.andWhere('(u.districtId = :districtId OR u.districtId IS NULL)', { districtId: user.districtId });
    }
    return qb.getMany();
  }

  private normalizeChecklist(planned: AuditCheckItem[], items: AuditCheckItemDto[]): AuditCheckItem[] {
    const incoming = new Map(items.map((item) => [item.clause.trim(), item]));
    if (incoming.size !== planned.length || planned.some((item) => !incoming.has(item.clause))) {
      throw new BadRequestException('Keep the clauses that were planned');
    }
    return planned.map((item) => {
      const next = incoming.get(item.clause)!;
      const evidence = next.evidence?.trim() || undefined;
      if (next.result === 'NONCONFORM' && !evidence) {
        throw new BadRequestException(`Describe the evidence: ${item.clause}`);
      }
      if (next.result === 'NONCONFORM' && !next.severity) {
        throw new BadRequestException(`Grade the nonconformity: ${item.clause}`);
      }
      return {
        clause: item.clause,
        result: next.result,
        evidence,
        severity: next.result === 'NONCONFORM' ? next.severity : undefined,
        findingId: item.findingId,
      };
    });
  }

  private async syncFindings(auditId: string, checklist: AuditCheckItem[]): Promise<void> {
    const existing = await this.findings.find({ where: { auditId } });
    const byClause = new Map(existing.map((finding) => [finding.clauseRef ?? '', finding]));
    for (const item of checklist) {
      const current = byClause.get(item.clause);
      if (item.result !== 'NONCONFORM') {
        if (current && current.status === 'OPEN' && !current.capaId) await this.findings.delete(current.id);
        item.findingId = current && current.capaId ? current.id : undefined;
        continue;
      }
      if (current) {
        await this.findings.update(current.id, {
          severity: item.severity!,
          description: item.evidence!,
          clauseRef: item.clause,
        });
        item.findingId = current.id;
        continue;
      }
      const created = await this.findings.save(
        this.findings.create({
          auditId,
          severity: item.severity!,
          clauseRef: item.clause,
          description: item.evidence!,
          status: 'OPEN',
        }),
      );
      item.findingId = created.id;
    }
  }

  private async finding(auditId: string, findingId: string): Promise<AuditFinding> {
    const finding = await this.findings.findOne({ where: { id: findingId, auditId } });
    if (!finding) throw new NotFoundException('Finding not found');
    return finding;
  }

  private assertCan(user: AuthUser, permission: PermissionValue, message: string): void {
    if (user.role === Role.SYS_ADMIN || user.permissions.includes(permission)) return;
    throw new ForbiddenException(message);
  }

  private async generateReferenceCode(regionCode: string, districtCode: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `AUD-${year}-${regionCode}-${districtCode}-`;
    const last = await this.audits
      .createQueryBuilder('a')
      .where('a.referenceCode LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('a.referenceCode', 'DESC')
      .getOne();
    const next = last ? Number(last.referenceCode.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(Number.isFinite(next) ? next : 1).padStart(5, '0')}`;
  }
}
