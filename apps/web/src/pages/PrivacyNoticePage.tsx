import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import { useAuthStore } from '../stores/auth.store';
import { homePath } from '../layouts/nav-access';
import { EcgLogo } from '../components/EcgLogo';
import { api, unwrap } from '../api/client';
import { PRIVACY_READ_KEY } from '../components/PrivacyAcknowledgement';
import { PrivacyNoticeBody, type PrivacyNoticeSection } from '../components/PrivacyNoticeBody';
import { Role } from '@ecg-she/shared';

/** Full-screen notice shown before the sign-in form. */
export function PrivacyNoticePage() {
  const session = useAuthStore((s) => s.session);
  const restoring = useAuthStore((s) => s.restoring);
  const navigate = useNavigate();
  const [readNotice, setReadNotice] = useState(false);
  const [optionalContact, setOptionalContact] = useState(false);
  const [notice, setNotice] = useState<{ effectiveDate: string; sections: PrivacyNoticeSection[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void unwrap<{ effectiveDate: string; sections: PrivacyNoticeSection[] }>(api.get('/privacy/notice'))
      .then((loaded) => setNotice(loaded))
      .catch(() => setError('The privacy notice could not be loaded. Try again in a moment.'));
  }, []);

  if (restoring) {
    return (
      <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (session) return <Navigate to={homePath(session.user.role ?? Role.STAFF)} replace />;
  if (sessionStorage.getItem(PRIVACY_READ_KEY)) return <Navigate to="/login" replace />;

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #0B1A2B 0%, #0B5394 60%, #1F77BD 100%)',
        py: { xs: 2, sm: 4 },
        pl: { xs: 'max(12px, env(safe-area-inset-left))', sm: 'max(16px, env(safe-area-inset-left))' },
        pr: { xs: 'max(12px, env(safe-area-inset-right))', sm: 'max(16px, env(safe-area-inset-right))' },
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 720, mx: 'auto', my: 'auto', borderRadius: { xs: 2, sm: 3 } }}>
        <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
          <Stack spacing={1} alignItems="center" mb={{ xs: 2, sm: 3 }}>
            <EcgLogo size={{ xs: 72, sm: 88 }} />
            <Typography variant="h5" fontWeight={700} textAlign="center">Privacy notice</Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Read this notice before you sign in to ECG SHE.
            </Typography>
          </Stack>
          <Box sx={{ maxHeight: { xs: '46vh', sm: '52vh' }, overflowY: 'auto', pr: 0.5 }}>
            {notice && <PrivacyNoticeBody effectiveDate={notice.effectiveDate} sections={notice.sections} />}
            {error && <Typography color="error">{error}</Typography>}
          </Box>
          <FormControlLabel
            sx={{ mt: 2, display: 'flex' }}
            control={<Checkbox checked={readNotice} onChange={(e) => setReadNotice(e.target.checked)} />}
            label="I have read this notice"
          />
          <FormControlLabel
            sx={{ display: 'flex' }}
            control={<Checkbox checked={optionalContact} onChange={(e) => setOptionalContact(e.target.checked)} />}
            label="Send optional notices beyond the safety messages my job requires"
          />
          <Button
            fullWidth
            size="large"
            variant="contained"
            sx={{ mt: 2 }}
            disabled={!readNotice || !notice}
            onClick={() => {
              sessionStorage.setItem(PRIVACY_READ_KEY, optionalContact ? 'optional' : 'read');
              navigate('/login');
            }}
          >
            Continue to sign in
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
