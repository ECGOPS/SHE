import { randomUUID } from 'crypto';
import { mkdir, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { decodeUpload } from '../../common/validation/uploads';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { In, LessThan, Repository } from 'typeorm';
import { AuthUser, HEALTH_DUTY, PaginatedResult, Role, dutyForPermit, isDistrictScope, isGlobalScope } from '@ecg-she/shared';
import { TrainingAttendance, TrainingCourse, TrainingSession } from './entities/training.entity';
import { CreateCourseDto, RecordClassDto } from './dto/training.dto';
import { RbacScopeService } from '../auth/rbac-scope.service';
import { assertRecordAccess } from '../auth/access-control';
import { getCurrentTenantId } from '../../common/context/request-context';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { paginate, searchTerm } from '../../common/pagination';
import { User } from '../users/entities/user.entity';

const PASSING = ['PASSED', 'COMPLETED', 'EXPIRING', 'EXPIRED'];

@Injectable()
export class TrainingService {
  constructor(
    @InjectRepository(TrainingCourse) private readonly courses: Repository<TrainingCourse>,
    @InjectRepository(TrainingSession) private readonly sessions: Repository<TrainingSession>,
    @InjectRepository(TrainingAttendance) private readonly attendance: Repository<TrainingAttendance>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly scope: RbacScopeService,
  ) {}

  async createCourse(user: AuthUser, dto: CreateCourseDto): Promise<TrainingCourse> {
    const scoped = this.scope.enforceWriteScope(user, {
      regionId: dto.regionId ?? user.regionId ?? null,
      districtId: dto.districtId ?? user.districtId ?? null,
    });
    if (!scoped.regionId) throw new BadRequestException('regionId required');
    const code = dto.code.trim();
    const existing = await this.courses.findOne({ where: { code } });
    if (existing) throw new BadRequestException('That course code is already in use');
    return this.courses.save(this.courses.create({
      code,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      category: dto.category,
      durationHours: dto.durationHours,
      validForMonths: dto.validForMonths ?? null,
      regionId: scoped.regionId,
      districtId: scoped.districtId ?? null,
      accreditationBody: dto.accreditationBody?.trim() || null,
      competencyReference: dto.competencyReference?.trim() || null,
      iso45001Clause: dto.iso45001Clause ?? null,
      trainerQualification: dto.trainerQualification?.trim() || null,
      authorizesDuty: dto.authorizesDuty ?? null,
    }));
  }

  async listCourses(user: AuthUser, query: PaginationQueryDto): Promise<PaginatedResult<TrainingCourse>> {
    const qb = this.courses.createQueryBuilder('c').leftJoinAndSelect('c.region', 'region').leftJoinAndSelect('c.district', 'district').orderBy('c.title', 'ASC');
    this.applyCatalogueScope(qb, user);
    const term = searchTerm(query.search);
    if (term) qb.andWhere('(LOWER(c.title) LIKE LOWER(:s) OR LOWER(c.code) LIKE LOWER(:s))', { s: term });
    return paginate(qb, query);
  }

  async getCourse(user: AuthUser, id: string): Promise<Record<string, unknown>> {
    const course = await this.visibleCourse(user, id);
    const rows = await this.attendance
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.session', 'session')
      .leftJoin('a.employee', 'employee')
      .addSelect(['employee.id', 'employee.fullName'])
      .where('a.courseId = :id', { id })
      .orderBy('a.completedOn', 'DESC')
      .getMany();
    return { ...course, attendees: rows.map((row) => this.presentAttendance(row)) };
  }

  async recordClass(user: AuthUser, dto: RecordClassDto): Promise<Record<string, unknown>> {
    if (!dto.attendees.length) throw new BadRequestException('Add at least one person');
    const course = await this.visibleCourse(user, dto.courseId);
    const scoped = this.scope.enforceWriteScope(user, {
      regionId: dto.regionId ?? user.regionId ?? null,
      districtId: dto.districtId ?? user.districtId ?? null,
    });
    if (!scoped.regionId) throw new BadRequestException('regionId required');
    const seen = new Set<string>();
    for (const attendee of dto.attendees) {
      if (seen.has(attendee.employeeId)) throw new BadRequestException('A person is listed twice');
      seen.add(attendee.employeeId);
      await this.requireEmployee(user, attendee.employeeId);
    }
    const session = await this.sessions.save(this.sessions.create({
      courseId: course.id,
      heldOn: dto.heldOn,
      locationName: dto.locationName.trim(),
      trainerName: dto.trainerName.trim(),
      regionId: scoped.regionId,
      districtId: scoped.districtId ?? null,
    }));
    for (const attendee of dto.attendees) {
      const passed = attendee.result === 'PASS';
      const saved = await this.attendance.save(this.attendance.create({
        courseId: course.id,
        sessionId: session.id,
        employeeId: attendee.employeeId,
        completedOn: dto.heldOn,
        expiresOn: passed ? this.expiry(dto.heldOn, course.validForMonths) : null,
        result: attendee.result,
        status: passed ? 'PASSED' : 'FAILED',
        regionId: scoped.regionId,
        districtId: scoped.districtId ?? null,
      }));
      if (attendee.certificate) await this.saveCertificate(saved.id, attendee.certificate);
    }
    return this.getCourse(user, course.id);
  }

  async due(user: AuthUser, query: PaginationQueryDto): Promise<PaginatedResult<Record<string, unknown>>> {
    const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const qb = this.attendance
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.course', 'course')
      .leftJoinAndSelect('a.session', 'session')
      .leftJoin('a.employee', 'employee')
      .addSelect(['employee.id', 'employee.fullName'])
      .where('(a.result = :fail OR a.status = :failed OR a.expiresOn <= :soon)', { fail: 'FAIL', failed: 'FAILED', soon })
      .orderBy('a.expiresOn', 'ASC');
    this.scope.applyScopeFilter(qb, user, 'a');
    const page = await paginate(qb, query);
    return { ...page, items: page.items.map((row) => this.presentAttendance(row)) };
  }

  async competence(employeeId: string, duty: string): Promise<Record<string, unknown>> {
    if (!(HEALTH_DUTY as readonly string[]).includes(duty)) throw new BadRequestException('Unknown duty');
    const courses = await this.courses.find({ where: { authorizesDuty: duty } });
    if (!courses.length) return { required: false, duty, state: 'NONE' };
    const passes = await this.attendance.find({
      where: { employeeId, courseId: In(courses.map((course) => course.id)), result: In(['PASS']) },
      relations: { course: true },
      order: { completedOn: 'DESC' },
    });
    const legacy = passes.length
      ? []
      : await this.attendance.find({
          where: { employeeId, courseId: In(courses.map((course) => course.id)), status: In(['COMPLETED', 'PASSED', 'EXPIRING']) },
          relations: { course: true },
          order: { completedOn: 'DESC' },
        });
    const latest = passes[0] ?? legacy[0];
    if (!latest) return { required: true, duty, state: 'NONE' };
    return {
      required: true,
      duty,
      state: this.stateOf(latest),
      courseTitle: latest.course?.title,
      expiresOn: latest.expiresOn ? String(latest.expiresOn).slice(0, 10) : null,
    };
  }

  async assertForIssue(employeeId: string, permitType: string): Promise<void> {
    const duty = dutyForPermit(permitType);
    if (!duty) return;
    const result = await this.competence(employeeId, duty);
    if (!result.required) return;
    if (result.state === 'CURRENT' || result.state === 'EXPIRING') return;
    const job = duty.replaceAll('_', ' ').toLowerCase();
    if (result.state === 'EXPIRED') {
      throw new BadRequestException(`The holder's ${job} authorization expired on ${result.expiresOn}`);
    }
    throw new BadRequestException(`The holder has no current ${job} authorization`);
  }

  async certificateFile(user: AuthUser, attendanceId: string): Promise<{ absolutePath: string; mimeType: string; fileName: string }> {
    const row = await this.attendance.findOne({ where: { id: attendanceId } });
    if (!row?.certificateKey) throw new NotFoundException('Certificate not found');
    assertRecordAccess(user, row, row.employeeId, getCurrentTenantId());
    await this.visibleCourse(user, row.courseId);
    const absolutePath = join(process.cwd(), 'data', row.certificateKey);
    try {
      await stat(absolutePath);
    } catch {
      throw new NotFoundException('Certificate file not found');
    }
    const extension = row.certificateKey.split('.').pop()?.toLowerCase();
    const mimeType = extension === 'pdf' ? 'application/pdf' : `image/${extension === 'jpg' ? 'jpeg' : extension || 'jpeg'}`;
    return { absolutePath, mimeType, fileName: row.certificateKey.split('/').pop() ?? 'certificate' };
  }

  people(user: AuthUser): Promise<Array<{ id: string; fullName: string; role: Role }>> {
    const qb = this.users
      .createQueryBuilder('u')
      .select(['u.id', 'u.fullName', 'u.role'])
      .where('u.active = :active', { active: true })
      .orderBy('u.fullName', 'ASC');
    if (!isGlobalScope(user.role)) qb.andWhere('u.regionId = :regionId', { regionId: user.regionId });
    if (isDistrictScope(user.role)) {
      qb.andWhere('(u.districtId = :districtId OR u.districtId IS NULL)', { districtId: user.districtId });
    }
    return qb.getMany();
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async refreshAttendanceStatus(): Promise<void> {
    const now = new Date();
    const soon = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await this.attendance.update(
      { expiresOn: LessThan(now), status: In(['PASSED', 'COMPLETED', 'EXPIRING']) },
      { status: 'EXPIRED' },
    );
    await this.attendance
      .createQueryBuilder()
      .update(TrainingAttendance)
      .set({ status: 'EXPIRING' })
      .where('status IN (:...open)', { open: ['PASSED', 'COMPLETED'] })
      .andWhere('expiresOn BETWEEN :now AND :soon', { now, soon })
      .execute();
  }

  private async visibleCourse(user: AuthUser, id: string): Promise<TrainingCourse> {
    const qb = this.courses.createQueryBuilder('c').where('c.id = :id', { id });
    this.applyCatalogueScope(qb, user);
    const course = await qb.getOne();
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  private applyCatalogueScope(qb: { andWhere: (sql: string, params?: object) => unknown }, user: AuthUser): void {
    if (isGlobalScope(user.role)) return;
    qb.andWhere('c.regionId = :regionId', { regionId: user.regionId });
    if (isDistrictScope(user.role)) {
      qb.andWhere('(c.districtId IS NULL OR c.districtId = :districtId)', { districtId: user.districtId });
    }
  }

  private async requireEmployee(user: AuthUser, id: string): Promise<void> {
    const person = await this.users.findOne({ where: { id } });
    if (!person) throw new BadRequestException('Choose a person from the list');
    if (!isGlobalScope(user.role) && person.regionId && person.regionId !== user.regionId) {
      throw new BadRequestException('That person is outside your region');
    }
  }

  private expiry(heldOn: string, months?: number | null): string | null {
    if (!months) return null;
    const date = new Date(heldOn);
    date.setMonth(date.getMonth() + months);
    return date.toISOString().slice(0, 10);
  }

  private stateOf(row: TrainingAttendance): 'CURRENT' | 'EXPIRING' | 'EXPIRED' | 'FAILED' {
    if (row.result === 'FAIL' || row.status === 'FAILED') return 'FAILED';
    const due = row.expiresOn ? String(row.expiresOn).slice(0, 10) : '';
    const today = new Date().toISOString().slice(0, 10);
    if (due && due < today) return 'EXPIRED';
    const soon = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
    if (due && due <= soon) return 'EXPIRING';
    return 'CURRENT';
  }

  private presentAttendance(row: TrainingAttendance): Record<string, unknown> {
    return {
      id: row.id,
      result: row.result ?? (PASSING.includes(row.status) ? 'PASS' : row.status),
      status: row.status,
      state: this.stateOf(row),
      completedOn: row.completedOn ? String(row.completedOn).slice(0, 10) : null,
      expiresOn: row.expiresOn ? String(row.expiresOn).slice(0, 10) : null,
      hasCertificate: !!row.certificateKey,
      employee: row.employee ? { id: row.employee.id, fullName: row.employee.fullName } : { id: row.employeeId },
      course: row.course
        ? { id: row.course.id, code: row.course.code, title: row.course.title, authorizesDuty: row.course.authorizesDuty ?? null }
        : { id: row.courseId },
      session: row.session
        ? { id: row.session.id, heldOn: String(row.session.heldOn).slice(0, 10), locationName: row.session.locationName, trainerName: row.session.trainerName }
        : null,
    };
  }

  private async saveCertificate(attendanceId: string, file: { fileName: string; mimeType: string; dataUrl: string }): Promise<void> {
    const { buffer, mime } = decodeUpload(file.dataUrl, file.mimeType, 'document');
    const uploadDir = join(process.cwd(), 'data', 'uploads', 'training', attendanceId);
    await mkdir(uploadDir, { recursive: true });
    const extension = mime === 'application/pdf' ? 'pdf' : (mime.split('/')[1] || 'img').replace(/[^a-z0-9]/gi, '');
    const storedName = `${randomUUID()}.${extension}`;
    const relativeKey = join('uploads', 'training', attendanceId, storedName).replace(/\\/g, '/');
    await writeFile(join(uploadDir, storedName), buffer);
    await this.attendance.update(attendanceId, { certificateKey: relativeKey });
  }
}
