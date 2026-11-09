import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuthUser,
  classifyRisk,
  computeRiskScore,
  PaginatedResult,
  Permission,
  RiskLikelihood,
  RiskSeverity,
  Role,
} from '@ecg-she/shared';
import { RiskAssessment, RiskAssessmentControlRow } from './entities/risk-assessment.entity';
import {
  CreateRiskAssessmentDto,
  RiskAssessmentControlRowDto,
  UpdateRiskAssessmentDto,
} from './dto/risk-assessment.dto';
import { RbacScopeService } from '../auth/rbac-scope.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { applyStatus, paginate, searchTerm } from '../../common/pagination';
import { CorrectiveAction } from '../corrective-actions/entities/corrective-action.entity';
import { renderSheReport, reportFilename } from '../../common/pdf/she-report';
import { riskAssessmentReport } from '../../common/pdf/record-reports';

@Injectable()
export class RiskAssessmentsService {
  constructor(
    @InjectRepository(RiskAssessment) private readonly repo: Repository<RiskAssessment>,
    @InjectRepository(CorrectiveAction) private readonly capa: Repository<CorrectiveAction>,
    private readonly scope: RbacScopeService,
    private readonly orgs: OrganizationsService,
  ) {}

  async create(user: AuthUser, dto: CreateRiskAssessmentDto): Promise<RiskAssessment> {
    if (dto.offlineClientId) {
      const existing = await this.repo.findOne({ where: { offlineClientId: dto.offlineClientId } });
      if (existing) return this.get(user, existing.id);
    }
    const scoped = this.scope.enforceWriteScope(user, {
      regionId: dto.regionId ?? user.regionId ?? null,
      districtId: dto.districtId ?? user.districtId ?? null,
    });
    if (!scoped.regionId) throw new BadRequestException('regionId required');

    const region = await this.orgs.getRegion(user, scoped.regionId);
    const districtCode = scoped.districtId
      ? (await this.orgs.getDistrict(user, scoped.districtId)).code
      : 'HQ';

    const saved = await this.repo.save(
      this.repo.create({
        locationWorkplace: dto.locationWorkplace.trim(),
        activityBeingDone: dto.activityBeingDone.trim(),
        assessmentDate: new Date(dto.assessmentDate),
        assessorNames: dto.assessorNames.trim(),
        othersConsulted: dto.othersConsulted?.trim() || null,
        regionId: scoped.regionId,
        districtId: scoped.districtId ?? null,
        selectedHazards: dto.selectedHazards ?? [],
        specificCircumstance: dto.specificCircumstance?.trim() || null,
        personsAtRisk: dto.personsAtRisk ?? [],
        controls: this.normalizeControls(dto.controls),
        controlConclusion: dto.controlConclusion ?? null,
        createdById: user.id,
        offlineClientId: dto.offlineClientId ?? null,
        referenceCode: await this.generateReferenceCode(region.code, districtCode),
        status: 'DRAFT',
      }),
    );
    return this.get(user, saved.id);
  }

  async update(user: AuthUser, id: string, dto: UpdateRiskAssessmentDto): Promise<RiskAssessment> {
    this.assertCanWrite(user);
    const row = await this.editable(user, id);
    await this.repo.update(row.id, {
      locationWorkplace: dto.locationWorkplace?.trim() || row.locationWorkplace,
      activityBeingDone: dto.activityBeingDone?.trim() || row.activityBeingDone,
      assessmentDate: dto.assessmentDate ? new Date(dto.assessmentDate) : row.assessmentDate,
      assessorNames: dto.assessorNames?.trim() || row.assessorNames,
      othersConsulted:
        dto.othersConsulted === undefined ? row.othersConsulted : dto.othersConsulted.trim() || null,
      selectedHazards: dto.selectedHazards ?? row.selectedHazards,
      specificCircumstance:
        dto.specificCircumstance === undefined
          ? row.specificCircumstance
          : dto.specificCircumstance.trim() || null,
      personsAtRisk: dto.personsAtRisk ?? row.personsAtRisk,
      controls: dto.controls ? this.normalizeControls(dto.controls) : row.controls,
      controlConclusion:
        dto.controlConclusion === undefined ? row.controlConclusion : dto.controlConclusion,
    });
    return this.get(user, id);
  }

  async submit(user: AuthUser, id: string): Promise<RiskAssessment> {
    this.assertCanWrite(user);
    const row = await this.editable(user, id);
    this.assertReady(row);
    await this.repo.update(row.id, { status: 'PENDING_APPROVAL', rejectionNotes: null });
    return this.get(user, id);
  }

  async approve(user: AuthUser, id: string): Promise<RiskAssessment> {
    this.assertCanApprove(user);
    const row = await this.get(user, id);
    if (row.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Only a submitted assessment can be approved');
    }
    await this.assertAdequatelyControlledOrCapa(row);
    await this.repo.update(row.id, {
      status: 'APPROVED',
      approvedById: user.id,
      approvedAt: new Date(),
      rejectionNotes: null,
    });
    return this.get(user, id);
  }

  async reject(user: AuthUser, id: string, notes: string): Promise<RiskAssessment> {
    this.assertCanApprove(user);
    const row = await this.get(user, id);
    if (row.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Only a submitted assessment can be sent back');
    }
    if (!notes.trim()) {
      throw new BadRequestException('Say what must change before sending the assessment back');
    }
    await this.repo.update(row.id, {
      status: 'REJECTED',
      rejectionNotes: notes.trim(),
      approvedById: null,
      approvedAt: null,
    });
    return this.get(user, id);
  }

  async revise(user: AuthUser, id: string): Promise<RiskAssessment> {
    this.assertCanWrite(user);
    const row = await this.get(user, id);
    if (row.status !== 'APPROVED' && row.status !== 'REJECTED') {
      throw new BadRequestException('Revise an assessment after it has been accepted or sent back');
    }
    await this.repo.update(row.id, {
      status: 'DRAFT',
      rejectionNotes: null,
      approvedById: null,
      approvedAt: null,
    });
    return this.get(user, id);
  }

  async list(user: AuthUser, query: PaginationQueryDto): Promise<PaginatedResult<RiskAssessment>> {
    const qb = this.baseQuery().orderBy('r.createdAt', 'DESC');
    this.scope.applyScopeFilter(qb, user, 'r', 'createdById');
    applyStatus(qb, 'r', query.status);
    const term = searchTerm(query.search);
    if (term) {
      qb.andWhere(
        '(LOWER(r.referenceCode) LIKE :term OR LOWER(r.activityBeingDone) LIKE :term OR LOWER(r.locationWorkplace) LIKE :term)',
        { term },
      );
    }
    return paginate(qb, query);
  }

  async get(user: AuthUser, id: string): Promise<RiskAssessment> {
    const qb = this.baseQuery().where('r.id = :id', { id });
    this.scope.applyScopeFilter(qb, user, 'r', 'createdById');
    const row = await qb.getOne();
    if (!row) throw new NotFoundException('Risk assessment not found');
    return row;
  }

  async reportPdf(user: AuthUser, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const row = await this.get(user, id);
    const actions = await this.capa.find({
      where: { sourceType: 'RISK_ASSESSMENT', sourceId: id },
      relations: ['assignee'],
      order: { dueDate: 'ASC' },
    });
    const buffer = await renderSheReport(riskAssessmentReport(row, actions, user.fullName));
    return { buffer, filename: reportFilename(row.referenceCode) };
  }

  private baseQuery() {
    return this.repo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.region', 'region')
      .leftJoinAndSelect('r.district', 'district');
  }

  private async editable(user: AuthUser, id: string): Promise<RiskAssessment> {
    const row = await this.get(user, id);
    if (row.status !== 'DRAFT' && row.status !== 'REJECTED') {
      throw new BadRequestException('This assessment can be edited while it is a draft or after it is sent back');
    }
    return row;
  }

  private assertReady(row: RiskAssessment): void {
    if (!row.locationWorkplace?.trim() || !row.activityBeingDone?.trim() || !row.assessmentDate) {
      throw new BadRequestException('Location, activity, and assessment date are required');
    }
    if (!row.assessorNames?.trim()) throw new BadRequestException('Assessor name is required');
    if (!(row.selectedHazards ?? []).length) {
      throw new BadRequestException('Tick at least one hazard');
    }
    if (!(row.personsAtRisk ?? []).length) {
      throw new BadRequestException('Select who is at risk');
    }
    const controls = row.controls ?? [];
    if (
      !controls.length ||
      controls.some(
        (c) =>
          !c.identifiedHazard?.trim() ||
          !c.consequence ||
          !c.likelihood ||
          !c.controlHierarchy ||
          !c.requiredControls?.trim(),
      )
    ) {
      throw new BadRequestException(
        'Add at least one control row with hazard, consequence, likelihood, hierarchy of control, and required controls',
      );
    }
    if (!row.controlConclusion) {
      throw new BadRequestException('Record whether the risk is adequately controlled');
    }
  }

  /** ISO 45001 §10.2 — inadequately controlled assessments need a linked CAPA before acceptance. */
  private async assertAdequatelyControlledOrCapa(row: RiskAssessment): Promise<void> {
    if (row.controlConclusion !== 'INADEQUATELY_CONTROLLED') return;
    const actions = await this.capa.count({
      where: { sourceType: 'RISK_ASSESSMENT', sourceId: row.id },
    });
    if (actions < 1) {
      throw new BadRequestException(
        'Raise a corrective action before accepting an inadequately controlled risk assessment',
      );
    }
  }

  private assertCanWrite(user: AuthUser): void {
    if (user.role === Role.SYS_ADMIN || user.permissions.includes(Permission.RISK_ASSESSMENT_CREATE)) return;
    throw new ForbiddenException('You cannot change this risk assessment');
  }

  private assertCanApprove(user: AuthUser): void {
    if (user.role === Role.SYS_ADMIN || user.permissions.includes(Permission.RISK_ASSESSMENT_APPROVE)) return;
    throw new ForbiddenException('A safety officer accepts a risk assessment');
  }

  private normalizeControls(rows?: RiskAssessmentControlRowDto[]): RiskAssessmentControlRow[] {
    return (rows ?? [])
      .map((row) => {
        const likelihood = row.likelihood?.trim() || null;
        const consequence = row.consequence?.trim() || null;
        const rated = likelihood && consequence;
        const residualLikelihood = row.residualLikelihood?.trim() || null;
        const residualSeverity = row.residualSeverity?.trim() || null;
        const residualRated = residualLikelihood && residualSeverity;
        return {
          identifiedHazard: row.identifiedHazard.trim(),
          consequence,
          likelihood,
          riskScore: rated
            ? computeRiskScore(likelihood as RiskLikelihood, consequence as RiskSeverity)
            : null,
          riskClass: rated
            ? classifyRisk(computeRiskScore(likelihood as RiskLikelihood, consequence as RiskSeverity))
            : null,
          controlHierarchy: row.controlHierarchy?.trim() || null,
          requiredControls: row.requiredControls?.trim() || '',
          implemented: row.implemented === true,
          residualLikelihood,
          residualSeverity,
          residualRiskScore: residualRated
            ? computeRiskScore(residualLikelihood as RiskLikelihood, residualSeverity as RiskSeverity)
            : null,
          residualRiskClass: residualRated
            ? classifyRisk(
                computeRiskScore(residualLikelihood as RiskLikelihood, residualSeverity as RiskSeverity),
              )
            : null,
        };
      })
      .filter((row) => row.identifiedHazard || row.requiredControls);
  }

  private async generateReferenceCode(regionCode: string, districtCode: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `RA-${year}-${regionCode}-${districtCode}-`;
    const last = await this.repo
      .createQueryBuilder('r')
      .where('r.referenceCode LIKE :p', { p: `${prefix}%` })
      .orderBy('r.referenceCode', 'DESC')
      .getOne();
    const next = last ? Number(last.referenceCode.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(Number.isFinite(next) ? next : 1).padStart(5, '0')}`;
  }
}
