export const PRIVACY_NOTICE_VERSION = '2026-02';

export interface PrivacyNoticeSection {
  heading: string;
  paragraphs: string[];
}

export interface PrivacyNotice {
  version: string;
  effectiveDate: string;
  controller: string;
  law: string;
  contact: string;
  sections: PrivacyNoticeSection[];
  categories: Array<{
    data: string;
    purpose: string;
    lawfulBasis: string;
    whoCanSeeIt: string;
    retention: string;
  }>;
  rights: string[];
  thirdParties: Array<{ party: string; purpose: string; crossBorder: string }>;
  consent: string;
}

/** Inventory of personal data processed by ECG SHE. Ghana Data Protection Act, 2012 (Act 843). */
export const PRIVACY_NOTICE: PrivacyNotice = {
  version: PRIVACY_NOTICE_VERSION,
  effectiveDate: 'February 2026',
  controller: 'Electricity Company of Ghana, SHE Directorate',
  law: 'Ghana Data Protection Act, 2012 (Act 843)',
  contact: 'she@ecg.com.gh',
  sections: [
    {
      heading: '1. About This System',
      paragraphs: [
        'The Electricity Company of Ghana (ECG) operates the Safety, Health and Environment Management System (SHE) to record and investigate incidents, hazards, and near misses, manage permits to work and inspections, monitor occupational health, and track environmental events.',
      ],
    },
    {
      heading: '2. Data We Collect',
      paragraphs: [
        'Personal information (name, work email, phone, staff ID, role, region, and district).',
        'Location data (GPS coordinates attached to a report, and the region or district of the work).',
        'Work data (incident, hazard, near-miss, inspection, permit, and environmental records, occupational health notes, and photos).',
        'Usage data (login activity and audit logs).',
      ],
    },
    {
      heading: '3. How We Use Your Data',
      paragraphs: [
        'Your data is used for safety and health management, incident investigation, inspection documentation, environmental monitoring, operational reporting, and system security. Any use beyond these purposes requires separate notification.',
      ],
    },
    {
      heading: '4. Data Access & Sharing',
      paragraphs: [
        'Access is role-based and limited to authorised SHE staff, system administrators, and ECG management. Safety officers see records for their region or district. Data may be shared with regulatory bodies upon official request. Microsoft sign-in is used only when ECG turns that method on.',
      ],
    },
    {
      heading: '5. Data Protection & Retention',
      paragraphs: [
        'Data is protected with ECG’s corporate authentication, encryption of clinical notes, role-based access controls, and audit logging. Data is retained in accordance with ECG’s compliance requirements and archived after the applicable retention period. Safety investigations stay on the record. Audit logs are kept for at least 365 days and are not deleted.',
      ],
    },
    {
      heading: '6. Your Rights',
      paragraphs: [
        'You may request a copy of your personal data, or correct your name and phone, from Your information in this system or by contacting the SHE Directorate at she@ecg.com.gh. Optional contact can be withdrawn at any time. Stopping use of the system does not erase safety records that ECG must keep.',
      ],
    },
  ],
  categories: [
    {
      data: 'Account: name, work email, phone, employee number, role, region, district, department, job title',
      purpose: 'Identify the person, apply their role, and route safety work to the right place',
      lawfulBasis: 'Contract of employment and ECG’s duty to run a safety management system',
      whoCanSeeIt: 'The person, their administrator, and safety officers in their scope',
      retention: 'For the employment and for two years after the account is closed, unless an earlier erasure request is completed',
    },
    {
      data: 'Sign-in: password hash, MFA seed, session secret hash, IP address, failed attempts',
      purpose: 'Authenticate the person and detect misuse',
      lawfulBasis: 'Legitimate interest in securing the system, and the security principle in Act 843',
      whoCanSeeIt: 'The API only. Passwords, tokens, and session secrets are never returned or written to the audit trail',
      retention: 'Session ends after 30 idle minutes or 12 hours. The lockout counter clears when the lock expires',
    },
    {
      data: 'Safety reports the person files: incident, hazard, near miss, permit, inspection, and environmental description',
      purpose: 'Investigate and prevent harm to workers and the public',
      lawfulBasis: 'Legal obligation for occupational safety, and vital interests where someone is hurt',
      whoCanSeeIt: 'Safety officers for the place where it happened, and Head Office',
      retention: 'Kept as a safety record. An erasure request does not delete the investigation',
    },
    {
      data: 'Occupational health: fitness, exposure, vaccination, and the clinical note',
      purpose: 'Decide fitness for electrical work and meet occupational-health duties',
      lawfulBasis: 'Employment and legal obligation for special-category health data. The clinical note is encrypted',
      whoCanSeeIt: 'Health recorders and the worker the record is about',
      retention: 'The clinical note is deleted when the worker’s erasure request is completed. The de-identified record type and date remain',
    },
    {
      data: 'Audit trail: actor, action, time, outcome, resource id',
      purpose: 'Show who changed a record and detect tampering',
      lawfulBasis: 'Legal obligation and the accountability principle in Act 843',
      whoCanSeeIt: 'Head Office and the system administrator',
      retention: 'At least 365 days. Rows are archived, not deleted, because the hash chain must stay intact',
    },
  ],
  rights: [
    'Access a copy of your account, the reports you filed, and health notes about you',
    'Correct your name and phone',
    'Withdraw optional contact. Safety notices required for the job continue',
    'Ask for erasure of your account and clinical notes. Safety investigations are retained without using erasure to hide an incident',
  ],
  thirdParties: [
    {
      party: 'Microsoft Entra ID, only when sign-in is set to entra or hybrid',
      purpose: 'Confirm the work account and read the profile the tenant agrees to share',
      crossBorder: 'Microsoft may process the sign-in outside Ghana. Use it only with ECG’s Entra tenant and a transfer basis accepted by the Data Protection Commission',
    },
    {
      party: 'Azure SQL, Azure Blob, or another host named in the deployment',
      purpose: 'Store the registers and uploaded files',
      crossBorder: 'The Azure example uses West Europe. A region outside Ghana is a cross-border transfer under Act 843 and needs an adequacy decision, the person’s informed consent, or Commission authorisation before production data is stored there',
    },
    {
      party: 'SMTP host, only when SMTP_HOST is set',
      purpose: 'Send safety notifications',
      crossBorder: 'Depends on the mail host. Do not enable a host outside Ghana until the transfer basis is recorded',
    },
  ],
  consent:
    'Safety and employment processing does not depend on a tick box. The acknowledgement records that you were shown this notice. Optional contact is off until you turn it on, and you can turn it off later.',
};

export function developmentUsesProductionData(nodeEnv: string, dbHost: string, allow: boolean): boolean {
  if (nodeEnv === 'production' || allow) return false;
  return /\.database\.windows\.net$/i.test(dbHost.trim());
}
