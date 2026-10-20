import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { databaseTls, SERVICE_TLS } from '../common/crypto/tls';

export type SupportedDriver =
  | 'postgres'
  | 'mssql'
  | 'mysql'
  | 'mariadb'
  | 'oracle'
  | 'sqlite';

/**
 * Builds TypeORM connection options for any supported relational engine.
 *
 * Resolution order for the driver:
 *   1. Explicit `DB_TYPE` env var
 *   2. If `DB_HOST` is set, default to `postgres` (Docker-Compose style)
 *   3. Otherwise default to `sqlite` so the application is runnable with
 *      ZERO external infrastructure (`npm install && npm run dev` works).
 *
 * Supported engines:
 *   • Microsoft SQL Server / Azure SQL Database (mssql)  — production target
 *   • PostgreSQL                                          — Docker dev option
 *   • MySQL / MariaDB
 *   • Oracle Database
 *   • SQLite                                              — zero-config local
 */
export function buildTypeOrmOptions(config: ConfigService): TypeOrmModuleOptions {
  const explicit = config.get<string>('DB_TYPE');
  const hasHost = !!config.get<string>('DB_HOST');
  const driver = (
    (explicit ?? (hasHost ? 'postgres' : 'sqlite')) as SupportedDriver
  )
    .toString()
    .toLowerCase() as SupportedDriver;

  const host = config.get<string>('DB_HOST');
  const port = config.get<number>('DB_PORT');
  const username = config.get<string>('DB_USERNAME');
  const password = config.get<string>('DB_PASSWORD');
  const database = config.get<string>('DB_NAME');
  const ssl = config.get<boolean>('DB_SSL', false);
  // For SQLite default we synchronize automatically — there is no migration
  // story for an embedded dev DB. Other engines should run migrations.
  const synchronize =
    config.get<boolean>('DB_SYNCHRONIZE') ?? driver === 'sqlite';
  const logging = config.get<boolean>('DB_LOGGING', false);

  const baseOptions = {
    autoLoadEntities: true,
    synchronize,
    logging,
    migrationsRun: false,
    migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],
  };

  switch (driver) {
    case 'mssql':
      return {
        ...baseOptions,
        type: 'mssql',
        host,
        port: port ?? 1433,
        username,
        password,
        database,
        options: {
          encrypt: true,
          trustServerCertificate: !ssl,
          enableArithAbort: true,
          ...(ssl ? { cryptoCredentialsDetails: { minVersion: SERVICE_TLS.minVersion } } : {}),
        },
        extra: {
          max: config.get<number>('DB_POOL_MAX', 30),
          min: config.get<number>('DB_POOL_MIN', 5),
          idleTimeoutMillis: 30_000,
        },
      };

    case 'postgres':
      return {
        ...baseOptions,
        type: 'postgres',
        host: host ?? 'localhost',
        port: port ?? 5432,
        username: username ?? 'postgres',
        password: password ?? 'postgres',
        database: database ?? 'ecg_she',
        ssl: (databaseTls(ssl) ?? false) as false | import('tls').TlsOptions,
      };

    case 'mysql':
    case 'mariadb':
      return {
        ...baseOptions,
        type: driver,
        host,
        port: port ?? 3306,
        username,
        password,
        database,
        charset: 'utf8mb4_unicode_ci',
        ssl: databaseTls(ssl),
      };

    case 'oracle':
      return {
        ...baseOptions,
        type: 'oracle',
        host,
        port: port ?? 1521,
        username,
        password,
        sid: database,
      };

    case 'sqlite': {
      const sqlitePath = resolveSqlitePath(database);
      return {
        ...baseOptions,
        type: 'sqlite',
        database: sqlitePath,
      };
    }

    default:
      throw new Error(`Unsupported DB_TYPE: ${driver}`);
  }
}

/**
 * Resolves the SQLite database file path. Defaults to `<repo>/data/ecg-she.db`
 * relative to the API working directory. Auto-creates the parent directory
 * so the very first `npm run dev` succeeds with no manual filesystem setup.
 */
function resolveSqlitePath(configured: string | undefined): string {
  if (configured && configured !== ':memory:') {
    const resolved = path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    return resolved;
  }
  if (configured === ':memory:') return ':memory:';
  const dataDir = path.resolve(process.cwd(), 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, 'ecg-she.db');
}
