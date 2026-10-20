import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  Divider,
  Grid2 as Grid,
  Stack,
  Typography,
} from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import { EscalationEntityType, IssueScope } from '@ecg-she/shared';
import { endpoints, IncidentDto } from '../../api/endpoints';
import { imageSrcFromBlob } from '../../security/output';
import { EscalationPanel } from '../../components/EscalationPanel';
import { IncidentInvestigation } from './IncidentInvestigation';

export function IncidentDetailPage() {
  const { id } = useParams();
  const { data: incident, isLoading } = useQuery({
    queryKey: ['incident', id],
    queryFn: () => endpoints.incident(id!),
    enabled: !!id,
  });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportReport = async () => {
    if (!id || !incident) return;
    setExporting(true);
    setExportError(null);
    try {
      const response = await endpoints.incidentReport(id);
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${incident.referenceCode}-report.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('The report could not be prepared.');
    } finally {
      setExporting(false);
    }
  };

  if (isLoading || !incident) return <Typography>Loading...</Typography>;

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
          <Typography variant="h5" fontWeight={700}>{incident.referenceCode}</Typography>
          <Chip label={incident.status.replaceAll('_', ' ')} color="primary" />
          <Chip label={incident.severity} color="warning" />
          <Chip label={incident.type.replaceAll('_', ' ')} variant="outlined" />
        </Stack>
        <Button
          variant="contained"
          startIcon={<DownloadRoundedIcon />}
          disabled={exporting}
          onClick={() => void exportReport()}
        >
          {exporting ? 'Preparing report…' : 'Export PDF report'}
        </Button>
      </Stack>
      {exportError && <Alert severity="error" onClose={() => setExportError(null)}>{exportError}</Alert>}

      <Card>
        <CardContent>
          <Typography variant="h6">{incident.title}</Typography>
          <Typography color="text.secondary" mt={0.5}>
            Occurred {new Date(incident.occurredAt).toLocaleString()}
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Typography variant="overline" color="text.secondary">Description</Typography>
              <Typography>{incident.description}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="overline" color="text.secondary">Impact</Typography>
              <Typography>Fatalities: {incident.fatalities}</Typography>
              <Typography>Injured: {incident.injuredPersons}</Typography>
              <Typography>Affected: {incident.affectedPersons}</Typography>
              <Typography>Estimated cost: GHS {Number(incident.estimatedCost).toLocaleString()}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="overline" color="text.secondary">Location</Typography>
              <Typography>{incident.region?.name ?? '—'} / {incident.district?.name ?? 'HQ'}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="overline" color="text.secondary">Reported by</Typography>
              <Typography>{incident.reportedBy?.fullName ?? '—'}</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <PhotoEvidence incident={incident} />

      <IncidentInvestigation incident={incident} />

      <EscalationPanel
        entityType={EscalationEntityType.INCIDENT}
        entityId={incident.id}
        currentScope={incident.currentScope ?? IssueScope.DISTRICT}
        resolvedAt={incident.resolvedAt}
        resolvedAtScope={incident.resolvedAtScope}
        resolutionNotes={incident.resolutionNotes}
        referenceCode={incident.referenceCode}
      />
    </Stack>
  );
}

function PhotoEvidence({ incident }: { incident: IncidentDto }) {
  const photos = (incident.attachments ?? []).filter((a) => a.kind === 'photo');
  if (photos.length === 0) return null;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight={700}>
          Photo evidence
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Photos captured or uploaded with this incident report.
        </Typography>
        <Grid container spacing={2}>
          {photos.map((photo) => (
            <Grid key={photo.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <IncidentPhoto incidentId={incident.id} photo={photo} />
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
}

function IncidentPhoto({
  incidentId,
  photo,
}: {
  incidentId: string;
  photo: NonNullable<IncidentDto['attachments']>[number];
}) {
  const { data: blob, isLoading, error } = useQuery({
    queryKey: ['incident-photo', incidentId, photo.id],
    queryFn: async () => {
      const res = await endpoints.incidentAttachmentFile(incidentId, photo.id);
      return res.data as Blob;
    },
  });

  const [open, setOpen] = useState(false);
  const src = useMemo(() => imageSrcFromBlob(blob), [blob]);

  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  return (
    <Box>
      <Box
        component="button"
        type="button"
        aria-label={src ? `View ${photo.fileName} full size` : photo.fileName}
        disabled={!src}
        onClick={() => setOpen(true)}
        sx={{
          width: '100%',
          p: 0,
          border: 0,
          aspectRatio: '4 / 3',
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: src ? 'zoom-in' : 'default',
        }}
      >
        {src ? (
          <Box
            component="img"
            src={src}
            alt=""
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Typography variant="body2" color={error ? 'error' : 'text.secondary'}>
            {error ? 'Failed to load photo' : isLoading ? 'Loading photo...' : 'No preview'}
          </Typography>
        )}
      </Box>
      <Typography variant="body2" mt={1} noWrap title={photo.fileName}>
        {photo.fileName}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {Math.round(Number(photo.sizeBytes ?? 0) / 1024)} KB
      </Typography>
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
    </Box>
  );
}
