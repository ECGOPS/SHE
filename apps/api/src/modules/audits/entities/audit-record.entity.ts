import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AuditStatus, AuditType } from '@ecg-she/shared';
import { ScopedEntity } from '../../../common/entities/scoped.entity';
import { AuditFinding } from './audit-finding.entity';
import { User } from '../../users/entities/user.entity';

export interface AuditCheckItem {
  clause: string;
  result?: 'CONFORM' | 'NONCONFORM' | 'NA';
  evidence?: string;
  severity?: 'OBSERVATION' | 'MINOR_NC' | 'MAJOR_NC' | 'CRITICAL';
  findingId?: string;
}

@Entity('audit_records')
export class AuditRecord extends ScopedEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar',length: 32 })
  referenceCode!: string;

  @Column({ type: 'varchar', length: 32 })
  type!: AuditType;

  @Column({ type: 'varchar',length: 256 })
  scope!: string;

  @Column({ type: 'datetime',nullable: true })
  scheduledDate?: Date | null;

  @Column({ type: 'datetime',nullable: true })
  startedAt?: Date | null;

  @Column({ type: 'datetime',nullable: true })
  finishedAt?: Date | null;

  @Column({ type: 'datetime',nullable: true })
  closedAt?: Date | null;

  @Column({ type: 'varchar', length: 32, default: AuditStatus.PLANNED })
  status!: AuditStatus;

  @Column({ type: 'uuid', nullable: true })
  leadAuditorId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'leadAuditorId' })
  leadAuditor?: User | null;

  /** Name of the lead, including an external auditor who is not a user. */
  @Column({ type: 'varchar', length: 256, nullable: true })
  leadAuditorName?: string | null;

  @Column({ type: 'simple-json', nullable: true })
  checklist!: AuditCheckItem[] | null;

  @OneToMany(() => AuditFinding, (f) => f.audit, { cascade: true })
  findings?: AuditFinding[];

  // ── ISO 19011 alignment ──────────────────────────────────────────────
  /**
   * Audit criteria reference (ISO 19011 §3.7) — e.g. ISO 45001 clauses,
   * regulatory framework, internal HSE-MS sections.
   */
  @Column({ type: 'text', nullable: true })
  criteria?: string | null;

  /** Audit objectives (ISO 19011 §5.4.2). */
  @Column({ type: 'text', nullable: true })
  objectives?: string | null;

  /** Comma-separated audit team members (ISO 19011 §5.5.4). */
  @Column({ type: 'text', nullable: true })
  auditTeam?: string | null;

  /** Audited entity / function / process. */
  @Column({ type: 'varchar', length: 256, nullable: true })
  auditee?: string | null;

  /**
   * Methodology — ISO 19011 §6.4.7 audit methods
   * (e.g. INTERVIEW / DOCUMENT_REVIEW / FIELD_VERIFICATION).
   */
  @Column({ type: 'text', nullable: true })
  methods?: string | null;
}
