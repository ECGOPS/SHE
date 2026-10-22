import { FormEvent, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Permission, ROLE_LABEL, Role } from '@ecg-she/shared';
import { endpoints, IncidentDto } from '../../api/endpoints';
import { CASE_FILE_CARD_SX } from '../../components/case-file';
import { useAuthStore } from '../../stores/auth.store';

const FINDING_CATEGORIES = [
  { value: 'IMMEDIATE', label: 'Immediate cause' },
  { value: 'UNDERLYING', label: 'Underlying cause' },
  { value: 'ROOT', label: 'Root cause' },
  { value: 'CONTRIBUTING', label: 'Contributing factor' },
] as const;

function errorMessage(err: unknown): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (err as Error)?.message ??
    'Request failed'
  );
}

export function IncidentInvestigation({ incident }: { incident: IncidentDto }) {
  const session = useAuthStore((s) => s.session);
  const permissions = session?.user.permissions ?? [];
  const canRecord = [
    Permission.INCIDENT_UPDATE,
    Permission.INCIDENT_INVESTIGATE,
    Permission.INCIDENT_APPROVE,
  ].some((permission) => permissions.includes(permission));
  const canSubmit = permissions.includes(Permission.INCIDENT_INVESTIGATE);
  const canApprove = permissions.includes(Permission.INCIDENT_APPROVE);
  const canCreateCapa = permissions.includes(Permission.CAPA_CREATE);
  const closed = incident.status === 'CLOSED' || incident.status === 'REJECTED' || !!incident.resolvedAt;
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setError(null);
    await qc.invalidateQueries({ queryKey: ['incident', incident.id] });
    await qc.invalidateQueries({ queryKey: ['incidents'] });
    await qc.invalidateQueries({ queryKey: ['incident-capa', incident.id] });
    await qc.invalidateQueries({ queryKey: ['console'] });
  };

  const assignees = useQuery({
    queryKey: ['incident-assignees', incident.id],
    queryFn: () => endpoints.incidentAssignees(incident.id),
    enabled: canRecord && !closed,
  });
  const capas = useQuery({
    queryKey: ['incident-capa', incident.id],
    queryFn: () =>
      endpoints.capa({ sourceType: 'INCIDENT', sourceId: incident.id, pageSize: 50 }),
    enabled: permissions.includes(Permission.CAPA_READ),
  });
  const documents = useQuery({
    queryKey: ['management-records', 'DOCUMENT'],
    queryFn: () => endpoints.managementRecords({ kind: 'DOCUMENT', pageSize: 50 }),
    enabled: canCreateCapa,
  });
  const changes = useQuery({
    queryKey: ['management-records', 'CHANGE'],
    queryFn: () => endpoints.managementRecords({ kind: 'CHANGE', pageSize: 50 }),
    enabled: canCreateCapa,
  });
  const jsas = useQuery({
    queryKey: ['jsa-protocol-links'],
    queryFn: () => endpoints.jsa({ pageSize: 50 }),
    enabled: canCreateCapa,
  });
  const hazards = useQuery({
    queryKey: ['hazard-protocol-links'],
    queryFn: () => endpoints.hazards({ pageSize: 50 }),
    enabled: canCreateCapa,
  });

  const run = (fn: () => Promise<unknown>) =>
    fn()
      .then(refresh)
      .catch((err: unknown) => setError(errorMessage(err)));

  const assign = useMutation({
    mutationFn: (investigatorId: string) => endpoints.assignIncident(incident.id, investigatorId),
  });
  const witness = useMutation({
    mutationFn: (body: Record<string, unknown>) => endpoints.addIncidentWitness(incident.id, body),
  });
  const finding = useMutation({
    mutationFn: (body: Record<string, unknown>) => endpoints.addIncidentFinding(incident.id, body),
  });
  const capa = useMutation({
    mutationFn: (body: Record<string, unknown>) => endpoints.createCapa(body),
  });
  const submit = useMutation({ mutationFn: () => endpoints.submitIncident(incident.id) });
  const close = useMutation({ mutationFn: () => endpoints.closeIncident(incident.id) });

  const hasRootCause = (incident.findings ?? []).some((item) => item.category === 'ROOT');
  const capaReady = !capas.isFetched || (capas.data?.items ?? []).length > 0;
  const readyForManagement = !!incident.investigatorId && hasRootCause && capaReady;

  const [investigatorId, setInvestigatorId] = useState(incident.investigatorId ?? '');
  useEffect(() => {
    setInvestigatorId(incident.investigatorId ?? '');
  }, [incident.investigatorId]);
  const [witnessName, setWitnessName] = useState('');
  const [witnessRole, setWitnessRole] = useState('');
  const [witnessStatement, setWitnessStatement] = useState('');
  const [category, setCategory] = useState<(typeof FINDING_CATEGORIES)[number]['value']>('IMMEDIATE');
  const [findingText, setFindingText] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [actionTitle, setActionTitle] = useState('');
  const [actionDescription, setActionDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [protocolUpdateRequired, setProtocolUpdateRequired] = useState(false);
  const [protocolUpdateNotes, setProtocolUpdateNotes] = useState('');
  const [protocolLinkKind, setProtocolLinkKind] = useState('');
  const [protocolLinkId, setProtocolLinkId] = useState('');

  const onWitness = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await witness.mutateAsync({
        fullName: witnessName,
        role: witnessRole || undefined,
        statement: witnessStatement,
      });
      setWitnessName('');
      setWitnessRole('');
      setWitnessStatement('');
    });
  };

  const onFinding = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await finding.mutateAsync({
        category,
        description: findingText,
        recommendation: recommendation || undefined,
      });
      setFindingText('');
      setRecommendation('');
    });
  };

  const onCapa = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await capa.mutateAsync({
        title: actionTitle,
        description: actionDescription,
        dueDate,
        sourceType: 'INCIDENT',
        sourceId: incident.id,
        regionId: incident.regionId ?? incident.region?.id,
        districtId: incident.districtId ?? incident.district?.id,
        actionType: 'CORRECTIVE_ACTION',
        priority: incident.severity === 'CATASTROPHIC' || incident.severity === 'MAJOR' ? 'HIGH' : 'MEDIUM',
        protocolUpdateRequired,
        protocolUpdateNotes: protocolUpdateRequired ? protocolUpdateNotes.trim() || undefined : undefined,
        protocolLinkKind: protocolUpdateRequired ? protocolLinkKind || undefined : undefined,
        protocolLinkId: protocolUpdateRequired ? protocolLinkId || undefined : undefined,
      });
      setActionTitle('');
      setActionDescription('');
      setDueDate('');
      setProtocolUpdateRequired(false);
      setProtocolUpdateNotes('');
      setProtocolLinkKind('');
      setProtocolLinkId('');
    });
  };

  const cardSx = CASE_FILE_CARD_SX;

  return (
    <Stack spacing={2.5}>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card sx={cardSx}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ letterSpacing: 1, fontWeight: 700 }}
            >
              Investigation
            </Typography>
            <Chip
              size="small"
              label={incident.investigator?.fullName ? incident.investigator.fullName : 'No investigator'}
              color={incident.investigator?.fullName ? 'primary' : 'warning'}
              variant={incident.investigator?.fullName ? 'filled' : 'outlined'}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" mt={0.75}>
            {canRecord
              ? 'Name who is investigating, record what people saw and the root cause, then raise the action that removes it. Submit the pack to management when that work is on record.'
              : incident.investigator?.fullName
                ? 'You can read who is investigating and what they have recorded. A safety officer assigns the investigator and submits this to management.'
                : 'No investigator has been named yet. The safety officer for this place will assign someone and record witnesses, the root cause and the action here.'}
          </Typography>

          {canRecord && !closed && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mt={2} alignItems={{ sm: 'center' }}>
              <Autocomplete
                size="small"
                options={assignees.data ?? []}
                loading={assignees.isLoading}
                value={(assignees.data ?? []).find((person) => person.id === investigatorId) ?? null}
                onChange={(_, person) => setInvestigatorId(person?.id ?? '')}
                getOptionLabel={(person) => `${person.fullName} · ${ROLE_LABEL[person.role as Role] ?? person.role}`}
                isOptionEqualToValue={(option, current) => option.id === current.id}
                sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 280 }, flex: { sm: 1 } }}
                renderInput={(params) => (
                  <TextField {...params} label="Investigator" placeholder="Search by name" />
                )}
              />
              <Button
                variant="contained"
                disabled={!investigatorId || assign.isPending}
                onClick={() => void run(() => assign.mutateAsync(investigatorId))}
              >
                {incident.investigatorId ? 'Reassign' : 'Assign'}
              </Button>
              {canSubmit && (incident.status === 'REPORTED' || incident.status === 'UNDER_INVESTIGATION') && (
                <Button
                  variant="outlined"
                  disabled={submit.isPending || !readyForManagement}
                  onClick={() => void run(() => submit.mutateAsync())}
                >
                  Submit to management
                </Button>
              )}
              {canApprove && incident.status === 'PENDING_APPROVAL' && (
                <Button variant="contained" color="success" disabled={close.isPending} onClick={() => void run(() => close.mutateAsync())}>
                  Close case
                </Button>
              )}
            </Stack>
          )}
          {canSubmit && (incident.status === 'REPORTED' || incident.status === 'UNDER_INVESTIGATION') && !readyForManagement && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Before submitting to management: assign an investigator, record a root-cause finding, and raise at least one corrective action.
            </Alert>
          )}
          {incident.status === 'PENDING_APPROVAL' && incident.managementReportSubmittedAt && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Submitted to management {new Date(incident.managementReportSubmittedAt).toLocaleString()}
              {incident.managementReportSubmittedBy?.fullName
                ? ` by ${incident.managementReportSubmittedBy.fullName}`
                : ''}
              .
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card sx={cardSx}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, fontWeight: 700 }}>
            Witnesses
          </Typography>
          <Stack spacing={1.25} mt={1.5}>
            {(incident.witnesses ?? []).length === 0 && (
              <Typography variant="body2" color="text.secondary">No witness statements yet.</Typography>
            )}
            {(incident.witnesses ?? []).map((item) => (
              <Box
                key={item.id}
                sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(11, 83, 148, 0.03)' }}
              >
                <Typography variant="body2" fontWeight={700}>
                  {item.fullName}{item.role ? ` · ${item.role}` : ''}
                </Typography>
                <Typography variant="body2" mt={0.5} sx={{ lineHeight: 1.6 }}>{item.statement}</Typography>
              </Box>
            ))}
          </Stack>
          {canRecord && !closed && (
            <Stack component="form" spacing={1.5} mt={2} onSubmit={onWitness}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField size="small" label="Full name" required value={witnessName} onChange={(e) => setWitnessName(e.target.value)} fullWidth />
                <TextField size="small" label="Role" value={witnessRole} onChange={(e) => setWitnessRole(e.target.value)} fullWidth />
              </Stack>
              <TextField size="small" label="Statement" required multiline minRows={2} value={witnessStatement} onChange={(e) => setWitnessStatement(e.target.value)} />
              <Button type="submit" variant="outlined" disabled={witness.isPending} sx={{ alignSelf: 'flex-start' }}>
                Add witness
              </Button>
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card sx={cardSx}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, fontWeight: 700 }}>
            Findings
          </Typography>
          <Stack spacing={1.25} mt={1.5}>
            {(incident.findings ?? []).length === 0 && (
              <Typography variant="body2" color="text.secondary">No causes recorded yet.</Typography>
            )}
            {(incident.findings ?? []).map((item) => (
              <Box
                key={item.id}
                sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
              >
                <Chip size="small" label={item.category.replaceAll('_', ' ')} sx={{ mb: 0.75 }} />
                <Typography variant="body2">{item.description}</Typography>
                {item.recommendation && (
                  <Typography variant="body2" color="text.secondary" mt={0.5}>Recommendation: {item.recommendation}</Typography>
                )}
              </Box>
            ))}
          </Stack>
          {canRecord && !closed && (
            <Stack component="form" spacing={1.5} mt={2} onSubmit={onFinding}>
              <TextField select size="small" label="Category" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
                {FINDING_CATEGORIES.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </TextField>
              <TextField size="small" label="What was found" required multiline minRows={2} value={findingText} onChange={(e) => setFindingText(e.target.value)} />
              <TextField size="small" label="Recommendation" multiline minRows={2} value={recommendation} onChange={(e) => setRecommendation(e.target.value)} />
              <Button type="submit" variant="outlined" disabled={finding.isPending} sx={{ alignSelf: 'flex-start' }}>
                Add finding
              </Button>
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card sx={cardSx}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, fontWeight: 700 }}>
            Corrective actions
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.75}>
            The work that removes the cause. These stay open on the CAPA list until they are verified.
          </Typography>
          <Stack spacing={1.25} mt={1.5}>
            {(capas.data?.items ?? []).length === 0 && (
              <Typography variant="body2" color="text.secondary">No action raised from this incident yet.</Typography>
            )}
            {(capas.data?.items ?? []).map((item) => (
              <Stack
                key={String(item.id)}
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
                sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
              >
                <Typography variant="body2" fontWeight={700}>{String(item.referenceCode ?? '')}</Typography>
                <Typography variant="body2">{String(item.title ?? '')}</Typography>
                <Chip size="small" label={String(item.status ?? '').replaceAll('_', ' ')} />
                <Button component={RouterLink} to={`/capa/${item.id}`} size="small">Open the action</Button>
              </Stack>
            ))}
          </Stack>
          {canCreateCapa && !closed && (
            <Stack component="form" spacing={1.5} mt={2} onSubmit={onCapa}>
              <TextField size="small" label="Action title" required value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} />
              <TextField size="small" label="What must be done" required multiline minRows={2} value={actionDescription} onChange={(e) => setActionDescription(e.target.value)} />
              <TextField size="small" type="date" label="Due date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ maxWidth: 240 }} />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={protocolUpdateRequired}
                    onChange={(_, checked) => setProtocolUpdateRequired(checked)}
                  />
                }
                label="A procedure, JSA, or other protocol must be updated"
              />
              {protocolUpdateRequired && (
                <>
                  <TextField
                    size="small"
                    label="Which protocol and what must change"
                    required
                    multiline
                    minRows={2}
                    value={protocolUpdateNotes}
                    onChange={(e) => setProtocolUpdateNotes(e.target.value)}
                  />
                  <TextField
                    select
                    size="small"
                    label="Link to"
                    required
                    value={protocolLinkKind}
                    onChange={(e) => { setProtocolLinkKind(e.target.value); setProtocolLinkId(''); }}
                  >
                    <MenuItem value="DOCUMENT">Controlled document</MenuItem>
                    <MenuItem value="JSA">Job safety analysis</MenuItem>
                    <MenuItem value="HAZARD">Hazard</MenuItem>
                    <MenuItem value="CHANGE">Management of change</MenuItem>
                  </TextField>
                  {protocolLinkKind === 'DOCUMENT' && (
                    <TextField select size="small" label="Document" required value={protocolLinkId} onChange={(e) => setProtocolLinkId(e.target.value)}>
                      {(documents.data?.items ?? []).map((row) => (
                        <MenuItem key={String(row.id)} value={String(row.id)}>{String(row.referenceCode)} · {String(row.title)}</MenuItem>
                      ))}
                    </TextField>
                  )}
                  {protocolLinkKind === 'CHANGE' && (
                    <TextField select size="small" label="Change record" required value={protocolLinkId} onChange={(e) => setProtocolLinkId(e.target.value)}>
                      {(changes.data?.items ?? []).map((row) => (
                        <MenuItem key={String(row.id)} value={String(row.id)}>{String(row.referenceCode)} · {String(row.title)}</MenuItem>
                      ))}
                    </TextField>
                  )}
                  {protocolLinkKind === 'JSA' && (
                    <TextField select size="small" label="JSA" required value={protocolLinkId} onChange={(e) => setProtocolLinkId(e.target.value)}>
                      {(jsas.data?.items ?? []).map((row) => (
                        <MenuItem key={String(row.id)} value={String(row.id)}>{String(row.referenceCode ?? '')} · {String(row.title)}</MenuItem>
                      ))}
                    </TextField>
                  )}
                  {protocolLinkKind === 'HAZARD' && (
                    <TextField select size="small" label="Hazard" required value={protocolLinkId} onChange={(e) => setProtocolLinkId(e.target.value)}>
                      {(hazards.data?.items ?? []).map((row) => (
                        <MenuItem key={String(row.id)} value={String(row.id)}>{String(row.referenceCode ?? '')} · {String(row.title)}</MenuItem>
                      ))}
                    </TextField>
                  )}
                </>
              )}
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button type="submit" variant="outlined" disabled={capa.isPending} sx={{ alignSelf: 'flex-start' }}>
                  Raise corrective action
                </Button>
                {protocolUpdateRequired && (
                  <Button component={RouterLink} to="/management" size="small">
                    Open ISO registers
                  </Button>
                )}
              </Stack>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
