import { developmentUsesProductionData, PRIVACY_NOTICE } from './privacy.notice';

describe('privacy notice', () => {
  it('names a purpose, a lawful basis, access, and retention for every category', () => {
    expect(PRIVACY_NOTICE.effectiveDate).toBe('February 2026');
    expect(PRIVACY_NOTICE.sections.map((section) => section.heading)).toEqual([
      '1. About This System',
      '2. Data We Collect',
      '3. How We Use Your Data',
      '4. Data Access & Sharing',
      '5. Data Protection & Retention',
      '6. Your Rights',
    ]);
    expect(JSON.stringify(PRIVACY_NOTICE)).not.toContain('Network Management');
    expect(PRIVACY_NOTICE.law).toContain('Act 843');
    for (const category of PRIVACY_NOTICE.categories) {
      expect(category.purpose.length).toBeGreaterThan(10);
      expect(category.lawfulBasis.length).toBeGreaterThan(10);
      expect(category.whoCanSeeIt.length).toBeGreaterThan(5);
      expect(category.retention.length).toBeGreaterThan(5);
    }
    expect(JSON.stringify(PRIVACY_NOTICE)).not.toContain('Admin@123');
    expect(JSON.stringify(PRIVACY_NOTICE)).not.toMatch(/eyJ[a-zA-Z0-9_-]{20,}/);
  });

  it('blocks a development process from opening Azure SQL', () => {
    expect(developmentUsesProductionData('development', 'ecg-she-sql.database.windows.net', false)).toBe(true);
    expect(developmentUsesProductionData('test', 'ecg-she-sql.database.windows.net', false)).toBe(true);
    expect(developmentUsesProductionData('development', 'ecg-she-sql.database.windows.net', true)).toBe(false);
    expect(developmentUsesProductionData('production', 'ecg-she-sql.database.windows.net', false)).toBe(false);
    expect(developmentUsesProductionData('development', '', false)).toBe(false);
  });
});
