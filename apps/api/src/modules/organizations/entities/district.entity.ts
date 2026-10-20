import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Region } from './region.entity';

@Entity('districts')
@Unique(['regionId', 'code'])
export class District extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  regionId!: string;

  @ManyToOne(() => Region, (r) => r.districts, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'regionId' })
  region?: Region;

  @Column({ type: 'varchar',length: 32 })
  code!: string;

  @Column({ type: 'varchar',length: 128 })
  name!: string;

  @Column({ type: 'float', nullable: true })
  latitude?: number | null;

  @Column({ type: 'float', nullable: true })
  longitude?: number | null;

  @Column({ type: 'boolean',default: true })
  active!: boolean;
}
