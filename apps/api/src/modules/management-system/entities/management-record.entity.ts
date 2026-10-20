import { Column, Entity, Index } from 'typeorm';
import { ScopedEntity } from '../../../common/entities/scoped.entity';

@Entity('management_records')
export class ManagementRecord extends ScopedEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  referenceCode!: string;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  kind!: string;

  @Column({ type: 'varchar', length: 16 })
  standard!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  clauseRef?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  ownerName?: string | null;

  @Column({ type: 'varchar', length: 16, default: 'OPEN' })
  status!: string;

  @Column({ type: 'datetime', nullable: true })
  dueOn?: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  complianceResult?: string | null;

  @Column({ type: 'boolean', default: false })
  significant!: boolean;
}
