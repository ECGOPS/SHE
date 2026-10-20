# API specification

The full, interactive OpenAPI 3 documentation is served by the application at:

```
http://localhost:4000/api/v1/docs
```

Below is a high-level summary of the most important endpoints. **All endpoints
return `{ success: true, data: <T>, timestamp }`** envelopes (or
`{ success: false, statusCode, code, message }` on errors).

## Authentication

| Method | Path                  | Body                            | Description                  |
| ------ | --------------------- | ------------------------------- | ---------------------------- |
| POST   | `/auth/login`         | `{ email, password, mfaCode? }` | Issue access + refresh JWT   |
| POST   | `/auth/refresh`       | `{ refreshToken }`              | Rotate the access token      |
| POST   | `/auth/logout`        | —                               | Invalidate the refresh token |
| POST   | `/auth/mfa/setup`     | —                               | Provision TOTP secret + QR   |
| POST   | `/auth/mfa/verify`    | `{ code }`                      | Activate MFA for the account |
| GET    | `/auth/session`       | —                               | Fetch the active user       |

## Organization

| Method | Path                                | Description |
| ------ | ----------------------------------- | ----------- |
| GET    | `/organizations/regions`            | List regions (with districts) |
| POST   | `/organizations/regions`            | (Admin) Create region |
| GET    | `/organizations/districts?regionId` | List districts |
| POST   | `/organizations/districts`          | (Admin) Create district |

## Users

| Method | Path           | Description                          |
| ------ | -------------- | ------------------------------------ |
| GET    | `/users/me`    | Current authenticated profile        |
| GET    | `/users`       | List users in scope (USER_MANAGE)    |
| POST   | `/users`       | (Admin) Create user                  |

## Incidents (full RBAC, offline-first)

| Method | Path                          | Description                                     |
| ------ | ----------------------------- | ----------------------------------------------- |
| GET    | `/incidents`                  | List with filters (`type`, `severity`, `status`, dates, scope) |
| GET    | `/incidents/stats`            | Counters for the current scope                  |
| GET    | `/incidents/:id`              | Detail with witnesses, findings, attachments    |
| POST   | `/incidents`                  | Create (also accepts `offlineClientId`)         |
| POST   | `/incidents/sync`             | Bulk-replay offline batch                       |
| POST   | `/incidents/:id/assign`       | Assign investigator                             |
| POST   | `/incidents/:id/submit`       | Move to `PENDING_APPROVAL`                      |
| POST   | `/incidents/:id/close`        | Close (approver permission)                     |

## Hazards

| Method | Path        | Description                                |
| ------ | ----------- | ------------------------------------------ |
| GET    | `/hazards`  | Paginated list                             |
| GET    | `/hazards/stats` | Counts grouped by `riskClass`         |
| POST   | `/hazards`  | Submit (auto-classifies via 5×5 matrix)    |

## Corrective actions

| Method | Path                                 | Description |
| ------ | ------------------------------------ | ----------- |
| GET    | `/corrective-actions`                | Paginated list |
| GET    | `/corrective-actions/stats`          | Status counts + overdue |
| POST   | `/corrective-actions`                | Create |
| PATCH  | `/corrective-actions/:id/progress`   | Update progress / evidence |
| POST   | `/corrective-actions/:id/verify`     | Verify and close |

## Permit-to-Work · JSA · Inspections · Audits · Environmental · Health · Training · PPE

All follow the same shape: `GET /:resource`, `POST /:resource`,
`GET /:resource/:id`, plus module-specific transitions (e.g. `/ptw/:id/approve`).

## Reports

| Method | Path                          | Format |
| ------ | ----------------------------- | ------ |
| GET    | `/reports/incidents/excel`    | XLSX   |
| GET    | `/reports/incidents/pdf`      | PDF    |

## Audit trail

| Method | Path             | Description |
| ------ | ---------------- | ----------- |
| GET    | `/audit-trail`   | Tamper-evident hash-chained log (Global / Admin only) |

## Real-time events (Socket.IO `/ws`)

Authenticate by passing the access token via either:

```js
io('/ws', { auth: { token } });
```

Events emitted by the server:

| Event                         | Payload (excerpt)                            |
| ----------------------------- | -------------------------------------------- |
| `incident:created`            | `{ id, title, severity, type, ... }`         |
| `incident:pending-approval`   | `{ id }`                                     |
| `hazard:high-risk`            | `{ id, title, riskClass, riskScore }`        |
| `capa:overdue`                | `{ id, title, dueDate }`                     |
