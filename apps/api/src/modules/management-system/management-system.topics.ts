/** Registers the application did not already keep, mapped to the clause each one evidences. */
export const MANAGEMENT_TOPICS = [
  {
    kind: 'POLICY',
    clause: 'ISO 45001 5.2 and ISO 14001 5.2',
    title: 'Policy',
    prompt: 'Record the approved safety policy and the approved environmental policy, who approved them, and the date.',
  },
  {
    kind: 'SCOPE',
    clause: 'ISO 45001 4.3 and ISO 14001 4.3',
    title: 'Scope',
    prompt: 'Record what the management system covers, which places and activities are in, and what is outside it.',
  },
  {
    kind: 'INTERESTED_PARTY',
    clause: 'ISO 45001 4.2 and ISO 14001 4.2',
    title: 'Interested parties',
    prompt: 'Record a worker group, contractor, regulator, or community, and what they need from ECG.',
  },
  {
    kind: 'OBLIGATION',
    clause: 'ISO 45001 6.1.3 and ISO 14001 6.1.3',
    title: 'Legal and other requirements',
    prompt: 'Record one law, permit, or other requirement, and whether ECG currently meets it.',
  },
  {
    kind: 'OBJECTIVE',
    clause: 'ISO 45001 6.2 and ISO 14001 6.2',
    title: 'Objectives',
    prompt: 'Record one measurable safety or environmental objective, the owner, and the date it is due.',
  },
  {
    kind: 'ASPECT',
    clause: 'ISO 14001 6.1.2',
    title: 'Environmental aspects',
    prompt: 'Record an activity, the aspect, the impact, and whether it is significant.',
  },
  {
    kind: 'CHANGE',
    clause: 'ISO 45001 8.1.3',
    title: 'Management of change',
    prompt: 'Record a change to plant, method, or people, and the safety and environmental checks made before it.',
  },
  {
    kind: 'EMERGENCY',
    clause: 'ISO 45001 8.2 and ISO 14001 8.2',
    title: 'Emergency preparedness',
    prompt: 'Record an emergency plan or a drill, including the date it was tested.',
  },
  {
    kind: 'REVIEW',
    clause: 'ISO 45001 9.3 and ISO 14001 9.3',
    title: 'Management review',
    prompt: 'Record the review date, the inputs that were considered, and the decisions taken.',
  },
  {
    kind: 'CONSULTATION',
    clause: 'ISO 45001 5.4',
    title: 'Worker consultation',
    prompt: 'Record how workers were consulted or participated, or file a worker’s own concern.',
  },
  {
    kind: 'CONTRACTOR',
    clause: 'ISO 45001 8.1.4 and ISO 14001 8.1',
    title: 'Contractors',
    prompt: 'Record an outsourced activity and the safety and environmental controls agreed with the contractor.',
  },
] as const;

/** Requirements already evidenced by another register in this application. */
export const MANAGEMENT_COVERED = [
  { clause: 'ISO 45001 6.1.2', title: 'Hazard identification and risk', where: 'Hazards and job safety analysis' },
  { clause: 'ISO 45001 8.1.2', title: 'Hierarchy of controls', where: 'Hazards and job safety analysis' },
  { clause: 'ISO 45001 8.1 and ISO 14001 8.1', title: 'Operational control', where: 'Permits to work, inspections, and PPE' },
  { clause: 'ISO 45001 7.2 and ISO 14001 7.2', title: 'Competence', where: 'Training' },
  { clause: 'ISO 45001 10.2 and ISO 14001 10.2', title: 'Incidents and corrective action', where: 'Incidents, near misses, audits, and corrective actions' },
  { clause: 'ISO 45001 9.1 and ISO 14001 9.1', title: 'Monitoring and measurement', where: 'Inspections, the dashboard, and reports' },
  { clause: 'ISO 45001 9.2 and ISO 14001 9.2', title: 'Internal audit', where: 'Audits, including the clause checklist' },
  { clause: 'ISO 45001 8.1 and occupational health', title: 'Health surveillance', where: 'Occupational health' },
  { clause: 'ISO 14001 8.2 response', title: 'Environmental events', where: 'Environmental events, including aspect, impact, and regulator notification' },
  { clause: 'ISO 45001 7.5 and ISO 14001 7.5', title: 'Documented information', where: 'The registers and the audit trail' },
] as const;
