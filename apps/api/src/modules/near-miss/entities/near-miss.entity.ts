import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { IssueScope, NearMissCategory } from '@ecg-she/shared';
import { ScopedEntity } from '../../../common/entities/scoped.entity';
import { User } from '../../users/entities/user.entity';
import { NearMissAttachment } from './near-miss-attachment.entity';

@Entity('near_misses')
export class NearMiss extends ScopedEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar',length: 32 })
  referenceCode!: string;

  @Column({ type: 'varchar',length: 256 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 32 })
  category!: NearMissCategory;

  @Column({ type: 'boolean',default: false })
  anonymous!: boolean;

  @Column({ type: 'uuid', nullable: true })
  reportedById!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reportedById' })
  reportedBy?: User | null;

  @Column({ type: 'uuid', nullable: true })
  investigatorId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'investigatorId' })
  investigator?: User | null;

  @Column()
  occurredAt!: Date;

  @Column({ type: 'varchar',length: 256, nullable: true })
  locationName?: string | null;

  @Column({ type: 'float', nullable: true })
  latitude?: number | null;

  @Column({ type: 'float', nullable: true })
  longitude?: number | null;

  /**
   * OPEN is a legacy report. New reports start at REPORTED, then UNDER_REVIEW,
   * then CLOSED. CONVERTED means the event was filed as an incident instead.
   */
  @Column({ type: 'varchar',length: 32, default: 'OPEN' })
  status!: string;

  @Column({ type: 'uuid', nullable: true })
  convertedIncidentId?: string | null;

  @Column({ type: 'datetime', nullable: true })
  closedAt?: Date | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, nullable: true })
  offlineClientId?: string | null;

  @OneToMany(() => NearMissAttachment, (a) => a.nearMiss)
  attachments?: NearMissAttachment[];

  // ── International-standard alignment (ICAM / OSHA 301) ────────────────
  /** Worst credible outcome had the event progressed (HSE 'severity potential'). */
  @Column({ type: 'varchar', length: 32, nullable: true })
  severityPotential?: string | null;

  /** Immediate (proximate) cause — the act/condition that triggered the event. */
  @Column({ type: 'text', nullable: true })
  immediateCause?: string | null;

  /** Underlying / system cause identified during ICAM analysis. */
  @Column({ type: 'text', nullable: true })
  rootCause?: string | null;

  /** Free-text witness statement(s). */
  @Column({ type: 'text', nullable: true })
  witnessStatement?: string | null;

  /** OSHA 301 — body part most exposed had the event escalated. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  bodyPartAtRisk?: string | null;

  /** OSHA 301 — likely nature of injury had the event escalated. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  potentialInjuryNature?: string | null;

  // ── Issue-escalation ladder ───────────────────────────────────────────
  @Index('IDX_nearmiss_current_scope')
  @Column({ type: 'varchar', length: 32, default: IssueScope.DISTRICT })
  currentScope!: IssueScope;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  resolvedById?: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  resolvedAtScope?: IssueScope | null;

  @Column({ type: 'text', nullable: true })
  resolutionNotes?: string | null;
}
