import { GridColDef } from '@mui/x-data-grid';
import { Permission } from '@ecg-she/shared';
import { ModulePage, dateCol, regionCol, statusChip } from '../components/ModulePage';
import { endpoints } from '../api/endpoints';

const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  CLOSED: 'default',
  REJECTED: 'error',
  EXPIRED: 'error',
};

const cols: GridColDef[] = [
  regionCol(),
  { field: 'referenceCode', headerName: 'Permit no.', width: 220 },
  {
    field: 'type',
    headerName: 'Type',
    width: 170,
    renderCell: (p) => statusChip(p.value),
  },
  { field: 'workDescription', headerName: 'Work', flex: 1, minWidth: 220 },
  { field: 'workLocation', headerName: 'Location', width: 180 },
  dateCol('validFrom', 'Valid from', 170),
  dateCol('validTo', 'Valid to', 170),
  {
    field: 'status',
    headerName: 'Status',
    width: 160,
    renderCell: (p) => statusChip(p.value, STATUS_COLOR),
  },
];

export function PtwPage() {
  return (
    <ModulePage
      title="Permit-To-Work"
      subtitle="Raise the permit, a second person issues it, and the holder accepts it at the work site. One shift, then hand it back."
      queryKey="ptw"
      list={endpoints.ptw}
      create={endpoints.createPtw}
      columns={cols}
      ctaLabel="Raise permit"
      permission={Permission.PTW_CREATE}
      createPath="/ptw/new"
      formFields={[]}
      rowHref={(row) => `/ptw/${(row as { id: string }).id}`}
    />
  );
}
