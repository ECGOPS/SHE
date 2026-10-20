# Configuration Reference

> **This document is the single source of truth for every configuration value
> the ECG SHE platform reads.** It must stay in sync with:
>
> - [`.env.example`](../.env.example)
> - [`apps/api/src/config/config.schema.ts`](../apps/api/src/config/config.schema.ts)
> - [`apps/api/src/database/database.config.ts`](../apps/api/src/database/database.config.ts)
> - [`apps/web/src/vite-env.d.ts`](../apps/web/src/vite-env.d.ts)
>
> If you change any of those files, you **must** update this document in the
> same commit. A Cursor rule
> (`.cursor/rules/configuration-docs.mdc`) enforces this.

**Last reviewed:** 2026-10-17
**Schema version:** 6

---

## Quick reference

| Scenario | What you need | Time to first login |
| -------- | ------------- | ------------------- |
| **Zero-config local testing** | Nothing — just `npm install && npm run dev` | ≈ 30 s |
| Local Postgres dev | Docker + edit `DB_*` in `.env` | ≈ 2 min |
| Azure SQL + local login | Azure SQL credentials | ≈ 5 min |
| Full production (Azure SQL + Entra ID SSO) | Azure SQL + Entra app registration | ≈ 30 min |

---

## 1. Configuration precedence

The API reads configuration in this order (later sources override earlier
ones):

1. **Built-in defaults** declared in `config.schema.ts` (Joi `.default(...)`).
2. **`.env`** at the repo root (loaded via `@nestjs/config`).
3. **Process environment variables** (Kubernetes secrets, CI variables, etc.).

Front-end (Vite) variables are different — they are **baked into the bundle
at build time**. Only variables prefixed `VITE_` are exposed to the SPA.

### Driver / mode resolution

`DB_TYPE` is auto-resolved when not set:

| `DB_TYPE` | `DB_HOST` | Resulting driver |
| --------- | --------- | ---------------- |
| set       | any       | as configured    |
| unset     | set       | `postgres`       |
| unset     | unset     | `sqlite` (zero-config) |

`AUTH_PROVIDER` defaults to `local` so a missing `.env` lets the app boot
with username/password sign-in only.

---

## 2. Operational modes

The same codebase runs in four well-defined modes. Switch between them by
editing `.env` only — no code changes required.

### Mode A — Zero-config local (default, ships in repo)

| Setting | Value |
| ------- | ----- |
| `DB_TYPE` | `sqlite` |
| `DB_NAME` | `./data/ecg-she.db` (auto-created) |
| `REDIS_ENABLED` | `false` (in-memory stub) |
| `AUTH_PROVIDER` | `local` |
| `BOOTSTRAP_AUTOSEED` | `true` |
| `ENTRA_*` | empty |

Use case: instant local testing without Docker, Postgres, Azure or Entra.

### Mode B — Local Postgres (Docker Compose)

```dotenv
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=ecg_she
DB_PASSWORD=ecg_she_dev
DB_NAME=ecg_she
REDIS_ENABLED=true
AUTH_PROVIDER=local
```

Use case: realistic local dev that mirrors production schema behaviour.

### Mode C — Azure SQL + local login

```dotenv
DB_TYPE=mssql
DB_HOST=ecg-she.database.windows.net
DB_PORT=1433
DB_USERNAME=ecg_she_admin@ecg-she
DB_PASSWORD=<azure-sql-password>
DB_NAME=ecg_she
DB_SSL=true
AUTH_PROVIDER=local
BOOTSTRAP_AUTOSEED=false
```

Use case: production database with break-glass / system accounts only.

### Mode D — Full production (Azure SQL + Entra ID)

```dotenv
DB_TYPE=mssql
DB_HOST=ecg-she.database.windows.net
DB_USERNAME=ecg_she_admin@ecg-she
DB_PASSWORD=<azure-sql-password>
DB_NAME=ecg_she
DB_SSL=true
REDIS_ENABLED=true

AUTH_PROVIDER=hybrid
ENTRA_TENANT_ID=<tenant-guid>
ENTRA_CLIENT_ID=<app-guid>
ENTRA_CLIENT_SECRET=<client-secret>
ENTRA_AUDIENCE=api://<app-guid>
ENTRA_REDIRECT_URI=https://she.ecg.com.gh/auth/callback
ENTRA_GROUP_ROLE_MAP=<group-guid>:SYS_ADMIN,<group-guid>:GLOBAL_USER
ENTRA_AUTO_SYNC=true

BOOTSTRAP_AUTOSEED=false
JWT_ACCESS_SECRET=<random 32+ chars>
JWT_REFRESH_SECRET=<random 32+ chars>
DATA_ENCRYPTION_KEY=<random 32+ chars>
SWAGGER_ENABLED=false
```

Local `SYS_ADMIN` and `GLOBAL_USER` passwords cannot finish sign-in until the
account enrolls an authenticator. Entra accounts keep using Entra's own MFA.

---

## 3. Variable reference (backend)

Defaults below are what the application uses **when the variable is absent**.
Anything marked **dev-only default** must be overridden in production.

### 3.1 General

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `NODE_ENV` | `development` | `development` \| `test` \| `production`. |
| `TZ` | `Africa/Accra` | Process timezone for log timestamps & cron jobs. |
| `API_PORT` | `4000` | HTTP listening port. |
| `API_PREFIX` | `api/v1` | Prefix mounted on every controller. |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated origins allowed by CORS and the realtime gateway. |
| `SWAGGER_ENABLED` | `false` | Mount Swagger at `/api/v1/docs`. Development always mounts it. Production stays closed unless this is `true`. |

### 3.2 Database

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `DB_TYPE` | `sqlite` (or `postgres` if `DB_HOST` is set) | Driver selection. One of `sqlite`, `postgres`, `mssql`, `mysql`, `mariadb`, `oracle`. |
| `DB_HOST` | — | Server hostname. Not used by SQLite. |
| `DB_PORT` | driver-specific | TCP port. |
| `DB_USERNAME` | — | Login user. |
| `DB_PASSWORD` | — | Login password. |
| `DB_NAME` | `./data/ecg-she.db` (sqlite) | Database / file name. |
| `DB_SYNCHRONIZE` | `true` for sqlite, `false` otherwise | Auto-create schema from entities (NEVER enable in prod for non-sqlite). |
| `DB_LOGGING` | `false` | Log every SQL query. Useful for local debugging. |
| `DB_SSL` | `false` | TLS to the database. When true, the certificate is checked and TLS below 1.2 is refused. Production requires this for every engine except SQLite. |
| `DB_POOL_MAX` | `30` | Connection pool ceiling (mssql / postgres / mysql). |
| `DB_POOL_MIN` | `5` | Connection pool floor. |
| `BOOTSTRAP_AUTOSEED` | `true` in development, `false` in production | Seed regions, districts, and test users on startup. Production accepts only `false` so the published test passwords cannot be created. |

### 3.3 Redis

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `REDIS_ENABLED` | `false` | When `false` the app uses an in-process stub (single-instance only). |
| `REDIS_HOST` | `localhost` | Hostname. |
| `REDIS_PORT` | `6379` | Port. |
| `REDIS_PASSWORD` | empty | Auth password. |
| `REDIS_TLS` | `false` | TLS to Redis. When true, the certificate is checked and TLS below 1.2 is refused. |

### 3.4 Authentication

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `AUTH_PROVIDER` | `local` | `local` \| `entra` \| `hybrid`. Controls which Passport strategies the global guard accepts. |
| `JWT_ACCESS_SECRET` | dev-only default | HS256 secret for access tokens (≥ 32 chars). Production rejects the dev default and the `.env.example` placeholder, and it must differ from `JWT_REFRESH_SECRET`. |
| `JWT_ACCESS_TTL` | `15m` | Access-token lifetime. |
| `JWT_REFRESH_SECRET` | dev-only default | HS256 secret for refresh tokens. The token itself is set as an HttpOnly cookie and is not returned to the browser. Production rejects the dev default and the `.env.example` placeholder. |
| `JWT_REFRESH_TTL` | `7d` | Refresh-token lifetime. |

### 3.5 Microsoft Entra ID

All values are optional — leaving `ENTRA_TENANT_ID` or `ENTRA_CLIENT_ID`
empty disables SSO (and the "Sign in with Microsoft" button on the SPA).

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `ENTRA_TENANT_ID` | empty | Microsoft Entra tenant GUID. |
| `ENTRA_CLIENT_ID` | empty | App-registration GUID. |
| `ENTRA_CLIENT_SECRET` | empty | App-registration secret (server-side flows). |
| `ENTRA_AUDIENCE` | `api://<client-id>` | Expected `aud` claim on inbound tokens. |
| `ENTRA_REDIRECT_URI` | `http://localhost:5173/auth/callback` | OAuth redirect — must match the app registration. |
| `ENTRA_POST_LOGOUT_URI` | `http://localhost:5173/login` | Where Entra returns the user after sign-out. |
| `ENTRA_GROUP_CLAIM` | `groups` | JWT claim that contains group memberships. |
| `ENTRA_GROUP_ROLE_MAP` | empty | Comma-separated `<group-guid>:<ROLE>` pairs. Roles: `SYS_ADMIN`, `GLOBAL_USER`, `REGIONAL_USER`, `DISTRICT_USER`. |
| `ENTRA_AUTO_SYNC` | `false` | Enable hourly Microsoft Graph user-provisioning cron. |

### 3.6 MFA & encryption

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `MFA_ISSUER` | `ECG-SHE` | Label shown in TOTP authenticator apps. |
| `DATA_ENCRYPTION_KEY` | dev-only default | Current AES-256-GCM key for health notes and MFA secrets (≥ 32 chars). Production rejects the dev default and the `.env.example` placeholder. |
| `DATA_ENCRYPTION_KEY_PREVIOUS` | empty | Comma-separated retired keys. They open old rows and never encrypt new ones. |
| `SMTP_TLS` | `true` | When mail is configured, require TLS 1.2 or newer and check the server certificate. |

### 3.7 Storage

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `STORAGE_DRIVER` | `local` | `local` \| `s3` \| `azure-blob`. |
| `STORAGE_LOCAL_PATH` | `./uploads` | Where the local driver writes files. |
| `AZURE_STORAGE_ACCOUNT` | empty | Azure Blob storage account. |
| `AZURE_STORAGE_CONTAINER` | empty | Default container name. |
| `AZURE_STORAGE_KEY` | empty | Storage account key. |

### 3.8 Mail / push

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `SMTP_HOST` | empty | SMTP server hostname. Empty = email channel disabled. |
| `SMTP_PORT` | `587` | |
| `SMTP_USER` | empty | |
| `SMTP_PASS` | empty | |
| `SMTP_FROM` | `no-reply@ecg.com.gh` | Default From header. |
| `VAPID_PUBLIC_KEY` | empty | Web-push public key (front-end uses `VITE_VAPID_PUBLIC_KEY` mirror). |
| `VAPID_PRIVATE_KEY` | empty | Web-push private key. |
| `VAPID_SUBJECT` | `mailto:she@ecg.com.gh` | Web-push contact mailto. |

---

### 3.9 Secret handling

Passwords are stored as Argon2id hashes. Session secrets and refresh tokens are stored as SHA-256 hashes. Health notes and MFA seeds are stored as AES-256-GCM ciphertext from Node's `crypto` module. New random values come from `crypto.randomBytes`.

**Access.** Keep `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATA_ENCRYPTION_KEY`, `DATA_ENCRYPTION_KEY_PREVIOUS`, `DB_PASSWORD`, `ENTRA_CLIENT_SECRET`, and `AZURE_STORAGE_KEY` in Azure Key Vault. The API App Service reads them through Key Vault references. The web app does not receive them. Do not commit them, print them in logs, or bake them into an image.

**Backup.** Turn on Key Vault soft-delete and purge protection so a deleted key can be restored. A database backup does not contain the encryption key. Losing `DATA_ENCRYPTION_KEY` and every previous key makes existing health notes and MFA seeds unreadable.

**Rotation.**

1. Generate a new value with a password manager or `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
2. For the encryption key, copy the current `DATA_ENCRYPTION_KEY` into `DATA_ENCRYPTION_KEY_PREVIOUS`, then set the new value as `DATA_ENCRYPTION_KEY`. Restart the API. New rows use the new key. Old rows still open.
3. Remove a previous key only after those rows have been saved again, which rewrites them with the current key.
4. For a JWT secret, set the new value and restart. Outstanding access tokens stop working. Rotating `JWT_REFRESH_SECRET` is not required for session cookies; revoke sessions from Administration if a signing key is suspected stolen. Users sign in again.

**Revocation.** Remove a retired encryption key from `DATA_ENCRYPTION_KEY_PREVIOUS` once nothing still depends on it. To cut off a person, disable the account; that revokes their sessions on the next request. To cut off a stolen signing key, replace `JWT_ACCESS_SECRET` and restart.

### 3.10 Audit logs

Every audit row stores the actor, action, time, outcome (`SUCCESS` or `DENIED`), and the resource path or record id. Passwords, tokens, session ids, and free-text personal fields are replaced before the row is saved. The same replacement runs again when an administrator reads the trail.

The table is append-only. The API refuses updates and deletes, and each row's hash includes the previous row's hash. Reading the trail requires the `AUDIT_TRAIL_READ` permission.

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `AUDIT_RETENTION_DAYS` | `365` | Age after which a daily check warns that rows should be archived. The API does not delete them. |
| `AUDIT_ALERT_WINDOW_MINUTES` | `15` | Window for counting denied sign-ins and permission checks. |
| `AUDIT_ALERT_AUTH_FAILURES` | `10` | When denials in that window reach this count, the API writes one `SECURITY_ALERT` error line. Point the host's log alert at that text. |

Keep the log store on the same access rules as the database: only the API identity can write, and only people with `AUDIT_TRAIL_READ` can read it through the API. Ship API logs to the host's log service with its own retention and an alert on `SECURITY_ALERT`.

## 4. Variable reference (frontend / Vite)

Variables prefixed `VITE_` are inlined into the SPA bundle at build time.
Re-build (`npm run build --workspace=@ecg-she/web`) after changing any of
them.

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `VITE_API_BASE_URL` | `http://localhost:4000/api/v1` | Base URL the SPA hits for REST. |
| `VITE_WS_URL` | `http://localhost:4000` | WebSocket endpoint for real-time. |
| `VITE_VAPID_PUBLIC_KEY` | empty | Web-push public key (mirror of backend). |
| `VITE_MAP_TILE_URL` | OpenStreetMap | Leaflet tile-server URL template. |
| `VITE_ENTRA_TENANT_ID` | empty | Microsoft Entra tenant GUID. Empty = hide SSO button. |
| `VITE_ENTRA_CLIENT_ID` | empty | App registration GUID. |
| `VITE_ENTRA_AUDIENCE` | `api://<client-id>` | Token audience for the back-end API. |

---

## 5. How to override in each environment

### Local (developer laptop)

Edit `.env` at the repo root. The file is git-ignored — never commit secrets.

### Docker Compose

Set values inline in `docker-compose.yml` under the `api.environment` and
`web.environment` blocks, or rely on `env_file: .env`.

### Kubernetes (production)

1. Store secrets in **Azure Key Vault** and project them via the
   [Secret Store CSI driver](https://learn.microsoft.com/azure/aks/csi-secrets-store-driver).
2. Mount as env in `infra/k8s/api-deployment.yaml`.
3. Non-secret values go into a `ConfigMap`.

Never bake secrets into container images.

---

## 6. Validation

`config.schema.ts` validates the incoming environment with **Joi** at boot.
The application **fails fast** with a descriptive error if a required value
is missing or malformed.

To confirm your env passes validation without starting the full API:

```bash
node -r ts-node/register -e "import('./apps/api/src/config/config.schema').then(m => require('joi').attempt(process.env, m.configValidationSchema))"
```

---

## 7. Reset / wipe local state

| Goal | Command |
| ---- | ------- |
| Reset SQLite database | `rm -f data/ecg-she.db && npm run dev` |
| Reset Docker Postgres | `docker compose down -v && docker compose up -d postgres redis` |
| Re-run seed script (any DB) | `npm run db:seed --workspace=@ecg-she/api` |
| Force fresh schema (dev only) | set `DB_SYNCHRONIZE=true` for **one** boot |
| Free a stuck API port (Windows) | restart the API — the dev runner kills any process holding `:4000` automatically |
| Inspect legacy region orphans | `GET /api/v1/organizations/legacy/orphans` (sys-admin) — returns dependency counts |
| Prune a legacy region | `POST /api/v1/organizations/legacy/prune` `{ "codes": ["AS","WS"], "force": true }` (sys-admin, refuses to delete if any users / domain records still reference it) |

---

## 8. Dev runner

The API uses a small wrapper at `apps/api/scripts/dev.mjs` (invoked via
`npm run dev --workspace=@ecg-she/api`) that:

1. Kills any process currently listening on the API port (`API_PORT` /
   `PORT` / `4000`) before starting — prevents `EADDRINUSE` after a previous
   shell was killed without releasing the socket.
2. Spawns `nest start --watch`.
3. Restarts the watcher on unexpected exit, up to 5 times, with a 1.5 s
   backoff.

If you need the raw NestJS watch behaviour without the wrapper, use:

```bash
npm run dev:once --workspace=@ecg-she/api
```

To run on a non-default port:

```bash
API_PORT=4100 npm run dev --workspace=@ecg-she/api
```

(The same value is read by `main.ts` via the `PORT` env var when set.)

---

## 9. Organisational structure (seed reference)

The canonical region / district list is defined in
[`apps/api/src/database/seed-data.ts`](../apps/api/src/database/seed-data.ts)
and applied automatically on first boot by `BootstrapService`. After the
first boot it becomes idempotent: subsequent runs **rename** existing
regions / districts whose name has changed in the seed and **insert** new
ones, but never delete anything. Codes that no longer appear in the seed
are reported in the API logs as "legacy regions" and can be cleaned up via
the `POST /api/v1/organizations/legacy/prune` endpoint (sys-admin only,
refuses to delete records with active dependents).

| Region | Code | Districts |
| ------ | ---- | --------- |
| Accra East | `AE` | 9 (Adenta, Dodowa, Kwabenya, Legon, Makola, Akwapim Mampong, Roman Ridge, Teshie + HQ) |
| Accra West | `AW` | 9 (Ablekuma, Achimota, Amasaman, Bortianor, Dansoman, Kaneshie, Korle-Bu, Nsawam + HQ) |
| Ashanti East | `ASE` | 7 (Ayigya, Effiduase, Ejisu, Konongo, Kwabre, Mampong + HQ) |
| Ashanti West | `ASW` | 9 (Abuakwa, Adum, Ahinsan, Bibiani, Danyame, Kokoben, Suame, Offinso + HQ) |
| Ashanti South | `ASS` | 7 (Asokwa, Bekwai, Dunkwa, Manso Nkwanta, New Edubiase, Obuasi + HQ) |
| Central | `CR` | 11 (Agona Swedru, Ajumako, Assin Foso, Breman Asikuma, Cape Coast, Kasoa N/S, Saltpond, Twifu Praso, Winneba + HQ) |
| Eastern | `ER` | 15 (Akim Oda, Akim Tafo, Akwatia, Asamankese, Asesewa, Begoro, Donkorkrom, Kade, Kibi, Koforidua, Mpraeso, New Abirem, Nkawkaw, Suhum + HQ) |
| Tema | `TR` | 10 (Ada, Afienya, Ashaiman, Juapong, Krobo, Nungua, Prampram, Tema N/S + HQ) |
| Volta | `VR` | 12 (Akatsi, Dambai, Denu, Ho, Hohoe, Jasikan, Keta, Kpandu, Kpeve, Nkwanta, Sogakope + HQ) |
| Western | `WR` | 13 (Agona, Asankragua, Axim, Bogoso, Enchi, Half Assini, Sefwi Wiawso, Juabeso, Sekondi, Takoradi, Tarkwa + HQ) |
| Subtransmission Accra (central unit) | `STA` | Control / Substation / Network / Protection Maintenance |
| Subtransmission Ashanti (central unit) | `STH` | Control / Substation / Network / Protection Maintenance |
| Head Office Operations (central unit) | `HOO` | Projects Office HQ |

Central operating units are flagged with `centralUnit = true` on the
`regions` table and may be filtered separately in the UI.

---

## 10. Change log

| Date | Change | Author |
| ---- | ------ | ------ |
| 2026-10-19 | v8 — generic server error responses, denied-access audit rows, health-record read audit, append-only audit table, and retention and failure alerts. | Maintainers |
| 2026-10-19 | v7 — AES-256-GCM key versioning, previous-key decrypt, and TLS 1.2 with certificate checks for the database, Redis, and mail. | Maintainers |
| 2026-10-17 | v6 — production refuses published JWT / encryption secrets and `BOOTSTRAP_AUTOSEED=true`; `SWAGGER_ENABLED` gates the API docs (off in production). | Maintainers |
| 2026-06-06 | v5 — full ECG region/district seed (13 regions inc. 3 central operating units, 120 districts); idempotent re-seed in `BootstrapService` with rename support; `centralUnit` column on `regions`; admin endpoints `GET /organizations/legacy/orphans` + `POST /organizations/legacy/prune` for safe legacy cleanup; LoginPage now lists seeded test accounts in local-dev mode. | Maintainers |
| 2026-06-06 | v4 — module forms aligned with international standards: ISO 31000 (Hazards), ISO 45001 §10.2 / OSHA 301 / ICAM (Near Miss), OSHA JHA / ISO 45001 §6.1.2 (JSA), IOGP 189 / OSHA 1910.147 (PTW), ISO 45001 §8.1 / NFPA 70E (Inspections), ISO 19011 (Audits), ISO 14001 §6.1.2 (Environmental), ILO C161 / GDPR Art. 9 (Health), ISO 45001 §7.2 (Training), EN ISO / ANSI / NFPA 70E (PPE), ISO 9001 §10.2 (CAPA). New shared enums in `packages/shared/src/enums.ts`. | Maintainers |
| 2026-06-06 | v3 — replaced Postgres-only `date_trunc` / `ILIKE` with cross-DB `LOWER(...) LIKE` and JS-side date aggregation; added `apps/api/scripts/dev.mjs` resilient dev runner. | Maintainers |
| 2026-06-05 | v2 — added zero-config SQLite mode, `BOOTSTRAP_AUTOSEED`, `REDIS_ENABLED`, lenient defaults for JWT / DATA_ENCRYPTION_KEY. | Initial release |
| 2026-06-05 | v1 — added `DB_TYPE` driver selection and full `ENTRA_*` block. | Initial release |
