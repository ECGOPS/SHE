import { existsSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { EscalationAction, ISSUE_SCOPE_LABEL, IssueScope } from '@ecg-she/shared';
import { Incident } from './entities/incident.entity';
import { CorrectiveAction } from '../corrective-actions/entities/corrective-action.entity';
import { IssueEscalation } from '../escalations/entities/issue-escalation.entity';

const NAVY = '#0B3D91';
const GOLD = '#C4A35A';
const INK = '#1C2430';
const MUTED = '#5C6570';

const ACTION_LABEL: Record<string, string> = {
  [EscalationAction.ESCALATE]: 'Escalated',
  [EscalationAction.REFER_DOWN]: 'Referred down',
  [EscalationAction.RESOLVE]: 'Resolved',
  [EscalationAction.REOPEN]: 'Reopened',
  [EscalationAction.REASSIGN]: 'Reassigned',
};

const FINDING_LABEL: Record<string, string> = {
  IMMEDIATE: 'Immediate cause',
  UNDERLYING: 'Underlying cause',
  ROOT: 'Root cause',
  CONTRIBUTING: 'Contributing factor',
};

export interface IncidentReportInput {
  incident: Incident;
  actions: CorrectiveAction[];
  history: IssueEscalation[];
  preparedBy: string;
}

export function buildIncidentReport(input: IncidentReportInput): Promise<Buffer> {
  const { incident, actions, history, preparedBy } = input;
  const logo = findLogo();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      bufferPages: true,
      margins: { top: 96, bottom: 72, left: 48, right: 48 },
      info: {
        Title: `${incident.referenceCode} incident report`,
        Author: 'ECG Safety Health Environment Management',
        Subject: incident.title,
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    titleBlock(doc, incident, preparedBy);
    section(doc, '1. Incident particulars');
    pair(doc, 'Reference', incident.referenceCode, 'Status', label(incident.status));
    pair(doc, 'Type', label(incident.type), 'Severity', label(String(incident.severity)));
    pair(doc, 'Occurred', when(incident.occurredAt), 'Recorded', when(incident.createdAt));
    pair(
      doc,
      'Escalation',
      incident.resolvedAt
        ? `Resolved at ${scopeLabel(incident.resolvedAtScope ?? incident.currentScope)}`
        : `At ${scopeLabel(incident.currentScope)}`,
      'Investigator',
      incident.investigator?.fullName ?? 'Not assigned',
    );

    section(doc, '2. Immediate response');
    pair(
      doc,
      'Area secured',
      incident.areaSecured ? 'Yes' : 'Not recorded',
      'First aid',
      incident.firstAidOutcome === 'GIVEN'
        ? 'Given'
        : incident.firstAidOutcome === 'NOT_REQUIRED'
          ? 'Not required'
          : 'Not recorded',
    );
    pair(
      doc,
      'Supervisor informed',
      incident.supervisorInformed
        ? incident.supervisorName
          ? `Yes — ${incident.supervisorName}`
          : 'Yes'
        : 'Not recorded',
      'Emergency services',
      incident.emergencyServicesContacted
        ? incident.emergencyServicesDetails || 'Contacted'
        : 'Not contacted',
    );
    if (incident.firstAidNotes) prose(doc, `First aid notes: ${incident.firstAidNotes}`);
    if (incident.managementReportSubmittedAt) {
      prose(
        doc,
        `Submitted to management ${when(incident.managementReportSubmittedAt)}${
          incident.managementReportSubmittedBy?.fullName
            ? ` by ${incident.managementReportSubmittedBy.fullName}`
            : ''
        }.`,
      );
    }

    section(doc, '3. What happened');
    prose(doc, incident.title, true);
    prose(doc, incident.description);

    section(doc, '4. Place and people');
    pair(doc, 'Region', incident.region?.name ?? '—', 'District', incident.district?.name ?? 'Head office');
    pair(doc, 'Location', incident.locationName ?? '—', 'Reported by', incident.reportedBy?.fullName ?? '—');
    if (incident.latitude != null && incident.longitude != null) {
      prose(doc, `Coordinates: ${incident.latitude.toFixed(5)}, ${incident.longitude.toFixed(5)}`);
    }

    section(doc, '5. Impact');
    pair(doc, 'Fatalities', String(incident.fatalities ?? 0), 'Injured', String(incident.injuredPersons ?? 0));
    pair(
      doc,
      'People affected',
      String(incident.affectedPersons ?? 0),
      'Estimated cost',
      `GHS ${Number(incident.estimatedCost ?? 0).toLocaleString('en-GB')}`,
    );

    section(doc, '6. Witness statements');
    const witnesses = [...(incident.witnesses ?? [])].sort((a, b) => stamp(a.createdAt) - stamp(b.createdAt));
    if (!witnesses.length) prose(doc, 'No witness statements recorded.');
    witnesses.forEach((witness, index) => {
      ensure(doc, 48);
      prose(doc, `${index + 1}. ${witness.fullName}${witness.role ? ` — ${witness.role}` : ''}`, true);
      if (witness.contact) prose(doc, `Contact: ${witness.contact}`);
      prose(doc, witness.statement);
    });

    section(doc, '7. Findings');
    const findings = [...(incident.findings ?? [])].sort((a, b) => stamp(a.createdAt) - stamp(b.createdAt));
    if (!findings.length) prose(doc, 'No findings recorded.');
    findings.forEach((finding, index) => {
      ensure(doc, 48);
      prose(doc, `${index + 1}. ${FINDING_LABEL[finding.category] ?? label(finding.category)}`, true);
      prose(doc, finding.description);
      if (finding.recommendation) prose(doc, `Recommendation: ${finding.recommendation}`);
    });

    section(doc, '8. Corrective actions');
    if (!actions.length) prose(doc, 'No corrective action has been raised from this incident.');
    actions.forEach((action, index) => {
      ensure(doc, 64);
      prose(doc, `${index + 1}. ${action.referenceCode} — ${action.title}`, true);
      pair(doc, 'Status', label(String(action.status)), 'Priority', label(action.priority));
      pair(
        doc,
        'Type',
        label(action.actionType),
        'Due',
        when(action.dueDate),
      );
      prose(doc, `Owner: ${action.assignee?.fullName ?? 'Not assigned'}`);
      prose(doc, action.description);
      if (action.protocolUpdateRequired) {
        prose(doc, `Protocol update: ${action.protocolUpdateNotes || 'Required — notes not yet recorded.'}`);
      }
    });

    section(doc, '9. Escalation');
    if (!history.length) {
      prose(doc, `The case is still at ${scopeLabel(incident.currentScope)}. No transition has been recorded.`);
    }
    history.forEach((row) => {
      ensure(doc, 40);
      const movement =
        row.fromScope === row.toScope
          ? `at ${scopeLabel(row.toScope)}`
          : `${scopeLabel(row.fromScope)} to ${scopeLabel(row.toScope)}`;
      prose(doc, `${when(row.createdAt)} — ${ACTION_LABEL[row.action] ?? label(row.action)} ${movement}`, true);
      prose(doc, `By ${row.fromUser?.fullName ?? 'a safety officer'}. ${row.reason}`);
    });

    section(doc, '10. Resolution');
    if (!incident.resolvedAt) {
      prose(doc, 'This incident is still open.');
    } else {
      pair(doc, 'Resolved', when(incident.resolvedAt), 'Tier', scopeLabel(incident.resolvedAtScope ?? incident.currentScope));
      prose(doc, incident.resolutionNotes ?? 'No resolution notes recorded.');
    }

    section(doc, '11. Photographs');
    const photos = (incident.attachments ?? []).filter((file) => file.kind === 'photo');
    if (!photos.length) prose(doc, 'No photographs are attached to this incident.');
    for (const photo of photos) {
      const filePath = join(process.cwd(), 'data', photo.storageKey);
      ensure(doc, 210);
      prose(doc, photo.fileName, true);
      if (existsSync(filePath) && /image\/(jpeg|jpg|png)/i.test(photo.mimeType)) {
        try {
          doc.image(filePath, 48, doc.y, { fit: [240, 150] });
          doc.y += 158;
          doc.x = 48;
        } catch {
          prose(doc, 'This photograph could not be embedded.');
        }
      } else {
        prose(doc, 'The file is listed on the incident. It is not embedded in this report.');
      }
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(range.start + i);
      paintChrome(doc, logo, incident.referenceCode, i + 1, range.count);
    }
    doc.end();
  });
}

function findLogo(): string | null {
  const candidates = [
    join(__dirname, '../../assets/ecg-logo.png'),
    join(__dirname, '../../../src/assets/ecg-logo.png'),
    join(process.cwd(), 'src/assets/ecg-logo.png'),
    join(process.cwd(), 'apps/api/src/assets/ecg-logo.png'),
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

function paintChrome(doc: PDFKit.PDFDocument, logo: string | null, reference: string, page: number, pages: number) {
  const bottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  const width = doc.page.width;
  const height = doc.page.height;
  if (logo) doc.image(logo, 48, 22, { fit: [42, 42] });
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9)
    .text('ECG SAFETY HEALTH ENVIRONMENT MANAGEMENT', 98, 28, { width: 360, lineBreak: false });
  doc.fillColor(MUTED).font('Helvetica').fontSize(8)
    .text('Incident investigation report', 98, 44, { width: 280, lineBreak: false });
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9)
    .text(reference, width - 210, 30, { width: 162, align: 'right', lineBreak: false });
  doc.moveTo(48, 74).lineTo(width - 48, 74).strokeColor(NAVY).lineWidth(1.4).stroke();
  doc.moveTo(48, 77).lineTo(width - 48, 77).strokeColor(GOLD).lineWidth(0.7).stroke();

  doc.moveTo(48, height - 48).lineTo(width - 48, height - 48).strokeColor(NAVY).lineWidth(0.8).stroke();
  if (logo) doc.image(logo, 48, height - 38, { fit: [20, 20] });
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(8)
    .text('ECG SAFETY HEALTH ENVIRONMENT MANAGEMENT', 74, height - 32, { width: 340, lineBreak: false });
  doc.fillColor(MUTED).font('Helvetica').fontSize(8)
    .text(`Page ${page} of ${pages}`, width - 160, height - 32, { width: 112, align: 'right', lineBreak: false });
  doc.page.margins.bottom = bottom;
  doc.fillColor(INK);
}

function titleBlock(doc: PDFKit.PDFDocument, incident: Incident, preparedBy: string) {
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(16).text(incident.title, 48, doc.y, { width: 499 });
  doc.moveDown(0.25);
  doc.fillColor(MUTED).font('Helvetica').fontSize(9)
    .text(`Prepared ${when(new Date())} by ${preparedBy}. This report states the incident as held in ECG SHE at the time of export.`, { width: 499 });
  doc.moveDown(0.8);
  doc.fillColor(INK);
}

function section(doc: PDFKit.PDFDocument, title: string) {
  ensure(doc, 40);
  const y = doc.y;
  doc.save();
  doc.rect(48, y, 499, 18).fill(NAVY);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10).text(title, 56, y + 4, { width: 480, lineBreak: false });
  doc.restore();
  doc.fillColor(INK);
  doc.x = 48;
  doc.y = y + 26;
}

function prose(doc: PDFKit.PDFDocument, value: string, strong = false) {
  ensure(doc, 20);
  doc.fillColor(INK).font(strong ? 'Helvetica-Bold' : 'Helvetica').fontSize(strong ? 11 : 10)
    .text(value || '—', 48, doc.y, { width: 499 });
  doc.moveDown(0.3);
}

function pair(doc: PDFKit.PDFDocument, leftLabel: string, leftValue: string, rightLabel: string, rightValue: string) {
  ensure(doc, 36);
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED);
  doc.text(leftLabel.toUpperCase(), 48, y, { width: 230, lineBreak: false });
  doc.text(rightLabel.toUpperCase(), 310, y, { width: 230, lineBreak: false });
  doc.font('Helvetica').fontSize(10).fillColor(INK);
  const leftHeight = doc.heightOfString(leftValue || '—', { width: 230 });
  const rightHeight = doc.heightOfString(rightValue || '—', { width: 230 });
  doc.text(leftValue || '—', 48, y + 12, { width: 230 });
  doc.text(rightValue || '—', 310, y + 12, { width: 230 });
  doc.x = 48;
  doc.y = y + 16 + Math.max(leftHeight, rightHeight);
}

function ensure(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function label(value: string): string {
  return value.replaceAll('_', ' ');
}

function scopeLabel(scope?: IssueScope | null): string {
  if (scope && scope in ISSUE_SCOPE_LABEL) return ISSUE_SCOPE_LABEL[scope];
  return 'District';
}

function when(value?: Date | string | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function stamp(value?: Date | string | null): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}
