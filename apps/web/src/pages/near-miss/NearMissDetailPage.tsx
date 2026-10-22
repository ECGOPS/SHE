import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  FormControlLabel,
  DialogContent,
  Grid2 as Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { EscalationEntityType, ISSUE_SCOPE_LABEL, IssueScope, Permission, ROLE_LABEL, Role, SEVERITY_POTENTIAL } from '@ecg-she/shared';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import { endpoints, NearMissDto } from '../../api/endpoints';
import { imageSrcFromBlob } from '../../security/output';
import { ExportReportButton } from '../../components/ExportReportButton';
import { EscalationPanel } from '../../components/EscalationPanel';
import {
  CASE_FILE_CARD_SX,
  CaseFileCard,
  CaseFileHeader,
  CaseFileSkeleton,
  formatWhen,
  placeName,
  titleCase,
} from '../../components/case-file';
import { useAuthStore } from '../../stores/auth.store';

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
  CLOSED: 'success',
  CONVERTED: 'info',
};

function errorMessage(err: unknown): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (err as Error)?.message ??
    'Request failed'
  );
}

export function NearMissDetailPage() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['near-miss', id],
    queryFn: () => endpoints.nearMissOne(id!),
    enabled: !!id,
  });

  if (isLoading || !data) return <CaseFileSkeleton />;

  const scope = ISSUE_SCOPE_LABEL[data.currentScope ?? IssueScope.DISTRICT];
  const reporter = data.anonymous
    ? data.reportedBy?.fullName
      ? `Confidential · ${data.reportedBy.fullName}`
      : 'Confidential'
    : data.reportedBy?.fullName ?? '—';

  return (
    <Stack spacing={2.5}>
      <CaseFileHeader
        backTo="/near-miss"
        backLabel="Near miss"
        reference={data.referenceCode}
        title={data.title}
        chips={[
          { label: titleCase(data.status), color: STATUS_COLOR[data.status] ?? 'warning' },
          {
            label: titleCase(data.severityPotential) === '—' ? 'Unrated' : titleCase(data.severityPotential),
            color: SEV_COLOR[data.severityPotential ?? ''] ?? 'default',
            variant: data.severityPotential ? 'filled' : 'outlined',
          },
          { label: titleCase(data.category), variant: 'outlined' },
          { label: data.resolvedAt ? `Resolved at ${scope}` : `Open at ${scope}`, variant: 'outlined' },
        ]}
        actions={<ExportReportButton filename={`${data.referenceCode}-report.pdf`} download={() => endpoints.nearMissReport(id!)} />}
        meta={[
          { icon: <EventOutlinedIcon fontSize="small" />, label: 'Occurred', value: formatWhen(data.occurredAt) },
          { icon: <PlaceOutlinedIcon fontSize="small" />, label: 'Location', value: data.locationName || placeName(data.region, data.district) },
          { icon: <PersonOutlineRoundedIcon fontSize="small" />, label: 'Reported by', value: reporter },
          { icon: <AssignmentIndOutlinedIcon fontSize="small" />, label: 'Reviewer', value: data.investigator?.fullName ?? 'Not assigned' },
        ]}
      />

      <CaseFileCard title="What happened">
        <Typography sx={{ mt: 1.5, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
          {data.description || 'No description was recorded.'}
        </Typography>
        {(data.bodyPartAtRisk || data.potentialInjuryNature) && (
          <Typography variant="body2" color="text.secondary" mt={2}>
            {[data.bodyPartAtRisk, data.potentialInjuryNature].filter(Boolean).join(' · ').replaceAll('_', ' ')}
          </Typography>
        )}
      </CaseFileCard>

      <Photos nearMiss={data} />
      <Review nearMiss={data} />

      <EscalationPanel
        entityType={EscalationEntityType.NEAR_MISS}
        entityId={data.id}
        requireActionBeforeClose={
          !data.resolvedAt && (data.severityPotential === 'MAJOR' || data.severityPotential === 'CATASTROPHIC')
        }
        currentScope={data.currentScope ?? IssueScope.DISTRICT}
        resolvedAt={data.resolvedAt}
        resolvedAtScope={data.resolvedAtScope}
        resolutionNotes={data.resolutionNotes}
        referenceCode={data.referenceCode}
      />
    </Stack>
  );
}

function Photos({ nearMiss }: { nearMiss: NearMissDto }) {
  const photos = nearMiss.attachments ?? [];
  if (photos.length === 0) return null;
  return (
    <CaseFileCard title="Photo evidence" hint="Captured or uploaded with this report.">
        <Grid container spacing={2} mt={2}>
          {photos.map((photo) => (
            <Grid key={photo.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <PhotoThumb nearMissId={nearMiss.id} photo={photo} />
            </Grid>
          ))}
        </Grid>
    </CaseFileCard>
  );
}

function PhotoThumb({
  nearMissId,
  photo,
}: {
  nearMissId: string;
  photo: NonNullable<NearMissDto['attachments']>[number];
}) {
  const { data: blob } = useQuery({
    queryKey: ['near-miss-photo', nearMissId, photo.id],
    queryFn: async () => (await endpoints.nearMissAttachmentFile(nearMissId, photo.id)).data as Blob,
  });
  const [open, setOpen] = useState(false);
  const src = useMemo(() => imageSrcFromBlob(blob), [blob]);
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);
  return (
    <>
      <Box
        component="button"
        type="button"
        aria-label={`View ${photo.fileName} full size`}
        disabled={!src}
        onClick={() => setOpen(true)}
        sx={{
          display: 'block',
          width: '100%',
          p: 0,
          border: 0,
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'action.hover',
          aspectRatio: '4 / 3',
          cursor: src ? 'zoom-in' : 'default',
        }}
      >
        {src && <Box component="img" src={src} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      </Box>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth={false}>
        <DialogContent sx={{ p: 0, bgcolor: 'common.black', position: 'relative', lineHeight: 0 }}>
          <Button
            onClick={() => setOpen(false)}
            sx={{ position: 'absolute', top: 8, right: 8, color: 'common.white', bgcolor: 'rgba(0,0,0,0.45)' }}
          >
            Close
          </Button>
          {src && (
            <Box
              component="img"
              src={src}
              alt={photo.fileName}
              sx={{ display: 'block', maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain' }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Review({ nearMiss }: { nearMiss: NearMissDto }) {
  const session = useAuthStore((s) => s.session);
  const navigate = useNavigate();
  const permissions = session?.user.permissions ?? [];
  const canReview = [Permission.INCIDENT_UPDATE, Permission.INCIDENT_INVESTIGATE, Permission.INCIDENT_APPROVE]
    .some((permission) => permissions.includes(permission));
  const canCreateCapa = permissions.includes(Permission.CAPA_CREATE);
  const canReportIncident = permissions.includes(Permission.INCIDENT_CREATE);
  const closed = nearMiss.status === 'CLOSED' || !!nearMiss.resolvedAt;
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [investigatorId, setInvestigatorId] = useState(nearMiss.investigatorId ?? '');
  const [immediateCause, setImmediateCause] = useState(nearMiss.immediateCause ?? '');
  const [rootCause, setRootCause] = useState(nearMiss.rootCause ?? '');
  const [witnessStatement, setWitnessStatement] = useState(nearMiss.witnessStatement ?? '');
  const [severityPotential, setSeverityPotential] = useState(nearMiss.severityPotential ?? '');
  const [notes, setNotes] = useState('');
  const [noFurtherAction, setNoFurtherAction] = useState(false);
  const [actionTitle, setActionTitle] = useState('');
  const [actionDescription, setActionDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  const assignees = useQuery({
    queryKey: ['near-miss-assignees', nearMiss.id],
    queryFn: () => endpoints.nearMissAssignees(nearMiss.id),
    enabled: canReview && !closed,
  });
  const capas = useQuery({
    queryKey: ['near-miss-capa', nearMiss.id],
    queryFn: () => endpoints.capa({ sourceType: 'NEAR_MISS', sourceId: nearMiss.id, pageSize: 50 }),
    enabled: permissions.includes(Permission.CAPA_READ),
  });

  const refresh = async () => {
    setError(null);
    await qc.invalidateQueries({ queryKey: ['near-miss'] });
    await qc.invalidateQueries({ queryKey: ['console'] });
    await qc.invalidateQueries({ queryKey: ['near-miss-capa', nearMiss.id] });
  };
  const run = (fn: () => Promise<unknown>) => fn().then(refresh).catch((err: unknown) => setError(errorMessage(err)));

  const onReview = (event: FormEvent) => {
    event.preventDefault();
    void run(() => endpoints.reviewNearMiss(nearMiss.id, {
      immediateCause,
      rootCause,
      witnessStatement,
      severityPotential: severityPotential || undefined,
    }));
  };

  const onCapa = (event: FormEvent) => {
    event.preventDefault();
    const high = severityPotential === 'MAJOR' || severityPotential === 'CATASTROPHIC';
    void run(async () => {
      await endpoints.createCapa({
        title: actionTitle,
        description: actionDescription,
        dueDate,
        sourceType: 'NEAR_MISS',
        sourceId: nearMiss.id,
        regionId: nearMiss.regionId ?? nearMiss.region?.id,
        districtId: nearMiss.districtId ?? nearMiss.district?.id,
        actionType: 'CORRECTIVE_ACTION',
        priority: high ? 'HIGH' : 'MEDIUM',
      });
      setActionTitle('');
      setActionDescription('');
      setDueDate('');
    });
  };

  return (
    <Stack spacing={2.5}>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      <Card sx={CASE_FILE_CARD_SX}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, fontWeight: 700 }}>
              Review
            </Typography>
            <Chip
              size="small"
              label={nearMiss.investigator?.fullName ? nearMiss.investigator.fullName : 'No reviewer'}
              color={nearMiss.investigator?.fullName ? 'primary' : 'warning'}
              variant={nearMiss.investigator?.fullName ? 'filled' : 'outlined'}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" mt={0.75}>
            Confirm how serious it could have been, record the cause, then close it or raise the action that stops it happening.
          </Typography>

          {canReview && !closed && (
            <Stack spacing={2} mt={2} component="form" onSubmit={onReview}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                <TextField select label="Safety officer" size="small" value={investigatorId} onChange={(e) => setInvestigatorId(e.target.value)} sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 260 }, flex: { sm: 1 } }}>
                  <MenuItem value="">— select —</MenuItem>
                  {(assignees.data ?? []).map((person) => (
                    <MenuItem key={person.id} value={person.id}>
                      {person.fullName} · {ROLE_LABEL[person.role as Role] ?? person.role}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="contained"
                  disabled={!investigatorId}
                  onClick={() => void run(() => endpoints.assignNearMiss(nearMiss.id, investigatorId))}
                >
                  Assign
                </Button>
              </Stack>
              <TextField select label="Confirmed severity potential" size="small" value={severityPotential} onChange={(e) => setSeverityPotential(e.target.value)}>
                {SEVERITY_POTENTIAL.map((value) => (
                  <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>
                ))}
              </TextField>
              <TextField label="Immediate cause" value={immediateCause} onChange={(e) => setImmediateCause(e.target.value)} multiline minRows={2} fullWidth />
              <TextField label="Root / system cause" value={rootCause} onChange={(e) => setRootCause(e.target.value)} multiline minRows={2} fullWidth />
              <TextField label="Witness statement" value={witnessStatement} onChange={(e) => setWitnessStatement(e.target.value)} multiline minRows={2} fullWidth />
              <Box>
                <Button type="submit" variant="outlined">Save review</Button>
              </Box>
            </Stack>
          )}

          {(nearMiss.immediateCause || nearMiss.rootCause || nearMiss.witnessStatement) && (closed || !canReview) && (
            <Stack spacing={1} mt={2}>
              {nearMiss.immediateCause && <Typography><strong>Immediate cause. </strong>{nearMiss.immediateCause}</Typography>}
              {nearMiss.rootCause && <Typography><strong>Root cause. </strong>{nearMiss.rootCause}</Typography>}
              {nearMiss.witnessStatement && <Typography><strong>Witness. </strong>{nearMiss.witnessStatement}</Typography>}
            </Stack>
          )}

          {nearMiss.resolutionNotes && (
            <Typography mt={2}><strong>Close-out. </strong>{nearMiss.resolutionNotes}</Typography>
          )}

          {nearMiss.convertedIncidentId && (
            <Button sx={{ mt: 2 }} variant="outlined" onClick={() => navigate(`/incidents/${nearMiss.convertedIncidentId}`)}>
              Open the incident filed from this report
            </Button>
          )}

          {canReview && !closed && (
            <Stack spacing={1} mt={2}>
              {(nearMiss.severityPotential === 'MAJOR' || nearMiss.severityPotential === 'CATASTROPHIC') && (
                <>
                  <Alert severity="warning">
                    Major and catastrophic near misses need a saved cause, then either a corrective action or a decision that no further action is required.
                  </Alert>
                  <FormControlLabel
                    control={<Checkbox checked={noFurtherAction} onChange={(e) => setNoFurtherAction(e.target.checked)} />}
                    label="No further action is required"
                  />
                </>
              )}
              <TextField label="How was this reviewed?" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth size="small" />
              <Box>
                <Button
                  variant="contained"
                  color="success"
                  disabled={!notes.trim()}
                  onClick={() => void run(() => endpoints.closeNearMiss(nearMiss.id, notes.trim(), noFurtherAction))}
                >
                  Close
                </Button>
              </Box>
            </Stack>
          )}

          {canReportIncident && !closed && (
            <Button
              sx={{ mt: 2 }}
              variant="text"
              onClick={() => navigate('/incidents/new', {
                state: {
                  fromNearMiss: {
                    id: nearMiss.id,
                    referenceCode: nearMiss.referenceCode,
                    title: nearMiss.title,
                    description: nearMiss.description,
                    occurredAt: nearMiss.occurredAt.slice(0, 16),
                    locationName: nearMiss.locationName ?? '',
                    regionId: nearMiss.regionId ?? nearMiss.region?.id ?? '',
                    districtId: nearMiss.districtId ?? nearMiss.district?.id ?? '',
                    severityPotential: nearMiss.severityPotential ?? '',
                    latitude: nearMiss.latitude,
                    longitude: nearMiss.longitude,
                    bodyPartAtRisk: nearMiss.bodyPartAtRisk ?? '',
                    potentialInjuryNature: nearMiss.potentialInjuryNature ?? '',
                  },
                },
              })}
            >
              This was actually an incident
            </Button>
          )}
        </CardContent>
      </Card>

      <Card sx={CASE_FILE_CARD_SX}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, fontWeight: 700 }}>
            Corrective actions
          </Typography>
          <Stack spacing={1.25} mt={1.5}>
            {((capas.data?.items ?? []) as Array<{ id: string; referenceCode?: string; title?: string; status?: string }>).length === 0 && (
              <Typography variant="body2" color="text.secondary">No action raised from this near-miss yet.</Typography>
            )}
            {((capas.data?.items ?? []) as Array<{ id: string; referenceCode?: string; title?: string; status?: string }>).map((item) => (
              <Stack key={item.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="body2">{item.referenceCode} — {item.title} ({String(item.status ?? '').replaceAll('_', ' ')})</Typography>
                <Button component={RouterLink} to={`/capa/${item.id}`} size="small">Open the action</Button>
              </Stack>
            ))}
          </Stack>
          {canCreateCapa && !closed && (
            <Stack spacing={1.5} mt={2} component="form" onSubmit={onCapa}>
              <TextField label="Action" value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} required fullWidth size="small" />
              <TextField label="What must change" value={actionDescription} onChange={(e) => setActionDescription(e.target.value)} required multiline minRows={2} fullWidth />
              <TextField label="Due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required size="small" InputLabelProps={{ shrink: true }} />
              <Box><Button type="submit" variant="outlined" disabled={!actionTitle || !actionDescription || !dueDate}>Raise corrective action</Button></Box>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
