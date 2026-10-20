import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { EnvironmentalEvent } from './environmental-event.entity';

@Entity('environmental_attachments')
export class EnvironmentalAttachment extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  eventId!: string;

  @ManyToOne(() => EnvironmentalEvent, (event) => event.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event?: EnvironmentalEvent;

  @Column({ type: 'varchar', length: 256 })
  fileName!: string;

  @Column({ type: 'varchar', length: 512 })
  storageKey!: string;

  @Column({ type: 'varchar', length: 64 })
  mimeType!: string;

  @Column({ type: 'int' })
  sizeBytes!: number;
}
