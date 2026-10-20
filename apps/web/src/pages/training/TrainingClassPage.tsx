import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Autocomplete, Button, Card, CardContent, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { isDistrictScope, isRegionalScope, isSafetyOfficer } from '@ecg-she/shared';
import { endpoints } from '../../api/endpoints';
import { isRasterImageType } from '../../security/output';
import { useAuthStore } from '../../stores/auth.store';
import { SupervisorField } from '../jsa/ChoiceFields';

interface Attendee {
  employeeId: string;
  result: 'PASS' | 'FAIL';
  certificate?: { fileName: string; mimeType: string; dataUrl: string };
}

function errorMessage(err: unknown): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? (err as Error)?.message ?? 'Request failed';
}

async function readFile(file: File): Promise<{ fileName: string; mimeType: string; dataUrl: string }> {
  if (file.type !== 'application/pdf' && !isRasterImageType(file.type)) throw new Error('Use a PDF, JPEG, PNG, WEBP, or GIF.');
  if (file.size > 5 * 1024 * 1024) throw new Error('The certificate must be 5 MB or smaller.');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the certificate'));
    reader.readAsDataURL(file);
  });
  return { fileName: file.name, mimeType: file.type, dataUrl };
}

export function TrainingClassPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const role = useAuthStore((s) => s.session?.user.role);
  const session = useAuthStore((s) => s.session);
  const lockedToRegion = !!role && isSafetyOfficer(role) && (isRegionalScope(role) || isDistrictScope(role));
  const lockedToDistrict = !!role && isSafetyOfficer(role) && isDistrictScope(role);
  const [regionId, setRegionId] = useState(session?.user.regionId ?? '');
  const [districtId, setDistrictId] = useState(session?.user.districtId ?? '');
  const [courseId, setCourseId] = useState(params.get('courseId') ?? '');
  const [heldOn, setHeldOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [locationName, setLocationName] = useState('');
  const [trainerName, setTrainerName] = useState('');
  const [attendees, setAttendees] = useState<Attendee[]>([{ employeeId: '', result: 'PASS' }]);
  const [error, setError] = useState<string | null>(null);

  const regions = useQuery({ queryKey: ['regions'], queryFn: endpoints.regions });
  const districts = useQuery({ queryKey: ['districts', regionId], queryFn: () => endpoints.districts(regionId), enabled: !!regionId });
  const [courseText, setCourseText] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setCourseSearch(courseText.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [courseText]);
  const courses = useQuery({
    queryKey: ['training-courses', courseSearch],
    queryFn: () => endpoints.trainingCourses({ search: courseSearch || undefined, pageSize: 25 }),
  });
  const people = useQuery({ queryKey: ['training-people'], queryFn: endpoints.trainingPeople });
  const courseRows = (courses.data?.items ?? []) as Array<{ id: string; code?: string; title?: string; trainerQualification?: string | null }>;
  const preset = useQuery({
    queryKey: ['training-course', courseId],
    queryFn: () => endpoints.trainingCourse(courseId) as Promise<{ id: string; code?: string; title?: string; trainerQualification?: string | null }>,
    enabled: !!courseId,
  });
  const selected = courseRows.find((course) => course.id === courseId) ?? (preset.data?.id === courseId ? preset.data : undefined);
  const courseOptions = selected && !courseRows.some((course) => course.id === selected.id) ? [selected, ...courseRows] : courseRows;

  const save = useMutation({
    mutationFn: () => endpoints.recordTrainingClass({
      courseId,
      heldOn,
      locationName: locationName.trim(),
      trainerName: trainerName.trim(),
      regionId,
      districtId: districtId || undefined,
      attendees: attendees.filter((person) => person.employeeId).map((person) => ({
        employeeId: person.employeeId,
        result: person.result,
        certificate: person.certificate,
      })),
    }),
    onSuccess: () => navigate(`/training/${courseId}`),
    onError: (err) => setError(errorMessage(err)),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    save.mutate();
  };

  return (
    <Stack spacing={2} component="form" onSubmit={onSubmit}>
      <Typography variant="h5" fontWeight={700}>Record a class</Typography>
      <Typography variant="body2" color="text.secondary">
        Name the place and the trainer, then mark each person pass or fail. A pass expires from the course validity.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField select label="Region" value={regionId} onChange={(e) => { setRegionId(e.target.value); setDistrictId(''); }} required fullWidth disabled={lockedToRegion}>
                {(regions.data ?? []).map((region) => <MenuItem key={region.id} value={region.id}>{region.name}</MenuItem>)}
              </TextField>
              <TextField select label="District" value={districtId} onChange={(e) => setDistrictId(e.target.value)} fullWidth disabled={lockedToDistrict || !regionId}>
                <MenuItem value="">Whole region</MenuItem>
                {(districts.data ?? []).map((district) => <MenuItem key={district.id} value={district.id}>{district.name}</MenuItem>)}
              </TextField>
            </Stack>
            <Autocomplete
              options={courseOptions}
              value={selected ?? null}
              loading={courses.isFetching}
              onInputChange={(_, text) => setCourseText(text)}
              onChange={(_, course) => setCourseId(course?.id ?? '')}
              getOptionLabel={(course) => `${course.code ?? ''} · ${course.title ?? ''}`}
              isOptionEqualToValue={(option, current) => option.id === current.id}
              renderInput={(params) => <TextField {...params} label="Course" required helperText="Search by course code or title." />}
            />
            {selected?.trainerQualification && <Alert severity="info">The trainer should hold {selected.trainerQualification}.</Alert>}
            <TextField label="Date" type="date" value={heldOn} onChange={(e) => setHeldOn(e.target.value)} required fullWidth InputLabelProps={{ shrink: true }} />
            <TextField label="Place" value={locationName} onChange={(e) => setLocationName(e.target.value)} required fullWidth />
            <TextField label="Trainer" value={trainerName} onChange={(e) => setTrainerName(e.target.value)} required fullWidth />
            {attendees.map((person, index) => (
              <Stack key={index} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                <SupervisorField
                  people={people.data ?? []}
                  value={person.employeeId}
                  onChange={(employeeId) => setAttendees((rows) => rows.map((row, i) => i === index ? { ...row, employeeId } : row))}
                  label="Person"
                />
                <TextField select label="Result" value={person.result} onChange={(e) => setAttendees((rows) => rows.map((row, i) => i === index ? { ...row, result: e.target.value as 'PASS' | 'FAIL' } : row))} sx={{ minWidth: 120 }}>
                  <MenuItem value="PASS">Pass</MenuItem>
                  <MenuItem value="FAIL">Fail</MenuItem>
                </TextField>
                <Button variant="outlined" component="label">
                  {person.certificate ? 'Certificate added' : 'Certificate'}
                  <input hidden type="file" accept="application/pdf,image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    void readFile(file).then((certificate) => {
                      setAttendees((rows) => rows.map((row, i) => i === index ? { ...row, certificate } : row));
                      setError(null);
                    }).catch((err: Error) => setError(err.message));
                  }} />
                </Button>
                <IconButton aria-label="Remove person" disabled={attendees.length === 1} onClick={() => setAttendees((rows) => rows.filter((_, i) => i !== index))}>
                  <DeleteOutlineRoundedIcon />
                </IconButton>
              </Stack>
            ))}
            <Button variant="text" sx={{ alignSelf: 'flex-start' }} onClick={() => setAttendees((rows) => [...rows, { employeeId: '', result: 'PASS' }])}>
              Add a person
            </Button>
            <Button type="submit" variant="contained" disabled={save.isPending} sx={{ alignSelf: 'flex-start' }}>
              {save.isPending ? 'Saving...' : 'Save the class'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
