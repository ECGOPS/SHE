import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ScopedEntity } from '../../../common/entities/scoped.entity';
import { User } from '../../users/entities/user.entity';

@Entity('ppe_items')
export class PpeItem extends ScopedEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar',length: 64 })
  sku!: string;

  @Column({ type: 'varchar',length: 256 })
  name!: string;

  @Column({ type: 'varchar',length: 64 })
  category!: 'HEAD' | 'EYE' | 'EAR' | 'HAND' | 'FOOT' | 'BODY' | 'FALL_PROTECTION' | 'RESPIRATORY' | 'INSULATING';

  @Column({ type: 'int', default: 0 })
  stockOnHand!: number;

  @Column({ type: 'int', default: 0 })
  reorderLevel!: number;

  @Column({ type: 'int', nullable: true })
  shelfLifeMonths?: number | null;

  // ── EN ISO / ANSI standard alignment ────────────────────────────────
  /** Applicable EN standard (e.g. "EN 50365" for insulating helmets). */
  @Column({ type: 'varchar', length: 128, nullable: true })
  enStandard?: string | null;

  /** Applicable ANSI/ASTM standard (e.g. "ANSI Z89.1"). */
  @Column({ type: 'varchar', length: 128, nullable: true })
  ansiStandard?: string | null;

  /** Manufacturer name. */
  @Column({ type: 'varchar', length: 128, nullable: true })
  manufacturer?: string | null;

  /** Model number / part number. */
  @Column({ type: 'varchar', length: 128, nullable: true })
  modelNumber?: string | null;

  /** NFPA 70E arc-flash category (where applicable). */
  @Column({ type: 'varchar', length: 16, nullable: true })
  nfpaArcCategory?: string | null;

  /** EN 60903 class for insulating gloves. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  voltageClass?: string | null;

  /** Months between electrical tests or harness inspections. */
  @Column({ type: 'int', nullable: true })
  retestIntervalMonths?: number | null;
}

@Entity('ppe_issuance')
export class PpeIssuance extends ScopedEntity {
  @Index()
  @Column({ type: 'uuid' })
  ppeItemId!: string;

  @ManyToOne(() => PpeItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ppeItemId' })
  item?: PpeItem;

  @Index()
  @Column({ type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employeeId' })
  employee?: User;

  @Column({ type: 'date' })
  issuedOn!: Date;

  @Column({ type: 'date', nullable: true })
  expiresOn?: Date | null;

  @Column({ type: 'date', nullable: true })
  nextTestOn?: Date | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  size?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  serialNumber?: string | null;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  @Column({ type: 'varchar',length: 32, default: 'ISSUED' })
  status!: 'ISSUED' | 'RETURNED' | 'DAMAGED' | 'LOST' | 'EXPIRED';

  /** Manufacturer batch / lot identifier (traceability requirement). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  batchNumber?: string | null;

  /** Reason for issuance (e.g. NEW_HIRE, REPLACEMENT, ROUTINE_REFRESH). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  issueReason?: string | null;

  /** Free-text inspection result at time of issue. */
  @Column({ type: 'text', nullable: true })
  inspectionNotes?: string | null;
}
