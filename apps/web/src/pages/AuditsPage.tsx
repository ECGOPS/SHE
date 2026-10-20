import { GridColDef } from '@mui/x-data-grid';
import { Permission } from '@ecg-she/shared';
import { ModulePage, dateCol, regionCol, statusChip } from '../components/ModulePage';
import { endpoints } from '../api/endpoints';

const cols: GridColDef[] = [
  regionCol(),
  { field: 'referenceCode', headerName: 'Reference', width: 220 },
  { field: 'type', headerName: 'Type', width: 140, renderCell: (p) => statusChip(p.value) },
  { field: 'scope', headerName: 'Scope', flex: 1, minWidth: 200 },
  { field: 'auditee', headerName: 'Auditee', width: 180 },
  { field: 'status', headerName: 'Status', width: 140, renderCell: (p) => statusChip(p.value) },
  dateCol('scheduledDate', 'Scheduled', 150),
];

export function AuditsPage() {
  return (
    <ModulePage
      title="Audits"
      subtitle="Plan the clauses, walk them on site, and keep the audit open until each nonconformity has a corrective action."
      queryKey="audits"
      list={endpoints.audits}
      columns={cols}
      createPath="/audits/new"
      rowHref={(row) => `/audits/${row.id}`}
      permission={Permission.AUDIT_CONDUCT}
      formFields={[]}
      create={endpoints.createAudit}
    />
  );
}
