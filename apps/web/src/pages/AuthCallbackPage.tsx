import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { useAuthStore } from '../stores/auth.store';
import { homePath } from '../layouts/nav-access';
import { Role } from '@ecg-she/shared';

/**
 * Lands here after Microsoft Entra ID redirects the browser back with the
 * authorisation code in the URL. We let MSAL parse the response, exchange
 * the resulting account for an API-scoped access token, and bridge it into
 * our zustand session. Then we route the user to the dashboard.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const completeMicrosoftRedirect = useAuthStore((s) => s.completeMicrosoftRedirect);
  const session = useAuthStore((s) => s.session);
  const error = useAuthStore((s) => s.error);

  useEffect(() => {
    void completeMicrosoftRedirect();
  }, [completeMicrosoftRedirect]);

  useEffect(() => {
    if (session) navigate(homePath(session.user.role ?? Role.STAFF), { replace: true });
  }, [session, navigate]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(135deg, #0B1A2B 0%, #0B5394 100%)',
        color: 'white',
        p: 2,
      }}
    >
      <Stack alignItems="center" spacing={2}>
        <CircularProgress color="inherit" />
        <Typography variant="h6">Completing Microsoft sign-in…</Typography>
        {error && (
          <Typography color="error.light" maxWidth={420} textAlign="center">
            {error}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}
