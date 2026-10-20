# Administrator Manual

## 1. Roles

| Role            | Hierarchy | Default permissions                                |
| --------------- | --------- | -------------------------------------------------- |
| `SYS_ADMIN`     | 100       | Everything                                         |
| `GLOBAL_USER`   | 75        | Read all + national reports + audit trail          |
| `REGIONAL_USER` | 50        | Read & write within region; approve incidents/JSAs |
| `DISTRICT_USER` | 25        | Read & write within district                        |

## 2. Provisioning a new region or district

```bash
# Via the seed script (one-off)
npm run db:seed --workspace=@ecg-she/api

# Via the API (preferred, audited)
curl -X POST http://localhost:4000/api/v1/organizations/regions \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "code": "WS", "name": "Western South" }'

curl -X POST http://localhost:4000/api/v1/organizations/districts \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "regionId": "<uuid>", "code": "TKR", "name": "Takoradi" }'
```

## 3. Provisioning users

```bash
curl -X POST http://localhost:4000/api/v1/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "kojo@ecg.com.gh",
    "fullName": "Kojo Asante",
    "password": "TemporaryPwd!9",
    "role": "REGIONAL_USER",
    "regionId": "<uuid>"
  }'
```

The first time the user logs in they will be prompted to change their password
and set up MFA. After 5 failed login attempts the account is locked for 15 min.

## 4. Permissions

The default permission set per role is defined in
`packages/shared/src/rbac.ts`. You can override per-user permissions via the
admin API (`PATCH /users/:id` — coming in the next release).

## 5. Audit trail

Available at `/audit-trail` (Global / Admin only). The chain is verified by
re-computing each entry's SHA-256 over the previous hash + payload. To verify
externally, dump the table to JSON and run the check script.

## 6. Backups & DR

- **Postgres** — `pg_dump` nightly to S3 (versioned, encrypted)
- **WAL archiving** — continuous to S3 for point-in-time recovery
- **Object storage** — bucket versioning + 90-day lifecycle to Glacier

Run `kubectl apply -f infra/k8s/cronjob-backup.yaml` to enable scheduled
backups in production.

## 7. Operational metrics

The API exposes Prometheus metrics on `/metrics` (private port). The web app
streams real-time SHE KPIs via the `/ws` Socket.IO namespace.

## 8. Common admin actions

| Action | How |
| ------ | --- |
| Disable a user | `PATCH /users/:id` `{ "active": false }` |
| Reset MFA | Admin removes `mfaEnabled` and the secret; user re-enrols |
| Force re-auth | Rotate `JWT_ACCESS_SECRET` (refresh tokens auto-invalidate) |
| Purge old data | Soft-delete via API; physical purge via DB job (compliance window) |
