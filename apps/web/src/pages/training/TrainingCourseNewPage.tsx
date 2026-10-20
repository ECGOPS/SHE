import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { HEALTH_DUTY, ISO_45001_CLAUSES, isDistrictScope, isRegionalScope, isSafetyOfficer } from '@ecg-she/shared';
import { endpoints } from '../../api/endpoints';
import { useAuthStore } from '../../stores/auth.store';

const CATEGORIES = ['SAFETY', 'CERTIFICATION', 'COMPETENCY', 'INDUCTION', 'REFRESHER'];

function errorMessage(err: unknown): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? (err as Error)?.message ?? 'Request failed';
}

export function TrainingCourseNewPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.session?.user.role);
  const session = useAuthStore((s) => s.session);
  const lockedToRegion = !!role && isSafetyOfficer(role) && (isRegionalScope(role) || isDistrictScope(role));
  const lockedToDistrict = !!role && isSafetyOfficer(role) && isDistrictScope(role);
  const [regionId, setRegionId] = useState(session?.user.regionId ?? '');
  const [districtId, setDistrictId] = useState(session?.user.districtId ?? '');
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('SAFETY');
  const [durationHours, setDurationHours] = useState('8');
  const [validForMonths, setValidForMonths] = useState('12');
  const [authorizesDuty, setAuthorizesDuty] = useState('');
  const [clause, setClause] = useState('');
  const [accreditationBody, setAccreditationBody] = useState('');
  const [trainerQualification, setTrainerQualification] = useState('');
  const [error, setError] = useState<string | null>(null);
  const regions = useQuery({ queryKey: ['regions'], queryFn: endpoints.regions });
  const districts = useQuery({ queryKey: ['districts', regionId], queryFn: () => endpoints.districts(regionId), enabled: !!regionId });

  const save = useMutation({
    mutationFn: () => endpoints.createTrainingCourse({
      code: code.trim(),
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      durationHours: Number(durationHours),
      validForMonths: validForMonths ? Number(validForMonths) : undefined,
      regionId,
      districtId: districtId || undefined,
      authorizesDuty: authorizesDuty || undefined,
      iso45001Clause: clause || undefined,
      accreditationBody: accreditationBody.trim() || undefined,
      trainerQualification: trainerQualification.trim() || undefined,
    }),
    onSuccess: (course) => navigate(`/training/${course.id}`),
    onError: (err) => setError(errorMessage(err)),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  return (
    <Stack spacing={2} component="form" onSubmit={onSubmit}>
      <Typography variant="h5" fontWeight={700}>New course</Typography>
      <Typography variant="body2" color="text.secondary">
        Say which job a pass authorizes. A permit for that job cannot be issued once the pass has expired.
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
            <TextField label="Course code" value={code} onChange={(e) => setCode(e.target.value)} required fullWidth helperText="A short unique code, such as SHE-WAH-01." />
            <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required fullWidth />
            <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline minRows={2} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} required fullWidth>
                {CATEGORIES.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </TextField>
              <TextField select label="Authorizes" value={authorizesDuty} onChange={(e) => setAuthorizesDuty(e.target.value)} fullWidth>
                <MenuItem value="">No job authorization</MenuItem>
                {HEALTH_DUTY.map((item) => <MenuItem key={item} value={item}>{item.replaceAll('_', ' ')}</MenuItem>)}
              </TextField>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField label="Hours" type="number" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} required fullWidth inputProps={{ min: 1, step: 1 }} />
              <TextField label="Valid for (months)" type="number" value={validForMonths} onChange={(e) => setValidForMonths(e.target.value)} fullWidth inputProps={{ min: 1, step: 1 }} helperText="A pass expires after this many months." />
            </Stack>
            <TextField select label="ISO 45001 clause" value={clause} onChange={(e) => setClause(e.target.value)} fullWidth>
              <MenuItem value="">None</MenuItem>
              {ISO_45001_CLAUSES.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
            </TextField>
            <TextField label="Accreditation body" value={accreditationBody} onChange={(e) => setAccreditationBody(e.target.value)} fullWidth />
            <TextField label="Trainer must hold" value={trainerQualification} onChange={(e) => setTrainerQualification(e.target.value)} fullWidth helperText="Shown when the class is recorded." />
            <Button type="submit" variant="contained" disabled={save.isPending} sx={{ alignSelf: 'flex-start' }}>
              {save.isPending ? 'Saving...' : 'Save the course'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
