import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthUser } from '@ecg-she/shared';
import { CryptoService } from '../../common/crypto/crypto.service';
import { User } from '../users/entities/user.entity';
import { HealthRecord } from '../health/entities/health-record.entity';
import { Incident } from '../incidents/entities/incident.entity';
import { SessionService } from '../auth/session.service';
import { PRIVACY_NOTICE, PRIVACY_NOTICE_VERSION } from './privacy.notice';
import { ConsentDto, CorrectProfileDto } from './dto/privacy.dto';

@Injectable()
export class PrivacyService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(HealthRecord) private readonly health: Repository<HealthRecord>,
    @InjectRepository(Incident) private readonly incidents: Repository<Incident>,
    private readonly sessions: SessionService,
    private readonly crypto: CryptoService,
  ) {}

  notice() {
    return PRIVACY_NOTICE;
  }

  async profile(actor: AuthUser) {
    const user = await this.users.findOneByOrFail({ id: actor.id });
    return this.publicProfile(user);
  }

  async accept(actor: AuthUser, dto: ConsentDto) {
    if (!dto.accepted) throw new BadRequestException('The privacy notice must be accepted');
    const user = await this.users.findOneByOrFail({ id: actor.id });
    this.assertActive(user);
    await this.users.update(user.id, {
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
      privacyNoticeAcceptedAt: new Date(),
      optionalContactConsent: dto.optionalContact === true,
    });
    return this.profile(actor);
  }

  async withdrawOptionalContact(actor: AuthUser) {
    const user = await this.users.findOneByOrFail({ id: actor.id });
    this.assertActive(user);
    await this.users.update(user.id, { optionalContactConsent: false });
    return this.profile(actor);
  }

  async correct(actor: AuthUser, dto: CorrectProfileDto) {
    if (!dto.fullName && dto.phone === undefined) {
      throw new BadRequestException('Provide a name or a phone number to correct');
    }
    const user = await this.users.findOneByOrFail({ id: actor.id });
    this.assertActive(user);
    await this.users.update(user.id, {
      ...(dto.fullName ? { fullName: dto.fullName.trim() } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}),
    });
    return this.profile(actor);
  }

  async exportFor(actor: AuthUser) {
    const user = await this.users.findOneByOrFail({ id: actor.id });
    const health = await this.health.find({ where: { employeeId: actor.id } });
    const incidents = await this.incidents.find({ where: { reportedById: actor.id } });
    return {
      exportedAt: new Date().toISOString(),
      noticeVersion: PRIVACY_NOTICE_VERSION,
      account: this.publicProfile(user),
      health: health.map((row) => ({
        id: row.id,
        referenceCode: row.referenceCode,
        recordType: row.recordType,
        recordDate: row.recordDate,
        status: row.status,
        fitnessOutcome: row.fitnessOutcome,
        clinicalNote: this.clinicalNote(row.encryptedDataPayload),
      })),
      incidentsReported: incidents.map((row) => ({
        id: row.id,
        referenceCode: row.referenceCode,
        type: row.type,
        status: row.status,
        title: row.title,
        description: row.description,
        occurredAt: row.occurredAt,
        regionId: row.regionId,
        districtId: row.districtId,
      })),
    };
  }

  /**
   * Removes the account identifiers and the clinical note.
   * Safety investigations stay, because erasure must not hide an incident.
   */
  async erase(actor: AuthUser) {
    const user = await this.users.findOneByOrFail({ id: actor.id });
    if (user.erasedAt) throw new BadRequestException('This account is already erased');
    await this.health.update(
      { employeeId: user.id },
      {
        encryptedDataPayload: null,
        restrictions: null,
        clinician: null,
        exposureReading: null,
        batchNumber: null,
        fitnessOutcome: null,
        status: 'ANONYMISED',
      },
    );
    await this.users.update(user.id, {
      fullName: 'Former employee',
      email: `erased-${user.id}@invalid.local`,
      phone: null,
      department: null,
      jobTitle: null,
      employeeId: null,
      entraObjectId: null,
      entraGroups: null,
      managerEntraObjectId: null,
      passwordHash: null,
      mfaSecretEncrypted: null,
      mfaEnabled: false,
      refreshTokenHash: null,
      lastLoginIp: null,
      optionalContactConsent: false,
      active: false,
      erasedAt: new Date(),
    });
    await this.sessions.revokeAll(user.id);
    return { erased: true };
  }

  private publicProfile(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone ?? null,
      role: user.role,
      regionId: user.regionId,
      districtId: user.districtId,
      noticeVersion: PRIVACY_NOTICE_VERSION,
      acceptedVersion: user.privacyNoticeVersion ?? null,
      acceptedAt: user.privacyNoticeAcceptedAt ?? null,
      optionalContactConsent: user.optionalContactConsent === true,
      erasedAt: user.erasedAt ?? null,
    };
  }

  private assertActive(user: User) {
    if (user.erasedAt || !user.active) throw new BadRequestException('This account is closed');
  }

  private clinicalNote(payload?: string | null): string | null {
    if (!payload) return null;
    try {
      return this.crypto.decrypt(payload);
    } catch {
      return null;
    }
  }
}
