import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Permission } from '@ecg-she/shared';
import { endpoints } from '../api/endpoints';
import { useAuthStore } from '../stores/auth.store';
import { regionCol } from '../components/ModulePage';
import { MobilePageBar, RecordSearch, useServerPage } from '../components/server-page';

function words(value: unknown): string {
  return String(value ?? '').replaceAll('_', ' ');
}

const cols: GridColDef[] = [
  regionCol(),
  { field: 'sku', headerName: 'Part code', width: 140 },
  { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 },
  { field: 'category', headerName: 'Category', width: 160, valueFormatter: (value) => words(value) },
  { field: 'stockOnHand', headerName: 'In stock', width: 110, type: 'number' },
  { field: 'reorderLevel', headerName: 'Reorder at', width: 120, type: 'number' },
  { field: 'retestIntervalMonths', headerName: 'Retest (months)', width: 140, type: 'number' },
];

export function PpePage() {
  const navigate = useNavigate();
  const canManage = (useAuthStore((s) => s.session?.user.permissions) ?? []).includes(Permission.PPE_MANAGE);
  const itemsPage = useServerPage();
  const duePage = useServerPage(10);
  const items = useQuery({
    queryKey: ['ppe-items', itemsPage.query],
    queryFn: () => endpoints.ppeItems(itemsPage.query),
    placeholderData: keepPreviousData,
  });
  const lowStock = useQuery({
    queryKey: ['ppe-low'],
    queryFn: () => endpoints.ppeItems({ stockLow: true, page: 1, pageSize: 20 }),
  });
  const due = useQuery({
    queryKey: ['ppe-due', duePage.page, duePage.pageSize],
    queryFn: () => endpoints.ppeDue({ page: duePage.page + 1, pageSize: duePage.pageSize }),
    placeholderData: keepPreviousData,
  });
  const rows = (items.data?.items ?? []) as Array<{ id: string }>;
  const low = (lowStock.data?.items ?? []) as Array<{ name?: string; stockOnHand?: number; reorderLevel?: number }>;
  const attention = (due.data?.items ?? []) as Array<{
    id: string;
    state?: string;
    serialNumber?: string | null;
    expiresOn?: string | null;
    nextTestOn?: string | null;
    employee?: { fullName?: string };
    item?: { id?: string; name?: string };
  }>;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
        <Stack spacing={0.5}>
          <Typography variant="h5" fontWeight={700}>PPE</Typography>
          <Typography variant="body2" color="text.secondary">
            Keep the store list, issue a piece to a named person, and see what is due for replacement or retest.
          </Typography>
        </Stack>
        {canManage && (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => navigate('/ppe/issue')}>Issue PPE</Button>
            <Button variant="contained" onClick={() => navigate('/ppe/new')}>New PPE item</Button>
          </Stack>
        )}
      </Stack>

      {!!low.length && (
        <Alert severity="warning">
          {low.map((row) => `${row.name}: ${row.stockOnHand} left, reorder at ${row.reorderLevel}`).join(' · ')}
          {(lowStock.data?.total ?? 0) > low.length ? ` · and ${(lowStock.data?.total ?? 0) - low.length} more` : ''}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700}>Needs attention</Typography>
          <Typography variant="body2" color="text.secondary">
            Issued equipment that expires or needs a test within 30 days, or is already overdue.
          </Typography>
          {!attention.length && <Alert severity="info" sx={{ mt: 1 }}>Nothing is due.</Alert>}
          <Stack spacing={1} mt={1}>
            {attention.map((row) => (
              <Stack key={row.id} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {row.employee?.fullName ?? 'Worker'} · {row.item?.name ?? 'Item'}
                  {row.serialNumber ? ` · ${row.serialNumber}` : ''}
                  {row.nextTestOn ? ` · test ${row.nextTestOn}` : ''}
                  {row.expiresOn ? ` · expires ${row.expiresOn}` : ''}
                </Typography>
                <Chip size="small" label={words(row.state)} color={row.state === 'EXPIRING' || row.state === 'TEST_SOON' ? 'warning' : 'error'} />
                <Button size="small" onClick={() => row.item?.id && navigate(`/ppe/${row.item.id}`)}>Open</Button>
              </Stack>
            ))}
          </Stack>
          <MobilePageBar page={duePage.page} pageSize={duePage.pageSize} total={due.data?.total ?? 0} onPage={duePage.setPage} />
        </CardContent>
      </Card>

      <RecordSearch value={itemsPage.searchInput} onChange={itemsPage.setSearchInput} placeholder="Search part code or name" />
      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <DataGrid
          rows={rows}
          columns={cols}
          loading={items.isLoading}
          autoHeight
          disableRowSelectionOnClick
          paginationMode="server"
          rowCount={items.data?.total ?? 0}
          paginationModel={{ page: itemsPage.page, pageSize: itemsPage.pageSize }}
          onPaginationModelChange={itemsPage.onPaginationModelChange}
          pageSizeOptions={[10, 25, 50, 100]}
          onRowClick={(params) => navigate(`/ppe/${params.id}`)}
          sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        />
      </Card>
    </Stack>
  );
}
