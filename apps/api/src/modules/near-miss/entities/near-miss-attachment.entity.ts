import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { NearMiss } from './near-miss.entity';

@Entity('near_miss_attachments')
export class NearMissAttachment extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  nearMissId!: string;

  @ManyToOne(() => NearMiss, (n) => n.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'nearMissId' })
  nearMiss?: NearMiss;

  @Column({ type: 'varchar', length: 256 })
  fileName!: string;

  @Column({ type: 'varchar', length: 512 })
  storageKey!: string;

  @Column({ type: 'varchar', length: 64 })
  mimeType!: string;

  @Column({ type: 'int' })
  sizeBytes!: number;
}
