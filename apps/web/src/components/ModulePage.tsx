import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams, GridValidRowModel } from '@mui/x-data-grid';
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { isDistrictScope, isRegionalScope, isSafetyOfficer, reportsInChosenPlace } from '@ecg-she/shared';
import { useAuthStore } from '../stores/auth.store';
import { endpoints } from '../api/endpoints';
import { offlineQueue } from '../offline/queue';
import { MobilePageBar, PageQuery, RecordSearch, useServerPage } from './server-page';
import { isRasterImageType, safeImageSrc } from '../security/output';

export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'number'
  | 'date'
  | 'datetime'
  | 'boolean'
  /** Comma- or newline-separated values, submitted as a string[] array. */
  | 'tags'
  /** Read-only informational banner — used to cite the relevant standard. */
  | 'info';

export interface FormField {
  name: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  options?: { value: string; label: string }[] | readonly string[];
  helperText?: string;
  defaultValue?: unknown;
  /** Computed default value (e.g. region-from-user). Wins over `defaultValue`. */
  computeDefault?: (user: ReturnType<typeof useAuthStore.getState>['session']) => unknown;
}

export interface ModulePageConfig<TRow extends GridValidRowModel = GridValidRowModel> {
  /** Page title shown at the top. */
  title: string;
  /** Subtitle / module description. */
  subtitle: string;
  /** Cache key for react-query. */
  queryKey: string;
  /** List loader. The page asks for one page at a time. */
  list: (query: PageQuery) => Promise<TRow[] | { items: TRow[]; total?: number }>;
  /** Create handler. */
  create: (body: Record<string, unknown>) => Promise<unknown>;
  /** DataGrid columns. */
  columns: GridColDef[];
  /** Form fields rendered in the create dialog. */
  formFields: FormField[];
  /** Submit-button label. */
  ctaLabel?: string;
  /** Optional row-click navigation path builder. */
  rowHref?: (row: TRow) => string | undefined;
  /** Permission required to create (only used to show the button). */
  permission?: string;
  /** Open this path instead of the create dialog. */
  createPath?: string;
  /** When set, a failed connection stores the report on this device and sends it later. */
  offlineKind?: 'near-miss' | 'hazard' | 'jsa' | 'inspection' | 'capa-progress';
  /** Attach up to 4 photos on the create form. */
  allowPhotos?: boolean;
  /** Show a button that fills latitude and longitude from this device. */
  allowLocation?: boolean;
  /** Open this path after a report is saved on the server. */
  createdPath?: (created: { id?: string }) => string | undefined;
}

/**
 * Shared list + create-dialog skeleton used by every "simple" SHE module.
 *
 * - Wires react-query for list fetch and create-mutation.
 * - Renders a MUI DataGrid with the provided columns.
 * - Renders a typed form dialog from `formFields`.
 * - Shows scoped feedback (success / error) and refreshes the table after
 *   create.
 */
export function ModulePage<TRow extends GridValidRowModel = GridValidRowModel>({
  title,
  subtitle,
  queryKey,
  list,
  create,
  columns,
  formFields,
  ctaLabel = 'New record',
  rowHref,
  permission,
  createPath,
  offlineKind,
  allowPhotos,
  allowLocation,
  createdPath,
}: ModulePageConfig<TRow>) {
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);
  const can = !permission || (session?.user.permissions ?? []).includes(permission);
  const qc = useQueryClient();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('lg'));
  const fullScreenForm = useMediaQuery(theme.breakpoints.down('sm'));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);
  const [photos, setPhotos] = useState<Array<{ fileName: string; mimeType: string; dataUrl: string }>>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const paging = useServerPage();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: [queryKey, paging.query],
    queryFn: () => list(paging.query),
    placeholderData: keepPreviousData,
  });

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

  const rows = useMemo<TRow[]>(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data as TRow[];
    if ('items' in (data as { items?: TRow[] })) return (data as { items: TRow[] }).items ?? [];
    return [];
  }, [data]);
  const total = !data ? 0 : Array.isArray(data) ? data.length : Number((data as { total?: number }).total ?? rows.length);

  const defaults = useMemo<Record<string, unknown>>(() => {
    const out: Record<string, unknown> = {};
    for (const f of renderedFormFields) {
      out[f.name] = f.computeDefault ? f.computeDefault(session) : (f.defaultValue ?? '');
    }
    return out;
  }, [renderedFormFields, session]);

  const { register, handleSubmit, reset, formState, watch, setValue } = useForm<Record<string, unknown>>({
    defaultValues: defaults,
  });

  const selectedRegionId = String(watch('regionId') ?? '');
  const selectedDistrictId = String(watch('districtId') ?? '');
  const role = session?.user.role;
  const lockedToRegion = !!role && isSafetyOfficer(role) && (isRegionalScope(role) || isDistrictScope(role));
  const lockedToDistrict = !!role && isSafetyOfficer(role) && isDistrictScope(role);
  const choosesPlace = !!role && reportsInChosenPlace(role);
  const { data: regions = [] } = useQuery({
    queryKey: ['regions'],
    queryFn: () => endpoints.regions(),
    enabled: renderedFormFields.some((f) => f.name === 'regionId' && f.type === 'select'),
  });
  const { data: districts = [] } = useQuery({
    queryKey: ['districts', selectedRegionId],
    queryFn: () => endpoints.districts(selectedRegionId),
    enabled: renderedFormFields.some((f) => f.name === 'districtId') && !!selectedRegionId,
  });

  useEffect(() => {
    if (!selectedDistrictId || districts.length === 0) return;
    if (!districts.some((d) => d.id === selectedDistrictId)) {
      setValue('districtId', '');
    }
  }, [districts, selectedDistrictId, setValue]);

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
    onSuccess: (created) => {
      const queued = (created as { offline?: boolean })?.offline === true;
      setFeedback({
        kind: 'success',
        msg: queued
          ? 'Saved on this device. It will send when you are back online.'
          : `${title} record created.`,
      });
      void qc.invalidateQueries({ queryKey: [queryKey] });
      setDialogOpen(false);
      setPhotos([]);
      reset(defaults);
      const id = (created as { id?: string })?.id;
      const path = !queued && id ? createdPath?.({ id }) : undefined;
      if (path) navigate(path);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        'Request failed';
      setFeedback({ kind: 'error', msg });
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

  const closeForm = () => {
    setDialogOpen(false);
    setCameraOpen(false);
  };

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

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
        </Box>
        {can && (
          <Button
            variant="contained"
            startIcon={<AddCircleRoundedIcon />}
            onClick={() => {
              if (createPath) {
                navigate(createPath);
                return;
              }
              reset(defaults);
              setPhotos([]);
              setPhotoError(null);
              setCameraError(null);
              setDialogOpen(true);
            }}
          >
            {ctaLabel}
          </Button>
        )}
      </Stack>

      <RecordSearch value={paging.searchInput} onChange={paging.setSearchInput} />

      {feedback && (
        <Alert severity={feedback.kind} onClose={() => setFeedback(null)}>
          {feedback.msg}
        </Alert>
      )}

      {error && (
        <Alert severity="error">
          Failed to load records: {(error as Error).message}
        </Alert>
      )}

      {compact ? (
        <Stack spacing={1}>
          <ResponsiveRecordCards
            rows={rows}
            columns={columns}
            loading={isLoading}
            rowHref={rowHref}
            onOpen={navigate}
          />
          <MobilePageBar page={paging.page} pageSize={paging.pageSize} total={total} onPage={paging.setPage} />
        </Stack>
      ) : (
        <Card sx={{ p: 0, overflow: 'hidden' }}>
          <Box sx={{ width: '100%', overflowX: 'auto' }}>
            <DataGrid
              rows={rows}
              columns={columns}
              loading={isLoading}
              getRowId={(r) => (r as { id: string }).id}
              autoHeight
              disableRowSelectionOnClick
              paginationMode="server"
              rowCount={total}
              paginationModel={{ page: paging.page, pageSize: paging.pageSize }}
              onPaginationModelChange={paging.onPaginationModelChange}
              onRowClick={(p) => {
                const href = rowHref?.(p.row as TRow);
                if (href) navigate(href);
              }}
              pageSizeOptions={[10, 25, 50, 100]}
              sx={{
                border: 'none',
                minHeight: 360,
                minWidth: 960,
                '& .MuiDataGrid-row': rowHref ? { cursor: 'pointer' } : undefined,
              }}
            />
          </Box>
        </Card>
      )}

      <Dialog open={dialogOpen} onClose={closeForm} maxWidth="sm" fullWidth fullScreen={fullScreenForm}>
        <DialogTitle>{ctaLabel}</DialogTitle>
        <Box component="form" onSubmit={submit}>
          <DialogContent dividers>
            <Stack spacing={2}>
              {renderedFormFields.map((f) => {
                if (f.type === 'info') {
                  return (
                    <Alert
                      key={f.name}
                      severity="info"
                      icon={false}
                      sx={{ '& .MuiAlert-message': { width: '100%' } }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.6 }}>
                        {f.label}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {f.helperText}
                      </Typography>
                    </Alert>
                  );
                }
                if (f.type === 'tags') {
                  return (
                    <TextField
                      key={f.name}
                      label={f.label}
                      fullWidth
                      multiline
                      minRows={2}
                      required={f.required}
                      helperText={
                        f.helperText ?? 'Enter one item per line, or separate with commas.'
                      }
                      defaultValue={defaults[f.name] ?? ''}
                      {...register(f.name, { required: f.required })}
                    />
                  );
                }
                if (f.type === 'boolean') {
                  return (
                    <TextField
                      key={f.name}
                      select
                      label={f.label}
                      fullWidth
                      required={f.required}
                      helperText={f.helperText}
                      defaultValue={String(defaults[f.name] ?? 'false')}
                      {...register(f.name, { required: f.required })}
                    >
                      <MenuItem value="false">No</MenuItem>
                      <MenuItem value="true">Yes</MenuItem>
                    </TextField>
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
                    <TextField
                      key={f.name}
                      select
                      label={f.label}
                      fullWidth
                      required={f.required || (choosesPlace && (f.name === 'regionId' || f.name === 'districtId'))}
                      helperText={
                        f.name === 'districtId' && !selectedRegionId
                          ? 'Select a region first.'
                          : choosesPlace && (f.name === 'regionId' || f.name === 'districtId')
                            ? 'Choose where this happened. The safety officer for that district receives it.'
                          : f.name === 'regionId' && lockedToRegion
                            ? 'Locked to your assigned region.'
                            : f.name === 'districtId' && lockedToDistrict
                              ? 'Locked to your assigned district.'
                          : f.helperText
                      }
                      defaultValue={defaults[f.name] ?? ''}
                      disabled={
                        (f.name === 'regionId' && lockedToRegion) ||
                        (f.name === 'districtId' && (lockedToDistrict || !selectedRegionId))
                      }
                      {...register(f.name, {
                        required: f.required || (choosesPlace && (f.name === 'regionId' || f.name === 'districtId')),
                      })}
                    >
                      <MenuItem value="">— select —</MenuItem>
                      {opts.map((o) => (
                        <MenuItem key={o.value} value={o.value}>
                          {o.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  );
                }
                if (allowLocation && (f.name === 'latitude' || f.name === 'longitude')) {
                  const firstCoordinate = renderedFormFields.find(
                    (field) => field.name === 'latitude' || field.name === 'longitude',
                  );
                  if (firstCoordinate?.name !== f.name) return null;
                  return (
                    <Stack key="location-capture" spacing={1}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <TextField
                          label="Latitude"
                          fullWidth
                          placeholder="Not captured"
                          InputLabelProps={{ shrink: true }}
                          inputProps={{ inputMode: 'decimal', title: '' }}
                          {...register('latitude')}
                        />
                        <TextField
                          label="Longitude"
                          fullWidth
                          placeholder="Not captured"
                          InputLabelProps={{ shrink: true }}
                          inputProps={{ inputMode: 'decimal', title: '' }}
                          {...register('longitude')}
                        />
                      </Stack>
                      <Button
                        variant="outlined"
                        onClick={captureLocation}
                        disabled={locationLoading}
                        sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
                      >
                        {locationLoading ? 'Capturing location...' : 'Capture location'}
                      </Button>
                      <Typography variant="caption" color="text.secondary">
                        Fills the two coordinates from this phone or computer.
                      </Typography>
                      {locationError && <Alert severity="error">{locationError}</Alert>}
                    </Stack>
                  );
                }
                return (
                  <TextField
                    key={f.name}
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
                    InputLabelProps={
                      f.type === 'date' || f.type === 'datetime' ? { shrink: true } : undefined
                    }
                    inputProps={f.type === 'number' ? { step: 'any' } : undefined}
                    {...register(f.name, { required: f.required })}
                  />
                );
              })}
              {allowPhotos && (
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
                    <Stack spacing={1}>
                      {photos.map((p, idx) => {
                        const src = safeImageSrc(p.dataUrl);
                        return (
                        <Stack key={`${p.fileName}-${idx}`} direction="row" spacing={1} alignItems="center">
                          {src && <Box
                            component="img"
                            src={src}
                            alt={p.fileName}
                            sx={{
                              width: 72,
                              height: 54,
                              objectFit: 'cover',
                              borderRadius: 1,
                              border: 1,
                              borderColor: 'divider',
                            }}
                          />}
                          <Typography variant="body2" noWrap title={p.fileName} sx={{ flex: 1, minWidth: 0 }}>
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
                        );
                      })}
                    </Stack>
                  )}
                </Stack>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeForm} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={mutation.isPending || !formState.isValid}>
              {mutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={cameraOpen} onClose={() => setCameraOpen(false)} fullWidth maxWidth="sm" fullScreen={fullScreenForm}>
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

function dataUrlSizeBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.ceil((base64.length * 3) / 4);
}

export function statusChip(value: unknown, palette?: Record<string, string>) {
  const v = String(value ?? '');
  const color = palette?.[v] as never;
  return <Chip size="small" label={v.replaceAll('_', ' ')} color={(color as undefined) ?? 'default'} />;
}

function ResponsiveRecordCards<TRow extends GridValidRowModel>({
  rows,
  columns,
  loading,
  rowHref,
  onOpen,
}: {
  rows: TRow[];
  columns: GridColDef[];
  loading: boolean;
  rowHref?: (row: TRow) => string | undefined;
  onOpen: (href: string) => void;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary">Loading records...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary">No records found.</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={1.5}>
      {rows.map((row) => {
        const record = row as Record<string, unknown>;
        const href = rowHref?.(row);
        const reference = String(record.referenceCode ?? record.code ?? '').trim();
        const fallbackTitle = reference || String(record.id ?? 'Record');
        const title = String(record.title ?? record.name ?? fallbackTitle).trim();
        const detailColumns = columns
          .filter((c) => !['referenceCode', 'title', 'name', ...BADGE_FIELDS].includes(c.field))
          .slice(0, 6);

        return (
          <Card
            key={String(record.id ?? reference ?? title)}
            role={href ? 'button' : undefined}
            tabIndex={href ? 0 : undefined}
            onClick={() => {
              if (href) onOpen(href);
            }}
            onKeyDown={(e) => {
              if (href && (e.key === 'Enter' || e.key === ' ')) {
                onOpen(href);
              }
            }}
            sx={{
              cursor: href ? 'pointer' : 'default',
              '&:hover': href ? { boxShadow: 3 } : undefined,
            }}
          >
            <CardContent>
              <Stack spacing={1.25}>
                <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
                  <Box sx={{ minWidth: 0 }}>
                    {reference && (
                      <Typography variant="subtitle2" color="primary" fontWeight={700}>
                        {reference}
                      </Typography>
                    )}
                    <Typography variant="subtitle1" fontWeight={700} sx={{ wordBreak: 'break-word' }}>
                      {title}
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {BADGE_FIELDS.map((field) => (
                    <RecordBadge key={field} field={field} record={record} columns={columns} />
                  ))}
                </Stack>

                <Stack spacing={0.5}>
                  {detailColumns.map((col) => {
                    const value = formatCardValue(record, col);
                    if (!value) return null;
                    return (
                      <Typography key={col.field} variant="body2" color="text.secondary">
                        <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                          {col.headerName ?? col.field}:
                        </Box>{' '}
                        {value}
                      </Typography>
                    );
                  })}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}

const BADGE_FIELDS = ['status', 'category', 'severity', 'severityPotential', 'riskClass', 'currentScope'];

function RecordBadge({
  field,
  record,
  columns,
}: {
  field: string;
  record: Record<string, unknown>;
  columns: GridColDef[];
}) {
  const value = record[field];
  const hasValue = value != null && value !== '';
  if (!hasValue && !(field === 'currentScope' && record.resolvedAt)) return null;

  const col = columns.find((c) => c.field === field);
  if (col?.renderCell) {
    return (
      <>
        {col.renderCell({
          value,
          row: record,
          field,
          id: String(record.id ?? ''),
        } as GridRenderCellParams)}
      </>
    );
  }

  if (!hasValue) return null;
  return <Chip size="small" label={String(value).replaceAll('_', ' ')} />;
}

function formatCardValue(record: Record<string, unknown>, col: GridColDef): string {
  if (col.field === 'region') {
    const region = record.region as { name?: string } | undefined;
    const district = record.district as { name?: string } | undefined;
    return `${region?.name ?? ''}${district?.name ? ` / ${district.name}` : ''}`.trim();
  }

  const raw = record[col.field];
  if (typeof col.valueGetter === 'function') {
    try {
      const got = (col.valueGetter as (value: unknown, row: unknown) => unknown)(raw, record);
      if (got == null || got === '') return '';
      if (typeof got !== 'object') return String(got).replaceAll('_', ' ');
    } catch {
      // A getter that needs the grid API falls through to the raw value.
    }
  }
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object') {
    const named = raw as { fullName?: string; name?: string };
    return String(named.fullName ?? named.name ?? '').replaceAll('_', ' ');
  }

  if (col.type === 'boolean') return raw ? 'Yes' : 'No';
  if (col.field.toLowerCase().includes('date') || col.field.toLowerCase().endsWith('at')) {
    const date = new Date(String(raw));
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }

  return String(raw).replaceAll('_', ' ');
}

export function dateCol(field: string, headerName: string, width = 180): GridColDef {
  return {
    field,
    headerName,
    width,
    valueFormatter: (v) => (v ? new Date(v as string).toLocaleString() : ''),
  };
}

export function regionCol(width = 220): GridColDef {
  return {
    field: 'region',
    headerName: 'Region / District',
    width,
    valueGetter: (_v, row) =>
      `${(row as { region?: { name?: string } }).region?.name ?? ''}${
        (row as { district?: { name?: string } }).district?.name
          ? ` / ${(row as { district: { name: string } }).district.name}`
          : ''
      }`,
  };
}
