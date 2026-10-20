import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Box, Card, Stack, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { endpoints } from '../api/endpoints';
import { RecordSearch, useServerPage } from '../components/server-page';

export function AuditTrailPage() {
  const paging = useServerPage();
  const { data, isLoading } = useQuery({
    queryKey: ['audit-trail', paging.query],
    queryFn: () => endpoints.auditTrail(paging.query),
    placeholderData: keepPreviousData,
  });

  const cols: GridColDef[] = [
    { field: 'createdAt', headerName: 'When', width: 200, valueFormatter: (v) => new Date(v as string).toLocaleString() },
    { field: 'action', headerName: 'Action', width: 220 },
    { field: 'method', headerName: 'Method', width: 90 },
    { field: 'resource', headerName: 'Resource', flex: 1, minWidth: 220 },
    { field: 'ipAddress', headerName: 'IP', width: 140 },
    { field: 'hash', headerName: 'Hash', width: 200 },
  ];

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5" fontWeight={700}>Audit Trail</Typography>
        <Typography variant="body2" color="text.secondary">
          Tamper-evident, hash-chained log of every mutating action across the system.
        </Typography>
      </Box>
      <RecordSearch value={paging.searchInput} onChange={paging.setSearchInput} placeholder="Search action or resource" />
      <Card sx={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
        <DataGrid
          rows={(data?.items ?? []) as never[]}
          columns={cols}
          loading={isLoading}
          autoHeight
          paginationMode="server"
          rowCount={data?.total ?? 0}
          paginationModel={{ page: paging.page, pageSize: paging.pageSize }}
          onPaginationModelChange={paging.onPaginationModelChange}
          pageSizeOptions={[10, 25, 50, 100]}
          getRowId={(r) => (r as { id: string }).id}
          density="compact"
          disableRowSelectionOnClick
          sx={{ border: 'none', minWidth: 720 }}
        />
        </Box>
      </Card>
    </Stack>
  );
}
