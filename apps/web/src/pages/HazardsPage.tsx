import { GridColDef } from '@mui/x-data-grid';
import { Permission } from '@ecg-she/shared';
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
  dateCol('occurredAt', 'Occurred', 140),
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
      createPath="/hazards/new"
      formFields={[]}
      allowPhotos
      allowLocation
      offlineKind="hazard"
      rowHref={(row) => `/hazards/${(row as { id: string }).id}`}
      createdPath={(created) => (created.id ? `/hazards/${created.id}` : undefined)}
    />
  );
}
