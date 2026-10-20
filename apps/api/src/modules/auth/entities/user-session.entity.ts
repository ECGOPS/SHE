import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('user_sessions')
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  /** SHA-256 of the cookie secret. The secret itself is never stored. */
  @Column({ type: 'varchar', length: 64 })
  secretHash!: string;

  @Column({ type: 'datetime' })
  authenticatedAt!: Date;

  @Column({ type: 'datetime' })
  lastSeenAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  reauthenticatedAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  revokedAt?: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip?: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  userAgent?: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
