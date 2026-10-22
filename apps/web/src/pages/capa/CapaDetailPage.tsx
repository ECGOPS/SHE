import { FormEvent, useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, CardContent, Checkbox, Chip, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { Permission, ROOT_CAUSE_METHOD } from '@ecg-she/shared';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import { endpoints } from '../../api/endpoints';
import { ExportReportButton } from '../../components/ExportReportButton';
import {
  CASE_FILE_CARD_SX,
  CaseFileCard,
  CaseFileHeader,
  CaseFileSkeleton,
  formatDay,
  titleCase,
} from '../../components/case-file';
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
  return titleCase(String(value ?? ''));
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
  const [protocolRequired, setProtocolRequired] = useState(false);
  const [protocolNotes, setProtocolNotes] = useState('');
  const [protocolLinkKind, setProtocolLinkKind] = useState('');
  const [protocolLinkId, setProtocolLinkId] = useState('');
  const record = useQuery({ queryKey: ['capa', id], queryFn: () => endpoints.capaOne(id!), enabled: !!id });
  const people = useQuery({ queryKey: ['capa-people'], queryFn: endpoints.capaPeople, enabled: canUpdate });
  const documents = useQuery({
    queryKey: ['management-records', 'DOCUMENT'],
    queryFn: () => endpoints.managementRecords({ kind: 'DOCUMENT', pageSize: 50 }),
    enabled: canUpdate,
  });
  const changes = useQuery({
    queryKey: ['management-records', 'CHANGE'],
    queryFn: () => endpoints.managementRecords({ kind: 'CHANGE', pageSize: 50 }),
    enabled: canUpdate,
  });
  const jsas = useQuery({
    queryKey: ['jsa-protocol-links'],
    queryFn: () => endpoints.jsa({ pageSize: 50 }),
    enabled: canUpdate,
  });
  const hazards = useQuery({
    queryKey: ['hazard-protocol-links'],
    queryFn: () => endpoints.hazards({ pageSize: 50 }),
    enabled: canUpdate,
  });
  useEffect(() => {
    const row = record.data as {
      evidenceNotes?: string | null;
      rootCauseMethod?: string | null;
      rootCauseStatement?: string | null;
      assigneeId?: string | null;
      protocolUpdateRequired?: boolean;
      protocolUpdateNotes?: string | null;
      protocolLinkKind?: string | null;
      protocolLinkId?: string | null;
    } | undefined;
    if (!row) return;
    setEvidence((current) => current || row.evidenceNotes || '');
    setMethod((current) => current || row.rootCauseMethod || '');
    setCause((current) => current || row.rootCauseStatement || '');
    setOwnerId((current) => current || row.assigneeId || '');
    setProtocolRequired(row.protocolUpdateRequired === true);
    setProtocolNotes((current) => current || row.protocolUpdateNotes || '');
    setProtocolLinkKind((current) => current || row.protocolLinkKind || '');
    setProtocolLinkId((current) => current || row.protocolLinkId || '');
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
    protocolUpdateRequired?: boolean;
    protocolUpdateNotes?: string | null;
    protocolLinkKind?: string | null;
    protocolLinkId?: string | null;
    protocolHref?: string | null;
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

  if (record.isLoading || !data) return <CaseFileSkeleton />;

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
      protocolUpdateRequired: protocolRequired,
      protocolUpdateNotes: protocolRequired ? protocolNotes.trim() || undefined : '',
      protocolLinkKind: protocolRequired ? protocolLinkKind || undefined : undefined,
      protocolLinkId: protocolRequired ? protocolLinkId || undefined : undefined,
    });
  };

  return (
    <Stack spacing={2.5}>
      <CaseFileHeader
        backTo="/capa"
        backLabel="Corrective actions"
        reference={data.referenceCode}
        title={data.title || 'Corrective action'}
        chips={[
          { label: words(status), color: STATUS_COLOR[status] ?? 'default' },
          { label: words(data.actionType), variant: 'outlined' },
          { label: words(data.priority), color: data.priority === 'HIGH' || data.priority === 'CRITICAL' ? 'error' : 'default', variant: 'outlined' },
        ]}
        actions={<ExportReportButton filename={`${data.referenceCode}-report.pdf`} download={() => endpoints.capaReport(id!)} />}
        meta={[
          { icon: <EventOutlinedIcon fontSize="small" />, label: 'Due', value: formatDay(data.dueDate) },
          { icon: <PersonOutlineRoundedIcon fontSize="small" />, label: 'Owner', value: data.assignee?.fullName ?? 'Not named' },
          { icon: <FlagOutlinedIcon fontSize="small" />, label: 'Priority', value: words(data.priority) },
          { icon: <LinkOutlinedIcon fontSize="small" />, label: 'Raised from', value: data.sourceType ? (SOURCE_LABEL[data.sourceType] ?? words(data.sourceType)) : 'Not linked' },
        ]}
      />
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      <CaseFileCard title="What must be done">
        <Typography sx={{ mt: 1.5, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{data.description || 'No description was recorded.'}</Typography>
        {data.sourceType && data.sourceHref && (
          <Button component={RouterLink} to={data.sourceHref} size="small" sx={{ mt: 1.5, ml: -1 }}>
            Open the source record
          </Button>
        )}
        {data.rootCauseStatement && <Typography variant="body2" mt={2}>Cause ({words(data.rootCauseMethod)}): {data.rootCauseStatement}</Typography>}
        {data.evidenceNotes && <Typography variant="body2" mt={1}>What was done: {data.evidenceNotes}</Typography>}
        {data.effectivenessOutcome && (
          <Typography variant="body2" mt={1}>
            Check: {words(data.effectivenessOutcome)}{data.effectivenessNotes ? ` — ${data.effectivenessNotes}` : ''}
          </Typography>
        )}
        {data.protocolUpdateRequired && (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap mt={1.5}>
            <Typography variant="body2">
              Protocol update ({words(data.protocolLinkKind) || 'not linked'}): {data.protocolUpdateNotes || 'Required — notes not yet recorded.'}
            </Typography>
            <Button component={RouterLink} to={data.protocolHref || '/management'} size="small">
              Open the linked record
            </Button>
          </Stack>
        )}
      </CaseFileCard>

      {canUpdate && working && (
        <Card sx={CASE_FILE_CARD_SX}>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, fontWeight: 700 }}>Do the work</Typography>
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
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={protocolRequired}
                        onChange={(_, checked) => setProtocolRequired(checked)}
                      />
                    }
                    label="A procedure, JSA, or other protocol was updated"
                  />
                  {protocolRequired && (
                    <>
                      <TextField
                        label="Which protocol and what changed"
                        value={protocolNotes}
                        onChange={(e) => setProtocolNotes(e.target.value)}
                        required
                        multiline
                        minRows={2}
                        fullWidth
                      />
                      <TextField
                        select
                        label="Link to"
                        value={protocolLinkKind}
                        onChange={(e) => { setProtocolLinkKind(e.target.value); setProtocolLinkId(''); }}
                        required
                        fullWidth
                      >
                        <MenuItem value="DOCUMENT">Controlled document</MenuItem>
                        <MenuItem value="JSA">Job safety analysis</MenuItem>
                        <MenuItem value="HAZARD">Hazard</MenuItem>
                        <MenuItem value="CHANGE">Management of change</MenuItem>
                      </TextField>
                      {protocolLinkKind === 'DOCUMENT' && (
                        <TextField select label="Document" value={protocolLinkId} onChange={(e) => setProtocolLinkId(e.target.value)} required fullWidth>
                          {(documents.data?.items ?? []).map((row) => (
                            <MenuItem key={String(row.id)} value={String(row.id)}>{String(row.referenceCode)} · {String(row.title)}</MenuItem>
                          ))}
                        </TextField>
                      )}
                      {protocolLinkKind === 'CHANGE' && (
                        <TextField select label="Change record" value={protocolLinkId} onChange={(e) => setProtocolLinkId(e.target.value)} required fullWidth>
                          {(changes.data?.items ?? []).map((row) => (
                            <MenuItem key={String(row.id)} value={String(row.id)}>{String(row.referenceCode)} · {String(row.title)}</MenuItem>
                          ))}
                        </TextField>
                      )}
                      {protocolLinkKind === 'JSA' && (
                        <TextField select label="JSA" value={protocolLinkId} onChange={(e) => setProtocolLinkId(e.target.value)} required fullWidth>
                          {(jsas.data?.items ?? []).map((row) => (
                            <MenuItem key={String(row.id)} value={String(row.id)}>{String(row.referenceCode ?? row.title)} · {String(row.title)}</MenuItem>
                          ))}
                        </TextField>
                      )}
                      {protocolLinkKind === 'HAZARD' && (
                        <TextField select label="Hazard" value={protocolLinkId} onChange={(e) => setProtocolLinkId(e.target.value)} required fullWidth>
                          {(hazards.data?.items ?? []).map((row) => (
                            <MenuItem key={String(row.id)} value={String(row.id)}>{String(row.referenceCode ?? '')} · {String(row.title)}</MenuItem>
                          ))}
                        </TextField>
                      )}
                      {protocolLinkKind === 'DOCUMENT' && (documents.data?.items ?? []).length === 0 && (
                        <Alert severity="info">Add the procedure under Management → Controlled documents, then link it here.</Alert>
                      )}
                    </>
                  )}
                  <Button type="submit" variant="contained" disabled={progress.isPending} sx={{ alignSelf: 'flex-start' }}>Send for a check</Button>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {status === 'VERIFICATION' && canVerify && !ownWork && (
        <Card sx={CASE_FILE_CARD_SX}>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, fontWeight: 700 }}>Check the result</Typography>
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
