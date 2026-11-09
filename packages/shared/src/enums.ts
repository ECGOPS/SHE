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
  'CONTEXT',
  'INTERESTED_PARTY',
  'OBLIGATION',
  'OBJECTIVE',
  'ASPECT',
  'DOCUMENT',
  'COMMUNICATION',
  'MONITORING',
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

export const DOCUMENT_STATUS = ['DRAFT', 'CURRENT', 'SUPERSEDED'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUS)[number];

export const ISSUE_ORIGIN = ['INTERNAL', 'EXTERNAL'] as const;
export type IssueOrigin = (typeof ISSUE_ORIGIN)[number];

export const PROTOCOL_LINK_KIND = ['DOCUMENT', 'JSA', 'HAZARD', 'RISK_ASSESSMENT', 'CHANGE'] as const;
export type ProtocolLinkKind = (typeof PROTOCOL_LINK_KIND)[number];

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

/** ECG Risk Assessment Form — overall control conclusion. */
export const RISK_ASSESSMENT_CONTROL_STATUS = [
  'ADEQUATELY_CONTROLLED',
  'INADEQUATELY_CONTROLLED',
] as const;
export type RiskAssessmentControlStatus = (typeof RISK_ASSESSMENT_CONTROL_STATUS)[number];

export enum RiskAssessmentStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/** Who may be harmed — ECG Risk Assessment Form. */
export const RISK_ASSESSMENT_PERSONS_AT_RISK = [
  'ECG_EMPLOYEE',
  'VISITORS',
  'CONTRACTOR_SITE_WORKERS',
  'DRIVERS',
  'GENERAL_PUBLIC',
  'CUSTOMERS',
] as const;
export type RiskAssessmentPersonAtRisk = (typeof RISK_ASSESSMENT_PERSONS_AT_RISK)[number];

export const RISK_ASSESSMENT_PERSON_LABEL: Record<RiskAssessmentPersonAtRisk, string> = {
  ECG_EMPLOYEE: 'ECG Employee',
  VISITORS: 'Visitors',
  CONTRACTOR_SITE_WORKERS: 'Contractor/Site Workers',
  DRIVERS: 'Drivers',
  GENERAL_PUBLIC: 'General Public',
  CUSTOMERS: 'Customers',
};

/**
 * Tick-list hazards from the ECG Risk Assessment Form, grouped by section.
 * Values are stable ids stored on the record; labels are shown in the UI.
 */
export const RISK_ASSESSMENT_HAZARD_GROUPS: ReadonlyArray<{
  id: string;
  label: string;
  items: ReadonlyArray<{ id: string; label: string }>;
}> = [
  {
    id: 'GENERAL_WORK_ENVIRONMENT',
    label: 'General Work Environment',
    items: [
      { id: 'RESTRICTED_ACCESS_OR_EGRESS', label: 'Restricted Access or Egress' },
      { id: 'CONFINED_SPACES', label: 'Confined Spaces' },
      { id: 'AIR_QUALITY', label: 'Air Quality' },
      { id: 'AIR_CONDITIONING', label: 'Air-Conditioning (Thermal Comfort)' },
      { id: 'NOISE', label: 'Noise' },
      { id: 'SUN_OR_HEAT_EXPOSURE', label: 'Sun or heat exposure' },
      { id: 'UNEVEN_WALKING_SURFACES', label: 'Uneven Walking Surfaces' },
      { id: 'WORKING_AT_HEIGHT', label: 'Working at Height' },
      { id: 'POOR_ILLUMINATION', label: 'Poor Illumination' },
      { id: 'POOR_VENTILATION', label: 'Poor Ventilation' },
      { id: 'WET_FLOOR', label: 'Wet floor' },
      { id: 'TRAILING_CABLES', label: 'Trailing cables' },
    ],
  },
  {
    id: 'HEALTH_AND_SECURITY',
    label: 'Health & Security',
    items: [
      { id: 'WORK_RELATED_HEALTH_HAZARDS', label: 'Work related Health Hazards' },
      { id: 'WATER_QUALITY', label: 'Water Quality' },
      { id: 'DEHYDRATION', label: 'Dehydration' },
      { id: 'VIOLENCE', label: 'Violence' },
      { id: 'LONE_WORK', label: 'Lone Work' },
      { id: 'INSECT_BITE', label: 'Insect bite' },
      { id: 'HIV_AIDS', label: 'HIV/AIDS' },
      { id: 'NIGHT_WORK', label: 'Night work' },
      { id: 'BUSH_WORK', label: 'Bush work' },
      { id: 'LIGHTNING_HEALTH', label: 'Lightning' },
      { id: 'ROADS_AND_HIGHWAYS', label: 'Roads and Highways' },
      { id: 'CONTAGIOUS_DISEASES', label: 'Contagious diseases' },
    ],
  },
  {
    id: 'VEHICLES_AND_EQUIPMENT',
    label: 'Vehicles & Equipment',
    items: [
      { id: 'VEHICLES', label: 'Vehicles' },
      { id: 'POWERED_EQUIPMENT', label: 'Powered Equipment' },
      { id: 'NON_POWERED_EQUIPMENT', label: 'Non-Powered Equipment' },
      { id: 'ELEVATED_WORK_PLATFORMS', label: 'Elevated Work Platforms' },
      { id: 'ELECTRICAL_EQUIPMENT', label: 'Electrical Equipment' },
      { id: 'TRAFFIC_CONTROL', label: 'Traffic Control and Management' },
      { id: 'VIBRATION', label: 'Vibration' },
      { id: 'LADDERS', label: 'Ladders' },
      { id: 'CRANES', label: 'Cranes' },
      { id: 'FORKLIFT', label: 'Forklift' },
      { id: 'HAND_AND_POWER_TOOLS', label: 'Hand and Power Tools' },
      { id: 'MECHANIZED_EQUIPMENT', label: 'Mechanized Equipment' },
    ],
  },
  {
    id: 'ERGONOMIC_MANUAL_HANDLING',
    label: 'Ergonomic/Manual Handling',
    items: [
      { id: 'WORKSTATION_SETUP', label: 'Workstation Setup' },
      { id: 'POOR_POSTURE', label: 'Poor Posture' },
      { id: 'LIFTING_CARRYING', label: 'Lifting/Carrying' },
      { id: 'PUSHING_PULLING', label: 'Pushing/Pulling' },
      { id: 'REACHING_OUTSTRETCHING', label: 'Reaching/Outstretching' },
      { id: 'REPETITIVE_MOVEMENT', label: 'Repetitive Movement' },
      { id: 'BENDING', label: 'Bending' },
      { id: 'EYE_STRAIN', label: 'Eye Strain' },
    ],
  },
  {
    id: 'CHEMICAL',
    label: 'Chemical',
    items: [
      { id: 'HAZARDOUS_CHEMICALS_PCB_SF6', label: 'Hazardous Chemicals (PCBs, SF6)' },
      { id: 'HAZARDOUS_MATERIALS', label: 'Hazardous Materials' },
      { id: 'BUTANE', label: 'Butane' },
      { id: 'PROPANE_GAS', label: 'Propane Gas' },
      { id: 'FUEL_PETROL', label: 'Fuel/Petrol' },
      { id: 'DIESEL', label: 'Diesel' },
      { id: 'TURPENTINE', label: 'Turpentine' },
      { id: 'ALCOHOL_BASED_SANITIZERS', label: 'Alcohol-based sanitizers (flammable)' },
      { id: 'HYDROGEN_GAS', label: 'Hydrogen gas' },
    ],
  },
  {
    id: 'TEMPERATURE_OR_WEATHER',
    label: 'Temperature or Weather Effects',
    items: [
      { id: 'HEAT', label: 'Heat' },
      { id: 'RAIN_FLOOD', label: 'Rain/Flood' },
      { id: 'LIGHTNING_WEATHER', label: 'Lightning' },
      { id: 'SMOKE', label: 'Smoke' },
      { id: 'WIND', label: 'Wind' },
      { id: 'STORM', label: 'Storm' },
      { id: 'EARTH_TREMOR', label: 'Earth tremor or quake' },
      { id: 'MUD_SLIDE', label: 'Mud slide' },
    ],
  },
  {
    id: 'WORKPLACE_ISSUES',
    label: 'Workplace Issues & Management',
    items: [
      { id: 'FATIGUE', label: 'Fatigue' },
      { id: 'STRESS', label: 'Stress' },
      { id: 'ORGANIZATIONAL_CHANGE', label: 'Organizational Change' },
      { id: 'WORKPLACE_VIOLENCE_BULLYING', label: 'Workplace violence or Bullying' },
      { id: 'HARASSMENT', label: 'Harassment' },
      { id: 'INTIMIDATION', label: 'Intimidation' },
    ],
  },
  {
    id: 'RADIATION',
    label: 'Radiation',
    items: [
      { id: 'RADIOACTIVE_EXPOSURE', label: 'Radioactive exposure' },
      { id: 'ULTRAVIOLET_RADIATION', label: 'Ultraviolet (UV) Radiation' },
      { id: 'INFRARED_RADIATION', label: 'Infrared Radiation' },
      { id: 'STATIC_MAGNETIC_FIELDS', label: 'Static magnetic fields' },
      { id: 'ELECTROMAGNETIC_FIELDS', label: 'Electromagnetic fields exposure' },
    ],
  },
  {
    id: 'OTHER_HAZARDS',
    label: 'Other Hazards',
    items: [
      { id: 'FIRE_OUTBREAK', label: 'Fire Outbreak/Fire Hazards' },
      { id: 'ELECTRIC_SHOCKS', label: 'Electric Shocks' },
      { id: 'ELECTROCUTION', label: 'Electrocution' },
      { id: 'EXHAUST_AND_DUST', label: 'Exhaust and dust emissions' },
      { id: 'ASBESTOS', label: 'Asbestos' },
      { id: 'SILICON_DERIVATIVES', label: 'Silicon derivatives' },
    ],
  },
] as const;

export const RISK_ASSESSMENT_HAZARD_IDS = RISK_ASSESSMENT_HAZARD_GROUPS.flatMap((g) =>
  g.items.map((item) => item.id),
);

