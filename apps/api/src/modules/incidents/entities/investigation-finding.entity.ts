import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Incident } from './incident.entity';

@Entity('investigation_findings')
export class InvestigationFinding extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  incidentId!: string;

  @ManyToOne(() => Incident, (i) => i.findings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incidentId' })
  incident?: Incident;

  @Column({ type: 'varchar',length: 64 })
  category!: 'IMMEDIATE' | 'UNDERLYING' | 'ROOT' | 'CONTRIBUTING';

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'text', nullable: true })
  recommendation?: string | null;
}
