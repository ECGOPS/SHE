import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuthUser,
  CorrectiveActionStatus,
  DashboardTrendPoint,
  IncidentStatus,
  IncidentType,
  KpiSnapshot,
} from '@ecg-she/shared';
import { Incident } from '../incidents/entities/incident.entity';
import { Hazard } from '../hazards/entities/hazard.entity';
import { NearMiss } from '../near-miss/entities/near-miss.entity';
import { CorrectiveAction } from '../corrective-actions/entities/corrective-action.entity';
import { EnvironmentalEvent } from '../environmental/entities/environmental-event.entity';
import { RbacScopeService } from '../auth/rbac-scope.service';

const TOTAL_HOURS_WORKED_DEFAULT = 200_000; // typical denominator for LTIFR/TRIR (per 200k hours)

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Incident) private readonly incidents: Repository<Incident>,
    @InjectRepository(Hazard) private readonly hazards: Repository<Hazard>,
    @InjectRepository(NearMiss) private readonly nearMisses: Repository<NearMiss>,
    @InjectRepository(CorrectiveAction) private readonly capa: Repository<CorrectiveAction>,
    @InjectRepository(EnvironmentalEvent) private readonly env: Repository<EnvironmentalEvent>,
    private readonly scope: RbacScopeService,
  ) {}

  async kpis(user: AuthUser, hoursWorked = TOTAL_HOURS_WORKED_DEFAULT): Promise<KpiSnapshot> {
    const incQ = this.incidents.createQueryBuilder('i');
    this.scope.applyScopeFilter(incQ, user, 'i', 'reportedById');

    const [totalIncidents, fatalities, ltis, recordable, openIncidents] = await Promise.all([
      incQ.clone().getCount(),
      incQ
        .clone()
        .select('COALESCE(SUM(i.fatalities),0)', 'sum')
        .getRawOne<{ sum: string }>()
        .then((r) => Number(r?.sum ?? 0)),
      incQ
        .clone()
        .andWhere('i.injuredPersons > 0')
        .andWhere('i.type IN (:...types)', {
          types: [IncidentType.INJURY, IncidentType.ELECTRICAL_SHOCK, IncidentType.VEHICLE_ACCIDENT],
        })
        .getCount(),
      incQ.clone().getCount(),
      incQ
        .clone()
        .andWhere('i.status NOT IN (:...closed)', {
          closed: [IncidentStatus.CLOSED, IncidentStatus.REJECTED],
        })
        .getCount(),
    ]);

    const hazQ = this.hazards.createQueryBuilder('h');
    this.scope.applyScopeFilter(hazQ, user, 'h', 'reportedById');
    const hazardReports = await hazQ.getCount();

    const nmQ = this.nearMisses.createQueryBuilder('n').andWhere('n.status <> :converted', { converted: 'CONVERTED' });
    this.scope.applyScopeFilter(nmQ, user, 'n', 'reportedById');
    const nearMisses = await nmQ.getCount();

    const capaQ = this.capa.createQueryBuilder('c').andWhere('c.status NOT IN (:...closed)', {
      closed: [CorrectiveActionStatus.CLOSED, CorrectiveActionStatus.REJECTED],
    });
    this.scope.applyScopeFilter(capaQ, user, 'c');
    const openCorrectiveActions = await capaQ.getCount();

    const envQ = this.env.createQueryBuilder('e');
    this.scope.applyScopeFilter(envQ, user, 'e', 'reportedById');
    const environmentalCases = await envQ.getCount();

    const ltifr = (ltis * 200_000) / Math.max(hoursWorked, 1);
    const trir = (recordable * 200_000) / Math.max(hoursWorked, 1);

    // Composite: lower is better. Penalise fatalities heavily.
    const safetyPerformanceScore = Math.max(
      0,
      100 - fatalities * 25 - openIncidents * 1.5 - openCorrectiveActions * 0.5,
    );

    return {
      totalIncidents,
      ltifr: Number(ltifr.toFixed(2)),
      trir: Number(trir.toFixed(2)),
      fatalities,
      nearMisses,
      hazardReports,
      openCorrectiveActions,
      environmentalCases,
      safetyPerformanceScore: Number(safetyPerformanceScore.toFixed(1)),
    };
  }

  async trends(user: AuthUser, days = 30): Promise<DashboardTrendPoint[]> {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);

    // Cross-DB friendly: pull just the timestamps and group by ISO day in JS.
    // Avoids vendor-specific date functions (`date_trunc`, `DATE_FORMAT`,
    // `CONVERT(date, …)`, `TRUNC(date, 'DD')`) so the same code works on
    // SQLite, PostgreSQL, MSSQL/Azure SQL, MySQL and Oracle.
    const incQ = this.incidents
      .createQueryBuilder('i')
      .select('i.occurredAt', 'd')
      .where('i.occurredAt >= :since', { since });
    this.scope.applyScopeFilter(incQ, user, 'i', 'reportedById');

    const hzQ = this.hazards
      .createQueryBuilder('h')
      .select('h.createdAt', 'd')
      .where('h.createdAt >= :since', { since });
    this.scope.applyScopeFilter(hzQ, user, 'h', 'reportedById');

    const nmQ = this.nearMisses
      .createQueryBuilder('n')
      .select('n.occurredAt', 'd')
      .where('n.occurredAt >= :since', { since })
      .andWhere('n.status <> :converted', { converted: 'CONVERTED' });
    this.scope.applyScopeFilter(nmQ, user, 'n', 'reportedById');

    const [incRows, hzRows, nmRows] = await Promise.all([
      incQ.getRawMany<{ d: Date | string }>(),
      hzQ.getRawMany<{ d: Date | string }>(),
      nmQ.getRawMany<{ d: Date | string }>(),
    ]);

    const map = new Map<string, DashboardTrendPoint>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since.getTime() + i * 24 * 3600 * 1000);
      const k = d.toISOString().slice(0, 10);
      map.set(k, { date: k, incidents: 0, hazards: 0, nearMisses: 0 });
    }
    const bump = (rows: { d: Date | string }[], key: 'incidents' | 'hazards' | 'nearMisses') => {
      for (const r of rows) {
        if (!r.d) continue;
        const k = new Date(r.d).toISOString().slice(0, 10);
        const slot = map.get(k);
        if (slot) slot[key]++;
      }
    };
    bump(incRows, 'incidents');
    bump(hzRows, 'hazards');
    bump(nmRows, 'nearMisses');
    return [...map.values()];
  }

  async heatmap(user: AuthUser): Promise<{ regionId: string; regionName: string; count: number }[]> {
    const qb = this.incidents
      .createQueryBuilder('i')
      .leftJoin('i.region', 'r')
      .select('i.regionId', 'regionId')
      .addSelect('r.name', 'regionName')
      .addSelect('COUNT(*)', 'count')
      .groupBy('i.regionId, r.name');
    this.scope.applyScopeFilter(qb, user, 'i', 'reportedById');
    const rows = await qb.getRawMany<{ regionId: string; regionName: string; count: string }>();
    return rows.map((r) => ({ regionId: r.regionId, regionName: r.regionName, count: Number(r.count) }));
  }
}
