import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { isDistrictScope, isRegionalScope, isSafetyOfficer } from '@ecg-she/shared';
import { endpoints } from '../../api/endpoints';
import { useAuthStore } from '../../stores/auth.store';
import { SupervisorField } from '../jsa/ChoiceFields';

function errorMessage(err: unknown): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? (err as Error)?.message ?? 'Request failed';
}

export function CapaNewPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.session?.user.role);
  const session = useAuthStore((s) => s.session);
  const lockedToRegion = !!role && isSafetyOfficer(role) && (isRegionalScope(role) || isDistrictScope(role));
  const lockedToDistrict = !!role && isSafetyOfficer(role) && isDistrictScope(role);
  const [regionId, setRegionId] = useState(session?.user.regionId ?? '');
  const [districtId, setDistrictId] = useState(session?.user.districtId ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [actionType, setActionType] = useState('CORRECTIVE_ACTION');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const regions = useQuery({ queryKey: ['regions'], queryFn: endpoints.regions });
  const districts = useQuery({ queryKey: ['districts', regionId], queryFn: () => endpoints.districts(regionId), enabled: !!regionId });
  const people = useQuery({ queryKey: ['capa-people'], queryFn: endpoints.capaPeople });

  const save = useMutation({
    mutationFn: () => endpoints.createCapa({
      title: title.trim(),
      description: description.trim(),
      actionType,
      priority,
      dueDate,
      assigneeId: assigneeId || undefined,
      regionId,
      districtId: districtId || undefined,
      sourceType: 'INTERNAL_REVIEW',
    }),
    onSuccess: (row) => navigate(`/capa/${row.id}`),
    onError: (err) => setError(errorMessage(err)),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  return (
    <Stack spacing={2} component="form" onSubmit={onSubmit}>
      <Typography variant="h5" fontWeight={700}>New action</Typography>
      <Typography variant="body2" color="text.secondary">
        Use this for an action from a management review. An action from an incident, hazard, near-miss, inspection, audit, or environmental event is raised on that record.
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
            <TextField label="Action" value={title} onChange={(e) => setTitle(e.target.value)} required fullWidth />
            <TextField label="What must change" value={description} onChange={(e) => setDescription(e.target.value)} required multiline minRows={3} fullWidth />
            <TextField select label="Type" value={actionType} onChange={(e) => setActionType(e.target.value)} fullWidth>
              <MenuItem value="CORRECTION">Correction — fix what was found</MenuItem>
              <MenuItem value="CORRECTIVE_ACTION">Corrective action — remove the cause</MenuItem>
              <MenuItem value="PREVENTIVE_ACTION">Preventive action — stop it happening elsewhere</MenuItem>
            </TextField>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} fullWidth>
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </TextField>
              <TextField label="Due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required fullWidth InputLabelProps={{ shrink: true }} />
            </Stack>
            <SupervisorField label="Owner" people={people.data ?? []} value={assigneeId} onChange={setAssigneeId} helperText="The owner does the work. A different officer checks it." />
            <Button type="submit" variant="contained" disabled={save.isPending}>Save action</Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
