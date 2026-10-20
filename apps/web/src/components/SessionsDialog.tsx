import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { endpoints } from '../api/endpoints';

export function SessionsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => endpoints.sessions(),
    enabled: open,
  });
  const unusual = (sessions.data ?? []).some((row) => row.unusual);

  const revoke = async (id: string) => {
    await endpoints.revokeSession(id);
    await qc.invalidateQueries({ queryKey: ['sessions'] });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Signed-in sessions</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          {unusual && (
            <Alert severity="warning">
              This account is signed in from more than one network address.
            </Alert>
          )}
          {(sessions.data ?? []).map((row) => (
            <Stack key={row.id} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600}>
                  {row.current ? 'This browser' : 'Another session'}
                  {row.unusual ? ' · different network' : ''}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {row.ip || 'Unknown address'} · last used {new Date(row.lastSeenAt).toLocaleString()}
                </Typography>
              </Stack>
              {!row.current && (
                <Button size="small" color="error" onClick={() => void revoke(row.id)}>
                  Revoke
                </Button>
              )}
            </Stack>
          ))}
          {sessions.data?.length === 0 && (
            <Typography variant="body2" color="text.secondary">No active sessions.</Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
