import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid2 as Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isDistrictScope, isRegionalScope, isSafetyOfficer, reportsInChosenPlace } from '@ecg-she/shared';
import { useAuthStore } from '../stores/auth.store';
import { endpoints } from '../api/endpoints';
import { offlineQueue } from '../offline/queue';
import { useFormDraft } from '../offline/useFormDraft';
import { useOnline } from '../offline/useOnline';
import { FormDraftBanner } from './FormDraftBanner';
import { FormField } from './ModulePage';
import { TITLE_MAX } from './grid-helpers';
import { isRasterImageType, safeImageSrc } from '../security/output';

export interface ModuleCreatePageProps {
  title: string;
  subtitle: string;
  queryKey: string;
  create: (body: Record<string, unknown>) => Promise<unknown>;
  formFields: FormField[];
  ctaLabel: string;
  cancelPath: string;
  offlineKind?: 'near-miss' | 'hazard' | 'jsa' | 'risk-assessment' | 'inspection' | 'capa-progress';
  allowPhotos?: boolean;
  allowLocation?: boolean;
  createdPath?: (created: { id?: string }) => string | undefined;
  /** Wording for draft banner and success messages (e.g. "hazard report"). */
  successNoun?: string;
}

function dataUrlSizeBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.ceil((base64.length * 3) / 4);
}

/** Match Incident / JSA create pages: pair short fields, keep long text full width. */
function fieldGridSize(field: FormField): { xs: number; sm?: number; md?: number } {
  if (field.type === 'info' || field.type === 'textarea' || field.type === 'tags') return { xs: 12 };
  if (
    field.name === 'title' ||
    field.name === 'description' ||
    field.name === 'locationName' ||
    field.name === 'immediateAction'
  ) {
    return { xs: 12 };
  }
  if (
    field.name === 'regionId' ||
    field.name === 'districtId' ||
    field.type === 'datetime' ||
    field.type === 'date' ||
    field.name === 'occurredAt'
  ) {
    return { xs: 12, md: 4 };
  }
  if (field.type === 'select' || field.type === 'boolean' || field.type === 'number') {
    return { xs: 12, md: 6 };
  }
  return { xs: 12 };
}

export function ModuleCreatePage({
  title,
  subtitle,
  queryKey,
  create,
  formFields,
  ctaLabel,
  cancelPath,
  offlineKind,
  allowPhotos,
  allowLocation,
  createdPath,
  successNoun,
}: ModuleCreatePageProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const online = useOnline();
  const theme = useTheme();
  const fullScreenCamera = useMediaQuery(theme.breakpoints.down('sm'));
  const [photos, setPhotos] = useState<Array<{ fileName: string; mimeType: string; dataUrl: string }>>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const noun = successNoun ?? title.toLowerCase();

  const renderedFormFields = useMemo<FormField[]>(() => {
    const hasRegion = formFields.some((f) => f.name === 'regionId');
    const hasDistrict = formFields.some((f) => f.name === 'districtId');
    if (!hasRegion || hasDistrict) return formFields;

    const out: FormField[] = [];
    for (const field of formFields) {
      out.push(field);
      if (field.name === 'regionId') {
        out.push({
          name: 'districtId',
          label: 'District',
          type: 'select',
          helperText: 'Filtered by the selected region.',
          computeDefault: (s) => s?.user.districtId ?? '',
        });
      }
    }
    return out;
  }, [formFields]);

  const defaults = useMemo<Record<string, unknown>>(() => {
    const out: Record<string, unknown> = {};
    for (const f of renderedFormFields) {
      out[f.name] = f.computeDefault ? f.computeDefault(session) : (f.defaultValue ?? '');
    }
    return out;
  }, [renderedFormFields, session]);

  const { control, register, handleSubmit, reset, formState, watch, setValue } = useForm<Record<string, unknown>>({
    shouldUnregister: false,
    defaultValues: defaults,
  });

  const formValues = watch();
  const selectedRegionId = String(formValues.regionId ?? '');
  const selectedDistrictId = String(formValues.districtId ?? '');

  const { hasDraft, restoredAt, savedAt, discard, clear } = useFormDraft({
    formKey: `${queryKey}-new`,
    userId: session?.user.id,
    value: { form: formValues, photos },
    restore: (data) => {
      if (data.form) {
        const next = { ...defaults, ...data.form };
        reset(next, { keepDefaultValues: true });
        for (const [name, value] of Object.entries(next)) {
          setValue(name, value, { shouldDirty: true });
        }
      }
      if (Array.isArray(data.photos)) setPhotos(data.photos);
    },
  });

  const role = session?.user.role;
  const lockedToRegion = !!role && isSafetyOfficer(role) && (isRegionalScope(role) || isDistrictScope(role));
  const lockedToDistrict = !!role && isSafetyOfficer(role) && isDistrictScope(role);
  const choosesPlace = !!role && reportsInChosenPlace(role);

  const { data: regions = [] } = useQuery({
    queryKey: ['regions'],
    queryFn: () => endpoints.regions(),
    enabled: renderedFormFields.some((f) => f.name === 'regionId' && f.type === 'select'),
  });
  const districtsQuery = useQuery({
    queryKey: ['districts', selectedRegionId],
    queryFn: () => endpoints.districts(selectedRegionId),
    enabled: renderedFormFields.some((f) => f.name === 'districtId') && !!selectedRegionId,
  });
  const districts = districtsQuery.data ?? [];

  useEffect(() => {
    if (!selectedRegionId || districtsQuery.isFetching || !districtsQuery.isSuccess) return;
    const list = districtsQuery.data;
    if (!list?.length) return;
    if (selectedDistrictId && !list.some((d) => d.id === selectedDistrictId)) {
      setValue('districtId', '');
    }
  }, [districtsQuery.data, districtsQuery.isFetching, districtsQuery.isSuccess, selectedDistrictId, selectedRegionId, setValue]);

  const mutation = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const body = offlineKind ? { ...values, offlineClientId: crypto.randomUUID() } : values;
      if (!offlineKind) return create(body);
      if (!navigator.onLine) {
        await offlineQueue.enqueue({ kind: offlineKind, payload: body });
        return { offline: true as const };
      }
      try {
        return await create(body);
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (!status) {
          await offlineQueue.enqueue({ kind: offlineKind, payload: body });
          return { offline: true as const };
        }
        throw err;
      }
    },
    onSuccess: async (created) => {
      const queued = (created as { offline?: boolean })?.offline === true;
      void qc.invalidateQueries({ queryKey: [queryKey] });
      setPhotos([]);
      reset(defaults);
      await clear();
      if (queued) {
        navigate(cancelPath);
        return;
      }
      const id = (created as { id?: string })?.id;
      const path = id ? createdPath?.({ id }) : undefined;
      navigate(path ?? cancelPath);
    },
  });

  const submit = handleSubmit((values) => {
    const cleaned: Record<string, unknown> = {};
    for (const f of renderedFormFields) {
      if (f.type === 'info') continue;
      const raw = values[f.name];
      if (raw === '' || raw == null) continue;
      if (f.type === 'number') {
        cleaned[f.name] = Number(raw);
      } else if (f.type === 'boolean') {
        cleaned[f.name] = raw === true || raw === 'true';
      } else if (f.type === 'tags') {
        const parts = String(raw)
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length) cleaned[f.name] = parts;
      } else {
        cleaned[f.name] = raw;
      }
    }
    if (allowPhotos && photos.length) cleaned.photos = photos;
    mutation.mutate(cleaned);
  });

  const addPhotos = async (files: FileList | null) => {
    setPhotoError(null);
    if (!files?.length) return;
    const selected = Array.from(files);
    if (photos.length + selected.length > 4) {
      setPhotoError('You can attach up to 4 photos.');
      return;
    }
    try {
      const next = await Promise.all(
        selected.map(async (file) => {
          if (!isRasterImageType(file.type)) throw new Error(`${file.name} must be a JPEG, PNG, WEBP, or GIF.`);
          if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} is larger than 5 MB.`);
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
            reader.readAsDataURL(file);
          });
          return { fileName: file.name, mimeType: file.type, dataUrl };
        }),
      );
      setPhotos((current) => [...current, ...next]);
    } catch (err) {
      setPhotoError((err as Error).message);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
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

  const captureLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('GPS/location capture is not supported by this browser.');
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setValue('latitude', Number(position.coords.latitude.toFixed(6)), { shouldDirty: true, shouldValidate: true });
        setValue('longitude', Number(position.coords.longitude.toFixed(6)), { shouldDirty: true, shouldValidate: true });
        setLocationLoading(false);
      },
      (err) => {
        setLocationError(err.message || 'Unable to capture current location.');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  };

  const captureCameraPhoto = () => {
    setCameraError(null);
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      setCameraError('Camera is not ready yet.');
      return;
    }
    if (photos.length >= 4) {
      setCameraError('You can attach up to 4 photos.');
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
    if (dataUrlSizeBytes(dataUrl) > 5 * 1024 * 1024) {
      setCameraError('Captured photo is larger than 5 MB.');
      return;
    }

    setPhotos((current) => [
      ...current,
      {
        fileName: `camera-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`,
        mimeType: 'image/jpeg',
        dataUrl,
      },
    ]);
    setCameraOpen(false);
  };

  const submitError = mutation.isError
    ? (mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      (mutation.error as Error)?.message ??
      'Request failed'
    : null;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" fontWeight={700}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
          {choosesPlace
            ? ' Choose the region and the district where it happened. The safety officer for that district receives the report.'
            : ' Your report stays in your assigned region and district.'}
        </Typography>
      </Box>

      <FormDraftBanner
        hasDraft={hasDraft}
        restoredAt={restoredAt}
        savedAt={savedAt}
        noun={noun}
        onDiscard={() => {
          reset(defaults);
          setPhotos([]);
          void discard();
        }}
      />

      {!online && offlineKind && (
        <Alert severity="info">You are offline — this {noun} will be queued and synced automatically.</Alert>
      )}

      {submitError && <Alert severity="error">{submitError}</Alert>}

      <Card>
        <CardContent>
          <Box component="form" onSubmit={submit}>
            <Grid container spacing={2}>
              {renderedFormFields.map((f) => {
                if (f.type === 'info') {
                  return (
                    <Grid key={f.name} size={{ xs: 12 }}>
                      <Alert severity="info" icon={false} sx={{ '& .MuiAlert-message': { width: '100%' } }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.6 }}>
                          {f.label}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {f.helperText}
                        </Typography>
                      </Alert>
                    </Grid>
                  );
                }
                if (allowLocation && (f.name === 'latitude' || f.name === 'longitude')) {
                  const firstCoordinate = renderedFormFields.find(
                    (field) => field.name === 'latitude' || field.name === 'longitude',
                  );
                  if (firstCoordinate?.name !== f.name) return null;
                  return (
                    <Grid key="location-capture" size={{ xs: 12 }}>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            label="Latitude"
                            fullWidth
                            placeholder="Not captured"
                            InputLabelProps={{ shrink: true }}
                            inputProps={{ inputMode: 'decimal', title: '' }}
                            {...register('latitude')}
                            value={formValues.latitude ?? ''}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            label="Longitude"
                            fullWidth
                            placeholder="Not captured"
                            InputLabelProps={{ shrink: true }}
                            inputProps={{ inputMode: 'decimal', title: '' }}
                            {...register('longitude')}
                            value={formValues.longitude ?? ''}
                          />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                          <Stack spacing={1}>
                            <Button
                              variant="outlined"
                              onClick={captureLocation}
                              disabled={locationLoading}
                              sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
                            >
                              {locationLoading ? 'Capturing GPS...' : 'Capture latitude / longitude'}
                            </Button>
                            {locationError && <Alert severity="error">{locationError}</Alert>}
                          </Stack>
                        </Grid>
                      </Grid>
                    </Grid>
                  );
                }
                if (f.type === 'tags') {
                  return (
                    <Grid key={f.name} size={fieldGridSize(f)}>
                      <TextField
                        label={f.label}
                        fullWidth
                        multiline
                        minRows={2}
                        required={f.required}
                        helperText={f.helperText ?? 'Enter one item per line, or separate with commas.'}
                        {...register(f.name, { required: f.required })}
                        value={formValues[f.name] ?? ''}
                      />
                    </Grid>
                  );
                }
                if (f.type === 'boolean') {
                  return (
                    <Grid key={f.name} size={fieldGridSize(f)}>
                      <Controller
                        control={control}
                        name={f.name}
                        rules={{ required: f.required }}
                        render={({ field }) => (
                          <TextField
                            select
                            label={f.label}
                            fullWidth
                            required={f.required}
                            helperText={f.helperText}
                            name={field.name}
                            inputRef={field.ref}
                            onBlur={field.onBlur}
                            value={String(field.value ?? 'false')}
                            onChange={(e) => field.onChange(e.target.value === 'true')}
                          >
                            <MenuItem value="false">No</MenuItem>
                            <MenuItem value="true">Yes</MenuItem>
                          </TextField>
                        )}
                      />
                    </Grid>
                  );
                }
                if (f.type === 'select') {
                  const opts =
                    f.name === 'districtId'
                      ? districts.map((d) => ({ value: d.id, label: d.name }))
                      : f.name === 'regionId'
                        ? regions.map((r) => ({ value: r.id, label: r.name }))
                        : (f.options ?? []).map((o) =>
                            typeof o === 'string' ? { value: o, label: o.replaceAll('_', ' ') } : o,
                          );
                  return (
                    <Grid key={f.name} size={fieldGridSize(f)}>
                      <Controller
                        control={control}
                        name={f.name}
                        rules={{
                          required:
                            f.required || (choosesPlace && (f.name === 'regionId' || f.name === 'districtId')),
                        }}
                        render={({ field }) => (
                          <TextField
                            select
                            label={f.label}
                            fullWidth
                            required={
                              f.required || (choosesPlace && (f.name === 'regionId' || f.name === 'districtId'))
                            }
                            helperText={
                              f.name === 'districtId' && !selectedRegionId
                                ? 'Select a region first.'
                                : choosesPlace && f.name === 'regionId'
                                  ? 'Choose where this happened. The safety officer for that district receives it.'
                                  : choosesPlace && f.name === 'districtId'
                                    ? 'The safety officer for this district receives the report.'
                                    : f.name === 'regionId' && lockedToRegion
                                      ? 'Locked to your assigned region.'
                                      : f.name === 'districtId' && lockedToDistrict
                                        ? 'Locked to your assigned district.'
                                        : f.helperText
                            }
                            disabled={
                              (f.name === 'regionId' && lockedToRegion) ||
                              (f.name === 'districtId' && (lockedToDistrict || !selectedRegionId))
                            }
                            name={field.name}
                            inputRef={field.ref}
                            onBlur={field.onBlur}
                            value={field.value ?? ''}
                            onChange={field.onChange}
                          >
                            <MenuItem value="">— select —</MenuItem>
                            {opts.map((o) => (
                              <MenuItem key={o.value} value={o.value}>
                                {o.label}
                              </MenuItem>
                            ))}
                            {field.value && !opts.some((o) => o.value === field.value) ? (
                              <MenuItem value={String(field.value)} sx={{ display: 'none' }} />
                            ) : null}
                          </TextField>
                        )}
                      />
                    </Grid>
                  );
                }
                return (
                  <Grid key={f.name} size={fieldGridSize(f)}>
                    <TextField
                      label={f.label}
                      fullWidth
                      required={f.required}
                      helperText={f.helperText}
                      multiline={f.type === 'textarea'}
                      minRows={f.type === 'textarea' ? 3 : undefined}
                      type={
                        f.type === 'number'
                          ? 'number'
                          : f.type === 'date'
                            ? 'date'
                            : f.type === 'datetime'
                              ? 'datetime-local'
                              : 'text'
                      }
                      InputLabelProps={f.type === 'date' || f.type === 'datetime' ? { shrink: true } : undefined}
                      inputProps={
                        f.type === 'number'
                          ? { step: 'any' }
                          : (f.maxLength ?? (f.name === 'title' ? TITLE_MAX : undefined))
                            ? { maxLength: f.maxLength ?? TITLE_MAX }
                            : undefined
                      }
                      {...register(f.name, { required: f.required })}
                      value={formValues[f.name] ?? ''}
                    />
                  </Grid>
                );
              })}

              {allowPhotos && (
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
                            void addPhotos(e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </Button>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Attach up to 4 photos. Each photo must be 5 MB or smaller.
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
                                {src && (
                                  <Box
                                    component="img"
                                    src={src}
                                    alt={p.fileName}
                                    sx={{
                                      width: '100%',
                                      height: 150,
                                      objectFit: 'cover',
                                      display: 'block',
                                    }}
                                  />
                                )}
                                <Stack spacing={0.5} sx={{ p: 1 }}>
                                  <Typography variant="body2" noWrap title={p.fileName}>
                                    {p.fileName}
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
              )}
            </Grid>

            <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={2} mt={3} justifyContent="flex-end">
              <Button onClick={() => navigate(cancelPath)} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={mutation.isPending || !formState.isValid}>
                {mutation.isPending ? 'Saving…' : ctaLabel}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={cameraOpen} onClose={() => setCameraOpen(false)} fullWidth maxWidth="sm" fullScreen={fullScreenCamera}>
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
              Allow camera permission when prompted, then position the scene and take a photo.
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
