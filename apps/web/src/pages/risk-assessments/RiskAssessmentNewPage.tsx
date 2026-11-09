import { FormEvent, useMemo, useState } from 'react';
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
  FormGroup,
  Grid2 as Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import {
  CONTROL_HIERARCHY,
  RISK_ASSESSMENT_CONTROL_STATUS,
  RISK_ASSESSMENT_HAZARD_GROUPS,
  RISK_ASSESSMENT_PERSON_LABEL,
  RISK_ASSESSMENT_PERSONS_AT_RISK,
  RISK_LIKELIHOOD,
  RISK_SEVERITY,
  isDistrictScope,
  isRegionalScope,
  isSafetyOfficer,
  reportsInChosenPlace,
} from '@ecg-she/shared';
import { endpoints } from '../../api/endpoints';
import { useAuthStore } from '../../stores/auth.store';
import { offlineQueue } from '../../offline/queue';
import { useFormDraft } from '../../offline/useFormDraft';
import { useOnline } from '../../offline/useOnline';
import { FormDraftBanner } from '../../components/FormDraftBanner';

interface ControlRow {
  identifiedHazard: string;
  consequence: string;
  likelihood: string;
  controlHierarchy: string;
  requiredControls: string;
  implemented: boolean;
  residualLikelihood: string;
  residualSeverity: string;
}

const emptyRow = (): ControlRow => ({
  identifiedHazard: '',
  consequence: '',
  likelihood: '',
  controlHierarchy: '',
  requiredControls: '',
  implemented: false,
  residualLikelihood: '',
  residualSeverity: '',
});

function errorMessage(err: unknown): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? (err as Error)?.message ?? 'Request failed';
}

function label(value: string): string {
  return value.replaceAll('_', ' ');
}

export function RiskAssessmentNewPage() {
  const navigate = useNavigate();
  const online = useOnline();
  const session = useAuthStore((s) => s.session);
  const role = session?.user.role;
  const lockedToRegion = !!role && isSafetyOfficer(role) && (isRegionalScope(role) || isDistrictScope(role));
  const lockedToDistrict = !!role && isSafetyOfficer(role) && isDistrictScope(role);
  const choosesPlace = !!role && reportsInChosenPlace(role);

  const [regionId, setRegionId] = useState(session?.user.regionId ?? '');
  const [districtId, setDistrictId] = useState(session?.user.districtId ?? '');
  const [locationWorkplace, setLocationWorkplace] = useState('');
  const [assessmentDate, setAssessmentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [activityBeingDone, setActivityBeingDone] = useState('');
  const [assessorNames, setAssessorNames] = useState(session?.user.fullName ?? '');
  const [othersConsulted, setOthersConsulted] = useState('');
  const [selectedHazards, setSelectedHazards] = useState<string[]>([]);
  const [specificCircumstance, setSpecificCircumstance] = useState('');
  const [personsAtRisk, setPersonsAtRisk] = useState<string[]>([]);
  const [controls, setControls] = useState<ControlRow[]>([emptyRow()]);
  const [controlConclusion, setControlConclusion] = useState('');
  const [error, setError] = useState<string | null>(null);

  const draftValue = useMemo(
    () => ({
      regionId,
      districtId,
      locationWorkplace,
      assessmentDate,
      activityBeingDone,
      assessorNames,
      othersConsulted,
      selectedHazards,
      specificCircumstance,
      personsAtRisk,
      controls,
      controlConclusion,
    }),
    [
      regionId,
      districtId,
      locationWorkplace,
      assessmentDate,
      activityBeingDone,
      assessorNames,
      othersConsulted,
      selectedHazards,
      specificCircumstance,
      personsAtRisk,
      controls,
      controlConclusion,
    ],
  );

  const { hasDraft, restoredAt, savedAt, discard, clear } = useFormDraft({
    formKey: 'risk-assessment-new',
    userId: session?.user.id,
    value: draftValue,
    restore: (data) => {
      if (typeof data.regionId === 'string') setRegionId(data.regionId);
      if (typeof data.districtId === 'string') setDistrictId(data.districtId);
      if (typeof data.locationWorkplace === 'string') setLocationWorkplace(data.locationWorkplace);
      if (typeof data.assessmentDate === 'string') setAssessmentDate(data.assessmentDate);
      if (typeof data.activityBeingDone === 'string') setActivityBeingDone(data.activityBeingDone);
      if (typeof data.assessorNames === 'string') setAssessorNames(data.assessorNames);
      if (typeof data.othersConsulted === 'string') setOthersConsulted(data.othersConsulted);
      if (Array.isArray(data.selectedHazards)) setSelectedHazards(data.selectedHazards);
      if (typeof data.specificCircumstance === 'string') setSpecificCircumstance(data.specificCircumstance);
      if (Array.isArray(data.personsAtRisk)) setPersonsAtRisk(data.personsAtRisk);
      if (Array.isArray(data.controls) && data.controls.length) setControls(data.controls);
      if (typeof data.controlConclusion === 'string') setControlConclusion(data.controlConclusion);
    },
  });

  const regions = useQuery({ queryKey: ['regions'], queryFn: endpoints.regions });
  const districts = useQuery({
    queryKey: ['districts', regionId],
    queryFn: () => endpoints.districts(regionId),
    enabled: !!regionId,
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        locationWorkplace: locationWorkplace.trim(),
        activityBeingDone: activityBeingDone.trim(),
        assessmentDate,
        assessorNames: assessorNames.trim(),
        othersConsulted: othersConsulted.trim() || undefined,
        regionId,
        districtId: districtId || undefined,
        selectedHazards,
        specificCircumstance: specificCircumstance.trim() || undefined,
        personsAtRisk,
        controls: controls
          .filter((row) => row.identifiedHazard.trim())
          .map((row) => ({
            identifiedHazard: row.identifiedHazard.trim(),
            consequence: row.consequence || undefined,
            likelihood: row.likelihood || undefined,
            controlHierarchy: row.controlHierarchy || undefined,
            requiredControls: row.requiredControls.trim() || undefined,
            implemented: row.implemented,
            residualLikelihood: row.residualLikelihood || undefined,
            residualSeverity: row.residualSeverity || undefined,
          })),
        controlConclusion: controlConclusion || undefined,
        offlineClientId: crypto.randomUUID(),
      };
      if (!navigator.onLine) {
        await offlineQueue.enqueue({ kind: 'risk-assessment', payload });
        return { offline: true as const };
      }
      try {
        return await endpoints.createRiskAssessment(payload);
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (!status) {
          await offlineQueue.enqueue({ kind: 'risk-assessment', payload });
          return { offline: true as const };
        }
        throw err;
      }
    },
    onSuccess: async (created) => {
      await clear();
      if (created && 'offline' in created) {
        navigate('/risk-assessments');
        return;
      }
      const id = (created as { id?: string })?.id;
      navigate(id ? `/risk-assessments/${id}` : '/risk-assessments');
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const toggleHazard = (id: string) => {
    setSelectedHazards((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const togglePerson = (id: string) => {
    setPersonsAtRisk((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!locationWorkplace.trim() || !activityBeingDone.trim() || !assessorNames.trim()) {
      setError('Location, activity, and assessor name are required');
      return;
    }
    if (!regionId || (choosesPlace && !districtId)) {
      setError('Choose the region and district where this work is');
      return;
    }
    if (!selectedHazards.length) {
      setError('Tick at least one hazard');
      return;
    }
    if (!personsAtRisk.length) {
      setError('Select who is at risk');
      return;
    }
    if (
      !controls.some(
        (row) =>
          row.identifiedHazard.trim() &&
          row.consequence &&
          row.likelihood &&
          row.controlHierarchy &&
          row.requiredControls.trim(),
      )
    ) {
      setError(
        'Add at least one control row with hazard, consequence, likelihood, hierarchy of control, and required controls',
      );
      return;
    }
    if (!controlConclusion) {
      setError('Record whether the risk is adequately controlled');
      return;
    }
    save.mutate();
  };

  return (
    <Stack spacing={2} component="form" onSubmit={onSubmit}>
      <Box>
        <Typography variant="h5" fontWeight={700}>
          Risk Assessment Form
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Hazard identification to people, property or the environment. Tick the applicable hazards, rate each
          exposure, and record the controls.
        </Typography>
      </Box>

      <FormDraftBanner
        hasDraft={hasDraft}
        restoredAt={restoredAt}
        savedAt={savedAt}
        noun="risk assessment"
        onDiscard={() => {
          setRegionId(session?.user.regionId ?? '');
          setDistrictId(session?.user.districtId ?? '');
          setLocationWorkplace('');
          setAssessmentDate(new Date().toISOString().slice(0, 10));
          setActivityBeingDone('');
          setAssessorNames(session?.user.fullName ?? '');
          setOthersConsulted('');
          setSelectedHazards([]);
          setSpecificCircumstance('');
          setPersonsAtRisk([]);
          setControls([emptyRow()]);
          setControlConclusion('');
          void discard();
        }}
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {!online && (
        <Alert severity="info">
          You are offline. This assessment will be sent when the device is back online.
        </Alert>
      )}

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="subtitle2" fontWeight={700}>
              Assessment details
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  select
                  label="Region"
                  value={regionId}
                  onChange={(e) => {
                    setRegionId(e.target.value);
                    setDistrictId('');
                  }}
                  required
                  fullWidth
                  disabled={lockedToRegion}
                  helperText={
                    choosesPlace
                      ? 'Choose where this work is. The safety officer for that district receives it.'
                      : lockedToRegion
                        ? 'Locked to your assigned region.'
                        : undefined
                  }
                >
                  {(regions.data ?? []).map((r) => (
                    <MenuItem key={r.id} value={r.id}>
                      {r.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  select
                  label="District"
                  value={districtId}
                  onChange={(e) => setDistrictId(e.target.value)}
                  fullWidth
                  required={choosesPlace}
                  disabled={!regionId || lockedToDistrict}
                  helperText={
                    lockedToDistrict
                      ? 'Locked to your assigned district.'
                      : !regionId
                        ? 'Select a region first.'
                        : choosesPlace
                          ? 'The safety officer for this district receives the assessment.'
                          : undefined
                  }
                >
                  {(districts.data ?? []).map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Location / Workplace"
                  value={locationWorkplace}
                  onChange={(e) => setLocationWorkplace(e.target.value)}
                  required
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Assessment date"
                  type="date"
                  value={assessmentDate}
                  onChange={(e) => setAssessmentDate(e.target.value)}
                  required
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Assessor(s) name"
                  value={assessorNames}
                  onChange={(e) => setAssessorNames(e.target.value)}
                  required
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Activity being done"
                  value={activityBeingDone}
                  onChange={(e) => setActivityBeingDone(e.target.value)}
                  required
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Others consulted"
                  value={othersConsulted}
                  onChange={(e) => setOthersConsulted(e.target.value)}
                  fullWidth
                />
              </Grid>
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>
                Hazard identification
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tick (✓) the applicable hazards to people, property or the environment.
              </Typography>
            </Box>
            {RISK_ASSESSMENT_HAZARD_GROUPS.map((group) => (
              <Box key={group.id}>
                <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
                  {group.label}
                </Typography>
                <FormGroup>
                  <Grid container spacing={0.5}>
                    {group.items.map((item) => (
                      <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={selectedHazards.includes(item.id)}
                              onChange={() => toggleHazard(item.id)}
                              size="small"
                            />
                          }
                          label={<Typography variant="body2">{item.label}</Typography>}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </FormGroup>
              </Box>
            ))}
            <TextField
              label="Any specific circumstance (describe)"
              value={specificCircumstance}
              onChange={(e) => setSpecificCircumstance(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="subtitle2" fontWeight={700}>
              Persons at risk
            </Typography>
            <FormGroup>
              <Grid container spacing={0.5}>
                {RISK_ASSESSMENT_PERSONS_AT_RISK.map((id) => (
                  <Grid key={id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={personsAtRisk.includes(id)}
                          onChange={() => togglePerson(id)}
                          size="small"
                        />
                      }
                      label={<Typography variant="body2">{RISK_ASSESSMENT_PERSON_LABEL[id]}</Typography>}
                    />
                  </Grid>
                ))}
              </Grid>
            </FormGroup>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>
                Risk assessment and risk controls
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Use the ISO 45001 / NIOSH hierarchy: Elimination → Substitution → Engineering →
                Administrative → PPE.
              </Typography>
            </Box>
            {controls.map((row, index) => (
              <Stack
                key={index}
                spacing={1.5}
                sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" fontWeight={700}>
                    Hazard / exposure {index + 1}
                  </Typography>
                  <IconButton
                    aria-label="Remove row"
                    size="small"
                    disabled={controls.length === 1}
                    onClick={() => setControls((current) => current.filter((_, i) => i !== index))}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <TextField
                  label="Identified hazards / exposure"
                  value={row.identifiedHazard}
                  onChange={(e) =>
                    setControls((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, identifiedHazard: e.target.value } : item,
                      ),
                    )
                  }
                  fullWidth
                  required
                />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      select
                      label="Consequences"
                      value={row.consequence}
                      onChange={(e) =>
                        setControls((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, consequence: e.target.value } : item,
                          ),
                        )
                      }
                      fullWidth
                      required
                    >
                      {RISK_SEVERITY.map((value) => (
                        <MenuItem key={value} value={value}>
                          {label(value)}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      select
                      label="Likelihood"
                      value={row.likelihood}
                      onChange={(e) =>
                        setControls((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, likelihood: e.target.value } : item,
                          ),
                        )
                      }
                      fullWidth
                      required
                    >
                      {RISK_LIKELIHOOD.map((value) => (
                        <MenuItem key={value} value={value}>
                          {label(value)}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      select
                      label="Control type"
                      value={row.controlHierarchy}
                      onChange={(e) =>
                        setControls((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, controlHierarchy: e.target.value } : item,
                          ),
                        )
                      }
                      fullWidth
                      required
                    >
                      {CONTROL_HIERARCHY.map((value) => (
                        <MenuItem key={value} value={value}>
                          {label(value)}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                </Grid>
                <TextField
                  label="Required controls"
                  value={row.requiredControls}
                  onChange={(e) =>
                    setControls((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, requiredControls: e.target.value } : item,
                      ),
                    )
                  }
                  fullWidth
                  required
                  multiline
                  minRows={2}
                />
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      select
                      label="Residual likelihood"
                      value={row.residualLikelihood}
                      onChange={(e) =>
                        setControls((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, residualLikelihood: e.target.value } : item,
                          ),
                        )
                      }
                      fullWidth
                    >
                      <MenuItem value="">— select —</MenuItem>
                      {RISK_LIKELIHOOD.map((value) => (
                        <MenuItem key={value} value={value}>
                          {label(value)}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      select
                      label="Residual severity"
                      value={row.residualSeverity}
                      onChange={(e) =>
                        setControls((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, residualSeverity: e.target.value } : item,
                          ),
                        )
                      }
                      fullWidth
                    >
                      <MenuItem value="">— select —</MenuItem>
                      {RISK_SEVERITY.map((value) => (
                        <MenuItem key={value} value={value}>
                          {label(value)}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FormControlLabel
                      sx={{ mt: 1 }}
                      control={
                        <Checkbox
                          checked={row.implemented}
                          onChange={(_, checked) =>
                            setControls((current) =>
                              current.map((item, i) =>
                                i === index ? { ...item, implemented: checked } : item,
                              ),
                            )
                          }
                        />
                      }
                      label="Controls implemented"
                    />
                  </Grid>
                </Grid>
              </Stack>
            ))}
            <Button
              startIcon={<AddRoundedIcon />}
              onClick={() => setControls((current) => [...current, emptyRow()])}
              sx={{ alignSelf: 'flex-start' }}
            >
              Add hazard / exposure
            </Button>
            <TextField
              select
              label="Is the risk"
              value={controlConclusion}
              onChange={(e) => setControlConclusion(e.target.value)}
              required
              fullWidth
            >
              {RISK_ASSESSMENT_CONTROL_STATUS.map((value) => (
                <MenuItem key={value} value={value}>
                  {value === 'ADEQUATELY_CONTROLLED'
                    ? 'Adequately controlled. No further action required'
                    : 'Inadequately controlled. Further action / investigation required'}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={2} justifyContent="flex-end">
        <Button onClick={() => navigate('/risk-assessments')}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save assessment'}
        </Button>
      </Stack>
    </Stack>
  );
}
