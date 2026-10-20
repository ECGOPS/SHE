import { GridColDef } from '@mui/x-data-grid';
import { Permission } from '@ecg-she/shared';
import { ModulePage, dateCol, regionCol, statusChip } from '../components/ModulePage';
import { endpoints } from '../api/endpoints';

function words(value: unknown): string {
  return String(value ?? '').replaceAll('_', ' ');
}

function summary(row: {
  recordType?: string;
  duty?: string | null;
  fitnessOutcome?: string | null;
  surveillanceTest?: string | null;
  exposureAgent?: string | null;
  exposureReading?: string | null;
  vaccine?: string | null;
  dose?: string | null;
  locationName?: string | null;
}): string {
  if (row.recordType === 'FITNESS_FOR_DUTY') return [words(row.duty), words(row.fitnessOutcome)].filter(Boolean).join(' · ');
  if (row.recordType === 'MEDICAL_SURVEILLANCE') return words(row.surveillanceTest);
  if (row.recordType === 'EXPOSURE_MONITORING') return [words(row.exposureAgent), row.exposureReading].filter(Boolean).join(' · ');
  if (row.recordType === 'VACCINATION') return [words(row.vaccine), words(row.dose)].filter(Boolean).join(' · ');
  return row.locationName ?? '';
}

const cols: GridColDef[] = [
  regionCol(),
  { field: 'referenceCode', headerName: 'Reference', width: 210 },
  {
    field: 'worker',
    headerName: 'Worker',
    flex: 1,
    minWidth: 180,
    valueGetter: (_value, row) => row.employee?.fullName || row.campaignTitle || row.locationName || '',
  },
  { field: 'recordType', headerName: 'Record type', width: 190, renderCell: (p) => statusChip(p.value) },
  {
    field: 'certificate',
    headerName: 'Certificate',
    flex: 1,
    minWidth: 180,
    valueGetter: (_value, row) => summary(row),
  },
  { field: 'reviewState', headerName: 'Review', width: 140, renderCell: (p) => statusChip(p.value) },
  dateCol('nextReviewDate', 'Next review'),
];

export function HealthPage() {
  return (
    <ModulePage
      title="Occupational Health"
      subtitle="Record the examination. The supervisor sees the fitness certificate. The diagnosis stays with the person who recorded it."
      queryKey="health"
      list={endpoints.health}
      create={endpoints.createHealth}
      columns={cols}
      createPath="/health/new"
      rowHref={(row) => `/health/${row.id}`}
      permission={Permission.HEALTH_CREATE}
      formFields={[]}
    />
  );
}
