import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { Permission } from '@ecg-she/shared';
import { endpoints } from '../../api/endpoints';
import { useAuthStore } from '../../stores/auth.store';

function words(value: unknown): string {
  return String(value ?? '').replaceAll('_', ' ');
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
  if (course.isLoading) return <Alert severity="info">Loading the course...</Alert>;
  if (!data) return <Alert severity="error">Course not found</Alert>;
  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
        <Stack spacing={0.5}>
          <Typography variant="h5" fontWeight={700}>{data.code}</Typography>
          <Typography variant="h6">{data.title}</Typography>
        </Stack>
        {canManage && <Button variant="contained" onClick={() => navigate(`/training/classes/new?courseId=${id}`)}>Record a class</Button>}
      </Stack>
      <Card>
        <CardContent>
          <Typography variant="body2">Category: {words(data.category)}</Typography>
          <Typography variant="body2">Hours: {data.durationHours}</Typography>
          <Typography variant="body2">Valid for: {data.validForMonths ? `${data.validForMonths} months` : 'Does not expire'}</Typography>
          <Typography variant="body2">Authorizes: {data.authorizesDuty ? words(data.authorizesDuty) : 'No job authorization'}</Typography>
          {data.trainerQualification && <Typography variant="body2">Trainer must hold: {data.trainerQualification}</Typography>}
          {data.accreditationBody && <Typography variant="body2">Accredited by: {data.accreditationBody}</Typography>}
          {data.description && <Typography variant="body2" mt={1}>{data.description}</Typography>}
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700}>Who attended</Typography>
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
