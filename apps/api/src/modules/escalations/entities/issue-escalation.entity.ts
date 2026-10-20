import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { EscalationAction, EscalationEntityType, IssueScope } from '@ecg-she/shared';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Immutable audit trail of every escalation / resolution / referral that
 * happens to a SHE issue (Incident, Hazard, Near Miss, CAPA, …).
 *
 * One row per transition. The current state of an issue is the latest row
 * for that `(entityType, entityId)` pair, but the issue entity itself also
 * caches `currentScope` for fast filtering.
 *
 * We don't define a database-level FK to the issue tables on purpose —
 * this is a polymorphic table and SQLite/MSSQL/Postgres handle polymorphic
 * FKs differently. Referential integrity is enforced in the service layer.
 */
@Entity('issue_escalations')
@Index('IDX_iesc_entity', ['entityType', 'entityId'])
@Index('IDX_iesc_region', ['regionId'])
@Index('IDX_iesc_to_scope_created', ['toScope', 'createdAt'])
export class IssueEscalation extends BaseEntity {
  @Column({ type: 'varchar', length: 32 })
  entityType!: EscalationEntityType;

  /** The id of the issue (incident / hazard / near-miss / CAPA). */
  @Column({ type: 'uuid' })
  entityId!: string;

  /** Reference code of the issue at the moment of escalation, for audit. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  entityReferenceCode?: string | null;

  @Column({ type: 'varchar', length: 32 })
  action!: EscalationAction;

  @Column({ type: 'varchar', length: 32 })
  fromScope!: IssueScope;

  @Column({ type: 'varchar', length: 32 })
  toScope!: IssueScope;

  /** User who initiated the transition. */
  @Column({ type: 'uuid' })
  fromUserId!: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'fromUserId' })
  fromUser?: User | null;

  /** Optional explicit recipient — left null for "broadcast to officers at scope". */
  @Column({ type: 'uuid', nullable: true })
  toUserId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'toUserId' })
  toUser?: User | null;

  @Column({ type: 'text' })
  reason!: string;

  /** Snapshot of the issue's region/district at the time of the transition. */
  @Column({ type: 'uuid' })
  regionId!: string;

  @Column({ type: 'uuid', nullable: true })
  districtId?: string | null;
}
