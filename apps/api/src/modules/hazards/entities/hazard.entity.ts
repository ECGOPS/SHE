import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { HazardCategory, IssueScope } from '@ecg-she/shared';
import { ScopedEntity } from '../../../common/entities/scoped.entity';
import { User } from '../../users/entities/user.entity';
import { HazardAttachment } from './hazard-attachment.entity';

@Entity('hazards')
@Index(['category', 'riskClass'])
export class Hazard extends ScopedEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar',length: 32 })
  referenceCode!: string;

  @Column({ type: 'varchar',length: 256 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 32 })
  category!: HazardCategory;

  /** Confirmed by a safety officer. Empty until the condition is assessed. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  likelihood?: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  severity?: string | null;

  @Column({ type: 'int', nullable: true })
  riskScore?: number | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  riskClass?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' | null;

  /** People can be hurt by this condition right now. */
  @Column({ type: 'boolean', default: false })
  peopleExposed!: boolean;

  /** What the reporter did immediately: isolate, barricade, stop the job. */
  @Column({ type: 'text', nullable: true })
  immediateAction?: string | null;

  @Column({ type: 'text', nullable: true })
  controlMeasures?: string | null;

  @Column({ type: 'varchar',length: 256, nullable: true })
  locationName?: string | null;

  @Column({ type: 'float', nullable: true })
  latitude?: number | null;

  @Column({ type: 'float', nullable: true })
  longitude?: number | null;

  @Column({ type: 'varchar',length: 32, default: 'OPEN' })
  status!: 'OPEN' | 'MITIGATED' | 'CLOSED';

  @Column({ type: 'uuid', nullable: true })
  reportedById!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reportedById' })
  reportedBy?: User | null;

  @OneToMany(() => HazardAttachment, (a) => a.hazard)
  attachments?: HazardAttachment[];

  @Column({ type: 'varchar',length: 64, nullable: true })
  offlineClientId?: string | null;

  // ── ISO 31000 / ISO 45001 §6.1.2 alignment ────────────────────────────
  /** Existing controls already in place, prior to additional treatment. */
  @Column({ type: 'text', nullable: true })
  existingControls?: string | null;

  /**
   * NIOSH / ISO 45001 §8.1.2 hierarchy of controls — the most-effective
   * mitigation chosen (ELIMINATION, SUBSTITUTION, ENGINEERING,
   * ADMINISTRATIVE, PPE).
   */
  @Column({ type: 'varchar', length: 32, nullable: true })
  controlHierarchy?: string | null;

  /** Residual likelihood after controls applied (5-level scale). */
  @Column({ type: 'varchar', length: 32, nullable: true })
  residualLikelihood?: string | null;

  /** Residual severity after controls applied (5-level scale). */
  @Column({ type: 'varchar', length: 32, nullable: true })
  residualSeverity?: string | null;

  /** Residual risk score (likelihood × severity) after controls. */
  @Column({ type: 'int', nullable: true })
  residualRiskScore?: number | null;

  /** Target completion date for the chosen mitigation. */
  @Column({ type: 'date', nullable: true })
  targetCompletionDate?: Date | null;

  /** Owner of the mitigation work (user UUID). */
  @Column({ type: 'uuid', nullable: true })
  mitigationOwnerId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'mitigationOwnerId' })
  mitigationOwner?: User | null;

  // ── Issue-escalation ladder ───────────────────────────────────────────
  @Index('IDX_hazard_current_scope')
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
