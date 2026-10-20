import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Hazard } from './hazard.entity';

@Entity('hazard_attachments')
export class HazardAttachment extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  hazardId!: string;

  @ManyToOne(() => Hazard, (h) => h.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hazardId' })
  hazard?: Hazard;

  @Column({ type: 'varchar', length: 256 })
  fileName!: string;

  @Column({ type: 'varchar', length: 512 })
  storageKey!: string;

  @Column({ type: 'varchar', length: 64 })
  mimeType!: string;

  @Column({ type: 'int' })
  sizeBytes!: number;
}
