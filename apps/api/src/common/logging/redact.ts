const SECRET_KEY = /password|passwd|token|secret|authorization|cookie|session|mfa|otp|credential|privatekey|apikey|refresh/i;
const PERSONAL_KEY = /phone|fullname|statement|notes|description|address|diagnosis|birth|national|photo|certificate|comment|narrative|injury/i;

/** Remove secrets and unnecessary personal data before anything is written to a log. */
export function redact(value: unknown, key = ''): unknown {
  if (value == null) return value;
  if (key && SECRET_KEY.test(key)) return '[redacted]';
  if (key && PERSONAL_KEY.test(key)) return '[redacted]';
  if (typeof value === 'string') {
    if (/bearer\s+\S+/i.test(value) || /eyJ[a-zA-Z0-9_-]{20,}/.test(value)) return '[redacted]';
    if (value.length > 180 && !/^[0-9a-f-]{36}$/i.test(value)) return `[text:${value.length}]`;
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 20) return `[list:${value.length}]`;
    return value.slice(0, 20).map((item) => redact(item));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
      out[childKey] = redact(child, childKey);
    }
    return out;
  }
  return value;
}

/** What a caller is allowed to see. Server faults never include the internal message. */
export function publicErrorMessage(status: number, message: string | string[]): string | string[] {
  if (status >= 500) return 'Internal server error';
  const text = Array.isArray(message) ? message.join(' ') : message;
  if (/bearer\s+|eyJ[a-zA-Z0-9_-]{20,}|sqlite_|password|secret|token=/i.test(text)) {
    return 'Request could not be completed.';
  }
  return message;
}
