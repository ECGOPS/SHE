import { Role } from '@ecg-she/shared';

/**
 * Who may open each area of the app.
 *
 * A reporter records what they saw. A safety officer works the case.
 * Head Office staff read the registers. The system administrator sees everything.
 */
const REPORTER: Role[] = [Role.STAFF, Role.DISTRICT_USER, Role.REGIONAL_USER];
const DISTRICT_OFFICER: Role[] = [Role.DISTRICT_SAFETY_OFFICER];
const REGIONAL_OFFICER: Role[] = [Role.REGIONAL_SAFETY_OFFICER];
const HEAD_OFFICE_OFFICER: Role[] = [Role.GLOBAL_SAFETY_OFFICER];
const HEAD_OFFICE_STAFF: Role[] = [Role.GLOBAL_USER];
const ADMIN: Role[] = [Role.SYS_ADMIN];

/** Incidents, hazards, near-miss, JSA and permits: report, investigate, or review. */
const CASES: Role[] = [
  ...REPORTER,
  ...DISTRICT_OFFICER,
  ...REGIONAL_OFFICER,
  ...HEAD_OFFICE_OFFICER,
  ...HEAD_OFFICE_STAFF,
  ...ADMIN,
];

/** Officers inspect the network. Crew record a vehicle or PPE check. Head Office reviews. */
const INSPECTIONS: Role[] = [
  ...DISTRICT_OFFICER,
  ...REGIONAL_OFFICER,
  ...HEAD_OFFICE_OFFICER,
  ...HEAD_OFFICE_STAFF,
  ...ADMIN,
];

/** The management picture: safety officers, Head Office, and the system administrator. */
const DASHBOARD: Role[] = [
  ...DISTRICT_OFFICER,
  ...REGIONAL_OFFICER,
  ...HEAD_OFFICE_OFFICER,
  ...HEAD_OFFICE_STAFF,
  ...ADMIN,
];

/** Audits and organisation reports sit with the region and Head Office. */
const REGION_AND_HEAD_OFFICE: Role[] = [
  ...REGIONAL_OFFICER,
  ...HEAD_OFFICE_OFFICER,
  ...HEAD_OFFICE_STAFF,
  ...ADMIN,
];

/** Training, PPE, occupational health and the audit trail are Head Office duties. */
const HEAD_OFFICE: Role[] = [...HEAD_OFFICE_OFFICER, ...HEAD_OFFICE_STAFF, ...ADMIN];

export const NAV_ROLES: Record<string, Role[]> = {
  '/dashboard': DASHBOARD,
  '/console': [...DISTRICT_OFFICER, ...REGIONAL_OFFICER, ...HEAD_OFFICE_OFFICER, ...ADMIN],
  '/incidents': CASES,
  '/near-miss': CASES,
  '/hazards': CASES,
  '/jsa': CASES,
  '/ptw': CASES,
  '/environmental': CASES,
  '/inspections': [...REPORTER, ...INSPECTIONS],
  '/capa': INSPECTIONS,
  '/audits': [...DISTRICT_OFFICER, ...REGION_AND_HEAD_OFFICE],
  '/management': Object.values(Role) as Role[],
  '/reports': [...DISTRICT_OFFICER, ...REGION_AND_HEAD_OFFICE],
  '/health': [...DISTRICT_OFFICER, ...REGIONAL_OFFICER, ...HEAD_OFFICE],
  '/training': [...DISTRICT_OFFICER, ...REGIONAL_OFFICER, ...HEAD_OFFICE],
  '/ppe': [...DISTRICT_OFFICER, ...REGIONAL_OFFICER, ...HEAD_OFFICE],
  '/audit-trail': HEAD_OFFICE,
  '/admin': ADMIN,
  '/privacy': Object.values(Role) as Role[],
};

/** Where this person lands after sign-in. Staff open Incidents. Officers open the dashboard. */
export function homePath(role: Role): string {
  if (NAV_ROLES['/dashboard'].includes(role)) return '/dashboard';
  if (NAV_ROLES['/incidents'].includes(role)) return '/incidents';
  return '/login';
}

/** True when this role may open the page. Child routes follow their parent, such as /incidents/new. */
export function canSeePath(role: Role, path: string): boolean {
  const match = Object.keys(NAV_ROLES)
    .filter((to) => path === to || path.startsWith(`${to}/`))
    .sort((a, b) => b.length - a.length)[0];
  if (!match) return false;
  return NAV_ROLES[match].includes(role);
}
