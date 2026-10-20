import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { AuditRecord } from './audit-record.entity';

@Entity('audit_findings')
export class AuditFinding extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  auditId!: string;

  @ManyToOne(() => AuditRecord, (a) => a.findings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'auditId' })
  audit?: AuditRecord;

  @Column({ type: 'varchar',length: 32 })
  severity!: 'OBSERVATION' | 'MINOR_NC' | 'MAJOR_NC' | 'CRITICAL';

  @Column({ type: 'varchar',length: 128, nullable: true })
  clauseRef?: string | null;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'text', nullable: true })
  recommendation?: string | null;

  @Column({ type: 'varchar',length: 32, default: 'OPEN' })
  status!: 'OPEN' | 'CLOSED';

  @Column({ type: 'uuid', nullable: true })
  capaId?: string | null;

  /** What the auditee said about this finding at the closing meeting. */
  @Column({ type: 'text', nullable: true })
  auditeeResponse?: string | null;
}
