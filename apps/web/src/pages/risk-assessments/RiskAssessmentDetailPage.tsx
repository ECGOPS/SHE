import { FormEvent, useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
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
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import {
  CONTROL_HIERARCHY,
  Permission,
  RISK_ASSESSMENT_CONTROL_STATUS,
  RISK_ASSESSMENT_HAZARD_GROUPS,
  RISK_ASSESSMENT_PERSON_LABEL,
  RISK_ASSESSMENT_PERSONS_AT_RISK,
  RISK_LIKELIHOOD,
  RISK_SEVERITY,
} from '@ecg-she/shared';
import { endpoints } from '../../api/endpoints';
import { ExportReportButton } from '../../components/ExportReportButton';
import {
  CASE_FILE_CARD_SX,
  CaseFileHeader,
  CaseFileSkeleton,
  formatDay,
  placeName,
  titleCase,
} from '../../components/case-file';
import { useAuthStore } from '../../stores/auth.store';

interface ControlRow {
  identifiedHazard: string;
  consequence: string;
  likelihood: string;
  riskScore?: number | null;
  riskClass?: string | null;
  controlHierarchy: string;
  requiredControls: string;
  implemented: boolean;
  residualLikelihood: string;
  residualSeverity: string;
  residualRiskScore?: number | null;
  residualRiskClass?: string | null;
}

interface RiskAssessmentRecord {
  id: string;
  referenceCode: string;
  status: string;
  locationWorkplace: string;
  activityBeingDone: string;
  assessmentDate?: string | null;
  assessorNames: string;
  othersConsulted?: string | null;
  selectedHazards?: string[] | null;
  specificCircumstance?: string | null;
  personsAtRisk?: string[] | null;
  controls?: ControlRow[] | null;
  controlConclusion?: string | null;
  rejectionNotes?: string | null;
  regionId?: string | null;
  districtId?: string | null;
  region?: { id?: string; name?: string };
  district?: { id?: string; name?: string } | null;
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

const HAZARD_LABEL = Object.fromEntries(
  RISK_ASSESSMENT_HAZARD_GROUPS.flatMap((group) => group.items.map((item) => [item.id, item.label])),
);

const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
};

function errorMessage(err: unknown): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? (err as Error)?.message ?? 'Request failed';
}

function dateInput(value?: string | null): string {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function label(value: string): string {
  return value.replaceAll('_', ' ');
}

export function RiskAssessmentDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const permissions = useAuthStore((s) => s.session?.user.permissions ?? []);
  const canWrite = permissions.includes(Permission.RISK_ASSESSMENT_CREATE);
  const canApprove = permissions.includes(Permission.RISK_ASSESSMENT_APPROVE);
  const canCreateCapa = permissions.includes(Permission.CAPA_CREATE);
  const canReadCapa = permissions.includes(Permission.CAPA_READ);
  const [error, setError] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [actionTitle, setActionTitle] = useState('');
  const [actionDescription, setActionDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  const [locationWorkplace, setLocationWorkplace] = useState('');
  const [activityBeingDone, setActivityBeingDone] = useState('');
  const [assessmentDate, setAssessmentDate] = useState('');
  const [assessorNames, setAssessorNames] = useState('');
  const [othersConsulted, setOthersConsulted] = useState('');
  const [selectedHazards, setSelectedHazards] = useState<string[]>([]);
  const [specificCircumstance, setSpecificCircumstance] = useState('');
  const [personsAtRisk, setPersonsAtRisk] = useState<string[]>([]);
  const [controls, setControls] = useState<ControlRow[]>([emptyRow()]);
  const [controlConclusion, setControlConclusion] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['risk-assessment', id],
    queryFn: () => endpoints.riskAssessmentOne(id!) as unknown as Promise<RiskAssessmentRecord>,
    enabled: !!id,
  });
  const capas = useQuery({
    queryKey: ['risk-assessment-capa', id],
    queryFn: () => endpoints.capa({ sourceType: 'RISK_ASSESSMENT', sourceId: id!, pageSize: 50 }),
    enabled: !!id && canReadCapa,
  });

  const seed = data
    ? [
        data.id,
        data.status,
        data.locationWorkplace,
        data.activityBeingDone,
        data.assessmentDate,
        data.assessorNames,
        data.othersConsulted,
        data.controlConclusion,
        data.specificCircumstance,
        JSON.stringify(data.selectedHazards ?? []),
        JSON.stringify(data.personsAtRisk ?? []),
        JSON.stringify(data.controls ?? []),
      ].join('|')
    : '';

  useEffect(() => {
    if (!data) return;
    setLocationWorkplace(data.locationWorkplace ?? '');
    setActivityBeingDone(data.activityBeingDone ?? '');
    setAssessmentDate(dateInput(data.assessmentDate));
    setAssessorNames(data.assessorNames ?? '');
    setOthersConsulted(data.othersConsulted ?? '');
    setSelectedHazards(data.selectedHazards ?? []);
    setSpecificCircumstance(data.specificCircumstance ?? '');
    setPersonsAtRisk(data.personsAtRisk ?? []);
    const next = (data.controls ?? []).map((row) => ({
      identifiedHazard: row.identifiedHazard ?? '',
      consequence: row.consequence ?? '',
      likelihood: row.likelihood ?? '',
      riskScore: row.riskScore,
      riskClass: row.riskClass,
      controlHierarchy: row.controlHierarchy ?? '',
      requiredControls: row.requiredControls ?? '',
      implemented: !!row.implemented,
      residualLikelihood: row.residualLikelihood ?? '',
      residualSeverity: row.residualSeverity ?? '',
      residualRiskScore: row.residualRiskScore,
      residualRiskClass: row.residualRiskClass,
    }));
    setControls(next.length ? next : [emptyRow()]);
    setControlConclusion(data.controlConclusion ?? '');
  }, [data, seed]);

  if (isLoading || !data) return <CaseFileSkeleton />;

  const editable = canWrite && (data.status === 'DRAFT' || data.status === 'REJECTED');
  const inadequatelyControlled = (controlConclusion || data.controlConclusion) === 'INADEQUATELY_CONTROLLED';
  const capaCount = capas.data?.items?.length ?? 0;
  const readyControls = controls.filter(
    (row) =>
      row.identifiedHazard.trim() &&
      row.consequence &&
      row.likelihood &&
      row.controlHierarchy &&
      row.requiredControls.trim(),
  );

  const refresh = async () => {
    setError(null);
    await qc.invalidateQueries({ queryKey: ['risk-assessment', id] });
    await qc.invalidateQueries({ queryKey: ['risk-assessments'] });
    await qc.invalidateQueries({ queryKey: ['risk-assessment-capa', id] });
    await qc.invalidateQueries({ queryKey: ['console'] });
  };
  const run = (fn: () => Promise<unknown>) =>
    fn()
      .then(refresh)
      .catch((err: unknown) => setError(errorMessage(err)));

  const patch = () => ({
    locationWorkplace: locationWorkplace.trim(),
    activityBeingDone: activityBeingDone.trim(),
    assessmentDate,
    assessorNames: assessorNames.trim(),
    othersConsulted: othersConsulted.trim() || undefined,
    selectedHazards,
    specificCircumstance: specificCircumstance.trim() || undefined,
    personsAtRisk,
    controls: readyControls.map((row) => ({
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
  });

  const toggleHazard = (hazardId: string) => {
    setSelectedHazards((current) =>
      current.includes(hazardId) ? current.filter((item) => item !== hazardId) : [...current, hazardId],
    );
  };

  const togglePerson = (personId: string) => {
    setPersonsAtRisk((current) =>
      current.includes(personId) ? current.filter((item) => item !== personId) : [...current, personId],
    );
  };

  const onCapa = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await endpoints.createCapa({
        title: actionTitle.trim(),
        description: actionDescription.trim(),
        dueDate,
        sourceType: 'RISK_ASSESSMENT',
        sourceId: data.id,
        regionId: data.regionId ?? data.region?.id,
        districtId: data.districtId ?? data.district?.id,
        actionType: 'CORRECTIVE_ACTION',
        priority: 'HIGH',
      });
      setActionTitle('');
      setActionDescription('');
      setDueDate('');
    });
  };

  const formReady =
    !!locationWorkplace.trim() &&
    !!activityBeingDone.trim() &&
    !!assessorNames.trim() &&
    selectedHazards.length > 0 &&
    personsAtRisk.length > 0 &&
    readyControls.length > 0 &&
    !!controlConclusion;

  return (
    <Stack spacing={2.5}>
      <CaseFileHeader
        backTo="/risk-assessments"
        backLabel="Risk assessment"
        reference={data.referenceCode}
        title={data.activityBeingDone || 'Risk assessment'}
        chips={[{ label: titleCase(data.status), color: STATUS_COLOR[data.status] ?? 'default' }]}
        actions={
          <ExportReportButton
            filename={`${data.referenceCode}-report.pdf`}
            download={() => endpoints.riskAssessmentReport(id!)}
          />
        }
        meta={[
          {
            icon: <PlaceOutlinedIcon fontSize="small" />,
            label: 'Location',
            value: data.locationWorkplace || placeName(data.region, data.district),
          },
          {
            icon: <EventOutlinedIcon fontSize="small" />,
            label: 'Assessment date',
            value: formatDay(data.assessmentDate),
          },
          {
            icon: <PersonOutlineRoundedIcon fontSize="small" />,
            label: 'Assessor(s)',
            value: data.assessorNames || 'Not named',
          },
        ]}
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {data.rejectionNotes && <Alert severity="warning">Sent back: {data.rejectionNotes}</Alert>}
      {inadequatelyControlled && (
        <Alert severity="warning">
          This assessment is inadequately controlled. Raise a corrective action before a safety officer can
          accept it.
        </Alert>
      )}

      <Card sx={CASE_FILE_CARD_SX}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={700}>
              Assessment details
            </Typography>
            {editable ? (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Location / Workplace"
                    value={locationWorkplace}
                    onChange={(e) => setLocationWorkplace(e.target.value)}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Assessment date"
                    type="date"
                    value={assessmentDate}
                    onChange={(e) => setAssessmentDate(e.target.value)}
                    fullWidth
                    required
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Assessor(s) name"
                    value={assessorNames}
                    onChange={(e) => setAssessorNames(e.target.value)}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Activity being done"
                    value={activityBeingDone}
                    onChange={(e) => setActivityBeingDone(e.target.value)}
                    fullWidth
                    required
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
            ) : (
              <Stack spacing={1}>
                <Typography variant="body2">
                  <strong>Location:</strong> {data.locationWorkplace}
                </Typography>
                <Typography variant="body2">
                  <strong>Activity:</strong> {data.activityBeingDone}
                </Typography>
                <Typography variant="body2">
                  <strong>Assessor(s):</strong> {data.assessorNames}
                </Typography>
                {data.othersConsulted && (
                  <Typography variant="body2">
                    <strong>Others consulted:</strong> {data.othersConsulted}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary">
                  {placeName(data.region, data.district)}
                </Typography>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card sx={CASE_FILE_CARD_SX}>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Hazard identification
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tick the applicable hazards to people, property or the environment.
              </Typography>
            </Box>
            {editable ? (
              RISK_ASSESSMENT_HAZARD_GROUPS.map((group) => (
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
              ))
            ) : (
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {(data.selectedHazards ?? []).map((hazardId) => (
                  <Chip key={hazardId} size="small" label={HAZARD_LABEL[hazardId] ?? hazardId} />
                ))}
              </Stack>
            )}
            {editable ? (
              <TextField
                label="Any specific circumstance (describe)"
                value={specificCircumstance}
                onChange={(e) => setSpecificCircumstance(e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
            ) : (
              data.specificCircumstance && (
                <Typography variant="body2">
                  <strong>Specific circumstance:</strong> {data.specificCircumstance}
                </Typography>
              )
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card sx={CASE_FILE_CARD_SX}>
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="h6" fontWeight={700}>
              Persons at risk
            </Typography>
            {editable ? (
              <FormGroup>
                <Grid container spacing={0.5}>
                  {RISK_ASSESSMENT_PERSONS_AT_RISK.map((personId) => (
                    <Grid key={personId} size={{ xs: 12, sm: 6, md: 4 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={personsAtRisk.includes(personId)}
                            onChange={() => togglePerson(personId)}
                            size="small"
                          />
                        }
                        label={
                          <Typography variant="body2">{RISK_ASSESSMENT_PERSON_LABEL[personId]}</Typography>
                        }
                      />
                    </Grid>
                  ))}
                </Grid>
              </FormGroup>
            ) : (
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {(data.personsAtRisk ?? []).map((personId) => (
                  <Chip
                    key={personId}
                    size="small"
                    label={
                      RISK_ASSESSMENT_PERSON_LABEL[
                        personId as keyof typeof RISK_ASSESSMENT_PERSON_LABEL
                      ] ?? personId
                    }
                  />
                ))}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card sx={CASE_FILE_CARD_SX}>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Risk assessment and risk controls
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Record the ISO 45001 / NIOSH hierarchy tier for each control, then the residual risk after
                controls.
              </Typography>
            </Box>

            {editable
              ? controls.map((row, index) => (
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
                ))
              : (data.controls ?? []).map((row, index) => (
                  <Box
                    key={index}
                    sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}
                  >
                    <Typography variant="body2" fontWeight={700}>
                      {row.identifiedHazard}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={0.5}>
                      {label(row.consequence || '—')} · {label(row.likelihood || '—')}
                      {row.riskScore != null ? ` · Score ${row.riskScore}` : ''}
                      {row.riskClass ? ` · ${titleCase(row.riskClass)}` : ''}
                      {row.controlHierarchy ? ` · ${label(row.controlHierarchy)}` : ''}
                      {row.implemented ? ' · Implemented' : ' · Not implemented'}
                    </Typography>
                    {row.requiredControls && (
                      <Typography variant="body2" mt={1}>
                        {row.requiredControls}
                      </Typography>
                    )}
                    {(row.residualLikelihood || row.residualSeverity) && (
                      <Typography variant="body2" color="text.secondary" mt={0.5}>
                        Residual: {label(row.residualLikelihood || '—')} ·{' '}
                        {label(row.residualSeverity || '—')}
                        {row.residualRiskScore != null ? ` · Score ${row.residualRiskScore}` : ''}
                        {row.residualRiskClass ? ` · ${titleCase(row.residualRiskClass)}` : ''}
                      </Typography>
                    )}
                  </Box>
                ))}

            {editable && (
              <Button
                startIcon={<AddRoundedIcon />}
                onClick={() => setControls((current) => [...current, emptyRow()])}
                sx={{ alignSelf: 'flex-start' }}
              >
                Add hazard / exposure
              </Button>
            )}

            {editable ? (
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
            ) : (
              data.controlConclusion && (
                <Typography variant="body2">
                  <strong>Risk status:</strong>{' '}
                  {data.controlConclusion === 'ADEQUATELY_CONTROLLED'
                    ? 'Adequately controlled. No further action required'
                    : 'Inadequately controlled. Further action / investigation required'}
                </Typography>
              )
            )}
          </Stack>
        </CardContent>
      </Card>

      {(canReadCapa || canCreateCapa) && (
        <Card sx={CASE_FILE_CARD_SX}>
          <CardContent>
            <Typography variant="h6" fontWeight={700}>
              Corrective actions
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              ISO 45001 §10.2 — inadequately controlled assessments need a linked corrective action before
              acceptance.
            </Typography>
            <Stack spacing={1.25} mt={1.5}>
              {capaCount === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No action raised from this assessment yet.
                </Typography>
              )}
              {((capas.data?.items ?? []) as Array<{ id: string; referenceCode?: string; title?: string; status?: string }>).map(
                (item) => (
                  <Stack key={item.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="body2">
                      {item.referenceCode} — {item.title} ({label(String(item.status ?? ''))})
                    </Typography>
                    <Button component={RouterLink} to={`/capa/${item.id}`} size="small">
                      Open the action
                    </Button>
                  </Stack>
                ),
              )}
            </Stack>
            {canCreateCapa && data.status !== 'APPROVED' && (
              <Stack spacing={1.5} mt={2} component="form" onSubmit={onCapa}>
                <TextField
                  label="Action"
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  required
                  fullWidth
                  size="small"
                />
                <TextField
                  label="What must change"
                  value={actionDescription}
                  onChange={(e) => setActionDescription(e.target.value)}
                  required
                  multiline
                  minRows={2}
                  fullWidth
                />
                <TextField
                  label="Due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
                <Box>
                  <Button
                    type="submit"
                    variant="outlined"
                    disabled={!actionTitle.trim() || !actionDescription.trim() || !dueDate}
                  >
                    Raise corrective action
                  </Button>
                </Box>
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      {editable && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            variant="outlined"
            disabled={!formReady}
            onClick={() => void run(() => endpoints.updateRiskAssessment(data.id, patch()))}
          >
            Save changes
          </Button>
          <Button
            variant="contained"
            disabled={!formReady}
            onClick={() =>
              void run(async () => {
                await endpoints.updateRiskAssessment(data.id, patch());
                await endpoints.submitRiskAssessment(data.id);
              })
            }
          >
            Submit for acceptance
          </Button>
        </Stack>
      )}

      {canApprove && data.status === 'PENDING_APPROVAL' && (
        <Card sx={CASE_FILE_CARD_SX}>
          <CardContent>
            <Typography variant="h6" fontWeight={700}>
              Accept the assessment
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              A safety officer accepts the risk assessment, or sends it back with notes.
            </Typography>
            {inadequatelyControlled && capaCount === 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Raise a corrective action before accepting an inadequately controlled assessment.
              </Alert>
            )}
            <TextField
              label="What must change"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              fullWidth
              size="small"
              sx={{ mt: 2 }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mt={1}>
              <Button
                variant="contained"
                color="success"
                disabled={inadequatelyControlled && capaCount === 0}
                onClick={() => void run(() => endpoints.approveRiskAssessment(data.id))}
              >
                Accept
              </Button>
              <Button
                variant="outlined"
                color="warning"
                disabled={!rejectNotes.trim()}
                onClick={() =>
                  void run(() => endpoints.rejectRiskAssessment(data.id, rejectNotes.trim()))
                }
              >
                Send back
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {canWrite && (data.status === 'APPROVED' || data.status === 'REJECTED') && (
        <Button variant="outlined" onClick={() => void run(() => endpoints.reviseRiskAssessment(data.id))}>
          Revise assessment
        </Button>
      )}
    </Stack>
  );
}
