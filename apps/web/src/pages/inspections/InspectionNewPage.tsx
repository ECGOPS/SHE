import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
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
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  InspectionType,
  NFPA_70E_PPE_CATEGORY,
  Role,
  WEATHER_CONDITION,
  isDistrictScope,
  isRegionalScope,
  isSafetyOfficer,
  reportsInChosenPlace,
} from '@ecg-she/shared';
import { endpoints } from '../../api/endpoints';
import { isRasterImageType, safeImageSrc } from '../../security/output';
import { useAuthStore } from '../../stores/auth.store';
import { INSPECTION_CHECKLISTS, OUTDOOR_INSPECTIONS, PRE_USE_INSPECTIONS } from './checklists';

type Answer = '' | 'PASS' | 'FAIL' | 'NA';
interface Row {
  question: string;
  answer: Answer;
  notes: string;
  immediateAction: string;
}

function errorMessage(err: unknown): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? (err as Error)?.message ?? 'Request failed';
}

interface Photo {
  fileName: string;
  mimeType: string;
  dataUrl: string;
}

function dataUrlSizeBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.ceil((base64.length * 3) / 4);
}

function rowsFor(type: InspectionType): Row[] {
  return INSPECTION_CHECKLISTS[type].map((question) => ({ question, answer: '', notes: '', immediateAction: '' }));
}

export function InspectionNewPage() {
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);
  const role = session?.user.role;
  const staff = role === Role.STAFF || role === Role.DISTRICT_USER || role === Role.REGIONAL_USER;
  const lockedToRegion = !!role && isSafetyOfficer(role) && (isRegionalScope(role) || isDistrictScope(role));
  const lockedToDistrict = !!role && isSafetyOfficer(role) && isDistrictScope(role);
  const choosesPlace = !!role && reportsInChosenPlace(role);
  const [regionId, setRegionId] = useState(session?.user.regionId ?? '');
  const [districtId, setDistrictId] = useState(session?.user.districtId ?? '');
  const [type, setType] = useState<InspectionType>(staff ? InspectionType.VEHICLE : InspectionType.SUBSTATION);
  const [asset, setAsset] = useState('');
  const [inspectedAt, setInspectedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [weather, setWeather] = useState('');
  const [temperature, setTemperature] = useState('');
  const [boundary, setBoundary] = useState('');
  const [ppe, setPpe] = useState('');
  const [observations, setObservations] = useState('');
  const [rows, setRows] = useState<Row[]>(() => rowsFor(staff ? InspectionType.VEHICLE : InspectionType.SUBSTATION));
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const outdoor = OUTDOOR_INSPECTIONS.includes(type);
  const types = staff ? PRE_USE_INSPECTIONS : Object.values(InspectionType);
  const regions = useQuery({ queryKey: ['regions'], queryFn: endpoints.regions });
  const districts = useQuery({
    queryKey: ['districts', regionId],
    queryFn: () => endpoints.districts(regionId),
    enabled: !!regionId,
  });

  const ready = useMemo(
    () => asset.trim() && regionId && (!choosesPlace || !!districtId) && inspectedAt && rows.every((row) => row.answer) && (!outdoor || weather),
    [asset, regionId, districtId, choosesPlace, inspectedAt, rows, outdoor, weather],
  );

  const save = useMutation({
    mutationFn: () =>
      endpoints.createInspection({
        type,
        assetOrLocation: asset.trim(),
        inspectedAt: new Date(inspectedAt).toISOString(),
        regionId,
        districtId: districtId || undefined,
        weatherCondition: outdoor ? weather : undefined,
        temperatureC: outdoor && temperature ? Number(temperature) : undefined,
        arcFlashBoundaryM: outdoor && boundary ? Number(boundary) : undefined,
        nfpaPpeCategory: outdoor && ppe ? ppe : undefined,
        observations: observations.trim() || undefined,
        items: rows.map((row) => ({
          question: row.question,
          answer: row.answer,
          notes: row.notes.trim() || undefined,
          immediateAction: row.answer === 'FAIL' ? row.immediateAction.trim() || undefined : undefined,
        })),
        photos: photos.length ? photos : undefined,
      }),
    onSuccess: (record) => navigate(`/inspections/${record.id}`),
    onError: (err) => setError(errorMessage(err)),
  });

  const onType = (next: InspectionType) => {
    setType(next);
    setRows(rowsFor(next));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const undescribed = rows.find((row) => row.answer === 'FAIL' && !row.notes.trim() && !row.immediateAction.trim());
    if (undescribed) {
      setError(`Describe what failed: ${undescribed.question}`);
      return;
    }
    setError(null);
    save.mutate();
  };

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
    const start = async () => {
      setCameraError(null);
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera capture is not supported by this browser.');
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
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [cameraOpen]);

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
      { fileName: `camera-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`, mimeType: 'image/jpeg', dataUrl },
    ]);
    setCameraOpen(false);
  };

  return (
    <Stack spacing={2} component="form" onSubmit={onSubmit}>
      <Typography variant="h5" fontWeight={700}>Record an inspection</Typography>
      <Typography variant="body2" color="text.secondary">
        Walk the checklist. A fail stays open until it is corrected on the spot, or raised as a hazard or a corrective action.
      </Typography>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField select label="Region" value={regionId} onChange={(e) => { setRegionId(e.target.value); setDistrictId(''); }} fullWidth required disabled={lockedToRegion} helperText={choosesPlace ? 'Choose where this check is. The safety officer for that district receives it.' : lockedToRegion ? 'Locked to your assigned region.' : undefined}>
                {(regions.data ?? []).map((region) => <MenuItem key={region.id} value={region.id}>{region.name}</MenuItem>)}
              </TextField>
              <TextField select label="District" value={districtId} onChange={(e) => setDistrictId(e.target.value)} fullWidth required={choosesPlace} disabled={!regionId || lockedToDistrict} helperText={lockedToDistrict ? 'Locked to your assigned district.' : !regionId ? 'Select a region first.' : choosesPlace ? 'The safety officer for this district receives the check.' : undefined}>
                <MenuItem value="">{choosesPlace ? '— select —' : 'Head office of the region'}</MenuItem>
                {(districts.data ?? []).map((district) => <MenuItem key={district.id} value={district.id}>{district.name}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField select label="Type" value={type} onChange={(e) => onType(e.target.value as InspectionType)} fullWidth>
              {types.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}
            </TextField>
            <TextField label="Asset or place" value={asset} onChange={(e) => setAsset(e.target.value)} required fullWidth placeholder="Substation, vehicle number, or the PPE set" />
            <TextField label="Inspected at" type="datetime-local" value={inspectedAt} onChange={(e) => setInspectedAt(e.target.value)} required fullWidth slotProps={{ inputLabel: { shrink: true } }} />
            {outdoor && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField select label="Weather" value={weather} onChange={(e) => setWeather(e.target.value)} required fullWidth>
                  {WEATHER_CONDITION.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}
                </TextField>
                <TextField label="Temperature °C" type="number" value={temperature} onChange={(e) => setTemperature(e.target.value)} fullWidth />
                <TextField label="Arc-flash boundary (m)" type="number" value={boundary} onChange={(e) => setBoundary(e.target.value)} fullWidth />
                <TextField select label="Arc-rated clothing" value={ppe} onChange={(e) => setPpe(e.target.value)} fullWidth>
                  <MenuItem value="">Not recorded</MenuItem>
                  {NFPA_70E_PPE_CATEGORY.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}
                </TextField>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700}>Checklist</Typography>
          <Stack spacing={2} mt={2}>
            {rows.map((row, index) => (
              <Stack key={row.question} spacing={1}>
                <Typography variant="body2" fontWeight={600}>{row.question}</Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={row.answer}
                  onChange={(_, value: Answer | null) => {
                    if (!value) return;
                    setRows((current) => current.map((item, i) => (i === index ? { ...item, answer: value } : item)));
                  }}
                >
                  <ToggleButton value="PASS">Pass</ToggleButton>
                  <ToggleButton value="FAIL">Fail</ToggleButton>
                  <ToggleButton value="NA">Not applicable</ToggleButton>
                </ToggleButtonGroup>
                {row.answer === 'FAIL' && (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField label="What failed" value={row.notes} onChange={(e) => setRows((current) => current.map((item, i) => (i === index ? { ...item, notes: e.target.value } : item)))} fullWidth required />
                    <TextField label="Corrected on the spot" value={row.immediateAction} onChange={(e) => setRows((current) => current.map((item, i) => (i === index ? { ...item, immediateAction: e.target.value } : item)))} fullWidth placeholder="Leave blank if it still needs an action" />
                  </Stack>
                )}
              </Stack>
            ))}
            <TextField label="Other observations" value={observations} onChange={(e) => setObservations(e.target.value)} fullWidth multiline minRows={2} />
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700}>Photos</Typography>
          <Stack spacing={1} mt={1}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button variant="outlined" onClick={() => setCameraOpen(true)}>Capture with camera</Button>
              <Button variant="outlined" component="label">
                Upload photos
                <input hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={(e) => { void addPhotos(e.target.files); e.target.value = ''; }} />
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">Attach up to 4 photos of the asset or a failed item. Each photo must be 5 MB or smaller.</Typography>
            {photoError && <Alert severity="error">{photoError}</Alert>}
            {photos.map((photo, index) => (
              <Stack key={`${photo.fileName}-${index}`} direction="row" spacing={1} alignItems="center">
                {safeImageSrc(photo.dataUrl) && <Box component="img" src={safeImageSrc(photo.dataUrl)} alt={photo.fileName} sx={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 1, border: 1, borderColor: 'divider' }} />}
                <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>{photo.fileName}</Typography>
                <Button size="small" color="error" onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}>Remove</Button>
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>
      <Button type="submit" variant="contained" disabled={!ready || save.isPending}>Save inspection</Button>
      <Dialog open={cameraOpen} onClose={() => setCameraOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Capture photo evidence</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            {cameraError && <Alert severity="error">{cameraError}</Alert>}
            <Box sx={{ width: '100%', aspectRatio: '4 / 3', bgcolor: 'black', borderRadius: 2, overflow: 'hidden' }}>
              <Box component="video" ref={videoRef} autoPlay playsInline muted sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </Box>
            <Typography variant="caption" color="text.secondary">Allow camera permission when prompted, then position the scene and take a photo.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCameraOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={captureCameraPhoto}>Take photo</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
