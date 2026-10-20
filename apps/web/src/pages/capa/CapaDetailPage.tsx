import { FormEvent, useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, CardContent, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { Permission, ROOT_CAUSE_METHOD } from '@ecg-she/shared';
import { endpoints } from '../../api/endpoints';
import { ExportReportButton } from '../../components/ExportReportButton';
import { useAuthStore } from '../../stores/auth.store';
import { SupervisorField } from '../jsa/ChoiceFields';

const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  OPEN: 'default',
  ASSIGNED: 'info',
  IN_PROGRESS: 'warning',
  VERIFICATION: 'info',
  CLOSED: 'success',
  OVERDUE: 'error',
};

const SOURCE_LABEL: Record<string, string> = {
  INCIDENT: 'Incident',
  HAZARD: 'Hazard',
  NEAR_MISS: 'Near-miss',
  INSPECTION: 'Inspection',
  AUDIT_FINDING: 'Audit finding',
  ENVIRONMENTAL_EVENT: 'Environmental event',
  INTERNAL_REVIEW: 'Management review',
  CUSTOMER_COMPLAINT: 'Complaint',
};

function words(value: unknown): string {
  return String(value ?? '').replaceAll('_', ' ');
}

function errorMessage(err: unknown): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? (err as Error)?.message ?? 'Request failed';
}

export function CapaDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const permissions = useAuthStore((s) => s.session?.user.permissions) ?? [];
  const userId = useAuthStore((s) => s.session?.user.id);
  const canUpdate = permissions.includes(Permission.CAPA_UPDATE);
  const canVerify = permissions.includes(Permission.CAPA_VERIFY);
  const [error, setError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState('');
  const [method, setMethod] = useState('');
  const [cause, setCause] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [outcome, setOutcome] = useState('EFFECTIVE');
  const [notes, setNotes] = useState('');
  const record = useQuery({ queryKey: ['capa', id], queryFn: () => endpoints.capaOne(id!), enabled: !!id });
  const people = useQuery({ queryKey: ['capa-people'], queryFn: endpoints.capaPeople, enabled: canUpdate });
  useEffect(() => {
    const row = record.data as { evidenceNotes?: string | null; rootCauseMethod?: string | null; rootCauseStatement?: string | null; assigneeId?: string | null } | undefined;
    if (!row) return;
    setEvidence((current) => current || row.evidenceNotes || '');
    setMethod((current) => current || row.rootCauseMethod || '');
    setCause((current) => current || row.rootCauseStatement || '');
    setOwnerId((current) => current || row.assigneeId || '');
  }, [record.data]);
  const data = record.data as {
    referenceCode?: string;
    title?: string;
    description?: string;
    status?: string;
    actionType?: string;
    priority?: string;
    dueDate?: string;
    sourceType?: string | null;
    sourceHref?: string | null;
    assigneeId?: string | null;
    assignee?: { fullName?: string } | null;
    evidenceNotes?: string | null;
    rootCauseMethod?: string | null;
    rootCauseStatement?: string | null;
    effectivenessOutcome?: string | null;
    effectivenessNotes?: string | null;
  } | undefined;

  const refresh = async () => {
    setError(null);
    await qc.invalidateQueries({ queryKey: ['capa'] });
  };
  const progress = useMutation({
    mutationFn: (body: Record<string, unknown>) => endpoints.updateCapaProgress(id!, body),
    onSuccess: refresh,
    onError: (err) => setError(errorMessage(err)),
  });
  const verify = useMutation({
    mutationFn: () => endpoints.verifyCapa(id!, { effectivenessOutcome: outcome, notes: notes.trim() || undefined }),
    onSuccess: refresh,
    onError: (err) => setError(errorMessage(err)),
  });

  if (record.isLoading || !data) return <Typography>Loading...</Typography>;

  const status = data.status ?? 'OPEN';
  const closed = status === 'CLOSED' || status === 'REJECTED';
  const needsCause = data.actionType === 'CORRECTIVE_ACTION' || data.actionType === 'PREVENTIVE_ACTION';
  const ownWork = !!data.assigneeId && data.assigneeId === userId;
  const working = status === 'OPEN' || status === 'ASSIGNED' || status === 'IN_PROGRESS' || status === 'OVERDUE';

  const onEvidence = (event: FormEvent) => {
    event.preventDefault();
    progress.mutate({
      status: 'VERIFICATION',
      evidenceNotes: evidence.trim() || data.evidenceNotes || undefined,
      rootCauseMethod: method || data.rootCauseMethod || undefined,
      rootCauseStatement: cause.trim() || data.rootCauseStatement || undefined,
      assigneeId: ownerId || undefined,
    });
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="h5" fontWeight={700}>{data.referenceCode}</Typography>
          <Chip size="small" label={words(status)} color={STATUS_COLOR[status] ?? 'default'} />
          <Chip size="small" label={words(data.actionType)} variant="outlined" />
        </Stack>
        <ExportReportButton filename={`${data.referenceCode}-report.pdf`} download={() => endpoints.capaReport(id!)} />
      </Stack>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      <Card>
        <CardContent>
          <Typography variant="h6">{data.title}</Typography>
          <Typography variant="body2" mt={1}>{data.description}</Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            Due {data.dueDate ? String(data.dueDate).slice(0, 10) : '—'} · {words(data.priority)} · Owner {data.assignee?.fullName ?? 'Not named'}
          </Typography>
          {data.sourceType && (
            <Typography variant="body2" mt={1}>
              Raised from {SOURCE_LABEL[data.sourceType] ?? words(data.sourceType)}
              {data.sourceHref ? <> · <Button component={RouterLink} to={data.sourceHref} size="small">Open the record</Button></> : null}
            </Typography>
          )}
          {data.rootCauseStatement && <Typography variant="body2" mt={1}>Cause ({words(data.rootCauseMethod)}): {data.rootCauseStatement}</Typography>}
          {data.evidenceNotes && <Typography variant="body2" mt={1}>What was done: {data.evidenceNotes}</Typography>}
          {data.effectivenessOutcome && (
            <Typography variant="body2" mt={1}>
              Check: {words(data.effectivenessOutcome)}{data.effectivenessNotes ? ` — ${data.effectivenessNotes}` : ''}
            </Typography>
          )}
        </CardContent>
      </Card>

      {canUpdate && working && (
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={700}>Do the work</Typography>
            <Stack spacing={1.5} mt={1} component="form" onSubmit={onEvidence}>
              {status !== 'IN_PROGRESS' && status !== 'OVERDUE' && (
                <Button type="button" variant="outlined" onClick={() => progress.mutate({ status: 'IN_PROGRESS', assigneeId: ownerId || undefined })} sx={{ alignSelf: 'flex-start' }}>
                  Start the work
                </Button>
              )}
              <SupervisorField label="Owner" people={people.data ?? []} value={ownerId} onChange={setOwnerId} helperText="A different officer checks the result." />
              {(status === 'IN_PROGRESS' || status === 'OVERDUE') && (
                <>
                  {needsCause && (
                    <>
                      <TextField select label="How the cause was found" value={method} onChange={(e) => setMethod(e.target.value)} required fullWidth>
                        {ROOT_CAUSE_METHOD.map((item) => <MenuItem key={item} value={item}>{words(item)}</MenuItem>)}
                      </TextField>
                      <TextField label="The cause" value={cause} onChange={(e) => setCause(e.target.value)} required multiline minRows={2} fullWidth />
                    </>
                  )}
                  <TextField label="What was done" value={evidence} onChange={(e) => setEvidence(e.target.value)} required multiline minRows={2} fullWidth />
                  <Button type="submit" variant="contained" disabled={progress.isPending} sx={{ alignSelf: 'flex-start' }}>Send for a check</Button>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {status === 'VERIFICATION' && canVerify && !ownWork && (
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={700}>Check the result</Typography>
            <Typography variant="body2" color="text.secondary">An effective action is closed. Anything else goes back to the owner.</Typography>
            <Stack spacing={1.5} mt={1} component="form" onSubmit={(event: FormEvent) => { event.preventDefault(); verify.mutate(); }}>
              <TextField select label="Result" value={outcome} onChange={(e) => setOutcome(e.target.value)} fullWidth>
                <MenuItem value="EFFECTIVE">Effective — the cause is removed</MenuItem>
                <MenuItem value="PARTIAL">Partial — some of it remains</MenuItem>
                <MenuItem value="INEFFECTIVE">Not effective — send it back</MenuItem>
              </TextField>
              <TextField label="What you found" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} fullWidth />
              <Button type="submit" variant="contained" disabled={verify.isPending} sx={{ alignSelf: 'flex-start' }}>Record the check</Button>
            </Stack>
          </CardContent>
        </Card>
      )}
      {status === 'VERIFICATION' && ownWork && (
        <Alert severity="info">This is waiting for a different officer to check the result.</Alert>
      )}
      {closed && <Alert severity="success">This action is closed.</Alert>}
    </Stack>
  );
}
