import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { PermitStatus, PermitType } from '@ecg-she/shared';
import { ScopedEntity } from '../../../common/entities/scoped.entity';
import { User } from '../../users/entities/user.entity';

@Entity('permits_to_work')
@Index(['type', 'status'])
export class Permit extends ScopedEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar',length: 32 })
  referenceCode!: string;

  @Column({ type: 'varchar', length: 32 })
  type!: PermitType;

  @Column({ type: 'varchar', length: 32, default: PermitStatus.DRAFT })
  status!: PermitStatus;

  @Column({ type: 'varchar',length: 256 })
  workDescription!: string;

  @Column({ type: 'varchar',length: 256 })
  workLocation!: string;

  @Column()
  validFrom!: Date;

  @Column()
  validTo!: Date;

  @Column({ type: 'simple-json', nullable: true })
  isolationPoints!: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  hazardsIdentified!: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  controlMeasures!: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  ppeRequired!: string[] | null;

  @Column({ type: 'uuid', nullable: true })
  applicantId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'applicantId' })
  applicant?: User | null;

  @Column({ type: 'uuid', nullable: true })
  issuerId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'issuerId' })
  issuer?: User | null;

  @Column({ type: 'varchar',length: 512, nullable: true })
  applicantSignatureKey?: string | null;

  @Column({ type: 'varchar',length: 512, nullable: true })
  issuerSignatureKey?: string | null;

  @Column({ type: 'varchar',length: 512, nullable: true })
  closeOutSignatureKey?: string | null;

  @Column({ type: 'datetime',nullable: true })
  approvedAt?: Date | null;

  @Column({ type: 'datetime',nullable: true })
  closedAt?: Date | null;

  // ── IOGP Report 189 alignment ──────────────────────────────────────
  /** Isolation method (IOGP 189): ELECTRICAL_LOTO / MECHANICAL_BLIND / etc. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  isolationMethod?: string | null;

  /** Whether atmospheric / gas testing is required before work starts. */
  @Column({ type: 'boolean', default: false })
  gasTestRequired!: boolean;

  /** Recorded gas test result(s) — JSON of measurements. */
  @Column({ type: 'simple-json', nullable: true })
  gasTestResults?: Record<string, unknown> | null;

  /** Authorising manager (UUID) — required for high-risk permits. */
  @Column({ type: 'uuid', nullable: true })
  authorisingManagerId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'authorisingManagerId' })
  authorisingManager?: User | null;

  /** Holder / receiver of the permit on site (UUID). */
  @Column({ type: 'uuid', nullable: true })
  holderId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'holderId' })
  holder?: User | null;

  /** Standby person for confined space / hot work permits (UUID). */
  @Column({ type: 'uuid', nullable: true })
  standbyPersonId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'standbyPersonId' })
  standbyPerson?: User | null;

  /** Total work crew size. */
  @Column({ type: 'int', nullable: true })
  crewSize?: number | null;

  /** Energy isolation reference (LOTO tag / lockbox number). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  isolationReference?: string | null;

  @Column({ type: 'text', nullable: true })
  rejectionNotes?: string | null;

  /** The holder confirms the site is safe and isolations are in a known state. */
  @Column({ type: 'text', nullable: true })
  handbackNotes?: string | null;

  @Column({ type: 'text', nullable: true })
  suspensionNotes?: string | null;

  @Column({ type: 'datetime', nullable: true })
  holderAcceptedAt?: Date | null;
}
