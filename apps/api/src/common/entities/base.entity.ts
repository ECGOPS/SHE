import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

/**
 * Universal base for every domain entity.
 *
 * Provides:
 *   • UUID primary key (database-agnostic)
 *   • Multi-tenant column (`tenantId`) enabled by default for SaaS-style growth
 *   • Mandatory audit columns demanded by the enterprise standard:
 *       createdAt / createdBy / updatedAt / updatedBy / deletedAt / deletedBy
 *   • Optimistic-locking version column
 *
 * The audit user columns are populated automatically by
 * `AuditColumnsSubscriber` from the AsyncLocalStorage request context — no
 * service code has to remember to set them.
 *
 * Column types intentionally avoid any vendor-specific TypeORM aliases
 * (`timestamptz`, `jsonb`, `citext` …). Engine selection happens at
 * configuration time in `database.config.ts`.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar',length: 64, default: 'ecg' })
  tenantId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy?: string | null;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  deletedBy?: string | null;

  @VersionColumn({ default: 1 })
  version!: number;
}
