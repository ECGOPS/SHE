import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertTitle, Button, Snackbar } from '@mui/material';
import { useNotificationsStore, InboxNotification } from '../stores/notifications.store';

function severity(p: InboxNotification['priority']): 'info' | 'warning' | 'error' | 'success' {
  switch (p) {
    case 'CRITICAL':
      return 'error';
    case 'HIGH':
      return 'warning';
    case 'NORMAL':
      return 'info';
    default:
      return 'success';
  }
}

/**
 * Lightweight global toast that surfaces incoming realtime notifications.
 * Auto-dismisses after 6 s. Clicking "Open" navigates to the linked route
 * (when the broadcast included one) and marks the notification read.
 */
export function NotificationsToast() {
  const navigate = useNavigate();
  const toast = useNotificationsStore((s) => s.toast);
  const clearToast = useNotificationsStore((s) => s.clearToast);
  const markRead = useNotificationsStore((s) => s.markRead);

  // Keep the last toast on screen while the Snackbar plays its exit
  // transition; unmounting on clear made it vanish without one.
  const [shown, setShown] = useState(toast);
  if (toast && toast !== shown) setShown(toast);

  if (!shown) return null;
  const route = (shown.payload as { route?: string } | undefined)?.route;

  return (
    <Snackbar
      open={!!toast}
      autoHideDuration={6000}
      onClose={(_event, reason) => {
        // A click elsewhere in the app should not throw away an alert.
        if (reason === 'clickaway') return;
        clearToast();
      }}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      sx={{
        mt: {
          xs: 'calc(56px + env(safe-area-inset-top))',
          md: 'calc(64px + env(safe-area-inset-top))',
        },
      }}
    >
      <Alert
        severity={severity(shown.priority)}
        onClose={() => clearToast()}
        variant="filled"
        sx={{
          width: { xs: '100%', sm: 'auto' },
          minWidth: { xs: 0, sm: 280 },
          maxWidth: { xs: '100%', sm: 460 },
          alignItems: 'flex-start',
        }}
        action={
          route ? (
            <Button
              size="small"
              color="inherit"
              onClick={() => {
                void markRead(shown.id);
                clearToast();
                navigate(route);
              }}
            >
              Open
            </Button>
          ) : undefined
        }
      >
        <AlertTitle sx={{ mb: 0.25 }}>{shown.title}</AlertTitle>
        {shown.body}
      </Alert>
    </Snackbar>
  );
}
