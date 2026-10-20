import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button, Card, Chip, Stack, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Permission } from '@ecg-she/shared';
import { endpoints } from '../api/endpoints';
import { useAuthStore } from '../stores/auth.store';
import { regionCol } from '../components/ModulePage';
import { RecordSearch, useServerPage } from '../components/server-page';

function words(value: unknown): string {
  return String(value ?? '').replaceAll('_', ' ');
}

const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  OPEN: 'default',
  ASSIGNED: 'info',
  IN_PROGRESS: 'warning',
  VERIFICATION: 'info',
  CLOSED: 'success',
  OVERDUE: 'error',
  REJECTED: 'error',
};

const cols: GridColDef[] = [
  regionCol(),
  { field: 'referenceCode', headerName: 'Reference', width: 220 },
  { field: 'title', headerName: 'Action', flex: 1, minWidth: 220 },
  { field: 'sourceType', headerName: 'Raised from', width: 170, valueFormatter: (value) => words(value) },
  { field: 'actionType', headerName: 'Type', width: 170, valueFormatter: (value) => words(value) },
  { field: 'dueDate', headerName: 'Due', width: 130, valueFormatter: (value) => (value ? String(value).slice(0, 10) : '') },
  {
    field: 'status',
    headerName: 'Status',
    width: 140,
    renderCell: (params) => <Chip size="small" label={words(params.value)} color={STATUS_COLOR[String(params.value)] ?? 'default'} />,
  },
];

export function CapaPage() {
  const navigate = useNavigate();
  const canCreate = (useAuthStore((s) => s.session?.user.permissions) ?? []).includes(Permission.CAPA_CREATE);
  const paging = useServerPage();
  const list = useQuery({
    queryKey: ['capa', paging.query],
    queryFn: () => endpoints.capa(paging.query),
    placeholderData: keepPreviousData,
  });
  const rows = (list.data?.items ?? []) as Array<{ id: string }>;
  const total = list.data?.total ?? 0;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
        <Stack spacing={0.5}>
          <Typography variant="h5" fontWeight={700}>Corrective and preventive actions</Typography>
          <Typography variant="body2" color="text.secondary">
            An action is raised from an incident, hazard, near-miss, inspection, audit, or environmental event. This list is where the work is done and then checked.
          </Typography>
        </Stack>
        {canCreate && <Button variant="contained" onClick={() => navigate('/capa/new')}>New action</Button>}
      </Stack>
      <RecordSearch value={paging.searchInput} onChange={paging.setSearchInput} />
      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <DataGrid
          rows={rows}
          columns={cols}
          loading={list.isLoading}
          autoHeight
          disableRowSelectionOnClick
          paginationMode="server"
          rowCount={total}
          paginationModel={{ page: paging.page, pageSize: paging.pageSize }}
          onPaginationModelChange={paging.onPaginationModelChange}
          pageSizeOptions={[10, 25, 50, 100]}
          onRowClick={(params) => navigate(`/capa/${params.id}`)}
          sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        />
      </Card>
    </Stack>
  );
}
