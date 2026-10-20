import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Incident } from './incident.entity';

@Entity('incident_witnesses')
export class Witness extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  incidentId!: string;

  @ManyToOne(() => Incident, (i) => i.witnesses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incidentId' })
  incident?: Incident;

  @Column({ type: 'varchar',length: 128 })
  fullName!: string;

  @Column({ type: 'varchar',length: 64, nullable: true })
  contact?: string | null;

  @Column({ type: 'varchar',length: 128, nullable: true })
  role?: string | null;

  @Column({ type: 'text' })
  statement!: string;

  @Column({ type: 'varchar',length: 512, nullable: true })
  signatureKey?: string | null;
}
