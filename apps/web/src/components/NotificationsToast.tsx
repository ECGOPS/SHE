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

  if (!toast) return null;
  const route = (toast.payload as { route?: string } | undefined)?.route;

  return (
    <Snackbar
      open={!!toast}
      autoHideDuration={6000}
      onClose={() => clearToast()}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      sx={{ mt: { xs: 7, md: 8 } }}
    >
      <Alert
        severity={severity(toast.priority)}
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
                void markRead(toast.id);
                clearToast();
                navigate(route);
              }}
            >
              Open
            </Button>
          ) : undefined
        }
      >
        <AlertTitle sx={{ mb: 0.25 }}>{toast.title}</AlertTitle>
        {toast.body}
      </Alert>
    </Snackbar>
  );
}
