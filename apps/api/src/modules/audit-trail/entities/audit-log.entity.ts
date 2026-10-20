import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Append-only audit log. No update / delete columns by design.
 * `prevHash`+`hash` form a tamper-evident chain (similar to a blockchain).
 */
@Entity('audit_logs')
@Index(['userId', 'createdAt'])
@Index(['resource'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ type: 'varchar',length: 64 })
  action!: string;

  @Column({ type: 'varchar',length: 256 })
  resource!: string;

  @Column({ type: 'varchar',length: 16 })
  method!: string;

  /** SUCCESS, DENIED, or FAILURE. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  outcome?: string | null;

  @Column({ type: 'varchar',length: 64, nullable: true })
  ipAddress?: string | null;

  @Column({ type: 'varchar',length: 256, nullable: true })
  userAgent?: string | null;

  @Column({ type: 'simple-json', nullable: true })
  payload?: Record<string, unknown> | null;

  @Column({ type: 'varchar',length: 128, nullable: true })
  prevHash?: string | null;

  @Column({ type: 'varchar',length: 128 })
  hash!: string;
}
