import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { RISK_LIKELIHOOD, RISK_SEVERITY, isDistrictScope, isRegionalScope, isSafetyOfficer, reportsInChosenPlace } from '@ecg-she/shared';
import { endpoints } from '../../api/endpoints';
import { useAuthStore } from '../../stores/auth.store';
import { offlineQueue } from '../../offline/queue';
import { CrewPersonField, ListedMultiField, ListedTextField, SupervisorField } from './ChoiceFields';
import { PermitField } from './PermitField';
import { JSA_ACTIVITIES, JSA_CONTROLS, JSA_EMERGENCY, JSA_HAZARDS, JSA_PLACES, JSA_PPE, JSA_STEPS, JSA_TOOLS } from './jsa-choices';

interface StepDraft {
  step: string;
  hazard: string;
  control: string;
  likelihood: string;
  severity: string;
}

interface CrewDraft {
  name: string;
  userId: string;
  briefed: boolean;
}

const emptyStep = (): StepDraft => ({ step: '', hazard: '', control: '', likelihood: '', severity: '' });

function errorMessage(err: unknown): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (err as Error)?.message ??
    'Request failed'
  );
}

export function JsaNewPage() {
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);
  const role = session?.user.role;
  const lockedToRegion = !!role && isSafetyOfficer(role) && (isRegionalScope(role) || isDistrictScope(role));
  const lockedToDistrict = !!role && isSafetyOfficer(role) && isDistrictScope(role);
  const choosesPlace = !!role && reportsInChosenPlace(role);
  const [regionId, setRegionId] = useState(session?.user.regionId ?? '');
  const [districtId, setDistrictId] = useState(session?.user.districtId ?? '');
  const [workActivity, setWorkActivity] = useState('');
  const [jobLocation, setJobLocation] = useState('');
  const [jobDate, setJobDate] = useState(new Date().toISOString().slice(0, 10));
  const [supervisorId, setSupervisorId] = useState('');
  const [ppe, setPpe] = useState<string[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [emergency, setEmergency] = useState('');
  const [permitRequired, setPermitRequired] = useState(false);
  const [permitId, setPermitId] = useState('');
  const [steps, setSteps] = useState<StepDraft[]>([emptyStep()]);
  const [crew, setCrew] = useState<CrewDraft[]>([{ name: '', userId: '', briefed: false }]);
  const [error, setError] = useState<string | null>(null);

  const regions = useQuery({ queryKey: ['regions'], queryFn: endpoints.regions });
  const districts = useQuery({
    queryKey: ['districts', regionId],
    queryFn: () => endpoints.districts(regionId),
    enabled: !!regionId,
  });
  const people = useQuery({ queryKey: ['jsa-people'], queryFn: endpoints.jsaPeople });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        workActivity: workActivity.trim(),
        jobLocation: jobLocation.trim(),
        jobDate,
        regionId,
        districtId: districtId || undefined,
        supervisorId: supervisorId || undefined,
        crewSize: crew.filter((person) => person.name.trim()).length || undefined,
        ppeRequired: ppe,
        toolsAndEquipment: tools,
        emergencyProcedures: emergency.trim() || undefined,
        permitRequired,
        permitId: permitRequired && permitId ? permitId : undefined,
        steps: steps
          .filter((step) => step.step.trim() && step.hazard.trim() && step.control.trim())
          .map((step) => ({
            step: step.step.trim(),
            hazards: step.hazard.trim() ? [step.hazard.trim()] : [],
            controls: step.control.trim() ? [step.control.trim()] : [],
            likelihood: step.likelihood || undefined,
            severity: step.severity || undefined,
          })),
        crew: crew
          .filter((person) => person.name.trim())
          .map((person) => ({
            name: person.name.trim(),
            userId: person.userId || undefined,
            acknowledgedAt: person.briefed ? new Date().toISOString() : undefined,
          })),
        offlineClientId: crypto.randomUUID(),
      };
      if (!navigator.onLine) {
        await offlineQueue.enqueue({ kind: 'jsa', payload });
        return { offline: true as const };
      }
      try {
        return await endpoints.createJsa(payload);
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (!status) {
          await offlineQueue.enqueue({ kind: 'jsa', payload });
          return { offline: true as const };
        }
        throw err;
      }
    },
    onSuccess: (created) => {
      if (created && 'offline' in created) {
        navigate('/jsa');
        return;
      }
      const id = (created as { id?: string })?.id;
      navigate(id ? `/jsa/${id}` : '/jsa');
    },
    onError: (err: unknown) => setError(errorMessage(err)),
  });

  const readySteps = steps.filter((step) => step.step.trim() && step.hazard.trim() && step.control.trim());

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5" fontWeight={700}>New job briefing</Typography>
        <Typography variant="body2" color="text.secondary">
          Break the job into steps. Each step needs the hazard and the control. The crew acknowledges it before a safety officer accepts it.
        </Typography>
      </Box>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {!navigator.onLine && <Alert severity="info">You are offline. This briefing will be sent when the device is back online.</Alert>}

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField select label="Region" value={regionId} onChange={(e) => { setRegionId(e.target.value); setDistrictId(''); }} required fullWidth disabled={lockedToRegion} helperText={choosesPlace ? 'Choose where this job is. The safety officer for that district receives the briefing.' : lockedToRegion ? 'Locked to your assigned region.' : undefined}>
                {(regions.data ?? []).map((region) => <MenuItem key={region.id} value={region.id}>{region.name}</MenuItem>)}
              </TextField>
              <TextField select label="District" value={districtId} onChange={(e) => setDistrictId(e.target.value)} fullWidth required={choosesPlace} disabled={!regionId || lockedToDistrict} helperText={lockedToDistrict ? 'Locked to your assigned district.' : !regionId ? 'Select a region first.' : choosesPlace ? 'The safety officer for this district receives the briefing.' : undefined}>
                <MenuItem value="">— select —</MenuItem>
                {(districts.data ?? []).map((district) => <MenuItem key={district.id} value={district.id}>{district.name}</MenuItem>)}
              </TextField>
            </Stack>
            <ListedTextField label="Work activity" value={workActivity} options={JSA_ACTIVITIES} onChange={setWorkActivity} required helperText="The job for this shift. Use Other to name the feeder or the asset." />
            <ListedTextField label="Job location" value={jobLocation} options={JSA_PLACES} onChange={setJobLocation} required helperText="Use Other to type the feeder, pole, or address." />
            <TextField label="Job date" type="date" value={jobDate} onChange={(e) => setJobDate(e.target.value)} required InputLabelProps={{ shrink: true }} fullWidth />
            <SupervisorField people={people.data ?? []} value={supervisorId} onChange={setSupervisorId} helperText="Required before the briefing can be submitted." />
            <ListedMultiField label="Required PPE" value={ppe} options={JSA_PPE} onChange={setPpe} />
            <ListedMultiField label="Tools and equipment" value={tools} options={JSA_TOOLS} onChange={setTools} />
            <ListedTextField label="Emergency procedures" value={emergency} options={JSA_EMERGENCY} onChange={setEmergency} helperText="Rescue plan, escape route, and who to call. Use Other to type the local plan." />
            <FormControlLabel
              control={<Checkbox checked={permitRequired} onChange={(e) => setPermitRequired(e.target.checked)} />}
              label="This job needs a permit (isolation, hot work, confined space, height, or excavation)"
            />
            {permitRequired && (
              <PermitField value={permitId} onChange={setPermitId} regionId={regionId} />
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700}>Steps</Typography>
          <Stack spacing={2} mt={1}>
            {steps.map((step, index) => (
              <Stack key={index} spacing={1} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2">Step {index + 1}</Typography>
                  <IconButton aria-label="Remove step" disabled={steps.length === 1} onClick={() => setSteps(steps.filter((_, i) => i !== index))}>
                    <DeleteOutlineRoundedIcon />
                  </IconButton>
                </Stack>
                <ListedTextField label="What will be done" value={step.step} options={JSA_STEPS} onChange={(next) => updateStep(index, { step: next })} required />
                <ListedTextField label="Hazard" value={step.hazard} options={JSA_HAZARDS} onChange={(next) => updateStep(index, { hazard: next })} required />
                <ListedTextField label="Control" value={step.control} options={JSA_CONTROLS} onChange={(next) => updateStep(index, { control: next })} required helperText="The action that keeps this hazard from hurting the crew. Use Other to type a control that is not listed." />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField select label="Likelihood" value={step.likelihood} onChange={(e) => updateStep(index, { likelihood: e.target.value })} fullWidth>
                    <MenuItem value="">— optional —</MenuItem>
                    {RISK_LIKELIHOOD.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}
                  </TextField>
                  <TextField select label="Severity" value={step.severity} onChange={(e) => updateStep(index, { severity: e.target.value })} fullWidth>
                    <MenuItem value="">— optional —</MenuItem>
                    {RISK_SEVERITY.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}
                  </TextField>
                </Stack>
              </Stack>
            ))}
            <Button startIcon={<AddRoundedIcon />} onClick={() => setSteps([...steps, emptyStep()])}>Add step</Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700}>Crew</Typography>
          <Typography variant="body2" color="text.secondary">Tick Briefed as each person hears the controls.</Typography>
          <Stack spacing={1} mt={1}>
            {crew.map((person, index) => (
              <Stack key={index} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                <CrewPersonField
                  people={people.data ?? []}
                  userId={person.userId}
                  name={person.name}
                  onChange={(next) => updateCrew(index, next)}
                />
                <FormControlLabel control={<Checkbox checked={person.briefed} onChange={(e) => updateCrew(index, { briefed: e.target.checked })} />} label="Briefed" />
                <IconButton aria-label="Remove person" disabled={crew.length === 1} onClick={() => setCrew(crew.filter((_, i) => i !== index))}>
                  <DeleteOutlineRoundedIcon />
                </IconButton>
              </Stack>
            ))}
            <Button startIcon={<AddRoundedIcon />} onClick={() => setCrew([...crew, { name: '', userId: '', briefed: false }])}>Add person</Button>
          </Stack>
        </CardContent>
      </Card>

      <Stack direction="row" spacing={1}>
        <Button variant="contained" disabled={!regionId || (choosesPlace && !districtId) || !workActivity.trim() || !jobLocation.trim() || !jobDate || readySteps.length === 0 || save.isPending} onClick={() => save.mutate()}>
          Save briefing
        </Button>
        <Button onClick={() => navigate('/jsa')}>Cancel</Button>
      </Stack>
    </Stack>
  );

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setSteps(steps.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  }
  function updateCrew(index: number, patch: Partial<CrewDraft>) {
    setCrew(crew.map((person, i) => (i === index ? { ...person, ...patch } : person)));
  }
}

