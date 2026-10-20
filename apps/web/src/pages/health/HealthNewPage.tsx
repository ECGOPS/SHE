import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import {
  EXPOSURE_AGENT,
  FITNESS_OUTCOME,
  HEALTH_DUTY,
  HEALTH_RECORD_TYPE,
  SURVEILLANCE_TEST,
  VACCINE,
  VACCINE_DOSE,
  isDistrictScope,
  isRegionalScope,
  isSafetyOfficer,
} from '@ecg-she/shared';
import { endpoints } from '../../api/endpoints';
import { useAuthStore } from '../../stores/auth.store';
import { SupervisorField } from '../jsa/ChoiceFields';

const UNITS = ['dB(A)', 'mg/m3', 'mSv/year', '°C'];

function errorMessage(err: unknown): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? (err as Error)?.message ?? 'Request failed';
}

function label(value: string): string {
  return value.replaceAll('_', ' ');
}

export function HealthNewPage() {
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);
  const role = session?.user.role;
  const lockedToRegion = !!role && isSafetyOfficer(role) && (isRegionalScope(role) || isDistrictScope(role));
  const lockedToDistrict = !!role && isSafetyOfficer(role) && isDistrictScope(role);
  const [regionId, setRegionId] = useState(session?.user.regionId ?? '');
  const [districtId, setDistrictId] = useState(session?.user.districtId ?? '');
  const [recordType, setRecordType] = useState<(typeof HEALTH_RECORD_TYPE)[number]>('FITNESS_FOR_DUTY');
  const [employeeId, setEmployeeId] = useState('');
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [nextReviewDate, setNextReviewDate] = useState('');
  const [duty, setDuty] = useState('');
  const [fitnessOutcome, setFitnessOutcome] = useState('');
  const [restrictions, setRestrictions] = useState('');
  const [surveillanceTest, setSurveillanceTest] = useState('');
  const [exposureAgent, setExposureAgent] = useState('');
  const [reading, setReading] = useState('');
  const [unit, setUnit] = useState('dB(A)');
  const [locationName, setLocationName] = useState('');
  const [vaccine, setVaccine] = useState('');
  const [vaccineDetail, setVaccineDetail] = useState('');
  const [dose, setDose] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [campaignTitle, setCampaignTitle] = useState('');
  const [attendeeCount, setAttendeeCount] = useState('');
  const [clinician, setClinician] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const regions = useQuery({ queryKey: ['regions'], queryFn: endpoints.regions });
  const districts = useQuery({
    queryKey: ['districts', regionId],
    queryFn: () => endpoints.districts(regionId),
    enabled: !!regionId,
  });
  const people = useQuery({ queryKey: ['health-people'], queryFn: endpoints.healthPeople });
  const needsWorker = recordType !== 'CAMPAIGN' && recordType !== 'EXPOSURE_MONITORING';
  const needsReview = recordType === 'FITNESS_FOR_DUTY' || recordType === 'MEDICAL_SURVEILLANCE' || recordType === 'VACCINATION';

  const save = useMutation({
    mutationFn: () => endpoints.createHealth({
      recordType,
      recordDate,
      regionId,
      districtId: districtId || undefined,
      employeeId: employeeId || undefined,
      nextReviewDate: nextReviewDate || undefined,
      duty: duty || undefined,
      fitnessOutcome: fitnessOutcome || undefined,
      restrictions: restrictions.trim() || undefined,
      surveillanceTest: surveillanceTest || undefined,
      exposureAgent: exposureAgent || undefined,
      exposureReading: reading.trim() ? `${reading.trim()} ${unit}` : undefined,
      locationName: locationName.trim() || undefined,
      vaccine: vaccine || undefined,
      vaccineDetail: vaccineDetail.trim() || undefined,
      dose: dose || undefined,
      batchNumber: batchNumber.trim() || undefined,
      campaignTitle: campaignTitle.trim() || undefined,
      attendeeCount: attendeeCount ? Number(attendeeCount) : undefined,
      clinician: clinician.trim() || undefined,
      clinicalNotes: clinicalNotes.trim() || undefined,
    }),
    onSuccess: (record) => navigate(`/health/${record.id}`),
    onError: (err) => setError(errorMessage(err)),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    save.mutate();
  };

  return (
    <Stack spacing={2} component="form" onSubmit={onSubmit}>
      <Typography variant="h5" fontWeight={700}>New health record</Typography>
      <Typography variant="body2" color="text.secondary">
        The fitness result, the restriction, and the next review date are the certificate. The clinical note stays with the people who record health.
      </Typography>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField select label="Region" value={regionId} onChange={(e) => { setRegionId(e.target.value); setDistrictId(''); }} fullWidth required disabled={lockedToRegion}>
                {(regions.data ?? []).map((region) => <MenuItem key={region.id} value={region.id}>{region.name}</MenuItem>)}
              </TextField>
              <TextField select label="District" value={districtId} onChange={(e) => setDistrictId(e.target.value)} fullWidth disabled={lockedToDistrict || !regionId}>
                <MenuItem value="">Head office</MenuItem>
                {(districts.data ?? []).map((district) => <MenuItem key={district.id} value={district.id}>{district.name}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField select label="Record type" value={recordType} onChange={(e) => setRecordType(e.target.value as (typeof HEALTH_RECORD_TYPE)[number])} required fullWidth>
              {HEALTH_RECORD_TYPE.map((type) => <MenuItem key={type} value={type}>{label(type)}</MenuItem>)}
            </TextField>
            {recordType !== 'CAMPAIGN' && (
              <SupervisorField
                people={people.data ?? []}
                value={employeeId}
                onChange={setEmployeeId}
                label={recordType === 'EXPOSURE_MONITORING' ? 'Worker, if the reading is personal' : 'Worker'}
                helperText={needsWorker ? 'Search by name.' : 'Leave blank for a workplace survey and name the place below.'}
              />
            )}
            <TextField label="Record date" type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} required fullWidth InputLabelProps={{ shrink: true }} />
            {recordType === 'FITNESS_FOR_DUTY' && (
              <>
                <TextField select label="Cleared for" value={duty} onChange={(e) => setDuty(e.target.value)} required fullWidth>
                  {HEALTH_DUTY.map((item) => <MenuItem key={item} value={item}>{label(item)}</MenuItem>)}
                </TextField>
                <TextField select label="Fitness result" value={fitnessOutcome} onChange={(e) => setFitnessOutcome(e.target.value)} required fullWidth>
                  {FITNESS_OUTCOME.map((item) => <MenuItem key={item} value={item}>{label(item)}</MenuItem>)}
                </TextField>
                <TextField label="Restriction the supervisor must follow" value={restrictions} onChange={(e) => setRestrictions(e.target.value)} fullWidth multiline minRows={2} required={fitnessOutcome === 'FIT_WITH_RESTRICTIONS'} />
              </>
            )}
            {recordType === 'MEDICAL_SURVEILLANCE' && (
              <>
                <TextField select label="Test" value={surveillanceTest} onChange={(e) => setSurveillanceTest(e.target.value)} required fullWidth>
                  {SURVEILLANCE_TEST.map((item) => <MenuItem key={item} value={item}>{label(item)}</MenuItem>)}
                </TextField>
                <TextField select label="Fitness result" value={fitnessOutcome} onChange={(e) => setFitnessOutcome(e.target.value)} fullWidth>
                  <MenuItem value="">Not a fitness decision</MenuItem>
                  {FITNESS_OUTCOME.map((item) => <MenuItem key={item} value={item}>{label(item)}</MenuItem>)}
                </TextField>
              </>
            )}
            {recordType === 'EXPOSURE_MONITORING' && (
              <>
                <TextField select label="Exposure agent" value={exposureAgent} onChange={(e) => setExposureAgent(e.target.value)} required fullWidth>
                  {EXPOSURE_AGENT.map((item) => <MenuItem key={item} value={item}>{label(item)}</MenuItem>)}
                </TextField>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField label="Reading" value={reading} onChange={(e) => setReading(e.target.value)} required fullWidth />
                  <TextField select label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} required sx={{ minWidth: 140 }}>
                    {UNITS.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                  </TextField>
                </Stack>
                <TextField label="Workplace" value={locationName} onChange={(e) => setLocationName(e.target.value)} fullWidth helperText="Required when the reading is for a place, such as a substation noise survey." />
              </>
            )}
            {recordType === 'VACCINATION' && (
              <>
                <TextField select label="Vaccine" value={vaccine} onChange={(e) => setVaccine(e.target.value)} required fullWidth>
                  {VACCINE.map((item) => <MenuItem key={item} value={item}>{label(item)}</MenuItem>)}
                </TextField>
                {vaccine === 'OTHER' && (
                  <TextField label="Vaccine name" value={vaccineDetail} onChange={(e) => setVaccineDetail(e.target.value)} required fullWidth />
                )}
                <TextField select label="Dose" value={dose} onChange={(e) => setDose(e.target.value)} required fullWidth>
                  {VACCINE_DOSE.map((item) => <MenuItem key={item} value={item}>{label(item)}</MenuItem>)}
                </TextField>
                <TextField label="Batch" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} required fullWidth />
              </>
            )}
            {recordType === 'CAMPAIGN' && (
              <>
                <TextField label="Campaign" value={campaignTitle} onChange={(e) => setCampaignTitle(e.target.value)} required fullWidth helperText="Blood pressure day, malaria talk, or another group session." />
                <TextField label="Where it was held" value={locationName} onChange={(e) => setLocationName(e.target.value)} required fullWidth />
                <TextField label="People who attended" type="number" value={attendeeCount} onChange={(e) => setAttendeeCount(e.target.value)} fullWidth inputProps={{ min: 0, step: 1 }} />
              </>
            )}
            {needsReview && (
              <TextField label="Next review" type="date" value={nextReviewDate} onChange={(e) => setNextReviewDate(e.target.value)} required fullWidth InputLabelProps={{ shrink: true }} helperText="The register marks the certificate overdue after this date." />
            )}
            <TextField label="Clinician" value={clinician} onChange={(e) => setClinician(e.target.value)} fullWidth />
            <TextField label="Clinical note" value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} fullWidth multiline minRows={3} helperText="Diagnosis and test detail. A supervisor who can only read the register does not see this note." />
            <Button type="submit" variant="contained" disabled={save.isPending} sx={{ alignSelf: 'flex-start' }}>
              {save.isPending ? 'Saving...' : 'Save the record'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
