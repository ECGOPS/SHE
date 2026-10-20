import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Incident } from './incident.entity';

@Entity('incident_attachments')
export class IncidentAttachment extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  incidentId!: string;

  @ManyToOne(() => Incident, (i) => i.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incidentId' })
  incident?: Incident;

  @Column({ type: 'varchar',length: 32 })
  kind!: 'photo' | 'video' | 'document' | 'signature' | 'audio';

  @Column({ type: 'varchar',length: 256 })
  fileName!: string;

  @Column({ type: 'varchar',length: 512 })
  storageKey!: string;

  @Column({ type: 'varchar',length: 64 })
  mimeType!: string;

  @Column({ type: 'bigint' })
  sizeBytes!: number;

  @Column({ type: 'float', nullable: true })
  capturedLat?: number | null;

  @Column({ type: 'float', nullable: true })
  capturedLng?: number | null;
}
