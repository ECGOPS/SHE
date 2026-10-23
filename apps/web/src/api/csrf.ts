import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { apiBaseUrl } from './dev-host';

const baseURL = apiBaseUrl();
const MUTATING = new Set(['post', 'put', 'patch', 'delete']);

let token: string | null = null;
let pending: Promise<void> | null = null;

const fetcher = axios.create({ baseURL, withCredentials: true, timeout: 15_000 });

export function rememberCsrf(value: unknown): void {
  if (typeof value === 'string' && value.length > 0) token = value;
}

export function clearCsrf(): void {
  token = null;
}

export async function ensureCsrf(): Promise<void> {
  if (token) return;
  if (!pending) {
    pending = fetcher
      .get('/auth/csrf')
      .then(({ data, headers }) => {
        rememberCsrf(headers['x-csrf-token'] ?? (data as { data?: { token?: string } })?.data?.token);
      })
      .finally(() => {
        pending = null;
      });
  }
  await pending;
}

export function installCsrf(client: AxiosInstance): void {
  client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const method = (config.method ?? 'get').toLowerCase();
    if (MUTATING.has(method)) {
      await ensureCsrf();
      if (token) config.headers.set('X-CSRF-Token', token);
    }
    return config;
  });
  client.interceptors.response.use(
    (response) => {
      rememberCsrf(response.headers['x-csrf-token']);
      return response;
    },
    async (error: unknown) => {
      const rejected = error as {
        config?: InternalAxiosRequestConfig & { __csrfRetry?: boolean };
        response?: { status?: number; data?: { code?: string } };
      };
      const config = rejected.config;
      if (
        config &&
        !config.__csrfRetry &&
        rejected.response?.status === 403 &&
        rejected.response.data?.code === 'CSRF_REJECTED'
      ) {
        config.__csrfRetry = true;
        clearCsrf();
        await ensureCsrf();
        if (token) config.headers.set('X-CSRF-Token', token);
        return client.request(config);
      }
      return Promise.reject(error);
    },
  );
}
