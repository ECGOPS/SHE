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
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ISOLATION_METHOD, PermitType, isDistrictScope, isRegionalScope, isSafetyOfficer, reportsInChosenPlace } from '@ecg-she/shared';
import { endpoints } from '../../api/endpoints';
import { useAuthStore } from '../../stores/auth.store';
import { SupervisorField } from '../jsa/ChoiceFields';

const WATCH_TYPES = new Set<string>([PermitType.HOT_WORK, PermitType.CONFINED_SPACE]);

function localInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function lines(value: string): string[] {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

function errorMessage(err: unknown): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (err as Error)?.message ??
    'Request failed'
  );
}

export function PtwNewPage() {
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);
  const role = session?.user.role;
  const lockedToRegion = !!role && isSafetyOfficer(role) && (isRegionalScope(role) || isDistrictScope(role));
  const lockedToDistrict = !!role && isSafetyOfficer(role) && isDistrictScope(role);
  const choosesPlace = !!role && reportsInChosenPlace(role);
  const start = new Date();
  const end = new Date(start.getTime() + 8 * 60 * 60 * 1000);
  const [regionId, setRegionId] = useState(session?.user.regionId ?? '');
  const [districtId, setDistrictId] = useState(session?.user.districtId ?? '');
  const [type, setType] = useState<string>(PermitType.ELECTRICAL);
  const [workDescription, setWorkDescription] = useState('');
  const [workLocation, setWorkLocation] = useState('');
  const [validFrom, setValidFrom] = useState(localInput(start));
  const [validTo, setValidTo] = useState(localInput(end));
  const [crewSize, setCrewSize] = useState('');
  const [isolationMethod, setIsolationMethod] = useState('');
  const [isolationReference, setIsolationReference] = useState('');
  const [isolationPoints, setIsolationPoints] = useState('');
  const [hazards, setHazards] = useState('');
  const [controls, setControls] = useState('');
  const [ppe, setPpe] = useState('');
  const [gasTestRequired, setGasTestRequired] = useState(false);
  const [holderId, setHolderId] = useState('');
  const [standbyPersonId, setStandbyPersonId] = useState('');
  const [authorisingManagerId, setAuthorisingManagerId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const watch = WATCH_TYPES.has(type);
  const regions = useQuery({ queryKey: ['regions'], queryFn: endpoints.regions });
  const districts = useQuery({
    queryKey: ['districts', regionId],
    queryFn: () => endpoints.districts(regionId),
    enabled: !!regionId,
  });
  const people = useQuery({ queryKey: ['ptw-people'], queryFn: endpoints.ptwPeople });

  const save = useMutation({
    mutationFn: () =>
      endpoints.createPtw({
        type,
        workDescription: workDescription.trim(),
        workLocation: workLocation.trim(),
        validFrom: new Date(validFrom).toISOString(),
        validTo: new Date(validTo).toISOString(),
        regionId,
        districtId: districtId || undefined,
        crewSize: crewSize ? Number(crewSize) : undefined,
        isolationMethod: isolationMethod || undefined,
        isolationReference: isolationReference.trim() || undefined,
        isolationPoints: lines(isolationPoints),
        hazardsIdentified: lines(hazards),
        controlMeasures: lines(controls),
        ppeRequired: lines(ppe),
        gasTestRequired: watch || gasTestRequired,
        holderId: holderId || undefined,
        standbyPersonId: standbyPersonId || undefined,
        authorisingManagerId: authorisingManagerId || undefined,
      }),
    onSuccess: (created) => {
      const id = (created as { id?: string })?.id;
      navigate(id ? `/ptw/${id}` : '/ptw');
    },
    onError: (err: unknown) => setError(errorMessage(err)),
  });

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5" fontWeight={700}>Raise a permit</Typography>
        <Typography variant="body2" color="text.secondary">
          A permit covers one shift. A safety officer issues it, and the holder accepts it at the work site before work starts.
        </Typography>
      </Box>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField select label="Region" value={regionId} onChange={(e) => { setRegionId(e.target.value); setDistrictId(''); }} required fullWidth disabled={lockedToRegion} helperText={choosesPlace ? 'Choose where this work is. The safety officer for that district receives the permit.' : lockedToRegion ? 'Locked to your assigned region.' : undefined}>
                {(regions.data ?? []).map((region) => <MenuItem key={region.id} value={region.id}>{region.name}</MenuItem>)}
              </TextField>
              <TextField select label="District" value={districtId} onChange={(e) => setDistrictId(e.target.value)} fullWidth required={choosesPlace} disabled={!regionId || lockedToDistrict} helperText={lockedToDistrict ? 'Locked to your assigned district.' : !regionId ? 'Select a region first.' : choosesPlace ? 'The safety officer for this district receives the permit.' : undefined}>
                <MenuItem value="">— select —</MenuItem>
                {(districts.data ?? []).map((district) => <MenuItem key={district.id} value={district.id}>{district.name}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField
              select
              label="Permit type"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                if (WATCH_TYPES.has(e.target.value)) setGasTestRequired(true);
              }}
              required
              fullWidth
            >
              {Object.values(PermitType).map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}
            </TextField>
            <TextField label="Work description" value={workDescription} onChange={(e) => setWorkDescription(e.target.value)} required fullWidth multiline minRows={2} />
            <TextField label="Work location" value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} required fullWidth />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField label="Valid from" type="datetime-local" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} required InputLabelProps={{ shrink: true }} fullWidth />
              <TextField label="Valid to" type="datetime-local" value={validTo} onChange={(e) => setValidTo(e.target.value)} required InputLabelProps={{ shrink: true }} fullWidth helperText="One shift, up to 16 hours." />
            </Stack>
            <TextField label="Crew size" type="number" value={crewSize} onChange={(e) => setCrewSize(e.target.value)} fullWidth />
            <TextField select label="Isolation method" value={isolationMethod} onChange={(e) => setIsolationMethod(e.target.value)} fullWidth helperText="Required for electrical work and isolation.">
              <MenuItem value="">— select —</MenuItem>
              {ISOLATION_METHOD.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}
            </TextField>
            <TextField label="Isolation reference" value={isolationReference} onChange={(e) => setIsolationReference(e.target.value)} fullWidth helperText="Lock-out tag or lockbox number." />
            <TextField label="Isolation points" value={isolationPoints} onChange={(e) => setIsolationPoints(e.target.value)} fullWidth multiline minRows={2} helperText="One disconnect, valve, or lock per line." />
            <TextField label="Hazards" value={hazards} onChange={(e) => setHazards(e.target.value)} required fullWidth multiline minRows={2} helperText="One hazard per line." />
            <TextField label="Precautions" value={controls} onChange={(e) => setControls(e.target.value)} required fullWidth multiline minRows={2} helperText="One control per line." />
            <TextField label="PPE" value={ppe} onChange={(e) => setPpe(e.target.value)} fullWidth multiline minRows={2} helperText="One item per line." />
            <SupervisorField people={people.data ?? []} value={holderId} onChange={setHolderId} label="Permit holder" helperText="This person accepts the permit at the work site." />
            <SupervisorField people={people.data ?? []} value={standbyPersonId} onChange={setStandbyPersonId} label="Standby or fire watch" helperText="Required for hot work and confined space." />
            <SupervisorField people={people.data ?? []} value={authorisingManagerId} onChange={setAuthorisingManagerId} label="Authorising manager" helperText="Required for hot work and confined space, and must not be the person raising the permit." />
            <FormControlLabel
              control={<Checkbox checked={watch || gasTestRequired} disabled={watch} onChange={(e) => setGasTestRequired(e.target.checked)} />}
              label="Gas test required before issue"
            />
          </Stack>
        </CardContent>
      </Card>
      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          disabled={!regionId || (choosesPlace && !districtId) || !workDescription.trim() || !workLocation.trim() || !validFrom || !validTo || !lines(hazards).length || !lines(controls).length || save.isPending}
          onClick={() => save.mutate()}
        >
          Raise permit
        </Button>
        <Button onClick={() => navigate('/ptw')}>Cancel</Button>
      </Stack>
    </Stack>
  );
}
