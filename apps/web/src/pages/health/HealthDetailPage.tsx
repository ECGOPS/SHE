import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Stack, Typography } from '@mui/material';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import MedicalInformationOutlinedIcon from '@mui/icons-material/MedicalInformationOutlined';
import { endpoints } from '../../api/endpoints';
import { ExportReportButton } from '../../components/ExportReportButton';
import {
  CaseFileCard,
  CaseFileHeader,
  CaseFileSkeleton,
  formatDay,
  placeName,
  titleCase,
} from '../../components/case-file';

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

function Line({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <Typography variant="body2" mt={1}>
      <strong>{label}. </strong>{typeof value === 'string' ? titleCase(value) : value}
    </Typography>
  );
}

export function HealthDetailPage() {
  const { id = '' } = useParams();
  const record = useQuery({ queryKey: ['health', id], queryFn: () => endpoints.healthRecord(id) as Promise<HealthRecord> });
  const data = record.data;
  if (record.isLoading) return <CaseFileSkeleton />;
  if (!data) return <Alert severity="error">Health record not found</Alert>;
  const showsNotes = 'clinicalNotes' in data;
  return (
    <Stack spacing={2.5}>
      <CaseFileHeader
        backTo="/health"
        backLabel="Occupational health"
        reference={data.referenceCode}
        title={data.employee?.fullName || data.campaignTitle || 'Workplace reading'}
        chips={[
          { label: titleCase(data.recordType), variant: 'outlined' },
          { label: titleCase(data.reviewState), color: data.reviewState === 'OVERDUE' ? 'warning' : 'default' },
          ...(data.fitnessOutcome ? [{ label: titleCase(data.fitnessOutcome), color: data.fitnessOutcome === 'UNFIT' ? 'error' as const : 'success' as const }] : []),
        ]}
        actions={<ExportReportButton filename={`${data.referenceCode ?? 'health'}-report.pdf`} download={() => endpoints.healthReport(id)} />}
        meta={[
          { icon: <EventOutlinedIcon fontSize="small" />, label: 'Record date', value: formatDay(data.recordDate) },
          { icon: <PlaceOutlinedIcon fontSize="small" />, label: 'Location', value: data.locationName || placeName(data.region, data.district) },
          { icon: <PersonOutlineRoundedIcon fontSize="small" />, label: 'Clinician', value: data.clinician || '—' },
          { icon: <MedicalInformationOutlinedIcon fontSize="small" />, label: 'Next review', value: formatDay(data.nextReviewDate) },
        ]}
      />
      <CaseFileCard title="Record">
        <Line label="Cleared for" value={data.duty} />
        <Line label="Fitness" value={data.fitnessOutcome} />
        <Line label="Restriction" value={data.restrictions} />
        <Line label="Test" value={data.surveillanceTest} />
        <Line label="Agent" value={data.exposureAgent} />
        <Line label="Reading" value={data.exposureReading} />
        <Line label="Vaccine" value={data.vaccine} />
        <Line label="Dose" value={data.dose} />
        <Line label="Batch" value={data.batchNumber} />
        <Line label="Attended" value={data.attendeeCount} />
      </CaseFileCard>
      {showsNotes && (
        <CaseFileCard title="Clinical note" hint="Visible to the people who record health.">
          <Typography variant="body2" mt={1.5}>{data.clinicalNotes || 'No clinical note was recorded.'}</Typography>
        </CaseFileCard>
      )}
    </Stack>
  );
}
