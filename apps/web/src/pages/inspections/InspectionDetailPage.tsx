import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogContent, Grid2 as Grid, Stack, TextField, Typography } from '@mui/material';
import { HazardCategory, Permission } from '@ecg-she/shared';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import { endpoints } from '../../api/endpoints';
import { imageSrcFromBlob } from '../../security/output';
import { ExportReportButton } from '../../components/ExportReportButton';
import {
  CASE_FILE_CARD_SX,
  CaseFileCard,
  CaseFileHeader,
  CaseFileSkeleton,
  titleCase,
} from '../../components/case-file';
import { useAuthStore } from '../../stores/auth.store';
import { OUTDOOR_INSPECTIONS } from './checklists';

interface Item {
  question: string;
  answer: 'PASS' | 'FAIL' | 'NA';
  notes?: string;
  immediateAction?: string;
  capaId?: string;
  hazardId?: string;
}

function errorMessage(err: unknown): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? (err as Error)?.message ?? 'Request failed';
}

interface InspectionRecord {
  id: string;
  referenceCode?: string;
  status?: string;
  type?: string;
  assetOrLocation?: string;
  scorePercent?: number;
  weatherCondition?: string | null;
  observations?: string | null;
  regionId?: string | null;
  districtId?: string | null;
  region?: { id?: string } | null;
  district?: { id?: string } | null;
  inspector?: { fullName?: string } | null;
  items?: Item[] | null;
  attachments?: Array<{ id: string; fileName: string; mimeType: string }> | null;
}

function openFinding(item: Item): boolean {
  return item.answer === 'FAIL' && !item.immediateAction && !item.capaId && !item.hazardId;
}

export function InspectionDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const permissions = useAuthStore((s) => s.session?.user.permissions ?? []);
  const canConduct = permissions.includes(Permission.INSPECTION_CONDUCT);
  const canCapa = permissions.includes(Permission.CAPA_CREATE);
  const canHazard = permissions.includes(Permission.HAZARD_CREATE);
  const record = useQuery({
    queryKey: ['inspection', id],
    queryFn: () => endpoints.inspection(id) as Promise<InspectionRecord>,
    enabled: !!id,
  });
  const [error, setError] = useState<string | null>(null);
  const [actions, setActions] = useState<Record<string, string>>({});
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [due, setDue] = useState<Record<string, string>>({});

  const inspection = record.data;
  const items = inspection?.items ?? [];
  const findings = inspection?.status === 'FINDINGS';

  const refresh = async () => {
    setError(null);
    await qc.invalidateQueries({ queryKey: ['inspection', id] });
    await qc.invalidateQueries({ queryKey: ['inspections'] });
  };
  const run = (fn: () => Promise<unknown>) => fn().then(refresh).catch((err: unknown) => setError(errorMessage(err)));

  const patch = (next: Item[]) => endpoints.updateInspectionItems(id, next);

  const onImmediate = (item: Item) => (event: FormEvent) => {
    event.preventDefault();
    const text = actions[item.question]?.trim();
    if (!text) return;
    void run(() => patch(items.map((row) => (row.question === item.question ? { ...row, immediateAction: text } : row))));
  };

  const onCapa = (item: Item) => (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const capa = await endpoints.createCapa({
        title: titles[item.question]?.trim() || item.question,
        description: item.notes || item.question,
        dueDate: due[item.question],
        sourceType: 'INSPECTION',
        sourceId: id,
        regionId: inspection?.regionId ?? inspection?.region?.id,
        districtId: inspection?.districtId ?? inspection?.district?.id,
        actionType: 'CORRECTIVE_ACTION',
        priority: 'HIGH',
      });
      await patch(items.map((row) => (row.question === item.question ? { ...row, capaId: String(capa.id) } : row)));
    });
  };

  const onHazard = (item: Item) => {
    const electrical = OUTDOOR_INSPECTIONS.includes(inspection?.type as never);
    void run(async () => {
      const hazard = await endpoints.createHazard({
        title: item.question,
        description: item.notes || item.question,
        category: electrical ? HazardCategory.ELECTRICAL : HazardCategory.PHYSICAL,
        peopleExposed: true,
        immediateAction: item.notes || 'Found on inspection',
        regionId: inspection?.regionId ?? inspection?.region?.id,
        districtId: inspection?.districtId ?? inspection?.district?.id,
        locationName: inspection?.assetOrLocation,
      });
      await patch(items.map((row) => (row.question === item.question ? { ...row, hazardId: String(hazard.id) } : row)));
    });
  };

  if (record.isLoading) return <CaseFileSkeleton />;
  if (!inspection) return <Alert severity="error">Inspection not found</Alert>;

  return (
    <Stack spacing={2.5}>
      <CaseFileHeader
        backTo="/inspections"
        backLabel="Inspections"
        reference={String(inspection.referenceCode ?? 'Inspection')}
        title={String(inspection.assetOrLocation || titleCase(inspection.type) || 'Inspection')}
        chips={[
          { label: titleCase(inspection.status), color: inspection.status === 'COMPLETED' ? 'success' : 'warning' },
          { label: `${inspection.scorePercent ?? 0}%`, variant: 'outlined' },
          { label: titleCase(inspection.type), variant: 'outlined' },
        ]}
        actions={<ExportReportButton filename={`${String(inspection.referenceCode ?? 'inspection')}-report.pdf`} download={() => endpoints.inspectionReport(id)} />}
        meta={[
          { icon: <PlaceOutlinedIcon fontSize="small" />, label: 'Place', value: String(inspection.assetOrLocation || '—') },
          { icon: <PersonOutlineRoundedIcon fontSize="small" />, label: 'Inspector', value: String(inspection.inspector?.fullName ?? '—') },
          { icon: <CloudOutlinedIcon fontSize="small" />, label: 'Weather', value: titleCase(inspection.weatherCondition) },
          { icon: <FactCheckOutlinedIcon fontSize="small" />, label: 'Score', value: `${inspection.scorePercent ?? 0}%` },
        ]}
      />
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {inspection.observations && (
        <CaseFileCard title="Observations">
          <Typography sx={{ mt: 1.5, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{String(inspection.observations)}</Typography>
        </CaseFileCard>
      )}
      <Photos inspectionId={inspection.id} photos={inspection.attachments ?? []} />
      <Card sx={CASE_FILE_CARD_SX}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, fontWeight: 700 }}>Checklist</Typography>
          <Stack spacing={2} mt={2}>
            {items.map((item) => (
              <Stack key={item.question} spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>{item.question}</Typography>
                  <Chip size="small" label={item.answer} color={item.answer === 'FAIL' ? 'error' : item.answer === 'PASS' ? 'success' : 'default'} />
                </Stack>
                {item.notes && <Typography variant="body2" color="text.secondary">{item.notes}</Typography>}
                {item.immediateAction && <Typography variant="body2">Corrected on the spot: {item.immediateAction}</Typography>}
                {item.capaId && <Button component={RouterLink} to={`/capa/${item.capaId}`} size="small" sx={{ alignSelf: 'flex-start' }}>Open the action</Button>}
                {item.hazardId && <Typography variant="body2">Reported as a hazard</Typography>}
                {findings && openFinding(item) && canConduct && (
                  <Stack spacing={1} component="form" onSubmit={onImmediate(item)}>
                    <TextField
                      label="Corrected on the spot"
                      size="small"
                      value={actions[item.question] ?? ''}
                      onChange={(e) => setActions((current) => ({ ...current, [item.question]: e.target.value }))}
                      fullWidth
                    />
                    <Button type="submit" variant="outlined" size="small" sx={{ alignSelf: 'flex-start' }}>Save correction</Button>
                  </Stack>
                )}
                {findings && openFinding(item) && canCapa && (
                  <Stack spacing={1} component="form" onSubmit={onCapa(item)}>
                    <TextField label="Corrective action" size="small" value={titles[item.question] ?? item.question} onChange={(e) => setTitles((current) => ({ ...current, [item.question]: e.target.value }))} fullWidth required />
                    <TextField label="Due date" type="date" size="small" value={due[item.question] ?? ''} onChange={(e) => setDue((current) => ({ ...current, [item.question]: e.target.value }))} required slotProps={{ inputLabel: { shrink: true } }} sx={{ maxWidth: 240 }} />
                    <Button type="submit" variant="contained" size="small" sx={{ alignSelf: 'flex-start' }}>Raise corrective action</Button>
                  </Stack>
                )}
                {findings && openFinding(item) && canHazard && !item.hazardId && (
                  <Button variant="outlined" size="small" sx={{ alignSelf: 'flex-start' }} onClick={() => onHazard(item)}>
                    People are exposed — report a hazard
                  </Button>
                )}
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>
      {findings && canConduct && (
        <Button variant="contained" onClick={() => void run(() => endpoints.closeInspection(id))} disabled={items.some(openFinding)}>
          Complete inspection
        </Button>
      )}
    </Stack>
  );
}

function Photos({ inspectionId, photos }: { inspectionId: string; photos: NonNullable<InspectionRecord['attachments']> }) {
  if (!photos.length) return null;
  return (
    <CaseFileCard title="Photo evidence">
      <Grid container spacing={2} mt={2}>
          {photos.map((photo) => (
            <Grid key={photo.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <PhotoThumb inspectionId={inspectionId} photo={photo} />
            </Grid>
          ))}
        </Grid>
    </CaseFileCard>
  );
}

function PhotoThumb({
  inspectionId,
  photo,
}: {
  inspectionId: string;
  photo: NonNullable<InspectionRecord['attachments']>[number];
}) {
  const { data: blob } = useQuery({
    queryKey: ['inspection-photo', inspectionId, photo.id],
    queryFn: async () => (await endpoints.inspectionAttachmentFile(inspectionId, photo.id)).data as Blob,
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
          {src && <Box component="img" src={src} alt={photo.fileName} sx={{ display: 'block', maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain' }} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
