import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid2 as Grid,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import { useForm } from 'react-hook-form';
import { ROLE_LABEL, Role, isDistrictScope, isRegionalScope, isUnscopedSeat } from '@ecg-she/shared';
import { endpoints, type RegionDto } from '../api/endpoints';

const ROLE_COLOR: Record<string, 'default' | 'error' | 'warning' | 'info' | 'success'> = {
  SYS_ADMIN: 'error',
  GLOBAL_SAFETY_OFFICER: 'warning',
  HEAD_OFFICE_SHE: 'warning',
  GLOBAL_USER: 'default',
  REGIONAL_SAFETY_OFFICER: 'info',
  REGIONAL_USER: 'default',
  DISTRICT_SAFETY_OFFICER: 'success',
  DISTRICT_USER: 'default',
  STAFF: 'default',
};

function UsersTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [assigning, setAssigning] = useState<Record<string, string> | null>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  const users = useQuery({ queryKey: ['users', search], queryFn: () => endpoints.users(search) });
  const regions = useQuery({ queryKey: ['regions'], queryFn: endpoints.regions });

  const { register, handleSubmit, reset, watch } = useForm<Record<string, string>>({
    defaultValues: { role: Role.STAFF },
  });
  const selectedRegion = watch('regionId');

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => endpoints.createUser(body),
    onSuccess: () => {
      setFeedback({ kind: 'success', msg: 'User created.' });
      void qc.invalidateQueries({ queryKey: ['users'] });
      setOpen(false);
      reset({ role: Role.STAFF });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        'Request failed';
      setFeedback({ kind: 'error', msg });
    },
  });

  const submit = handleSubmit((v) => {
    const cleaned: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) if (val) cleaned[k] = val;
    if (isUnscopedSeat(v.role as Role)) {
      delete cleaned.regionId;
      delete cleaned.districtId;
    }
    create.mutate(cleaned);
  });

  const assign = useMutation({
    mutationFn: async (body: { id: string; role: string; regionId?: string | null; districtId?: string | null; password: string }) => {
      await endpoints.reauth(body.password);
      return endpoints.assignUser(body.id, { role: body.role, regionId: body.regionId, districtId: body.districtId });
    },
    onSuccess: () => {
      setFeedback({ kind: 'success', msg: 'Role assigned.' });
      void qc.invalidateQueries({ queryKey: ['users'] });
      setConfirmPassword('');
      setAssigning(null);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        'Request failed';
      setFeedback({ kind: 'error', msg });
    },
  });

  const saveAssignment = () => {
    if (!assigning) return;
    const role = assigning.role as Role;
    assign.mutate({
      id: assigning.id,
      role,
      regionId: needsRegion ? assigning.regionId : undefined,
      districtId: needsDistrict ? assigning.districtId : undefined,
      password: confirmPassword,
    });
  };

  const districtOptions =
    regions.data?.find((r) => r.id === selectedRegion)?.districts ?? [];

  const cols: GridColDef[] = [
    { field: 'fullName', headerName: 'Full name', flex: 1, minWidth: 200 },
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 220 },
    {
      field: 'role',
      headerName: 'Role',
      width: 160,
      renderCell: (p) => (
        <Chip
          size="small"
          label={ROLE_LABEL[p.value as Role] ?? String(p.value)}
          color={ROLE_COLOR[p.value as string] ?? 'default'}
        />
      ),
    },
    {
      field: 'region',
      headerName: 'Scope',
      flex: 1,
      minWidth: 180,
      valueGetter: (_v, row) =>
        `${(row as { region?: { name?: string } }).region?.name ?? '—'}${
          (row as { district?: { name?: string } }).district?.name
            ? ` / ${(row as { district: { name: string } }).district.name}`
            : ''
        }`,
    },
    {
      field: 'active',
      headerName: 'Active',
      width: 90,
      type: 'boolean',
    },
    {
      field: 'lastLoginAt',
      headerName: 'Last login',
      width: 180,
      valueFormatter: (v) => (v ? new Date(v as string).toLocaleString() : '—'),
    },
    {
      field: 'assign',
      headerName: '',
      width: 110,
      sortable: false,
      filterable: false,
      renderCell: (p) => (
        <Button size="small" onClick={() => setAssigning({
          id: String((p.row as { id: string }).id),
          email: String((p.row as { email?: string }).email ?? ''),
          fullName: String((p.row as { fullName?: string }).fullName ?? ''),
          role: String((p.row as { role?: string }).role ?? Role.STAFF),
          regionId: String((p.row as { regionId?: string }).regionId ?? ''),
          districtId: String((p.row as { districtId?: string }).districtId ?? ''),
        })}
        >
          Assign
        </Button>
      ),
    },
  ];

  const assignRole = (assigning?.role ?? Role.STAFF) as Role;
  const needsRegion = isRegionalScope(assignRole) || isDistrictScope(assignRole);
  const needsDistrict = isDistrictScope(assignRole);
  const assignDistrictQuery = useQuery({
    queryKey: ['districts', assigning?.regionId ?? ''],
    queryFn: () => endpoints.districts(assigning?.regionId),
    enabled: !!assigning?.regionId && needsDistrict,
  });
  const assignDistricts = assignDistrictQuery.data ?? [];

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
        <Typography variant="h6">Users</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            size="small"
            label="Email"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput.trim()); }}
            placeholder="name@ecg.com.gh"
          />
          <Button variant="outlined" onClick={() => setSearch(searchInput.trim())}>Find</Button>
        </Stack>
        <Button
          variant="contained"
          startIcon={<AddCircleRoundedIcon />}
          onClick={() => setOpen(true)}
        >
          New user
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary">
        A person appears here after they sign in. They start as staff and can report in any district. Find them by email and assign the safety officer role for their district, region, or Head Office.
      </Typography>

      {feedback && (
        <Alert severity={feedback.kind} onClose={() => setFeedback(null)}>
          {feedback.msg}
        </Alert>
      )}

      <Card sx={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
        <DataGrid
          rows={(users.data ?? []) as never[]}
          columns={cols}
          loading={users.isLoading}
          getRowId={(r) => (r as { id: string }).id}
          autoHeight
          density="compact"
          disableRowSelectionOnClick
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[10, 25, 50, 100]}
          sx={{ border: 'none', minWidth: 720 }}
        />
        </Box>
      </Card>

      <Dialog open={!!assigning} onClose={() => setAssigning(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign role</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Email" value={assigning?.email ?? ''} fullWidth InputProps={{ readOnly: true }} />
            <TextField label="Name" value={assigning?.fullName ?? ''} fullWidth InputProps={{ readOnly: true }} />
            <TextField
              select
              label="Role"
              fullWidth
              value={assignRole}
              onChange={(e) => setAssigning((current) => current ? { ...current, role: e.target.value, regionId: '', districtId: '' } : current)}
            >
              {Object.values(Role).map((r) => (
                <MenuItem key={r} value={r}>{ROLE_LABEL[r]}</MenuItem>
              ))}
            </TextField>
            {needsRegion && (
              <TextField
                select
                label="Region"
                fullWidth
                required
                value={assigning?.regionId ?? ''}
                onChange={(e) => setAssigning((current) => current ? { ...current, regionId: e.target.value, districtId: '' } : current)}
              >
                {(regions.data ?? []).map((r) => (
                  <MenuItem key={r.id} value={r.id}>{r.code} — {r.name}</MenuItem>
                ))}
              </TextField>
            )}
            {needsDistrict && (
              <TextField
                select
                label="District"
                fullWidth
                required
                disabled={!assigning?.regionId}
                value={assigning?.districtId ?? ''}
                onChange={(e) => setAssigning((current) => current ? { ...current, districtId: e.target.value } : current)}
              >
                {assignDistricts.map((d) => (
                  <MenuItem key={d.id} value={d.id}>{d.code} — {d.name}</MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              label="Your password"
              type="password"
              fullWidth
              required
              autoComplete="current-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              helperText="Confirm it is you before changing someone's access."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssigning(null)} disabled={assign.isPending}>Cancel</Button>
          <Button
            variant="contained"
            disabled={assign.isPending || confirmPassword.length < 8 || (needsRegion && !assigning?.regionId) || (needsDistrict && !assigning?.districtId)}
            onClick={saveAssignment}
          >
            {assign.isPending ? 'Saving…' : 'Save assignment'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create user</DialogTitle>
        <Box component="form" onSubmit={submit}>
          <DialogContent dividers>
            <Stack spacing={2}>
              <TextField
                label="Full name"
                fullWidth
                required
                {...register('fullName', { required: true })}
              />
              <TextField
                label="Email"
                type="email"
                fullWidth
                required
                {...register('email', { required: true })}
              />
              <TextField
                label="Initial password"
                type="password"
                fullWidth
                helperText="User can rotate via MFA setup; leave empty for Entra-only accounts."
                {...register('password')}
              />
              <TextField select label="Role" fullWidth required {...register('role', { required: true })}>
                {Object.values(Role).map((r) => (
                  <MenuItem key={r} value={r}>
                    {r.replaceAll('_', ' ')}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label="Region" fullWidth {...register('regionId')}>
                <MenuItem value="">— national / unscoped —</MenuItem>
                {(regions.data ?? []).map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {r.code} — {r.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField select label="District" fullWidth disabled={!selectedRegion} {...register('districtId')}>
                <MenuItem value="">— region-wide —</MenuItem>
                {districtOptions.map((d) => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)} disabled={create.isPending}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Create user'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  );
}

function OrganizationTab() {
  const { data: regions, isLoading } = useQuery({ queryKey: ['regions'], queryFn: endpoints.regions });
  const list: RegionDto[] = regions ?? [];

  return (
    <Grid container spacing={2}>
      {isLoading && (
        <Grid size={{ xs: 12 }}>
          <Typography color="text.secondary">Loading…</Typography>
        </Grid>
      )}
      {list.map((r) => (
        <Grid key={r.id} size={{ xs: 12, md: 6, lg: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                <Typography fontWeight={700}>{r.name}</Typography>
                <Chip size="small" label={r.code} />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {(r.districts ?? []).length} districts
              </Typography>
              <Box mt={1.5}>
                {(r.districts ?? []).map((d) => (
                  <Chip
                    key={d.id}
                    label={`${d.code} · ${d.name}`}
                    size="small"
                    variant="outlined"
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

function SystemTab() {
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>API & docs</Typography>
            <ul>
              <li>
                <a href="http://localhost:4000/api/v1/docs" target="_blank" rel="noopener noreferrer">
                  OpenAPI / Swagger UI
                </a>
              </li>
              <li><a href="/audit-trail">Audit trail viewer</a></li>
              <li><a href="/reports">Reporting engine</a></li>
            </ul>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Configuration</Typography>
            <Typography variant="body2" color="text.secondary">
              See the configuration reference for the full list of environment variables, deployment modes (zero-config SQLite → Postgres → Azure SQL) and Microsoft Entra ID setup. The application reloads automatically on `.env` changes.
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

export function AdminPage() {
  const [tab, setTab] = useState(0);
  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5" fontWeight={700}>System Administration</Typography>
        <Typography variant="body2" color="text.secondary">
          People sign in with their account and appear here as staff. Assign a safety officer by email when that person should receive the records for a district, a region, or Head Office.
        </Typography>
      </Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
        <Tab label="Users" />
        <Tab label="Organization" />
        <Tab label="System" />
      </Tabs>
      {tab === 0 && <UsersTab />}
      {tab === 1 && <OrganizationTab />}
      {tab === 2 && <SystemTab />}
    </Stack>
  );
}
