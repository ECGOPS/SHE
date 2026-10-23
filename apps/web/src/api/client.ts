import axios, { AxiosError, AxiosInstance } from 'axios';
import { useAuthStore } from '../stores/auth.store';
import { apiBaseUrl } from './dev-host';
import { installCsrf } from './csrf';

const baseURL = apiBaseUrl();

export const api: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20_000,
});

installCsrf(api);

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().session?.tokens.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const original = err.config;
    if (err.response?.status === 401 && original && !(original as { _retry?: boolean })._retry) {
      (original as { _retry?: boolean })._retry = true;
      refreshing ??= useAuthStore.getState().refresh();
      const token = await refreshing;
      refreshing = null;
      if (token) {
        original.headers!.Authorization = `Bearer ${token}`;
        return api.request(original);
      }
      useAuthStore.getState().logout();
    }
    return Promise.reject(err);
  },
);

/** Returns the unwrapped `.data` payload from the API envelope. */
export async function unwrap<T>(p: Promise<{ data: { data: T } }>): Promise<T> {
  const r = await p;
  return r.data.data;
}
