import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { InspectionType } from '@ecg-she/shared';
import { ScopedEntity } from '../../../common/entities/scoped.entity';
import { User } from '../../users/entities/user.entity';
import { InspectionAttachment } from './inspection-attachment.entity';

export interface InspectionItem {
  question: string;
  answer: 'PASS' | 'FAIL' | 'NA';
  notes?: string;
  /** What was done on the spot so the fail is no longer a danger. */
  immediateAction?: string;
  capaId?: string;
  hazardId?: string;
}

@Entity('inspections')
export class Inspection extends ScopedEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar',length: 32 })
  referenceCode!: string;

  @Column({ type: 'varchar', length: 32 })
  type!: InspectionType;

  @Column({ type: 'varchar',length: 256 })
  assetOrLocation!: string;

  @Column({ type: 'simple-json', nullable: true })
  items!: InspectionItem[] | null;

  @Column({ type: 'float', default: 0 })
  scorePercent!: number;

  @Column({ type: 'datetime',nullable: true })
  inspectedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  inspectorId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'inspectorId' })
  inspector?: User | null;

  @Column({ type: 'varchar',length: 32, default: 'COMPLETED' })
  status!: string;

  @Column({ type: 'varchar',length: 64, nullable: true })
  offlineClientId?: string | null;

  // ── ISO 45001 §8.1 / NFPA 70E electrical alignment ───────────────────
  /** Weather conditions during inspection (utility lineman context). */
  @Column({ type: 'varchar', length: 32, nullable: true })
  weatherCondition?: string | null;

  /** Ambient temperature (°C) during inspection — relevant for hot-work / arc-flash. */
  @Column({ type: 'float', nullable: true })
  temperatureC?: number | null;

  /** NFPA 70E arc-flash boundary in metres (electrical inspections only). */
  @Column({ type: 'float', nullable: true })
  arcFlashBoundaryM?: number | null;

  /** NFPA 70E PPE category required at the inspected asset. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  nfpaPpeCategory?: string | null;

  /** Free-text observations / corrective actions raised. */
  @Column({ type: 'text', nullable: true })
  observations?: string | null;

  @OneToMany(() => InspectionAttachment, (attachment) => attachment.inspection)
  attachments?: InspectionAttachment[];
}
