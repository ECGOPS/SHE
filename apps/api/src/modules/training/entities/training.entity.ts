import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ScopedEntity } from '../../../common/entities/scoped.entity';
import { User } from '../../users/entities/user.entity';

@Entity('training_courses')
export class TrainingCourse extends ScopedEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar',length: 64 })
  code!: string;

  @Column({ type: 'varchar',length: 256 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar',length: 64 })
  category!: 'SAFETY' | 'CERTIFICATION' | 'COMPETENCY' | 'INDUCTION' | 'REFRESHER';

  @Column({ type: 'int' })
  durationHours!: number;

  @Column({ type: 'int', nullable: true })
  validForMonths?: number | null;

  // ── ISO 45001 §7.2 (Competence) alignment ───────────────────────────
  /** Body that accredits the course (e.g. NEBOSH, IOSH, Ghana Standards Authority). */
  @Column({ type: 'varchar', length: 128, nullable: true })
  accreditationBody?: string | null;

  /** Competency / framework reference this course satisfies. */
  @Column({ type: 'varchar', length: 256, nullable: true })
  competencyReference?: string | null;

  /** ISO 45001 clause this course supports (e.g. "7.2 Competence"). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  iso45001Clause?: string | null;

  /** Required role of the trainer (e.g. "ISO 45001 Lead Auditor"). */
  @Column({ type: 'varchar', length: 128, nullable: true })
  trainerQualification?: string | null;

  /** The job this course authorizes: climbing, live-line, driving, or a substation shift. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  authorizesDuty?: string | null;
}

@Entity('training_sessions')
export class TrainingSession extends ScopedEntity {
  @Index()
  @Column({ type: 'uuid' })
  courseId!: string;

  @ManyToOne(() => TrainingCourse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'courseId' })
  course?: TrainingCourse;

  @Column({ type: 'date' })
  heldOn!: Date;

  @Column({ type: 'varchar', length: 256 })
  locationName!: string;

  @Column({ type: 'varchar', length: 256 })
  trainerName!: string;
}

@Entity('training_attendance')
export class TrainingAttendance extends ScopedEntity {
  @Index()
  @Column({ type: 'uuid' })
  courseId!: string;

  @ManyToOne(() => TrainingCourse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'courseId' })
  course?: TrainingCourse;

  @Column({ type: 'uuid', nullable: true })
  sessionId?: string | null;

  @ManyToOne(() => TrainingSession, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sessionId' })
  session?: TrainingSession | null;

  @Index()
  @Column({ type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employeeId' })
  employee?: User;

  @Column({ type: 'date' })
  completedOn!: Date;

  @Column({ type: 'date', nullable: true })
  expiresOn?: Date | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  result?: 'PASS' | 'FAIL' | null;

  @Column({ type: 'varchar',length: 32, default: 'COMPLETED' })
  status!: 'COMPLETED' | 'PASSED' | 'FAILED' | 'EXPIRING' | 'EXPIRED';

  @Column({ type: 'varchar',length: 256, nullable: true })
  certificateKey?: string | null;
}
