import { Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Region } from '../../modules/organizations/entities/region.entity';
import { District } from '../../modules/organizations/entities/district.entity';

/**
 * Scoped entity adds the optional Region / District foreign keys used by the
 * hierarchical RBAC system. Inherits the universal audit + tenant columns
 * from `BaseEntity`. All column types are deliberately cross-database:
 * the same entity compiles against PostgreSQL, MSSQL / Azure SQL, MySQL,
 * Oracle and SQLite without changes.
 */
export abstract class ScopedEntity extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  regionId!: string;

  @ManyToOne(() => Region, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'regionId' })
  region?: Region;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  districtId!: string | null;

  @ManyToOne(() => District, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'districtId' })
  district?: District | null;
}
