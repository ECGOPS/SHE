import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, CardContent, Checkbox, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { AuditType, isDistrictScope, isRegionalScope, isSafetyOfficer } from '@ecg-she/shared';
import { endpoints } from '../../api/endpoints';
import { useAuthStore } from '../../stores/auth.store';
import { CrewPersonField } from '../jsa/ChoiceFields';
import { AUDIT_METHODS, clausesFor, defaultClauses } from './clauses';

function errorMessage(err: unknown): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? (err as Error)?.message ?? 'Request failed';
}

export function AuditNewPage() {
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);
  const role = session?.user.role;
  const lockedToRegion = !!role && isSafetyOfficer(role) && (isRegionalScope(role) || isDistrictScope(role));
  const lockedToDistrict = !!role && isSafetyOfficer(role) && isDistrictScope(role);
  const [regionId, setRegionId] = useState(session?.user.regionId ?? '');
  const [districtId, setDistrictId] = useState(session?.user.districtId ?? '');
  const [type, setType] = useState<AuditType>(AuditType.INTERNAL);
  const [scope, setScope] = useState('');
  const [objectives, setObjectives] = useState('');
  const [auditee, setAuditee] = useState('');
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [clauses, setClauses] = useState<string[]>(() => defaultClauses(AuditType.INTERNAL));
  const [methods, setMethods] = useState<string[]>(['FIELD_VERIFICATION']);
  const [leadId, setLeadId] = useState('');
  const [leadName, setLeadName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const regions = useQuery({ queryKey: ['regions'], queryFn: endpoints.regions });
  const districts = useQuery({ queryKey: ['districts', regionId], queryFn: () => endpoints.districts(regionId), enabled: !!regionId });
  const people = useQuery({ queryKey: ['audit-people'], queryFn: endpoints.auditPeople });
  const choices = clausesFor(type);
  const ready = useMemo(
    () => scope.trim() && objectives.trim() && auditee.trim() && regionId && scheduledDate && clauses.length > 0 && methods.length > 0 && leadName.trim(),
    [scope, objectives, auditee, regionId, scheduledDate, clauses, methods, leadName],
  );

  const save = useMutation({
    mutationFn: () => endpoints.createAudit({
      type,
      scope: scope.trim(),
      objectives: objectives.trim(),
      auditee: auditee.trim(),
      scheduledDate,
      regionId,
      districtId: districtId || undefined,
      criteria: clauses,
      methods,
      leadAuditorId: leadId || undefined,
      leadAuditorName: leadName.trim(),
    }),
    onSuccess: (record) => navigate(`/audits/${record.id}`),
    onError: (err) => setError(errorMessage(err)),
  });

  const onType = (next: AuditType) => {
    setType(next);
    setClauses(defaultClauses(next));
  };

  const toggle = (list: string[], value: string, set: (next: string[]) => void) => {
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    save.mutate();
  };

  return (
    <Stack spacing={2} component="form" onSubmit={onSubmit}>
      <Typography variant="h5" fontWeight={700}>Plan an audit</Typography>
      <Typography variant="body2" color="text.secondary">
        Name the place, the clauses, how you will gather evidence, and the lead auditor. The visit starts from the audit record.
      </Typography>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField select label="Region" value={regionId} onChange={(e) => { setRegionId(e.target.value); setDistrictId(''); }} fullWidth required disabled={lockedToRegion}>
                {(regions.data ?? []).map((region) => <MenuItem key={region.id} value={region.id}>{region.name}</MenuItem>)}
              </TextField>
              <TextField select label="District" value={districtId} onChange={(e) => setDistrictId(e.target.value)} fullWidth disabled={!regionId || lockedToDistrict}>
                <MenuItem value="">Whole region</MenuItem>
                {(districts.data ?? []).map((district) => <MenuItem key={district.id} value={district.id}>{district.name}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField select label="Type" value={type} onChange={(e) => onType(e.target.value as AuditType)} fullWidth>
              {Object.values(AuditType).map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}
            </TextField>
            <TextField label="Scope" value={scope} onChange={(e) => setScope(e.target.value)} required fullWidth multiline minRows={2} placeholder="Which depot, process, and period this audit covers" />
            <TextField label="Objectives" value={objectives} onChange={(e) => setObjectives(e.target.value)} required fullWidth multiline minRows={2} placeholder="What the audit has to determine" />
            <TextField label="Auditee" value={auditee} onChange={(e) => setAuditee(e.target.value)} required fullWidth placeholder="The district, depot, or process being audited" />
            <TextField label="Scheduled date" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} required fullWidth slotProps={{ inputLabel: { shrink: true } }} />
            <CrewPersonField
              label="Lead auditor"
              people={people.data ?? []}
              userId={leadId}
              name={leadName}
              onChange={(next) => { setLeadId(next.userId); setLeadName(next.name); }}
            />
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700}>Clauses</Typography>
          <Typography variant="body2" color="text.secondary">These are the criteria the auditor will mark on site.</Typography>
          <Stack mt={1}>
            {choices.map((clause) => (
              <FormControlLabel
                key={clause}
                control={<Checkbox checked={clauses.includes(clause)} onChange={() => toggle(clauses, clause, setClauses)} />}
                label={clause}
              />
            ))}
          </Stack>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700}>How evidence will be gathered</Typography>
          <Stack mt={1}>
            {AUDIT_METHODS.map((method) => (
              <FormControlLabel
                key={method.value}
                control={<Checkbox checked={methods.includes(method.value)} onChange={() => toggle(methods, method.value, setMethods)} />}
                label={method.label}
              />
            ))}
          </Stack>
        </CardContent>
      </Card>
      <Button type="submit" variant="contained" disabled={!ready || save.isPending}>Save the plan</Button>
    </Stack>
  );
}
