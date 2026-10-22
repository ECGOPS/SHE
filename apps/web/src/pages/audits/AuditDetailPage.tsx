import { FormEvent, useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, CardContent, Chip, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { Permission } from '@ecg-she/shared';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import DomainOutlinedIcon from '@mui/icons-material/DomainOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import { endpoints } from '../../api/endpoints';
import { ExportReportButton } from '../../components/ExportReportButton';
import {
  CASE_FILE_CARD_SX,
  CaseFileCard,
  CaseFileHeader,
  CaseFileSkeleton,
  formatDay,
  titleCase,
} from '../../components/case-file';
import { useAuthStore } from '../../stores/auth.store';

type Result = 'CONFORM' | 'NONCONFORM' | 'NA';
const SEVERITY = ['OBSERVATION', 'MINOR_NC', 'MAJOR_NC', 'CRITICAL'] as const;

interface CheckItem {
  clause: string;
  result?: Result;
  evidence?: string;
  severity?: (typeof SEVERITY)[number];
  findingId?: string;
}

interface Finding {
  id: string;
  severity: string;
  clauseRef?: string | null;
  description: string;
  status: string;
  capaId?: string | null;
  auditeeResponse?: string | null;
}

interface AuditRecord {
  id: string;
  referenceCode?: string;
  status?: string;
  type?: string;
  scope?: string;
  objectives?: string;
  auditee?: string;
  methods?: string | null;
  scheduledDate?: string;
  leadAuditorName?: string | null;
  leadAuditor?: { fullName?: string } | null;
  regionId?: string | null;
  districtId?: string | null;
  region?: { id?: string } | null;
  district?: { id?: string } | null;
  checklist?: CheckItem[] | null;
  findings?: Finding[] | null;
}

function errorMessage(err: unknown): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? (err as Error)?.message ?? 'Request failed';
}

function openFinding(finding: Finding): boolean {
  if (finding.status === 'CLOSED') return false;
  if (finding.severity === 'OBSERVATION' && finding.auditeeResponse) return false;
  return !finding.capaId;
}

export function AuditDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const permissions = useAuthStore((s) => s.session?.user.permissions ?? []);
  const canConduct = permissions.includes(Permission.AUDIT_CONDUCT);
  const canClose = permissions.includes(Permission.AUDIT_CLOSE);
  const canCapa = permissions.includes(Permission.CAPA_CREATE);
  const record = useQuery({
    queryKey: ['audit', id],
    queryFn: () => endpoints.audit(id) as Promise<AuditRecord>,
    enabled: !!id,
  });
  const [rows, setRows] = useState<CheckItem[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [due, setDue] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const audit = record.data;
  useEffect(() => {
    setRows(audit?.checklist ?? []);
  }, [audit?.checklist]);

  const refresh = async () => {
    setError(null);
    await qc.invalidateQueries({ queryKey: ['audit', id] });
    await qc.invalidateQueries({ queryKey: ['audits'] });
  };
  const run = (fn: () => Promise<unknown>) => fn().then(refresh).catch((err: unknown) => setError(errorMessage(err)));

  const onChecklist = (event: FormEvent) => {
    event.preventDefault();
    const missing = rows.find((row) => row.result === 'NONCONFORM' && (!row.evidence?.trim() || !row.severity));
    if (missing) {
      setError(missing.evidence?.trim() ? `Grade the nonconformity: ${missing.clause}` : `Describe the evidence: ${missing.clause}`);
      return;
    }
    void run(() => endpoints.saveAuditChecklist(id, rows));
  };

  const onResponse = (finding: Finding) => (event: FormEvent) => {
    event.preventDefault();
    void run(() => endpoints.respondAuditFinding(id, finding.id, responses[finding.id] ?? ''));
  };

  const onCapa = (finding: Finding) => (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const capa = await endpoints.createCapa({
        title: titles[finding.id]?.trim() || finding.clauseRef || finding.description,
        description: finding.description,
        dueDate: due[finding.id],
        sourceType: 'AUDIT_FINDING',
        sourceId: finding.id,
        regionId: audit?.regionId ?? audit?.region?.id,
        districtId: audit?.districtId ?? audit?.district?.id,
        actionType: 'CORRECTIVE_ACTION',
        priority: finding.severity === 'CRITICAL' || finding.severity === 'MAJOR_NC' ? 'HIGH' : 'MEDIUM',
      });
      await endpoints.linkAuditFinding(id, finding.id, String(capa.id));
    });
  };

  if (record.isLoading) return <CaseFileSkeleton />;
  if (!audit) return <Alert severity="error">Audit not found</Alert>;

  const findings = audit.findings ?? [];
  const underway = audit.status === 'IN_PROGRESS';
  const reporting = audit.status === 'REPORTING';
  const lead = audit.leadAuditor?.fullName || audit.leadAuditorName || 'Not named';

  return (
    <Stack spacing={2.5}>
      <CaseFileHeader
        backTo="/audits"
        backLabel="Audits"
        reference={audit.referenceCode ?? 'Audit'}
        title={audit.auditee || audit.scope || 'Audit'}
        chips={[
          { label: titleCase(audit.status), color: audit.status === 'CLOSED' ? 'success' : audit.status === 'PLANNED' ? 'default' : 'warning' },
          { label: titleCase(audit.type), variant: 'outlined' },
        ]}
        actions={<ExportReportButton filename={`${audit.referenceCode ?? 'audit'}-report.pdf`} download={() => endpoints.auditReport(id)} />}
        meta={[
          { icon: <DomainOutlinedIcon fontSize="small" />, label: 'Auditee', value: audit.auditee || '—' },
          { icon: <PersonOutlineRoundedIcon fontSize="small" />, label: 'Lead auditor', value: lead },
          { icon: <EventOutlinedIcon fontSize="small" />, label: 'Scheduled', value: formatDay(audit.scheduledDate) },
          { icon: <AssignmentOutlinedIcon fontSize="small" />, label: 'Scope', value: audit.scope || '—' },
        ]}
      />
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      <CaseFileCard title="Objectives">
        <Typography sx={{ mt: 1.5, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
          {audit.objectives || 'No objectives were recorded.'}
        </Typography>
        {audit.methods && (
          <Typography variant="body2" color="text.secondary" mt={2}>
            Evidence: {audit.methods.replaceAll('_', ' ').replaceAll('\n', ', ')}
          </Typography>
        )}
      </CaseFileCard>

      {audit.status === 'PLANNED' && canConduct && (
        <Button variant="contained" onClick={() => void run(() => endpoints.startAudit(id))}>Start the audit</Button>
      )}

      <Card sx={CASE_FILE_CARD_SX}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, fontWeight: 700 }}>Clauses</Typography>
          <Stack spacing={2} mt={2} component="form" onSubmit={onChecklist}>
            {rows.map((row, index) => (
              <Stack key={row.clause} spacing={1}>
                <Typography variant="body2" fontWeight={600}>{row.clause}</Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={row.result ?? ''}
                  disabled={!underway || !canConduct}
                  onChange={(_, value: Result | null) => {
                    if (!value) return;
                    setRows((current) => current.map((item, i) => (i === index ? { ...item, result: value } : item)));
                  }}
                >
                  <ToggleButton value="CONFORM">Conform</ToggleButton>
                  <ToggleButton value="NONCONFORM">Nonconform</ToggleButton>
                  <ToggleButton value="NA">Not applicable</ToggleButton>
                </ToggleButtonGroup>
                {row.result === 'NONCONFORM' && (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField
                      label="Evidence"
                      value={row.evidence ?? ''}
                      disabled={!underway || !canConduct}
                      onChange={(e) => setRows((current) => current.map((item, i) => (i === index ? { ...item, evidence: e.target.value } : item)))}
                      fullWidth
                      required
                    />
                    <TextField
                      select
                      label="Grade"
                      value={row.severity ?? ''}
                      disabled={!underway || !canConduct}
                      onChange={(e) => setRows((current) => current.map((item, i) => (i === index ? { ...item, severity: e.target.value as CheckItem['severity'] } : item)))}
                      sx={{ minWidth: 180 }}
                      required
                    >
                      {SEVERITY.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}
                    </TextField>
                  </Stack>
                )}
                {row.result && row.result !== 'NONCONFORM' && row.evidence && (
                  <Typography variant="body2" color="text.secondary">{row.evidence}</Typography>
                )}
              </Stack>
            ))}
            {underway && canConduct && <Button type="submit" variant="outlined" sx={{ alignSelf: 'flex-start' }}>Save the clauses</Button>}
          </Stack>
        </CardContent>
      </Card>

      {underway && canConduct && (
        <Button
          variant="contained"
          disabled={rows.some((row) => !row.result)}
          onClick={() => void run(async () => {
            await endpoints.saveAuditChecklist(id, rows);
            await endpoints.reportAudit(id);
          })}
        >
          Issue the report
        </Button>
      )}

      {findings.length > 0 && (
        <Card sx={CASE_FILE_CARD_SX}>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, fontWeight: 700 }}>Findings</Typography>
            <Stack spacing={2} mt={2}>
              {findings.map((finding) => (
                <Stack key={finding.id} spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>{finding.clauseRef}</Typography>
                    <Chip size="small" label={finding.severity.replaceAll('_', ' ')} color={finding.severity === 'OBSERVATION' ? 'default' : 'error'} />
                    <Chip size="small" label={finding.status} />
                  </Stack>
                  <Typography variant="body2">{finding.description}</Typography>
                  {finding.auditeeResponse && <Typography variant="body2">Auditee: {finding.auditeeResponse}</Typography>}
                  {finding.capaId && <Button component={RouterLink} to={`/capa/${finding.capaId}`} size="small" sx={{ alignSelf: 'flex-start' }}>Open the action</Button>}
                  {(underway || reporting) && finding.status === 'OPEN' && (
                    <Stack spacing={1} component="form" onSubmit={onResponse(finding)}>
                      <TextField
                        label="Auditee response"
                        size="small"
                        value={responses[finding.id] ?? ''}
                        onChange={(e) => setResponses((current) => ({ ...current, [finding.id]: e.target.value }))}
                        fullWidth
                      />
                      <Button type="submit" variant="outlined" size="small" sx={{ alignSelf: 'flex-start' }}>Save response</Button>
                    </Stack>
                  )}
                  {(underway || reporting) && finding.status === 'OPEN' && canCapa && !finding.capaId && (
                    <Stack spacing={1} component="form" onSubmit={onCapa(finding)}>
                      <TextField label="Corrective action" size="small" value={titles[finding.id] ?? finding.clauseRef ?? ''} onChange={(e) => setTitles((current) => ({ ...current, [finding.id]: e.target.value }))} fullWidth required />
                      <TextField label="Due date" type="date" size="small" value={due[finding.id] ?? ''} onChange={(e) => setDue((current) => ({ ...current, [finding.id]: e.target.value }))} required slotProps={{ inputLabel: { shrink: true } }} sx={{ maxWidth: 240 }} />
                      <Button type="submit" variant="contained" size="small" sx={{ alignSelf: 'flex-start' }}>Raise corrective action</Button>
                    </Stack>
                  )}
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {reporting && canClose && (
        <Button variant="contained" onClick={() => void run(() => endpoints.closeAudit(id))} disabled={findings.some(openFinding)}>
          Close the audit
        </Button>
      )}
    </Stack>
  );
}
