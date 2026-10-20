import { Configuration, LogLevel, PublicClientApplication } from '@azure/msal-browser';

/**
 * MSAL public-client configuration consumed by the SPA.
 *
 * `tenantId` and `clientId` come from environment variables — they are the
 * same values the backend uses, so SSO is wired through the same Entra app
 * registration. No client-side secrets are ever required.
 */

const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID;
const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID;
const audience = import.meta.env.VITE_ENTRA_AUDIENCE ?? `api://${clientId}`;

/** True if the SPA was built with Entra credentials. */
export const ENTRA_ENABLED: boolean = !!tenantId && !!clientId;

export const msalConfig: Configuration = {
  auth: {
    clientId: clientId ?? '',
    authority: tenantId ? `https://login.microsoftonline.com/${tenantId}` : undefined,
    redirectUri: window.location.origin + '/auth/callback',
    postLogoutRedirectUri: window.location.origin + '/login',
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      piiLoggingEnabled: false,
      loggerCallback: (level, message) => {
        if (level <= LogLevel.Warning) console.warn('[MSAL]', message);
      },
    },
  },
};

export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'offline_access', 'User.Read'],
};

/** Scope used when acquiring tokens for the ECG SHE API. */
export const apiTokenRequest = {
  scopes: [`${audience}/.default`],
};

export const msalInstance = ENTRA_ENABLED
  ? new PublicClientApplication(msalConfig)
  : null;

if (msalInstance) {
  void msalInstance.initialize();
}
