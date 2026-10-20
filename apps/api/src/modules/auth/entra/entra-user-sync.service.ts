import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { GraphService } from './graph.service';
import { UsersService } from '../../users/users.service';
import { EntraService } from './entra.service';
import { loadEntraConfig } from './entra.config';
import { requestContext } from '../../../common/context/request-context';
import { SessionService } from '../session.service';

/**
 * Scheduled provisioning job that mirrors Entra ID into the local user table.
 *
 *   • Pulls every user via Microsoft Graph
 *   • Resolves group membership and manager
 *   • Upserts each user (create on first sight, refresh on every run)
 *   • Deactivates users no longer present in Entra ID
 *
 * Runs every hour by default; can be triggered manually via the
 * `/auth/entra/sync` admin endpoint.
 */
@Injectable()
export class EntraUserSyncService {
  private readonly logger = new Logger(EntraUserSyncService.name);

  constructor(
    private readonly graph: GraphService,
    private readonly users: UsersService,
    private readonly entra: EntraService,
    private readonly config: ConfigService,
    private readonly sessions: SessionService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async scheduledSync(): Promise<void> {
    if (!this.entra.isEnabled()) return;
    if (!this.config.get<boolean>('ENTRA_AUTO_SYNC', true)) return;
    await this.runOnce();
  }

  /**
   * Run a single end-to-end synchronisation cycle. Returns the number of
   * users provisioned, refreshed and deactivated.
   */
  async runOnce(): Promise<{ provisioned: number; refreshed: number; deactivated: number }> {
    if (!this.entra.isEnabled()) {
      this.logger.warn('Entra not configured — skipping sync');
      return { provisioned: 0, refreshed: 0, deactivated: 0 };
    }

    const cfg = loadEntraConfig(this.config);
    const start = Date.now();
    const graphUsers = await this.graph.listUsers();
    this.logger.log(`Pulled ${graphUsers.length} users from Microsoft Graph`);

    let provisioned = 0;
    let refreshed = 0;
    const seenObjectIds: string[] = [];

    // Provisioning runs in a synthetic request context so the audit
    // subscriber can attribute the writes to the system user.
    await requestContext.run(
      { userId: undefined, tenantId: 'ecg', correlationId: 'entra-sync' },
      async () => {
        for (const u of graphUsers) {
          if (!u.accountEnabled) continue;
          seenObjectIds.push(u.id);
          const groups = await this.graph.getMemberGroups(u.id).catch(() => [] as string[]);
          const managerEntraObjectId =
            (await this.graph.getManager(u.id).catch(() => null)) ?? undefined;

          const before = await this.users.findByEntraObjectId(u.id);
          await this.users.upsertFromEntra({
            entraObjectId: u.id,
            email: u.mail ?? u.userPrincipalName,
            fullName: u.displayName,
            groups,
            jobTitle: u.jobTitle,
            department: u.department,
            employeeId: u.employeeId,
            managerEntraObjectId,
            groupRoleMap: cfg.groupToRoleMap,
          });
          if (before) refreshed++;
          else provisioned++;
        }
      },
    );

    const deactivated = await this.users.deactivateMissing(seenObjectIds);
    await this.sessions.revokeDisabledUsers();

    this.logger.log(
      `Entra sync complete in ${Date.now() - start}ms — provisioned ${provisioned}, refreshed ${refreshed}, deactivated ${deactivated}`,
    );
    return { provisioned, refreshed, deactivated };
  }
}
