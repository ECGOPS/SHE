import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { endpoints } from '../../api/endpoints';
import { ExportReportButton } from '../../components/ExportReportButton';

interface HealthRecord {
  id: string;
  referenceCode?: string | null;
  recordType?: string;
  recordDate?: string;
  nextReviewDate?: string | null;
  reviewState?: string;
  status?: string;
  fitnessOutcome?: string | null;
  restrictions?: string | null;
  duty?: string | null;
  surveillanceTest?: string | null;
  exposureAgent?: string | null;
  exposureReading?: string | null;
  locationName?: string | null;
  vaccine?: string | null;
  dose?: string | null;
  batchNumber?: string | null;
  campaignTitle?: string | null;
  attendeeCount?: number | null;
  clinician?: string | null;
  clinicalNotes?: string | null;
  employee?: { fullName?: string } | null;
  region?: { name?: string } | null;
  district?: { name?: string } | null;
}

function words(value: unknown): string {
  return String(value ?? '').replaceAll('_', ' ');
}

function Line({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null;
  return <Typography variant="body2">{label}: {typeof value === 'string' ? words(value) : value}</Typography>;
}

export function HealthDetailPage() {
  const { id = '' } = useParams();
  const record = useQuery({ queryKey: ['health', id], queryFn: () => endpoints.healthRecord(id) as Promise<HealthRecord> });
  const data = record.data;
  if (record.isLoading) return <Alert severity="info">Loading the health record...</Alert>;
  if (!data) return <Alert severity="error">Health record not found</Alert>;
  const showsNotes = 'clinicalNotes' in data;
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography variant="h5" fontWeight={700}>{data.referenceCode}</Typography>
          <Chip label={words(data.recordType)} />
          <Chip label={words(data.reviewState)} color={data.reviewState === 'OVERDUE' ? 'warning' : 'default'} />
        </Stack>
        <ExportReportButton filename={`${data.referenceCode ?? 'health'}-report.pdf`} download={() => endpoints.healthReport(id)} />
      </Stack>
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700}>{data.employee?.fullName || data.campaignTitle || 'Workplace reading'}</Typography>
          <Line label="Region" value={data.region?.name} />
          <Line label="District" value={data.district?.name} />
          <Line label="Record date" value={data.recordDate ? String(data.recordDate).slice(0, 10) : ''} />
          <Line label="Cleared for" value={data.duty} />
          <Line label="Fitness" value={data.fitnessOutcome} />
          <Line label="Restriction" value={data.restrictions} />
          <Line label="Test" value={data.surveillanceTest} />
          <Line label="Agent" value={data.exposureAgent} />
          <Line label="Reading" value={data.exposureReading} />
          <Line label="Place" value={data.locationName} />
          <Line label="Vaccine" value={data.vaccine} />
          <Line label="Dose" value={data.dose} />
          <Line label="Batch" value={data.batchNumber} />
          <Line label="Attended" value={data.attendeeCount} />
          <Line label="Next review" value={data.nextReviewDate ? String(data.nextReviewDate).slice(0, 10) : ''} />
          <Line label="Clinician" value={data.clinician} />
        </CardContent>
      </Card>
      {showsNotes && (
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={700}>Clinical note</Typography>
            <Typography variant="body2" color="text.secondary">Visible to the people who record health.</Typography>
            <Typography variant="body2" mt={1}>{data.clinicalNotes || 'No clinical note was recorded.'}</Typography>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
