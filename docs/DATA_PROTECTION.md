# Data protection and privacy

ECG SHE processes personal data for the Electricity Company of Ghana under the Data Protection Act, 2012 (Act 843). The controller is the SHE Directorate. Questions go to she@ecg.com.gh.

The live notice served at `GET /api/v1/privacy/notice` is effective February 2026. It has six sections: about this system, data collected, how it is used, access and sharing, protection and retention, and rights. The same response still carries the inventory: each category has a purpose, a lawful basis, who can see it, and how long it is kept. This page explains the workflows around that notice.

## What is collected

The registers collect the fields a safety, health, or environment record needs. Account creation asks for email, name, an optional phone, a role, and the place the person works. It does not ask for a national ID, date of birth, or home address.

Health records store a clinical note only in AES-256-GCM ciphertext. Passwords are Argon2id hashes. Session secrets and refresh tokens are stored as SHA-256 hashes.

## Notice and consent

Safety and employment processing rests on the employment relationship and ECG’s occupational-safety duty. It does not depend on a tick box.

The notice is its own screen at `/notice`, shown before the sign-in form. Continue stays unavailable until the person marks that they have read it. The acknowledgement is then stored on their account as `privacyNoticeVersion` and `privacyNoticeAcceptedAt`. Optional contact, for messages beyond the safety notices the job requires, stays off until the person turns it on.

## Rights

Signed-in people open **Your information** (`/privacy`).

| Right | How |
| --- | --- |
| Access | **Download my data** calls `GET /privacy/me/export`. The file contains the account, health notes about that person, and incidents they reported. It does not contain passwords, tokens, or other people’s witness details. |
| Correction | The person updates their own name and phone with `PATCH /privacy/me`. Role, place, and email changes stay with the administrator. |
| Withdraw consent | **Withdraw optional contact** calls `POST /privacy/me/withdraw`. Safety notices required for the job continue. |
| Erasure | **Erase** calls `POST /privacy/me/erasure` and requires a fresh sign-in. The account name, email, phone, employee number, MFA seed, and password hash are removed. Sessions are revoked. Clinical notes about that person are deleted and the health row is marked `ANONYMISED`. Incident investigations stay, so erasure cannot hide a safety event. |

Each of these actions is written to the audit trail with the actor, action, time, and outcome. The exported file and the corrected name are not copied into the log.

## Backups and temporary data

Health notes and MFA seeds are encrypted in the database. A local SQLite copy is sealed with the same AES-256-GCM key:

```bash
# from apps/api, with DATA_ENCRYPTION_KEY set
node scripts/backup-sqlite.mjs
```

The command writes `data/backups/ecg-she.db.enc` and refuses to run as the production backup of a networked database. Production backups are the host’s encrypted database backups (Azure SQL transparent data encryption when the database is Azure SQL). A backup file that is not sealed, and is not on an encrypted disk, is not a finished backup.

Uploaded photos and certificates are stored under `data/uploads` on the API machine. That disk must be encrypted (BitLocker on a developer PC, encrypted disks on App Service or the database host). The upload directory is not a place to leave a copy of a production database.

## Development and test

Seed accounts and the region list are fictional and are created only when `BOOTSTRAP_AUTOSEED` is true. Production refuses that flag.

`ALLOW_PRODUCTION_DATA` defaults to false. A development or test process that points `DB_HOST` at `*.database.windows.net` does not start. Do not restore a production backup into SQLite or a shared test database. A test database that must be networked is an empty database, and the exception is an explicit `ALLOW_PRODUCTION_DATA=true` on that empty database only.

## Third parties and cross-border transfers

Act 843 allows a transfer out of Ghana when the recipient country has comparable protection, the data subject has given informed consent, the transfer is necessary for a contract with the data subject, or the Data Protection Commission authorises it. ECG SHE does not sell personal data.

| Recipient | When it is used | Transfer |
| --- | --- | --- |
| Microsoft Entra ID | `AUTH_PROVIDER` is `entra` or `hybrid` | Sign-in and profile claims. Microsoft may process them outside Ghana. Limit the app registration to the claims the role needs (`openid`, `profile`, `email`). Record the transfer basis before production SSO is turned on. |
| Azure SQL or Azure Blob | The deployment host | The App Service guide’s example region is West Europe. That is a cross-border transfer. Prefer a region decision recorded with the Commission, or host in a country whose protection the Commission treats as adequate, before production personal data is stored there. The example names are not a decision to use West Europe. |
| SMTP host | `SMTP_HOST` is set | Notification email. Leave it empty until the mail host and its country are accepted. |
| S3-compatible storage | `STORAGE_DRIVER=s3` | Same rule as Azure Blob. The default driver is local disk. |
| Redis | `REDIS_ENABLED=true` | Session and cache data for this API. Use ECG’s own Redis. Do not point it at a third-party cache that ECG has not assessed. |

Local development uses SQLite, no Redis, and no mail host, so it does not transfer personal data abroad.
