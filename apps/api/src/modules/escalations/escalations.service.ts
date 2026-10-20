import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  AuthUser,
  EscalationAction,
  EscalationEntityType,
  isDistrictScope,
  isGlobalScope,
  isRegionalScope,
  isSafetyOfficer,
  isStaffRole,
  issueScopeForRole,
  Permission,
  Role,
  ISSUE_SCOPE_LABEL,
  ISSUE_SCOPE_LADDER,
  IncidentStatus,
  IssueScope,
} from '@ecg-she/shared';
import { IssueEscalation } from './entities/issue-escalation.entity';
import { Incident } from '../incidents/entities/incident.entity';
import { Hazard } from '../hazards/entities/hazard.entity';
import { NearMiss } from '../near-miss/entities/near-miss.entity';
import { assertNearMissCloseable } from '../near-miss/near-miss.service';
import { assertHazardCloseable } from '../hazards/hazards.service';
import { CorrectiveAction } from '../corrective-actions/entities/corrective-action.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { EscalateBodyDto, ReopenBodyDto, ResolveBodyDto } from './dto/escalation.dto';

/** Common shape every issue we operate on must satisfy. */
interface EscalatableIssue {
  id: string;
  referenceCode?: string | null;
  title?: string | null;
  regionId: string;
  districtId?: string | null;
  currentScope: IssueScope;
  resolvedAt?: Date | null;
  resolvedById?: string | null;
  resolvedAtScope?: IssueScope | null;
  resolutionNotes?: string | null;
}

@Injectable()
export class EscalationsService {
  private readonly logger = new Logger(EscalationsService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(IssueEscalation) private readonly escalations: Repository<IssueEscalation>,
    @InjectRepository(Incident) private readonly incidents: Repository<Incident>,
    @InjectRepository(Hazard) private readonly hazards: Repository<Hazard>,
    @InjectRepository(NearMiss) private readonly nearMisses: Repository<NearMiss>,
    @InjectRepository(CorrectiveAction) private readonly capa: Repository<CorrectiveAction>,
    private readonly notifications: NotificationsService,
  ) {}

  /* ────────────────────────────────────────────────────────────────────
   *  Public actions
   * ──────────────────────────────────────────────────────────────────── */

  async escalate(user: AuthUser, dto: EscalateBodyDto): Promise<IssueEscalation> {
    this.assertOfficer(user);
    if (!dto?.reason?.trim()) {
      throw new BadRequestException('A reason for escalation is required');
    }
    const issue = await this.loadIssue(dto.entityType, dto.entityId);
    this.assertCanRead(user, issue);
    this.assertOfficerForNearMiss(user, dto.entityType);
    if (issue.resolvedAt) {
      throw new BadRequestException('This issue is already resolved — reopen it before escalating again');
    }

    const fromScope = issue.currentScope;
    const toScope = dto.toScope ?? this.nextScope(fromScope);
    if (!toScope || toScope === fromScope) {
      throw new BadRequestException(
        `Cannot escalate beyond ${ISSUE_SCOPE_LABEL[fromScope]} — already at the top tier`,
      );
    }
    this.assertScopeAscends(fromScope, toScope);
    this.assertCanEscalateFrom(user, fromScope);

    return this.applyTransition({
      user,
      issue,
      action: EscalationAction.ESCALATE,
      entityType: dto.entityType,
      fromScope,
      toScope,
      reason: dto.reason.trim(),
      toUserId: dto.toUserId,
    });
  }

  async referDown(user: AuthUser, dto: EscalateBodyDto): Promise<IssueEscalation> {
    this.assertOfficer(user);
    if (!dto?.reason?.trim()) {
      throw new BadRequestException('A reason for the referral is required');
    }
    const issue = await this.loadIssue(dto.entityType, dto.entityId);
    this.assertCanRead(user, issue);
    this.assertOfficerForNearMiss(user, dto.entityType);
    if (issue.resolvedAt) {
      throw new BadRequestException('Issue already resolved — reopen first');
    }

    const fromScope = issue.currentScope;
    const toScope = dto.toScope ?? this.previousScope(fromScope);
    if (!toScope || toScope === fromScope) {
      throw new BadRequestException(
        `Cannot refer below ${ISSUE_SCOPE_LABEL[fromScope]} — already at the lowest tier`,
      );
    }
    this.assertScopeDescends(fromScope, toScope);
    this.assertCanReferFrom(user, fromScope);

    return this.applyTransition({
      user,
      issue,
      action: EscalationAction.REFER_DOWN,
      entityType: dto.entityType,
      fromScope,
      toScope,
      reason: dto.reason.trim(),
      toUserId: dto.toUserId,
    });
  }

  async resolve(user: AuthUser, dto: ResolveBodyDto): Promise<IssueEscalation> {
    this.assertOfficer(user);
    if (!dto?.notes?.trim()) {
      throw new BadRequestException('Resolution notes are required');
    }
    const issue = await this.loadIssue(dto.entityType, dto.entityId);
    this.assertCanRead(user, issue);
    this.assertOfficerForNearMiss(user, dto.entityType);
    if (issue.resolvedAt) {
      throw new BadRequestException('Issue already resolved');
    }
    if (dto.entityType === EscalationEntityType.NEAR_MISS) {
      const nearMiss = issue as NearMiss;
      await assertNearMissCloseable(this.capa, nearMiss, dto.notes, dto.noFurtherAction === true);
    }
    if (dto.entityType === EscalationEntityType.HAZARD) {
      const hazard = issue as Hazard;
      await assertHazardCloseable(this.capa, hazard, dto.notes, dto.noFurtherAction === true);
    }
    this.assertCanActAtScope(user, issue.currentScope);

    return this.applyTransition({
      user,
      issue,
      action: EscalationAction.RESOLVE,
      entityType: dto.entityType,
      fromScope: issue.currentScope,
      toScope: issue.currentScope,
      reason: dto.notes.trim(),
    });
  }

  async reopen(user: AuthUser, dto: ReopenBodyDto): Promise<IssueEscalation> {
    this.assertOfficer(user);
    if (!dto?.reason?.trim()) {
      throw new BadRequestException('A reason for reopening is required');
    }
    const issue = await this.loadIssue(dto.entityType, dto.entityId);
    this.assertCanRead(user, issue);
    this.assertOfficerForNearMiss(user, dto.entityType);
    if (!issue.resolvedAt) {
      throw new BadRequestException('Issue is not currently resolved');
    }
    // Only users with authority at the resolution scope (or higher) can reopen.
    const targetScope = issue.resolvedAtScope ?? issue.currentScope;
    this.assertCanActAtScope(user, targetScope);

    return this.applyTransition({
      user,
      issue,
      action: EscalationAction.REOPEN,
      entityType: dto.entityType,
      fromScope: targetScope,
      toScope: targetScope,
      reason: dto.reason.trim(),
    });
  }

  /** Returns every transition for the given issue, oldest first. */
  async history(
    user: AuthUser,
    entityType: EscalationEntityType,
    entityId: string,
  ): Promise<IssueEscalation[]> {
    const issue = await this.loadIssue(entityType, entityId);
    this.assertCanRead(user, issue);
    return this.escalations.find({
      where: { entityType, entityId },
      relations: ['fromUser', 'toUser'],
      order: { createdAt: 'ASC' },
    });
  }

  /* ────────────────────────────────────────────────────────────────────
   *  Internals
   * ──────────────────────────────────────────────────────────────────── */

  private async applyTransition(params: {
    user: AuthUser;
    issue: EscalatableIssue;
    action: EscalationAction;
    entityType: EscalationEntityType;
    fromScope: IssueScope;
    toScope: IssueScope;
    reason: string;
    toUserId?: string;
  }): Promise<IssueEscalation> {
    const { user, issue, action, entityType, fromScope, toScope, reason, toUserId } = params;

    const saved = await this.ds.transaction(async (tx) => {
      const escalationRow = tx.getRepository(IssueEscalation).create({
        entityType,
        entityId: issue.id,
        entityReferenceCode: issue.referenceCode ?? null,
        action,
        fromScope,
        toScope,
        fromUserId: user.id,
        toUserId: toUserId ?? null,
        reason,
        regionId: issue.regionId,
        districtId: issue.districtId ?? null,
      });
      const persisted = await tx.getRepository(IssueEscalation).save(escalationRow);

      // Mutate the underlying issue.
      const repo = this.repoFor(entityType, tx);
      const patch: Partial<EscalatableIssue> = {};
      const incidentPatch: Record<string, unknown> = {};
      switch (action) {
        case EscalationAction.ESCALATE:
        case EscalationAction.REFER_DOWN:
          patch.currentScope = toScope;
          break;
        case EscalationAction.RESOLVE:
          patch.resolvedAt = new Date();
          patch.resolvedById = user.id;
          patch.resolvedAtScope = fromScope;
          patch.resolutionNotes = reason;
          if (entityType === EscalationEntityType.INCIDENT || entityType === EscalationEntityType.NEAR_MISS) {
            incidentPatch.status = IncidentStatus.CLOSED;
            incidentPatch.closedAt = new Date();
          }
          if (entityType === EscalationEntityType.HAZARD) {
            incidentPatch.status = 'CLOSED';
          }
          break;
        case EscalationAction.REOPEN:
          patch.resolvedAt = null;
          patch.resolvedById = null;
          patch.resolvedAtScope = null;
          patch.resolutionNotes = null;
          if (entityType === EscalationEntityType.INCIDENT) {
            incidentPatch.status = (issue as Incident).investigatorId
              ? IncidentStatus.UNDER_INVESTIGATION
              : IncidentStatus.REPORTED;
            incidentPatch.closedAt = null;
          }
          if (entityType === EscalationEntityType.NEAR_MISS) {
            incidentPatch.status = (issue as NearMiss).investigatorId ? 'UNDER_REVIEW' : 'REPORTED';
            incidentPatch.closedAt = null;
            incidentPatch.convertedIncidentId = null;
          }
          if (entityType === EscalationEntityType.HAZARD) {
            const hazard = issue as Hazard;
            incidentPatch.status = hazard.controlHierarchy || hazard.controlMeasures?.trim() ? 'MITIGATED' : 'OPEN';
          }
          break;
        case EscalationAction.REASSIGN:
          if (entityType === EscalationEntityType.INCIDENT && toUserId) {
            incidentPatch.investigatorId = toUserId;
            if (!(issue as Incident).resolvedAt) {
              incidentPatch.status = IncidentStatus.UNDER_INVESTIGATION;
            }
          }
          break;
      }
      if (Object.keys(patch).length || Object.keys(incidentPatch).length) {
        await repo.update({ id: issue.id }, { ...patch, ...incidentPatch } as never);
      }
      return persisted;
    });

    // Notify the people who now own the issue (or those who originated it
    // when resolving). Best-effort — never fails the caller.
    void this.notifyAfterTransition({
      action,
      issue,
      entityType,
      fromScope,
      toScope,
      reason,
      actorId: user.id,
      toUserId,
    }).catch((err) =>
      this.logger.warn(`Notification fan-out failed: ${(err as Error).message}`),
    );

    return saved;
  }

  private async notifyAfterTransition(params: {
    action: EscalationAction;
    issue: EscalatableIssue;
    entityType: EscalationEntityType;
    fromScope: IssueScope;
    toScope: IssueScope;
    reason: string;
    actorId: string;
    toUserId?: string;
  }): Promise<void> {
    const { action, issue, entityType, fromScope, toScope, reason, actorId, toUserId } = params;
    const ref = issue.referenceCode ?? issue.id.slice(0, 8);
    const route = this.routeFor(entityType, issue.id);

    if (action === EscalationAction.ESCALATE || action === EscalationAction.REFER_DOWN) {
      const direction = action === EscalationAction.ESCALATE ? 'escalated' : 'referred down';
      await this.notifications.broadcastToScope({
        topic: `escalation.${action.toLowerCase()}`,
        title: `${ref} ${direction} to ${ISSUE_SCOPE_LABEL[toScope]}`,
        body: `${entityType} ${ref} was ${direction} from ${ISSUE_SCOPE_LABEL[fromScope]}: ${reason}`,
        regionId: issue.regionId,
        districtId: issue.districtId ?? null,
        payload: { entityType, entityId: issue.id, fromScope, toScope, route },
        priority: action === EscalationAction.ESCALATE ? 'HIGH' : 'NORMAL',
        excludeUserId: actorId,
      });
    } else if (action === EscalationAction.RESOLVE) {
      await this.notifications.broadcastToScope({
        topic: 'escalation.resolved',
        title: `${ref} resolved at ${ISSUE_SCOPE_LABEL[fromScope]}`,
        body: reason,
        regionId: issue.regionId,
        districtId: issue.districtId ?? null,
        payload: { entityType, entityId: issue.id, route },
        priority: 'NORMAL',
        excludeUserId: actorId,
      });
    } else if (action === EscalationAction.REOPEN) {
      await this.notifications.broadcastToScope({
        topic: 'escalation.reopened',
        title: `${ref} reopened`,
        body: reason,
        regionId: issue.regionId,
        districtId: issue.districtId ?? null,
        payload: { entityType, entityId: issue.id, route },
        priority: 'HIGH',
        excludeUserId: actorId,
      });
    } else if (action === EscalationAction.REASSIGN && toUserId && toUserId !== actorId && entityType === EscalationEntityType.INCIDENT) {
      await this.notifications.notifyUser({
        recipientId: toUserId,
        topic: 'incident.assigned',
        title: `Incident assigned to you · ${ref}`,
        body: reason || `${issue.title ?? 'An incident'} was assigned to you.`,
        payload: { incidentId: issue.id, route },
        priority: 'HIGH',
      });
    }
  }

  private routeFor(entityType: EscalationEntityType, id: string): string {
    switch (entityType) {
      case EscalationEntityType.INCIDENT:
        return `/incidents/${id}`;
      case EscalationEntityType.HAZARD:
        return `/hazards/${id}`;
      case EscalationEntityType.NEAR_MISS:
        return `/near-miss/${id}`;
      case EscalationEntityType.CAPA:
        return `/capa`;
    }
  }

  private repoFor(entityType: EscalationEntityType, manager: DataSource['manager'] | null = null) {
    const m = manager ?? this.ds.manager;
    switch (entityType) {
      case EscalationEntityType.INCIDENT:
        return m.getRepository(Incident);
      case EscalationEntityType.HAZARD:
        return m.getRepository(Hazard);
      case EscalationEntityType.NEAR_MISS:
        return m.getRepository(NearMiss);
      case EscalationEntityType.CAPA:
        return m.getRepository(CorrectiveAction);
    }
  }

  private async loadIssue(
    entityType: EscalationEntityType,
    entityId: string,
  ): Promise<EscalatableIssue> {
    const repo = this.repoFor(entityType);
    const row = (await repo.findOne({ where: { id: entityId } as never })) as
      | EscalatableIssue
      | null;
    if (!row) {
      throw new NotFoundException(`${entityType} ${entityId} not found`);
    }
    if (!row.regionId) {
      throw new BadRequestException(`${entityType} ${entityId} has no region — cannot escalate`);
    }
    return row;
  }

  /* ── Ladder helpers ─────────────────────────────────────────────────── */

  private nextScope(s: IssueScope): IssueScope | null {
    const idx = ISSUE_SCOPE_LADDER.indexOf(s);
    return idx >= 0 && idx < ISSUE_SCOPE_LADDER.length - 1 ? ISSUE_SCOPE_LADDER[idx + 1] : null;
  }

  private previousScope(s: IssueScope): IssueScope | null {
    const idx = ISSUE_SCOPE_LADDER.indexOf(s);
    return idx > 0 ? ISSUE_SCOPE_LADDER[idx - 1] : null;
  }

  private rankOfScope(s: IssueScope): number {
    return ISSUE_SCOPE_LADDER.indexOf(s);
  }

  /* ── Authorisation rules ────────────────────────────────────────────── */

  /** Reporting staff can file a near-miss or a hazard. Moving or closing it belongs to a safety officer. */
  private assertOfficerForNearMiss(user: AuthUser, entityType: EscalationEntityType): void {
    if (entityType === EscalationEntityType.NEAR_MISS) {
      if (user.role === Role.SYS_ADMIN || isSafetyOfficer(user.role)) return;
      throw new ForbiddenException('A safety officer reviews a near-miss');
    }
    if (entityType === EscalationEntityType.HAZARD) {
      if (user.role === Role.SYS_ADMIN || user.permissions.includes(Permission.HAZARD_APPROVE)) return;
      throw new ForbiddenException('A safety officer reviews a hazard');
    }
  }

  private assertCanRead(user: AuthUser, issue: EscalatableIssue): void {
    if (isGlobalScope(user.role)) return;
    if (isRegionalScope(user.role)) {
      if (issue.regionId !== user.regionId) {
        throw new ForbiddenException('Issue is outside your region');
      }
      return;
    }
    if (isDistrictScope(user.role)) {
      if (issue.regionId !== user.regionId || issue.districtId !== user.districtId) {
        throw new ForbiddenException('Issue is outside your district');
      }
    }
  }

  /** Staff file the report. A safety officer for that place works the case. */
  private assertOfficer(user: AuthUser): void {
    if (isStaffRole(user.role)) {
      throw new ForbiddenException('Staff report the event. A safety officer for that district handles it');
    }
  }

  /** Where on the tier does this user sit? */
  private actorScope(user: AuthUser): IssueScope {
    return issueScopeForRole(user.role);
  }

  /** A user must have authority at-or-above the issue's current scope to escalate it up. */
  private assertCanEscalateFrom(user: AuthUser, fromScope: IssueScope): void {
    const userRank = this.rankOfScope(this.actorScope(user));
    const fromRank = this.rankOfScope(fromScope);
    if (userRank < fromRank) {
      throw new ForbiddenException(
        `Only ${ISSUE_SCOPE_LABEL[fromScope]} (or higher) can escalate this issue`,
      );
    }
  }

  /** Only users at-or-above the *origin* scope can refer down. */
  private assertCanReferFrom(user: AuthUser, fromScope: IssueScope): void {
    const userRank = this.rankOfScope(this.actorScope(user));
    const fromRank = this.rankOfScope(fromScope);
    if (userRank < fromRank) {
      throw new ForbiddenException(
        `Only ${ISSUE_SCOPE_LABEL[fromScope]} can refer this issue downward`,
      );
    }
  }

  /** Resolve / reopen need authority at the target scope. */
  private assertCanActAtScope(user: AuthUser, scope: IssueScope): void {
    const userRank = this.rankOfScope(this.actorScope(user));
    const need = this.rankOfScope(scope);
    if (userRank < need) {
      throw new ForbiddenException(
        `Only ${ISSUE_SCOPE_LABEL[scope]} (or higher) can perform this action`,
      );
    }
  }

  private assertScopeAscends(from: IssueScope, to: IssueScope): void {
    if (this.rankOfScope(to) <= this.rankOfScope(from)) {
      throw new BadRequestException('Escalation must move up the ladder');
    }
  }

  private assertScopeDescends(from: IssueScope, to: IssueScope): void {
    if (this.rankOfScope(to) >= this.rankOfScope(from)) {
      throw new BadRequestException('Refer-down must move down the ladder');
    }
  }
}
