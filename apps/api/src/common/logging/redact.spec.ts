import { ForbiddenException } from '@nestjs/common';
import { rejectAuditMutation } from '../../modules/audit-trail/audit-log.immutable';
import { publicErrorMessage, redact } from './redact';

describe('redact', () => {
  it('removes passwords, tokens, session ids and personal narrative', () => {
    const cleaned = redact({
      email: 'admin@ecg.com.gh',
      password: 'Admin@123',
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig',
      sessionId: 'sid-123',
      mfaCode: '123456',
      statement: 'The injured person was Kwame',
      regionId: 'region-1',
    }) as Record<string, unknown>;

    expect(cleaned.email).toBe('admin@ecg.com.gh');
    expect(cleaned.password).toBe('[redacted]');
    expect(cleaned.accessToken).toBe('[redacted]');
    expect(cleaned.sessionId).toBe('[redacted]');
    expect(cleaned.mfaCode).toBe('[redacted]');
    expect(cleaned.statement).toBe('[redacted]');
    expect(cleaned.regionId).toBe('region-1');
    expect(JSON.stringify(cleaned)).not.toContain('Admin@123');
    expect(JSON.stringify(cleaned)).not.toContain('eyJ');
  });

  it('hides server fault text and anything that looks like a secret', () => {
    expect(publicErrorMessage(500, 'SQLITE_ERROR near secret-table')).toBe('Internal server error');
    expect(publicErrorMessage(400, 'Bearer eyJhbGciOiJIUzI1NiJ9.aaa.bbb')).toBe('Request could not be completed.');
    expect(publicErrorMessage(403, 'Missing required permission(s): user:manage')).toBe(
      'Missing required permission(s): user:manage',
    );
  });

  it('refuses to change or delete an audit record', () => {
    expect(() => rejectAuditMutation()).toThrow(ForbiddenException);
  });
});
