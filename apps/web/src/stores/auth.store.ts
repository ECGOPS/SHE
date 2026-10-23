import { create } from 'zustand';
import axios from 'axios';
import type { AuthTokens, AuthUser } from '@ecg-she/shared';
import { ENTRA_ENABLED, apiTokenRequest, loginRequest, msalInstance } from '../auth/msal';
import { apiBaseUrl } from '../api/dev-host';
import { installCsrf } from '../api/csrf';

interface Session {
  user: AuthUser;
  tokens: AuthTokens;
  /** Where the session originated. */
  provider: 'entra' | 'local';
}

interface MfaSetup {
  accessToken: string;
  qrDataUrl: string;
  secret: string;
}

interface AuthState {
  session: Session | null;
  pendingMfa: { email: string; password: string } | null;
  pendingMfaSetup: MfaSetup | null;
  restoring: boolean;
  loading: boolean;
  error: string | null;

  loginLocal: (email: string, password: string, mfaCode?: string) => Promise<{ requiresMfa: boolean; requiresMfaSetup: boolean }>;
  completeMfaSetup: (code: string) => Promise<void>;
  loginWithMicrosoft: () => Promise<void>;
  completeMicrosoftRedirect: () => Promise<void>;

  logout: () => Promise<void>;
  refresh: () => Promise<string | null>;
  restore: () => Promise<void>;
}

const LEGACY_STORAGE_KEY = 'ecg-she.session';
const baseURL = apiBaseUrl();
const raw = axios.create({ baseURL, timeout: 15_000, withCredentials: true });
installCsrf(raw);

function clearLegacySession(): void {
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  pendingMfa: null,
  pendingMfaSetup: null,
  restoring: true,
  loading: false,
  error: null,

  async restore() {
    clearLegacySession();
    try {
      if (ENTRA_ENABLED && msalInstance) {
        const account = msalInstance.getAllAccounts()[0];
        if (account) {
          msalInstance.setActiveAccount(account);
          const tokenResponse = await msalInstance.acquireTokenSilent({
            ...apiTokenRequest,
            account,
          });
          const { data } = await raw.get('/users/me', {
            headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
          });
          set({
            session: {
              user: data.data as AuthUser,
              tokens: {
                accessToken: tokenResponse.accessToken,
                refreshToken: '',
                expiresIn: 900,
              },
              provider: 'entra',
            },
            restoring: false,
          });
          return;
        }
      }

      const { data } = await raw.post('/auth/refresh', {});
      const tokens = { ...(data.data as AuthTokens), refreshToken: '' };
      const sessionRes = await raw.get('/auth/session', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      set({
        session: { user: sessionRes.data.data as AuthUser, tokens, provider: 'local' },
        restoring: false,
      });
    } catch {
      set({ session: null, restoring: false });
    }
  },

  // ──────────────────────────────────────────────────────────
  // Local fallback (system / break-glass accounts)
  // ──────────────────────────────────────────────────────────
  async loginLocal(email, password, mfaCode) {
    set({ loading: true, error: null });
    try {
      const { data } = await raw.post('/auth/login', { email, password, mfaCode });
      const payload = data.data as {
        tokens: AuthTokens;
        user: AuthUser;
        requiresMfa: boolean;
        requiresMfaSetup: boolean;
      };
      if (payload.requiresMfa && !mfaCode) {
        set({ pendingMfa: { email, password }, loading: false });
        return { requiresMfa: true, requiresMfaSetup: false };
      }
      if (payload.requiresMfaSetup) {
        const setup = await raw.post(
          '/auth/mfa/setup',
          {},
          { headers: { Authorization: `Bearer ${payload.tokens.accessToken}` } },
        );
        const enrollment = setup.data.data as { qrDataUrl: string; secret: string };
        set({
          pendingMfaSetup: {
            accessToken: payload.tokens.accessToken,
            qrDataUrl: enrollment.qrDataUrl,
            secret: enrollment.secret,
          },
          pendingMfa: null,
          loading: false,
        });
        return { requiresMfa: false, requiresMfaSetup: true };
      }
      const session: Session = {
        user: payload.user,
        tokens: { ...payload.tokens, refreshToken: '' },
        provider: 'local',
      };
      set({ session, pendingMfa: null, pendingMfaSetup: null, loading: false });
      return { requiresMfa: false, requiresMfaSetup: false };
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? Array.isArray(err.response.data.message)
            ? err.response.data.message.join(', ')
            : (err.response.data.message as string)
          : 'Login failed';
      set({ error: msg, loading: false });
      throw err;
    }
  },

  async completeMfaSetup(code) {
    const pending = get().pendingMfaSetup;
    if (!pending) return;
    set({ loading: true, error: null });
    try {
      const { data } = await raw.post(
        '/auth/mfa/verify',
        { code },
        { headers: { Authorization: `Bearer ${pending.accessToken}` } },
      );
      const tokens = { ...(data.data as AuthTokens), refreshToken: '' };
      const sessionRes = await raw.get('/auth/session', {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      set({
        session: { user: sessionRes.data.data as AuthUser, tokens, provider: 'local' },
        pendingMfaSetup: null,
        loading: false,
      });
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? Array.isArray(err.response.data.message)
            ? err.response.data.message.join(', ')
            : (err.response.data.message as string)
          : 'MFA verification failed';
      set({ error: msg, loading: false });
      throw err;
    }
  },

  // ──────────────────────────────────────────────────────────
  // Microsoft Entra ID (SSO) — primary login path
  // ──────────────────────────────────────────────────────────
  async loginWithMicrosoft() {
    if (!ENTRA_ENABLED || !msalInstance) {
      set({ error: 'Microsoft sign-in is not configured for this build.' });
      return;
    }
    set({ loading: true, error: null });
    await msalInstance.loginRedirect({ ...loginRequest, prompt: 'select_account' });
  },

  /**
   * Called from the `/auth/callback` route after MSAL redirects back.
   * Acquires an API-scoped access token and exchanges the user's identity for
   * a local session token via `/auth/entra/exchange`.
   */
  async completeMicrosoftRedirect() {
    if (!ENTRA_ENABLED || !msalInstance) return;
    set({ loading: true, error: null });
    try {
      const result = await msalInstance.handleRedirectPromise();
      if (!result || !result.account) {
        set({ loading: false });
        return;
      }
      msalInstance.setActiveAccount(result.account);

      // Acquire an API-scoped access token (works silently after redirect).
      const tokenResponse = await msalInstance.acquireTokenSilent({
        ...apiTokenRequest,
        account: result.account,
      });

      // Hand the bearer token to the API; it validates against Entra's JWKS,
      // upserts the user record and returns a local session JWT.
      const { data } = await raw.get('/users/me', {
        headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
      });

      // The Entra-validated token is itself usable, but we wrap it in our
      // standard `AuthTokens` shape so the rest of the app stays unchanged.
      const session: Session = {
        user: data.data as AuthUser,
        tokens: {
          accessToken: tokenResponse.accessToken,
          refreshToken: '',
          expiresIn: Math.max(60, Math.floor((tokenResponse.expiresOn?.getTime() ?? 0) - Date.now()) / 1000),
        },
        provider: 'entra',
      };
      set({ session, loading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed';
      set({ error: msg, loading: false });
    }
  },

  async logout() {
    const session = get().session;
    try {
      if (session?.provider === 'local' && session.tokens.accessToken) {
        await raw.post(
          '/auth/logout',
          {},
          { headers: { Authorization: `Bearer ${session.tokens.accessToken}` } },
        );
      }
    } catch {
      // ignore
    }
    clearLegacySession();
    set({ session: null, pendingMfa: null, pendingMfaSetup: null });

    if (session?.provider === 'entra' && msalInstance) {
      const account = msalInstance.getActiveAccount();
      await msalInstance.logoutRedirect({ account: account ?? undefined });
    }
  },

  async refresh() {
    const session = get().session;
    if (!session) return null;

    if (session.provider === 'entra' && msalInstance) {
      const account = msalInstance.getActiveAccount();
      if (!account) return null;
      try {
        const tokenResponse = await msalInstance.acquireTokenSilent({
          ...apiTokenRequest,
          account,
        });
        const next: Session = {
          ...session,
          tokens: {
            accessToken: tokenResponse.accessToken,
            refreshToken: '',
            expiresIn: 900,
          },
        };
        set({ session: next });
        return tokenResponse.accessToken;
      } catch {
        set({ session: null });
        return null;
      }
    }

    try {
      const { data } = await raw.post('/auth/refresh', {});
      const tokens = { ...(data.data as AuthTokens), refreshToken: '' };
      const next: Session = { ...session, tokens };
      set({ session: next });
      return tokens.accessToken;
    } catch {
      set({ session: null });
      return null;
    }
  },
}));
