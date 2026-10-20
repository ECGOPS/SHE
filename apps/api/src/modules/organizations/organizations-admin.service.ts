import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Region } from './entities/region.entity';
import { District } from './entities/district.entity';
import { REGIONS } from '../../database/seed-data';

export interface OrphanRegionReport {
  id: string;
  code: string;
  name: string;
  centralUnit: boolean;
  /** Number of districts attached to this region. */
  districts: number;
  /** Number of users assigned directly to this region. */
  users: number;
  /**
   * Number of scoped domain records (incidents, hazards, etc.) that reference
   * this region. Counted across every entity that has a `regionId` column.
   */
  scopedRecords: number;
  /** True when the region has zero dependents and can be hard-deleted. */
  safeToPrune: boolean;
  /** Per-table dependency breakdown — useful for the admin UI. */
  breakdown: Record<string, number>;
}

export interface PruneResult {
  pruned: { code: string; name: string; deletedDistricts: number }[];
  skipped: { code: string; name: string; reason: string }[];
}

/**
 * Admin operations for the organisational hierarchy.
 *
 * Today this only exposes "find/clean orphan regions" — i.e. regions that
 * exist in the database but no longer appear in the canonical seed list
 * (e.g. after a code rename like AS → ASE). It is intentionally cautious:
 *
 *   • It refuses to delete a region that has *any* dependent record, in
 *     *any* table, unless `force=true` is explicitly passed.
 *   • It walks every TypeORM entity that has a `regionId` column to count
 *     dependents — so adding a new module never silently breaks this.
 *
 * Designed to be invoked by a SYS_ADMIN through the organisations
 * controller. Not exposed to non-admin roles.
 */
@Injectable()
export class OrganizationsAdminService {
  private readonly logger = new Logger(OrganizationsAdminService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(Region) private readonly regions: Repository<Region>,
    @InjectRepository(District) private readonly districts: Repository<District>,
  ) {}

  /** Return every region whose code is not in the current seed list. */
  async listOrphans(): Promise<OrphanRegionReport[]> {
    const seedCodes = new Set(REGIONS.map((r) => r.code));
    const all = await this.regions.find();
    const orphans = all.filter((r) => !seedCodes.has(r.code));
    if (!orphans.length) return [];

    const reports: OrphanRegionReport[] = [];
    for (const region of orphans) {
      reports.push(await this.buildOrphanReport(region));
    }
    return reports;
  }

  /**
   * Delete the orphan regions identified by `codes`. By default a region
   * is only pruned when it has zero dependents (districts, users or any
   * scoped record). Pass `force=true` to delete dependent districts in
   * the same transaction; users / scoped records still block the delete
   * because losing those would corrupt audit history.
   */
  async pruneOrphans(codes: string[], force = false): Promise<PruneResult> {
    if (!Array.isArray(codes) || !codes.length) {
      throw new BadRequestException('At least one region code is required');
    }
    const seedCodes = new Set(REGIONS.map((r) => r.code));
    const targets = await this.regions.find({ where: { code: In(codes) } });
    if (!targets.length) throw new NotFoundException('No matching regions');

    const result: PruneResult = { pruned: [], skipped: [] };

    for (const region of targets) {
      if (seedCodes.has(region.code)) {
        result.skipped.push({
          code: region.code,
          name: region.name,
          reason: 'Region is part of the current seed and cannot be pruned',
        });
        continue;
      }
      const report = await this.buildOrphanReport(region);

      // Users + scoped records are always a hard block — deleting them would
      // invalidate audit-trail integrity (ISO 27001 / GDPR Art. 5(1)(f)).
      if (report.users > 0 || report.scopedRecords > 0) {
        result.skipped.push({
          code: region.code,
          name: region.name,
          reason:
            `Region has ${report.users} user(s) and ${report.scopedRecords} ` +
            `domain record(s) referencing it. Reassign or archive them first.`,
        });
        continue;
      }
      // Districts can be pruned in the same shot only when force=true.
      if (report.districts > 0 && !force) {
        result.skipped.push({
          code: region.code,
          name: region.name,
          reason:
            `Region has ${report.districts} district(s). Re-run with ` +
            `force=true to delete those alongside the region.`,
        });
        continue;
      }

      let deletedDistricts = 0;
      await this.ds.transaction(async (tx) => {
        const districtRepo = tx.getRepository(District);
        const regionRepo = tx.getRepository(Region);
        const dDel = await districtRepo.delete({ regionId: region.id });
        deletedDistricts = dDel.affected ?? 0;
        await regionRepo.delete({ id: region.id });
      });

      this.logger.warn(
        `Pruned orphan region ${region.code} (${region.name}) — ` +
          `also deleted ${deletedDistricts} district(s).`,
      );
      result.pruned.push({
        code: region.code,
        name: region.name,
        deletedDistricts,
      });
    }
    return result;
  }

  /* -------------------------------------------------------------------- */

  private async buildOrphanReport(region: Region): Promise<OrphanRegionReport> {
    const districts = await this.districts.count({ where: { regionId: region.id } });

    const breakdown: Record<string, number> = {};
    let users = 0;
    let scopedRecords = 0;

    for (const meta of this.ds.entityMetadatas) {
      // Region rows themselves obviously don't have a regionId column.
      if (meta.tableName === 'regions') continue;
      // Districts are counted separately above.
      if (meta.tableName === 'districts') continue;
      const hasRegionCol = meta.columns.some((c) => c.propertyName === 'regionId');
      if (!hasRegionCol) continue;
      // Use the typed repository → driver-agnostic, no SQL injection surface.
      const repo = this.ds.getRepository(meta.target);
      let count = 0;
      try {
        count = await repo.count({ where: { regionId: region.id } as never });
      } catch (err) {
        this.logger.debug(
          `count(${meta.tableName}) by region skipped: ${(err as Error).message}`,
        );
        count = 0;
      }
      if (count <= 0) continue;
      if (meta.tableName === 'users') {
        users += count;
      } else {
        scopedRecords += count;
      }
      breakdown[meta.tableName] = count;
    }

    if (districts > 0) breakdown['districts'] = districts;

    return {
      id: region.id,
      code: region.code,
      name: region.name,
      centralUnit: !!region.centralUnit,
      districts,
      users,
      scopedRecords,
      safeToPrune: districts === 0 && users === 0 && scopedRecords === 0,
      breakdown,
    };
  }
}
