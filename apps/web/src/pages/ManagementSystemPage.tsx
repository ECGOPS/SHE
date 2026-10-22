import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Permission, isDistrictScope, isGlobalScope, isSafetyOfficer, reportsInChosenPlace } from '@ecg-she/shared';
import { endpoints } from '../api/endpoints';
import { useAuthStore } from '../stores/auth.store';

const STANDARDS = [
  { value: 'OH_S', label: 'Safety — ISO 45001' },
  { value: 'ENVIRONMENT', label: 'Environment — ISO 14001' },
  { value: 'BOTH', label: 'Both standards' },
];

const COMPLIANCE = [
  { value: 'NOT_EVALUATED', label: 'Not yet evaluated' },
  { value: 'COMPLIANT', label: 'Met' },
  { value: 'PARTIAL', label: 'Partly met' },
  { value: 'NONCOMPLIANT', label: 'Not met' },
];

function errorMessage(err: unknown): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? (err as Error)?.message ?? 'The record was not saved.';
}

export function ManagementSystemPage() {
  const session = useAuthStore((s) => s.session);
  const role = session?.user.role;
  const canManage = (session?.user.permissions ?? []).includes(Permission.IMS_MANAGE);
  const global = !!role && isGlobalScope(role);
  const districtOfficer = !!role && isSafetyOfficer(role) && isDistrictScope(role);
  const choosesPlace = !!role && reportsInChosenPlace(role);
  const queryClient = useQueryClient();
  const summary = useQuery({ queryKey: ['management-summary'], queryFn: endpoints.managementSummary });
  const [kind, setKind] = useState<string>('POLICY');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [standard, setStandard] = useState('BOTH');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [regionId, setRegionId] = useState(session?.user.regionId ?? '');
  const [districtId, setDistrictId] = useState(session?.user.districtId ?? '');
  const [dueOn, setDueOn] = useState('');
  const [complianceResult, setComplianceResult] = useState('NOT_EVALUATED');
  const [significant, setSignificant] = useState('false');
  const [issueOrigin, setIssueOrigin] = useState('INTERNAL');
  const [documentVersion, setDocumentVersion] = useState('1.0');
  const [documentStatus, setDocumentStatus] = useState('DRAFT');
  const [audience, setAudience] = useState('');
  const [frequency, setFrequency] = useState('');

  const regions = useQuery({ queryKey: ['regions'], queryFn: endpoints.regions, enabled: open });
  const districts = useQuery({
    queryKey: ['districts', regionId],
    queryFn: () => endpoints.districts(regionId),
    enabled: open && !!regionId,
  });
  const records = useQuery({
    queryKey: ['management-records', kind],
    queryFn: () => endpoints.managementRecords({ kind, page: 1, pageSize: 50 }),
  });

  const topic = summary.data?.topics.find((item) => item.kind === kind);
  const canAdd = (itemKind: string) => {
    if (itemKind === 'CONSULTATION') return true;
    if (!canManage) return false;
    if (itemKind === 'POLICY' || itemKind === 'SCOPE' || itemKind === 'CONTEXT') return global;
    if (itemKind === 'REVIEW') return !districtOfficer;
    return true;
  };

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['management-summary'] });
    void queryClient.invalidateQueries({ queryKey: ['management-records'] });
  };

  const create = useMutation({
    mutationFn: () => endpoints.createManagementRecord({
      kind,
      standard,
      title: title.trim(),
      description: description.trim(),
      clauseRef: topic?.clause,
      ownerName: ownerName.trim() || undefined,
      regionId: regionId || undefined,
      districtId: districtId || undefined,
      dueOn: dueOn || undefined,
      complianceResult: kind === 'OBLIGATION' ? complianceResult : undefined,
      significant: kind === 'ASPECT' ? significant === 'true' : undefined,
      issueOrigin: kind === 'CONTEXT' ? issueOrigin : undefined,
      documentVersion: kind === 'DOCUMENT' ? documentVersion.trim() || undefined : undefined,
      documentStatus: kind === 'DOCUMENT' ? documentStatus : undefined,
      audience: kind === 'COMMUNICATION' ? audience.trim() || undefined : undefined,
      frequency: kind === 'COMMUNICATION' || kind === 'MONITORING' ? frequency.trim() || undefined : undefined,
    }),
    onSuccess: () => {
      setOpen(false);
      setTitle('');
      setDescription('');
      setOwnerName('');
      setDueOn('');
      setAudience('');
      setFrequency('');
      setError(null);
      refresh();
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const closeRecord = useMutation({
    mutationFn: (id: string) => endpoints.updateManagementRecord(id, { status: 'CLOSED' }),
    onSuccess: refresh,
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    create.mutate();
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" fontWeight={700}>Management system</Typography>
        <Typography color="text.secondary">
          ISO 45001 and ISO 14001. Add ECG’s real policy, legal, document, communication and monitoring records here. Nothing is pre-filled.
        </Typography>
      </Box>
      {summary.isError && <Alert severity="error">The management system could not be loaded.</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
        {(summary.data?.topics ?? []).map((item) => (
          <Card
            key={item.kind}
            variant="outlined"
            onClick={() => setKind(item.kind)}
            sx={{ cursor: 'pointer', borderColor: item.kind === kind ? 'primary.main' : 'divider' }}
          >
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography fontWeight={700}>{item.title}</Typography>
                <Chip size="small" label={item.count > 0 ? `${item.count} recorded` : 'Not recorded'} color={item.count > 0 ? 'success' : 'warning'} />
              </Stack>
              <Typography variant="caption" color="text.secondary" display="block">{item.clause}</Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>{item.prompt}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">{topic?.title ?? 'Records'}</Typography>
        {canAdd(kind) && (
          <Button variant="contained" onClick={() => { setError(null); setOpen(true); }}>Add record</Button>
        )}
      </Stack>
      <Stack spacing={1}>
        {(records.data?.items ?? []).map((row) => (
          <Card key={String(row.id)} variant="outlined">
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                <Box>
                  <Typography fontWeight={700}>{String(row.title)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {String(row.referenceCode)} · {String(row.standard)} · {String(row.status)}
                    {row.ownerName ? ` · ${String(row.ownerName)}` : ''}
                    {row.complianceResult ? ` · ${String(row.complianceResult)}` : ''}
                    {row.kind === 'ASPECT' ? ` · ${row.significant ? 'Significant' : 'Not significant'}` : ''}
                    {row.issueOrigin ? ` · ${String(row.issueOrigin)}` : ''}
                    {row.documentVersion ? ` · v${String(row.documentVersion)}` : ''}
                    {row.documentStatus ? ` · ${String(row.documentStatus)}` : ''}
                    {row.audience ? ` · ${String(row.audience)}` : ''}
                    {row.frequency ? ` · ${String(row.frequency)}` : ''}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                  {canManage && row.kind === 'DOCUMENT' && row.documentStatus === 'DRAFT' && (
                    <Button
                      size="small"
                      variant="contained"
                      disabled={closeRecord.isPending}
                      onClick={() => endpoints.updateManagementRecord(String(row.id), { documentStatus: 'CURRENT' }).then(refresh)}
                    >
                      Issue as current
                    </Button>
                  )}
                  {canManage && row.status === 'OPEN' && (
                    <Button size="small" variant="outlined" disabled={closeRecord.isPending} onClick={() => closeRecord.mutate(String(row.id))}>
                      Close
                    </Button>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ))}
        {records.isSuccess && (records.data?.items.length ?? 0) === 0 && (
          <Typography color="text.secondary">Nothing is recorded here yet.</Typography>
        )}
      </Stack>
      <Box>
        <Typography variant="h6" gutterBottom>Already covered</Typography>
        <Stack spacing={0.5}>
          {(summary.data?.covered ?? []).map((item) => (
            <Typography key={item.clause} variant="body2">
              {item.title} ({item.clause}) — {item.where}
            </Typography>
          ))}
        </Stack>
      </Box>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add {topic?.title?.toLowerCase() ?? 'record'}</DialogTitle>
        <Box component="form" onSubmit={onSubmit}>
          <DialogContent>
            <Stack spacing={2}>
              {error && <Alert severity="error">{error}</Alert>}
              <Typography variant="body2" color="text.secondary">{topic?.prompt}</Typography>
              <TextField select label="Standard" value={standard} onChange={(e) => setStandard(e.target.value)} required>
                {STANDARDS.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
              </TextField>
              <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required inputProps={{ minLength: 3, maxLength: 200 }} />
              <TextField label="What was decided or found" value={description} onChange={(e) => setDescription(e.target.value)} required multiline minRows={3} inputProps={{ minLength: 10, maxLength: 4000 }} />
              <TextField label="Owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              <TextField select label="Region" value={regionId} onChange={(e) => { setRegionId(e.target.value); setDistrictId(''); }} required disabled={!choosesPlace && !global && !!session?.user.regionId}>
                {(regions.data ?? []).map((region) => <MenuItem key={region.id} value={region.id}>{region.name}</MenuItem>)}
              </TextField>
              <TextField select label="District" value={districtId} onChange={(e) => setDistrictId(e.target.value)} required={choosesPlace}>
                <MenuItem value="">Whole region</MenuItem>
                {(districts.data ?? []).map((district) => <MenuItem key={district.id} value={district.id}>{district.name}</MenuItem>)}
              </TextField>
              <TextField
                label={
                  kind === 'REVIEW' || kind === 'EMERGENCY'
                    ? 'Date held or tested'
                    : kind === 'DOCUMENT'
                      ? 'Review by'
                      : kind === 'MONITORING'
                        ? 'Next measurement'
                        : 'Due date'
                }
                type="date"
                value={dueOn}
                onChange={(e) => setDueOn(e.target.value)}
                InputLabelProps={{ shrink: true }}
                required={kind === 'OBJECTIVE' || kind === 'EMERGENCY' || kind === 'REVIEW' || kind === 'DOCUMENT' || kind === 'MONITORING'}
              />
              {kind === 'CONTEXT' && (
                <TextField select label="Origin" value={issueOrigin} onChange={(e) => setIssueOrigin(e.target.value)} required>
                  <MenuItem value="INTERNAL">Internal</MenuItem>
                  <MenuItem value="EXTERNAL">External</MenuItem>
                </TextField>
              )}
              {kind === 'DOCUMENT' && (
                <>
                  <TextField label="Version" value={documentVersion} onChange={(e) => setDocumentVersion(e.target.value)} required />
                  <TextField select label="Document status" value={documentStatus} onChange={(e) => setDocumentStatus(e.target.value)} required>
                    <MenuItem value="DRAFT">Draft</MenuItem>
                    <MenuItem value="CURRENT">Current</MenuItem>
                    <MenuItem value="SUPERSEDED">Superseded</MenuItem>
                  </TextField>
                </>
              )}
              {kind === 'COMMUNICATION' && (
                <>
                  <TextField label="Audience" value={audience} onChange={(e) => setAudience(e.target.value)} required />
                  <TextField label="How often" value={frequency} onChange={(e) => setFrequency(e.target.value)} required />
                </>
              )}
              {kind === 'MONITORING' && (
                <TextField label="How often / method" value={frequency} onChange={(e) => setFrequency(e.target.value)} required />
              )}
              {kind === 'OBLIGATION' && (
                <TextField select label="Does ECG meet it?" value={complianceResult} onChange={(e) => setComplianceResult(e.target.value)} required>
                  {COMPLIANCE.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
                </TextField>
              )}
              {kind === 'ASPECT' && (
                <TextField select label="Significance" value={significant} onChange={(e) => setSignificant(e.target.value)} required>
                  <MenuItem value="true">Significant</MenuItem>
                  <MenuItem value="false">Not significant</MenuItem>
                </TextField>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={create.isPending}>Save</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  );
}
