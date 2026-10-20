# ECG SHE — Enterprise Safety, Health & Environment Management System

A world-class Safety, Health & Environment (SHE) management platform built for the **Electricity Company of Ghana (ECG)**.

Aligned with **ISO 45001**, **ISO 14001**, **ILO OSH Guidelines**, and electrical-utility hazard management best practice. Designed to compete with **Enablon, Intelex, Cority and VelocityEHS**.

---

## Highlights

- **Hierarchical RBAC** — National → Region → District scoping is enforced at the API layer.
- **14 SHE modules** — Incidents, Near Miss, Hazards, JSA, Permit-To-Work, Inspections, Audits, Environmental, Occupational Health, Training, PPE, Corrective Actions, Reporting, Audit Trail.
- **Microsoft Entra ID SSO** — OAuth 2.0 / OpenID Connect / SAML via MSAL; automatic user provisioning from Microsoft Graph; group-to-role mapping. No local passwords required.
- **Database-agnostic** — Single TypeORM data layer; production-ready for **Azure SQL Database**, SQL Server, PostgreSQL, MySQL/MariaDB and Oracle. Engine selected via `DB_TYPE`.
- **Multi-tenant ready** — `tenantId` column + scope helper on every record.
- **Mandatory audit columns** — `createdBy/At`, `updatedBy/At`, `deletedBy/At` populated automatically via TypeORM subscriber + AsyncLocalStorage request context.
- **Real-time** — WebSocket notifications, live dashboards, push notifications.
- **Offline-first PWA** — Installable on Windows / macOS / Linux / Android / iOS, with background sync and conflict resolution.
- **Enterprise security** — Entra ID + MSAL, JWT + refresh, MFA, AES-256 at rest, OWASP Top-10 hardening, tamper-evident audit trail.
- **Cloud-native** — Docker Compose for dev, Kubernetes-ready for production, CI/CD friendly.

---

## Repository layout

```
SHE/
├── apps/
│   ├── api/                # NestJS 10 backend (TypeScript, TypeORM, PostgreSQL, Redis, Socket.IO)
│   └── web/                # React 19 PWA (Vite, MUI v6, Tailwind, Workbox)
├── packages/
│   └── shared/             # Shared TypeScript types, DTOs, RBAC contracts
├── docs/                   # Architecture, DB schema, API spec, deployment, manuals
├── infra/                  # K8s manifests, nginx config
├── docker-compose.yml      # Local dev stack (api, web, postgres, redis)
├── .env.example
└── package.json            # npm workspaces root
```

---

## Quick start — zero-config local mode (Azure / Entra ID NOT required)

The application ships with a **pre-configured `.env`** that uses an embedded
**SQLite** database, an in-memory Redis stub, and **local username/password
login**. You can start testing in two commands without Postgres, Docker,
Azure SQL, or a Microsoft Entra ID tenant.

```bash
# 1. Install dependencies (one time)
npm install

# 2. Start API (http://localhost:4000) and Web (http://localhost:5173)
npm run dev
```

On first start the API will:

1. Create `./data/ecg-she.db` (SQLite file)
2. Synchronise the schema for every entity
3. Seed Ghana regions, districts, and the test user accounts below

Open http://localhost:5173 and sign in with any of the accounts below.

### Test accounts (auto-seeded)

| Role     | Email                    | Password      | Scope                |
| -------- | ------------------------ | ------------- | -------------------- |
| SysAdmin | admin@ecg.com.gh         | Admin@123     | Everything           |
| Global   | global@ecg.com.gh        | Global@123    | All regions          |
| Regional | accra.east@ecg.com.gh    | Region@123    | Accra East region    |
| Regional | accra.west@ecg.com.gh    | Region@123    | Accra West region    |
| District | makola@ecg.com.gh        | District@123  | Makola district      |
| District | kumasi@ecg.com.gh        | District@123  | Kumasi East district |

> Disable auto-seeding in production by setting `BOOTSTRAP_AUTOSEED=false`.

### Resetting the local database

Delete `./data/ecg-she.db` and restart `npm run dev` — schema and seed users
will be recreated automatically.

---

## Production / staging modes

When you are ready to point at a real database and Microsoft Entra ID,
update `.env` with the relevant values. The same codebase runs unchanged.

### Postgres via Docker Compose

```bash
docker compose up -d postgres redis
```
```dotenv
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=ecg_she
DB_PASSWORD=ecg_she_dev
DB_NAME=ecg_she
REDIS_ENABLED=true
```

### Azure SQL Database (production target)

```dotenv
DB_TYPE=mssql
DB_HOST=ecg-she.database.windows.net
DB_PORT=1433
DB_USERNAME=ecg_she_admin@ecg-she
DB_PASSWORD=<azure-sql-password>
DB_NAME=ecg_she
DB_SSL=true
```

### Local Azure SQL Edge for driver testing

```bash
docker compose --profile mssql up -d mssql
```

### Microsoft Entra ID SSO

Set `AUTH_PROVIDER=hybrid` (or `entra`) and fill the `ENTRA_*` and
`VITE_ENTRA_*` variables. See [docs/ENTRA_ID.md](docs/ENTRA_ID.md) for the
full app-registration walkthrough.

---

## Documentation

- [**Application guide**](docs/APPLICATION.md) — what the system does, who uses it, and how it is run
- [**Data protection**](docs/DATA_PROTECTION.md) — personal-data inventory, rights, backups, and cross-border transfers
- [**Configuration reference**](docs/CONFIGURATION.md) — every env var, every mode, kept in sync with the code
- [Architecture](docs/ARCHITECTURE.md)
- [Database & multi-driver setup](docs/DATABASE.md)
- [Microsoft Entra ID integration](docs/ENTRA_ID.md)
- [API specification](docs/API.md)
- [Deployment](docs/DEPLOYMENT.md)
- [User manual](docs/USER_MANUAL.md)
- [Administrator manual](docs/ADMIN_MANUAL.md)

---

## Standards & compliance

- ISO 45001:2018 — Occupational Health & Safety
- ISO 14001:2015 — Environmental Management
- ILO OSH 2001 Guidelines
- IEC 60364 / IEEE C2 — Electrical safety
- OSHA 1910.269 — Power generation, transmission and distribution
- GDPR / Ghana Data Protection Act 2012 (Act 843)

---

© Electricity Company of Ghana — SHE Directorate.
