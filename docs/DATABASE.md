# Database

> See [CONFIGURATION.md](./CONFIGURATION.md) for the full reference of every
> `DB_*` environment variable.

## Engine choice — driver-agnostic

The application speaks **TypeORM** to a single, driver-agnostic data layer.
The runtime engine is selected by the `DB_TYPE` environment variable. No
entity, service or controller code is engine-specific.

| `DB_TYPE`  | Engine                              | Notes                                                       |
| ---------- | ----------------------------------- | ----------------------------------------------------------- |
| `sqlite`   | SQLite (embedded file)              | **Zero-config default** — used for local dev when no `.env` |
| `mssql`    | **Azure SQL Database / SQL Server** | **Production target**                                       |
| `postgres` | PostgreSQL 14+                      | Docker-compose dev option                                   |
| `mysql`    | MySQL 8                             |                                                             |
| `mariadb`  | MariaDB                             |                                                             |
| `oracle`   | Oracle 19c+                         |                                                             |

Switching engines is a configuration change — pull the value from a Key
Vault / Kubernetes secret and roll the deployment.

### Driver resolution rules

If `DB_TYPE` is **not** set, the API resolves the driver as follows:

1. If `DB_HOST` is set, default to `postgres`.
2. Otherwise default to `sqlite` and write the file to `./data/ecg-she.db`.

This keeps `npm run dev` working with **no infrastructure** while still
defaulting to Postgres when the docker-compose stack is running.

### Auto-bootstrap

`BootstrapService` runs once on application start (`@OnApplicationBootstrap`).
It seeds the regions / districts taxonomy and the test user accounts
described in [README.md](../README.md) when they are missing. Disable in
production with `BOOTSTRAP_AUTOSEED=false`.

### Fully cross-DB column types

All entities use TypeORM column types that map cleanly to every supported
engine — `varchar`, `int`, `decimal`, `float`, `text`, `simple-json`, `uuid`
and the `@CreateDateColumn` / `@UpdateDateColumn` / `@DeleteDateColumn`
decorators. No vendor-specific aliases (`jsonb`, `timestamptz`, native enum
types, partial-where indexes) are used. This is what allows the same
codebase to run identically on SQLite, Postgres and Azure SQL.

```env
# Azure SQL Database
DB_TYPE=mssql
DB_HOST=ecg-she.database.windows.net
DB_PORT=1433
DB_USERNAME=ecg_she_admin@ecg-she
DB_PASSWORD=<secret>
DB_NAME=ecg_she
DB_SSL=true
DB_POOL_MAX=30
DB_POOL_MIN=5
```

## Universal columns

Every domain table inherits `BaseEntity` which declares:

| Column     | Type   | Purpose                                          |
| ---------- | ------ | ------------------------------------------------ |
| `id`       | uuid   | Primary key                                      |
| `tenantId` | string | Multi-tenant isolation (default `ecg`)           |
| `createdAt`| datetime | Record creation timestamp                       |
| `createdBy`| uuid   | Actor that created the row                       |
| `updatedAt`| datetime | Last modification timestamp                     |
| `updatedBy`| uuid   | Actor that last modified the row                 |
| `deletedAt`| datetime? | Soft-delete timestamp (null = active row)      |
| `deletedBy`| uuid?  | Actor that soft-deleted the row                  |
| `version`  | int    | Optimistic-locking counter                       |

## Audit columns are populated automatically

`AuditColumnsSubscriber` is a TypeORM `EntitySubscriberInterface` that hooks
`beforeInsert`, `beforeUpdate` and `beforeSoftRemove`. It reads the current
user / tenant from `AsyncLocalStorage` (set by `RequestContextMiddleware` for
every HTTP request) and assigns the relevant column. Service code never
needs to populate them manually.

## Multi-tenancy

Every record carries a `tenantId`. The header `x-tenant-id` (or the user's
own `tenantId` claim) selects the active tenant. `TenantScopeService.applyTenantFilter()`
adds the predicate to every query builder. ECG runs as a single tenant
(`tenant = ecg`) but the data model and code paths are SaaS-ready.

## Soft delete

Hard deletes are not used in the application. Services call
`repository.softRemove(entity)`, which sets `deletedAt` and lets the audit
subscriber capture `deletedBy`. To hide deleted rows from queries, TypeORM
applies the `IS NULL` filter automatically when the `deletedAt` column is
declared with `@DeleteDateColumn()`.

To purge data permanently (for GDPR / compliance retention windows) use the
DB-side scheduled job in `infra/k8s/cronjob-purge.yaml`.

## Migrations

Generated TypeORM migrations live in `apps/api/src/database/migrations/`.
They are dialect-aware — TypeORM emits the right SQL flavour for the
configured `DB_TYPE`.

```bash
# Generate a fresh migration from the current entity diff
npm run db:migrate:generate --workspace=@ecg-she/api -- ./src/database/migrations/<name>

# Apply pending migrations
npm run db:migrate --workspace=@ecg-she/api

# Roll back one
npm run db:migrate:revert --workspace=@ecg-she/api
```

## Backups & recovery

| Engine | Strategy |
| ------ | -------- |
| Azure SQL Database | Built-in PITR (35 days) + LTR (10 years) — configured in the portal |
| PostgreSQL | Nightly `pg_dump` to S3 + WAL archiving |
| Others | Engine-native (e.g. `mysqldump`, RMAN) |

Use the K8s `CronJob` in `infra/k8s/cronjob-backup.yaml` (Postgres / MySQL).
For Azure SQL, configure the policies on the database resource directly.

## Reference codes

Every primary domain record has a deterministic, human-readable reference
code: `<MODULE>-<YEAR>-<REGION>-<DISTRICT>-<NNNNN>`.
Example: `INC-2026-AE-MAK-00042`.
