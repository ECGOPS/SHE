import type { Role } from './rbac.js';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  regionId: string | null;
  districtId: string | null;
  permissions: string[];
  mfaEnabled: boolean;
  /** Set on access tokens that may only call MFA enrollment routes. */
  mfaSetupOnly?: boolean;
  /** Local session that issued this access token. Absent for Microsoft tokens. */
  sessionId?: string;
  authenticatedAt?: string;
  reauthenticatedAt?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface KpiSnapshot {
  totalIncidents: number;
  ltifr: number;
  trir: number;
  fatalities: number;
  nearMisses: number;
  hazardReports: number;
  openCorrectiveActions: number;
  environmentalCases: number;
  safetyPerformanceScore: number;
}

export interface DashboardTrendPoint {
  date: string;
  incidents: number;
  nearMisses: number;
  hazards: number;
}
