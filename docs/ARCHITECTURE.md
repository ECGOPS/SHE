# Architecture — ECG SHE

How the Safety, Health and Environment application is put together. What each role can do, and how to run the system, is in [APPLICATION.md](APPLICATION.md).

## Runtime

```
        Browser (React PWA)
        phones, tablets, desktops
                 │  HTTPS
                 │  access token + HttpOnly refresh cookie
                 │  CSRF header on changes
                 │  Socket.IO  /ws
                 ▼
        NestJS API   /api/v1
        validation · sessions · RBAC · audit · PDF
                 │
        ┌────────┼─────────────┐
        ▼        ▼             ▼
   Database   Redis        File store
   sqlite     optional     local, S3, or
   postgres   in-memory    Azure Blob
   mssql      stub when
   mysql      disabled
   mariadb
   oracle
```

There is one web client. It is a Progressive Web App, so the same screens open on a laptop, a phone, or a field tablet. There is no separate mobile codebase.

Local development uses SQLite and does not need Redis. The production target in [AZURE_APP_SERVICE.md](AZURE_APP_SERVICE.md) is two Linux App Services and Azure SQL. Docker Compose can supply PostgreSQL and Redis. `infra/k8s/` contains Deployment manifests for the API and the web app. Those manifests do not include an ingress, an autoscaler, or certificate management.

## Layers

| Layer | What the code uses |
| --- | --- |
| Client | React 19, TypeScript, Vite, MUI 6, Tailwind, React Query |
| Offline | IndexedDB via Dexie, a Workbox service worker, and a replay queue |
| Realtime | Socket.IO namespace `/ws` |
| API | NestJS 10, TypeScript, class-validator, Swagger at `/api/v1/docs` |
| Shared contracts | `packages/shared` — roles, permissions, enumerations |
| Authentication | JWT access token (default 15 minutes), refresh cookie (default 7 days), Argon2id, TOTP MFA, CSRF |
| Sessions | Idle timeout default 30 minutes, absolute timeout default 12 hours, list and revoke |
| Authorisation | Eight roles, a fixed permission catalogue, place filter, and per-record checks |
| Persistence | TypeORM. Driver from `DB_TYPE`: `sqlite`, `postgres`, `mssql`, `mysql`, `mariadb`, `oracle` |
| Cache | Redis when `REDIS_ENABLED=true`. Otherwise an in-memory stub in this process |
| Files | `STORAGE_DRIVER`: `local` (default), `s3`, or `azure-blob` |
| Encryption | AES-256-GCM for health notes and MFA seeds. TLS 1.2 with certificate checks for a networked database |
| Logs | Nest logger. Security events use the `SECURITY_ALERT` line. There is no Prometheus or OpenTelemetry exporter in the API |

SQLite synchronises the schema on startup. The other engines are expected to use migrations. A networked database in production requires `DB_SSL=true`.

## Request path

1. `RequestContextMiddleware` stores the actor and the server tenant. The `x-tenant-id` header is ignored.
2. `ValidationPipe` accepts only declared fields. A bad field returns `VALIDATION_ERROR` and does not echo the rejected value.
3. Changing requests must present a matching CSRF token.
4. `JwtAuthGuard` reloads the user. An inactive or locked account is rejected.
5. `ScopeGuard` checks the permission required by the route. Stored permissions are intersected with the role catalogue, so a client cannot widen its own role.
6. The service applies `RbacScopeService` on lists and `assertRecordAccess` on a single record. A record outside the caller’s place or ownership is returned as not found.
7. `AuditTrailInterceptor` records a successful change, a successful sign-in, and a marked sensitive read.
8. `GlobalExceptionFilter` is the only exception handler. Status 500 becomes “Internal server error”. Status 401 and 403 are written to the audit trail as `DENIED`.

## Authorisation

Every scoped record carries `tenantId`, `regionId`, and an optional `districtId`. The tenant is the server constant `ecg`.

| Role | List filter |
| --- | --- |
| System administrator, Head Office staff, Head Office safety officer | Any row in the tenant |
| Regional safety officer | `regionId` matches the officer |
| Regional staff | Their region, plus rows they own outside that region |
| District safety officer | `regionId` and `districtId` match the officer |
| District staff | Their district, plus rows they own outside that district |
| Staff | Rows they own |

On write, staff and the two reporting roles must choose the region and district where the event happened. A safety officer cannot move a record into another place: the assigned region and district are written for them.

`ScopeGuard` answers “may this role call this route?”. `assertRecordAccess` answers “may this person open this row?”. Both run on direct API calls.

Role assignment and account disable are server-side. They replace the permission set from `ROLE_PERMISSIONS` and revoke that user’s sessions. Five failed passwords lock the account for 15 minutes and revoke its sessions.

## Audit trail

`audit_logs` is append-only. A TypeORM subscriber refuses updates and deletes. Each row stores `prevHash` and a SHA-256 `hash` of the previous hash plus the actor, action, resource, method, outcome, and redacted payload.

The interceptor records `SUCCESS` for mutating requests and for reads marked `@Audit`, including `HEALTH_READ` and a successful `AUTH_LOGIN`. The exception filter records `DENIED` for authentication failures, permission denials, and CSRF rejections, and `FAILURE` for a server error on a signed-in change.

The stored payload keeps identifiers such as ids, role, region, and district. Passwords, tokens, session ids, and free-text personal fields are replaced before insert and again when the trail is listed. Listing requires `audit-trail:read`.

Rows are not deleted when they age past `AUDIT_RETENTION_DAYS`. A daily job writes a warning so an operator can archive a copy. Ten denials inside `AUDIT_ALERT_WINDOW_MINUTES` write one `SECURITY_ALERT` log line.

## Offline

The web client keeps drafts and a FIFO queue in IndexedDB (`apps/web/src/offline/queue.ts`). When the browser fires `online`, `flushOfflineQueue()` replays the queue.

Incidents, hazards, near misses, and job safety analyses accept `offlineClientId`. `POST /incidents/sync` replays a batch and returns the client ids that were already stored as conflicts. The caller resolves those by hand.

## Realtime

`RealtimeGateway` checks the access token and then joins rooms:

| Caller | Rooms |
| --- | --- |
| System administrator, Head Office staff, Head Office safety officer | `global` and `user:<id>` |
| Regional staff and regional safety officer | `region:<regionId>` and `user:<id>` |
| District staff and district safety officer | `district:<districtId>` and `user:<id>` |
| Staff | `user:<id>` only |

`emitToScope()` sends to `global`, the region room, and the district room when a district is present. `apps/web/src/hooks/useRealtime.ts` listens for `incident:created`, `incident:pending-approval`, `hazard:high-risk`, `capa:overdue`, and `notification:new`, and invalidates the matching React Query caches.

## Escalation

Incidents, hazards, near misses, and corrective actions carry an escalation tier: District, Region, Head Office. A new issue starts at the reporter’s tier. Escalate moves up the ladder. Refer down moves it back. Resolve, reopen, and reassign stay available to the officer who can see the record. The safety officer console reads this status for the officer’s scope.

## Compliance mapping

| Practice | Where it shows up |
| --- | --- |
| ISO 45001 | Incidents, hazards, job safety analysis, inspections, audits, training, corrective actions |
| ISO 14001 | Environmental events and the ISO 14001 audit type |
| ISO 31000 | 5×5 likelihood × severity score on hazards |
| OSHA 1910.269 and permit practice | Permit types, including electrical and isolation |
| Ghana Data Protection Act / GDPR-style care | Health notes and MFA seeds encrypted at rest. Audit payloads drop unnecessary personal text. Business rows use soft delete, which keeps the row and the audit history |

## Repository

```
apps/api          NestJS API
apps/web          React PWA
packages/shared   Roles, permissions, enumerations
docs              This note and the operating guides
infra/k8s         API and web Deployment manifests
```
