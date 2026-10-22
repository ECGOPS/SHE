import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, Dialog, DialogContent, FormControlLabel, Grid2 as Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { ENVIRONMENTAL_ASPECT, ENVIRONMENTAL_IMPACT, Permission, RISK_SEVERITY } from '@ecg-she/shared';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import { endpoints } from '../../api/endpoints';
import { imageSrcFromBlob, isRasterImageType } from '../../security/output';
import { ExportReportButton } from '../../components/ExportReportButton';
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

interface EnvEvent {
  id: string;
  referenceCode?: string;
  status?: string;
  type?: string;
  title?: string;
  description?: string;
  substance?: string | null;
  wasteContractor?: string | null;
  disposalSite?: string | null;
  waybillNumber?: string | null;
  attachments?: Array<{ id: string; fileName: string }> | null;
  occurredAt?: string;
  locationName?: string | null;
  estimatedQuantity?: number | null;
  quantityUnit?: string | null;
  containmentActions?: string | null;
  aspect?: string | null;
  impact?: string | null;
  severity?: string | null;
  regulatoryReportable?: boolean;
  agencyNotifiedAt?: string | null;
  agencyNotificationRef?: string | null;
  closureNotes?: string | null;
  regionId?: string | null;
  districtId?: string | null;
  region?: { id?: string; name?: string } | null;
  district?: { id?: string; name?: string } | null;
  reportedBy?: { fullName?: string } | null;
}

function errorMessage(err: unknown): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? (err as Error)?.message ?? 'Request failed';
}

const SIGNIFICANT = new Set(['MAJOR', 'CATASTROPHIC']);
const MATERIAL = new Set(['OIL_SPILL', 'WASTE_DISPOSAL', 'POLLUTION']);

export function EnvironmentalDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const permissions = useAuthStore((s) => s.session?.user.permissions ?? []);
  const canReport = permissions.includes(Permission.ENV_CREATE);
  const canClose = permissions.includes(Permission.ENV_CLOSE);
  const canCapa = permissions.includes(Permission.CAPA_CREATE);
  const record = useQuery({
    queryKey: ['environmental', id],
    queryFn: () => endpoints.envEvent(id) as Promise<EnvEvent>,
    enabled: !!id,
  });
  const capas = useQuery({
    queryKey: ['env-capa', id],
    queryFn: () => endpoints.capa({ sourceType: 'ENVIRONMENTAL_EVENT', sourceId: id, pageSize: 50 }),
    enabled: !!id && permissions.includes(Permission.CAPA_READ),
  });
  const [containment, setContainment] = useState('');
  const [aspect, setAspect] = useState('');
  const [impact, setImpact] = useState('');
  const [severity, setSeverity] = useState('');
  const [reportable, setReportable] = useState(false);
  const [notifiedAt, setNotifiedAt] = useState('');
  const [notificationRef, setNotificationRef] = useState('');
  const [actionTitle, setActionTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [noFurther, setNoFurther] = useState(false);
  const [contractor, setContractor] = useState('');
  const [disposalSite, setDisposalSite] = useState('');
  const [waybill, setWaybill] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState('');

  const event = record.data;
  if (event && seeded !== event.id + (event.aspect ?? '') + (event.severity ?? '')) {
    setSeeded(event.id + (event.aspect ?? '') + (event.severity ?? ''));
    setAspect(event.aspect ?? '');
    setImpact(event.impact ?? '');
    setSeverity(event.severity ?? '');
    setReportable(!!event.regulatoryReportable);
    setNotifiedAt(event.agencyNotifiedAt?.slice(0, 16) ?? '');
    setNotificationRef(event.agencyNotificationRef ?? '');
    setContainment(event.containmentActions ?? '');
    setContractor(event.wasteContractor ?? '');
    setDisposalSite(event.disposalSite ?? '');
    setWaybill(event.waybillNumber ?? '');
  }

  const refresh = async () => {
    setError(null);
    await qc.invalidateQueries({ queryKey: ['environmental', id] });
    await qc.invalidateQueries({ queryKey: ['environmental'] });
    await qc.invalidateQueries({ queryKey: ['env-capa', id] });
  };
  const run = (fn: () => Promise<unknown>) => fn().then(refresh).catch((err: unknown) => setError(errorMessage(err)));

  if (record.isLoading) return <CaseFileSkeleton />;
  if (!event) return <Alert severity="error">Environmental event not found</Alert>;

  const closed = event.status === 'CLOSED';
  const material = MATERIAL.has(event.type ?? '');
  const wasteReady = !!(event.wasteContractor && event.disposalSite && event.waybillNumber);
  const hasPhoto = (event.attachments?.length ?? 0) > 0;
  const significant = SIGNIFICANT.has(severity || event.severity || '');
  const actions = (capas.data?.items ?? []) as Array<{ id: string; title?: string; status?: string }>;

  const onContain = (formEvent: FormEvent) => {
    formEvent.preventDefault();
    void run(() => endpoints.containEnvEvent(id, containment));
  };
  const onAssess = (formEvent: FormEvent) => {
    formEvent.preventDefault();
    void run(() => endpoints.assessEnvEvent(id, {
      aspect,
      impact,
      severity,
      regulatoryReportable: reportable,
      agencyNotifiedAt: reportable && notifiedAt ? new Date(notifiedAt).toISOString() : undefined,
      agencyNotificationRef: reportable ? notificationRef.trim() || undefined : undefined,
    }));
  };
  const onCapa = (formEvent: FormEvent) => {
    formEvent.preventDefault();
    void run(async () => {
      await endpoints.createCapa({
        title: actionTitle.trim() || event.title,
        description: event.description,
        dueDate,
        sourceType: 'ENVIRONMENTAL_EVENT',
        sourceId: id,
        regionId: event.regionId ?? event.region?.id,
        districtId: event.districtId ?? event.district?.id,
        actionType: 'CORRECTIVE_ACTION',
        priority: significant ? 'HIGH' : 'MEDIUM',
      });
      setActionTitle('');
      setDueDate('');
    });
  };

  return (
    <Stack spacing={2.5}>
      <CaseFileHeader
        backTo="/environmental"
        backLabel="Environmental"
        reference={event.referenceCode ?? 'Environmental event'}
        title={event.title || 'Environmental event'}
        chips={[
          { label: titleCase(event.status), color: closed ? 'success' : event.status === 'CONTAINED' ? 'warning' : 'default' },
          { label: titleCase(event.type), variant: 'outlined' },
          ...(event.regulatoryReportable ? [{ label: 'Reportable', color: 'error' as const, variant: 'outlined' as const }] : []),
        ]}
        actions={<ExportReportButton filename={`${event.referenceCode ?? 'environmental'}-report.pdf`} download={() => endpoints.envReport(id)} />}
        meta={[
          { icon: <EventOutlinedIcon fontSize="small" />, label: 'Occurred', value: formatWhen(event.occurredAt) },
          { icon: <PlaceOutlinedIcon fontSize="small" />, label: 'Location', value: event.locationName || placeName(event.region, event.district) },
          { icon: <PersonOutlineRoundedIcon fontSize="small" />, label: 'Reported by', value: event.reportedBy?.fullName ?? '—' },
          { icon: <ScienceOutlinedIcon fontSize="small" />, label: 'Substance', value: titleCase(event.substance) === '—' ? 'Not named' : titleCase(event.substance) },
        ]}
      />
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      <CaseFileCard title="What happened">
        <Typography sx={{ mt: 1.5, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
          {event.description || 'No description was recorded.'}
        </Typography>
        {event.estimatedQuantity != null && (
          <Typography variant="body2" color="text.secondary" mt={2}>
            Quantity: {event.estimatedQuantity} {event.quantityUnit ?? ''}
          </Typography>
        )}
      </CaseFileCard>

      <Card sx={CASE_FILE_CARD_SX}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, fontWeight: 700 }}>Containment</Typography>
          {closed ? (
            <Typography variant="body2" mt={1}>{event.containmentActions || 'Not recorded'}</Typography>
          ) : canReport && (
            <Stack spacing={1} mt={1} component="form" onSubmit={onContain}>
              <TextField label="What was done to stop it" value={containment} onChange={(e) => setContainment(e.target.value)} required fullWidth multiline minRows={2} />
              <Button type="submit" variant="outlined" sx={{ alignSelf: 'flex-start' }}>Save containment</Button>
            </Stack>
          )}
        </CardContent>
      </Card>

      {material && (
        <Card sx={CASE_FILE_CARD_SX}>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, fontWeight: 700 }}>Waste leaving the site</Typography>
            <Typography variant="body2" color="text.secondary">The event stays open until the contaminated material has a contractor, a disposal site, and a waybill.</Typography>
            {closed ? (
              <Typography variant="body2" mt={1}>{event.wasteContractor} · {event.disposalSite} · {event.waybillNumber}</Typography>
            ) : canReport && (
              <Stack spacing={1} mt={1} component="form" onSubmit={(formEvent) => {
                formEvent.preventDefault();
                void run(() => endpoints.recordEnvWaste(id, { wasteContractor: contractor, disposalSite, waybillNumber: waybill }));
              }}>
                <TextField label="Waste contractor" value={contractor} onChange={(e) => setContractor(e.target.value)} required fullWidth />
                <TextField label="Disposal site" value={disposalSite} onChange={(e) => setDisposalSite(e.target.value)} required fullWidth />
                <TextField label="Waybill number" value={waybill} onChange={(e) => setWaybill(e.target.value)} required fullWidth />
                <Button type="submit" variant="outlined" sx={{ alignSelf: 'flex-start' }}>Save the consignment</Button>
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      <Photos eventId={event.id} photos={event.attachments ?? []} canAdd={!closed && canReport} onAdded={refresh} />

      <Card sx={CASE_FILE_CARD_SX}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, fontWeight: 700 }}>Impact</Typography>
          <Typography variant="body2" color="text.secondary">The aspect is what was released. The impact is the harm. A major or catastrophic release needs a corrective action.</Typography>
          {!closed && canClose ? (
            <Stack spacing={1} mt={2} component="form" onSubmit={onAssess}>
              <TextField select label="Aspect" value={aspect} onChange={(e) => setAspect(e.target.value)} required fullWidth>
                {ENVIRONMENTAL_ASPECT.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}
              </TextField>
              <TextField select label="Impact" value={impact} onChange={(e) => setImpact(e.target.value)} required fullWidth>
                {ENVIRONMENTAL_IMPACT.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}
              </TextField>
              <TextField select label="Severity" value={severity} onChange={(e) => setSeverity(e.target.value)} required fullWidth>
                {RISK_SEVERITY.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}
              </TextField>
              <FormControlLabel control={<Checkbox checked={reportable} onChange={(e) => setReportable(e.target.checked)} />} label="Reportable to the regulator" />
              {reportable && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField label="Notified at" type="datetime-local" value={notifiedAt} onChange={(e) => setNotifiedAt(e.target.value)} required slotProps={{ inputLabel: { shrink: true } }} fullWidth />
                  <TextField label="Notification reference" value={notificationRef} onChange={(e) => setNotificationRef(e.target.value)} required fullWidth />
                </Stack>
              )}
              <Button type="submit" variant="outlined" sx={{ alignSelf: 'flex-start' }}>Save the assessment</Button>
            </Stack>
          ) : (
            <Stack mt={1}>
              <Typography variant="body2">Aspect: {event.aspect?.replaceAll('_', ' ') || 'Not recorded'}</Typography>
              <Typography variant="body2">Impact: {event.impact?.replaceAll('_', ' ') || 'Not recorded'}</Typography>
              <Typography variant="body2">Severity: {event.severity?.replaceAll('_', ' ') || 'Not recorded'}</Typography>
              <Typography variant="body2">Reportable: {event.regulatoryReportable ? 'Yes' : 'No'}</Typography>
              {event.agencyNotificationRef && <Typography variant="body2">Regulator reference: {event.agencyNotificationRef}</Typography>}
            </Stack>
          )}
        </CardContent>
      </Card>

      {(significant || actions.length > 0) && (
        <Card sx={CASE_FILE_CARD_SX}>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, fontWeight: 700 }}>Corrective action</Typography>
            {actions.map((action) => (
              <Stack key={String(action.id)} direction="row" spacing={1} alignItems="center" mt={1}>
                <Typography variant="body2">{String(action.title ?? 'Action')} — {String(action.status ?? '').replaceAll('_', ' ')}</Typography>
                <Button component={RouterLink} to={`/capa/${action.id}`} size="small">Open the action</Button>
              </Stack>
            ))}
            {!closed && canCapa && (
              <Stack spacing={1} mt={2} component="form" onSubmit={onCapa}>
                <TextField label="Action" value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} required fullWidth />
                <TextField label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required slotProps={{ inputLabel: { shrink: true } }} sx={{ maxWidth: 240 }} />
                <Button type="submit" variant="contained" sx={{ alignSelf: 'flex-start' }}>Raise corrective action</Button>
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      {!closed && canClose && (
        <Stack spacing={1}>
          {significant && (
            <FormControlLabel control={<Checkbox checked={noFurther} onChange={(e) => setNoFurther(e.target.checked)} />} label="No further action is required" />
          )}
          <TextField label="Closing note" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth />
          <Button
            variant="contained"
            sx={{ alignSelf: 'flex-start' }}
            disabled={material && (!wasteReady || !hasPhoto)}
            onClick={() => void run(() => endpoints.closeEnvEvent(id, notes, noFurther))}
          >
            Close the event
          </Button>
          {material && (!wasteReady || !hasPhoto) && (
            <Typography variant="caption" color="text.secondary">Add the waybill and a photo of the site before closing.</Typography>
          )}
        </Stack>
      )}
      {closed && canClose && (
        <Button variant="outlined" onClick={() => void run(() => endpoints.reopenEnvEvent(id))}>Reopen</Button>
      )}
      {event.closureNotes && <Typography variant="body2">Closing note: {event.closureNotes}</Typography>}
    </Stack>
  );
}

function Photos({
  eventId,
  photos,
  canAdd,
  onAdded,
}: {
  eventId: string;
  photos: Array<{ id: string; fileName: string }>;
  canAdd: boolean;
  onAdded: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    if (photos.length + files.length > 4) {
      setError('You can attach up to 4 photos.');
      return;
    }
    try {
      const next = await Promise.all(Array.from(files).map(async (file) => {
        if (!isRasterImageType(file.type)) throw new Error(`${file.name} must be a JPEG, PNG, WEBP, or GIF.`);
        if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} is larger than 5 MB.`);
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
          reader.readAsDataURL(file);
        });
        return { fileName: file.name, mimeType: file.type, dataUrl };
      }));
      await endpoints.addEnvPhotos(eventId, next);
      setError(null);
      await onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the photo');
    }
  };
  return (
    <Card sx={CASE_FILE_CARD_SX}>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, fontWeight: 700 }}>Photos</Typography>
        <Typography variant="body2" color="text.secondary">Photograph the release and the ground after it is cleaned.</Typography>
        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        <Grid container spacing={2} mt={0.5}>
          {photos.map((photo) => (
            <Grid key={photo.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <PhotoThumb eventId={eventId} photo={photo} />
            </Grid>
          ))}
        </Grid>
        {canAdd && (
          <Button variant="outlined" component="label" sx={{ mt: 2 }}>
            Add a photo
            <input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function PhotoThumb({ eventId, photo }: { eventId: string; photo: { id: string; fileName: string } }) {
  const { data: blob } = useQuery({
    queryKey: ['env-photo', eventId, photo.id],
    queryFn: async () => (await endpoints.envAttachmentFile(eventId, photo.id)).data as Blob,
  });
  const [open, setOpen] = useState(false);
  const src = useMemo(() => imageSrcFromBlob(blob), [blob]);
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);
  return (
    <>
      <Box component="button" type="button" aria-label={`View ${photo.fileName} full size`} disabled={!src} onClick={() => setOpen(true)} sx={{ display: 'block', width: '100%', p: 0, border: 0, borderRadius: 2, overflow: 'hidden', bgcolor: 'action.hover', aspectRatio: '4 / 3', cursor: src ? 'zoom-in' : 'default' }}>
        {src && <Box component="img" src={src} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      </Box>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth={false}>
        <DialogContent sx={{ p: 0, bgcolor: 'common.black', position: 'relative', lineHeight: 0 }}>
          <Button onClick={() => setOpen(false)} sx={{ position: 'absolute', top: 8, right: 8, color: 'common.white', bgcolor: 'rgba(0,0,0,0.45)' }}>Close</Button>
          {src && <Box component="img" src={src} alt={photo.fileName} sx={{ display: 'block', maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain' }} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
