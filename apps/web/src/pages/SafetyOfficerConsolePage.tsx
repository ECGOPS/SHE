import { useMemo, useState, ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid2 as Grid,
  List,
  ListItem,
  ListItemButton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import BuildCircleRoundedIcon from '@mui/icons-material/BuildCircleRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { endpoints, AnyRecord } from '../api/endpoints';
import { useAuthStore } from '../stores/auth.store';
import {
  isDistrictScope,
  isGlobalScope,
  isRegionalScope,
  ISSUE_SCOPE_LABEL,
  ISSUE_SCOPE_LADDER,
  IssueScope,
  issueScopeForRole,
  Permission,
  ROLE_LABEL,
  Role,
} from '@ecg-she/shared';
import { canSeePath } from '../layouts/nav-access';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function ageInDays(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

function ageBadge(iso?: string | null): { label: string; color: 'default' | 'warning' | 'error' } {
  const days = ageInDays(iso);
  if (days === null) return { label: '—', color: 'default' };
  if (days >= 7) return { label: `${days}d open`, color: 'error' };
  if (days >= 3) return { label: `${days}d open`, color: 'warning' };
  return { label: `${days}d`, color: 'default' };
}

function severityColor(s?: string): 'default' | 'info' | 'warning' | 'error' {
  switch (String(s).toUpperCase()) {
    case 'CATASTROPHIC':
    case 'CRITICAL':
    case 'EXTREME':
      return 'error';
    case 'MAJOR':
    case 'HIGH':
      return 'warning';
    case 'MODERATE':
    case 'MEDIUM':
      return 'info';
    default:
      return 'default';
  }
}

interface KpiTileProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: ReactNode;
  accent: 'primary' | 'warning' | 'error' | 'info' | 'success';
  to?: string;
}

function KpiTile({ title, value, subtitle, icon, accent, to }: KpiTileProps) {
  const card = (
    <Card
      sx={{
        height: '100%',
        transition: 'all 0.2s',
        cursor: to ? 'pointer' : 'default',
        '&:hover': to ? { boxShadow: 4, transform: 'translateY(-2px)' } : undefined,
      }}
    >
      <CardContent>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Stack spacing={0.25} sx={{ flex: 1 }}>
            <Typography variant="overline" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h3" fontWeight={800} color={`${accent}.main`} lineHeight={1}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Stack>
          <Box
            sx={{
              width: 44, height: 44, borderRadius: 1.5,
              bgcolor: `${accent}.light`, color: `${accent}.dark`,
              display: 'grid', placeItems: 'center',
            }}
          >
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
  return to ? (
    <RouterLink to={to} style={{ textDecoration: 'none', color: 'inherit', height: '100%', display: 'block' }}>
      {card}
    </RouterLink>
  ) : (
    card
  );
}

/* -------------------------------------------------------------------------- */
/*  Work-queue list                                                           */
/* -------------------------------------------------------------------------- */

interface QueueItem {
  id: string;
  module: 'incident' | 'hazard' | 'capa' | 'ptw' | 'near-miss';
  reference: string;
  title: string;
  status?: string;
  severity?: string;
  createdAt?: string;
  region?: string;
  district?: string;
  /** Where the issue sits on the district → region → Head Office ladder. */
  escalation?: { label: string; color: 'info' | 'warning' | 'error' | 'success' };
  /** Why is this in the action queue? */
  reason: string;
}

const FLOW_COLOR: Record<IssueScope, 'info' | 'warning' | 'error'> = {
  [IssueScope.DISTRICT]: 'info',
  [IssueScope.REGIONAL]: 'warning',
  [IssueScope.HEAD_OFFICE]: 'error',
};

function escalationOf(record: AnyRecord): QueueItem['escalation'] {
  const raw = record.currentScope as IssueScope | undefined;
  const scope = raw && raw in ISSUE_SCOPE_LABEL ? raw : IssueScope.DISTRICT;
  if (record.resolvedAt) {
    const resolved = record.resolvedAtScope as IssueScope | undefined;
    const at = resolved && resolved in ISSUE_SCOPE_LABEL ? resolved : scope;
    return { label: `Resolved · ${ISSUE_SCOPE_LABEL[at]}`, color: 'success' };
  }
  return { label: `At ${ISSUE_SCOPE_LABEL[scope]}`, color: FLOW_COLOR[scope] };
}

function hazardQueueReason(hazard: AnyRecord): string {
  const risk = String((hazard as { riskClass?: string }).riskClass ?? 'Unrated');
  const target = (hazard as { targetCompletionDate?: string | null }).targetCompletionDate;
  const due = target ? new Date(target).getTime() : NaN;
  if (Number.isFinite(due) && due < Date.now()) return 'Controls are past the target date';
  const hasControl = !!((hazard as { controlHierarchy?: string }).controlHierarchy || (hazard as { controlMeasures?: string }).controlMeasures);
  if (!hasControl) return `${risk} risk — needs a control`;
  return `${risk} risk — confirm the control is in place`;
}

function permitQueueReason(status: string): string {
  if (status === 'PENDING_APPROVAL') return 'Permit is waiting to be issued';
  if (status === 'APPROVED') return 'Issued — the holder has not accepted it on site';
  if (status === 'SUSPENDED') return 'Permit is suspended';
  if (status === 'EXPIRED') return 'Permit is past its end time';
  return 'Active permit — verify isolation is still in place';
}

function queueRoute(it: QueueItem): string {
  switch (it.module) {
    case 'incident': return `/incidents/${it.id}`;
    case 'hazard': return `/hazards/${it.id}`;
    case 'capa': return `/capa`;
    case 'ptw': return `/ptw/${it.id}`;
    case 'near-miss': return `/near-miss/${it.id}`;
  }
}

function moduleColor(m: QueueItem['module']): 'primary' | 'warning' | 'error' | 'info' | 'success' {
  switch (m) {
    case 'incident': return 'error';
    case 'hazard': return 'warning';
    case 'capa': return 'primary';
    case 'ptw': return 'info';
    case 'near-miss': return 'success';
  }
}

function QueueRow({ it }: { it: QueueItem }) {
  const age = ageBadge(it.createdAt);
  return (
    <ListItem disablePadding>
      <ListItemButton
        component={RouterLink}
        to={queueRoute(it)}
        sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: 1.5, py: 1.25 }}
      >
        <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={it.module.toUpperCase()}
              color={moduleColor(it.module)}
              sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
            />
            <Typography variant="body2" fontWeight={600}>
              {it.reference} — {it.title}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} mt={0.25} flexWrap="wrap" useFlexGap>
            <Typography variant="caption" color="warning.dark" fontWeight={600}>
              {it.reason}
            </Typography>
            {it.status && (
              <Typography variant="caption" color="text.secondary">
                · {it.status.replaceAll('_', ' ')}
              </Typography>
            )}
            {(it.region || it.district) && (
              <Typography variant="caption" color="text.secondary">
                · <LocationOnRoundedIcon sx={{ fontSize: 10, verticalAlign: 'middle' }} />{' '}
                {it.district ?? it.region}
              </Typography>
            )}
          </Stack>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ flexShrink: 0 }}>
          {it.escalation && (
            <Chip
              size="small"
              label={it.escalation.label}
              color={it.escalation.color}
              sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
            />
          )}
          {it.severity && (
            <Chip
              size="small"
              label={it.severity}
              color={severityColor(it.severity)}
              variant="outlined"
              sx={{ height: 20, fontSize: 10 }}
            />
          )}
          <Chip size="small" label={age.label} color={age.color} sx={{ height: 20, fontSize: 10 }} />
          <Button
            size="small"
            component="span"
            tabIndex={-1}
            endIcon={<ArrowForwardRoundedIcon fontSize="small" />}
            sx={{ pointerEvents: 'none', display: { xs: 'none', sm: 'inline-flex' } }}
          >
            Open
          </Button>
        </Stack>
      </ListItemButton>
    </ListItem>
  );
}

function QueueList({ items, empty }: { items: QueueItem[]; empty: string }) {
  if (!items.length) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {empty}
        </Typography>
      </Box>
    );
  }
  return (
    <List disablePadding>
      {items.map((it, i) => (
        <Box key={`${it.module}:${it.id}`}>
          <QueueRow it={it} />
          {i < items.length - 1 && <Divider component="li" />}
        </Box>
      ))}
    </List>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

const ACTION_INCIDENT_STATUSES = new Set(['REPORTED', 'UNDER_INVESTIGATION', 'PENDING_APPROVAL']);
const ACTION_CAPA_STATUSES = new Set(['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'OVERDUE']);
const HIGH_RISK_CLASSES = new Set(['HIGH', 'EXTREME']);
const ACTION_PTW_STATUSES = new Set(['PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'EXPIRED']);

export function SafetyOfficerConsolePage() {
  const session = useAuthStore((s) => s.session);
  const role = session?.user.role ?? Role.DISTRICT_USER;
  const permissions = session?.user.permissions ?? [];
  const can = (permission: string) => permissions.includes(permission);
  const [tab, setTab] = useState(0);

  // RBAC scopes everything server-side automatically — we just consume the
  // existing list endpoints and the response is already filtered to whatever
  // region/district this officer can see.
  const incidents = useQuery({
    queryKey: ['console', 'incidents'],
    queryFn: () => endpoints.incidents({
      pageSize: 100,
      status: 'REPORTED,UNDER_INVESTIGATION,PENDING_APPROVAL',
      sortBy: 'occurredAt',
      sortDir: 'DESC',
    }),
  });
  const hazards = useQuery({
    queryKey: ['console', 'hazards'],
    queryFn: () => endpoints.hazards({ status: 'OPEN,MITIGATED', pageSize: 100 }),
  });
  const capas = useQuery({
    queryKey: ['console', 'capa'],
    queryFn: () => endpoints.capa({ status: 'OPEN,ASSIGNED,IN_PROGRESS,OVERDUE', pageSize: 100 }),
  });
  const capaStats = useQuery({
    queryKey: ['console', 'capa-stats'],
    queryFn: () => endpoints.capaStats(),
  });
  const nearMiss = useQuery({
    queryKey: ['console', 'near-miss'],
    queryFn: () => endpoints.nearMiss({ status: 'OPEN,REPORTED,UNDER_REVIEW', pageSize: 100 }),
  });
  const ptw = useQuery({
    queryKey: ['console', 'ptw'],
    queryFn: () => endpoints.ptw({ status: 'PENDING_APPROVAL,APPROVED,ACTIVE,SUSPENDED,EXPIRED', pageSize: 100 }),
  });
  const assigned = useQuery({
    queryKey: ['console', 'assigned', session?.user.id],
    queryFn: () =>
      endpoints.incidents({
        pageSize: 100,
        investigatorId: session!.user.id,
        sortBy: 'occurredAt',
        sortDir: 'DESC',
      }),
    enabled: !!session?.user.id,
  });

  const incidentItems = (incidents.data?.items ?? []) as unknown as AnyRecord[];
  const hazardItems = (hazards.data?.items ?? []) as unknown as AnyRecord[];
  const capaItems = (capas.data?.items ?? []) as AnyRecord[];
  const ptwItems = (ptw.data?.items ?? []) as AnyRecord[];
  const nmItems = (nearMiss.data?.items ?? []) as unknown as AnyRecord[];

  /* ── Derived queues ──────────────────────────────────────────────────── */

  const openIncidents = useMemo(
    () =>
      incidentItems.filter(
        (i) => ACTION_INCIDENT_STATUSES.has(String(i.status)) && !i.resolvedAt,
      ),
    [incidentItems],
  );
  const assignedToMe = useMemo(
    () =>
      (assigned.data?.items ?? []).filter(
        (i) => String(i.status) !== 'CLOSED' && String(i.status) !== 'REJECTED',
      ),
    [assigned.data],
  );
  const highRiskHazards = useMemo(
    () =>
      hazardItems.filter(
        (h) =>
          HIGH_RISK_CLASSES.has(String((h as { riskClass?: string }).riskClass)) &&
          String(h.status ?? '') !== 'CLOSED' &&
          !h.resolvedAt,
      ),
    [hazardItems],
  );
  const openCapas = useMemo(
    () => capaItems.filter((c) => ACTION_CAPA_STATUSES.has(String(c.status))),
    [capaItems],
  );
  const overdueCapas = useMemo(
    () => capaItems.filter((c) => String(c.status) === 'OVERDUE'),
    [capaItems],
  );
  const pendingPermits = useMemo(
    () => ptwItems.filter((p) => ACTION_PTW_STATUSES.has(String(p.status))),
    [ptwItems],
  );
  const openNearMisses = useMemo(
    () => nmItems.filter((n) => String(n.status ?? 'OPEN') !== 'CLOSED' && !n.resolvedAt),
    [nmItems],
  );
  const recentNearMisses = useMemo(() => {
    const cutoff = Date.now() - 7 * 86_400_000;
    return nmItems.filter((n) => {
      const t = new Date(String(n.createdAt ?? n.occurredAt ?? '')).getTime();
      return Number.isFinite(t) && t >= cutoff;
    });
  }, [nmItems]);
  const openHazards = useMemo(
    () => hazardItems.filter((h) => String(h.status ?? '') !== 'CLOSED' && !h.resolvedAt),
    [hazardItems],
  );
  const myTier = issueScopeForRole(role);
  const escalationSummary = useMemo(() => {
    const counts: Record<IssueScope, number> = {
      [IssueScope.DISTRICT]: 0,
      [IssueScope.REGIONAL]: 0,
      [IssueScope.HEAD_OFFICE]: 0,
    };
    for (const row of [...openIncidents, ...openHazards, ...openNearMisses]) {
      const scope = (row.currentScope as IssueScope | undefined) ?? IssueScope.DISTRICT;
      if (scope in counts) counts[scope] += 1;
    }
    return counts;
  }, [openIncidents, openHazards, openNearMisses]);

  /* ── Action-required combined queue ─────────────────────────────────── */

  const actionQueue: QueueItem[] = useMemo(() => {
    const q: QueueItem[] = [];

    for (const i of openIncidents) {
      const reason =
        String(i.status) === 'PENDING_APPROVAL'
          ? 'Awaiting your approval'
          : String(i.status) === 'REPORTED'
            ? 'Needs investigator assigned'
            : 'Investigation in progress';
      q.push({
        id: String(i.id),
        module: 'incident',
        reference: String(i.referenceCode ?? i.id),
        title: String(i.title ?? '—'),
        status: String(i.status),
        severity: String((i as { severity?: string }).severity ?? ''),
        createdAt: String(i.createdAt ?? (i as { occurredAt?: string }).occurredAt ?? ''),
        region: i.region?.name,
        district: i.district?.name,
        escalation: escalationOf(i),
        reason,
      });
    }
    for (const n of openNearMisses) {
      const potential = String(n.severityPotential ?? '');
      const high = potential === 'MAJOR' || potential === 'CATASTROPHIC';
      q.push({
        id: String(n.id),
        module: 'near-miss',
        reference: String(n.referenceCode ?? n.id),
        title: String(n.title ?? '—'),
        status: String(n.status ?? 'OPEN'),
        severity: potential,
        createdAt: String(n.occurredAt ?? n.createdAt ?? ''),
        region: n.region?.name,
        district: n.district?.name,
        escalation: escalationOf(n),
        reason: high
          ? `${potential.replaceAll('_', ' ')} potential near-miss — review now`
          : n.investigator
            ? 'Review in progress'
            : 'Needs a safety officer to review',
      });
    }
    for (const h of highRiskHazards) {
      q.push({
        id: String(h.id),
        module: 'hazard',
        reference: String(h.referenceCode ?? h.id),
        title: String(h.title ?? '—'),
        status: String(h.status ?? ''),
        severity: String((h as { riskClass?: string }).riskClass ?? ''),
        createdAt: String(h.createdAt ?? ''),
        region: h.region?.name,
        district: h.district?.name,
        escalation: escalationOf(h),
        reason: hazardQueueReason(h),
      });
    }
    for (const c of overdueCapas) {
      q.push({
        id: String(c.id),
        module: 'capa',
        reference: String(c.referenceCode ?? c.id),
        title: String(c.title ?? '—'),
        status: String(c.status),
        severity: String((c as { priority?: string }).priority ?? ''),
        createdAt: String(c.createdAt ?? ''),
        region: c.region?.name,
        district: c.district?.name,
        reason: 'Corrective action is overdue',
      });
    }
    for (const p of pendingPermits) {
      q.push({
        id: String(p.id),
        module: 'ptw',
        reference: String(p.referenceCode ?? p.id),
        title: String(p.workDescription ?? p.title ?? '—'),
        status: String(p.status),
        createdAt: String(p.createdAt ?? ''),
        region: p.region?.name,
        district: p.district?.name,
        reason: permitQueueReason(String(p.status)),
      });
    }

    // Sort: critical/high severity first, then oldest first.
    return q.sort((a, b) => {
      const sa = severityColor(a.severity) === 'error' ? 0 : severityColor(a.severity) === 'warning' ? 1 : 2;
      const sb = severityColor(b.severity) === 'error' ? 0 : severityColor(b.severity) === 'warning' ? 1 : 2;
      if (sa !== sb) return sa - sb;
      return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
    });
  }, [openIncidents, openNearMisses, highRiskHazards, overdueCapas, pendingPermits]);

  /* ── Header / scope chip ────────────────────────────────────────────── */

  const scopeLabel = ROLE_LABEL[role];

  const scopeColor = isDistrictScope(role)
    ? 'info'
    : isRegionalScope(role)
      ? 'primary'
      : isGlobalScope(role)
        ? 'secondary'
        : 'default';

  const loading =
    incidents.isLoading || hazards.isLoading || capas.isLoading || ptw.isLoading || nearMiss.isLoading || assigned.isLoading;

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <Stack spacing={3}>
      <Box>
        <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
          <Typography variant="h4" fontWeight={700} sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
            Safety Officer Console
          </Typography>
          <Chip
            label={scopeLabel}
            color={scopeColor as 'info' | 'primary' | 'secondary'}
            sx={{ fontWeight: 600 }}
          />
        </Stack>
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          Single-pane view of every SHE item in your scope that needs your attention. Click any
          row to open the relevant module and act on it.
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mt={1.5}>
          {ISSUE_SCOPE_LADDER.map((scope) => (
            <Chip
              key={scope}
              label={`${scope === myTier ? 'Your tier · ' : ''}${ISSUE_SCOPE_LABEL[scope]} · ${escalationSummary[scope]} open`}
              color={FLOW_COLOR[scope]}
              variant={scope === myTier ? 'filled' : 'outlined'}
              sx={{ fontWeight: 600 }}
            />
          ))}
        </Stack>
      </Box>

      {/* KPI strip */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiTile
            title="Open incidents"
            value={openIncidents.length}
            subtitle={`${incidentItems.length} total · last 50`}
            icon={<ReportProblemRoundedIcon />}
            accent="error"
            to="/incidents"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiTile
            title="High-risk hazards"
            value={highRiskHazards.length}
            subtitle="HIGH or EXTREME, not closed"
            icon={<WarningAmberRoundedIcon />}
            accent="warning"
            to="/hazards"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiTile
            title="Overdue CAPAs"
            value={capaStats.data?.overdue ?? overdueCapas.length}
            subtitle={`${openCapas.length} open in total`}
            icon={<BuildCircleRoundedIcon />}
            accent="primary"
            to="/capa"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiTile
            title="Permits pending"
            value={pendingPermits.length}
            subtitle="awaiting your authorisation"
            icon={<VerifiedUserRoundedIcon />}
            accent="info"
            to="/ptw"
          />
        </Grid>
      </Grid>

      {actionQueue.length === 0 && !loading && (
        <Alert severity="success" variant="outlined">
          You're all clear — no items in your scope currently require action. Nice work.
        </Alert>
      )}

      {/* Tabbed work queues */}
      <Card>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}
        >
          <Tab label={`Action required (${actionQueue.length})`} />
          <Tab label={`Assigned to me (${assignedToMe.length})`} />
          <Tab label={`Open incidents (${openIncidents.length})`} />
          <Tab label={`High-risk hazards (${highRiskHazards.length})`} />
          <Tab label={`CAPAs (${openCapas.length})`} />
          <Tab label={`Permits (${pendingPermits.length})`} />
          <Tab label={`Near-miss this week (${recentNearMisses.length})`} />
        </Tabs>

        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          {tab === 0 && (
            <QueueList
              items={actionQueue}
              empty="Nothing requires your attention right now."
            />
          )}
          {tab === 1 && (
            <QueueList
              items={assignedToMe.map<QueueItem>((i) => ({
                id: String(i.id),
                module: 'incident',
                reference: String(i.referenceCode ?? i.id),
                title: String(i.title ?? ''),
                status: String(i.status),
                severity: String(i.severity ?? ''),
                createdAt: String(i.occurredAt ?? ''),
                region: i.region?.name,
                district: i.district?.name,
                escalation: escalationOf(i as unknown as AnyRecord),
                reason: 'Assigned to you',
              }))}
              empty="No open incidents are assigned to you."
            />
          )}
          {tab === 2 && (
            <QueueList
              items={openIncidents.map<QueueItem>((i) => ({
                id: String(i.id),
                module: 'incident',
                reference: String(i.referenceCode ?? i.id),
                title: String(i.title ?? ''),
                status: String(i.status),
                severity: String((i as { severity?: string }).severity ?? ''),
                createdAt: String(i.createdAt ?? (i as { occurredAt?: string }).occurredAt ?? ''),
                region: i.region?.name,
                district: i.district?.name,
                escalation: escalationOf(i),
                reason:
                  String(i.status) === 'PENDING_APPROVAL'
                    ? 'Awaiting approval'
                    : String(i.status) === 'REPORTED'
                      ? 'Needs investigator assigned'
                      : 'Investigation in progress',
              }))}
              empty="No open incidents in your scope."
            />
          )}
          {tab === 3 && (
            <QueueList
              items={highRiskHazards.map<QueueItem>((h) => ({
                id: String(h.id),
                module: 'hazard',
                reference: String(h.referenceCode ?? h.id),
                title: String(h.title ?? ''),
                status: String(h.status ?? ''),
                severity: String((h as { riskClass?: string }).riskClass ?? ''),
                createdAt: String(h.createdAt ?? ''),
                region: h.region?.name,
                district: h.district?.name,
                escalation: escalationOf(h),
                reason: hazardQueueReason(h),
              }))}
              empty="No HIGH or EXTREME hazards open in your scope."
            />
          )}
          {tab === 4 && (
            <QueueList
              items={openCapas.map<QueueItem>((c) => ({
                id: String(c.id),
                module: 'capa',
                reference: String(c.referenceCode ?? c.id),
                title: String(c.title ?? ''),
                status: String(c.status),
                severity: String((c as { priority?: string }).priority ?? ''),
                createdAt: String(c.createdAt ?? ''),
                region: c.region?.name,
                district: c.district?.name,
                reason:
                  String(c.status) === 'OVERDUE'
                    ? 'Overdue — escalation required'
                    : `Status: ${String(c.status).replaceAll('_', ' ')}`,
              }))}
              empty="No open corrective actions in your scope."
            />
          )}
          {tab === 5 && (
            <QueueList
              items={pendingPermits.map<QueueItem>((p) => ({
                id: String(p.id),
                module: 'ptw',
                reference: String(p.referenceCode ?? p.id),
                title: String(p.title ?? ''),
                status: String(p.status),
                createdAt: String(p.createdAt ?? ''),
                region: p.region?.name,
                district: p.district?.name,
                reason:
                  String(p.status) === 'PENDING_APPROVAL'
                    ? 'Awaiting your authorisation'
                    : 'Active — verify isolation',
              }))}
              empty="No permits pending action."
            />
          )}
          {tab === 6 && (
            <QueueList
              items={recentNearMisses.map<QueueItem>((n) => ({
                id: String(n.id),
                module: 'near-miss',
                reference: String(n.referenceCode ?? n.id ?? ''),
                title: String(n.title ?? n.description ?? '—'),
                status: 'REPORTED',
                createdAt: String(n.createdAt ?? (n as { occurredAt?: string }).occurredAt ?? ''),
                region: n.region?.name,
                district: n.district?.name,
                escalation: escalationOf(n),
                reason: 'Recent near-miss — review for trend',
              }))}
              empty="No near-misses reported in your scope this week."
            />
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" mb={1}>
            <VisibilityRoundedIcon color="action" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>
              Quick links
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {can(Permission.INCIDENT_CREATE) && (
              <Button component={RouterLink} to="/incidents/new" variant="contained" color="error" size="small">
                Report incident
              </Button>
            )}
            {can(Permission.HAZARD_CREATE) && (
              <Button component={RouterLink} to="/hazards" variant="outlined" size="small">
                Log hazard
              </Button>
            )}
            {can(Permission.NEAR_MISS_CREATE) && (
              <Button component={RouterLink} to="/near-miss" variant="outlined" size="small">
                Report near-miss
              </Button>
            )}
            {can(Permission.JSA_CREATE) && (
              <Button component={RouterLink} to="/jsa" variant="outlined" size="small">
                New JSA
              </Button>
            )}
            {can(Permission.PTW_CREATE) && (
              <Button component={RouterLink} to="/ptw/new" variant="outlined" size="small">
                New permit
              </Button>
            )}
            {can(Permission.INSPECTION_CONDUCT) && canSeePath(role, '/inspections') && (
              <Button component={RouterLink} to="/inspections" variant="outlined" size="small">
                Start inspection
              </Button>
            )}
            {can(Permission.CAPA_CREATE) && canSeePath(role, '/capa') && (
              <Button component={RouterLink} to="/capa" variant="outlined" size="small">
                Open a CAPA
              </Button>
            )}
            {can(Permission.REPORT_GENERATE) && canSeePath(role, '/reports') && (
              <Button component={RouterLink} to="/reports" variant="outlined" size="small">
                Reports
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
