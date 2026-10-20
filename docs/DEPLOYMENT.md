# Deployment

## Prerequisites

- Node.js ≥ 20
- Docker ≥ 24 (and Docker Compose v2)
- PostgreSQL 16 with **PostGIS** + **citext** extensions
- Redis 7
- An S3-compatible object store (production)
- (optional) Kubernetes 1.27+ for production

## Local development

```bash
git clone <repo> ecg-she && cd ecg-she
cp .env.example .env

# Start the data services
docker compose up -d postgres redis

# Install everything
npm install

# Initialise schema + seed users / regions / districts
npm run db:migrate --workspace=@ecg-she/api
npm run db:seed    --workspace=@ecg-she/api

# Start the API + the web app together
npm run dev
```

- API: <http://localhost:4000/api/v1/docs>
- Web: <http://localhost:5173>

## Production builds

```bash
# Build images (from repository root)
docker compose build

# Run everything
docker compose up -d
```

The Compose file launches `postgres`, `redis`, `api` (NestJS) and `web`
(Nginx + built React SPA).

## Kubernetes

Manifests live under `infra/k8s/`. They expect:

- A **secret** `ecg-she-api-secrets` containing the API env vars
- An ingress controller (NGINX Ingress)
- cert-manager with a `letsencrypt-prod` ClusterIssuer

```bash
kubectl apply -f infra/k8s/namespace.yaml
kubectl -n ecg-she create secret generic ecg-she-api-secrets --from-env-file=.env
kubectl apply -f infra/k8s/api-deployment.yaml
kubectl apply -f infra/k8s/web-deployment.yaml
```

The API is fronted by an HPA that scales from 3 → 12 replicas based on CPU.

## Environment variables

See `.env.example` for the complete list. Important production overrides:

| Key                     | Production value                          |
| ----------------------- | ----------------------------------------- |
| `NODE_ENV`              | `production`                              |
| `DB_SSL`                | `true`                                    |
| `JWT_ACCESS_SECRET`     | ≥ 32 char random secret (rotate quarterly)|
| `JWT_REFRESH_SECRET`    | ≥ 32 char random secret                   |
| `DATA_ENCRYPTION_KEY`   | 32 byte base64 random key                 |
| `STORAGE_DRIVER`        | `s3`                                      |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | required for push notifications |

## Backups & DR

- **Postgres** — nightly logical (`pg_dump`) + WAL archiving to S3.
- **Object storage** — versioning + lifecycle to Glacier after 90 days.
- **RTO** target ≤ 4 h, **RPO** target ≤ 15 minutes.

## Hardening checklist

- [x] HTTPS-only (HSTS, secure cookies, `SameSite=Lax`)
- [x] Helmet headers (CSP, X-Frame, X-Content-Type, Referrer-Policy)
- [x] Rate limiting (`@nestjs/throttler` 200/min default)
- [x] Argon2id password hashing
- [x] AES-256-GCM at-rest encryption for sensitive fields
- [x] Tamper-evident audit log (hash-chained)
- [x] OWASP Top-10 review (regularly scheduled)
