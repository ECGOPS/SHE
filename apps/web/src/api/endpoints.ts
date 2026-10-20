import type {
  DashboardTrendPoint,
  EscalationAction,
  EscalationEntityType,
  IssueScope,
  KpiSnapshot,
  PaginatedResult,
} from '@ecg-she/shared';
import { api, unwrap } from './client';

export interface EscalationDto {
  id: string;
  entityType: EscalationEntityType;
  entityId: string;
  entityReferenceCode?: string | null;
  action: EscalationAction;
  fromScope: IssueScope;
  toScope: IssueScope;
  fromUserId: string;
  fromUser?: { id: string; fullName?: string; email?: string } | null;
  toUserId?: string | null;
  toUser?: { id: string; fullName?: string; email?: string } | null;
  reason: string;
  regionId: string;
  districtId?: string | null;
  createdAt: string;
}

export interface RegionDto {
  id: string;
  name: string;
  code: string;
  districts?: DistrictDto[];
}
export interface DistrictDto {
  id: string;
  name: string;
  code: string;
  regionId: string;
}

export interface IncidentDto {
  id: string;
  referenceCode: string;
  title: string;
  description: string;
  type: string;
  severity: string;
  status: string;
  occurredAt: string;
  fatalities: number;
  injuredPersons: number;
  affectedPersons: number;
  estimatedCost: number;
  region?: RegionDto;
  district?: DistrictDto;
  reportedBy?: { id: string; fullName: string; email: string };
  investigatorId?: string | null;
  investigator?: { id: string; fullName: string; email?: string } | null;
  regionId?: string;
  districtId?: string | null;
  currentScope?: IssueScope;
  resolvedAt?: string | null;
  resolvedAtScope?: IssueScope | null;
  resolutionNotes?: string | null;
  witnesses?: Array<{
    id: string;
    fullName: string;
    contact?: string | null;
    role?: string | null;
    statement: string;
  }>;
  findings?: Array<{
    id: string;
    category: 'IMMEDIATE' | 'UNDERLYING' | 'ROOT' | 'CONTRIBUTING';
    description: string;
    recommendation?: string | null;
  }>;
  attachments?: Array<{
    id: string;
    kind: 'photo' | 'video' | 'document' | 'signature' | 'audio';
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    capturedLat?: number | null;
    capturedLng?: number | null;
  }>;
}

export interface NearMissDto {
  id: string;
  referenceCode: string;
  title: string;
  description: string;
  category: string;
  anonymous: boolean;
  status: string;
  occurredAt: string;
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  severityPotential?: string | null;
  immediateCause?: string | null;
  rootCause?: string | null;
  witnessStatement?: string | null;
  bodyPartAtRisk?: string | null;
  potentialInjuryNature?: string | null;
  region?: RegionDto;
  district?: DistrictDto | null;
  regionId?: string;
  districtId?: string | null;
  reportedBy?: { id: string; fullName: string } | null;
  investigatorId?: string | null;
  investigator?: { id: string; fullName: string } | null;
  currentScope?: IssueScope;
  resolvedAt?: string | null;
  resolvedAtScope?: IssueScope | null;
  resolutionNotes?: string | null;
  convertedIncidentId?: string | null;
  attachments?: Array<{ id: string; fileName: string; mimeType: string }>;
}

export interface HazardDto {
  id: string;
  referenceCode: string;
  title: string;
  description: string;
  category: string;
  status: string;
  peopleExposed?: boolean;
  immediateAction?: string | null;
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  likelihood?: string | null;
  severity?: string | null;
  riskScore?: number | null;
  riskClass?: string | null;
  existingControls?: string | null;
  controlHierarchy?: string | null;
  controlMeasures?: string | null;
  residualLikelihood?: string | null;
  residualSeverity?: string | null;
  residualRiskScore?: number | null;
  targetCompletionDate?: string | null;
  mitigationOwnerId?: string | null;
  mitigationOwner?: { id: string; fullName: string } | null;
  region?: RegionDto;
  district?: DistrictDto | null;
  regionId?: string;
  districtId?: string | null;
  reportedBy?: { id: string; fullName: string } | null;
  currentScope?: IssueScope;
  resolvedAt?: string | null;
  resolvedAtScope?: IssueScope | null;
  resolutionNotes?: string | null;
  attachments?: Array<{ id: string; fileName: string; mimeType: string }>;
}

export interface AnyRecord {
  id: string;
  referenceCode?: string;
  title?: string;
  status?: string;
  createdAt?: string;
  region?: RegionDto;
  district?: DistrictDto;
  [k: string]: unknown;
}

export const endpoints = {
  // ── Org ─────────────────────────────────────────────────────────────────
  regions: () => unwrap<RegionDto[]>(api.get('/organizations/regions')),
  districts: (regionId?: string) =>
    unwrap<DistrictDto[]>(api.get('/organizations/districts', { params: { regionId } })),

  // ── Dashboard ───────────────────────────────────────────────────────────
  kpis: () => unwrap<KpiSnapshot>(api.get('/dashboard/kpis')),
  trends: (days = 30) =>
    unwrap<DashboardTrendPoint[]>(api.get('/dashboard/trends', { params: { days } })),
  heatmap: () =>
    unwrap<{ regionId: string; regionName: string; count: number }[]>(
      api.get('/dashboard/heatmap'),
    ),

  // ── Incidents ───────────────────────────────────────────────────────────
  incidents: (params: Record<string, unknown> = {}) =>
    unwrap<PaginatedResult<IncidentDto>>(api.get('/incidents', { params })),
  incident: (id: string) => unwrap<IncidentDto>(api.get(`/incidents/${id}`)),
  incidentReport: (id: string) =>
    api.get(`/incidents/${id}/report`, { responseType: 'blob', timeout: 60_000 }),
  incidentAttachmentFile: (incidentId: string, attachmentId: string) =>
    api.get(`/incidents/${incidentId}/attachments/${attachmentId}/file`, { responseType: 'blob' }),
  createIncident: (body: Record<string, unknown>) =>
    unwrap<IncidentDto>(api.post('/incidents', body)),
  incidentAssignees: (id: string) =>
    unwrap<Array<{ id: string; fullName: string; role: string }>>(api.get(`/incidents/${id}/assignees`)),
  addIncidentWitness: (id: string, body: Record<string, unknown>) =>
    unwrap<IncidentDto>(api.post(`/incidents/${id}/witnesses`, body)),
  addIncidentFinding: (id: string, body: Record<string, unknown>) =>
    unwrap<IncidentDto>(api.post(`/incidents/${id}/findings`, body)),
  assignIncident: (id: string, investigatorId: string) =>
    unwrap<IncidentDto>(api.post(`/incidents/${id}/assign`, { investigatorId })),
  submitIncident: (id: string) => unwrap<IncidentDto>(api.post(`/incidents/${id}/submit`)),
  closeIncident: (id: string) => unwrap<IncidentDto>(api.post(`/incidents/${id}/close`)),
  syncIncidents: (items: Record<string, unknown>[]) =>
    unwrap<{ accepted: string[]; conflicts: string[] }>(
      api.post('/incidents/sync', { items }),
    ),

  // ── Near Miss ───────────────────────────────────────────────────────────
  nearMiss: (params: Record<string, unknown> = {}) =>
    unwrap<PaginatedResult<NearMissDto>>(api.get('/near-miss', { params })),
  nearMissOne: (id: string) => unwrap<NearMissDto>(api.get(`/near-miss/${id}`)),
  nearMissReport: (id: string) =>
    api.get(`/near-miss/${id}/report`, { responseType: 'blob', timeout: 60_000 }),
  createNearMiss: (body: Record<string, unknown>) =>
    unwrap<NearMissDto>(api.post('/near-miss', body)),
  nearMissAssignees: (id: string) =>
    unwrap<Array<{ id: string; fullName: string; role: string }>>(api.get(`/near-miss/${id}/assignees`)),
  reviewNearMiss: (id: string, body: Record<string, unknown>) =>
    unwrap<NearMissDto>(api.patch(`/near-miss/${id}/review`, body)),
  assignNearMiss: (id: string, investigatorId: string) =>
    unwrap<NearMissDto>(api.post(`/near-miss/${id}/assign`, { investigatorId })),
  closeNearMiss: (id: string, notes: string, noFurtherAction = false) =>
    unwrap<NearMissDto>(api.post(`/near-miss/${id}/close`, { notes, noFurtherAction })),
  nearMissAttachmentFile: (nearMissId: string, attachmentId: string) =>
    api.get(`/near-miss/${nearMissId}/attachments/${attachmentId}/file`, { responseType: 'blob' }),

  // ── Hazards ─────────────────────────────────────────────────────────────
  hazards: (params: Record<string, unknown> = {}) =>
    unwrap<PaginatedResult<HazardDto>>(api.get('/hazards', { params })),
  hazardOne: (id: string) => unwrap<HazardDto>(api.get(`/hazards/${id}`)),
  hazardReport: (id: string) =>
    api.get(`/hazards/${id}/report`, { responseType: 'blob', timeout: 60_000 }),
  hazardStats: () => unwrap<Record<string, number>>(api.get('/hazards/stats')),
  createHazard: (body: Record<string, unknown>) =>
    unwrap<HazardDto>(api.post('/hazards', body)),
  hazardAssignees: (id: string) =>
    unwrap<Array<{ id: string; fullName: string; role: string }>>(api.get(`/hazards/${id}/assignees`)),
  reviewHazard: (id: string, body: Record<string, unknown>) =>
    unwrap<HazardDto>(api.patch(`/hazards/${id}/review`, body)),
  closeHazard: (id: string, notes: string, noFurtherAction = false) =>
    unwrap<HazardDto>(api.post(`/hazards/${id}/close`, { notes, noFurtherAction })),
  hazardAttachmentFile: (hazardId: string, attachmentId: string) =>
    api.get(`/hazards/${hazardId}/attachments/${attachmentId}/file`, { responseType: 'blob' }),

  // ── JSA ─────────────────────────────────────────────────────────────────
  jsa: (params: Record<string, unknown> = {}) =>
    unwrap<PaginatedResult<AnyRecord>>(api.get('/jsa', { params })),
  jsaOne: (id: string) => unwrap<AnyRecord>(api.get(`/jsa/${id}`)),
  jsaReport: (id: string) =>
    api.get(`/jsa/${id}/report`, { responseType: 'blob', timeout: 60_000 }),
  jsaPeople: () => unwrap<Array<{ id: string; fullName: string; role: string }>>(api.get('/jsa/people')),
  createJsa: (body: Record<string, unknown>) =>
    unwrap<AnyRecord>(api.post('/jsa', body)),
  updateJsa: (id: string, body: Record<string, unknown>) =>
    unwrap<AnyRecord>(api.patch(`/jsa/${id}`, body)),
  submitJsa: (id: string) => unwrap<AnyRecord>(api.post(`/jsa/${id}/submit`)),
  approveJsa: (id: string) => unwrap<AnyRecord>(api.post(`/jsa/${id}/approve`)),
  rejectJsa: (id: string, notes: string) => unwrap<AnyRecord>(api.post(`/jsa/${id}/reject`, { notes })),
  reviseJsa: (id: string) => unwrap<AnyRecord>(api.post(`/jsa/${id}/revise`)),

  // ── PTW ─────────────────────────────────────────────────────────────────
  ptw: (params: Record<string, unknown> = {}) =>
    unwrap<PaginatedResult<AnyRecord>>(api.get('/ptw', { params })),
  ptwOne: (id: string) => unwrap<AnyRecord>(api.get(`/ptw/${id}`)),
  ptwReport: (id: string) =>
    api.get(`/ptw/${id}/report`, { responseType: 'blob', timeout: 60_000 }),
  ptwPeople: () => unwrap<Array<{ id: string; fullName: string; role: string }>>(api.get('/ptw/people')),
  createPtw: (body: Record<string, unknown>) =>
    unwrap<AnyRecord>(api.post('/ptw', body)),
  issuePtw: (id: string) => unwrap<AnyRecord>(api.post(`/ptw/${id}/issue`)),
  rejectPtw: (id: string, notes: string) => unwrap<AnyRecord>(api.post(`/ptw/${id}/reject`, { notes })),
  revisePtw: (id: string) => unwrap<AnyRecord>(api.post(`/ptw/${id}/revise`)),
  acceptPtw: (id: string) => unwrap<AnyRecord>(api.post(`/ptw/${id}/accept`)),
  suspendPtw: (id: string, notes: string) => unwrap<AnyRecord>(api.post(`/ptw/${id}/suspend`, { notes })),
  resumePtw: (id: string) => unwrap<AnyRecord>(api.post(`/ptw/${id}/resume`)),
  handbackPtw: (id: string, notes: string) => unwrap<AnyRecord>(api.post(`/ptw/${id}/handback`, { notes })),
  closePtw: (id: string) => unwrap<AnyRecord>(api.post(`/ptw/${id}/close`)),
  recordGasTest: (id: string, body: Record<string, unknown>) =>
    unwrap<AnyRecord>(api.post(`/ptw/${id}/gas-test`, body)),

  // ── Inspections ─────────────────────────────────────────────────────────
  inspections: (params: Record<string, unknown> = {}) =>
    unwrap<PaginatedResult<AnyRecord>>(api.get('/inspections', { params })),
  inspection: (id: string) => unwrap<AnyRecord>(api.get(`/inspections/${id}`)),
  inspectionReport: (id: string) =>
    api.get(`/inspections/${id}/report`, { responseType: 'blob', timeout: 60_000 }),
  createInspection: (body: Record<string, unknown>) =>
    unwrap<AnyRecord>(api.post('/inspections', body)),
  updateInspectionItems: (id: string, items: unknown[]) =>
    unwrap<AnyRecord>(api.patch(`/inspections/${id}/items`, { items })),
  closeInspection: (id: string) => unwrap<AnyRecord>(api.post(`/inspections/${id}/close`)),
  inspectionAttachmentFile: (inspectionId: string, attachmentId: string) =>
    api.get(`/inspections/${inspectionId}/attachments/${attachmentId}/file`, { responseType: 'blob' }),

  // ── Audits ──────────────────────────────────────────────────────────────
  audits: (params: Record<string, unknown> = {}) =>
    unwrap<PaginatedResult<AnyRecord>>(api.get('/audits', { params })),
  audit: (id: string) => unwrap<AnyRecord>(api.get(`/audits/${id}`)),
  auditReport: (id: string) =>
    api.get(`/audits/${id}/report`, { responseType: 'blob', timeout: 60_000 }),
  auditPeople: () => unwrap<Array<{ id: string; fullName: string; role: string }>>(api.get('/audits/people')),
  createAudit: (body: Record<string, unknown>) =>
    unwrap<AnyRecord>(api.post('/audits', body)),
  startAudit: (id: string) => unwrap<AnyRecord>(api.post(`/audits/${id}/start`)),
  saveAuditChecklist: (id: string, checklist: Array<{ clause: string; result?: string; evidence?: string; severity?: string }>) =>
    unwrap<AnyRecord>(api.patch(`/audits/${id}/checklist`, {
      checklist: checklist.map(({ clause, result, evidence, severity }) => ({ clause, result, evidence, severity })),
    })),
  reportAudit: (id: string) => unwrap<AnyRecord>(api.post(`/audits/${id}/report`)),
  respondAuditFinding: (id: string, findingId: string, notes: string) =>
    unwrap<AnyRecord>(api.post(`/audits/${id}/findings/${findingId}/response`, { notes })),
  linkAuditFinding: (id: string, findingId: string, capaId: string) =>
    unwrap<AnyRecord>(api.post(`/audits/${id}/findings/${findingId}/action`, { capaId })),
  closeAudit: (id: string) =>
    unwrap<AnyRecord>(api.post(`/audits/${id}/close`)),

  // ── Environmental ───────────────────────────────────────────────────────
  envEvents: (params: Record<string, unknown> = {}) =>
    unwrap<PaginatedResult<AnyRecord>>(api.get('/environmental', { params })),
  envEvent: (id: string) => unwrap<AnyRecord>(api.get(`/environmental/${id}`)),
  envReport: (id: string) =>
    api.get(`/environmental/${id}/report`, { responseType: 'blob', timeout: 60_000 }),
  createEnvEvent: (body: Record<string, unknown>) =>
    unwrap<AnyRecord>(api.post('/environmental', body)),
  containEnvEvent: (id: string, containmentActions: string) =>
    unwrap<AnyRecord>(api.patch(`/environmental/${id}/containment`, { containmentActions })),
  recordEnvWaste: (id: string, body: { wasteContractor: string; disposalSite: string; waybillNumber: string }) =>
    unwrap<AnyRecord>(api.patch(`/environmental/${id}/waste`, body)),
  addEnvPhotos: (id: string, photos: Array<{ fileName: string; mimeType: string; dataUrl: string }>) =>
    unwrap<AnyRecord>(api.post(`/environmental/${id}/photos`, { photos })),
  envAttachmentFile: (eventId: string, attachmentId: string) =>
    api.get(`/environmental/${eventId}/attachments/${attachmentId}/file`, { responseType: 'blob' }),
  assessEnvEvent: (id: string, body: Record<string, unknown>) =>
    unwrap<AnyRecord>(api.patch(`/environmental/${id}/assess`, body)),
  closeEnvEvent: (id: string, notes: string, noFurtherAction = false) =>
    unwrap<AnyRecord>(api.post(`/environmental/${id}/close`, { notes: notes || undefined, noFurtherAction })),
  reopenEnvEvent: (id: string) => unwrap<AnyRecord>(api.post(`/environmental/${id}/reopen`)),

  // ── Health ──────────────────────────────────────────────────────────────
  health: (params: Record<string, unknown> = {}) =>
    unwrap<PaginatedResult<AnyRecord>>(api.get('/health', { params })),
  healthRecord: (id: string) => unwrap<AnyRecord>(api.get(`/health/${id}`)),
  healthReport: (id: string) =>
    api.get(`/health/${id}/report`, { responseType: 'blob', timeout: 60_000 }),
  healthPeople: () => unwrap<Array<{ id: string; fullName: string; role: string }>>(api.get('/health/people')),
  createHealth: (body: Record<string, unknown>) =>
    unwrap<AnyRecord>(api.post('/health', body)),

  // ── Training ────────────────────────────────────────────────────────────
  trainingCourses: (params: Record<string, unknown> = {}) =>
    unwrap<PaginatedResult<AnyRecord>>(api.get('/training/courses', { params })),
  trainingCourse: (id: string) => unwrap<AnyRecord>(api.get(`/training/courses/${id}`)),
  createTrainingCourse: (body: Record<string, unknown>) =>
    unwrap<AnyRecord>(api.post('/training/courses', body)),
  trainingDue: (params: Record<string, unknown> = {}) =>
    unwrap<PaginatedResult<AnyRecord>>(api.get('/training/due', { params })),
  trainingPeople: () => unwrap<Array<{ id: string; fullName: string; role: string }>>(api.get('/training/people')),
  trainingCompetence: (employeeId: string, duty: string) =>
    unwrap<{ required: boolean; state: string; courseTitle?: string; expiresOn?: string | null }>(
      api.get(`/training/competence/${employeeId}`, { params: { duty } }),
    ),
  recordTrainingClass: (body: Record<string, unknown>) =>
    unwrap<AnyRecord>(api.post('/training/classes', body)),
  trainingCertificate: (attendanceId: string) =>
    api.get(`/training/certificates/${attendanceId}/file`, { responseType: 'blob' }),

  // ── PPE ─────────────────────────────────────────────────────────────────
  ppeItems: (params: Record<string, unknown> = {}) =>
    unwrap<PaginatedResult<AnyRecord>>(api.get('/ppe/items', { params })),
  createPpeItem: (body: Record<string, unknown>) =>
    unwrap<AnyRecord>(api.post('/ppe/items', body)),
  ppeItem: (id: string) => unwrap<AnyRecord>(api.get(`/ppe/items/${id}`)),
  ppeDue: (params: Record<string, unknown> = {}) =>
    unwrap<PaginatedResult<AnyRecord>>(api.get('/ppe/due', { params })),
  ppePeople: () => unwrap<Array<{ id: string; fullName: string; role: string }>>(api.get('/ppe/people')),
  issuePpe: (body: Record<string, unknown>) => unwrap<{ id: string; ppeItemId: string }>(api.post('/ppe/issuance', body)),
  withdrawPpe: (id: string, body: Record<string, unknown>) =>
    unwrap<AnyRecord>(api.post(`/ppe/issuance/${id}/withdraw`, body)),
  ppeHolder: (employeeId: string, category: string) =>
    unwrap<{ required: boolean; state: string; itemName?: string; expiresOn?: string | null; nextTestOn?: string | null }>(
      api.get(`/ppe/holder/${employeeId}`, { params: { category } }),
    ),

  // ── CAPA ────────────────────────────────────────────────────────────────
  capa: (params: Record<string, unknown> = {}) =>
    unwrap<PaginatedResult<AnyRecord>>(api.get('/corrective-actions', { params })),
  capaStats: () =>
    unwrap<{ byStatus: Record<string, number>; overdue: number }>(
      api.get('/corrective-actions/stats'),
    ),
  createCapa: (body: Record<string, unknown>) =>
    unwrap<AnyRecord>(api.post('/corrective-actions', body)),
  capaOne: (id: string) => unwrap<AnyRecord>(api.get(`/corrective-actions/${id}`)),
  capaReport: (id: string) =>
    api.get(`/corrective-actions/${id}/report`, { responseType: 'blob', timeout: 60_000 }),
  capaPeople: () => unwrap<Array<{ id: string; fullName: string; role: string }>>(api.get('/corrective-actions/people')),
  updateCapaProgress: (id: string, body: Record<string, unknown>) =>
    unwrap<AnyRecord>(api.patch(`/corrective-actions/${id}/progress`, body)),
  verifyCapa: (id: string, body: Record<string, unknown>) =>
    unwrap<AnyRecord>(api.post(`/corrective-actions/${id}/verify`, body)),

  // ── Reports ─────────────────────────────────────────────────────────────
  reportRegisterExcel: (from?: string, to?: string) =>
    api.get('/reports/register/excel', { params: { from, to }, responseType: 'blob' }),
  reportRegisterPdf: (from?: string, to?: string) =>
    api.get('/reports/register/pdf', { params: { from, to }, responseType: 'blob' }),

  // ── Users (admin) ───────────────────────────────────────────────────────
  users: (search?: string) => unwrap<AnyRecord[]>(api.get('/users', { params: search ? { search } : {} })),
  user: (id: string) => unwrap<AnyRecord>(api.get(`/users/${id}`)),
  createUser: (body: Record<string, unknown>) =>
    unwrap<AnyRecord>(api.post('/users', body)),
  assignUser: (id: string, body: { role: string; regionId?: string | null; districtId?: string | null }) =>
    unwrap<AnyRecord>(api.patch(`/users/${id}/assignment`, body)),
  reauth: (password: string) => unwrap<{ accessToken: string }>(api.post('/auth/reauth', { password })),
  sessions: () => unwrap<Array<{ id: string; current: boolean; createdAt: string; lastSeenAt: string; ip: string | null; userAgent: string | null; unusual: boolean }>>(api.get('/auth/sessions')),
  revokeSession: (id: string) => unwrap<{ revoked: true }>(api.delete(`/auth/sessions/${id}`)),
  me: () => unwrap<AnyRecord>(api.get('/users/me')),

  // ── Escalations ─────────────────────────────────────────────────────────
  escalationHistory: (entityType: EscalationEntityType, entityId: string) =>
    unwrap<EscalationDto[]>(
      api.get('/escalations', { params: { entityType, entityId } }),
    ),
  escalateIssue: (body: {
    entityType: EscalationEntityType;
    entityId: string;
    reason: string;
    toScope?: IssueScope;
    toUserId?: string;
  }) => unwrap<EscalationDto>(api.post('/escalations/escalate', body)),
  referIssueDown: (body: {
    entityType: EscalationEntityType;
    entityId: string;
    reason: string;
    toScope?: IssueScope;
    toUserId?: string;
  }) => unwrap<EscalationDto>(api.post('/escalations/refer-down', body)),
  resolveIssue: (body: {
    entityType: EscalationEntityType;
    entityId: string;
    notes: string;
    noFurtherAction?: boolean;
  }) => unwrap<EscalationDto>(api.post('/escalations/resolve', body)),
  reopenIssue: (body: {
    entityType: EscalationEntityType;
    entityId: string;
    reason: string;
  }) => unwrap<EscalationDto>(api.post('/escalations/reopen', body)),

  // ── Notifications ───────────────────────────────────────────────────────
  notifications: () => unwrap<AnyRecord[]>(api.get('/notifications')),
  markNotificationRead: (id: string) =>
    unwrap<AnyRecord>(api.patch(`/notifications/${id}/read`)),

  // ── Generic helper ──────────────────────────────────────────────────────
  list: <T>(path: string) => unwrap<T>(api.get(path)),
  auditTrail: (params: Record<string, unknown> = {}) =>
    unwrap<PaginatedResult<AnyRecord>>(api.get('/audit-trail', { params })),

  managementSummary: () =>
    unwrap<{
      topics: Array<{ kind: string; clause: string; title: string; prompt: string; count: number }>;
      covered: Array<{ clause: string; title: string; where: string }>;
    }>(api.get('/management-system/summary')),
  managementRecords: (params: Record<string, unknown> = {}) =>
    unwrap<PaginatedResult<AnyRecord>>(api.get('/management-system', { params })),
  createManagementRecord: (body: Record<string, unknown>) =>
    unwrap<AnyRecord>(api.post('/management-system', body)),
  updateManagementRecord: (id: string, body: Record<string, unknown>) =>
    unwrap<AnyRecord>(api.patch(`/management-system/${id}`, body)),
};
