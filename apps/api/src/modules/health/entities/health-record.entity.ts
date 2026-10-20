import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ScopedEntity } from '../../../common/entities/scoped.entity';
import { User } from '../../users/entities/user.entity';

@Entity('health_records')
export class HealthRecord extends ScopedEntity {
  @Column({ type: 'varchar', length: 32, nullable: true })
  referenceCode?: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  employeeId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employeeId' })
  employee?: User | null;

  @Column({ type: 'varchar', length: 64 })
  recordType!: 'MEDICAL_SURVEILLANCE' | 'EXPOSURE_MONITORING' | 'FITNESS_FOR_DUTY' | 'VACCINATION' | 'CAMPAIGN';

  @Column({ type: 'date' })
  recordDate!: Date;

  @Column({ type: 'date', nullable: true })
  nextReviewDate?: Date | null;

  @Column({ type: 'varchar', length: 32, default: 'CURRENT' })
  status!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  fitnessOutcome?: string | null;

  @Column({ type: 'text', nullable: true })
  restrictions?: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  duty?: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  surveillanceTest?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  exposureAgent?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  exposureReading?: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  locationName?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  vaccine?: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  dose?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  batchNumber?: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  campaignTitle?: string | null;

  @Column({ type: 'int', nullable: true })
  attendeeCount?: number | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  clinician?: string | null;

  /** Diagnosis and test detail. Returned only to the person who can record health. */
  @Column({ type: 'text', nullable: true })
  encryptedDataPayload?: string | null;
}
