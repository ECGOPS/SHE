import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { ROLE_PERMISSIONS } from '@ecg-she/shared';
import { Region } from '../modules/organizations/entities/region.entity';
import { District } from '../modules/organizations/entities/district.entity';
import { User } from '../modules/users/entities/user.entity';
import { REGIONS, USERS } from './seed-data';

/**
 * Runs once on application start and:
 *   1. Ensures regions / districts exist
 *   2. Ensures the default test user accounts exist
 *
 * This makes the application runnable end-to-end with **zero manual setup**:
 *   `npm run dev` → SQLite file is created → schema is synced → users are
 *   seeded → operator can log in immediately.
 *
 * Production refuses this (`NODE_ENV=production` forces `BOOTSTRAP_AUTOSEED=false`).
 */
@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Region) private readonly regions: Repository<Region>,
    @InjectRepository(District) private readonly districts: Repository<District>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const enabled = this.config.get<string>('BOOTSTRAP_AUTOSEED', 'true') !== 'false';
    if (!enabled) {
      this.logger.log('Auto-seed disabled (BOOTSTRAP_AUTOSEED=false)');
      return;
    }

    try {
      await this.seedOrganizations();
      await this.seedUsers();
      this.logger.log('Bootstrap seed verified - application is ready for sign-in.');
    } catch (err) {
      this.logger.error(
        'Bootstrap seed failed - the API will still start but you may need to seed manually.',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async seedOrganizations(): Promise<void> {
    let regionsCreated = 0;
    let regionsUpdated = 0;
    let districtsCreated = 0;
    let districtsUpdated = 0;

    for (const r of REGIONS) {
      const desiredCentralUnit = !!r.centralUnit;
      let region = await this.regions.findOne({ where: { code: r.code } });
      if (!region) {
        region = await this.regions.save(
          this.regions.create({
            code: r.code,
            name: r.name,
            centralUnit: desiredCentralUnit,
          }),
        );
        regionsCreated += 1;
      } else if (region.name !== r.name || region.centralUnit !== desiredCentralUnit) {
        // Keep names + central-unit flag in sync with seed data
        // (e.g. when we rename "Accra East" → "Accra East Region",
        // or promote STA/STH/HOO to central-unit status).
        region.name = r.name;
        region.centralUnit = desiredCentralUnit;
        await this.regions.save(region);
        regionsUpdated += 1;
      }
      for (const d of r.districts) {
        const existing = await this.districts.findOne({
          where: { code: d.code, regionId: region.id },
        });
        if (!existing) {
          await this.districts.save(
            this.districts.create({
              code: d.code,
              name: d.name,
              regionId: region.id,
            }),
          );
          districtsCreated += 1;
        } else if (existing.name !== d.name) {
          existing.name = d.name;
          await this.districts.save(existing);
          districtsUpdated += 1;
        }
      }
    }

    if (regionsCreated || regionsUpdated || districtsCreated || districtsUpdated) {
      this.logger.log(
        `Org sync — regions: +${regionsCreated} new, ${regionsUpdated} renamed; ` +
          `districts: +${districtsCreated} new, ${districtsUpdated} renamed.`,
      );
    }

    // Detect (but do not delete) regions that exist in the DB but no longer
    // appear in the seed list — common after a code-rename (e.g. AS → ASE).
    // Operators can clean these up via the Admin UI or by wiping the DB.
    const seedCodes = new Set(REGIONS.map((r) => r.code));
    const all = await this.regions.find();
    const orphans = all.filter((r) => !seedCodes.has(r.code));
    if (orphans.length) {
      this.logger.warn(
        `Found ${orphans.length} legacy region(s) not in current seed: ` +
          orphans.map((o) => `${o.code} (${o.name})`).join(', ') +
          '. They are kept for backwards compatibility — wipe data/ecg-she.db for a clean slate.',
      );
    }
  }

  private async seedUsers(): Promise<void> {
    let created = 0;
    let updated = 0;

    for (const u of USERS) {
      const permissions = ROLE_PERMISSIONS[u.role] as string[];
      const region = u.region
        ? await this.regions.findOne({ where: { code: u.region } })
        : null;
      const district = u.district
        ? await this.districts.findOne({
            where: { code: u.district, regionId: region?.id },
          })
        : null;
      const existing = await this.users.findOne({ where: { email: u.email } });

      if (existing) {
        const samePermissions =
          (existing.permissions ?? []).length === permissions.length &&
          (existing.permissions ?? []).every((permission, index) => permission === permissions[index]);
        const sameJob =
          existing.role === u.role &&
          samePermissions &&
          (existing.jobTitle ?? null) === (u.jobTitle ?? null);
        if (!sameJob) {
          existing.role = u.role;
          existing.permissions = permissions;
          existing.jobTitle = u.jobTitle ?? existing.jobTitle ?? null;
          await this.users.save(existing);
          updated += 1;
        }
        continue;
      }

      await this.users.save(
        this.users.create({
          email: u.email,
          fullName: u.fullName,
          passwordHash: await argon2.hash(u.password, { type: argon2.argon2id }),
          role: u.role,
          jobTitle: u.jobTitle ?? null,
          regionId: region?.id ?? null,
          districtId: district?.id ?? null,
          permissions,
          optionalContactConsent: false,
        }),
      );
      created += 1;
    }

    if (created || updated) {
      this.logger.log(`User sync — ${created} created, ${updated} role/permission refresh.`);
    }
  }
}
