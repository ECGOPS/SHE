import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Role } from '@ecg-she/shared';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Region } from '../../organizations/entities/region.entity';
import { District } from '../../organizations/entities/district.entity';

@Entity('users')
export class User extends BaseEntity {
  /**
   * Microsoft Entra ID object id (`oid` claim). Stable, unique identifier
   * for the user across Microsoft 365. Populated automatically on first SSO
   * login. Null only for legacy local accounts and the system seed accounts.
   */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  entraObjectId?: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar',length: 256 })
  email!: string;

  @Column({ type: 'varchar',length: 128 })
  fullName!: string;

  @Column({ type: 'varchar',length: 32, nullable: true })
  phone?: string | null;

  /** Set only for legacy local accounts; SSO users never carry a hash. */
  @Column({ type: 'varchar',select: false, nullable: true })
  passwordHash?: string | null;

  @Column({ type: 'varchar', length: 32 })
  role!: Role;

  /** Optional department / cost-centre synced from Entra ID. */
  @Column({ type: 'varchar',length: 128, nullable: true })
  department?: string | null;

  @Column({ type: 'varchar',length: 128, nullable: true })
  jobTitle?: string | null;

  @Column({ type: 'varchar',length: 128, nullable: true })
  employeeId?: string | null;

  @Column({ type: 'varchar',length: 64, nullable: true })
  managerEntraObjectId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  regionId!: string | null;

  @ManyToOne(() => Region, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'regionId' })
  region?: Region | null;

  @Column({ type: 'uuid', nullable: true })
  districtId!: string | null;

  @ManyToOne(() => District, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'districtId' })
  district?: District | null;

  @Column({ type: 'simple-json', nullable: true })
  permissions!: string[];

  /** Entra group object-ids the user currently belongs to (last sync). */
  @Column({ type: 'simple-json', nullable: true })
  entraGroups?: string[] | null;

  @Column({ type: 'boolean',default: false })
  mfaEnabled!: boolean;

  @Column({ type: 'varchar',select: false, nullable: true })
  mfaSecretEncrypted?: string | null;

  @Column({ type: 'boolean',default: true })
  active!: boolean;

  @Column({ type: 'datetime',nullable: true })
  lastLoginAt?: Date | null;

  @Column({ type: 'varchar',length: 64, nullable: true })
  lastLoginIp?: string | null;

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts!: number;

  @Column({ type: 'datetime',nullable: true })
  lockedUntil?: Date | null;

  @Column({ type: 'varchar',select: false, nullable: true })
  refreshTokenHash?: string | null;

  /** Last successful sync timestamp from Microsoft Graph. */
  @Column({ type: 'datetime',nullable: true })
  lastEntraSyncAt?: Date | null;

  /** Version of the privacy notice this person accepted. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  privacyNoticeVersion?: string | null;

  @Column({ type: 'datetime', nullable: true })
  privacyNoticeAcceptedAt?: Date | null;

  /** Optional mail beyond safety notices. Off until the person opts in. */
  @Column({ type: 'boolean', default: false })
  optionalContactConsent!: boolean;

  @Column({ type: 'datetime', nullable: true })
  erasedAt?: Date | null;
}
