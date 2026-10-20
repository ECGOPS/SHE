import 'reflect-metadata';
import * as argon2 from 'argon2';
import { ROLE_PERMISSIONS } from '@ecg-she/shared';
import { AppDataSource } from './data-source';
import { Region } from '../modules/organizations/entities/region.entity';
import { District } from '../modules/organizations/entities/district.entity';
import { User } from '../modules/users/entities/user.entity';
import { REGIONS, USERS } from './seed-data';

async function run(): Promise<void> {
  await AppDataSource.initialize();
  console.log('• Connected to database — seeding...');

  await AppDataSource.transaction(async (mgr) => {
    for (const r of REGIONS) {
      let region = await mgr.findOne(Region, { where: { code: r.code } });
      if (!region) {
        region = await mgr.save(mgr.create(Region, { code: r.code, name: r.name }));
        console.log(`  + region ${r.code} - ${r.name}`);
      }
      for (const d of r.districts) {
        const exists = await mgr.findOne(District, {
          where: { code: d.code, regionId: region.id },
        });
        if (!exists) {
          await mgr.save(
            mgr.create(District, { code: d.code, name: d.name, regionId: region.id }),
          );
          console.log(`    + district ${d.code} - ${d.name}`);
        }
      }
    }

    for (const u of USERS) {
      const permissions = ROLE_PERMISSIONS[u.role] as string[];
      const region = u.region
        ? await mgr.findOne(Region, { where: { code: u.region } })
        : null;
      const district = u.district
        ? await mgr.findOne(District, { where: { code: u.district, regionId: region?.id } })
        : null;
      const existing = await mgr.findOne(User, { where: { email: u.email } });
      if (existing) {
        existing.role = u.role;
        existing.permissions = permissions;
        existing.jobTitle = u.jobTitle ?? existing.jobTitle ?? null;
        await mgr.save(existing);
        console.log(`  · user ${u.email} refreshed (${u.role})`);
        continue;
      }
      await mgr.save(
        mgr.create(User, {
          email: u.email,
          fullName: u.fullName,
          passwordHash: await argon2.hash(u.password, { type: argon2.argon2id }),
          role: u.role,
          jobTitle: u.jobTitle ?? null,
          regionId: region?.id ?? null,
          districtId: district?.id ?? null,
          permissions,
        }),
      );
      console.log(`  + user ${u.email} (${u.role})`);
    }
  });

  await AppDataSource.destroy();
  console.log('• Seed complete.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
