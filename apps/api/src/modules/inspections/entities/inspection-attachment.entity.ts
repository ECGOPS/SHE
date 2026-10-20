import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Inspection } from './inspection.entity';

@Entity('inspection_attachments')
export class InspectionAttachment extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  inspectionId!: string;

  @ManyToOne(() => Inspection, (inspection) => inspection.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inspectionId' })
  inspection?: Inspection;

  @Column({ type: 'varchar', length: 256 })
  fileName!: string;

  @Column({ type: 'varchar', length: 512 })
  storageKey!: string;

  @Column({ type: 'varchar', length: 64 })
  mimeType!: string;

  @Column({ type: 'int' })
  sizeBytes!: number;
}
