import { Column, Entity, Index } from 'typeorm';
import { ScopedEntity } from '../../../common/entities/scoped.entity';

export interface RiskAssessmentControlRow {
  identifiedHazard: string;
  consequence: string | null;
  likelihood: string | null;
  riskScore: number | null;
  riskClass: string | null;
  /** NIOSH / ISO 45001 §8.1.2 hierarchy tier for the required control. */
  controlHierarchy: string | null;
  requiredControls: string;
  implemented: boolean;
  residualLikelihood: string | null;
  residualSeverity: string | null;
  residualRiskScore: number | null;
  residualRiskClass: string | null;
}

@Entity('risk_assessments')
export class RiskAssessment extends ScopedEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  referenceCode!: string;

  @Column({ type: 'varchar', length: 256 })
  locationWorkplace!: string;

  @Column({ type: 'varchar', length: 512 })
  activityBeingDone!: string;

  @Column({ type: 'date' })
  assessmentDate!: Date;

  @Column({ type: 'varchar', length: 512 })
  assessorNames!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  othersConsulted?: string | null;

  /** Tick-list hazard ids from RISK_ASSESSMENT_HAZARD_IDS. */
  @Column({ type: 'simple-json', nullable: true })
  selectedHazards!: string[] | null;

  @Column({ type: 'text', nullable: true })
  specificCircumstance?: string | null;

  /** Tick-list person-at-risk ids. */
  @Column({ type: 'simple-json', nullable: true })
  personsAtRisk!: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  controls!: RiskAssessmentControlRow[] | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  controlConclusion?: string | null;

  @Column({ type: 'varchar', length: 32, default: 'DRAFT' })
  status!: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

  @Column({ type: 'uuid', nullable: true })
  createdById!: string | null;

  @Column({ type: 'uuid', nullable: true })
  approvedById?: string | null;

  @Column({ type: 'datetime', nullable: true })
  approvedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionNotes?: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, nullable: true })
  offlineClientId?: string | null;
}
