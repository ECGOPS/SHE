import { Chip } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import {
  BODY_PART_AFFECTED,
  ISSUE_SCOPE_LABEL,
  IssueScope,
  NATURE_OF_INJURY,
  NearMissCategory,
  Permission,
  SEVERITY_POTENTIAL,
} from '@ecg-she/shared';
import { ModulePage, dateCol, regionCol, statusChip } from '../components/ModulePage';
import { endpoints, NearMissDto } from '../api/endpoints';

const STATUS_COLOR: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  REPORTED: 'info',
  OPEN: 'info',
  UNDER_REVIEW: 'warning',
  CLOSED: 'success',
  CONVERTED: 'info',
};

const CATEGORY_COLOR: Record<string, 'default' | 'info' | 'warning' | 'error'> = {
  UNSAFE_ACT: 'warning',
  UNSAFE_CONDITION: 'error',
  POTENTIAL_INCIDENT: 'info',
};

const SEVERITY_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  NEGLIGIBLE: 'success',
  MINOR: 'success',
  MODERATE: 'warning',
  MAJOR: 'error',
  CATASTROPHIC: 'error',
};

const FLOW_COLOR: Record<string, 'info' | 'warning' | 'error'> = {
  DISTRICT: 'info',
  REGIONAL: 'warning',
  HEAD_OFFICE: 'error',
};

const cols: GridColDef[] = [
  regionCol(),
  { field: 'referenceCode', headerName: 'Reference', width: 210 },
  { field: 'title', headerName: 'Title', flex: 1, minWidth: 220 },
  {
    field: 'status',
    headerName: 'Status',
    width: 150,
    renderCell: (p) => statusChip(p.value, STATUS_COLOR),
  },
  {
    field: 'category',
    headerName: 'Category',
    width: 180,
    renderCell: (p) => statusChip(p.value, CATEGORY_COLOR),
  },
  {
    field: 'severityPotential',
    headerName: 'Severity potential',
    width: 160,
    renderCell: (p) => statusChip(p.value, SEVERITY_COLOR),
  },
  {
    field: 'currentScope',
    headerName: 'Flow',
    width: 190,
    renderCell: (p) => {
      const row = p.row as NearMissDto;
      if (row.resolvedAt) {
        const scope = ISSUE_SCOPE_LABEL[row.resolvedAtScope ?? row.currentScope ?? IssueScope.DISTRICT];
        return <Chip size="small" color="success" label={`Resolved · ${scope}`} />;
      }
      const scope = row.currentScope ?? IssueScope.DISTRICT;
      return <Chip size="small" color={FLOW_COLOR[scope] ?? 'info'} label={`At ${ISSUE_SCOPE_LABEL[scope]}`} />;
    },
  },
  dateCol('occurredAt', 'Occurred'),
  {
    field: 'reportedBy',
    headerName: 'Reported by',
    width: 180,
    valueGetter: (_v, row) => {
      const record = row as { anonymous?: boolean; reportedBy?: { fullName?: string } };
      if (record.anonymous && !record.reportedBy?.fullName) return 'Confidential';
      return record.reportedBy?.fullName ?? '';
    },
  },
];

export function NearMissPage() {
  return (
    <ModulePage
      title="Near Miss Reporting"
      subtitle="Report what nearly happened. A safety officer reviews the potential, records the cause, and closes it or raises a corrective action."
      queryKey="near-miss"
      list={endpoints.nearMiss}
      create={endpoints.createNearMiss}
      columns={cols}
      ctaLabel="Report near miss"
      permission={Permission.NEAR_MISS_CREATE}
      allowPhotos
      allowLocation
      offlineKind="near-miss"
      rowHref={(row) => `/near-miss/${(row as { id: string }).id}`}
      createdPath={(created) => (created.id ? `/near-miss/${created.id}` : undefined)}
      formFields={[
        {
          name: '__std',
          type: 'info',
          label: 'Standards reference',
          helperText:
            'A near miss is an event that could have hurt someone and did not. If you are only reporting a condition, with no event, use Hazards. ISO 45001 §10.2 · OSHA Form 301.',
        },
        {
          name: 'regionId',
          label: 'Region',
          type: 'select',
          required: true,
          computeDefault: (s) => s?.user.regionId ?? '',
        },
        { name: 'title', label: 'Short title', type: 'text', required: true },
        {
          name: 'description',
          label: 'What happened',
          type: 'textarea',
          required: true,
        },
        {
          name: 'category',
          label: 'Category',
          type: 'select',
          required: true,
          options: Object.values(NearMissCategory),
          helperText: 'Unsafe act, unsafe condition, or potential incident.',
        },
        {
          name: 'severityPotential',
          label: 'How bad could it have been?',
          type: 'select',
          required: true,
          options: [...SEVERITY_POTENTIAL],
          helperText: 'Your first judgement. The safety officer confirms it.',
        },
        {
          name: 'occurredAt',
          label: 'Occurred at',
          type: 'datetime',
          required: true,
          computeDefault: () => new Date().toISOString().slice(0, 16),
        },
        { name: 'locationName', label: 'Location', type: 'text' },
        { name: 'latitude', label: 'Latitude', type: 'number' },
        { name: 'longitude', label: 'Longitude', type: 'number' },
        {
          name: 'bodyPartAtRisk',
          label: 'Body part at risk',
          type: 'select',
          options: [...BODY_PART_AFFECTED],
        },
        {
          name: 'potentialInjuryNature',
          label: 'Potential nature of injury',
          type: 'select',
          options: [...NATURE_OF_INJURY],
        },
        {
          name: 'anonymous',
          label: 'Hide my name from the shared report',
          type: 'boolean',
          defaultValue: false,
          helperText: 'Your name stays with the safety officer so they can ask a follow-up. It is hidden from everyone else, and from the audit trail.',
        },
      ]}
    />
  );
}
