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
  { field: 'code', headerName: 'Course code', width: 150 },
  { field: 'title', headerName: 'Title', flex: 1, minWidth: 220 },
  { field: 'authorizesDuty', headerName: 'Authorizes', width: 160, valueFormatter: (value) => words(value) },
  { field: 'durationHours', headerName: 'Hours', width: 90, type: 'number' },
  { field: 'validForMonths', headerName: 'Valid (months)', width: 130, type: 'number' },
];

export function TrainingPage() {
  const navigate = useNavigate();
  const canManage = (useAuthStore((s) => s.session?.user.permissions) ?? []).includes(Permission.TRAINING_MANAGE);
  const coursesPage = useServerPage();
  const duePage = useServerPage(10);
  const courses = useQuery({
    queryKey: ['training-courses', coursesPage.query],
    queryFn: () => endpoints.trainingCourses(coursesPage.query),
    placeholderData: keepPreviousData,
  });
  const due = useQuery({
    queryKey: ['training-due', duePage.page, duePage.pageSize],
    queryFn: () => endpoints.trainingDue({ page: duePage.page + 1, pageSize: duePage.pageSize }),
    placeholderData: keepPreviousData,
  });
  const rows = (courses.data?.items ?? []) as Array<{ id: string }>;
  const attention = (due.data?.items ?? []) as Array<{
    id: string;
    state?: string;
    expiresOn?: string | null;
    employee?: { fullName?: string };
    course?: { title?: string; authorizesDuty?: string | null };
  }>;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
        <Stack spacing={0.5}>
          <Typography variant="h5" fontWeight={700}>Training</Typography>
          <Typography variant="body2" color="text.secondary">
            Keep the course list, record who passed the class, and see whose authorization has lapsed.
          </Typography>
        </Stack>
        {canManage && (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => navigate('/training/classes/new')}>Record a class</Button>
            <Button variant="contained" onClick={() => navigate('/training/new')}>New course</Button>
          </Stack>
        )}
      </Stack>

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700}>Needs attention</Typography>
          <Typography variant="body2" color="text.secondary">Failed, expiring within 30 days, or already expired.</Typography>
          {!attention.length && <Alert severity="info" sx={{ mt: 1 }}>Nobody is out of date.</Alert>}
          <Stack spacing={1} mt={1}>
            {attention.map((row) => (
              <Stack key={row.id} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {row.employee?.fullName ?? 'Worker'} · {row.course?.title ?? 'Course'}
                  {row.course?.authorizesDuty ? ` · ${words(row.course.authorizesDuty)}` : ''}
                  {row.expiresOn ? ` · ${row.expiresOn}` : ''}
                </Typography>
                <Chip size="small" label={words(row.state)} color={row.state === 'EXPIRING' ? 'warning' : 'error'} />
              </Stack>
            ))}
          </Stack>
          <MobilePageBar page={duePage.page} pageSize={duePage.pageSize} total={due.data?.total ?? 0} onPage={duePage.setPage} />
        </CardContent>
      </Card>

      <RecordSearch value={coursesPage.searchInput} onChange={coursesPage.setSearchInput} placeholder="Search course code or title" />
      <Card sx={{ p: 0, overflow: 'hidden' }}>
        <DataGrid
          rows={rows}
          columns={cols}
          loading={courses.isLoading}
          autoHeight
          disableRowSelectionOnClick
          paginationMode="server"
          rowCount={courses.data?.total ?? 0}
          paginationModel={{ page: coursesPage.page, pageSize: coursesPage.pageSize }}
          onPaginationModelChange={coursesPage.onPaginationModelChange}
          onRowClick={(params) => navigate(`/training/${params.row.id}`)}
          pageSizeOptions={[10, 25, 50, 100]}
          sx={{ border: 'none', minHeight: 280, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        />
      </Card>
    </Stack>
  );
}
