import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { AuthUser } from '@ecg-she/shared';
import { RbacScopeService } from '../auth/rbac-scope.service';
import { readAll } from '../../common/pagination';
import { Incident } from '../incidents/entities/incident.entity';
import { NearMiss } from '../near-miss/entities/near-miss.entity';
import { Hazard } from '../hazards/entities/hazard.entity';
import { JsaRecord } from '../jsa/entities/jsa.entity';
import { Permit } from '../ptw/entities/permit.entity';
import { Inspection } from '../inspections/entities/inspection.entity';
import { AuditRecord } from '../audits/entities/audit-record.entity';
import { EnvironmentalEvent } from '../environmental/entities/environmental-event.entity';
import { CorrectiveAction } from '../corrective-actions/entities/corrective-action.entity';
import { TrainingAttendance } from '../training/entities/training.entity';
import { HealthRecord } from '../health/entities/health-record.entity';
import { PpeIssuance, PpeItem } from '../ppe/entities/ppe.entity';

type Row = Record<string, string | number>;

function day(value?: Date | string | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
}

function place(row: { region?: { name?: string } | null; district?: { name?: string } | null }): { Region: string; District: string } {
  return { Region: row.region?.name ?? '', District: row.district?.name ?? '' };
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly scope: RbacScopeService,
    @InjectRepository(Incident) private readonly incidents: Repository<Incident>,
    @InjectRepository(NearMiss) private readonly nearMisses: Repository<NearMiss>,
    @InjectRepository(Hazard) private readonly hazards: Repository<Hazard>,
    @InjectRepository(JsaRecord) private readonly jobs: Repository<JsaRecord>,
    @InjectRepository(Permit) private readonly permits: Repository<Permit>,
    @InjectRepository(Inspection) private readonly inspections: Repository<Inspection>,
    @InjectRepository(AuditRecord) private readonly audits: Repository<AuditRecord>,
    @InjectRepository(EnvironmentalEvent) private readonly environmental: Repository<EnvironmentalEvent>,
    @InjectRepository(CorrectiveAction) private readonly actions: Repository<CorrectiveAction>,
    @InjectRepository(TrainingAttendance) private readonly training: Repository<TrainingAttendance>,
    @InjectRepository(HealthRecord) private readonly health: Repository<HealthRecord>,
    @InjectRepository(PpeIssuance) private readonly issued: Repository<PpeIssuance>,
    @InjectRepository(PpeItem) private readonly ppe: Repository<PpeItem>,
  ) {}

  async registerExcel(user: AuthUser, from?: Date, to?: Date): Promise<Buffer> {
    const pack = await this.gather(user, from, to);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ECG SHE';
    wb.created = new Date();
    this.sheet(wb, 'Summary', ['Activity', 'Records', 'Still open'], pack.summary.map((row) => ({
      Activity: row.activity,
      Records: row.records,
      'Still open': row.open,
    })));
    this.sheet(wb, 'Incidents', ['Reference', 'Type', 'Severity', 'Status', 'Title', 'Region', 'District', 'Occurred', 'Fatalities', 'Injured'], pack.incidents);
    this.sheet(wb, 'Near-misses', ['Reference', 'Status', 'Title', 'Potential', 'Confidential', 'Region', 'District', 'Occurred'], pack.nearMisses);
    this.sheet(wb, 'Hazards', ['Reference', 'Status', 'Category', 'Title', 'Region', 'District', 'Recorded'], pack.hazards);
    this.sheet(wb, 'Job briefings', ['Reference', 'Status', 'Work', 'Place', 'Region', 'District', 'Job date'], pack.jobs);
    this.sheet(wb, 'Permits', ['Reference', 'Type', 'Status', 'Work', 'Region', 'District', 'From', 'To'], pack.permits);
    this.sheet(wb, 'Inspections', ['Reference', 'Type', 'Status', 'Place', 'Score', 'Region', 'District', 'Inspected'], pack.inspections);
    this.sheet(wb, 'Audits', ['Reference', 'Type', 'Status', 'Scope', 'Region', 'District', 'Scheduled'], pack.audits);
    this.sheet(wb, 'Environmental', ['Reference', 'Type', 'Status', 'Title', 'Substance', 'Region', 'District', 'Occurred'], pack.environmental);
    this.sheet(wb, 'Corrective actions', ['Reference', 'Status', 'Type', 'Title', 'Source', 'Region', 'District', 'Due'], pack.actions);
    this.sheet(wb, 'Training', ['Person', 'Course', 'Result', 'Status', 'Region', 'District', 'Completed', 'Expires'], pack.training);
    this.sheet(wb, 'PPE issued', ['Person', 'Item', 'Status', 'Serial', 'Size', 'Quantity', 'Region', 'District', 'Issued', 'Next test', 'Expires'], pack.ppeIssued);
    this.sheet(wb, 'PPE stock', ['Part code', 'Name', 'Category', 'In stock', 'Reorder at', 'Region', 'District'], pack.ppeStock);
    this.sheet(wb, 'Health certificates', ['Reference', 'Person', 'Type', 'Outcome', 'Duty', 'Status', 'Region', 'District', 'Recorded', 'Next review'], pack.health);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async summaryPdf(user: AuthUser, from?: Date, to?: Date): Promise<Buffer> {
    const pack = await this.gather(user, from, to);
    const period = `${from ? day(from) : 'the start'} to ${to ? day(to) : 'today'}`;
    return new Promise<Buffer>((resolve) => {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.fontSize(16).text('ECG SHE activity summary', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(10).text(period, { align: 'center' });
      doc.moveDown(0.4);
      doc.fontSize(9).text('Counts follow the region and district of the person who downloaded this summary. Clinical notes are not included.');
      doc.moveDown(0.8);
      const line = (activity: string, records: string, open: string, font: string) => {
        const y = doc.y;
        doc.font(font).fontSize(9);
        doc.text(activity, 36, y, { width: 230, lineBreak: false });
        doc.text(records, 280, y, { width: 70, lineBreak: false });
        doc.text(open, 360, y, { width: 80, lineBreak: false });
        doc.y = y + 16;
      };
      line('Activity', 'Records', 'Still open', 'Helvetica-Bold');
      for (const row of pack.summary) line(row.activity, String(row.records), String(row.open), 'Helvetica');
      doc.x = 36;
      doc.moveDown(0.8);
      doc.font('Helvetica-Bold').fontSize(12).text('Needs attention', 36, doc.y, { width: 520 });
      doc.moveDown(0.4);
      doc.font('Helvetica').fontSize(9);
      const attention = [
        ...pack.incidents.filter((row) => row.Status !== 'CLOSED').slice(0, 8).map((row) => `Incident ${row.Reference} — ${row.Title} (${row.Status})`),
        ...pack.actions.filter((row) => row.Status !== 'CLOSED').slice(0, 8).map((row) => `Action ${row.Reference} — ${row.Title} (${row.Status})`),
        ...pack.training.filter((row) => row.Status === 'EXPIRED' || row.Status === 'EXPIRING' || row.Status === 'FAILED').slice(0, 8).map((row) => `Training ${row.Person} — ${row.Course} (${row.Status})`),
        ...pack.ppeStock.filter((row) => Number(row['Reorder at']) > 0 && Number(row['In stock']) <= Number(row['Reorder at'])).slice(0, 8).map((row) => `PPE stock ${row.Name} — ${row['In stock']} left`),
      ];
      if (!attention.length) doc.text('Nothing in this period is waiting.', 36, doc.y, { width: 520 });
      attention.forEach((item) => {
        doc.text(item, 36, doc.y, { width: 520 });
        doc.moveDown(0.15);
      });
      doc.end();
    });
  }

  private async gather(user: AuthUser, from?: Date, to?: Date) {
    const [incidents, nearMisses, hazards, jobs, permits, inspections, audits, environmental, actions, training, issued, stock, health] = await Promise.all([
      this.load(this.incidents, 'r', user, from, to),
      this.load(this.nearMisses, 'r', user, from, to),
      this.load(this.hazards, 'r', user, from, to),
      this.load(this.jobs, 'r', user, from, to),
      this.load(this.permits, 'r', user, from, to),
      this.load(this.inspections, 'r', user, from, to),
      this.load(this.audits, 'r', user, from, to),
      this.load(this.environmental, 'r', user, from, to),
      this.load(this.actions, 'r', user, from, to),
      this.training.createQueryBuilder('r').leftJoinAndSelect('r.region', 'region').leftJoinAndSelect('r.district', 'district').leftJoinAndSelect('r.course', 'course').leftJoinAndSelect('r.employee', 'employee'),
      this.issued.createQueryBuilder('r').leftJoinAndSelect('r.region', 'region').leftJoinAndSelect('r.district', 'district').leftJoinAndSelect('r.item', 'item').leftJoinAndSelect('r.employee', 'employee'),
      this.load(this.ppe, 'r', user),
      this.health.createQueryBuilder('r').leftJoinAndSelect('r.region', 'region').leftJoinAndSelect('r.district', 'district').leftJoinAndSelect('r.employee', 'employee'),
    ]);
    this.scope.applyScopeFilter(training, user, 'r');
    this.scope.applyScopeFilter(issued, user, 'r');
    this.scope.applyScopeFilter(health, user, 'r');
    this.between(training, 'r', from, to);
    this.between(issued, 'r', from, to);
    this.between(health, 'r', from, to);
    const [trainingRows, issuedRows, healthRows] = await Promise.all([
      readAll(training.orderBy('r.createdAt', 'DESC')),
      readAll(issued.orderBy('r.createdAt', 'DESC')),
      readAll(health.orderBy('r.createdAt', 'DESC')),
    ]);

    const incidentRows = incidents.map((row) => ({ Reference: row.referenceCode, Type: row.type, Severity: String(row.severity), Status: String(row.status), Title: row.title, ...place(row), Occurred: day(row.occurredAt), Fatalities: row.fatalities, Injured: row.injuredPersons }));
    const nearRows = nearMisses.map((row) => ({ Reference: row.referenceCode, Status: row.status, Title: row.title, Potential: row.severityPotential ?? '', Confidential: row.anonymous ? 'Yes' : 'No', ...place(row), Occurred: day(row.occurredAt) }));
    const hazardRows = hazards.map((row) => ({ Reference: row.referenceCode, Status: row.status, Category: String(row.category), Title: row.title, ...place(row), Recorded: day(row.createdAt) }));
    const jobRows = jobs.map((row) => ({ Reference: row.referenceCode, Status: row.status, Work: row.workActivity, Place: row.jobLocation ?? '', ...place(row), 'Job date': day(row.jobDate) }));
    const permitRows = permits.map((row) => ({ Reference: row.referenceCode, Type: String(row.type), Status: String(row.status), Work: row.workDescription, ...place(row), From: day(row.validFrom), To: day(row.validTo) }));
    const inspectionRows = inspections.map((row) => ({ Reference: row.referenceCode, Type: String(row.type), Status: row.status, Place: row.assetOrLocation, Score: row.scorePercent, ...place(row), Inspected: day(row.inspectedAt) }));
    const auditRows = audits.map((row) => ({ Reference: row.referenceCode, Type: String(row.type), Status: String(row.status), Scope: row.scope, ...place(row), Scheduled: day(row.scheduledDate) }));
    const envRows = environmental.map((row) => ({ Reference: row.referenceCode, Type: String(row.type), Status: row.status, Title: row.title, Substance: row.substance ?? '', ...place(row), Occurred: day(row.occurredAt) }));
    const actionRows = actions.map((row) => ({ Reference: row.referenceCode, Status: String(row.status), Type: row.actionType, Title: row.title, Source: row.sourceType ?? '', ...place(row), Due: day(row.dueDate) }));
    const classRows = trainingRows.map((row) => ({ Person: row.employee?.fullName ?? '', Course: row.course?.title ?? '', Result: row.result ?? '', Status: row.status, ...place(row), Completed: day(row.completedOn), Expires: day(row.expiresOn) }));
    const issueRows = issuedRows.map((row) => ({ Person: row.employee?.fullName ?? '', Item: row.item?.name ?? '', Status: row.status, Serial: row.serialNumber ?? '', Size: row.size ?? '', Quantity: row.quantity, ...place(row), Issued: day(row.issuedOn), 'Next test': day(row.nextTestOn), Expires: day(row.expiresOn) }));
    const stockRows = stock.map((row) => ({ 'Part code': row.sku, Name: row.name, Category: row.category, 'In stock': row.stockOnHand, 'Reorder at': row.reorderLevel, ...place(row) }));
    const healthRowsOut = healthRows.map((row) => ({ Reference: row.referenceCode ?? '', Person: row.employee?.fullName ?? row.campaignTitle ?? '', Type: row.recordType, Outcome: row.fitnessOutcome ?? '', Duty: row.duty ?? '', Status: row.status, ...place(row), Recorded: day(row.recordDate), 'Next review': day(row.nextReviewDate) }));

    const open = (rows: Array<{ Status?: string }>) => rows.filter((row) => row.Status && row.Status !== 'CLOSED' && row.Status !== 'REJECTED').length;
    const summary = [
      { activity: 'Incidents', records: incidentRows.length, open: open(incidentRows) },
      { activity: 'Near-misses', records: nearRows.length, open: open(nearRows) },
      { activity: 'Hazards', records: hazardRows.length, open: open(hazardRows) },
      { activity: 'Job briefings', records: jobRows.length, open: jobRows.filter((row) => row.Status !== 'APPROVED' && row.Status !== 'REJECTED').length },
      { activity: 'Permits', records: permitRows.length, open: permitRows.filter((row) => !['CLOSED', 'REJECTED', 'EXPIRED', 'CANCELLED'].includes(String(row.Status))).length },
      { activity: 'Inspections', records: inspectionRows.length, open: open(inspectionRows) },
      { activity: 'Audits', records: auditRows.length, open: open(auditRows) },
      { activity: 'Environmental events', records: envRows.length, open: open(envRows) },
      { activity: 'Corrective actions', records: actionRows.length, open: open(actionRows) },
      { activity: 'Training passes', records: classRows.length, open: classRows.filter((row) => row.Status !== 'PASSED' && row.Status !== 'COMPLETED').length },
      { activity: 'PPE issued', records: issueRows.length, open: issueRows.filter((row) => row.Status === 'ISSUED').length },
      { activity: 'Health certificates', records: healthRowsOut.length, open: healthRowsOut.filter((row) => row.Status === 'CURRENT').length },
    ];
    return {
      summary,
      incidents: incidentRows,
      nearMisses: nearRows,
      hazards: hazardRows,
      jobs: jobRows,
      permits: permitRows,
      inspections: inspectionRows,
      audits: auditRows,
      environmental: envRows,
      actions: actionRows,
      training: classRows,
      ppeIssued: issueRows,
      ppeStock: stockRows,
      health: healthRowsOut,
    };
  }

  private load<T extends { region?: { name?: string } | null; district?: { name?: string } | null }>(
    repo: Repository<T>,
    alias: string,
    user: AuthUser,
    from?: Date,
    to?: Date,
  ): Promise<T[]> {
    const qb = repo.createQueryBuilder(alias).leftJoinAndSelect(`${alias}.region`, 'region').leftJoinAndSelect(`${alias}.district`, 'district');
    this.scope.applyScopeFilter(qb, user, alias);
    this.between(qb, alias, from, to);
    return readAll(qb.orderBy(`${alias}.createdAt`, 'DESC'));
  }

  private between(qb: { andWhere: (sql: string, params?: object) => unknown }, alias: string, from?: Date, to?: Date): void {
    if (from) qb.andWhere(`${alias}.createdAt >= :from`, { from });
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      qb.andWhere(`${alias}.createdAt <= :to`, { to: end });
    }
  }

  private sheet(wb: ExcelJS.Workbook, name: string, headers: string[], rows: Row[]): void {
    const sheet = wb.addWorksheet(name);
    sheet.columns = headers.map((header) => ({ header, key: header, width: Math.min(40, Math.max(14, header.length + 4)) }));
    rows.forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true };
  }
}
