import { GridColDef } from '@mui/x-data-grid';
import { Permission } from '@ecg-she/shared';
import { ModulePage, dateCol, regionCol, statusChip } from '../components/ModulePage';
import { endpoints } from '../api/endpoints';

const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
};

const cols: GridColDef[] = [
  regionCol(),
  { field: 'referenceCode', headerName: 'Assessment No', width: 220 },
  { field: 'activityBeingDone', headerName: 'Activity', flex: 1, minWidth: 220 },
  { field: 'locationWorkplace', headerName: 'Location', width: 180 },
  dateCol('assessmentDate', 'Date', 140),
  { field: 'assessorNames', headerName: 'Assessor(s)', width: 180 },
  {
    field: 'status',
    headerName: 'Status',
    width: 160,
    renderCell: (p) => statusChip(p.value, STATUS_COLOR),
  },
  dateCol('createdAt', 'Created'),
];

export function RiskAssessmentsPage() {
  return (
    <ModulePage
      title="Risk Assessment"
      subtitle="Identify hazards to people, property or the environment, rate the risk, and record the controls — same form used in the field."
      queryKey="risk-assessments"
      list={endpoints.riskAssessments}
      create={endpoints.createRiskAssessment}
      columns={cols}
      ctaLabel="New risk assessment"
      permission={Permission.RISK_ASSESSMENT_CREATE}
      createPath="/risk-assessments/new"
      formFields={[]}
      rowHref={(row) => `/risk-assessments/${(row as { id: string }).id}`}
    />
  );
}
