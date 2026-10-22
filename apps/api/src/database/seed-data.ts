import { Role } from '@ecg-she/shared';

/**
 * ECG (Electricity Company of Ghana) operating structure.
 *
 * Source: ECG operational regions & districts as supplied by the business.
 * Each region also has a "Regional Office" district (code `HQ`) for staff
 * who report to the regional office rather than to a particular district.
 *
 * The three Subtransmission / Head-Office operating units (`STA`, `STH`,
 * `HOO`) are modelled as regions because they own assets and people but
 * sit outside the geographical region structure.
 */
export interface RegionSeed {
  code: string;
  name: string;
  /** True for the central / sub-transmission / head-office operating units. */
  centralUnit?: boolean;
  districts: { code: string; name: string }[];
}

export const REGIONS: RegionSeed[] = [
  {
    code: 'AE',
    name: 'Accra East Region',
    districts: [
      { code: 'HQ', name: 'Accra East Regional Office' },
      { code: 'ADE', name: 'Adenta' },
      { code: 'DOD', name: 'Dodowa' },
      { code: 'KWA', name: 'Kwabenya' },
      { code: 'LEG', name: 'Legon' },
      { code: 'MAK', name: 'Makola' },
      { code: 'MAM', name: 'Akwapim Mampong' },
      { code: 'ROM', name: 'Roman Ridge' },
      { code: 'TES', name: 'Teshie' },
    ],
  },
  {
    code: 'AW',
    name: 'Accra West Region',
    districts: [
      { code: 'HQ', name: 'Accra West Regional Office' },
      { code: 'ABL', name: 'Ablekuma' },
      { code: 'ACH', name: 'Achimota' },
      { code: 'AMA', name: 'Amasaman' },
      { code: 'BOR', name: 'Bortianor' },
      { code: 'DAN', name: 'Dansoman' },
      { code: 'KAN', name: 'Kaneshie' },
      { code: 'KOR', name: 'Korle-Bu' },
      { code: 'NSA', name: 'Nsawam' },
    ],
  },
  {
    code: 'ASE',
    name: 'Ashanti East Region',
    districts: [
      { code: 'HQ', name: 'Ashanti East Regional Office' },
      { code: 'AYI', name: 'Ayigya' },
      { code: 'EFF', name: 'Effiduase' },
      { code: 'EJI', name: 'Ejisu' },
      { code: 'KON', name: 'Konongo' },
      { code: 'KWA', name: 'Kwabre' },
      { code: 'MAM', name: 'Mampong' },
    ],
  },
  {
    code: 'ASW',
    name: 'Ashanti West Region',
    districts: [
      { code: 'HQ', name: 'Ashanti West Regional Office' },
      { code: 'ABU', name: 'Abuakwa' },
      { code: 'ADU', name: 'Adum' },
      { code: 'AHI', name: 'Ahinsan' },
      { code: 'BIB', name: 'Bibiani' },
      { code: 'DAN', name: 'Danyame' },
      { code: 'KOK', name: 'Kokoben' },
      { code: 'SUA', name: 'Suame' },
      { code: 'OFF', name: 'Offinso' },
    ],
  },
  {
    code: 'ASS',
    name: 'Ashanti South Region',
    districts: [
      { code: 'HQ', name: 'Ashanti South Regional Office' },
      { code: 'ASO', name: 'Asokwa' },
      { code: 'BEK', name: 'Bekwai' },
      { code: 'DUN', name: 'Dunkwa' },
      { code: 'MAN', name: 'Manso Nkwanta' },
      { code: 'NED', name: 'New Edubiase' },
      { code: 'OBU', name: 'Obuasi' },
    ],
  },
  {
    code: 'CR',
    name: 'Central Region',
    districts: [
      { code: 'HQ', name: 'Central Regional Office' },
      { code: 'AGS', name: 'Agona Swedru' },
      { code: 'AJU', name: 'Ajumako' },
      { code: 'AFO', name: 'Assin Foso' },
      { code: 'BRE', name: 'Breman Asikuma' },
      { code: 'CAP', name: 'Cape Coast' },
      { code: 'KSN', name: 'Kasoa North' },
      { code: 'KSS', name: 'Kasoa South' },
      { code: 'SAL', name: 'Saltpond' },
      { code: 'TWI', name: 'Twifu Praso' },
      { code: 'WIN', name: 'Winneba' },
    ],
  },
  {
    code: 'ER',
    name: 'Eastern Region',
    districts: [
      { code: 'HQ', name: 'Eastern Regional Office' },
      { code: 'AKO', name: 'Akim Oda' },
      { code: 'AKT', name: 'Akim Tafo' },
      { code: 'AKW', name: 'Akwatia' },
      { code: 'ASA', name: 'Asamankese' },
      { code: 'ASE', name: 'Asesewa' },
      { code: 'BEG', name: 'Begoro' },
      { code: 'DON', name: 'Donkorkrom' },
      { code: 'KAD', name: 'Kade' },
      { code: 'KIB', name: 'Kibi' },
      { code: 'KOF', name: 'Koforidua' },
      { code: 'MPR', name: 'Mpraeso' },
      { code: 'NAB', name: 'New Abirem' },
      { code: 'NKA', name: 'Nkawkaw' },
      { code: 'SUH', name: 'Suhum' },
    ],
  },
  {
    code: 'TR',
    name: 'Tema Region',
    districts: [
      { code: 'HQ', name: 'Tema Regional Office' },
      { code: 'ADA', name: 'Ada' },
      { code: 'AFI', name: 'Afienya' },
      { code: 'ASH', name: 'Ashaiman' },
      { code: 'JUA', name: 'Juapong' },
      { code: 'KRO', name: 'Krobo' },
      { code: 'NUN', name: 'Nungua' },
      { code: 'PRA', name: 'Prampram' },
      { code: 'TMN', name: 'Tema North' },
      { code: 'TMS', name: 'Tema South' },
    ],
  },
  {
    code: 'VR',
    name: 'Volta Region',
    districts: [
      { code: 'HQ', name: 'Volta Regional Office' },
      { code: 'AKA', name: 'Akatsi' },
      { code: 'DAM', name: 'Dambai' },
      { code: 'DEN', name: 'Denu' },
      { code: 'HO', name: 'Ho' },
      { code: 'HOH', name: 'Hohoe' },
      { code: 'JAS', name: 'Jasikan' },
      { code: 'KET', name: 'Keta' },
      { code: 'KPA', name: 'Kpandu' },
      { code: 'KPE', name: 'Kpeve' },
      { code: 'NKW', name: 'Nkwanta' },
      { code: 'SOG', name: 'Sogakope' },
    ],
  },
  {
    code: 'WR',
    name: 'Western Region',
    districts: [
      { code: 'HQ', name: 'Western Regional Office' },
      { code: 'AGO', name: 'Agona' },
      { code: 'ASN', name: 'Asankragua' },
      { code: 'AXI', name: 'Axim' },
      { code: 'BOG', name: 'Bogoso' },
      { code: 'ENC', name: 'Enchi' },
      { code: 'HAL', name: 'Half Assini' },
      { code: 'SEF', name: 'Sefwi Wiawso' },
      { code: 'JUB', name: 'Juabeso' },
      { code: 'SEK', name: 'Sekondi' },
      { code: 'TAK', name: 'Takoradi' },
      { code: 'TAR', name: 'Tarkwa' },
    ],
  },
  // ── Central operating units (not geographical regions) ───────────────
  {
    code: 'STA',
    name: 'Subtransmission Accra',
    centralUnit: true,
    districts: [
      { code: 'CON', name: 'Control Operations' },
      { code: 'SUB', name: 'Substation Maintenance' },
      { code: 'NET', name: 'Network Maintenance' },
      { code: 'PRO', name: 'Protection Maintenance' },
    ],
  },
  {
    code: 'STH',
    name: 'Subtransmission Ashanti',
    centralUnit: true,
    districts: [
      { code: 'CON', name: 'Control Operations' },
      { code: 'SUB', name: 'Substation Maintenance' },
      { code: 'NET', name: 'Network Maintenance' },
      { code: 'PRO', name: 'Protection Maintenance' },
    ],
  },
  {
    code: 'HOO',
    name: 'Head Office Operations',
    centralUnit: true,
    districts: [{ code: 'PRJ', name: 'Projects Office HQ' }],
  },
];

export interface UserSeed {
  email: string;
  fullName: string;
  password: string;
  role: Role;
  region?: string;
  district?: string;
  jobTitle?: string;
}

/**
 * Default test accounts seeded on first boot. Passwords are intentionally
 * memorable but only suitable for local development — change them via the
 * Admin module before exposing the API to anyone else.
 */
const STAFF_ACCOUNTS: UserSeed[] = [
  {
    email: 'admin@ecg.com.gh',
    fullName: 'System Administrator',
    password: 'Admin@123',
    role: Role.SYS_ADMIN,
  },
  {
    email: 'global@ecg.com.gh',
    fullName: 'Akua Mensah (Global)',
    password: 'Global@123',
    role: Role.GLOBAL_USER,
  },
  // Regional users — one per operational region
  {
    email: 'accra.east@ecg.com.gh',
    fullName: 'Kojo Asante (Accra East)',
    password: 'Region@123',
    role: Role.REGIONAL_USER,
    region: 'AE',
  },
  {
    email: 'accra.west@ecg.com.gh',
    fullName: 'Yaa Boateng (Accra West)',
    password: 'Region@123',
    role: Role.REGIONAL_USER,
    region: 'AW',
  },
  {
    email: 'ashanti.east@ecg.com.gh',
    fullName: 'Kofi Owusu (Ashanti East)',
    password: 'Region@123',
    role: Role.REGIONAL_USER,
    region: 'ASE',
  },
  {
    email: 'ashanti.west@ecg.com.gh',
    fullName: 'Adwoa Frimpong (Ashanti West)',
    password: 'Region@123',
    role: Role.REGIONAL_USER,
    region: 'ASW',
  },
  {
    email: 'ashanti.south@ecg.com.gh',
    fullName: 'Yaw Antwi (Ashanti South)',
    password: 'Region@123',
    role: Role.REGIONAL_USER,
    region: 'ASS',
  },
  {
    email: 'central@ecg.com.gh',
    fullName: 'Esi Quaye (Central)',
    password: 'Region@123',
    role: Role.REGIONAL_USER,
    region: 'CR',
  },
  {
    email: 'eastern@ecg.com.gh',
    fullName: 'Nana Adusei (Eastern)',
    password: 'Region@123',
    role: Role.REGIONAL_USER,
    region: 'ER',
  },
  {
    email: 'tema@ecg.com.gh',
    fullName: 'Akosua Tetteh (Tema)',
    password: 'Region@123',
    role: Role.REGIONAL_USER,
    region: 'TR',
  },
  {
    email: 'volta@ecg.com.gh',
    fullName: 'Mawuli Agbeko (Volta)',
    password: 'Region@123',
    role: Role.REGIONAL_USER,
    region: 'VR',
  },
  {
    email: 'western@ecg.com.gh',
    fullName: 'Ama Nyarko (Western)',
    password: 'Region@123',
    role: Role.REGIONAL_USER,
    region: 'WR',
  },
  // Sample district users — Makola (Accra East) & Adum (Ashanti West)
  {
    email: 'makola@ecg.com.gh',
    fullName: 'Ama Owusu (Makola)',
    password: 'District@123',
    role: Role.DISTRICT_USER,
    region: 'AE',
    district: 'MAK',
  },
  {
    email: 'adum@ecg.com.gh',
    fullName: 'Kwame Sarpong (Adum)',
    password: 'District@123',
    role: Role.DISTRICT_USER,
    region: 'ASW',
    district: 'ADU',
  },
  // Subtransmission operations example
  {
    email: 'subtransmission.accra@ecg.com.gh',
    fullName: 'Eric Boadu (Subtransmission Accra)',
    password: 'Region@123',
    role: Role.REGIONAL_USER,
    region: 'STA',
  },
];

const SAFETY_OFFICER_PASSWORD = 'Safety@123';

/** One safety officer for Head Office, every region, and every district. */
function safetyOfficerAccounts(): UserSeed[] {
  const officers: UserSeed[] = [
    {
      email: 'she.global@ecg.com.gh',
      fullName: 'Head Office Safety Officer',
      password: SAFETY_OFFICER_PASSWORD,
      role: Role.GLOBAL_SAFETY_OFFICER,
      jobTitle: 'Safety Officer',
    },
    {
      email: 'she.ho@ecg.com.gh',
      fullName: 'Head Office SHE',
      password: SAFETY_OFFICER_PASSWORD,
      role: Role.HEAD_OFFICE_SHE,
      jobTitle: 'SHE',
    },
  ];

  for (const region of REGIONS) {
    const regionCode = region.code.toLowerCase();
    officers.push({
      email: `she.${regionCode}@ecg.com.gh`,
      fullName: `${region.name} Safety Officer`,
      password: SAFETY_OFFICER_PASSWORD,
      role: Role.REGIONAL_SAFETY_OFFICER,
      region: region.code,
      jobTitle: 'Safety Officer',
    });
    for (const district of region.districts) {
      officers.push({
        email: `she.${regionCode}.${district.code.toLowerCase()}@ecg.com.gh`,
        fullName: `${district.name} Safety Officer`,
        password: SAFETY_OFFICER_PASSWORD,
        role: Role.DISTRICT_SAFETY_OFFICER,
        region: region.code,
        district: district.code,
        jobTitle: 'Safety Officer',
      });
    }
  }

  return officers;
}

export const USERS: UserSeed[] = [
  ...STAFF_ACCOUNTS.map((account) => ({
    ...account,
    jobTitle: account.role === Role.SYS_ADMIN ? 'System administrator' : 'Staff',
  })),
  ...safetyOfficerAccounts(),
];
