import * as Joi from 'joi';
import { developmentUsesProductionData } from '../modules/privacy/privacy.notice';

/** Published development values. Production boot rejects every one of these. */
const INSECURE_SECRETS = new Set([
  'dev-only-access-secret-change-me-in-prod-please',
  'dev-only-refresh-secret-change-me-in-prod-please',
  'dev-only-data-encryption-key-32-chars!',
  'change-me-access-secret-min-32-characters-long',
  'change-me-refresh-secret-min-32-characters-long',
  'change-me-to-a-random-32-byte-secret==',
]);

/**
 * Validation schema for environment variables.
 *
 * The schema is **lenient by default** so that a fresh clone of the repo
 * can run with NO `.env` file at all (zero-config local mode):
 *   - DB defaults to embedded SQLite
 *   - JWT / crypto secrets fall back to non-secret development values
 *
 * In production you MUST set every secret value explicitly.
 */
export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  API_PORT: Joi.number().default(4000),
  API_PREFIX: Joi.string().default('api/v1'),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),
  // Swagger is mounted in development. Production stays closed unless this is true.
  SWAGGER_ENABLED: Joi.boolean().default(false),

  // ─── Database (driver-agnostic) ────────────────────────────────────────
  // No driver declared → SQLite. No host declared → SQLite. Otherwise
  // honour the configured driver.
  DB_TYPE: Joi.string()
    .valid('postgres', 'mssql', 'mysql', 'mariadb', 'oracle', 'sqlite')
    .optional(),
  DB_HOST: Joi.string().allow('').optional(),
  DB_PORT: Joi.number().optional(),
  DB_USERNAME: Joi.string().allow('').optional(),
  DB_PASSWORD: Joi.string().allow('').optional(),
  DB_NAME: Joi.string().allow('').optional(),
  DB_SYNCHRONIZE: Joi.boolean().optional(),
  DB_LOGGING: Joi.boolean().default(false),
  DB_SSL: Joi.boolean().default(false),
  REDIS_TLS: Joi.boolean().default(false),
  DB_POOL_MAX: Joi.number().optional(),
  DB_POOL_MIN: Joi.number().optional(),

  // Production refuses the seeded test accounts. Development still seeds by default.
  // Development and test refuse an Azure SQL host unless this is explicitly true.
  ALLOW_PRODUCTION_DATA: Joi.boolean().default(false),

  BOOTSTRAP_AUTOSEED: Joi.string()
    .valid('true', 'false')
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().valid('false').default('false'),
      otherwise: Joi.string().valid('true', 'false').default('true'),
    }),

  // ─── Redis (optional in local mode) ────────────────────────────────────
  REDIS_HOST: Joi.string().allow('').default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_ENABLED: Joi.boolean().default(false),

  // ─── Local JWT ─────────────────────────────────────────────────────────
  // Dev fallbacks (32+ chars). NEVER use these defaults in production.
  JWT_ACCESS_SECRET: Joi.string()
    .min(32)
    .default('dev-only-access-secret-change-me-in-prod-please'),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .default('dev-only-refresh-secret-change-me-in-prod-please'),
  JWT_REFRESH_TTL: Joi.string().default('7d'),
  SESSION_IDLE: Joi.string().default('30m'),
  SESSION_ABSOLUTE: Joi.string().default('12h'),
  SESSION_FRESH: Joi.string().default('10m'),

  // ─── Auth provider ─────────────────────────────────────────────────────
  // 'local' → only username/password (zero-config friendly)
  // 'entra' → only Microsoft SSO
  // 'hybrid' → both
  AUTH_PROVIDER: Joi.string().valid('entra', 'local', 'hybrid').default('local'),

  // ─── Microsoft Entra ID (optional) ─────────────────────────────────────
  ENTRA_TENANT_ID: Joi.string().allow('').default(''),
  ENTRA_CLIENT_ID: Joi.string().allow('').default(''),
  ENTRA_CLIENT_SECRET: Joi.string().allow('').default(''),
  ENTRA_AUDIENCE: Joi.string().allow('').optional(),
  ENTRA_REDIRECT_URI: Joi.string().allow('').optional(),
  ENTRA_POST_LOGOUT_URI: Joi.string().allow('').optional(),
  ENTRA_GROUP_CLAIM: Joi.string().default('groups'),
  ENTRA_GROUP_ROLE_MAP: Joi.string().allow('').default(''),
  ENTRA_AUTO_SYNC: Joi.boolean().default(false),

  // ─── MFA / encryption ──────────────────────────────────────────────────
  MFA_ISSUER: Joi.string().default('ECG-SHE'),
  DATA_ENCRYPTION_KEY: Joi.string()
    .min(32)
    .default('dev-only-data-encryption-key-32-chars!'),
  DATA_ENCRYPTION_KEY_PREVIOUS: Joi.string().allow('').default(''),

  // ─── Audit log retention and alerts ────────────────────────────────────
  AUDIT_RETENTION_DAYS: Joi.number().integer().min(30).default(365),
  AUDIT_ALERT_WINDOW_MINUTES: Joi.number().integer().min(1).default(15),
  AUDIT_ALERT_AUTH_FAILURES: Joi.number().integer().min(1).default(10),

  // ─── Storage ───────────────────────────────────────────────────────────
  STORAGE_DRIVER: Joi.string()
    .valid('local', 's3', 'azure-blob')
    .default('local'),
  STORAGE_LOCAL_PATH: Joi.string().default('./uploads'),
  AZURE_STORAGE_ACCOUNT: Joi.string().allow('').default(''),
  AZURE_STORAGE_CONTAINER: Joi.string().allow('').default(''),
  AZURE_STORAGE_KEY: Joi.string().allow('').default(''),

  // ─── Mail / push (all optional) ────────────────────────────────────────
  SMTP_HOST: Joi.string().allow('').default(''),
  SMTP_PORT: Joi.number().default(587),
  SMTP_TLS: Joi.boolean().default(true),
  SMTP_USER: Joi.string().allow('').default(''),
  SMTP_PASS: Joi.string().allow('').default(''),
  SMTP_FROM: Joi.string().default('no-reply@ecg.com.gh'),
  VAPID_PUBLIC_KEY: Joi.string().allow('').default(''),
  VAPID_PRIVATE_KEY: Joi.string().allow('').default(''),
  VAPID_SUBJECT: Joi.string().default('mailto:she@ecg.com.gh'),
})
  .unknown(true)
  .custom((value: Record<string, unknown>, helpers) => {
    const nodeEnv = typeof value.NODE_ENV === 'string' ? value.NODE_ENV : 'development';
    const dbHost = typeof value.DB_HOST === 'string' ? value.DB_HOST : '';
    if (developmentUsesProductionData(nodeEnv, dbHost, value.ALLOW_PRODUCTION_DATA === true)) {
      return helpers.message({
        custom:
          'Development and test must not open Azure SQL. Copy no production personal data into this environment. Set ALLOW_PRODUCTION_DATA=true only for an approved empty database.',
      });
    }
    if (value.NODE_ENV !== 'production') return value;
    const secretKeys = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'DATA_ENCRYPTION_KEY'] as const;
    for (const key of secretKeys) {
      const secret = value[key];
      if (typeof secret !== 'string' || INSECURE_SECRETS.has(secret)) {
        return helpers.message({
          custom: `${key} must be a unique secret when NODE_ENV=production`,
        });
      }
    }
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      return helpers.message({
        custom: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ in production',
      });
    }
    const driver = typeof value.DB_TYPE === 'string' ? value.DB_TYPE : undefined;
    if (driver && driver !== 'sqlite' && value.DB_SSL !== true) {
      return helpers.message({
        custom: 'DB_SSL must be true for a networked database when NODE_ENV=production',
      });
    }
    return value;
  });
