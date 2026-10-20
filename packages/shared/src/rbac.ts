import { IssueScope } from './enums.js';

/**
 * Hierarchical role definitions for the ECG SHE platform.
 *
 * Scope (where the person works) and job (what they do) are separate:
 *
 *  SYS_ADMIN                 - full system access, no scope
 *  GLOBAL_USER               - Head Office staff. Read across the organisation.
 *  GLOBAL_SAFETY_OFFICER     - Head Office safety officer. Approves and closes.
 *  REGIONAL_USER             - staff in one region. Reports incidents.
 *  REGIONAL_SAFETY_OFFICER   - safety officer for one region. Investigates and approves.
 *  DISTRICT_USER             - staff in one district. Reports incidents.
 *  DISTRICT_SAFETY_OFFICER   - safety officer for one district. Investigates and assigns.
 *  STAFF                     - any employee. Reports in the district where it happened.
 */
export enum Role {
  SYS_ADMIN = 'SYS_ADMIN',
  GLOBAL_SAFETY_OFFICER = 'GLOBAL_SAFETY_OFFICER',
  GLOBAL_USER = 'GLOBAL_USER',
  REGIONAL_SAFETY_OFFICER = 'REGIONAL_SAFETY_OFFICER',
  REGIONAL_USER = 'REGIONAL_USER',
  DISTRICT_SAFETY_OFFICER = 'DISTRICT_SAFETY_OFFICER',
  DISTRICT_USER = 'DISTRICT_USER',
  STAFF = 'STAFF',
}

export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.SYS_ADMIN]: 100,
  [Role.GLOBAL_SAFETY_OFFICER]: 80,
  [Role.GLOBAL_USER]: 75,
  [Role.REGIONAL_SAFETY_OFFICER]: 55,
  [Role.REGIONAL_USER]: 50,
  [Role.DISTRICT_SAFETY_OFFICER]: 30,
  [Role.DISTRICT_USER]: 25,
  [Role.STAFF]: 10,
};

export const ROLE_LABEL: Record<Role, string> = {
  [Role.SYS_ADMIN]: 'System administrator',
  [Role.GLOBAL_SAFETY_OFFICER]: 'Head Office safety officer',
  [Role.GLOBAL_USER]: 'Head Office staff',
  [Role.REGIONAL_SAFETY_OFFICER]: 'Regional safety officer',
  [Role.REGIONAL_USER]: 'Regional staff',
  [Role.DISTRICT_SAFETY_OFFICER]: 'District safety officer',
  [Role.DISTRICT_USER]: 'District staff',
  [Role.STAFF]: 'Staff',
};

/** Head Office and system accounts are not locked to a region or district. */
export function isGlobalScope(role: Role): boolean {
  return role === Role.SYS_ADMIN || role === Role.GLOBAL_USER || role === Role.GLOBAL_SAFETY_OFFICER;
}

export function isRegionalScope(role: Role): boolean {
  return role === Role.REGIONAL_USER || role === Role.REGIONAL_SAFETY_OFFICER;
}

export function isDistrictScope(role: Role): boolean {
  return role === Role.DISTRICT_USER || role === Role.DISTRICT_SAFETY_OFFICER;
}

/** An employee who can report in any district and is not locked to one. */
export function isStaffRole(role: Role): boolean {
  return role === Role.STAFF;
}

export function isSafetyOfficer(role: Role): boolean {
  return (
    role === Role.DISTRICT_SAFETY_OFFICER ||
    role === Role.REGIONAL_SAFETY_OFFICER ||
    role === Role.GLOBAL_SAFETY_OFFICER
  );
}

/** Staff choose the region and district on each report. Safety officers stay on the scope an administrator assigned. */
export function reportsInChosenPlace(role: Role): boolean {
  return role === Role.STAFF || role === Role.DISTRICT_USER || role === Role.REGIONAL_USER;
}

/** Escalation tier a newly reported issue starts on, taken from the reporter's seat. */
export function issueScopeForRole(role: Role): IssueScope {
  if (isStaffRole(role) || isDistrictScope(role)) return IssueScope.DISTRICT;
  if (isRegionalScope(role)) return IssueScope.REGIONAL;
  return IssueScope.HEAD_OFFICE;
}

export type RbacScope =
  | { kind: 'GLOBAL' }
  | { kind: 'REGION'; regionId: string }
  | { kind: 'DISTRICT'; regionId: string; districtId: string };

/**
 * Catalogue of fine-grained permissions used by `@RequirePermissions(...)`.
 * Permissions follow the `<resource>:<action>` convention.
 */
export const Permission = {
  // Incidents
  INCIDENT_READ: 'incident:read',
  INCIDENT_CREATE: 'incident:create',
  INCIDENT_UPDATE: 'incident:update',
  INCIDENT_INVESTIGATE: 'incident:investigate',
  INCIDENT_APPROVE: 'incident:approve',
  INCIDENT_DELETE: 'incident:delete',

  // Hazards / near-miss
  HAZARD_READ: 'hazard:read',
  HAZARD_CREATE: 'hazard:create',
  HAZARD_APPROVE: 'hazard:approve',
  NEAR_MISS_READ: 'nearmiss:read',
  NEAR_MISS_CREATE: 'nearmiss:create',

  // JSA / PTW
  JSA_READ: 'jsa:read',
  JSA_CREATE: 'jsa:create',
  JSA_APPROVE: 'jsa:approve',
  PTW_READ: 'ptw:read',
  PTW_CREATE: 'ptw:create',
  PTW_APPROVE: 'ptw:approve',

  // Inspections / audits
  INSPECTION_READ: 'inspection:read',
  INSPECTION_CONDUCT: 'inspection:conduct',
  AUDIT_READ: 'audit:read',
  AUDIT_CONDUCT: 'audit:conduct',
  AUDIT_CLOSE: 'audit:close',

  // Environmental / health / training / PPE
  ENV_READ: 'env:read',
  ENV_CREATE: 'env:create',
  ENV_CLOSE: 'env:close',
  HEALTH_READ: 'health:read',
  HEALTH_CREATE: 'health:create',
  TRAINING_READ: 'training:read',
  TRAINING_MANAGE: 'training:manage',
  PPE_READ: 'ppe:read',
  PPE_MANAGE: 'ppe:manage',

  // ISO 45001 / ISO 14001 management system
  IMS_READ: 'ims:read',
  IMS_MANAGE: 'ims:manage',

  // CAPA
  CAPA_READ: 'capa:read',
  CAPA_CREATE: 'capa:create',
  CAPA_UPDATE: 'capa:update',
  CAPA_VERIFY: 'capa:verify',
  CAPA_CLOSE: 'capa:close',

  // Admin
  USER_MANAGE: 'user:manage',
  ORG_MANAGE: 'org:manage',
  AUDIT_TRAIL_READ: 'audit-trail:read',
  REPORT_GENERATE: 'report:generate',
  SYSTEM_CONFIGURE: 'system:configure',
} as const;

export type PermissionValue = (typeof Permission)[keyof typeof Permission];

/** What a linesman, technician, or supervisor can do: report, and read the record. */
const STAFF_REPORT: PermissionValue[] = [
  Permission.INCIDENT_READ,
  Permission.INCIDENT_CREATE,
  Permission.HAZARD_READ,
  Permission.HAZARD_CREATE,
  Permission.NEAR_MISS_READ,
  Permission.NEAR_MISS_CREATE,
  Permission.JSA_READ,
  Permission.JSA_CREATE,
  Permission.PTW_READ,
  Permission.PTW_CREATE,
  Permission.INSPECTION_READ,
  Permission.INSPECTION_CONDUCT,
  Permission.AUDIT_READ,
  Permission.ENV_READ,
  Permission.ENV_CREATE,
  Permission.CAPA_READ,
  Permission.IMS_READ,
];

export const ROLE_PERMISSIONS: Record<Role, PermissionValue[]> = {
  [Role.SYS_ADMIN]: Object.values(Permission),
  [Role.GLOBAL_SAFETY_OFFICER]: [
    Permission.INCIDENT_READ,
    Permission.INCIDENT_APPROVE,
    Permission.HAZARD_READ,
    Permission.HAZARD_CREATE,
    Permission.HAZARD_APPROVE,
    Permission.NEAR_MISS_READ,
    Permission.NEAR_MISS_CREATE,
    Permission.JSA_READ,
    Permission.JSA_CREATE,
    Permission.JSA_APPROVE,
    Permission.PTW_READ,
    Permission.PTW_CREATE,
    Permission.PTW_APPROVE,
    Permission.INSPECTION_READ,
    Permission.INSPECTION_CONDUCT,
    Permission.AUDIT_READ,
    Permission.AUDIT_CONDUCT,
    Permission.AUDIT_CLOSE,
    Permission.ENV_READ,
    Permission.ENV_CREATE,
    Permission.ENV_CLOSE,
    Permission.HEALTH_READ,
    Permission.HEALTH_CREATE,
    Permission.TRAINING_READ,
    Permission.TRAINING_MANAGE,
    Permission.PPE_READ,
    Permission.PPE_MANAGE,
    Permission.CAPA_READ,
    Permission.CAPA_CREATE,
    Permission.CAPA_UPDATE,
    Permission.CAPA_VERIFY,
    Permission.CAPA_CLOSE,
    Permission.IMS_READ,
    Permission.IMS_MANAGE,
    Permission.AUDIT_TRAIL_READ,
    Permission.REPORT_GENERATE,
  ],
  [Role.GLOBAL_USER]: [
    Permission.INCIDENT_READ,
    Permission.HAZARD_READ,
    Permission.HAZARD_CREATE,
    Permission.NEAR_MISS_READ,
    Permission.NEAR_MISS_CREATE,
    Permission.JSA_READ,
    Permission.PTW_READ,
    Permission.INSPECTION_READ,
    Permission.AUDIT_READ,
    Permission.ENV_READ,
    Permission.HEALTH_READ,
    Permission.TRAINING_READ,
    Permission.PPE_READ,
    Permission.CAPA_READ,
    Permission.IMS_READ,
    Permission.AUDIT_TRAIL_READ,
    Permission.REPORT_GENERATE,
  ],
  [Role.REGIONAL_SAFETY_OFFICER]: [
    Permission.INCIDENT_READ,
    Permission.INCIDENT_CREATE,
    Permission.INCIDENT_UPDATE,
    Permission.INCIDENT_INVESTIGATE,
    Permission.INCIDENT_APPROVE,
    Permission.HAZARD_READ,
    Permission.HAZARD_CREATE,
    Permission.HAZARD_APPROVE,
    Permission.NEAR_MISS_READ,
    Permission.NEAR_MISS_CREATE,
    Permission.JSA_READ,
    Permission.JSA_CREATE,
    Permission.JSA_APPROVE,
    Permission.PTW_READ,
    Permission.PTW_CREATE,
    Permission.PTW_APPROVE,
    Permission.INSPECTION_READ,
    Permission.INSPECTION_CONDUCT,
    Permission.AUDIT_READ,
    Permission.AUDIT_CONDUCT,
    Permission.AUDIT_CLOSE,
    Permission.ENV_READ,
    Permission.ENV_CREATE,
    Permission.ENV_CLOSE,
    Permission.HEALTH_READ,
    Permission.HEALTH_CREATE,
    Permission.TRAINING_READ,
    Permission.TRAINING_MANAGE,
    Permission.PPE_READ,
    Permission.PPE_MANAGE,
    Permission.CAPA_READ,
    Permission.CAPA_CREATE,
    Permission.CAPA_UPDATE,
    Permission.CAPA_VERIFY,
    Permission.IMS_READ,
    Permission.IMS_MANAGE,
    Permission.REPORT_GENERATE,
  ],
  [Role.REGIONAL_USER]: STAFF_REPORT,
  [Role.DISTRICT_SAFETY_OFFICER]: [
    Permission.INCIDENT_READ,
    Permission.INCIDENT_CREATE,
    Permission.INCIDENT_UPDATE,
    Permission.INCIDENT_INVESTIGATE,
    Permission.HAZARD_READ,
    Permission.HAZARD_CREATE,
    Permission.HAZARD_APPROVE,
    Permission.NEAR_MISS_READ,
    Permission.NEAR_MISS_CREATE,
    Permission.JSA_READ,
    Permission.JSA_CREATE,
    Permission.JSA_APPROVE,
    Permission.PTW_READ,
    Permission.PTW_CREATE,
    Permission.PTW_APPROVE,
    Permission.INSPECTION_READ,
    Permission.INSPECTION_CONDUCT,
    Permission.AUDIT_READ,
    Permission.ENV_READ,
    Permission.ENV_CREATE,
    Permission.ENV_CLOSE,
    Permission.HEALTH_READ,
    Permission.HEALTH_CREATE,
    Permission.TRAINING_READ,
    Permission.TRAINING_MANAGE,
    Permission.PPE_READ,
    Permission.PPE_MANAGE,
    Permission.CAPA_READ,
    Permission.CAPA_CREATE,
    Permission.CAPA_UPDATE,
    Permission.IMS_READ,
    Permission.IMS_MANAGE,
    Permission.REPORT_GENERATE,
  ],
  [Role.DISTRICT_USER]: STAFF_REPORT,
  [Role.STAFF]: STAFF_REPORT.filter(
    (permission) => permission !== Permission.AUDIT_READ && permission !== Permission.CAPA_READ,
  ),
};

export function hasRoleAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimum];
}
