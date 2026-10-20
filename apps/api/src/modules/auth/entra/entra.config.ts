import { ConfigService } from '@nestjs/config';

export interface EntraConfig {
  enabled: boolean;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  audience: string;
  issuer: string;
  jwksUri: string;
  authority: string;
  graphScopes: string[];
  loginScopes: string[];
  groupClaim: string;
  /** Map of Entra group object-id → application Role */
  groupToRoleMap: Record<string, string>;
  redirectUri: string;
  postLogoutRedirectUri: string;
}

/**
 * Centralised Entra ID configuration. Reads everything from env so the
 * application is identical across local / staging / production. The only
 * distinction is the values supplied through `.env` or Kubernetes secrets.
 */
export function loadEntraConfig(config: ConfigService): EntraConfig {
  const tenantId = config.get<string>('ENTRA_TENANT_ID', '');
  const clientId = config.get<string>('ENTRA_CLIENT_ID', '');
  const enabled = !!tenantId && !!clientId;

  return {
    enabled,
    tenantId,
    clientId,
    clientSecret: config.get<string>('ENTRA_CLIENT_SECRET', ''),
    audience: config.get<string>('ENTRA_AUDIENCE', `api://${clientId}`),
    issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    graphScopes: ['https://graph.microsoft.com/.default'],
    loginScopes: ['openid', 'profile', 'email', 'offline_access', 'User.Read'],
    groupClaim: config.get<string>('ENTRA_GROUP_CLAIM', 'groups'),
    groupToRoleMap: parseGroupMap(config.get<string>('ENTRA_GROUP_ROLE_MAP', '')),
    redirectUri:
      config.get<string>('ENTRA_REDIRECT_URI') ?? 'http://localhost:5173/auth/callback',
    postLogoutRedirectUri:
      config.get<string>('ENTRA_POST_LOGOUT_URI') ?? 'http://localhost:5173/login',
  };
}

/**
 * Parse group → role mapping from env. Format:
 *   `<groupId>:SYS_ADMIN,<groupId>:GLOBAL_USER,<groupId>:REGIONAL_USER`
 */
function parseGroupMap(raw: string): Record<string, string> {
  if (!raw) return {};
  return raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, pair) => {
      const [g, r] = pair.split(':').map((s) => s.trim());
      if (g && r) acc[g] = r;
      return acc;
    }, {});
}
