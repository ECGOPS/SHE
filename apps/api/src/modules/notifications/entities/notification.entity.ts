import { Column, Entity, Index } from 'typeorm';
import { NotificationChannel } from '@ecg-she/shared';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('notifications')
@Index(['recipientId', 'read'])
export class Notification extends BaseEntity {
  @Column({ type: 'uuid' })
  recipientId!: string;

  @Column({ type: 'varchar', length: 32 })
  channel!: NotificationChannel;

  @Column({ type: 'varchar',length: 64, nullable: true })
  topic?: string | null;

  @Column({ type: 'varchar',length: 256 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'simple-json', nullable: true })
  payload?: Record<string, unknown> | null;

  @Column({ type: 'varchar',length: 16, default: 'PENDING' })
  status!: 'PENDING' | 'SENT' | 'FAILED' | 'READ';

  @Column({ type: 'boolean',default: false })
  read!: boolean;

  @Column({ type: 'datetime',nullable: true })
  sentAt?: Date | null;

  @Column({ type: 'varchar',length: 16, default: 'NORMAL' })
  priority!: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
}

@Entity('push_subscriptions')
@Index(['userId'])
export class PushSubscriptionRecord extends BaseEntity {
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar',length: 1024 })
  endpoint!: string;

  @Column({ type: 'varchar',length: 256 })
  p256dh!: string;

  @Column({ type: 'varchar',length: 256 })
  auth!: string;

  @Column({ type: 'varchar',length: 512, nullable: true })
  userAgent?: string | null;
}
