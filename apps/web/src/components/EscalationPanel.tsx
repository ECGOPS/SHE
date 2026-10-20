import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  FormControlLabel,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  EscalationAction,
  EscalationEntityType,
  ISSUE_SCOPE_LABEL,
  ISSUE_SCOPE_LADDER,
  isGlobalScope,
  isRegionalScope,
  isSafetyOfficer,
  IssueScope,
  Permission,
  Role,
} from '@ecg-she/shared';
import { endpoints, EscalationDto } from '../api/endpoints';
import { useAuthStore } from '../stores/auth.store';

interface Props {
  entityType: EscalationEntityType;
  entityId: string;
  /** Current state of the underlying issue. */
  currentScope: IssueScope;
  resolvedAt?: string | null;
  resolvedAtScope?: IssueScope | null;
  resolutionNotes?: string | null;
  /** Reference code for nicer alerts (optional). */
  referenceCode?: string | null;
  /** Major or catastrophic near miss: resolve needs an action, or an explicit decision that none is required. */
  requireActionBeforeClose?: boolean;
}

type ActionKind = 'escalate' | 'refer-down' | 'resolve' | 'reopen';

interface DialogState {
  kind: ActionKind;
  open: boolean;
}

const SCOPE_COLOR: Record<IssueScope, 'default' | 'info' | 'warning' | 'error'> = {
  [IssueScope.DISTRICT]: 'info',
  [IssueScope.REGIONAL]: 'warning',
  [IssueScope.HEAD_OFFICE]: 'error',
};

function nextScope(s: IssueScope): IssueScope | null {
  const idx = ISSUE_SCOPE_LADDER.indexOf(s);
  return idx >= 0 && idx < ISSUE_SCOPE_LADDER.length - 1 ? ISSUE_SCOPE_LADDER[idx + 1] : null;
}
function previousScope(s: IssueScope): IssueScope | null {
  const idx = ISSUE_SCOPE_LADDER.indexOf(s);
  return idx > 0 ? ISSUE_SCOPE_LADDER[idx - 1] : null;
}

/** Where on the tier does this user sit? Mirrors the backend logic. */
function actorScope(role: Role): IssueScope {
  if (isGlobalScope(role)) return IssueScope.HEAD_OFFICE;
  if (isRegionalScope(role)) return IssueScope.REGIONAL;
  return IssueScope.DISTRICT;
}

export function EscalationPanel({
  entityType,
  entityId,
  currentScope,
  resolvedAt,
  resolvedAtScope,
  resolutionNotes,
  referenceCode,
  requireActionBeforeClose,
}: Props) {
  const session = useAuthStore((s) => s.session);
  const qc = useQueryClient();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['escalations', entityType, entityId],
    queryFn: () => endpoints.escalationHistory(entityType, entityId),
    enabled: !!entityId,
  });

  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [text, setText] = useState('');
  const [noFurtherAction, setNoFurtherAction] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myScope = session ? actorScope(session.user.role) : IssueScope.DISTRICT;
  const canHandleNearMiss =
    entityType !== EscalationEntityType.NEAR_MISS ||
    (!!session && (session.user.role === Role.SYS_ADMIN || isSafetyOfficer(session.user.role)));
  const canHandleHazard =
    entityType !== EscalationEntityType.HAZARD ||
    (!!session &&
      (session.user.role === Role.SYS_ADMIN || session.user.permissions.includes(Permission.HAZARD_APPROVE)));
  const myRank = ISSUE_SCOPE_LADDER.indexOf(myScope);
  const currentRank = ISSUE_SCOPE_LADDER.indexOf(currentScope);

  const isResolved = !!resolvedAt;
  const upTier = nextScope(currentScope);
  const downTier = previousScope(currentScope);
  const canMove = canHandleNearMiss && canHandleHazard;
  const canEscalate = canMove && !isResolved && !!upTier && myRank >= currentRank;
  const canReferDown = canMove && !isResolved && !!downTier && myRank >= currentRank;
  const canResolve = canMove && !isResolved && myRank >= currentRank;
  const canReopen =
    canMove && isResolved && myRank >= ISSUE_SCOPE_LADDER.indexOf(resolvedAtScope ?? currentScope);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['escalations', entityType, entityId] });
    // Refresh the parent entity (incident, hazard, …).
    qc.invalidateQueries({ queryKey: ['incident', entityId] });
    qc.invalidateQueries({ queryKey: ['incidents'] });
    qc.invalidateQueries({ queryKey: ['console'] });
    qc.invalidateQueries({ queryKey: ['hazards'] });
    qc.invalidateQueries({ queryKey: ['hazard', entityId] });
    qc.invalidateQueries({ queryKey: ['near-miss'] });
    qc.invalidateQueries({ queryKey: ['capa'] });
  };

  const escalateMut = useMutation({
    mutationFn: (reason: string) =>
      endpoints.escalateIssue({ entityType, entityId, reason }),
    onSuccess: invalidate,
  });
  const referMut = useMutation({
    mutationFn: (reason: string) =>
      endpoints.referIssueDown({ entityType, entityId, reason }),
    onSuccess: invalidate,
  });
  const resolveMut = useMutation({
    mutationFn: (notes: string) =>
      endpoints.resolveIssue({
        entityType,
        entityId,
        notes,
        noFurtherAction: requireActionBeforeClose ? noFurtherAction : undefined,
      }),
    onSuccess: invalidate,
  });
  const reopenMut = useMutation({
    mutationFn: (reason: string) => endpoints.reopenIssue({ entityType, entityId, reason }),
    onSuccess: invalidate,
  });

  const submitting =
    escalateMut.isPending || referMut.isPending || resolveMut.isPending || reopenMut.isPending;

  const handleConfirm = async () => {
    if (!dialog) return;
    if (!text.trim()) {
      setError('Please provide a reason / notes.');
      return;
    }
    setError(null);
    try {
      switch (dialog.kind) {
        case 'escalate':
          await escalateMut.mutateAsync(text.trim());
          break;
        case 'refer-down':
          await referMut.mutateAsync(text.trim());
          break;
        case 'resolve':
          await resolveMut.mutateAsync(text.trim());
          break;
        case 'reopen':
          await reopenMut.mutateAsync(text.trim());
          break;
      }
      setText('');
      setDialog(null);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ??
        (err as Error)?.message ??
        'Action failed';
      setError(msg);
    }
  };

  const dialogTitle = useMemo(() => {
    if (!dialog) return '';
    switch (dialog.kind) {
      case 'escalate':
        return `Escalate to ${upTier ? ISSUE_SCOPE_LABEL[upTier] : 'next tier'}`;
      case 'refer-down':
        return `Refer down to ${downTier ? ISSUE_SCOPE_LABEL[downTier] : 'previous tier'}`;
      case 'resolve':
        return `Resolve at ${ISSUE_SCOPE_LABEL[currentScope]}`;
      case 'reopen':
        return 'Reopen issue';
    }
  }, [dialog, upTier, downTier, currentScope]);

  const dialogHelper = useMemo(() => {
    if (!dialog) return '';
    switch (dialog.kind) {
      case 'escalate':
        return 'Why does this need to be handled at a higher tier? Officers there will be notified.';
      case 'refer-down':
        return 'Send the issue back down so the lower tier can investigate further.';
      case 'resolve':
        return requireActionBeforeClose
          ? entityType === EscalationEntityType.HAZARD
            ? 'A high or extreme hazard also needs a saved control, and either a corrective action or a decision that no further action is required.'
            : 'A major or catastrophic near miss also needs a saved cause, and either a corrective action or a decision that no further action is required.'
          : 'Describe the resolution. This will close the issue at the current tier.';
      case 'reopen':
        return 'Why should this be reopened?';
    }
  }, [dialog, entityType, requireActionBeforeClose]);

  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
          <HistoryRoundedIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>
            Escalation ladder
          </Typography>
          <Box flex={1} />
          {isResolved ? (
            <Chip color="success" label={`Resolved at ${ISSUE_SCOPE_LABEL[resolvedAtScope ?? currentScope]}`} />
          ) : (
            <Chip
              color={SCOPE_COLOR[currentScope]}
              label={`Currently at ${ISSUE_SCOPE_LABEL[currentScope]}`}
            />
          )}
        </Stack>

        {referenceCode && (
          <Typography variant="caption" color="text.secondary">
            {referenceCode}
          </Typography>
        )}

        {/* Tier ladder visual */}
        <Stack direction="row" spacing={1} mt={2} flexWrap="wrap">
          {ISSUE_SCOPE_LADDER.map((scope, idx) => {
            const isCurrent = scope === currentScope && !isResolved;
            const passed = idx <= currentRank;
            return (
              <Chip
                key={scope}
                label={ISSUE_SCOPE_LABEL[scope]}
                size="small"
                variant={isCurrent ? 'filled' : 'outlined'}
                color={isCurrent ? SCOPE_COLOR[scope] : passed ? 'primary' : 'default'}
              />
            );
          })}
        </Stack>

        {canHandleNearMiss && (
        <Stack direction="row" spacing={1} mt={2} flexWrap="wrap">
          <Tooltip
            title={canEscalate ? '' : isResolved ? 'Already resolved' : 'No higher tier or you lack authority'}
          >
            <span>
              <Button
                size="small"
                variant="contained"
                color="warning"
                startIcon={<ArrowUpwardRoundedIcon />}
                disabled={!canEscalate || submitting}
                onClick={() => {
                  setError(null);
                  setText('');
                  setDialog({ kind: 'escalate', open: true });
                }}
              >
                Escalate {upTier ? `→ ${ISSUE_SCOPE_LABEL[upTier]}` : ''}
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={canReferDown ? '' : 'No lower tier or you lack authority'}>
            <span>
              <Button
                size="small"
                variant="outlined"
                startIcon={<ArrowDownwardRoundedIcon />}
                disabled={!canReferDown || submitting}
                onClick={() => {
                  setError(null);
                  setText('');
                  setDialog({ kind: 'refer-down', open: true });
                }}
              >
                Refer down
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={canResolve ? '' : 'You lack authority at this tier'}>
            <span>
              <Button
                size="small"
                variant="contained"
                color="success"
                startIcon={<CheckCircleRoundedIcon />}
                disabled={!canResolve || submitting}
                onClick={() => {
                  setError(null);
                  setText('');
                  setDialog({ kind: 'resolve', open: true });
                }}
              >
                Resolve
              </Button>
            </span>
          </Tooltip>
          {isResolved && (
            <Tooltip title={canReopen ? '' : 'You lack authority to reopen'}>
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<RestartAltRoundedIcon />}
                  disabled={!canReopen || submitting}
                  onClick={() => {
                    setError(null);
                    setText('');
                    setDialog({ kind: 'reopen', open: true });
                  }}
                >
                  Reopen
                </Button>
              </span>
            </Tooltip>
          )}
        </Stack>
        )}

        {isResolved && resolutionNotes && (
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Resolution notes</Typography>
            <Typography variant="body2">{resolutionNotes}</Typography>
          </Alert>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="overline" color="text.secondary">
          Trail
        </Typography>
        {isLoading ? (
          <Typography variant="body2" color="text.secondary" mt={1}>
            Loading history…
          </Typography>
        ) : history.length === 0 ? (
          <Typography variant="body2" color="text.secondary" mt={1}>
            No transitions yet — this issue is still being handled at the original tier.
          </Typography>
        ) : (
          <Stack spacing={1.5} mt={1}>
            {history.map((row) => (
              <TrailItem key={row.id} row={row} />
            ))}
          </Stack>
        )}
      </CardContent>

      <Dialog open={!!dialog} onClose={() => !submitting && setDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {dialogHelper}
          </Typography>
          <TextField
            label={dialog?.kind === 'resolve' ? 'Resolution notes' : 'Reason'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            multiline
            minRows={3}
            fullWidth
            autoFocus
          />
          {dialog?.kind === 'resolve' && requireActionBeforeClose && (
            <FormControlLabel
              sx={{ mt: 1 }}
              control={<Checkbox checked={noFurtherAction} onChange={(e) => setNoFurtherAction(e.target.checked)} />}
              label="No further action is required"
            />
          )}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleConfirm} disabled={submitting}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

function TrailItem({ row }: { row: EscalationDto }) {
  const verb =
    row.action === EscalationAction.ESCALATE
      ? 'Escalated'
      : row.action === EscalationAction.REFER_DOWN
        ? 'Referred down'
        : row.action === EscalationAction.RESOLVE
          ? 'Resolved'
          : row.action === EscalationAction.REOPEN
            ? 'Reopened'
            : 'Reassigned';
  const Icon =
    row.action === EscalationAction.ESCALATE
      ? ArrowUpwardRoundedIcon
      : row.action === EscalationAction.REFER_DOWN
        ? ArrowDownwardRoundedIcon
        : row.action === EscalationAction.RESOLVE
          ? CheckCircleRoundedIcon
          : RestartAltRoundedIcon;

  const arrow =
    row.action === EscalationAction.ESCALATE || row.action === EscalationAction.REFER_DOWN
      ? `${ISSUE_SCOPE_LABEL[row.fromScope]} → ${ISSUE_SCOPE_LABEL[row.toScope]}`
      : `at ${ISSUE_SCOPE_LABEL[row.toScope]}`;

  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <IconButton size="small" disabled sx={{ p: 0.5, mt: '2px' }}>
        <Icon fontSize="small" />
      </IconButton>
      <Box flex={1}>
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
          <Typography variant="body2" fontWeight={600}>
            {verb} {arrow}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {new Date(row.createdAt).toLocaleString()}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          by {row.fromUser?.fullName ?? row.fromUser?.email ?? row.fromUserId.slice(0, 8)}
        </Typography>
        <Typography variant="body2" mt={0.5}>
          {row.reason}
        </Typography>
      </Box>
    </Stack>
  );
}
