import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, Dialog, DialogContent, Grid2 as Grid, Stack, Typography } from '@mui/material';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import SupervisorAccountOutlinedIcon from '@mui/icons-material/SupervisorAccountOutlined';
import PhoneInTalkOutlinedIcon from '@mui/icons-material/PhoneInTalkOutlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import { EscalationEntityType, ISSUE_SCOPE_LABEL, IssueScope } from '@ecg-she/shared';
import { endpoints, IncidentDto } from '../../api/endpoints';
import { imageSrcFromBlob } from '../../security/output';
import { EscalationPanel } from '../../components/EscalationPanel';
import { ExportReportButton } from '../../components/ExportReportButton';
import {
  CaseFileCard,
  CaseFileHeader,
  CaseFileMetric,
  CaseFileSkeleton,
  formatWhen,
  placeName,
  titleCase,
} from '../../components/case-file';
import { IncidentInvestigation } from './IncidentInvestigation';

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
  PENDING_APPROVAL: 'warning',
  CLOSED: 'success',
  REJECTED: 'error',
};

export function IncidentDetailPage() {
  const { id } = useParams();
  const { data: incident, isLoading } = useQuery({
    queryKey: ['incident', id],
    queryFn: () => endpoints.incident(id!),
    enabled: !!id,
  });

  if (isLoading || !incident) return <CaseFileSkeleton />;

  const scope = ISSUE_SCOPE_LABEL[incident.currentScope ?? IssueScope.DISTRICT];

  return (
    <Stack spacing={2.5}>
      <CaseFileHeader
        backTo="/incidents"
        backLabel="Incidents"
        reference={incident.referenceCode}
        title={incident.title}
        chips={[
          { label: titleCase(incident.status), color: STATUS_COLOR[incident.status] ?? 'default' },
          { label: titleCase(incident.severity), color: SEV_COLOR[incident.severity] ?? 'default' },
          { label: titleCase(incident.type), variant: 'outlined' },
          { label: incident.resolvedAt ? `Resolved at ${scope}` : `Open at ${scope}`, variant: 'outlined' },
        ]}
        actions={
          id ? (
            <ExportReportButton
              filename={`${incident.referenceCode}-report.pdf`}
              download={() => endpoints.incidentReport(id)}
            />
          ) : undefined
        }
        meta={[
          { icon: <EventOutlinedIcon fontSize="small" />, label: 'Occurred', value: formatWhen(incident.occurredAt) },
          { icon: <PlaceOutlinedIcon fontSize="small" />, label: 'Location', value: placeName(incident.region, incident.district) },
          { icon: <PersonOutlineRoundedIcon fontSize="small" />, label: 'Reported by', value: incident.reportedBy?.fullName ?? '—' },
          { icon: <AssignmentIndOutlinedIcon fontSize="small" />, label: 'Investigator', value: incident.investigator?.fullName ?? 'Not assigned' },
        ]}
      />

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 8 }}>
          <CaseFileCard title="What happened">
            <Typography sx={{ mt: 1.5, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {incident.description || 'No description was recorded.'}
            </Typography>
          </CaseFileCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <CaseFileCard title="People and cost">
            <Grid container spacing={1.25} mt={1.5}>
              <Grid size={{ xs: 6, md: 12 }}>
                <CaseFileMetric label="Fatalities" value={incident.fatalities} alert={incident.fatalities > 0} />
              </Grid>
              <Grid size={{ xs: 6, md: 12 }}>
                <CaseFileMetric label="Injured" value={incident.injuredPersons} alert={incident.injuredPersons > 0} />
              </Grid>
              <Grid size={{ xs: 6, md: 12 }}>
                <CaseFileMetric label="Affected" value={incident.affectedPersons} />
              </Grid>
              <Grid size={{ xs: 6, md: 12 }}>
                <CaseFileMetric
                  label="Estimated cost"
                  value={`GHS ${Number(incident.estimatedCost || 0).toLocaleString()}`}
                />
              </Grid>
            </Grid>
          </CaseFileCard>
        </Grid>
      </Grid>

      <CaseFileCard title="Immediate response" hint="Scene actions recorded when this report was filed.">
          <Grid container spacing={1.5} mt={2}>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <ResponseTile
                icon={<ShieldOutlinedIcon />}
                title="Area secured"
                done={!!incident.areaSecured}
                detail={incident.areaSecured ? 'Scene isolated' : 'Not recorded'}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <ResponseTile
                icon={<LocalHospitalOutlinedIcon />}
                title="First aid"
                done={incident.firstAidOutcome === 'GIVEN' || incident.firstAidOutcome === 'NOT_REQUIRED'}
                detail={
                  incident.firstAidOutcome === 'GIVEN'
                    ? incident.firstAidNotes || 'Given'
                    : incident.firstAidOutcome === 'NOT_REQUIRED'
                      ? incident.firstAidNotes
                        ? `Not required — ${incident.firstAidNotes}`
                        : 'Not required'
                      : 'Not recorded'
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <ResponseTile
                icon={<SupervisorAccountOutlinedIcon />}
                title="Supervisor informed"
                done={!!incident.supervisorInformed}
                detail={
                  incident.supervisorInformed
                    ? incident.supervisorName || 'Yes'
                    : 'Not recorded'
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <ResponseTile
                icon={<PhoneInTalkOutlinedIcon />}
                title="Emergency services"
                done={!!incident.emergencyServicesContacted}
                detail={
                  incident.emergencyServicesContacted
                    ? incident.emergencyServicesDetails || 'Contacted'
                    : 'Not contacted'
                }
              />
            </Grid>
          </Grid>
          {incident.managementReportSubmittedAt && (
            <Typography variant="body2" color="text.secondary" mt={2}>
              Submitted to management {formatWhen(incident.managementReportSubmittedAt)}
              {incident.managementReportSubmittedBy?.fullName
                ? ` by ${incident.managementReportSubmittedBy.fullName}`
                : ''}
              .
            </Typography>
          )}
      </CaseFileCard>

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

function ResponseTile({
  icon,
  title,
  done,
  detail,
}: {
  icon: ReactNode;
  title: string;
  done: boolean;
  detail: string;
}) {
  return (
    <Stack
      spacing={1}
      sx={{
        height: '100%',
        p: 1.75,
        borderRadius: 2,
        border: '1px solid',
        borderColor: done ? 'success.light' : 'divider',
        bgcolor: done ? 'rgba(46, 125, 50, 0.05)' : 'background.paper',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Box sx={{ color: done ? 'success.main' : 'primary.main', display: 'flex' }}>{icon}</Box>
        {done ? (
          <CheckCircleRoundedIcon fontSize="small" color="success" />
        ) : (
          <RadioButtonUncheckedRoundedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
        )}
      </Stack>
      <Typography variant="subtitle2" fontWeight={700}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {detail}
      </Typography>
    </Stack>
  );
}

function PhotoEvidence({ incident }: { incident: IncidentDto }) {
  const photos = (incident.attachments ?? []).filter((a) => a.kind === 'photo');
  if (photos.length === 0) return null;

  return (
    <CaseFileCard title="Photo evidence" hint="Captured or uploaded with this report.">
      <Grid container spacing={2} mt={2}>
        {photos.map((photo) => (
          <Grid key={photo.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <IncidentPhoto incidentId={incident.id} photo={photo} />
          </Grid>
        ))}
      </Grid>
    </CaseFileCard>
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
          border: '1px solid',
          borderColor: 'divider',
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
      <Typography variant="body2" mt={1} noWrap title={photo.fileName} fontWeight={600}>
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
