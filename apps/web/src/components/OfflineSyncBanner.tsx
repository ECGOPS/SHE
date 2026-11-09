import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import { belongsTo, offlineQueue, setQueueUser, type QueuedRequest } from '../offline/queue';
import { bootstrapAutoSync, flushOfflineQueue } from '../offline/sync';
import { OFFLINE_QUEUE_EVENT } from '../offline/sync-events';
import { useOnline } from '../offline/useOnline';
import { useAuthStore } from '../stores/auth.store';
import { formatDateTime } from './grid-helpers';

const KIND_LABEL: Record<QueuedRequest['kind'], string> = {
  incident: 'Incident',
  hazard: 'Hazard',
  'near-miss': 'Near miss',
  jsa: 'Job safety analysis',
  inspection: 'Inspection',
  'capa-progress': 'Corrective action',
};

function reports(n: number): string {
  return `${n} report${n === 1 ? '' : 's'}`;
}

function describe(item: QueuedRequest): string {
  const p = item.payload as Record<string, unknown>;
  const text = p.title ?? p.assetOrLocation ?? p.workActivity ?? p.jobLocation;
  return typeof text === 'string' && text.trim() ? text.trim() : KIND_LABEL[item.kind];
}

/**
 * Tells people what is happening to reports saved on this device: waiting to
 * send, refused by the server (with the reason), or saved by someone else.
 */
export function OfflineSyncBanner() {
  const online = useOnline();
  const userId = useAuthStore((s) => s.session?.user.id);
  const [items, setItems] = useState<QueuedRequest[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState<number | null>(null);

  const refresh = useCallback(async () => setItems(await offlineQueue.pending()), []);

  useEffect(() => {
    bootstrapAutoSync();
    void refresh();
    const id = setInterval(refresh, 5_000);
    const onChange = () => void refresh();
    window.addEventListener(OFFLINE_QUEUE_EVENT, onChange);
    return () => {
      clearInterval(id);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, onChange);
    };
  }, [refresh]);

  // Stamp new reports with whoever is signed in, and send theirs as soon as
  // they sign in rather than on the next 30-second pass.
  useEffect(() => {
    setQueueUser(userId);
    if (userId && navigator.onLine) void flushOfflineQueue().catch(() => undefined);
  }, [userId]);

  const mine = userId ? items.filter((item) => belongsTo(item, userId)) : [];
  const waiting = mine.filter((item) => !item.rejected);
  const refused = mine.filter((item) => item.rejected);
  const others = userId ? items.length - mine.length : 0;

  let severity: 'info' | 'warning' | 'error' = 'info';
  let message = '';
  if (!userId) {
    if (items.length) message = `${reports(items.length)} saved on this device. Sign in to send ${items.length === 1 ? 'it' : 'them'}.`;
  } else if (refused.length) {
    severity = 'error';
    message = `${reports(refused.length)} couldn't be sent.`;
  } else if (!online) {
    severity = 'warning';
    message = waiting.length
      ? `Offline. ${reports(waiting.length)} saved on this phone will send when you're back online.`
      : 'Offline. Reports you save are kept on this phone and sent when you are back online.';
  } else if (waiting.length) {
    message = `Sending ${reports(waiting.length)} saved on this device…`;
  } else if (others) {
    message = `${reports(others)} saved by another account on this device will send when that person signs in.`;
  }

  const retry = async (id: number) => {
    await offlineQueue.allowRetry(id);
    await flushOfflineQueue().catch(() => undefined);
    await refresh();
  };

  const discard = async (id: number) => {
    await offlineQueue.remove(id);
    setConfirmDiscard(null);
    await refresh();
  };

  return (
    <>
      {message && (
        <Snackbar
          open
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          sx={{
            // Sit below the top bar, and let taps through to the page except
            // on the Review button (on phones it used to cover the menu).
            mt: {
              xs: 'calc(48px + env(safe-area-inset-top))',
              md: 'calc(56px + env(safe-area-inset-top))',
            },
            zIndex: 2000,
            pointerEvents: 'none',
          }}
        >
          <Alert
            severity={severity}
            variant="filled"
            sx={{ borderRadius: 2, alignItems: 'center', '& .MuiAlert-action': { pointerEvents: 'auto' } }}
            action={
              userId && mine.length ? (
                <Button color="inherit" size="small" onClick={() => setReviewOpen(true)}>
                  Review
                </Button>
              ) : undefined
            }
          >
            {message}
          </Alert>
        </Snackbar>
      )}

      <Dialog open={reviewOpen} onClose={() => setReviewOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Reports saved on this device</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            {mine.length === 0 && <Typography color="text.secondary">Everything you saved has been sent.</Typography>}
            {mine.map((item) => (
              <Stack key={item.id} spacing={0.75} sx={{ pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary">
                  {KIND_LABEL[item.kind]} · saved {formatDateTime(item.createdAt)}
                </Typography>
                <Typography fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
                  {describe(item)}
                </Typography>
                {item.rejected ? (
                  <Alert severity="error" sx={{ py: 0 }}>
                    Not accepted: {item.lastError || 'the server refused this report.'}
                  </Alert>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {item.lastError ? `Waiting to send (last try: ${item.lastError})` : 'Waiting to send'}
                  </Typography>
                )}
                {item.id != null && (
                  <Stack direction="row" spacing={1}>
                    {item.rejected && (
                      <Button size="small" variant="outlined" onClick={() => void retry(item.id!)}>
                        Try again
                      </Button>
                    )}
                    {confirmDiscard === item.id ? (
                      <Button size="small" color="error" variant="contained" onClick={() => void discard(item.id!)}>
                        Delete it from this device
                      </Button>
                    ) : (
                      <Button size="small" color="error" onClick={() => setConfirmDiscard(item.id!)}>
                        Discard
                      </Button>
                    )}
                  </Stack>
                )}
              </Stack>
            ))}
            {others > 0 && (
              <Typography variant="body2" color="text.secondary">
                {reports(others)} saved by another account on this device. They will send when that person signs in.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
