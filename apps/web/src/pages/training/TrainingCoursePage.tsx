import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { Permission } from '@ecg-she/shared';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import { endpoints } from '../../api/endpoints';
import {
  CASE_FILE_CARD_SX,
  CaseFileCard,
  CaseFileHeader,
  CaseFileSkeleton,
  titleCase,
} from '../../components/case-file';
import { useAuthStore } from '../../stores/auth.store';

function words(value: unknown): string {
  return titleCase(String(value ?? ''));
}

interface Attendee {
  id: string;
  state?: string;
  result?: string;
  completedOn?: string | null;
  expiresOn?: string | null;
  hasCertificate?: boolean;
  employee?: { fullName?: string };
  session?: { heldOn?: string; locationName?: string; trainerName?: string } | null;
}

export function TrainingCoursePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const canManage = (useAuthStore((s) => s.session?.user.permissions) ?? []).includes(Permission.TRAINING_MANAGE);
  const course = useQuery({ queryKey: ['training-course', id], queryFn: () => endpoints.trainingCourse(id) });
  const data = course.data as {
    code?: string;
    title?: string;
    description?: string | null;
    category?: string;
    durationHours?: number;
    validForMonths?: number | null;
    authorizesDuty?: string | null;
    trainerQualification?: string | null;
    accreditationBody?: string | null;
    attendees?: Attendee[];
  } | undefined;
  if (course.isLoading) return <CaseFileSkeleton />;
  if (!data) return <Alert severity="error">Course not found</Alert>;
  return (
    <Stack spacing={2.5}>
      <CaseFileHeader
        backTo="/training"
        backLabel="Training"
        reference={data.code}
        title={data.title || 'Course'}
        chips={[{ label: words(data.category), variant: 'outlined' }]}
        actions={canManage ? <Button variant="contained" onClick={() => navigate(`/training/classes/new?courseId=${id}`)}>Record a class</Button> : undefined}
        meta={[
          { icon: <CategoryOutlinedIcon fontSize="small" />, label: 'Category', value: words(data.category) },
          { icon: <ScheduleOutlinedIcon fontSize="small" />, label: 'Hours', value: String(data.durationHours ?? '—') },
          { icon: <WorkspacePremiumOutlinedIcon fontSize="small" />, label: 'Valid for', value: data.validForMonths ? `${data.validForMonths} months` : 'Does not expire' },
          { icon: <BadgeOutlinedIcon fontSize="small" />, label: 'Authorizes', value: data.authorizesDuty ? words(data.authorizesDuty) : 'No job authorization' },
        ]}
      />
      {(data.description || data.trainerQualification || data.accreditationBody) && (
        <CaseFileCard title="Course">
          {data.description && <Typography sx={{ mt: 1.5, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{data.description}</Typography>}
          {data.trainerQualification && <Typography variant="body2" mt={1.5}>Trainer must hold: {data.trainerQualification}</Typography>}
          {data.accreditationBody && <Typography variant="body2" mt={1}>Accredited by: {data.accreditationBody}</Typography>}
        </CaseFileCard>
      )}
      <Card sx={CASE_FILE_CARD_SX}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, fontWeight: 700 }}>Who attended</Typography>
          {!data.attendees?.length && <Alert severity="info" sx={{ mt: 1 }}>No class has been recorded for this course.</Alert>}
          <Stack spacing={1} mt={1}>
            {(data.attendees ?? []).map((person) => (
              <Stack key={person.id} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {person.employee?.fullName ?? 'Worker'}
                  {person.session ? ` · ${person.session.heldOn} · ${person.session.locationName} · ${person.session.trainerName}` : ''}
                  {person.expiresOn ? ` · expires ${person.expiresOn}` : ''}
                  {person.hasCertificate ? ' · certificate on file' : ''}
                </Typography>
                <Chip size="small" label={words(person.state)} color={person.state === 'CURRENT' ? 'success' : person.state === 'EXPIRING' ? 'warning' : 'error'} />
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
