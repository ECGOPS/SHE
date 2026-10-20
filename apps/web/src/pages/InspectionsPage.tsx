import { GridColDef } from '@mui/x-data-grid';
import { Permission } from '@ecg-she/shared';
import { ModulePage, dateCol, regionCol, statusChip } from '../components/ModulePage';
import { endpoints } from '../api/endpoints';

const cols: GridColDef[] = [
  regionCol(),
  { field: 'referenceCode', headerName: 'Reference', width: 220 },
  { field: 'type', headerName: 'Type', width: 150, renderCell: (p) => statusChip(p.value) },
  { field: 'assetOrLocation', headerName: 'Asset / Location', flex: 1, minWidth: 200 },
  { field: 'status', headerName: 'Status', width: 140, renderCell: (p) => statusChip(p.value) },
  {
    field: 'scorePercent',
    headerName: 'Score %',
    width: 110,
    type: 'number',
    valueFormatter: (value) => (typeof value === 'number' ? `${value.toFixed(1)}%` : ''),
  },
  dateCol('inspectedAt', 'Inspected at'),
];

export function InspectionsPage() {
  return (
    <ModulePage
      title="Inspections"
      subtitle="Walk the checklist. A failed item stays open until it is corrected, or raised as a hazard or a corrective action."
      queryKey="inspections"
      list={endpoints.inspections}
      columns={cols}
      createPath="/inspections/new"
      rowHref={(row) => `/inspections/${row.id}`}
      permission={Permission.INSPECTION_CONDUCT}
      formFields={[]}
      create={endpoints.createInspection}
    />
  );
}
