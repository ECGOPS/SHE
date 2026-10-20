import type { ConnectionOptions } from 'node:tls';

/** TLS for database, Redis, and mail. Certificates are checked. TLS 1.0 and 1.1 are refused. */
export const SERVICE_TLS: ConnectionOptions = {
  minVersion: 'TLSv1.2',
  rejectUnauthorized: true,
};

export function databaseTls(enabled: boolean): ConnectionOptions | false | undefined {
  return enabled ? { ...SERVICE_TLS } : undefined;
}
