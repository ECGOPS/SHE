import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Card, CardContent, Chip, Stack, TextField, Typography } from '@mui/material';
import { Permission, dutyForPermit, ppeForPermit } from '@ecg-she/shared';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import { endpoints } from '../../api/endpoints';
import { ExportReportButton } from '../../components/ExportReportButton';
import {
  CASE_FILE_CARD_SX,
  CaseFileHeader,
  CaseFileSkeleton,
  formatWhen,
  placeName,
  titleCase,
} from '../../components/case-file';
import { useAuthStore } from '../../stores/auth.store';

interface Named {
  id: string;
  fullName: string;
}

interface GasTest {
  oxygen?: string | null;
  lel?: string | null;
  toxic?: string | null;
  notes?: string | null;
  testedAt?: string | null;
}

interface PermitRecord {
  id: string;
  referenceCode: string;
  status: string;
  type: string;
  workDescription: string;
  workLocation: string;
  validFrom?: string;
  validTo?: string;
  crewSize?: number | null;
  isolationMethod?: string | null;
  isolationReference?: string | null;
  isolationPoints?: string[] | null;
  hazardsIdentified?: string[] | null;
  controlMeasures?: string[] | null;
  ppeRequired?: string[] | null;
  gasTestRequired?: boolean;
  gasTestResults?: GasTest | null;
  applicantId?: string | null;
  holderId?: string | null;
  applicant?: Named | null;
  issuer?: Named | null;
  holder?: Named | null;
  standbyPerson?: Named | null;
  authorisingManager?: Named | null;
  rejectionNotes?: string | null;
  handbackNotes?: string | null;
  suspensionNotes?: string | null;
  region?: { name?: string };
  district?: { name?: string } | null;
}

function errorMessage(err: unknown): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (err as Error)?.message ??
    'Request failed'
  );
}

const STATUS_COLOR: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  CLOSED: 'default',
  REJECTED: 'error',
  EXPIRED: 'error',
};

export function PtwDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const sessionUserId = useAuthStore((s) => s.session?.user.id);
  const permissions = useAuthStore((s) => s.session?.user.permissions ?? []);
  const canWrite = permissions.includes(Permission.PTW_CREATE);
  const canApprove = permissions.includes(Permission.PTW_APPROVE);
  const [error, setError] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [suspendNotes, setSuspendNotes] = useState('');
  const [handbackNotes, setHandbackNotes] = useState('');
  const [oxygen, setOxygen] = useState('');
  const [lel, setLel] = useState('');
  const [toxic, setToxic] = useState('');
  const [gasNotes, setGasNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['ptw', id],
    queryFn: () => endpoints.ptwOne(id!) as unknown as Promise<PermitRecord>,
    enabled: !!id,
  });
  const duty = data?.holderId ? dutyForPermit(data.type) : null;
  const ppeNeed = data?.holderId ? ppeForPermit(data.type) : null;
  const competence = useQuery({
    queryKey: ['training-competence', data?.holderId, duty],
    queryFn: () => endpoints.trainingCompetence(data!.holderId!, duty!),
    enabled: !!data?.holderId && !!duty && permissions.includes(Permission.TRAINING_READ),
  });
  const holderPpe = useQuery({
    queryKey: ['ppe-holder', data?.holderId, ppeNeed],
    queryFn: () => endpoints.ppeHolder(data!.holderId!, ppeNeed!),
    enabled: !!data?.holderId && !!ppeNeed && permissions.includes(Permission.PPE_READ),
  });

  if (isLoading || !data) return <CaseFileSkeleton />;

  const isHolder = !!sessionUserId && sessionUserId === data.holderId;
  const isApplicant = !!sessionUserId && sessionUserId === data.applicantId;
  const canHandBack = isHolder || isApplicant;
  const gas = data.gasTestResults;

  const refresh = async () => {
    setError(null);
    await qc.invalidateQueries({ queryKey: ['ptw'] });
  };
  const run = (fn: () => Promise<unknown>) => fn().then(refresh).catch((err: unknown) => setError(errorMessage(err)));

  return (
    <Stack spacing={2.5}>
      <CaseFileHeader
        backTo="/ptw"
        backLabel="Permit-to-work"
        reference={data.referenceCode}
        title={data.workDescription}
        chips={[
          { label: titleCase(data.status), color: STATUS_COLOR[data.status] ?? 'default' },
          { label: titleCase(data.type), variant: 'outlined' },
        ]}
        actions={<ExportReportButton filename={`${data.referenceCode}-report.pdf`} download={() => endpoints.ptwReport(id!)} />}
        meta={[
          { icon: <PlaceOutlinedIcon fontSize="small" />, label: 'Work location', value: data.workLocation || placeName(data.region, data.district) },
          { icon: <EventOutlinedIcon fontSize="small" />, label: 'Valid', value: `${formatWhen(data.validFrom)} – ${formatWhen(data.validTo)}` },
          { icon: <PersonOutlineRoundedIcon fontSize="small" />, label: 'Applicant', value: data.applicant?.fullName ?? 'Not recorded' },
          { icon: <BadgeOutlinedIcon fontSize="small" />, label: 'Holder', value: data.holder?.fullName ?? 'Not named' },
        ]}
      />
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {competence.data?.required && competence.data.state === 'NONE' && (
        <Alert severity="error">The holder has no current authorization for this permit.</Alert>
      )}
      {competence.data?.required && competence.data.state === 'EXPIRED' && (
        <Alert severity="error">The holder&apos;s authorization expired{competence.data.expiresOn ? ` on ${competence.data.expiresOn}` : ''}.</Alert>
      )}
      {competence.data?.required && competence.data.state === 'EXPIRING' && (
        <Alert severity="warning">The holder&apos;s authorization expires{competence.data.expiresOn ? ` on ${competence.data.expiresOn}` : ''}.</Alert>
      )}
      {holderPpe.data?.required && (holderPpe.data.state === 'NONE' || holderPpe.data.state === 'EXPIRED' || holderPpe.data.state === 'TEST_DUE') && (
        <Alert severity="error">
          {ppeNeed === 'FALL_PROTECTION'
            ? 'The holder has no current fall-protection PPE.'
            : 'The holder has no current insulating gloves.'}
          {holderPpe.data.state === 'TEST_DUE' && holderPpe.data.nextTestOn ? ` Test was due ${holderPpe.data.nextTestOn}.` : ''}
          {holderPpe.data.state === 'EXPIRED' && holderPpe.data.expiresOn ? ` Expired ${holderPpe.data.expiresOn}.` : ''}
        </Alert>
      )}
      {holderPpe.data?.required && holderPpe.data.state === 'TEST_SOON' && (
        <Alert severity="warning">
          {holderPpe.data.itemName ?? 'Issued PPE'} is due for test{holderPpe.data.nextTestOn ? ` on ${holderPpe.data.nextTestOn}` : ''}.
        </Alert>
      )}
      {holderPpe.data?.required && holderPpe.data.state === 'EXPIRING' && (
        <Alert severity="warning">
          {holderPpe.data.itemName ?? 'Issued PPE'} expires{holderPpe.data.expiresOn ? ` on ${holderPpe.data.expiresOn}` : ''}.
        </Alert>
      )}
      {data.rejectionNotes && <Alert severity="warning">Sent back: {data.rejectionNotes}</Alert>}
      {data.suspensionNotes && data.status === 'SUSPENDED' && <Alert severity="warning">Suspended: {data.suspensionNotes}</Alert>}
      {data.handbackNotes && <Alert severity="info">Handed back: {data.handbackNotes}</Alert>}
      {data.status === 'APPROVED' && <Alert severity="info">Issued. The holder accepts it at the work site before work starts.</Alert>}
      {data.status === 'EXPIRED' && <Alert severity="error">This permit is past its end time. Raise a new one for the next shift.</Alert>}

      <Card sx={CASE_FILE_CARD_SX}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, fontWeight: 700 }}>
            Permit details
          </Typography>
          {data.crewSize ? <Typography mt={1.5}><strong>Crew. </strong>{data.crewSize}</Typography> : null}
          <Typography mt={1}><strong>Issuer. </strong>{data.issuer?.fullName ?? 'Not issued'}</Typography>
          {data.standbyPerson && <Typography mt={1}><strong>Standby. </strong>{data.standbyPerson.fullName}</Typography>}
          {data.authorisingManager && <Typography mt={1}><strong>Authorising manager. </strong>{data.authorisingManager.fullName}</Typography>}
          {data.isolationMethod && (
            <Typography mt={1}>
              <strong>Isolation. </strong>
              {data.isolationMethod.replaceAll('_', ' ')}
              {data.isolationReference ? ` · ${data.isolationReference}` : ''}
            </Typography>
          )}
          {!!data.isolationPoints?.length && <Typography mt={1}><strong>Points. </strong>{data.isolationPoints.join(', ')}</Typography>}
          {!!data.hazardsIdentified?.length && <Typography mt={1}><strong>Hazards. </strong>{data.hazardsIdentified.join(', ')}</Typography>}
          {!!data.controlMeasures?.length && <Typography mt={1}><strong>Precautions. </strong>{data.controlMeasures.join(', ')}</Typography>}
          {!!data.ppeRequired?.length && <Typography mt={1}><strong>PPE. </strong>{data.ppeRequired.join(', ')}</Typography>}
          {gas && (gas.oxygen || gas.lel || gas.toxic) && (
            <Typography mt={1}>
              <strong>Gas test. </strong>
              {[gas.oxygen && `O₂ ${gas.oxygen}`, gas.lel && `LEL ${gas.lel}`, gas.toxic && `Toxic ${gas.toxic}`].filter(Boolean).join(' · ')}
              {gas.testedAt ? ` · ${new Date(gas.testedAt).toLocaleString()}` : ''}
            </Typography>
          )}
        </CardContent>
      </Card>

      {data.gasTestRequired && (data.status === 'PENDING_APPROVAL' || data.status === 'APPROVED') && (canWrite || canApprove) && (
        <Card sx={CASE_FILE_CARD_SX}>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, fontWeight: 700 }}>Gas test</Typography>
            <Typography variant="body2" color="text.secondary">Record a reading before this permit can be issued.</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mt={1}>
              <TextField label="Oxygen" value={oxygen} onChange={(e) => setOxygen(e.target.value)} size="small" fullWidth />
              <TextField label="Flammable gas (LEL)" value={lel} onChange={(e) => setLel(e.target.value)} size="small" fullWidth />
              <TextField label="Toxic" value={toxic} onChange={(e) => setToxic(e.target.value)} size="small" fullWidth />
            </Stack>
            <TextField label="Notes" value={gasNotes} onChange={(e) => setGasNotes(e.target.value)} size="small" fullWidth sx={{ mt: 1 }} />
            <Button sx={{ mt: 1 }} variant="outlined" onClick={() => void run(() => endpoints.recordGasTest(data.id, { oxygen, lel, toxic, notes: gasNotes }))}>
              Save gas test
            </Button>
          </CardContent>
        </Card>
      )}

      {canApprove && data.status === 'PENDING_APPROVAL' && sessionUserId !== data.applicantId && (
        <Card sx={CASE_FILE_CARD_SX}>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, fontWeight: 700 }}>Issue the permit</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              The person who raised it cannot issue it. Hot work and confined space need a gas test, a standby person, and an authorising manager.
            </Typography>
            <TextField label="What must change" value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} fullWidth size="small" sx={{ mt: 2 }} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mt={1}>
              <Button variant="contained" onClick={() => void run(() => endpoints.issuePtw(data.id))}>Issue</Button>
              <Button variant="outlined" color="warning" disabled={!rejectNotes.trim()} onClick={() => void run(() => endpoints.rejectPtw(data.id, rejectNotes.trim()))}>
                Send back
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {isHolder && data.status === 'APPROVED' && (
        <Button variant="contained" onClick={() => void run(() => endpoints.acceptPtw(data.id))}>
          Accept at the work site
        </Button>
      )}

      {(isHolder || canApprove) && data.status === 'ACTIVE' && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField label="Why work is stopping" value={suspendNotes} onChange={(e) => setSuspendNotes(e.target.value)} size="small" fullWidth />
          <Button variant="outlined" disabled={!suspendNotes.trim()} onClick={() => void run(() => endpoints.suspendPtw(data.id, suspendNotes.trim()))}>
            Suspend
          </Button>
        </Stack>
      )}

      {(isHolder || canApprove) && data.status === 'SUSPENDED' && (
        <Button variant="outlined" onClick={() => void run(() => endpoints.resumePtw(data.id))}>Resume work</Button>
      )}

      {canHandBack && (data.status === 'ACTIVE' || data.status === 'SUSPENDED') && (
        <Card sx={CASE_FILE_CARD_SX}>
          <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, fontWeight: 700 }}>Hand the permit back</Typography>
            <Typography variant="body2" color="text.secondary">Confirm the site is safe and how the isolations were left.</Typography>
            <TextField label="Hand-back" value={handbackNotes} onChange={(e) => setHandbackNotes(e.target.value)} fullWidth size="small" sx={{ mt: 1 }} />
            <Button sx={{ mt: 1 }} variant="outlined" disabled={!handbackNotes.trim()} onClick={() => void run(() => endpoints.handbackPtw(data.id, handbackNotes.trim()))}>
              Hand back
            </Button>
          </CardContent>
        </Card>
      )}

      {canApprove && sessionUserId !== data.holderId && !!data.handbackNotes && (data.status === 'ACTIVE' || data.status === 'SUSPENDED') && (
        <Button variant="contained" color="success" onClick={() => void run(() => endpoints.closePtw(data.id))}>
          Close permit
        </Button>
      )}

      {canWrite && data.status === 'REJECTED' && (
        <Button variant="outlined" onClick={() => void run(() => endpoints.revisePtw(data.id))}>Submit again</Button>
      )}

      {data.status === 'PENDING_APPROVAL' && canApprove && sessionUserId === data.applicantId && (
        <Box>
          <Alert severity="info">Another safety officer issues this permit. You raised it, so you cannot issue it yourself.</Alert>
        </Box>
      )}
    </Stack>
  );
}
