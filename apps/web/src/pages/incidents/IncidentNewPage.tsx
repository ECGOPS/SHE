import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { v4 as uuid } from 'uuid';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid2 as Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { IncidentSeverity, IncidentType, isDistrictScope, isRegionalScope, isSafetyOfficer, reportsInChosenPlace } from '@ecg-she/shared';
import { endpoints } from '../../api/endpoints';
import { isRasterImageType, safeImageSrc } from '../../security/output';
import { offlineQueue } from '../../offline/queue';
import { useFormDraft } from '../../offline/useFormDraft';
import { FormDraftBanner } from '../../components/FormDraftBanner';
import { useAuthStore } from '../../stores/auth.store';

interface FormState {
  type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string;
  occurredAt: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  affectedPersons?: number;
  injuredPersons?: number;
  fatalities?: number;
  estimatedCost?: number;
  regionId?: string;
  districtId?: string;
  areaSecured: boolean;
  firstAidOutcome: '' | 'GIVEN' | 'NOT_REQUIRED';
  firstAidNotes?: string;
  supervisorInformed: boolean;
  supervisorName?: string;
  emergencyServicesContacted: boolean;
  emergencyServicesDetails?: string;
}

interface IncidentPhotoPayload {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  capturedLat?: number;
  capturedLng?: number;
}

export function IncidentNewPage() {
  const nav = useNavigate();
  const theme = useTheme();
  const fullScreenDialog = useMediaQuery(theme.breakpoints.down('sm'));
  const location = useLocation();
  const fromNearMiss = (location.state as { fromNearMiss?: {
    id?: string;
    referenceCode?: string;
    title?: string;
    description?: string;
    occurredAt?: string;
    locationName?: string;
    regionId?: string;
    districtId?: string;
    severityPotential?: string;
    latitude?: number | null;
    longitude?: number | null;
    bodyPartAtRisk?: string;
    potentialInjuryNature?: string;
  } } | null)?.fromNearMiss;
  const carriedSeverity = (Object.values(IncidentSeverity) as string[]).includes(String(fromNearMiss?.severityPotential ?? ''))
    ? (fromNearMiss?.severityPotential as IncidentSeverity)
    : IncidentSeverity.MINOR;
  const carriedRisk = [fromNearMiss?.bodyPartAtRisk, fromNearMiss?.potentialInjuryNature].filter(Boolean).join(' · ').replaceAll('_', ' ');
  const session = useAuthStore((s) => s.session);
  const [photos, setPhotos] = useState<IncidentPhotoPayload[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { data: regions } = useQuery({ queryKey: ['regions'], queryFn: endpoints.regions });

  const { control, register, handleSubmit, watch, formState, setValue, reset } = useForm<FormState>({
    shouldUnregister: false,
    defaultValues: {
      type: IncidentType.INJURY,
      severity: carriedSeverity,
      affectedPersons: 0,
      injuredPersons: 0,
      fatalities: 0,
      regionId: fromNearMiss?.regionId || session?.user.regionId || '',
      districtId: fromNearMiss?.districtId || session?.user.districtId || '',
      title: fromNearMiss?.title ?? '',
      description: fromNearMiss?.description
        ? carriedRisk
          ? `${fromNearMiss.description}\n\nAt risk: ${carriedRisk}`
          : fromNearMiss.description
        : '',
      occurredAt: fromNearMiss?.occurredAt || new Date().toISOString().slice(0, 16),
      locationName: fromNearMiss?.locationName ?? '',
      latitude: fromNearMiss?.latitude ?? undefined,
      longitude: fromNearMiss?.longitude ?? undefined,
      areaSecured: false,
      firstAidOutcome: '',
      firstAidNotes: '',
      supervisorInformed: false,
      supervisorName: '',
      emergencyServicesContacted: false,
      emergencyServicesDetails: '',
    },
  });

  const formValues = watch();
  const regionId = formValues.regionId;
  const emergencyServicesContacted = formValues.emergencyServicesContacted;
  const { hasDraft, restoredAt, savedAt, discard, clear } = useFormDraft({
    formKey: fromNearMiss?.id ? `incident-from:${fromNearMiss.id}` : 'incident-new',
    userId: session?.user.id,
    value: { form: formValues, photos },
    restore: (data) => {
      if (data.form) {
        reset(data.form, { keepDefaultValues: true });
        for (const [name, value] of Object.entries(data.form)) {
          setValue(name as keyof FormState, value as never, { shouldDirty: true });
        }
      }
      if (Array.isArray(data.photos)) setPhotos(data.photos);
    },
  });
  const role = session?.user.role;
  const lockedToRegion = !!role && isSafetyOfficer(role) && (isRegionalScope(role) || isDistrictScope(role));
  const lockedToDistrict = !!role && isSafetyOfficer(role) && isDistrictScope(role);
  const choosesPlace = !!role && reportsInChosenPlace(role);
  const districtsQuery = useQuery({
    queryKey: ['districts', regionId],
    queryFn: () => endpoints.districts(regionId),
    enabled: !!regionId,
  });
  const districts = districtsQuery.data;

  useEffect(() => {
    if (!regionId || districtsQuery.isFetching || !districtsQuery.isSuccess) return;
    const list = districtsQuery.data ?? [];
    if (list.length === 0) return;
    const districtId = watch('districtId');
    if (districtId && !list.some((d) => d.id === districtId)) {
      setValue('districtId', '');
    }
  }, [districtsQuery.data, districtsQuery.isFetching, districtsQuery.isSuccess, regionId, setValue, watch]);

  const mutation = useMutation({
    mutationFn: async (form: FormState) => {
      const latitudeValue = toOptionalNumber(form.latitude);
      const longitudeValue = toOptionalNumber(form.longitude);
      const payloadPhotos = photos.map((p) => ({
        ...p,
        capturedLat: latitudeValue,
        capturedLng: longitudeValue,
      }));
      const payload = {
        ...form,
        latitude: latitudeValue,
        longitude: longitudeValue,
        affectedPersons: toOptionalNumber(form.affectedPersons),
        injuredPersons: toOptionalNumber(form.injuredPersons),
        fatalities: toOptionalNumber(form.fatalities),
        estimatedCost: toOptionalNumber(form.estimatedCost),
        occurredAt: new Date(form.occurredAt).toISOString(),
        areaSecured: form.areaSecured === true,
        firstAidOutcome: form.firstAidOutcome,
        firstAidNotes: form.firstAidNotes?.trim() || undefined,
        supervisorInformed: form.supervisorInformed === true,
        supervisorName: form.supervisorName?.trim() || undefined,
        emergencyServicesContacted: form.emergencyServicesContacted === true,
        emergencyServicesDetails: form.emergencyServicesDetails?.trim() || undefined,
        offlineClientId: uuid(),
        ...(fromNearMiss?.id ? { sourceNearMissId: fromNearMiss.id } : {}),
        ...(payloadPhotos.length ? { photos: payloadPhotos } : {}),
      };
      if (!navigator.onLine) {
        await offlineQueue.enqueue({ kind: 'incident', payload });
        return { offline: true } as const;
      }
      try {
        return { offline: false, data: await endpoints.createIncident(payload) } as const;
      } catch (err) {
        await offlineQueue.enqueue({ kind: 'incident', payload });
        throw err;
      }
    },
    onSuccess: async (r) => {
      setPhotos([]);
      await clear();
      if (r?.offline) nav('/incidents', { replace: true });
      else if ('data' in r && r.data) nav(`/incidents/${r.data.id}`);
    },
  });

  const handlePhotoSelection = async (files: FileList | null) => {
    setPhotoError(null);
    if (!files?.length) return;

    const selected = Array.from(files);
    if (photos.length + selected.length > 5) {
      setPhotoError('You can attach a maximum of 5 photos to one incident report.');
      return;
    }

    try {
      const next = await Promise.all(
        selected.map(async (file) => {
          if (!isRasterImageType(file.type)) {
            throw new Error(`${file.name} must be a JPEG, PNG, WEBP, or GIF.`);
          }
          if (file.size > 5 * 1024 * 1024) {
            throw new Error(`${file.name} is larger than 5 MB.`);
          }
          return {
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            dataUrl: await readFileAsDataUrl(file),
          };
        }),
      );
      setPhotos((current) => [...current, ...next]);
    } catch (err) {
      setPhotoError((err as Error).message);
    }
  };

  useEffect(() => {
    if (!cameraOpen) return;

    let cancelled = false;
    const startCamera = async () => {
      setCameraError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera capture is not supported by this browser.');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err) {
        setCameraError((err as Error).message || 'Unable to open the camera.');
      }
    };

    void startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [cameraOpen]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const captureCameraPhoto = () => {
    setCameraError(null);
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      setCameraError('Camera is not ready yet.');
      return;
    }
    if (photos.length >= 5) {
      setCameraError('You can attach a maximum of 5 photos to one incident report.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setCameraError('Unable to capture photo from camera.');
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const sizeBytes = dataUrlSizeBytes(dataUrl);
    if (sizeBytes > 5 * 1024 * 1024) {
      setCameraError('Captured photo is larger than 5 MB.');
      return;
    }

    setPhotos((current) => [
      ...current,
      {
        fileName: `camera-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes,
        dataUrl,
      },
    ]);
    setCameraOpen(false);
  };

  const captureCurrentLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('GPS/location capture is not supported by this browser.');
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setValue('latitude', Number(position.coords.latitude.toFixed(6)), {
          shouldDirty: true,
          shouldValidate: true,
        });
        setValue('longitude', Number(position.coords.longitude.toFixed(6)), {
          shouldDirty: true,
          shouldValidate: true,
        });
        setLocationLoading(false);
      },
      (err) => {
        setLocationError(err.message || 'Unable to capture current location.');
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 30_000,
      },
    );
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" fontWeight={700}>
          Report a new incident
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Record the scene response first, then the facts. Witnesses, root-cause findings and corrective actions are added after you submit.
          {choosesPlace
            ? ' Choose the region and the district where it happened. The case starts at that district. The safety officer for that district receives the report.'
            : ' Your report stays in your assigned region and district.'}
        </Typography>
      </Box>

      <FormDraftBanner
        hasDraft={hasDraft}
        restoredAt={restoredAt}
        savedAt={savedAt}
        noun="incident report"
        onDiscard={() => {
          reset(undefined, { keepDefaultValues: true });
          setPhotos([]);
          void discard();
        }}
      />
      {!navigator.onLine && (
        <Alert severity="info">You are offline — this report will be queued and synced automatically.</Alert>
      )}
      {mutation.isError && (
        <Alert severity="error">{errorMessage(mutation.error)}</Alert>
      )}
      {fromNearMiss?.referenceCode && (
        <Alert severity="warning">
          Started from near-miss {fromNearMiss.referenceCode}. Confirm the facts, then file it as an incident. Photos already on the near miss are copied, and that report is closed so the event is counted once.
        </Alert>
      )}

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit((f) => mutation.mutate(f))}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth type="datetime-local" label="Occurred at"
                  InputLabelProps={{ shrink: true }}
                  {...register('occurredAt', { required: true })}
                  value={formValues.occurredAt ?? ''}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  control={control}
                  name="regionId"
                  rules={{ required: choosesPlace }}
                  render={({ field }) => (
                    <TextField
                      select
                      fullWidth
                      label="Region"
                      required={choosesPlace}
                      disabled={lockedToRegion}
                      helperText={
                        choosesPlace
                          ? 'Choose where this happened. The safety officer for that district receives it.'
                          : lockedToRegion
                            ? 'Locked to your assigned region.'
                            : undefined
                      }
                      {...field}
                      value={field.value ?? ''}
                    >
                      {(regions ?? []).map((r) => (
                        <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                      ))}
                      {field.value && !(regions ?? []).some((r) => r.id === field.value) ? (
                        <MenuItem value={field.value} sx={{ display: 'none' }} />
                      ) : null}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  control={control}
                  name="districtId"
                  rules={{ required: choosesPlace }}
                  render={({ field }) => (
                    <TextField
                      select
                      fullWidth
                      label="District"
                      required={choosesPlace}
                      disabled={lockedToDistrict || !regionId}
                      helperText={
                        lockedToDistrict
                          ? 'Locked to your assigned district.'
                          : !regionId
                            ? 'Select a region first.'
                            : choosesPlace
                              ? 'The safety officer for this district receives the report.'
                              : undefined
                      }
                      {...field}
                      value={field.value ?? ''}
                    >
                      {(districts ?? []).map((d) => (
                        <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                      ))}
                      {field.value && !(districts ?? []).some((d) => d.id === field.value) ? (
                        <MenuItem value={field.value} sx={{ display: 'none' }} />
                      ) : null}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  control={control}
                  name="type"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <TextField select fullWidth label="Incident type" {...field} value={field.value ?? IncidentType.INJURY}>
                      {Object.values(IncidentType).map((t) => (
                        <MenuItem key={t} value={t}>{t.replaceAll('_', ' ')}</MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  control={control}
                  name="severity"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <TextField select fullWidth label="Severity" {...field} value={field.value ?? IncidentSeverity.MINOR}>
                      {Object.values(IncidentSeverity).map((s) => (
                        <MenuItem key={s} value={s}>{s}</MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth label="Title" {...register('title', { required: true })} value={formValues.title ?? ''} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth multiline minRows={4} label="Description" {...register('description', { required: true })} value={formValues.description ?? ''} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth label="Location name" {...register('locationName')} value={formValues.locationName ?? ''} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Latitude"
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 'any', min: -90, max: 90 }}
                  {...register('latitude', { valueAsNumber: true })}
                  value={Number.isFinite(formValues.latitude) ? formValues.latitude : ''}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Longitude"
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 'any', min: -180, max: 180 }}
                  {...register('longitude', { valueAsNumber: true })}
                  value={Number.isFinite(formValues.longitude) ? formValues.longitude : ''}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Stack spacing={1}>
                  <Button
                    variant="outlined"
                    onClick={captureCurrentLocation}
                    disabled={locationLoading}
                    sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
                  >
                    {locationLoading ? 'Capturing GPS...' : 'Capture latitude / longitude'}
                  </Button>
                  {locationError && <Alert severity="error">{locationError}</Alert>}
                </Stack>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button variant="outlined" onClick={() => setCameraOpen(true)}>
                      Capture with camera
                    </Button>
                    <Button variant="outlined" component="label">
                      Upload photos
                      <input
                        hidden
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        multiple
                        onChange={(e) => {
                          void handlePhotoSelection(e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </Button>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Attach up to 5 photos. Each photo must be 5 MB or smaller.
                  </Typography>
                  {photoError && <Alert severity="error">{photoError}</Alert>}
                  {photos.length > 0 && (
                    <Grid container spacing={1.5}>
                      {photos.map((p, idx) => {
                        const src = safeImageSrc(p.dataUrl);
                        return (
                        <Grid key={`${p.fileName}-${idx}`} size={{ xs: 12, sm: 6, md: 4 }}>
                          <Box
                            sx={{
                              border: 1,
                              borderColor: 'divider',
                              borderRadius: 2,
                              overflow: 'hidden',
                              bgcolor: 'background.paper',
                            }}
                          >
                            {src && <Box
                              component="img"
                              src={src}
                              alt={p.fileName}
                              sx={{
                                width: '100%',
                                height: 150,
                                objectFit: 'cover',
                                display: 'block',
                              }}
                            />}
                            <Stack spacing={0.5} sx={{ p: 1 }}>
                              <Typography variant="body2" noWrap title={p.fileName}>
                                {p.fileName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {Math.round(p.sizeBytes / 1024)} KB
                              </Typography>
                              <Button
                                size="small"
                                color="error"
                                onClick={() => setPhotos((current) => current.filter((_, i) => i !== idx))}
                              >
                                Remove
                              </Button>
                            </Stack>
                          </Box>
                        </Grid>
                        );
                      })}
                    </Grid>
                  )}
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth type="number" label="Affected" {...register('affectedPersons', { valueAsNumber: true })} value={Number.isFinite(formValues.affectedPersons) ? formValues.affectedPersons : 0} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth type="number" label="Injured" {...register('injuredPersons', { valueAsNumber: true })} value={Number.isFinite(formValues.injuredPersons) ? formValues.injuredPersons : 0} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth type="number" label="Fatalities" {...register('fatalities', { valueAsNumber: true })} value={Number.isFinite(formValues.fatalities) ? formValues.fatalities : 0} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Immediate response
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Confirm these scene actions were done before this report is filed.
                </Typography>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Controller
                  control={control}
                  name="areaSecured"
                  rules={{ validate: (value) => value === true || 'Confirm the area was secured' }}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox checked={!!field.value} onChange={(_, checked) => field.onChange(checked)} />}
                      label="The area is secured (scene isolated, access controlled)"
                    />
                  )}
                />
                {formState.errors.areaSecured && (
                  <Typography variant="caption" color="error" display="block">
                    {formState.errors.areaSecured.message}
                  </Typography>
                )}
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  control={control}
                  name="firstAidOutcome"
                  rules={{ required: 'Record whether first aid was given' }}
                  render={({ field }) => (
                    <TextField select fullWidth required label="First aid" {...field} value={field.value ?? ''}>
                      <MenuItem value="" disabled>Select…</MenuItem>
                      <MenuItem value="GIVEN">Given</MenuItem>
                      <MenuItem value="NOT_REQUIRED">Not required</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth label="First aid notes" {...register('firstAidNotes')} value={formValues.firstAidNotes ?? ''} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Controller
                  control={control}
                  name="supervisorInformed"
                  rules={{ validate: (value) => value === true || 'Confirm the supervisor or safety officer was informed' }}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox checked={!!field.value} onChange={(_, checked) => field.onChange(checked)} />}
                      label="The supervisor or safety officer has been informed"
                    />
                  )}
                />
                {formState.errors.supervisorInformed && (
                  <Typography variant="caption" color="error" display="block">
                    {formState.errors.supervisorInformed.message}
                  </Typography>
                )}
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth label="Supervisor name" {...register('supervisorName')} value={formValues.supervisorName ?? ''} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Controller
                  control={control}
                  name="emergencyServicesContacted"
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox checked={!!field.value} onChange={(_, checked) => field.onChange(checked)} />}
                      label="Emergency services were contacted"
                    />
                  )}
                />
              </Grid>
              {emergencyServicesContacted && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    required
                    label="Which service / reference"
                    {...register('emergencyServicesDetails', {
                      validate: (value) =>
                        !emergencyServicesContacted || !!value?.trim() || 'Record which emergency service was contacted',
                    })}
                    value={formValues.emergencyServicesDetails ?? ''}
                  />
                </Grid>
              )}
            </Grid>

            <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={2} mt={3} justifyContent="flex-end">
              <Button onClick={() => nav('/incidents')}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={!formState.isValid && formState.isSubmitted}>
                Submit report
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>

      <Dialog open={cameraOpen} onClose={() => setCameraOpen(false)} fullWidth maxWidth="sm" fullScreen={fullScreenDialog}>
        <DialogTitle>Capture photo evidence</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            {cameraError && <Alert severity="error">{cameraError}</Alert>}
            <Box
              sx={{
                width: '100%',
                aspectRatio: '4 / 3',
                bgcolor: 'black',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <Box
                component="video"
                ref={videoRef}
                autoPlay
                playsInline
                muted
                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Allow camera permission when prompted, then position the hazard or incident scene and take a photo.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCameraOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={captureCameraPhoto}>
            Take photo
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read selected photo.'));
    reader.readAsDataURL(file);
  });
}

function dataUrlSizeBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.ceil((base64.length * 3) / 4);
}

function errorMessage(err: unknown): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? (err as Error)?.message ?? 'Request failed';
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === '' || value == null) return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}
