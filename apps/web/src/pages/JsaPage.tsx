import { GridColDef } from '@mui/x-data-grid';
import { Permission } from '@ecg-she/shared';
import { ModulePage, dateCol, regionCol, statusChip } from '../components/ModulePage';
import { endpoints } from '../api/endpoints';

const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
};

const cols: GridColDef[] = [
  regionCol(),
  { field: 'referenceCode', headerName: 'Reference', width: 220 },
  { field: 'workActivity', headerName: 'Activity', flex: 1, minWidth: 220 },
  { field: 'jobLocation', headerName: 'Location', width: 180 },
  dateCol('jobDate', 'Job date', 140),
  { field: 'crewSize', headerName: 'Crew', width: 80, type: 'number' },
  {
    field: 'permitRequired',
    headerName: 'Permit',
    width: 100,
    type: 'boolean',
  },
  {
    field: 'status',
    headerName: 'Status',
    width: 160,
    renderCell: (p) => statusChip(p.value, STATUS_COLOR),
  },
  dateCol('createdAt', 'Created'),
];

export function JsaPage() {
  return (
    <ModulePage
      title="Job Safety Analysis (JSA / JHA)"
      subtitle="Brief the job before work starts. Each step has a hazard and a control, the crew acknowledges it, and a safety officer accepts it."
      queryKey="jsa"
      list={endpoints.jsa}
      create={endpoints.createJsa}
      columns={cols}
      ctaLabel="New JSA"
      permission={Permission.JSA_CREATE}
      createPath="/jsa/new"
      formFields={[]}
      rowHref={(row) => `/jsa/${(row as { id: string }).id}`}
    />
  );
}
