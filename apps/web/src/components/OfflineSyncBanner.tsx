import { useEffect, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';
import { offlineQueue } from '../offline/queue';
import { bootstrapAutoSync } from '../offline/sync';

export function OfflineSyncBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    bootstrapAutoSync();
    const update = async () => setPending(await offlineQueue.size());
    void update();
    const id = setInterval(update, 5_000);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (online && pending === 0) return null;

  return (
    <Snackbar
      open
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ mt: 1, zIndex: 2000 }}
    >
      <Alert
        severity={online ? 'info' : 'warning'}
        variant="filled"
        sx={{ borderRadius: 2 }}
      >
        {!online && '⚠ Offline mode — captured data will sync automatically. '}
        {pending > 0 && `${pending} change${pending === 1 ? '' : 's'} queued for sync.`}
      </Alert>
    </Snackbar>
  );
}
