import { ISSUE_SCOPE_LABEL, IssueScope } from '@ecg-she/shared';
import { CorrectiveAction } from '../../modules/corrective-actions/entities/corrective-action.entity';
import { IssueEscalation } from '../../modules/escalations/entities/issue-escalation.entity';
import { NearMiss } from '../../modules/near-miss/entities/near-miss.entity';
import { Hazard } from '../../modules/hazards/entities/hazard.entity';
import { JsaRecord } from '../../modules/jsa/entities/jsa.entity';
import { Permit } from '../../modules/ptw/entities/permit.entity';
import { Inspection } from '../../modules/inspections/entities/inspection.entity';
import { AuditRecord } from '../../modules/audits/entities/audit-record.entity';
import { EnvironmentalEvent } from '../../modules/environmental/entities/environmental-event.entity';
import { listed, SheReport, words, when, day, ReportBlock, ReportPhoto } from './she-report';

const ACTION_LABEL: Record<string, string> = {
  ESCALATE: 'Escalated',
  REFER_DOWN: 'Referred down',
  RESOLVE: 'Resolved',
  REOPEN: 'Reopened',
  REASSIGN: 'Reassigned',
};

function scopeLabel(scope?: IssueScope | null): string {
  if (scope && scope in ISSUE_SCOPE_LABEL) return ISSUE_SCOPE_LABEL[scope];
  return 'District';
}

function place(region?: { name?: string } | null, district?: { name?: string } | null): ReportBlock {
  return { kind: 'pair', leftLabel: 'Region', left: region?.name ?? '—', rightLabel: 'District', right: district?.name ?? '—' };
}

function actionBlocks(actions: CorrectiveAction[], empty: string): ReportBlock[] {
  if (!actions.length) return [{ kind: 'text', text: empty }];
  return actions.flatMap((action, index) => [
    { kind: 'text' as const, text: `${index + 1}. ${action.referenceCode} — ${action.title}`, strong: true },
    { kind: 'pair' as const, leftLabel: 'Status', left: words(String(action.status)), rightLabel: 'Due', right: day(action.dueDate) },
    { kind: 'text' as const, text: `Owner: ${action.assignee?.fullName ?? 'Not assigned'}. ${action.description}` },
  ]);
}

function historyBlocks(history: IssueEscalation[], current?: IssueScope | null): ReportBlock[] {
  if (!history.length) {
    return [{ kind: 'text', text: `The case is still at ${scopeLabel(current)}. No transition has been recorded.` }];
  }
  return history.flatMap((row) => {
    const movement = row.fromScope === row.toScope
      ? `at ${scopeLabel(row.toScope)}`
      : `${scopeLabel(row.fromScope)} to ${scopeLabel(row.toScope)}`;
    return [
      { kind: 'text' as const, text: `${when(row.createdAt)} — ${ACTION_LABEL[row.action] ?? words(row.action)} ${movement}`, strong: true },
      { kind: 'text' as const, text: `By ${row.fromUser?.fullName ?? 'a safety officer'}. ${row.reason}` },
    ];
  });
}

function photos(files: ReportPhoto[] | undefined, empty: string): ReportBlock {
  return { kind: 'photos', files: files ?? [], empty };
}

export function nearMissReport(row: NearMiss, actions: CorrectiveAction[], history: IssueEscalation[], preparedBy: string): SheReport {
  const reporter = row.anonymous
    ? row.reportedBy?.fullName ? `Confidential · ${row.reportedBy.fullName}` : 'Confidential'
    : row.reportedBy?.fullName ?? '—';
  return {
    kind: 'Near-miss report',
    reference: row.referenceCode,
    title: row.title,
    preparedBy,
    sections: [
      {
        title: '1. Particulars',
        blocks: [
          { kind: 'pair', leftLabel: 'Reference', left: row.referenceCode, rightLabel: 'Status', right: words(row.status) },
          { kind: 'pair', leftLabel: 'Category', left: words(row.category), rightLabel: 'Potential', right: words(row.severityPotential) },
          { kind: 'pair', leftLabel: 'Occurred', left: when(row.occurredAt), rightLabel: 'Investigator', right: row.investigator?.fullName ?? 'Not assigned' },
          { kind: 'pair', leftLabel: 'Escalation', left: row.resolvedAt ? `Resolved at ${scopeLabel(row.resolvedAtScope ?? row.currentScope)}` : `At ${scopeLabel(row.currentScope)}`, rightLabel: 'Reported by', right: reporter },
        ],
      },
      {
        title: '2. What happened',
        blocks: [
          { kind: 'text', text: row.description },
          place(row.region, row.district),
          { kind: 'pair', leftLabel: 'Location', left: row.locationName ?? '—', rightLabel: 'Body part at risk', right: words(row.bodyPartAtRisk) },
          { kind: 'text', text: `Potential injury: ${words(row.potentialInjuryNature)}` },
        ],
      },
      {
        title: '3. Review',
        blocks: [
          { kind: 'text', text: row.immediateCause ? `Immediate cause: ${row.immediateCause}` : 'No immediate cause recorded.' },
          { kind: 'text', text: row.rootCause ? `Root cause: ${row.rootCause}` : 'No root cause recorded.' },
        ],
      },
      { title: '4. Corrective actions', blocks: actionBlocks(actions, 'No corrective action has been raised from this near-miss.') },
      { title: '5. Escalation', blocks: historyBlocks(history, row.currentScope) },
      {
        title: '6. Resolution',
        blocks: row.resolvedAt
          ? [
              { kind: 'pair', leftLabel: 'Resolved', left: when(row.resolvedAt), rightLabel: 'Tier', right: scopeLabel(row.resolvedAtScope ?? row.currentScope) },
              { kind: 'text', text: row.resolutionNotes ?? 'No resolution notes recorded.' },
            ]
          : [{ kind: 'text', text: 'This near-miss is still open.' }],
      },
      { title: '7. Photographs', blocks: [photos((row.attachments ?? []).map((file) => ({ fileName: file.fileName, storageKey: file.storageKey, mimeType: file.mimeType })), 'No photographs are attached.')] },
    ],
  };
}

export function hazardReport(row: Hazard, actions: CorrectiveAction[], history: IssueEscalation[], preparedBy: string): SheReport {
  return {
    kind: 'Hazard report',
    reference: row.referenceCode,
    title: row.title,
    preparedBy,
    sections: [
      {
        title: '1. Particulars',
        blocks: [
          { kind: 'pair', leftLabel: 'Reference', left: row.referenceCode, rightLabel: 'Status', right: words(row.status) },
          { kind: 'pair', leftLabel: 'Category', left: words(row.category), rightLabel: 'Risk class', right: words(row.riskClass) },
          { kind: 'pair', leftLabel: 'Score', left: row.riskScore == null ? '—' : String(row.riskScore), rightLabel: 'Residual score', right: row.residualRiskScore == null ? '—' : String(row.residualRiskScore) },
          { kind: 'pair', leftLabel: 'Escalation', left: row.resolvedAt ? `Resolved at ${scopeLabel(row.resolvedAtScope ?? row.currentScope)}` : `At ${scopeLabel(row.currentScope)}`, rightLabel: 'Reported by', right: row.reportedBy?.fullName ?? '—' },
        ],
      },
      {
        title: '2. The condition',
        blocks: [
          { kind: 'text', text: row.description },
          { kind: 'text', text: row.immediateAction ? `Made safe: ${row.immediateAction}` : 'No immediate action recorded.' },
          place(row.region, row.district),
          { kind: 'pair', leftLabel: 'Location', left: row.locationName ?? '—', rightLabel: 'People exposed', right: row.peopleExposed ? 'Yes' : 'No' },
        ],
      },
      {
        title: '3. Controls',
        blocks: [
          { kind: 'pair', leftLabel: 'Hierarchy', left: words(row.controlHierarchy), rightLabel: 'Target date', right: day(row.targetCompletionDate) },
          { kind: 'text', text: row.controlMeasures ?? 'No control measures recorded.' },
          { kind: 'text', text: `Mitigation owner: ${row.mitigationOwner?.fullName ?? 'Not assigned'}` },
        ],
      },
      { title: '4. Corrective actions', blocks: actionBlocks(actions, 'No corrective action has been raised from this hazard.') },
      { title: '5. Escalation', blocks: historyBlocks(history, row.currentScope) },
      {
        title: '6. Resolution',
        blocks: row.resolvedAt
          ? [
              { kind: 'pair', leftLabel: 'Resolved', left: when(row.resolvedAt), rightLabel: 'Tier', right: scopeLabel(row.resolvedAtScope ?? row.currentScope) },
              { kind: 'text', text: row.resolutionNotes ?? 'No resolution notes recorded.' },
            ]
          : [{ kind: 'text', text: 'This hazard is still open.' }],
      },
      { title: '7. Photographs', blocks: [photos((row.attachments ?? []).map((file) => ({ fileName: file.fileName, storageKey: file.storageKey, mimeType: file.mimeType })), 'No photographs are attached.')] },
    ],
  };
}

export function capaReport(row: CorrectiveAction, preparedBy: string): SheReport {
  return {
    kind: 'Corrective action report',
    reference: row.referenceCode,
    title: row.title,
    preparedBy,
    sections: [
      {
        title: '1. Particulars',
        blocks: [
          { kind: 'pair', leftLabel: 'Reference', left: row.referenceCode, rightLabel: 'Status', right: words(String(row.status)) },
          { kind: 'pair', leftLabel: 'Type', left: words(row.actionType), rightLabel: 'Priority', right: words(row.priority) },
          { kind: 'pair', leftLabel: 'Due', left: day(row.dueDate), rightLabel: 'Owner', right: row.assignee?.fullName ?? 'Not assigned' },
          { kind: 'pair', leftLabel: 'Source', left: words(row.sourceType), rightLabel: 'Completed', right: when(row.completedAt) },
          place(row.region, row.district),
        ],
      },
      { title: '2. What must be done', blocks: [{ kind: 'text', text: row.description }] },
      {
        title: '3. Cause and evidence',
        blocks: [
          { kind: 'pair', leftLabel: 'Method', left: words(row.rootCauseMethod), rightLabel: 'Effectiveness', right: words(row.effectivenessOutcome) },
          { kind: 'text', text: row.rootCauseStatement ? `Cause: ${row.rootCauseStatement}` : 'No root cause recorded.' },
          { kind: 'text', text: row.evidenceNotes ? `Evidence: ${row.evidenceNotes}` : 'No evidence notes recorded.' },
          { kind: 'text', text: row.effectivenessNotes ? `Review: ${row.effectivenessNotes}` : 'No effectiveness review recorded.' },
          {
            kind: 'text',
            text: row.protocolUpdateRequired
              ? `Protocol update (${words(row.protocolLinkKind) || 'not linked'}): ${row.protocolUpdateNotes || 'Required — notes not yet recorded.'}`
              : 'No protocol or procedure update required.',
          },
        ],
      },
    ],
  };
}

export function jsaReport(row: JsaRecord, preparedBy: string): SheReport {
  const steps = row.steps ?? [];
  const stepBlocks: ReportBlock[] = steps.length
    ? steps.flatMap((step, index) => [
        { kind: 'text' as const, text: `${index + 1}. ${step.step}`, strong: true },
        { kind: 'text' as const, text: `Hazards: ${listed(step.hazards)}` },
        { kind: 'text' as const, text: `Controls: ${listed(step.controls)}` },
        { kind: 'pair' as const, leftLabel: 'Likelihood', left: words(step.likelihood), rightLabel: 'Severity', right: words(step.severity) },
      ])
    : [{ kind: 'text', text: 'No job steps recorded.' }];
  const crew = row.crew ?? [];
  return {
    kind: 'Job safety analysis',
    reference: row.referenceCode,
    title: row.workActivity,
    preparedBy,
    sections: [
      {
        title: '1. The job',
        blocks: [
          { kind: 'pair', leftLabel: 'Reference', left: row.referenceCode, rightLabel: 'Status', right: words(row.status) },
          { kind: 'pair', leftLabel: 'Job date', left: day(row.jobDate), rightLabel: 'Crew size', right: row.crewSize == null ? '—' : String(row.crewSize) },
          { kind: 'pair', leftLabel: 'Supervisor', left: row.supervisor?.fullName ?? '—', rightLabel: 'Permit', right: row.permit?.referenceCode ?? (row.permitRequired ? 'Required, not linked' : 'Not required') },
          place(row.region, row.district),
          { kind: 'text', text: `Place: ${row.jobLocation ?? '—'}` },
        ],
      },
      { title: '2. Steps', blocks: stepBlocks },
      {
        title: '3. People, equipment and emergency',
        blocks: [
          { kind: 'text', text: crew.length ? `Crew: ${crew.map((person) => person.name).join(', ')}` : 'No crew recorded.' },
          { kind: 'text', text: `PPE: ${listed(row.ppeRequired)}` },
          { kind: 'text', text: `Tools: ${listed(row.toolsAndEquipment)}` },
          { kind: 'text', text: row.emergencyProcedures ?? 'No emergency procedure recorded.' },
          { kind: 'text', text: row.rejectionNotes ? `Rejection: ${row.rejectionNotes}` : 'Not rejected.' },
        ],
      },
    ],
  };
}

export function permitReport(row: Permit, preparedBy: string): SheReport {
  const gas = row.gasTestResults ?? {};
  return {
    kind: 'Permit-to-work',
    reference: row.referenceCode,
    title: row.workDescription,
    preparedBy,
    sections: [
      {
        title: '1. The permit',
        blocks: [
          { kind: 'pair', leftLabel: 'Reference', left: row.referenceCode, rightLabel: 'Status', right: words(String(row.status)) },
          { kind: 'pair', leftLabel: 'Type', left: words(String(row.type)), rightLabel: 'Crew size', right: row.crewSize == null ? '—' : String(row.crewSize) },
          { kind: 'pair', leftLabel: 'Valid from', left: when(row.validFrom), rightLabel: 'Valid to', right: when(row.validTo) },
          place(row.region, row.district),
          { kind: 'text', text: `Location: ${row.workLocation}` },
        ],
      },
      {
        title: '2. People',
        blocks: [
          { kind: 'pair', leftLabel: 'Applicant', left: row.applicant?.fullName ?? '—', rightLabel: 'Issuer', right: row.issuer?.fullName ?? '—' },
          { kind: 'pair', leftLabel: 'Holder', left: row.holder?.fullName ?? '—', rightLabel: 'Standby', right: row.standbyPerson?.fullName ?? '—' },
          { kind: 'text', text: `Authorising manager: ${row.authorisingManager?.fullName ?? '—'}` },
        ],
      },
      {
        title: '3. Isolation, hazards and controls',
        blocks: [
          { kind: 'pair', leftLabel: 'Isolation', left: words(row.isolationMethod), rightLabel: 'Gas test', right: row.gasTestRequired ? 'Required' : 'Not required' },
          { kind: 'text', text: `Isolation points: ${listed(row.isolationPoints)}` },
          { kind: 'text', text: `Hazards: ${listed(row.hazardsIdentified)}` },
          { kind: 'text', text: `Controls: ${listed(row.controlMeasures)}` },
          { kind: 'text', text: `PPE: ${listed(row.ppeRequired)}` },
          { kind: 'text', text: `Gas test: oxygen ${String(gas.oxygen ?? '—')}, LEL ${String(gas.lel ?? '—')}, toxic ${String(gas.toxic ?? '—')}. ${String(gas.notes ?? '')}`.trim() },
        ],
      },
      {
        title: '4. Notes',
        blocks: [
          { kind: 'text', text: row.rejectionNotes ? `Rejection: ${row.rejectionNotes}` : 'Not rejected.' },
          { kind: 'text', text: row.suspensionNotes ? `Suspension: ${row.suspensionNotes}` : 'Not suspended.' },
          { kind: 'text', text: row.handbackNotes ? `Handback: ${row.handbackNotes}` : 'No handback notes.' },
        ],
      },
    ],
  };
}

export function inspectionReport(row: Inspection, preparedBy: string): SheReport {
  const items = row.items ?? [];
  const itemBlocks: ReportBlock[] = items.length
    ? items.flatMap((item, index) => [
        { kind: 'text' as const, text: `${index + 1}. ${item.question} — ${item.answer}`, strong: true },
        { kind: 'text' as const, text: [item.notes, item.immediateAction ? `Immediate action: ${item.immediateAction}` : ''].filter(Boolean).join(' ') || 'No note.' },
      ])
    : [{ kind: 'text', text: 'No checklist answers recorded.' }];
  return {
    kind: 'Inspection report',
    reference: row.referenceCode,
    title: row.assetOrLocation,
    preparedBy,
    sections: [
      {
        title: '1. The inspection',
        blocks: [
          { kind: 'pair', leftLabel: 'Reference', left: row.referenceCode, rightLabel: 'Status', right: words(row.status) },
          { kind: 'pair', leftLabel: 'Type', left: words(String(row.type)), rightLabel: 'Score', right: `${row.scorePercent}%` },
          { kind: 'pair', leftLabel: 'Inspected', left: when(row.inspectedAt), rightLabel: 'Inspector', right: row.inspector?.fullName ?? '—' },
          place(row.region, row.district),
          { kind: 'text', text: row.weatherCondition ? `Weather: ${row.weatherCondition}` : 'Weather not recorded.' },
          { kind: 'text', text: row.observations ?? 'No observations recorded.' },
        ],
      },
      { title: '2. Checklist', blocks: itemBlocks },
      { title: '3. Photographs', blocks: [photos((row.attachments ?? []).map((file) => ({ fileName: file.fileName, storageKey: file.storageKey, mimeType: file.mimeType })), 'No photographs are attached.')] },
    ],
  };
}

export function auditReport(row: AuditRecord, preparedBy: string): SheReport {
  const checks = row.checklist ?? [];
  const findings = row.findings ?? [];
  return {
    kind: 'Audit report',
    reference: row.referenceCode,
    title: row.scope,
    preparedBy,
    sections: [
      {
        title: '1. The audit',
        blocks: [
          { kind: 'pair', leftLabel: 'Reference', left: row.referenceCode, rightLabel: 'Status', right: words(String(row.status)) },
          { kind: 'pair', leftLabel: 'Type', left: words(String(row.type)), rightLabel: 'Scheduled', right: when(row.scheduledDate) },
          { kind: 'pair', leftLabel: 'Lead auditor', left: row.leadAuditor?.fullName ?? row.leadAuditorName ?? '—', rightLabel: 'Auditee', right: row.auditee ?? '—' },
          place(row.region, row.district),
          { kind: 'text', text: row.objectives ?? 'No objectives recorded.' },
          { kind: 'text', text: row.methods ? `Methods: ${row.methods}` : 'No methods recorded.' },
        ],
      },
      {
        title: '2. Checklist',
        blocks: checks.length
          ? checks.map((item) => ({ kind: 'text' as const, text: `${item.clause}: ${words(item.result)} ${item.evidence ? `— ${item.evidence}` : ''}`.trim() }))
          : [{ kind: 'text', text: 'No checklist answers recorded.' }],
      },
      {
        title: '3. Findings',
        blocks: findings.length
          ? findings.flatMap((finding, index) => [
              { kind: 'text' as const, text: `${index + 1}. ${words(finding.severity)} — ${finding.clauseRef ?? 'No clause'}`, strong: true },
              { kind: 'text' as const, text: finding.description },
              { kind: 'text' as const, text: finding.auditeeResponse ? `Auditee: ${finding.auditeeResponse}` : `Status: ${words(finding.status)}` },
            ])
          : [{ kind: 'text', text: 'No findings recorded.' }],
      },
    ],
  };
}

export function environmentalReport(row: EnvironmentalEvent, actions: CorrectiveAction[], preparedBy: string): SheReport {
  const quantity = row.estimatedQuantity == null ? '—' : `${row.estimatedQuantity} ${row.quantityUnit ?? ''}`.trim();
  return {
    kind: 'Environmental event report',
    reference: row.referenceCode,
    title: row.title,
    preparedBy,
    sections: [
      {
        title: '1. The event',
        blocks: [
          { kind: 'pair', leftLabel: 'Reference', left: row.referenceCode, rightLabel: 'Status', right: words(row.status) },
          { kind: 'pair', leftLabel: 'Type', left: words(String(row.type)), rightLabel: 'Occurred', right: when(row.occurredAt) },
          { kind: 'pair', leftLabel: 'Quantity', left: quantity, rightLabel: 'Reported by', right: row.reportedBy?.fullName ?? '—' },
          place(row.region, row.district),
          { kind: 'text', text: `Location: ${row.locationName ?? '—'}` },
          { kind: 'text', text: row.description },
          { kind: 'text', text: row.substance ? `Substance: ${row.substance}` : 'No substance recorded.' },
        ],
      },
      {
        title: '2. Containment and assessment',
        blocks: [
          { kind: 'text', text: row.containmentActions ?? 'No containment recorded.' },
          { kind: 'pair', leftLabel: 'Aspect', left: words(row.aspect), rightLabel: 'Impact', right: words(row.impact) },
          { kind: 'pair', leftLabel: 'Severity', left: words(row.severity), rightLabel: 'Reportable', right: row.regulatoryReportable ? 'Yes' : 'No' },
          { kind: 'text', text: row.agencyNotificationRef ? `Agency reference: ${row.agencyNotificationRef}` : 'No agency notification recorded.' },
        ],
      },
      {
        title: '3. Waste',
        blocks: [
          { kind: 'pair', leftLabel: 'Contractor', left: row.wasteContractor ?? '—', rightLabel: 'Waybill', right: row.waybillNumber ?? '—' },
          { kind: 'text', text: `Disposal site: ${row.disposalSite ?? '—'}` },
        ],
      },
      { title: '4. Corrective actions', blocks: actionBlocks(actions, 'No corrective action has been raised from this event.') },
      {
        title: '5. Closure',
        blocks: [{ kind: 'text', text: row.closureNotes ?? 'This event is still open.' }],
      },
      { title: '6. Photographs', blocks: [photos((row.attachments ?? []).map((file) => ({ fileName: file.fileName, storageKey: file.storageKey, mimeType: file.mimeType })), 'No photographs are attached.')] },
    ],
  };
}

export function healthReport(row: {
  referenceCode?: string | null;
  recordType?: string;
  recordDate?: string | Date;
  nextReviewDate?: string | Date | null;
  reviewState?: string;
  status?: string;
  fitnessOutcome?: string | null;
  restrictions?: string | null;
  duty?: string | null;
  surveillanceTest?: string | null;
  exposureAgent?: string | null;
  exposureReading?: string | null;
  locationName?: string | null;
  vaccine?: string | null;
  dose?: string | null;
  batchNumber?: string | null;
  campaignTitle?: string | null;
  attendeeCount?: number | null;
  clinician?: string | null;
  employee?: { fullName?: string } | null;
  region?: { name?: string } | null;
  district?: { name?: string } | null;
}, preparedBy: string): SheReport {
  const title = row.employee?.fullName || row.campaignTitle || 'Health record';
  return {
    kind: 'Occupational health record',
    reference: row.referenceCode ?? 'Health record',
    title,
    preparedBy,
    sections: [
      {
        title: '1. The record',
        blocks: [
          { kind: 'pair', leftLabel: 'Reference', left: row.referenceCode ?? '—', rightLabel: 'Type', right: words(row.recordType) },
          { kind: 'pair', leftLabel: 'Recorded', left: day(row.recordDate), rightLabel: 'Next review', right: day(row.nextReviewDate) },
          { kind: 'pair', leftLabel: 'Review', left: words(row.reviewState), rightLabel: 'Status', right: words(row.status) },
          place(row.region, row.district),
          { kind: 'pair', leftLabel: 'Person', left: row.employee?.fullName ?? '—', rightLabel: 'Clinician', right: row.clinician ?? '—' },
        ],
      },
      {
        title: '2. Result',
        blocks: [
          { kind: 'pair', leftLabel: 'Fitness', left: words(row.fitnessOutcome), rightLabel: 'Duty', right: words(row.duty) },
          { kind: 'text', text: row.restrictions ? `Restriction: ${row.restrictions}` : 'No restriction recorded.' },
          { kind: 'pair', leftLabel: 'Test', left: words(row.surveillanceTest), rightLabel: 'Agent', right: row.exposureAgent ?? '—' },
          { kind: 'pair', leftLabel: 'Reading', left: row.exposureReading ?? '—', rightLabel: 'Place', right: row.locationName ?? '—' },
          { kind: 'pair', leftLabel: 'Vaccine', left: row.vaccine ?? '—', rightLabel: 'Dose', right: row.dose ?? '—' },
          { kind: 'pair', leftLabel: 'Batch', left: row.batchNumber ?? '—', rightLabel: 'Attended', right: row.attendeeCount == null ? '—' : String(row.attendeeCount) },
          { kind: 'text', text: 'Clinical notes stay on the health record and are not printed in this report.' },
        ],
      },
    ],
  };
}
