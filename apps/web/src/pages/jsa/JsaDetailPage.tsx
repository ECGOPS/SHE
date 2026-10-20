import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { Permission, RISK_LIKELIHOOD, RISK_SEVERITY } from '@ecg-she/shared';
import { endpoints } from '../../api/endpoints';
import { ExportReportButton } from '../../components/ExportReportButton';
import { useAuthStore } from '../../stores/auth.store';
import { CrewPersonField, ListedMultiField, ListedTextField, SupervisorField } from './ChoiceFields';
import { PermitField } from './PermitField';
import { JSA_ACTIVITIES, JSA_CONTROLS, JSA_EMERGENCY, JSA_HAZARDS, JSA_PLACES, JSA_PPE, JSA_STEPS, JSA_TOOLS } from './jsa-choices';

interface Step {
  step: string;
  hazards?: string[];
  controls?: string[];
  likelihood?: string | null;
  severity?: string | null;
  riskScore?: number | null;
  riskClass?: string | null;
}

interface StepDraft {
  step: string;
  hazard: string;
  control: string;
  likelihood: string;
  severity: string;
}

interface CrewMember {
  name: string;
  userId?: string | null;
  acknowledgedAt?: string | null;
}

interface JsaRecord {
  id: string;
  referenceCode: string;
  status: string;
  workActivity: string;
  jobLocation?: string | null;
  jobDate?: string | null;
  regionId?: string | null;
  crewSize?: number | null;
  supervisorId?: string | null;
  supervisor?: { id: string; fullName: string } | null;
  ppeRequired?: string[] | null;
  toolsAndEquipment?: string[] | null;
  emergencyProcedures?: string | null;
  permitRequired?: boolean;
  permitId?: string | null;
  permit?: { id: string; referenceCode?: string; type?: string; status?: string } | null;
  steps?: Step[] | null;
  crew?: CrewMember[] | null;
  rejectionNotes?: string | null;
  region?: { name?: string };
  district?: { name?: string } | null;
}

const emptyStep = (): StepDraft => ({ step: '', hazard: '', control: '', likelihood: '', severity: '' });

function errorMessage(err: unknown): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (err as Error)?.message ??
    'Request failed'
  );
}

function dateInput(value?: string | null): string {
  if (!value) return '';
  return String(value).slice(0, 10);
}

const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
};

export function JsaDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const permissions = useAuthStore((s) => s.session?.user.permissions ?? []);
  const canWrite = permissions.includes(Permission.JSA_CREATE);
  const canApprove = permissions.includes(Permission.JSA_APPROVE);
  const [error, setError] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [newName, setNewName] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [workActivity, setWorkActivity] = useState('');
  const [jobLocation, setJobLocation] = useState('');
  const [jobDate, setJobDate] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [ppe, setPpe] = useState<string[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [emergency, setEmergency] = useState('');
  const [permitRequired, setPermitRequired] = useState(false);
  const [permitId, setPermitId] = useState('');
  const [stepDrafts, setStepDrafts] = useState<StepDraft[]>([emptyStep()]);

  const { data, isLoading } = useQuery({
    queryKey: ['jsa', id],
    queryFn: () => endpoints.jsaOne(id!) as Promise<JsaRecord>,
    enabled: !!id,
  });
  const people = useQuery({ queryKey: ['jsa-people'], queryFn: endpoints.jsaPeople });

  const seed = data
    ? [
        data.id,
        data.status,
        data.workActivity,
        data.jobLocation,
        data.jobDate,
        data.supervisorId,
        data.permitRequired,
        data.permitId,
        data.emergencyProcedures,
        JSON.stringify(data.steps ?? []),
        JSON.stringify(data.ppeRequired ?? []),
        JSON.stringify(data.toolsAndEquipment ?? []),
      ].join('|')
    : '';

  useEffect(() => {
    if (!data) return;
    setWorkActivity(data.workActivity ?? '');
    setJobLocation(data.jobLocation ?? '');
    setJobDate(dateInput(data.jobDate));
    setSupervisorId(data.supervisorId ?? '');
    setPpe(data.ppeRequired ?? []);
    setTools(data.toolsAndEquipment ?? []);
    setEmergency(data.emergencyProcedures ?? '');
    setPermitRequired(!!data.permitRequired);
    setPermitId(data.permitId ?? '');
    const next = (data.steps ?? []).map((step) => ({
      step: step.step ?? '',
      hazard: step.hazards?.[0] ?? '',
      control: step.controls?.[0] ?? '',
      likelihood: step.likelihood ?? '',
      severity: step.severity ?? '',
    }));
    setStepDrafts(next.length ? next : [emptyStep()]);
  }, [data, seed]);

  if (isLoading || !data) return <Typography>Loading...</Typography>;

  const editable = canWrite && (data.status === 'DRAFT' || data.status === 'REJECTED');
  const crew = data.crew ?? [];
  const steps = data.steps ?? [];
  const readySteps = stepDrafts.filter((step) => step.step.trim() && step.hazard.trim() && step.control.trim());

  const refresh = async () => {
    setError(null);
    await qc.invalidateQueries({ queryKey: ['jsa'] });
  };
  const run = (fn: () => Promise<unknown>) => fn().then(refresh).catch((err: unknown) => setError(errorMessage(err)));

  const setBriefed = (index: number, briefed: boolean) => {
    const next = crew.map((person, i) =>
      i === index ? { ...person, acknowledgedAt: briefed ? new Date().toISOString() : null } : person,
    );
    void run(() => endpoints.updateJsa(data.id, { crew: next }));
  };

  const briefingPatch = () => ({
    workActivity: workActivity.trim(),
    jobLocation: jobLocation.trim(),
    jobDate,
    supervisorId: supervisorId || null,
    ppeRequired: ppe,
    toolsAndEquipment: tools,
    emergencyProcedures: emergency.trim(),
    permitRequired,
    permitId: permitRequired && permitId ? permitId : null,
    steps: readySteps.map((step) => ({
      step: step.step.trim(),
      hazards: [step.hazard.trim()],
      controls: [step.control.trim()],
      likelihood: step.likelihood || undefined,
      severity: step.severity || undefined,
    })),
  });

  const saveBriefing = () => {
    void run(() => endpoints.updateJsa(data.id, briefingPatch()));
  };

  const submitBriefing = () => {
    void run(async () => {
      await endpoints.updateJsa(data.id, briefingPatch());
      await endpoints.submitJsa(data.id);
    });
  };

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setStepDrafts(stepDrafts.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
          <Typography variant="h5" fontWeight={700}>{data.referenceCode}</Typography>
          <Chip label={data.status.replaceAll('_', ' ')} color={STATUS_COLOR[data.status] ?? 'default'} />
          {data.permitRequired && <Chip label="Permit required" color="warning" variant="outlined" />}
        </Stack>
        <ExportReportButton filename={`${data.referenceCode}-report.pdf`} download={() => endpoints.jsaReport(id!)} />
      </Stack>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {data.rejectionNotes && <Alert severity="warning">Sent back: {data.rejectionNotes}</Alert>}
      {data.status === 'APPROVED' && (
        <Alert severity="info">If the job or the weather changes, revise this briefing before work continues.</Alert>
      )}

      <Card>
        <CardContent>
          {editable ? (
            <Stack spacing={2}>
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
                <PermitField
                  value={permitId}
                  onChange={setPermitId}
                  regionId={data.regionId}
                  initial={data.permit ? { id: data.permit.id, referenceCode: data.permit.referenceCode, regionId: data.regionId } : null}
                />
              )}
            </Stack>
          ) : (
            <>
              <Typography variant="h6">{data.workActivity}</Typography>
              <Typography color="text.secondary" mt={0.5}>
                {data.jobLocation || 'Location not recorded'}
                {data.jobDate ? ` · ${new Date(dateInput(data.jobDate)).toLocaleDateString()}` : ''}
                {data.region?.name ? ` · ${data.region.name}` : ''}
                {data.district?.name ? ` / ${data.district.name}` : ''}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography><strong>Supervisor. </strong>{data.supervisor?.fullName ?? 'Not named'}</Typography>
              {!!data.ppeRequired?.length && <Typography mt={1}><strong>PPE. </strong>{data.ppeRequired.join(', ')}</Typography>}
              {!!data.toolsAndEquipment?.length && <Typography mt={1}><strong>Tools. </strong>{data.toolsAndEquipment.join(', ')}</Typography>}
              {data.emergencyProcedures && <Typography mt={1}><strong>Emergency. </strong>{data.emergencyProcedures}</Typography>}
              {data.permitRequired && (
                <Typography mt={1}>
                  <strong>Permit. </strong>
                  {data.permit?.referenceCode ?? 'Not linked'}
                  {data.permit?.referenceCode && (
                    <Button size="small" sx={{ ml: 1 }} onClick={() => navigate('/ptw')}>Open permits</Button>
                  )}
                </Typography>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700}>Steps</Typography>
          {editable ? (
            <Stack spacing={2} mt={1}>
              {stepDrafts.map((step, index) => (
                <Stack key={index} spacing={1} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2">Step {index + 1}</Typography>
                    <IconButton aria-label="Remove step" disabled={stepDrafts.length === 1} onClick={() => setStepDrafts(stepDrafts.filter((_, i) => i !== index))}>
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
              <Button startIcon={<AddRoundedIcon />} onClick={() => setStepDrafts([...stepDrafts, emptyStep()])}>Add step</Button>
            </Stack>
          ) : (
            <Stack spacing={1.5} mt={1}>
              {steps.length === 0 && <Typography color="text.secondary">No steps recorded.</Typography>}
              {steps.map((step, index) => (
                <Box key={index}>
                  <Typography fontWeight={700}>{index + 1}. {step.step}</Typography>
                  <Typography variant="body2">Hazard: {(step.hazards ?? []).join(', ') || '—'}</Typography>
                  <Typography variant="body2">Control: {(step.controls ?? []).join(', ') || '—'}</Typography>
                  {step.riskClass && (
                    <Typography variant="body2" color="text.secondary">
                      {step.likelihood?.replaceAll('_', ' ')} × {step.severity?.replaceAll('_', ' ')} · {step.riskClass}
                      {step.riskScore != null ? ` (${step.riskScore})` : ''}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700}>Crew briefing</Typography>
          <Typography variant="body2" color="text.secondary">Tick Briefed as each person hears the controls.</Typography>
          <Stack spacing={0.5} mt={1}>
            {crew.length === 0 && <Typography color="text.secondary">No one is named on this briefing yet.</Typography>}
            {crew.map((person, index) => (
              <FormControlLabel
                key={`${person.name}-${index}`}
                control={
                  <Checkbox
                    checked={!!person.acknowledgedAt}
                    disabled={!editable}
                    onChange={(e) => setBriefed(index, e.target.checked)}
                  />
                }
                label={person.acknowledgedAt ? `${person.name} · briefed` : person.name}
              />
            ))}
            {editable && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mt={1} alignItems={{ sm: 'center' }}>
                <CrewPersonField
                  people={people.data ?? []}
                  userId={newUserId}
                  name={newName}
                  onChange={(next) => {
                    setNewUserId(next.userId);
                    setNewName(next.name);
                  }}
                />
                <Button
                  variant="outlined"
                  disabled={!newName.trim()}
                  onClick={() => {
                    const next = [...crew, { name: newName.trim(), userId: newUserId || null, acknowledgedAt: null }];
                    setNewName('');
                    setNewUserId('');
                    void run(() => endpoints.updateJsa(data.id, { crew: next }));
                  }}
                >
                  Add
                </Button>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      {editable && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            variant="outlined"
            disabled={!workActivity.trim() || !jobLocation.trim() || !jobDate || readySteps.length === 0}
            onClick={saveBriefing}
          >
            Save changes
          </Button>
          <Button
            variant="contained"
            disabled={!workActivity.trim() || !jobLocation.trim() || !jobDate || readySteps.length === 0}
            onClick={submitBriefing}
          >
            Submit for acceptance
          </Button>
        </Stack>
      )}

      {canApprove && data.status === 'PENDING_APPROVAL' && (
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={700}>Accept the briefing</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              High-risk work, where a permit is required, needs a second person to accept it.
            </Typography>
            <TextField
              label="What must change"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              fullWidth
              size="small"
              sx={{ mt: 2 }}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mt={1}>
              <Button variant="contained" color="success" onClick={() => void run(() => endpoints.approveJsa(data.id))}>
                Accept
              </Button>
              <Button
                variant="outlined"
                color="warning"
                disabled={!rejectNotes.trim()}
                onClick={() => void run(() => endpoints.rejectJsa(data.id, rejectNotes.trim()))}
              >
                Send back
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {canWrite && (data.status === 'APPROVED' || data.status === 'REJECTED') && (
        <Button variant="outlined" onClick={() => void run(() => endpoints.reviseJsa(data.id))}>
          Revise briefing
        </Button>
      )}
    </Stack>
  );
}
