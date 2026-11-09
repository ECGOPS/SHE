import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Box, Button, Card, CardContent, Chip, Stack, Typography, useMediaQuery } from '@mui/material';
import { DataGrid, GridColDef, GridColumnVisibilityModel } from '@mui/x-data-grid';
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import { endpoints, IncidentDto } from '../../api/endpoints';
import { useAuthStore } from '../../stores/auth.store';
import { ISSUE_SCOPE_LABEL, IssueScope } from '@ecg-she/shared';
import { MobilePageBar, RecordSearch, useServerPage } from '../../components/server-page';
import { pressableCardSx } from '../../theme/theme';
import { regionLabel } from '../../components/ModulePage';
import {
  TABLE_MIN_WIDTH_QUERY,
  clampLines,
  fitColumns,
  formatDate,
  formatDateTime,
  gridLocaleText,
} from '../../components/grid-helpers';

/** On narrower desktops these give way so Status and Occurred stay in view. */
const SECONDARY_COLUMNS: GridColumnVisibilityModel = { type: false, resolvedAt: false };

const SEV_COLOR: Record<string, 'default' | 'warning' | 'error' | 'success'> = {
  NEGLIGIBLE: 'success',
  MINOR: 'success',
  MODERATE: 'warning',
  MAJOR: 'error',
  CATASTROPHIC: 'error',
};

const STATUS_COLOR: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  DRAFT: 'default',
  REPORTED: 'info',
  UNDER_INVESTIGATION: 'warning',
  PENDING_APPROVAL: 'warning',
  CLOSED: 'success',
  REJECTED: 'error',
};

export function IncidentsListPage() {
  const nav = useNavigate();
  const compact = !useMediaQuery(TABLE_MIN_WIDTH_QUERY);
  const roomy = useMediaQuery('(min-width: 1700px)');
  // The user's own show/hide choices from the column menu win over the default.
  const [columnChoices, setColumnChoices] = useState<GridColumnVisibilityModel>({});
  const columnVisibility = useMemo(
    () => ({ ...(roomy ? {} : SECONDARY_COLUMNS), ...columnChoices }),
    [roomy, columnChoices],
  );
  const userId = useAuthStore((s) => s.session?.user.id);
  const [mineOnly, setMineOnly] = useState(false);
  const paging = useServerPage();
  const { data, isLoading } = useQuery({
    queryKey: ['incidents', mineOnly ? userId : 'all', paging.query],
    queryFn: () =>
      endpoints.incidents({
        ...paging.query,
        ...(mineOnly && userId ? { investigatorId: userId } : {}),
      }),
    placeholderData: keepPreviousData,
  });
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  const cols: GridColDef[] = [
    {
      field: 'region',
      headerName: 'Region / District',
      width: 220,
      valueGetter: (_v, row) => regionLabel(row),
    },
    { field: 'referenceCode', headerName: 'Reference', width: 220 },
    { field: 'title', headerName: 'Title', flex: 1, minWidth: 240 },
    { field: 'type', headerName: 'Type', width: 160, valueFormatter: (v) => String(v).replaceAll('_', ' ') },
    {
      field: 'severity',
      headerName: 'Severity',
      // Wide enough for CATASTROPHIC.
      width: 150,
      renderCell: (p) => <Chip size="small" label={p.value} color={SEV_COLOR[p.value as string] ?? 'default'} />,
    },
    {
      field: 'status',
      headerName: 'Status',
      // Wide enough for UNDER INVESTIGATION.
      width: 210,
      renderCell: (p) => <Chip size="small" label={String(p.value).replaceAll('_', ' ')} color={STATUS_COLOR[p.value as string] ?? 'default'} />,
    },
    {
      field: 'resolvedAt',
      headerName: 'Resolution',
      width: 200,
      valueGetter: (_v, row: IncidentDto) =>
        row.resolvedAt
          ? `Resolved · ${ISSUE_SCOPE_LABEL[row.resolvedAtScope ?? row.currentScope ?? IssueScope.DISTRICT]}`
          : 'Open',
      renderCell: (p) => {
        const row = p.row as IncidentDto;
        if (row.resolvedAt) {
          const scope = ISSUE_SCOPE_LABEL[row.resolvedAtScope ?? row.currentScope ?? IssueScope.DISTRICT];
          return <Chip size="small" color="success" label={`Resolved · ${scope}`} />;
        }
        return <Chip size="small" variant="outlined" color="warning" label="Open" />;
      },
    },
    {
      field: 'occurredAt',
      headerName: 'Occurred',
      width: 160,
      valueFormatter: (v) => formatDateTime(v),
    },
  ];
  const tableColumns = fitColumns(cols);

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" fontWeight={700}>
            Incidents
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Capture, investigate and close every safety, electrical, environmental and vehicle incident.
          </Typography>
        </Box>
        {/* Wraps instead of spilling text out of the buttons when text is enlarged. */}
        <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap sx={{ alignSelf: { xs: 'stretch', sm: 'center' } }}>
          <Button
            variant={mineOnly ? 'contained' : 'outlined'}
            onClick={() => setMineOnly((on) => !on)}
            sx={{ flex: { xs: '1 1 auto', sm: '0 0 auto' } }}
          >
            Assigned to me
          </Button>
          <Button
            variant="contained"
            startIcon={<AddCircleRoundedIcon />}
            onClick={() => nav('/incidents/new')}
            sx={{ flex: { xs: '1 1 auto', sm: '0 0 auto' } }}
          >
            Report incident
          </Button>
        </Stack>
      </Stack>
      <RecordSearch value={paging.searchInput} onChange={paging.setSearchInput} />

      {compact ? (
        <Stack spacing={1}>
          <MobileIncidentList rows={rows} loading={isLoading} onOpen={(id) => nav(`/incidents/${id}`)} />
          <MobilePageBar page={paging.page} pageSize={paging.pageSize} total={total} onPage={paging.setPage} />
        </Stack>
      ) : (
        <Card sx={{ p: 0, overflow: 'hidden' }}>
          <Box sx={{ width: '100%', overflowX: 'auto' }}>
            <DataGrid
              rows={rows}
              columns={tableColumns}
              columnVisibilityModel={columnVisibility}
              onColumnVisibilityModelChange={setColumnChoices}
              localeText={gridLocaleText}
              loading={isLoading}
              getRowId={(r) => (r as { id: string }).id}
              autoHeight
              disableRowSelectionOnClick
              paginationMode="server"
              rowCount={total}
              paginationModel={{ page: paging.page, pageSize: paging.pageSize }}
              onPaginationModelChange={paging.onPaginationModelChange}
              onRowClick={(p) => nav(`/incidents/${p.id}`)}
              pageSizeOptions={[10, 25, 50, 100]}
              sx={{
                border: 'none',
                '& .MuiDataGrid-row': { cursor: 'pointer' },
              }}
            />
          </Box>
        </Card>
      )}
    </Stack>
  );
}

function MobileIncidentList({
  rows,
  loading,
  onOpen,
}: {
  rows: IncidentDto[];
  loading: boolean;
  onOpen: (id: string) => void;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary">Loading incidents...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary">No incidents found.</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={1.5}>
      {rows.map((row) => (
        <Card
          key={row.id}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(row.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              // Stop Space from scrolling the page before navigating.
              e.preventDefault();
              onOpen(row.id);
            }
          }}
          sx={pressableCardSx}
        >
          <CardContent>
            <Stack spacing={1.25}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle2" color="primary" fontWeight={700}>
                  {row.referenceCode}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDate(row.occurredAt)}
                </Typography>
              </Stack>

              <Typography variant="subtitle1" fontWeight={700} title={row.title} sx={clampLines(3)}>
                {row.title}
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={row.severity} color={SEV_COLOR[row.severity] ?? 'default'} />
                <Chip
                  size="small"
                  label={String(row.status).replaceAll('_', ' ')}
                  color={STATUS_COLOR[row.status] ?? 'default'}
                  variant="outlined"
                />
                {row.resolvedAt ? (
                  <Chip
                    size="small"
                    color="success"
                    label={`Resolved · ${ISSUE_SCOPE_LABEL[row.resolvedAtScope ?? row.currentScope ?? IssueScope.DISTRICT]}`}
                  />
                ) : (
                  <Chip size="small" variant="outlined" color="warning" label="Open" />
                )}
                <Chip size="small" label={String(row.type).replaceAll('_', ' ')} variant="outlined" />
              </Stack>

              <Typography variant="body2" color="text.secondary">
                {row.region?.name ?? 'No region'}{row.district?.name ? ` / ${row.district.name}` : ''}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
