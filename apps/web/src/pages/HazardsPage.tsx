import { GridColDef } from '@mui/x-data-grid';
import { HazardCategory, Permission } from '@ecg-she/shared';
import { ModulePage, dateCol, regionCol, statusChip } from '../components/ModulePage';
import { endpoints } from '../api/endpoints';

const RISK_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'error',
  EXTREME: 'error',
};

const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'info'> = {
  OPEN: 'warning',
  MITIGATED: 'info',
  CLOSED: 'success',
};

const cols: GridColDef[] = [
  regionCol(),
  { field: 'referenceCode', headerName: 'Reference', width: 180 },
  { field: 'title', headerName: 'Title', flex: 1, minWidth: 220 },
  {
    field: 'category',
    headerName: 'Category',
    width: 150,
    renderCell: (p) => statusChip(p.value),
  },
  { field: 'riskScore', headerName: 'Risk score', width: 110, type: 'number' },
  {
    field: 'riskClass',
    headerName: 'Risk class',
    width: 130,
    renderCell: (p) => statusChip(p.value, RISK_COLOR),
  },
  {
    field: 'status',
    headerName: 'Status',
    width: 130,
    renderCell: (p) => statusChip(p.value, STATUS_COLOR),
  },
  dateCol('createdAt', 'Reported'),
];

export function HazardsPage() {
  return (
    <ModulePage
      title="Hazard Management"
      subtitle="Report a condition that could hurt someone. A safety officer rates it, records the control, and closes it when the condition is gone."
      queryKey="hazards"
      list={endpoints.hazards}
      create={endpoints.createHazard}
      columns={cols}
      ctaLabel="Report hazard"
      permission={Permission.HAZARD_CREATE}
      allowPhotos
      allowLocation
      offlineKind="hazard"
      rowHref={(row) => `/hazards/${(row as { id: string }).id}`}
      createdPath={(created) => (created.id ? `/hazards/${created.id}` : undefined)}
      formFields={[
        {
          name: '__std',
          type: 'info',
          label: 'What to report',
          helperText:
            'A hazard is a condition that could hurt someone. If something nearly happened, use Near miss. The safety officer rates the risk and chooses the control. ISO 45001 §6.1.2.',
        },
        {
          name: 'regionId',
          label: 'Region',
          type: 'select',
          required: true,
          computeDefault: (s) => s?.user.regionId ?? '',
        },
        { name: 'title', label: 'What is wrong', type: 'text', required: true },
        { name: 'description', label: 'Describe the condition', type: 'textarea', required: true },
        {
          name: 'category',
          label: 'Category',
          type: 'select',
          required: true,
          options: Object.values(HazardCategory),
        },
        {
          name: 'peopleExposed',
          label: 'People are exposed to this now',
          type: 'boolean',
          defaultValue: false,
        },
        {
          name: 'immediateAction',
          label: 'What did you do to make it safe?',
          type: 'textarea',
          helperText: 'Isolate, barricade, or stop the job. Leave blank if you could not make it safe.',
        },
        { name: 'locationName', label: 'Location', type: 'text' },
        { name: 'latitude', label: 'Latitude', type: 'number' },
        { name: 'longitude', label: 'Longitude', type: 'number' },
      ]}
    />
  );
}
