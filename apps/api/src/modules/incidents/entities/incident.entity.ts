import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import {
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  IssueScope,
} from '@ecg-she/shared';
import { ScopedEntity } from '../../../common/entities/scoped.entity';
import { User } from '../../users/entities/user.entity';
import { IncidentAttachment } from './incident-attachment.entity';
import { Witness } from './witness.entity';
import { InvestigationFinding } from './investigation-finding.entity';

@Entity('incidents')
@Index(['status', 'occurredAt'])
@Index(['type', 'severity'])
export class Incident extends ScopedEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar',length: 32 })
  referenceCode!: string;

  @Column({ type: 'varchar', length: 32 })
  type!: IncidentType;

  @Column({ type: 'varchar', length: 32 })
  severity!: IncidentSeverity;

  @Column({ type: 'varchar', length: 32, default: IncidentStatus.DRAFT })
  status!: IncidentStatus;

  @Column({ type: 'varchar',length: 256 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column()
  occurredAt!: Date;

  @Column({ type: 'varchar',length: 256, nullable: true })
  locationName?: string | null;

  @Column({ type: 'float', nullable: true })
  latitude?: number | null;

  @Column({ type: 'float', nullable: true })
  longitude?: number | null;

  @Column({ type: 'int', default: 0 })
  affectedPersons!: number;

  @Column({ type: 'int', default: 0 })
  injuredPersons!: number;

  @Column({ type: 'int', default: 0 })
  fatalities!: number;

  /** Scene actions from the reporting workflow — recorded after they were done. */
  @Column({ type: 'boolean', default: false })
  areaSecured!: boolean;

  @Column({ type: 'varchar', length: 24, nullable: true })
  firstAidOutcome?: 'GIVEN' | 'NOT_REQUIRED' | null;

  @Column({ type: 'text', nullable: true })
  firstAidNotes?: string | null;

  @Column({ type: 'boolean', default: false })
  supervisorInformed!: boolean;

  @Column({ type: 'varchar', length: 256, nullable: true })
  supervisorName?: string | null;

  @Column({ type: 'boolean', default: false })
  emergencyServicesContacted!: boolean;

  @Column({ type: 'varchar', length: 256, nullable: true })
  emergencyServicesDetails?: string | null;

  @Column({ type: 'datetime', nullable: true })
  managementReportSubmittedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  managementReportSubmittedById?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'managementReportSubmittedById' })
  managementReportSubmittedBy?: User | null;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  estimatedCost!: number;

  @Column({ type: 'simple-json', nullable: true })
  rootCauseAnalysis!: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  reportedById!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reportedById' })
  reportedBy?: User | null;

  @Column({ type: 'uuid', nullable: true })
  investigatorId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'investigatorId' })
  investigator?: User | null;

  @Column({ type: 'datetime',nullable: true })
  closedAt?: Date | null;

  /**
   * Tier currently responsible for handling this issue. Defaults to the tier
   * the reporter sits at (DISTRICT for a district reporter, REGIONAL for a
   * regional reporter). Mutated by the EscalationsService.
   */
  @Index('IDX_incident_current_scope')
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

  @Column({ type: 'varchar',length: 64, nullable: true })
  offlineClientId?: string | null;

  /** Set when this incident was promoted from a near miss, so the event is counted once. */
  @Column({ type: 'uuid', nullable: true })
  sourceNearMissId?: string | null;

  @OneToMany(() => IncidentAttachment, (a) => a.incident, { cascade: true })
  attachments?: IncidentAttachment[];

  @OneToMany(() => Witness, (w) => w.incident, { cascade: true })
  witnesses?: Witness[];

  @OneToMany(() => InvestigationFinding, (f) => f.incident, { cascade: true })
  findings?: InvestigationFinding[];
}
