// ─────────────────────────────────────────────
// Domain enumerations shared by API and Web app
// ─────────────────────────────────────────────

export enum IncidentType {
  INJURY = 'INJURY',
  FATALITY = 'FATALITY',
  PROPERTY_DAMAGE = 'PROPERTY_DAMAGE',
  VEHICLE_ACCIDENT = 'VEHICLE_ACCIDENT',
  ELECTRICAL_SHOCK = 'ELECTRICAL_SHOCK',
  FIRE = 'FIRE',
  ENVIRONMENTAL = 'ENVIRONMENTAL',
  OTHER = 'OTHER',
}

export enum IncidentSeverity {
  NEGLIGIBLE = 'NEGLIGIBLE',
  MINOR = 'MINOR',
  MODERATE = 'MODERATE',
  MAJOR = 'MAJOR',
  CATASTROPHIC = 'CATASTROPHIC',
}

export enum IncidentStatus {
  DRAFT = 'DRAFT',
  REPORTED = 'REPORTED',
  UNDER_INVESTIGATION = 'UNDER_INVESTIGATION',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  CLOSED = 'CLOSED',
  REJECTED = 'REJECTED',
}

export enum HazardCategory {
  ELECTRICAL = 'ELECTRICAL',
  MECHANICAL = 'MECHANICAL',
  CHEMICAL = 'CHEMICAL',
  ERGONOMIC = 'ERGONOMIC',
  BIOLOGICAL = 'BIOLOGICAL',
  PHYSICAL = 'PHYSICAL',
  PSYCHOSOCIAL = 'PSYCHOSOCIAL',
  ENVIRONMENTAL = 'ENVIRONMENTAL',
}

export enum NearMissCategory {
  UNSAFE_ACT = 'UNSAFE_ACT',
  UNSAFE_CONDITION = 'UNSAFE_CONDITION',
  POTENTIAL_INCIDENT = 'POTENTIAL_INCIDENT',
}

export enum PermitType {
  ELECTRICAL = 'ELECTRICAL',
  HOT_WORK = 'HOT_WORK',
  EXCAVATION = 'EXCAVATION',
  CONFINED_SPACE = 'CONFINED_SPACE',
  WORKING_AT_HEIGHT = 'WORKING_AT_HEIGHT',
  ISOLATION = 'ISOLATION',
}

export enum PermitStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CLOSED = 'CLOSED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export enum InspectionType {
  SUBSTATION = 'SUBSTATION',
  OFFICE = 'OFFICE',
  VEHICLE = 'VEHICLE',
  TRANSFORMER = 'TRANSFORMER',
  LINE = 'LINE',
  PPE = 'PPE',
  GENERAL = 'GENERAL',
}

export enum AuditType {
  INTERNAL = 'INTERNAL',
  EXTERNAL = 'EXTERNAL',
  ISO_45001 = 'ISO_45001',
  ISO_14001 = 'ISO_14001',
  REGULATORY = 'REGULATORY',
}

export enum AuditStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  REPORTING = 'REPORTING',
  CLOSED = 'CLOSED',
}

export enum CorrectiveActionStatus {
  OPEN = 'OPEN',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  VERIFICATION = 'VERIFICATION',
  CLOSED = 'CLOSED',
  OVERDUE = 'OVERDUE',
  REJECTED = 'REJECTED',
}

export enum EnvironmentalEventType {
  OIL_SPILL = 'OIL_SPILL',
  WASTE_DISPOSAL = 'WASTE_DISPOSAL',
  POLLUTION = 'POLLUTION',
  NOISE = 'NOISE',
  EMISSION = 'EMISSION',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  IN_APP = 'IN_APP',
  PUSH = 'PUSH',
}

export enum SyncStatus {
  SYNCED = 'SYNCED',
  PENDING = 'PENDING',
  CONFLICT = 'CONFLICT',
  FAILED = 'FAILED',
}

/**
 * The three escalation tiers used by the SHE issue-escalation ladder.
 * District officers handle issues in their district, escalate to Regional
 * if it's beyond their authority, and Regional escalates to Head Office
 * for nationally-significant issues.
 */
export enum IssueScope {
  DISTRICT = 'DISTRICT',
  REGIONAL = 'REGIONAL',
  HEAD_OFFICE = 'HEAD_OFFICE',
}

export const ISSUE_SCOPE_LADDER: IssueScope[] = [
  IssueScope.DISTRICT,
  IssueScope.REGIONAL,
  IssueScope.HEAD_OFFICE,
];

/** Friendly label used in the UI. */
export const ISSUE_SCOPE_LABEL: Record<IssueScope, string> = {
  [IssueScope.DISTRICT]: 'District',
  [IssueScope.REGIONAL]: 'Region',
  [IssueScope.HEAD_OFFICE]: 'Head Office',
};

export enum EscalationAction {
  /** Move the issue to a higher tier (district → regional, regional → HQ). */
  ESCALATE = 'ESCALATE',
  /** Send the issue back down to a lower tier for further investigation. */
  REFER_DOWN = 'REFER_DOWN',
  /** Close the issue at the current tier with resolution notes. */
  RESOLVE = 'RESOLVE',
  /** Reverse a previous resolution. */
  REOPEN = 'REOPEN',
  /** Hand the issue off to another user at the same tier. */
  REASSIGN = 'REASSIGN',
}

/** Module the escalation row is anchored to. Used as a discriminator. */
export enum EscalationEntityType {
  INCIDENT = 'INCIDENT',
  HAZARD = 'HAZARD',
  NEAR_MISS = 'NEAR_MISS',
  CAPA = 'CAPA',
}

/**
 * 5×5 risk matrix scoring used by Hazards, JSA and Risk Assessments.
 * Risk score = likelihood × severity.
 */
export const RISK_LIKELIHOOD = ['RARE', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'ALMOST_CERTAIN'] as const;
export const RISK_SEVERITY = [
  'NEGLIGIBLE',
  'MINOR',
  'MODERATE',
  'MAJOR',
  'CATASTROPHIC',
] as const;

export type RiskLikelihood = (typeof RISK_LIKELIHOOD)[number];
export type RiskSeverity = (typeof RISK_SEVERITY)[number];

export function computeRiskScore(l: RiskLikelihood, s: RiskSeverity): number {
  return (RISK_LIKELIHOOD.indexOf(l) + 1) * (RISK_SEVERITY.indexOf(s) + 1);
}

export function classifyRisk(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
  if (score <= 4) return 'LOW';
  if (score <= 9) return 'MEDIUM';
  if (score <= 16) return 'HIGH';
  return 'EXTREME';
}

// ─────────────────────────────────────────────
// International standards reference data
//
// These constants underpin module form validation and reporting so that the
// platform produces records aligned with the standards we cite (ISO 45001,
// ISO 14001, ISO 19011, ISO 31000, ISO 9001, OSHA 301/JHA, IOGP 189,
// EN ISO 20471, ILO OSH 2001).
// ─────────────────────────────────────────────

/**
 * NIOSH / ISO 45001 §8.1.2 hierarchy of controls — most → least effective.
 * Used by Hazards and JSA to record the chosen control mechanism.
 */
export const CONTROL_HIERARCHY = [
  'ELIMINATION',
  'SUBSTITUTION',
  'ENGINEERING',
  'ADMINISTRATIVE',
  'PPE',
] as const;
export type ControlHierarchy = (typeof CONTROL_HIERARCHY)[number];

/** ISO 45001:2018 clause titles used as audit criteria. The short titles are the criteria, not the text of the standard. */
export const ISO_45001_CLAUSES = [
  '4 Context of the organisation',
  '4.1 Context',
  '4.2 Workers and other interested parties',
  '4.3 Scope of the management system',
  '5 Leadership and worker participation',
  '5.2 OH&S policy',
  '5.3 Roles, responsibilities and authorities',
  '5.4 Consultation and participation of workers',
  '6 Planning',
  '6.1.2 Hazard identification and assessment of risks',
  '6.1.3 Legal and other requirements',
  '6.2 OH&S objectives',
  '7 Support',
  '7.2 Competence',
  '7.4 Communication',
  '7.5 Documented information',
  '8 Operation',
  '8.1 Operational planning and control',
  '8.1.2 Hierarchy of controls',
  '8.1.3 Management of change',
  '8.1.4 Procurement and contractors',
  '8.2 Emergency preparedness and response',
  '9 Performance evaluation',
  '9.1 Monitoring, measurement, analysis and evaluation',
  '9.1.2 Evaluation of compliance',
  '9.2 Internal audit',
  '9.3 Management review',
  '10 Improvement',
  '10.2 Incident, nonconformity and corrective action',
] as const;

/** ISO 14001:2015 clause titles used as audit criteria. The short titles are the criteria, not the text of the standard. */
export const ISO_14001_CLAUSES = [
  '4 Context of the organisation',
  '4.1 Context',
  '4.2 Interested parties',
  '4.3 Scope of the environmental management system',
  '5 Leadership',
  '5.2 Environmental policy',
  '6 Planning',
  '6.1.2 Environmental aspects',
  '6.1.3 Compliance obligations',
  '6.2 Environmental objectives',
  '7 Support',
  '7.2 Competence',
  '8 Operation',
  '8.1 Operational planning and control',
  '8.2 Emergency preparedness and response',
  '9 Performance evaluation',
  '9.1.1 Monitoring, measurement, analysis and evaluation',
  '9.1.2 Evaluation of compliance',
  '9.2 Internal audit',
  '9.3 Management review',
  '10 Improvement',
  '10.2 Nonconformity and corrective action',
] as const;

export const MANAGEMENT_RECORD_KIND = [
  'POLICY',
  'SCOPE',
  'INTERESTED_PARTY',
  'OBLIGATION',
  'OBJECTIVE',
  'ASPECT',
  'CHANGE',
  'EMERGENCY',
  'REVIEW',
  'CONSULTATION',
  'CONTRACTOR',
] as const;
export type ManagementRecordKind = (typeof MANAGEMENT_RECORD_KIND)[number];

export const MANAGEMENT_STANDARD = ['OH_S', 'ENVIRONMENT', 'BOTH'] as const;
export type ManagementStandard = (typeof MANAGEMENT_STANDARD)[number];

export const COMPLIANCE_RESULT = ['NOT_EVALUATED', 'COMPLIANT', 'PARTIAL', 'NONCOMPLIANT'] as const;
export type ComplianceResult = (typeof COMPLIANCE_RESULT)[number];

/**
 * ISO 14001 §6.1.2 environmental aspect categories — what an activity
 * interacts with.
 */
export const ENVIRONMENTAL_ASPECT = [
  'AIR_EMISSION',
  'WATER_DISCHARGE',
  'WASTE_GENERATION',
  'LAND_CONTAMINATION',
  'RESOURCE_USE',
  'NOISE',
  'BIODIVERSITY',
] as const;
export type EnvironmentalAspect = (typeof ENVIRONMENTAL_ASPECT)[number];

/**
 * ISO 14001 §6.1.2 environmental impact — the change resulting from an
 * aspect.
 */
export const ENVIRONMENTAL_IMPACT = [
  'AIR_QUALITY_DEGRADATION',
  'WATER_POLLUTION',
  'SOIL_CONTAMINATION',
  'CLIMATE_CHANGE',
  'RESOURCE_DEPLETION',
  'ECOSYSTEM_DAMAGE',
  'COMMUNITY_DISTURBANCE',
] as const;
export type EnvironmentalImpact = (typeof ENVIRONMENTAL_IMPACT)[number];

/**
 * OSHA Form 301 — body part affected (subset, common to electrical
 * utilities). Used in incident / near-miss potential-injury fields.
 */
export const BODY_PART_AFFECTED = [
  'HEAD',
  'EYE',
  'FACE',
  'NECK',
  'SHOULDER',
  'BACK',
  'CHEST',
  'ARM',
  'HAND',
  'FINGER',
  'HIP',
  'LEG',
  'KNEE',
  'FOOT',
  'INTERNAL',
  'WHOLE_BODY',
] as const;

/** OSHA Form 301 — nature of injury / illness. */
export const NATURE_OF_INJURY = [
  'AMPUTATION',
  'ABRASION',
  'BRUISE',
  'BURN_THERMAL',
  'BURN_CHEMICAL',
  'BURN_ELECTRICAL',
  'CUT_LACERATION',
  'CONCUSSION',
  'ELECTROCUTION',
  'FRACTURE',
  'HEARING_LOSS',
  'POISONING',
  'PUNCTURE',
  'SPRAIN_STRAIN',
  'OTHER',
] as const;

/**
 * ICAM / TapRoot / 5-Why / Bowtie / Fishbone — root-cause analysis methods
 * recognised by ISO 9001 §10.2 and ISO 45001 §10.2 corrective-action
 * processes.
 */
export const ROOT_CAUSE_METHOD = [
  'FIVE_WHY',
  'FISHBONE',
  'TAPROOT',
  'ICAM',
  'BOWTIE',
  'FAULT_TREE',
] as const;
export type RootCauseMethod = (typeof ROOT_CAUSE_METHOD)[number];

/** ICAM-style severity potential for near-misses (HSE worst-credible-loss). */
export const SEVERITY_POTENTIAL = [
  'NEGLIGIBLE',
  'MINOR',
  'MODERATE',
  'MAJOR',
  'CATASTROPHIC',
] as const;
export type SeverityPotential = (typeof SEVERITY_POTENTIAL)[number];

/**
 * IOGP Report 189 — Permit-To-Work standard roles.
 * APPLICANT raises the permit; ISSUER authorises it; HOLDER executes it on
 * site; AUTHORISING_MANAGER approves high-risk permits.
 */
export const PERMIT_ROLE = [
  'APPLICANT',
  'ISSUER',
  'HOLDER',
  'AUTHORISING_MANAGER',
] as const;

/** IOGP 189 isolation methods. */
export const ISOLATION_METHOD = [
  'ELECTRICAL_LOTO',
  'MECHANICAL_BLIND',
  'VALVE_LOCK',
  'DRAIN_VENT',
  'NONE',
] as const;

/** ILO/ISO 45001 §7.2 / §9.2 occupational-health record types. */
export const HEALTH_RECORD_TYPE = [
  'MEDICAL_SURVEILLANCE',
  'EXPOSURE_MONITORING',
  'FITNESS_FOR_DUTY',
  'VACCINATION',
  'CAMPAIGN',
] as const;

/** Fitness-for-duty outcomes (ILO/WHO occupational medicine). */
export const FITNESS_OUTCOME = [
  'FIT',
  'FIT_WITH_RESTRICTIONS',
  'TEMPORARILY_UNFIT',
  'PERMANENTLY_UNFIT',
] as const;

/** The job a fitness certificate clears the worker to do. */
export const HEALTH_DUTY = ['CLIMBING', 'LIVE_LINE', 'DRIVING', 'SUBSTATION', 'GENERAL'] as const;

/** The authorization a permit needs from the training register. */
export function dutyForPermit(type: string): (typeof HEALTH_DUTY)[number] | null {
  if (type === 'WORKING_AT_HEIGHT') return 'CLIMBING';
  if (type === 'ELECTRICAL' || type === 'ISOLATION') return 'LIVE_LINE';
  return null;
}

/** The PPE a permit holder must have on issue. */
export function ppeForPermit(type: string): 'FALL_PROTECTION' | 'INSULATING' | null {
  if (type === 'WORKING_AT_HEIGHT') return 'FALL_PROTECTION';
  if (type === 'ELECTRICAL' || type === 'ISOLATION') return 'INSULATING';
  return null;
}

/** Tests used for ongoing medical surveillance of utility crews. */
export const SURVEILLANCE_TEST = ['AUDIOMETRY', 'VISION', 'SPIROMETRY', 'BLOOD_PRESSURE', 'MANUAL_HANDLING'] as const;

/** Vaccines a field crew is expected to hold. */
export const VACCINE = ['HEPATITIS_B', 'TETANUS', 'YELLOW_FEVER', 'TYPHOID', 'OTHER'] as const;

export const VACCINE_DOSE = ['DOSE_1', 'DOSE_2', 'DOSE_3', 'BOOSTER'] as const;

/** Common occupational exposure agents (ISO 45001 §6.1.2). */
export const EXPOSURE_AGENT = [
  'NOISE',
  'VIBRATION',
  'HEAT',
  'COLD',
  'CHEMICAL',
  'BIOLOGICAL',
  'RADIATION_IONISING',
  'RADIATION_NON_IONISING',
  'ELECTROMAGNETIC_FIELD',
  'ERGONOMIC',
  'PSYCHOSOCIAL',
] as const;

/**
 * EN-numbered standards relevant to electricity-utility PPE.
 * (CE / UKCA marking references.)
 */
export const PPE_EN_STANDARDS = [
  'EN 397 (Industrial helmet)',
  'EN 50365 (Electrically insulating helmet)',
  'EN 166 (Eye protection)',
  'EN 60903 (Insulating gloves)',
  'EN 388 (Mechanical hand protection)',
  'EN ISO 20345 (Safety footwear)',
  'EN ISO 20471 (High-visibility clothing)',
  'EN 61482 (Arc-flash clothing)',
  'EN 363 (Fall arrest)',
  'EN 149 (Filtering half mask)',
] as const;

/** ANSI/ASTM standards (US-style) common in utility PPE specs. */
export const PPE_ANSI_STANDARDS = [
  'ANSI Z89.1 (Hard hat)',
  'ANSI Z87.1 (Eye/face)',
  'ANSI/ISEA 105 (Hand protection)',
  'ANSI/ISEA 107 (High-visibility)',
  'ASTM F2178 (Arc-rated face shield)',
  'ASTM F1959 (Arc-rated fabric ATPV)',
  'ASTM F496 (Insulating gloves in service)',
  'ANSI Z359 (Fall protection)',
] as const;

/** NFPA 70E arc-flash PPE categories. */
export const NFPA_70E_PPE_CATEGORY = ['CAT_1', 'CAT_2', 'CAT_3', 'CAT_4'] as const;

/** Inspection weather conditions (utility lineman context). */
export const WEATHER_CONDITION = [
  'CLEAR',
  'CLOUDY',
  'RAIN',
  'STORM',
  'FOG',
  'WINDY',
  'EXTREME_HEAT',
] as const;

/** ISO 19011 audit type categories (more granular than the AuditType enum). */
export const AUDIT_CRITERIA_FRAMEWORK = [
  'ISO_45001',
  'ISO_14001',
  'ISO_9001',
  'ISO_50001',
  'ISO_27001',
  'OHSAS_18001',
  'COMPANY_HSE_MS',
  'REGULATORY_NATIONAL',
] as const;
