import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ScopedEntity } from '../../../common/entities/scoped.entity';
import { User } from '../../users/entities/user.entity';
import { Permit } from '../../ptw/entities/permit.entity';

export interface JsaStep {
  step: string;
  hazards: string[];
  controls: string[];
  likelihood?: string | null;
  severity?: string | null;
  riskScore?: number | null;
  riskClass?: string | null;
}

export interface JsaCrewMember {
  name: string;
  userId?: string | null;
  acknowledgedAt?: string | null;
}

@Entity('jsa_records')
export class JsaRecord extends ScopedEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar',length: 32 })
  referenceCode!: string;

  @Column({ type: 'varchar',length: 256 })
  workActivity!: string;

  @Column({ type: 'varchar',length: 256, nullable: true })
  jobLocation?: string | null;

  /** The shift this briefing is for. */
  @Column({ type: 'date', nullable: true })
  jobDate?: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  steps!: JsaStep[] | null;

  /** People who will do the work, and when each one acknowledged the briefing. */
  @Column({ type: 'simple-json', nullable: true })
  crew?: JsaCrewMember[] | null;

  @Column({ type: 'simple-json', nullable: true })
  ppeRequired!: string[] | null;

  @Column({ type: 'varchar',length: 32, default: 'DRAFT' })
  status!: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

  @Column({ type: 'uuid', nullable: true })
  createdById!: string | null;

  @Column({ type: 'uuid', nullable: true })
  approvedById?: string | null;

  @Column({ type: 'datetime',nullable: true })
  approvedAt?: Date | null;

  // ── OSHA JHA / ISO 45001 §6.1.2 alignment ───────────────────────────
  /** Supervisor responsible for the work (user UUID). */
  @Column({ type: 'uuid', nullable: true })
  supervisorId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'supervisorId' })
  supervisor?: User | null;

  /** True if the activity also requires a Permit-To-Work. */
  @Column({ type: 'boolean', default: false })
  permitRequired!: boolean;

  /** Reference to a related PTW record, if any. */
  @Column({ type: 'uuid', nullable: true })
  permitId?: string | null;

  @ManyToOne(() => Permit, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'permitId' })
  permit?: Permit | null;

  /** Crew size / number of workers. */
  @Column({ type: 'int', nullable: true })
  crewSize?: number | null;

  /** Tools and equipment used during the activity. */
  @Column({ type: 'simple-json', nullable: true })
  toolsAndEquipment?: string[] | null;

  /** Emergency procedures / response specific to this activity. */
  @Column({ type: 'text', nullable: true })
  emergencyProcedures?: string | null;

  @Column({ type: 'text', nullable: true })
  rejectionNotes?: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, nullable: true })
  offlineClientId?: string | null;
}
