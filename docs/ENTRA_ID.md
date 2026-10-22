# Microsoft Entra ID (Azure AD) Integration

> See [CONFIGURATION.md](./CONFIGURATION.md) for the full reference of every
> `ENTRA_*` and `VITE_ENTRA_*` environment variable, plus the four supported
> deployment modes.

ECG SHE delegates **all** human-user authentication to Microsoft Entra ID.
Local credentials only exist for system / break-glass service accounts.

Standards supported: **OAuth 2.0**, **OpenID Connect 1.0**, **SAML 2.0** (via the same Entra app registration), and **MSAL** for both server and SPA.

## 1 · Register the application in Entra ID

In the Azure / Entra portal → **App registrations → New registration**:

| Field | Value |
| ----- | ----- |
| Name | `ECG SHE` |
| Supported account types | Accounts in this organizational directory only |
| Redirect URI (SPA) | `https://she.ecg.com.gh/auth/callback` |
| Redirect URI (Web) | `https://she.ecg.com.gh/api/v1/auth/entra/callback` |
| Front-channel logout URL | `https://she.ecg.com.gh/login` |

After creation:

1. **Authentication** → enable *ID tokens* and *Access tokens* for SPA.
2. **Certificates & secrets** → create a client secret. Store it securely as `ENTRA_CLIENT_SECRET`.
3. **API permissions** → add Microsoft Graph delegated `User.Read` and application `User.Read.All`, `Group.Read.All`, then **Grant admin consent**.
4. **Expose an API** → set `Application ID URI` to `api://<client-id>`. Add scope `access_as_user`.
5. **Token configuration** → optional claims: include `email`, `family_name`, `given_name`, `groups`, `preferred_username`.

## 2 · Map Entra groups to application roles

Create (or re-use) four security groups in Entra and copy their **object ids**:

| Group name             | Maps to        |
| ---------------------- | -------------- |
| ECG-SHE-SysAdmin       | `SYS_ADMIN`    |
| ECG-SHE-Global         | `GLOBAL_USER`  |
| ECG-SHE-HeadOfficeSHE  | `HEAD_OFFICE_SHE` |
| ECG-SHE-Regional       | `REGIONAL_USER`|
| ECG-SHE-District       | `DISTRICT_USER`|

Set the env var:

```env
ENTRA_GROUP_ROLE_MAP=<sysadmin-id>:SYS_ADMIN,<global-id>:GLOBAL_USER,<regional-id>:REGIONAL_USER,<district-id>:DISTRICT_USER
```

When the user signs in (or the hourly sync job runs), the highest-ranked
matching role becomes their application role. New employees added to the
groups in Entra **automatically** become app users — no manual provisioning.

## 3 · Configure the application

Backend (`.env`):

```env
AUTH_PROVIDER=entra
ENTRA_TENANT_ID=<tenant-id>
ENTRA_CLIENT_ID=<client-id>
ENTRA_CLIENT_SECRET=<secret>
ENTRA_AUDIENCE=api://<client-id>
ENTRA_REDIRECT_URI=https://she.ecg.com.gh/auth/callback
ENTRA_POST_LOGOUT_URI=https://she.ecg.com.gh/login
ENTRA_GROUP_ROLE_MAP=...
```

Frontend (`.env`):

```env
VITE_ENTRA_TENANT_ID=<tenant-id>
VITE_ENTRA_CLIENT_ID=<client-id>
VITE_ENTRA_AUDIENCE=api://<client-id>
```

## 4 · How it works

### Sign-in (browser)

```
SPA  ──── loginRedirect ───►  login.microsoftonline.com
                                       │
                                       ▼
SPA  ◄──── auth code + id_token ──── Entra
SPA  ──── acquireTokenSilent ─────►  Entra
SPA  ──── Bearer <access_token> ──►  ECG SHE API
```

The SPA never sees a password. Tokens are stored in `sessionStorage`
(short-lived) and refreshed silently by MSAL.

### Token validation (server)

The `EntraJwtStrategy` fetches the tenant signing keys from
`https://login.microsoftonline.com/<tenant>/discovery/v2.0/keys`, caches them
via `jwks-rsa`, and verifies:

- signature with the matching public key,
- `iss = https://login.microsoftonline.com/<tenant>/v2.0`,
- `aud = api://<client-id>`,
- not expired.

On success, the user is auto-provisioned (`UsersService.upsertFromEntra`).

### Group → role mapping

Group claims are matched against `ENTRA_GROUP_ROLE_MAP` and the highest
matching role wins. Region / district scope is set manually by the
SysAdmin or via custom Entra extension attributes (next iteration).

## 5 · Automatic user provisioning

`EntraUserSyncService` runs every hour (configurable via cron) and:

1. Reads every active Entra user via `GET /v1.0/users` (paginated).
2. Resolves group memberships and manager.
3. Upserts the local user record.
4. Deactivates accounts that no longer exist or are disabled in Entra.

Trigger manually any time:

```bash
curl -X POST http://localhost:4000/api/v1/auth/entra/sync \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

The job runs inside a synthetic request context so audit columns are
attributed to the system. All changes flow through the standard audit log.

## 6 · SAML alternative

The same Entra app registration can simultaneously expose a SAML SSO
endpoint (Enterprise applications → Single sign-on → SAML). Point your
identity-aware proxy or an `nginx-ingress` `auth-url` annotation at it for
SAML federation, and the API will continue to accept the resulting OIDC
bearer tokens. No backend changes are required.

## 7 · Security notes

- The application **never** stores a Microsoft password.
- The client secret only ever lives server-side (`apps/api`).
- The SPA uses Authorization Code + PKCE (default for `@azure/msal-browser`).
- All tokens are bound to `https://she.ecg.com.gh` and rejected on any other origin.
- A failed Entra sync **never** removes a user — it only flips `active = false`.
