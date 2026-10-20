import { AuditType, ISO_14001_CLAUSES, ISO_45001_CLAUSES } from '@ecg-she/shared';

export const AUDIT_METHODS = [
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'DOCUMENT_REVIEW', label: 'Document review' },
  { value: 'FIELD_VERIFICATION', label: 'Look at the site' },
] as const;

const REGULATORY = [
  'Electricity supply and wiring rules',
  'Environmental permit conditions',
  'Public safety and wayleave clearance',
  'Worker competence and authorisation',
];

const COMPANY = ['Company HSE manual'];

export function clausesFor(type: AuditType): string[] {
  if (type === AuditType.ISO_14001) return [...ISO_14001_CLAUSES];
  if (type === AuditType.REGULATORY) return REGULATORY;
  if (type === AuditType.EXTERNAL) return [...ISO_45001_CLAUSES.map((clause) => `ISO 45001 — ${clause}`), ...COMPANY];
  if (type === AuditType.INTERNAL) {
    return [
      ...ISO_45001_CLAUSES.map((clause) => `ISO 45001 — ${clause}`),
      ...ISO_14001_CLAUSES.map((clause) => `ISO 14001 — ${clause}`),
    ];
  }
  return [...ISO_45001_CLAUSES];
}

/** Pre-select the numbered subclauses. The broad headings stay available to add. */
export function defaultClauses(type: AuditType): string[] {
  const all = clausesFor(type);
  const detailed = all.filter((clause) => /\d\.\d/.test(clause));
  return detailed.length ? detailed : all;
}
