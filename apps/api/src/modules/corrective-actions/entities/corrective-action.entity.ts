import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { CorrectiveActionStatus } from '@ecg-she/shared';
import { ScopedEntity } from '../../../common/entities/scoped.entity';
import { User } from '../../users/entities/user.entity';

@Entity('corrective_actions')
@Index(['status', 'dueDate'])
export class CorrectiveAction extends ScopedEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar',length: 32 })
  referenceCode!: string;

  @Column({ type: 'varchar',length: 256 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar',length: 64, nullable: true })
  sourceType?: string | null;

  @Column({ type: 'uuid', nullable: true })
  sourceId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  assigneeId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigneeId' })
  assignee?: User | null;

  @Column()
  dueDate!: Date;

  @Column({ type: 'varchar', length: 32, default: CorrectiveActionStatus.OPEN })
  status!: CorrectiveActionStatus;

  @Column({ type: 'varchar',length: 16, default: 'MEDIUM' })
  priority!: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @Column({ type: 'text', nullable: true })
  evidenceNotes?: string | null;

  @Column({ type: 'datetime',nullable: true })
  completedAt?: Date | null;

  @Column({ type: 'datetime',nullable: true })
  verifiedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  verifiedById?: string | null;

  @Column({ type: 'datetime',nullable: true })
  closedAt?: Date | null;

  @Column({ type: 'int', default: 0 })
  slaDays!: number;

  // ── ISO 9001 §10.2 / ISO 45001 §10.2 alignment ──────────────────────
  /** Root-cause analysis method used (5-Why, Fishbone, ICAM, …). */
  @Column({ type: 'varchar', length: 32, nullable: true })
  rootCauseMethod?: string | null;

  /** Free-text root-cause statement. */
  @Column({ type: 'text', nullable: true })
  rootCauseStatement?: string | null;

  /** Effectiveness review — date the verifier will re-check the action. */
  @Column({ type: 'date', nullable: true })
  effectivenessReviewDate?: Date | null;

  /** Outcome of the effectiveness review. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  effectivenessOutcome?: 'EFFECTIVE' | 'PARTIAL' | 'INEFFECTIVE' | null;

  /** What the checker found when the action was reviewed. */
  @Column({ type: 'text', nullable: true })
  effectivenessNotes?: string | null;

  /** Distinguishes correction (immediate fix) from corrective action (root-cause). */
  @Column({ type: 'varchar', length: 32, default: 'CORRECTIVE_ACTION' })
  actionType!: 'CORRECTION' | 'CORRECTIVE_ACTION' | 'PREVENTIVE_ACTION';
}
