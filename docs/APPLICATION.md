# ECG SHE — Application guide

This is the full description of the Safety, Health and Environment system built for the Electricity Company of Ghana. It covers what the application does, who uses it, how the pieces fit together, and how to run it. Shorter guides for one topic are listed at the end.

## 1. Purpose

ECG SHE is the register and workflow for safety, health, and environmental work across ECG. Staff report what happened. Safety officers investigate, assign, approve, and escalate. Head Office reviews the national picture. A system administrator provisions people and places.

The work follows the practices in ISO 45001 (occupational health and safety), ISO 14001 (environment), and the electrical-utility controls used for permits, isolation, and job safety analysis.

## 2. What a person sees

The web application runs in the browser at `http://localhost:5173` in local development. After sign-in, the left navigation shows only the areas that role may open.

| Area | Path | Who uses it |
| --- | --- | --- |
| Dashboard | `/dashboard` | Safety officers, Head Office, system administrator |
| Safety officer console | `/console` | District, regional, and Head Office safety officers, and the system administrator |
| Incidents | `/incidents` | Everyone who reports or investigates |
| Near miss | `/near-miss` | Everyone who reports or investigates |
| Hazards | `/hazards` | Everyone who reports or investigates |
| Job safety analysis | `/jsa` | Everyone who reports or investigates |
| Permit to work | `/ptw` | Everyone who reports or investigates |
| Environmental events | `/environmental` | Everyone who reports or investigates |
| Inspections | `/inspections` | Reporters and safety officers |
| Corrective actions | `/capa` | Safety officers and above |
| Audits | `/audits` | District officers, regional officers, Head Office, administrator |
| Reports | `/reports` | District officers, regional officers, Head Office, administrator |
| Occupational health | `/health` | Safety officers and Head Office |
| Training | `/training` | Safety officers and Head Office |
| PPE | `/ppe` | Safety officers and Head Office |
| Audit trail | `/audit-trail` | Head Office safety officer, system administrator |
| Administration | `/admin` | System administrator |

Staff land on Incidents. Officers land on the Dashboard.

Detail pages sit under the same paths, for example `/incidents/:id` and `/incidents/new`. A record page can export a PDF. The report header carries the ECG crest. The footer reads ECG SAFETY HEALTH ENVIRONMENT MANAGEMENT.

## 3. Roles

A role decides two things: the job the person may do, and the part of ECG they may see. Permissions are fixed on the server from the role. A client cannot grant itself extra permissions.

| Role | Label | Scope | Main work |
| --- | --- | --- | --- |
| `SYS_ADMIN` | System administrator | Whole organisation | Users, places, every module |
| `GLOBAL_SAFETY_OFFICER` | Head Office safety officer | Whole organisation | Approve and close, national registers, audit trail |
| `HEAD_OFFICE_SHE` | Head Office SHE | Whole organisation | Same as Head Office safety officer |
| `GLOBAL_USER` | Head Office staff | The place chosen on each report | Report incidents like regional and district staff |
| `REGIONAL_SAFETY_OFFICER` | Regional safety officer | One region | Investigate, approve, and manage that region |
| `REGIONAL_USER` | Regional staff | One region, and any place they choose when reporting | Report incidents and related records |
| `DISTRICT_SAFETY_OFFICER` | District safety officer | One district | Investigate and assign inside that district |
| `DISTRICT_USER` | District staff | One district, and any place they choose when reporting | Report incidents and related records |
| `STAFF` | Staff | The place chosen on each report | Report incidents, hazards, near misses, JSA, permits, inspections, and environmental events |

Staff, Head Office staff, district staff, and regional staff pick the region and district on the report. Safety officers stay inside the place an administrator assigned. Only Head Office safety and the administrator see every region.

A person only receives a record that belongs to their place, or a record they own. Asking for someone else’s record returns “not found”, so the response does not reveal that the record exists. Changing a role, disabling an account, or locking an account after repeated bad passwords revokes that person’s sessions.

## 4. Organisation

The seed loads ECG’s operating structure: the geographical regions, a regional office district in each, and three central units (Subtransmission Accra, Subtransmission Ashanti, and Head Office Operations).

| Code | Region |
| --- | --- |
| `AE` | Accra East |
| `AW` | Accra West |
| `ASE` | Ashanti East |
| `ASW` | Ashanti West |
| `ASS` | Ashanti South |
| `CR` | Central |
| `ER` | Eastern |
| `TR` | Tema |
| `VR` | Volta |
| `WR` | Western |
| `STA` | Subtransmission Accra |
| `STH` | Subtransmission Ashanti |
| `HOO` | Head Office Operations |

District codes sit under those regions. Makola is `AE` / `MAK`. Ablekuma is `AW` / `ABL`. The full list is in `apps/api/src/database/seed-data.ts`.

## 5. Modules

### Incidents

Types include injury, fatality, property damage, vehicle accident, electrical shock, fire, environmental, and other. Severity runs from negligible to catastrophic.

Status moves through draft, reported, under investigation, pending approval, closed, or rejected. A safety officer assigns or reassigns an investigator from the incident page. The same action replaces the current investigator. Assigning a reported or draft incident moves it to under investigation.

### Near miss

Categories are unsafe act, unsafe condition, and potential incident. An anonymous report is stored without the reporter’s identity in the audit payload.

### Hazards

Categories cover electrical, mechanical, chemical, ergonomic, biological, physical, psychosocial, and environmental. The score is likelihood times severity on a 5×5 matrix.

| Score | Class |
| --- | --- |
| 1–4 | Low |
| 5–9 | Medium |
| 10–16 | High |
| 17–25 | Extreme |

### Job safety analysis and permit to work

A JSA records the job, the hazards, and the controls before work starts. A permit is one of electrical, hot work, excavation, confined space, working at height, or isolation. Permit status runs from draft through approval, active, suspended, closed, rejected, or expired.

### Inspections and audits

Inspections cover substations, offices, vehicles, transformers, lines, PPE, and general checks. Audits are internal, external, ISO 45001, ISO 14001, or regulatory, and move from planned to in progress, reporting, and closed.

### Environmental events

Event types are oil spill, waste disposal, pollution, noise, and emission.

### Occupational health, training, and PPE

Health records and their PDF reports are sensitive. Opening one is written to the audit trail as `HEALTH_READ`. Training holds courses and classes. PPE holds items and issues. Withdrawing PPE or opening a training certificate checks that the caller may see that record.

### Management system

The management system page is where ISO 45001 and ISO 14001 are evidenced beyond the operational registers. Hazards, job safety analysis, permits, inspections, training, incidents, audits, corrective actions, and environmental events already cover hazard control, competence, monitoring, investigation, and corrective action.

The page keeps the records those registers do not: the safety and environmental policies, the scope, interested parties, legal and other requirements with a compliance result, objectives, environmental aspects and whether each is significant, management of change, emergency plans and drills, management review, worker consultation, and contractor controls. Head Office approves the policy and the scope. A management review is recorded by the region or Head Office. Any worker can file a consultation.

An internal audit starts with the numbered subclauses of both standards. The auditor marks each one conform, nonconform, or not applicable.

### Corrective actions

Status moves from open to assigned, in progress, verification, and closed. An action can also be overdue or rejected.

### Escalation

Incidents, hazards, near misses, and corrective actions can move on a ladder: District, Region, Head Office. A new issue starts at the reporter’s tier. District and regional staff may use the ladder. Actions are escalate, refer down, resolve, reopen, and reassign. The safety officer console shows escalation status for the issues in that officer’s scope.

### Dashboard, console, and reports

The dashboard is the management picture for officers and Head Office. The console is the working list for safety officers, loaded in pages so a large register stays usable. The reports page exports the register to Excel or PDF. Lists throughout the API are paged on the server.

### Administration and audit trail

Administration creates users and assigns roles. The role’s permission set is applied on the server. The audit trail lists who did what. It is available to Head Office and the system administrator.

## 6. How a request is handled

```
Browser (React, Vite, MUI)
        │  HTTPS, cookie session, CSRF header
        ▼
NestJS API  /api/v1
        │  JWT, role permissions, place and ownership checks
        ▼
Database (SQLite locally, Azure SQL or another engine in deployment)
```

The repository is an npm workspace:

| Path | What it is |
| --- | --- |
| `apps/api` | NestJS API. Validation, auth, modules, PDF, audit trail. |
| `apps/web` | React application. |
| `packages/shared` | Roles, permissions, and enumerations used by both. |
| `docs` | This guide and the specialist guides. |

Successful responses use `{ success, data, timestamp }`. Errors use `{ success: false, statusCode, code, message, path, timestamp }`. A server fault returns “Internal server error” and does not include the database message or a stack trace. Field validation errors name the field and do not echo the rejected value.

## 7. Security

| Control | What it does |
| --- | --- |
| Passwords | Argon2id hashes. Five failures lock the account for 15 minutes and revoke its sessions. |
| Sessions | Access token about 15 minutes. Refresh cookie is HttpOnly, SameSite Lax, path `/api/v1/auth`. Idle and absolute timeouts apply. Sessions can be listed and revoked. |
| CSRF | Cookie `ecg_she_csrf` and header `X-CSRF-Token` on changing requests. The deployed SPA calls `/api/v1` on the same host so iPhone Safari can store that cookie. |
| Fresh authentication | Role changes, password changes, and similar privileged actions require a recent sign-in. |
| Least privilege | Every object is checked for tenant, place, and ownership. Direct API calls are refused the same way as the screens. |
| Cryptography | AES-256-GCM for health notes and MFA seeds. New ciphertext uses the whole key. A previous key can still open old rows during rotation. Random values come from Node’s CSPRNG. |
| TLS | A networked database in production requires `DB_SSL=true`. The connection checks the certificate and refuses TLS below 1.2. The same bar applies to Redis and mail when those TLS flags are on. |
| Secrets | Production refuses published JWT and encryption defaults. Keys belong in a secret store such as Azure Key Vault. |
| Browser | Content Security Policy and escaped output. Downloads are served as files, not as pages the browser will run. |
| Audit | Sign-in failures, permission denials, administrative changes, and health-record reads are logged with actor, action, time, outcome, and resource id. Passwords, tokens, session ids, and free-text personal data are removed. Rows are append-only and hash-chained. The API refuses updates and deletes. |
| Retention and alerts | `AUDIT_RETENTION_DAYS` (default 365) warns when rows should be archived. It does not delete them. Ten denials in 15 minutes write one `SECURITY_ALERT` line. |

The tenant is fixed by the server. A client header cannot switch the caller into another organisation.

## 8. Data

`DB_TYPE` selects the engine: `sqlite`, `postgres`, `mssql`, `mysql`, `mariadb`, or `oracle`. If it is omitted and `DB_HOST` is set, the API uses PostgreSQL. Otherwise it uses SQLite.

Local development uses SQLite at `apps/api/data/ecg-she.db`. That file is created and seeded on first start when `BOOTSTRAP_AUTOSEED` is on. SQLite is for a developer machine. Azure App Service has ephemeral disk, so production uses a networked database. The Azure guide uses Azure SQL (`mssql`) as the example. The server name, login, and database name in that guide are examples and can be changed.

Redis is optional. When `REDIS_ENABLED` is false, the API uses an in-memory stand-in. Mail is sent only when `SMTP_HOST` is set.

Every business record carries `createdBy`, `createdAt`, `updatedBy`, `updatedAt`, and soft-delete columns, filled from the request. The audit log is separate and cannot be edited.

## 9. Run it locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

| Service | Address |
| --- | --- |
| Web | http://localhost:5173 |
| API | http://localhost:4000/api/v1 |
| OpenAPI | http://localhost:4000/api/v1/docs |

The API and the web app can also be started on their own:

```bash
npm run dev --workspace=@ecg-she/api
npm run dev --workspace=@ecg-she/web
```

On a LAN, open the web app from the machine’s address, for example `http://10.x.x.x:5173`. The API allows that browser origin in local development.

Delete `apps/api/data/ecg-she.db` and start the API again to rebuild the local database and the seed accounts. Set `BOOTSTRAP_AUTOSEED=false` before any shared or production environment.

### Local accounts

These accounts exist only for development. Change them before anyone else can reach the API.

| Person | Email | Password |
| --- | --- | --- |
| System administrator | `admin@ecg.com.gh` | `Admin@123` |
| Head Office staff | `global@ecg.com.gh` | `Global@123` |
| Regional staff | `accra.east@ecg.com.gh`, `accra.west@ecg.com.gh`, and one account per other region | `Region@123` |
| District staff | `makola@ecg.com.gh`, `adum@ecg.com.gh` | `District@123` |
| Head Office safety officer | `she.global@ecg.com.gh` | `Safety@123` |
| Head Office SHE | `she.ho@ecg.com.gh` | `Safety@123` |
| Regional safety officer | `she.<region>@ecg.com.gh`, for example `she.aw@ecg.com.gh` | `Safety@123` |
| District safety officer | `she.<region>.<district>@ecg.com.gh`, for example `she.aw.abl@ecg.com.gh` | `Safety@123` |

Microsoft Entra ID is optional. `AUTH_PROVIDER` may be `local`, `entra`, or `hybrid`. The registration steps are in [ENTRA_ID.md](ENTRA_ID.md).

## 10. Deploy

The intended production layout is two Linux App Services (API and web) and Azure SQL. The web build bakes in the API address. The API reads secrets from Key Vault references. Step-by-step commands, firewall, and container build are in [AZURE_APP_SERVICE.md](AZURE_APP_SERVICE.md).

Docker Compose can run PostgreSQL and Redis for a developer who does not want SQLite. The variable reference for every mode is [CONFIGURATION.md](CONFIGURATION.md).

## 11. Standards the modules follow

| Module | Practice |
| --- | --- |
| Hazards and JSA | ISO 31000 risk matrix, ISO 45001 job hazard analysis |
| Incidents and near miss | ISO 45001 investigation, OSHA-style incident record |
| Permits | Electrical isolation and permit-to-work practice, including OSHA 1910.269 utility work |
| Inspections | ISO 45001 operational control |
| Audits | ISO 19011, plus ISO 45001 and ISO 14001 audit types |
| Environment | ISO 14001 |
| Health | Occupational health record, Ghana Data Protection Act and GDPR-style care for special-category data |
| Training | ISO 45001 competence |
| PPE | Issue and return of protective equipment |
| Corrective actions | ISO 9001 / ISO 45001 corrective action |
| Audit trail | Tamper-evident record of security and administrative events |

## 12. Other documents

| Document | Contents |
| --- | --- |
| [DATA_PROTECTION.md](DATA_PROTECTION.md) | Personal-data inventory, access, correction, erasure, backups, and Ghana Act 843 transfers |
| [CONFIGURATION.md](CONFIGURATION.md) | Every environment variable, secret rotation, audit retention |
| [AZURE_APP_SERVICE.md](AZURE_APP_SERVICE.md) | Deploy the API and web app on Azure |
| [ENTRA_ID.md](ENTRA_ID.md) | Microsoft Entra ID sign-in |
| [API.md](API.md) | Endpoint summary. The live list is the OpenAPI page. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Earlier architecture sketch |
| [DATABASE.md](DATABASE.md) | Database engines |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Docker and general deployment notes |
| [USER_MANUAL.md](USER_MANUAL.md) | Short end-user steps |
| [ADMIN_MANUAL.md](ADMIN_MANUAL.md) | Short administrator steps |
