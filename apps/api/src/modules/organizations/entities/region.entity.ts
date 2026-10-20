import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { District } from './district.entity';

@Entity('regions')
export class Region extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar',length: 32 })
  code!: string;

  @Column({ type: 'varchar',length: 128 })
  name!: string;

  @Column({ type: 'varchar',length: 256, nullable: true })
  headquartersAddress?: string | null;

  @Column({ type: 'float', nullable: true })
  latitude?: number | null;

  @Column({ type: 'float', nullable: true })
  longitude?: number | null;

  @Column({ type: 'boolean',default: true })
  active!: boolean;

  /**
   * True for the central / sub-transmission / head-office operating units
   * (Subtransmission Accra, Subtransmission Ashanti, Head Office Operations).
   * These own assets and people but sit outside the geographical region
   * structure. Used by the UI to group them separately from regular regions.
   */
  @Column({ type: 'boolean', default: false })
  centralUnit!: boolean;

  @OneToMany(() => District, (d) => d.region)
  districts?: District[];
}
