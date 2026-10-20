import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
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
  DialogContent,
  Divider,
  FormControlLabel,
  Grid2 as Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  CONTROL_HIERARCHY,
  EscalationEntityType,
  IssueScope,
  Permission,
  RISK_LIKELIHOOD,
  RISK_SEVERITY,
  ROLE_LABEL,
  Role,
} from '@ecg-she/shared';
import { endpoints, HazardDto } from '../../api/endpoints';
import { imageSrcFromBlob } from '../../security/output';
import { ExportReportButton } from '../../components/ExportReportButton';
import { EscalationPanel } from '../../components/EscalationPanel';
import { useAuthStore } from '../../stores/auth.store';

function errorMessage(err: unknown): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (err as Error)?.message ??
    'Request failed'
  );
}

const RISK_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'error',
  EXTREME: 'error',
};

export function HazardDetailPage() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['hazard', id],
    queryFn: () => endpoints.hazardOne(id!),
    enabled: !!id,
  });

  if (isLoading || !data) return <Typography>Loading...</Typography>;

  const high = data.riskClass === 'HIGH' || data.riskClass === 'EXTREME';

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
          <Typography variant="h5" fontWeight={700}>{data.referenceCode}</Typography>
          <Chip
            label={data.status.replaceAll('_', ' ')}
            color={data.status === 'CLOSED' ? 'success' : data.status === 'MITIGATED' ? 'info' : 'warning'}
          />
          <Chip
            label={(data.riskClass ?? 'Unrated').replaceAll('_', ' ')}
            color={RISK_COLOR[data.riskClass ?? ''] ?? 'default'}
            variant={data.riskClass ? 'filled' : 'outlined'}
          />
          <Chip label={data.category.replaceAll('_', ' ')} variant="outlined" />
        </Stack>
        <ExportReportButton filename={`${data.referenceCode}-report.pdf`} download={() => endpoints.hazardReport(id!)} />
      </Stack>

      <Card>
        <CardContent>
          <Typography variant="h6">{data.title}</Typography>
          <Typography color="text.secondary" mt={0.5}>
            {data.locationName || 'Location not recorded'}
            {data.peopleExposed ? ' · People are exposed now' : ''}
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Typography variant="overline" color="text.secondary">Condition</Typography>
              <Typography>{data.description}</Typography>
              {data.immediateAction && (
                <Typography mt={2}><strong>Made safe. </strong>{data.immediateAction}</Typography>
              )}
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="overline" color="text.secondary">Where</Typography>
              <Typography>{data.region?.name ?? '—'} / {data.district?.name ?? '—'}</Typography>
              <Typography variant="overline" color="text.secondary" display="block" mt={2}>Reported by</Typography>
              <Typography>{data.reportedBy?.fullName ?? '—'}</Typography>
              {data.riskScore != null && (
                <Typography variant="body2" color="text.secondary" mt={2}>
                  Score {data.riskScore}
                  {data.residualRiskScore != null ? ` · residual ${data.residualRiskScore}` : ''}
                </Typography>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Photos hazard={data} />
      <Review hazard={data} />

      <EscalationPanel
        entityType={EscalationEntityType.HAZARD}
        entityId={data.id}
        requireActionBeforeClose={!data.resolvedAt && high}
        currentScope={data.currentScope ?? IssueScope.DISTRICT}
        resolvedAt={data.resolvedAt}
        resolvedAtScope={data.resolvedAtScope}
        resolutionNotes={data.resolutionNotes}
        referenceCode={data.referenceCode}
      />
    </Stack>
  );
}

function Photos({ hazard }: { hazard: HazardDto }) {
  const photos = hazard.attachments ?? [];
  if (photos.length === 0) return null;
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight={700}>Photos</Typography>
        <Grid container spacing={2} mt={0.5}>
          {photos.map((photo) => (
            <Grid key={photo.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <PhotoThumb hazardId={hazard.id} photo={photo} />
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
}

function PhotoThumb({
  hazardId,
  photo,
}: {
  hazardId: string;
  photo: NonNullable<HazardDto['attachments']>[number];
}) {
  const { data: blob } = useQuery({
    queryKey: ['hazard-photo', hazardId, photo.id],
    queryFn: async () => (await endpoints.hazardAttachmentFile(hazardId, photo.id)).data as Blob,
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
          display: 'block', width: '100%', p: 0, border: 0, borderRadius: 2,
          overflow: 'hidden', bgcolor: 'action.hover', aspectRatio: '4 / 3',
          cursor: src ? 'zoom-in' : 'default',
        }}
      >
        {src && <Box component="img" src={src} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      </Box>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth={false}>
        <DialogContent sx={{ p: 0, bgcolor: 'common.black', position: 'relative', lineHeight: 0 }}>
          <Button onClick={() => setOpen(false)} sx={{ position: 'absolute', top: 8, right: 8, color: 'common.white', bgcolor: 'rgba(0,0,0,0.45)' }}>
            Close
          </Button>
          {src && (
            <Box component="img" src={src} alt={photo.fileName} sx={{ display: 'block', maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain' }} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Review({ hazard }: { hazard: HazardDto }) {
  const session = useAuthStore((s) => s.session);
  const permissions = session?.user.permissions ?? [];
  const canReview = permissions.includes(Permission.HAZARD_APPROVE);
  const canCreateCapa = permissions.includes(Permission.CAPA_CREATE);
  const closed = hazard.status === 'CLOSED' || !!hazard.resolvedAt;
  const high = hazard.riskClass === 'HIGH' || hazard.riskClass === 'EXTREME';
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [likelihood, setLikelihood] = useState(hazard.likelihood ?? '');
  const [severity, setSeverity] = useState(hazard.severity ?? '');
  const [existingControls, setExistingControls] = useState(hazard.existingControls ?? '');
  const [controlHierarchy, setControlHierarchy] = useState(hazard.controlHierarchy ?? '');
  const [controlMeasures, setControlMeasures] = useState(hazard.controlMeasures ?? '');
  const [residualLikelihood, setResidualLikelihood] = useState(hazard.residualLikelihood ?? '');
  const [residualSeverity, setResidualSeverity] = useState(hazard.residualSeverity ?? '');
  const [targetDate, setTargetDate] = useState(hazard.targetCompletionDate?.slice(0, 10) ?? '');
  const [ownerId, setOwnerId] = useState(hazard.mitigationOwnerId ?? '');
  const [notes, setNotes] = useState('');
  const [noFurtherAction, setNoFurtherAction] = useState(false);
  const [actionTitle, setActionTitle] = useState('');
  const [actionDescription, setActionDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  const assignees = useQuery({
    queryKey: ['hazard-assignees', hazard.id],
    queryFn: () => endpoints.hazardAssignees(hazard.id),
    enabled: canReview && !closed,
  });
  const capas = useQuery({
    queryKey: ['hazard-capa', hazard.id],
    queryFn: () => endpoints.capa({ sourceType: 'HAZARD', sourceId: hazard.id, pageSize: 50 }),
    enabled: permissions.includes(Permission.CAPA_READ),
  });

  const refresh = async () => {
    setError(null);
    await qc.invalidateQueries({ queryKey: ['hazard'] });
    await qc.invalidateQueries({ queryKey: ['hazards'] });
    await qc.invalidateQueries({ queryKey: ['console'] });
    await qc.invalidateQueries({ queryKey: ['hazard-capa', hazard.id] });
  };
  const run = (fn: () => Promise<unknown>) => fn().then(refresh).catch((err: unknown) => setError(errorMessage(err)));

  const onReview = (event: FormEvent) => {
    event.preventDefault();
    void run(() => endpoints.reviewHazard(hazard.id, {
      likelihood: likelihood || undefined,
      severity: severity || undefined,
      existingControls,
      controlHierarchy: controlHierarchy || null,
      controlMeasures,
      residualLikelihood: residualLikelihood || null,
      residualSeverity: residualSeverity || null,
      targetCompletionDate: targetDate || null,
      mitigationOwnerId: ownerId || null,
    }));
  };

  const onCapa = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await endpoints.createCapa({
        title: actionTitle,
        description: actionDescription,
        dueDate,
        sourceType: 'HAZARD',
        sourceId: hazard.id,
        regionId: hazard.regionId ?? hazard.region?.id,
        districtId: hazard.districtId ?? hazard.district?.id,
        actionType: 'CORRECTIVE_ACTION',
        priority: high ? 'HIGH' : 'MEDIUM',
      });
      setActionTitle('');
      setActionDescription('');
      setDueDate('');
    });
  };

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700}>Assessment</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Confirm how likely and how serious this is, record the control, then close it when the condition is gone.
          </Typography>

          {canReview && !closed && (
            <Stack spacing={2} mt={2} component="form" onSubmit={onReview}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField select label="Likelihood" size="small" value={likelihood} onChange={(e) => setLikelihood(e.target.value)} fullWidth required>
                  {RISK_LIKELIHOOD.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}
                </TextField>
                <TextField select label="Severity" size="small" value={severity} onChange={(e) => setSeverity(e.target.value)} fullWidth required>
                  {RISK_SEVERITY.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}
                </TextField>
              </Stack>
              <TextField label="Controls already in place" value={existingControls} onChange={(e) => setExistingControls(e.target.value)} multiline minRows={2} fullWidth />
              <TextField select label="Control type" size="small" value={controlHierarchy} onChange={(e) => setControlHierarchy(e.target.value)} fullWidth>
                <MenuItem value="">— select —</MenuItem>
                {CONTROL_HIERARCHY.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}
              </TextField>
              <TextField label="Control to put in place" value={controlMeasures} onChange={(e) => setControlMeasures(e.target.value)} multiline minRows={2} fullWidth />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField select label="Residual likelihood" size="small" value={residualLikelihood} onChange={(e) => setResidualLikelihood(e.target.value)} fullWidth>
                  <MenuItem value="">— select —</MenuItem>
                  {RISK_LIKELIHOOD.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}
                </TextField>
                <TextField select label="Residual severity" size="small" value={residualSeverity} onChange={(e) => setResidualSeverity(e.target.value)} fullWidth>
                  <MenuItem value="">— select —</MenuItem>
                  {RISK_SEVERITY.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}
                </TextField>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField select label="Owner" size="small" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} fullWidth>
                  <MenuItem value="">— select —</MenuItem>
                  {(assignees.data ?? []).map((person) => (
                    <MenuItem key={person.id} value={person.id}>
                      {person.fullName} · {ROLE_LABEL[person.role as Role] ?? person.role}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField label="Target date" type="date" size="small" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
              </Stack>
              <Box><Button type="submit" variant="outlined" disabled={!likelihood || !severity}>Save assessment</Button></Box>
            </Stack>
          )}

          {(closed || !canReview) && (hazard.controlMeasures || hazard.existingControls || hazard.controlHierarchy) && (
            <Stack spacing={1} mt={2}>
              {hazard.existingControls && <Typography><strong>Already in place. </strong>{hazard.existingControls}</Typography>}
              {hazard.controlHierarchy && <Typography><strong>Control type. </strong>{hazard.controlHierarchy.replaceAll('_', ' ')}</Typography>}
              {hazard.controlMeasures && <Typography><strong>Control. </strong>{hazard.controlMeasures}</Typography>}
              {hazard.mitigationOwner?.fullName && <Typography><strong>Owner. </strong>{hazard.mitigationOwner.fullName}</Typography>}
            </Stack>
          )}

          {hazard.resolutionNotes && (
            <Typography mt={2}><strong>Close-out. </strong>{hazard.resolutionNotes}</Typography>
          )}

          {canReview && !closed && (
            <Stack spacing={1} mt={2}>
              {high && (
                <>
                  <Alert severity="warning">
                    High and extreme hazards need a saved control, then either a corrective action or a decision that no further action is required. Save the assessment first.
                  </Alert>
                  <FormControlLabel
                    control={<Checkbox checked={noFurtherAction} onChange={(e) => setNoFurtherAction(e.target.checked)} />}
                    label="No further action is required"
                  />
                </>
              )}
              <TextField label="How was this controlled?" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth size="small" />
              <Box>
                <Button
                  variant="contained"
                  color="success"
                  disabled={!notes.trim()}
                  onClick={() => void run(() => endpoints.closeHazard(hazard.id, notes.trim(), noFurtherAction))}
                >
                  Close
                </Button>
              </Box>
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700}>Corrective actions</Typography>
          <Stack spacing={1} mt={1}>
            {((capas.data?.items ?? []) as Array<{ id: string; referenceCode?: string; title?: string; status?: string }>).length === 0 && (
              <Typography variant="body2" color="text.secondary">No action raised from this hazard yet.</Typography>
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
