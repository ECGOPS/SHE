import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { EnvironmentalEventType } from '@ecg-she/shared';
import { ScopedEntity } from '../../../common/entities/scoped.entity';
import { User } from '../../users/entities/user.entity';
import { EnvironmentalAttachment } from './environmental-attachment.entity';

@Entity('environmental_events')
export class EnvironmentalEvent extends ScopedEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar',length: 32 })
  referenceCode!: string;

  @Column({ type: 'varchar', length: 32 })
  type!: EnvironmentalEventType;

  @Column({ type: 'varchar',length: 256 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  /** What was released: transformer oil, diesel, SF6, or another named substance. */
  @Column({ type: 'varchar', length: 128, nullable: true })
  substance?: string | null;

  @Column()
  occurredAt!: Date;

  @Column({ type: 'float', nullable: true })
  estimatedQuantity?: number | null;

  @Column({ type: 'varchar',length: 16, nullable: true })
  quantityUnit?: string | null;

  @Column({ type: 'varchar',length: 256, nullable: true })
  locationName?: string | null;

  @Column({ type: 'float', nullable: true })
  latitude?: number | null;

  @Column({ type: 'float', nullable: true })
  longitude?: number | null;

  @Column({ type: 'varchar',length: 32, default: 'OPEN' })
  status!: string;

  // ── ISO 14001 §6.1.2 alignment ───────────────────────────────────────
  /** Environmental aspect — what an activity interacts with. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  aspect?: string | null;

  /** Environmental impact — change resulting from an aspect. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  impact?: string | null;

  /**
   * Severity scale aligned to ISO 14001 — NEGLIGIBLE → CATASTROPHIC,
   * to allow joint reporting with safety severity.
   */
  @Column({ type: 'varchar', length: 32, nullable: true })
  severity?: string | null;

  /** Whether the event is reportable to a regulator (e.g. EPA Ghana). */
  @Column({ type: 'boolean', default: false })
  regulatoryReportable!: boolean;

  /** Date the regulator was notified, if applicable. */
  @Column({ type: 'datetime', nullable: true })
  agencyNotifiedAt?: Date | null;

  /** Reference / identifier of the regulator notification. */
  @Column({ type: 'varchar', length: 128, nullable: true })
  agencyNotificationRef?: string | null;

  /** Containment / clean-up actions taken. */
  @Column({ type: 'text', nullable: true })
  containmentActions?: string | null;

  @Column({ type: 'uuid', nullable: true })
  reportedById?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reportedById' })
  reportedBy?: User | null;

  @Column({ type: 'datetime', nullable: true })
  closedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  closureNotes?: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  wasteContractor?: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  disposalSite?: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  waybillNumber?: string | null;

  @OneToMany(() => EnvironmentalAttachment, (attachment) => attachment.event)
  attachments?: EnvironmentalAttachment[];
}
