import { useState, FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  CircularProgress,
  Divider,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ROLE_LABEL, Role } from '@ecg-she/shared';
import { useAuthStore } from '../stores/auth.store';
import { ENTRA_ENABLED } from '../auth/msal';
import { homePath } from '../layouts/nav-access';
import { EcgLogo } from '../components/EcgLogo';
import { safeImageSrc } from '../security/output';
import { PRIVACY_READ_KEY, recordPrivacyConsent } from '../components/PrivacyAcknowledgement';
import { MicrosoftLogo } from '../components/MicrosoftLogo';

/**
 * Test accounts seeded by `BootstrapService` on first run. The list is
 * compiled only into the Vite dev server, so a production bundle does not
 * contain these passwords.
 */
const TEST_ACCOUNTS: Array<{ email: string; password: string; role: Role; scope: string }> = import.meta.env.DEV ? [
  { email: 'admin@ecg.com.gh',   password: 'Admin@123',    role: Role.SYS_ADMIN,     scope: 'Full system access' },
  { email: 'global@ecg.com.gh',  password: 'Global@123',   role: Role.GLOBAL_USER,   scope: 'Head Office staff — reports like other staff' },
  { email: 'she.global@ecg.com.gh', password: 'Safety@123', role: Role.GLOBAL_SAFETY_OFFICER, scope: 'Head Office safety officer' },
  { email: 'she.ho@ecg.com.gh', password: 'Safety@123', role: Role.HEAD_OFFICE_SHE, scope: 'Head Office SHE' },
  { email: 'she.ae@ecg.com.gh', password: 'Safety@123', role: Role.REGIONAL_SAFETY_OFFICER, scope: 'Accra East safety officer' },
  { email: 'she.ae.mak@ecg.com.gh', password: 'Safety@123', role: Role.DISTRICT_SAFETY_OFFICER, scope: 'Makola safety officer' },
  { email: 'she.asw.adu@ecg.com.gh', password: 'Safety@123', role: Role.DISTRICT_SAFETY_OFFICER, scope: 'Adum safety officer' },
  { email: 'accra.east@ecg.com.gh',  password: 'Region@123', role: Role.REGIONAL_USER, scope: 'Accra East region' },
  { email: 'accra.west@ecg.com.gh',  password: 'Region@123', role: Role.REGIONAL_USER, scope: 'Accra West region' },
  { email: 'ashanti.east@ecg.com.gh',password: 'Region@123', role: Role.REGIONAL_USER, scope: 'Ashanti East region' },
  { email: 'ashanti.west@ecg.com.gh',password: 'Region@123', role: Role.REGIONAL_USER, scope: 'Ashanti West region' },
  { email: 'ashanti.south@ecg.com.gh',password:'Region@123', role: Role.REGIONAL_USER, scope: 'Ashanti South region' },
  { email: 'central@ecg.com.gh', password: 'Region@123',   role: Role.REGIONAL_USER, scope: 'Central region' },
  { email: 'eastern@ecg.com.gh', password: 'Region@123',   role: Role.REGIONAL_USER, scope: 'Eastern region' },
  { email: 'tema@ecg.com.gh',    password: 'Region@123',   role: Role.REGIONAL_USER, scope: 'Tema region' },
  { email: 'volta@ecg.com.gh',   password: 'Region@123',   role: Role.REGIONAL_USER, scope: 'Volta region' },
  { email: 'western@ecg.com.gh', password: 'Region@123',   role: Role.REGIONAL_USER, scope: 'Western region' },
  { email: 'subtransmission.accra@ecg.com.gh', password: 'Region@123', role: Role.REGIONAL_USER, scope: 'Subtransmission Accra' },
  { email: 'makola@ecg.com.gh',  password: 'District@123', role: Role.DISTRICT_USER, scope: 'Makola district (Accra East)' },
  { email: 'adum@ecg.com.gh',    password: 'District@123', role: Role.DISTRICT_USER, scope: 'Adum district (Ashanti West)' },
] : [];

export function LoginPage() {
  const session = useAuthStore((s) => s.session);
  const loginLocal = useAuthStore((s) => s.loginLocal);
  const loginWithMicrosoft = useAuthStore((s) => s.loginWithMicrosoft);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const pendingMfa = useAuthStore((s) => s.pendingMfa);
  const pendingMfaSetup = useAuthStore((s) => s.pendingMfaSetup);
  const completeMfaSetup = useAuthStore((s) => s.completeMfaSetup);
  const restoring = useAuthStore((s) => s.restoring);
  const navigate = useNavigate();

  const [showLocal, setShowLocal] = useState(!ENTRA_ENABLED);
  const [showTestAccounts, setShowTestAccounts] = useState(false);
  const [email, setEmail] = useState(import.meta.env.DEV ? 'admin@ecg.com.gh' : '');
  const [password, setPassword] = useState(import.meta.env.DEV ? 'Admin@123' : '');
  const [mfaCode, setMfaCode] = useState('');

  /** Show pre-seeded credentials only in the Vite dev server, never in a production bundle. */
  const localDevMode = import.meta.env.DEV && !ENTRA_ENABLED;

  if (restoring) {
    return (
      <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (session) return <Navigate to={homePath(session.user.role)} replace />;
  if (!sessionStorage.getItem(PRIVACY_READ_KEY) && !pendingMfa && !pendingMfaSetup) {
    return <Navigate to="/notice" replace />;
  }

  const rememberConsent = async () => {
    const choice = sessionStorage.getItem(PRIVACY_READ_KEY);
    try {
      await recordPrivacyConsent(choice === 'optional');
      sessionStorage.removeItem(PRIVACY_READ_KEY);
    } catch {
      // The signed-in notice records it if this call does not complete.
    }
  };

  const submitLocal = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (pendingMfaSetup) {
        await completeMfaSetup(mfaCode);
        await rememberConsent();
        navigate(homePath(useAuthStore.getState().session?.user.role ?? Role.STAFF));
        return;
      }
      const r = await loginLocal(
        pendingMfa?.email ?? email,
        pendingMfa?.password ?? password,
        mfaCode || undefined,
      );
      if (!r.requiresMfa && !r.requiresMfaSetup) {
        await rememberConsent();
        navigate(homePath(useAuthStore.getState().session?.user.role ?? Role.STAFF));
      }
    } catch {
      // surfaced via store.error
    }
  };

  return (
    <Box
      sx={{
        height: '100%',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #0B1A2B 0%, #0B5394 60%, #1F77BD 100%)',
        py: { xs: 2, sm: 4 },
        pl: { xs: 'max(12px, env(safe-area-inset-left))', sm: 'max(16px, env(safe-area-inset-left))' },
        pr: { xs: 'max(12px, env(safe-area-inset-right))', sm: 'max(16px, env(safe-area-inset-right))' },
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 460, mx: 'auto', my: 'auto', flexShrink: 0, borderRadius: { xs: 2, sm: 3 } }}>
        <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
          <Stack spacing={1} alignItems="center" mb={{ xs: 2, sm: 3 }}>
            <EcgLogo size={{ xs: 72, sm: 88 }} />
            <Typography variant="h5" fontWeight={700} textAlign="center" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
              Welcome to ECG SHE
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Safety, Health &amp; Environment Management System
            </Typography>
          </Stack>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {ENTRA_ENABLED && (
            <Stack spacing={2}>
              <Button
                fullWidth
                size="large"
                variant="contained"
                disabled={loading}
                onClick={() => void loginWithMicrosoft()}
                startIcon={<MicrosoftLogo />}
                sx={{
                  bgcolor: '#2F2F2F',
                  '&:hover': { bgcolor: '#1f1f1f' },
                  py: 1.4,
                  px: { xs: 1.5, sm: 2 },
                  fontSize: { xs: 14, sm: 15 },
                  lineHeight: 1.3,
                  whiteSpace: 'normal',
                }}
              >
                Sign in with your ECG Microsoft account
              </Button>
              <Typography variant="caption" color="text.secondary" textAlign="center">
                Single sign-on via Microsoft Entra ID — no password needed.
                <br />
                e.g. <strong>user@ecg.com.gh</strong>
              </Typography>
              <Divider>or</Divider>
              <Link
                component="button"
                underline="hover"
                onClick={() => setShowLocal((v) => !v)}
                sx={{ textAlign: 'center' }}
              >
                {showLocal ? 'Hide local sign-in' : 'Use a local / system account'}
              </Link>
            </Stack>
          )}

          <Collapse in={showLocal}>
            <Box mt={ENTRA_ENABLED ? 2 : 0}>
              <form onSubmit={submitLocal}>
                <Stack spacing={2}>
                  {!pendingMfa && !pendingMfaSetup && (
                    <>
                      <TextField
                        label="Work email" type="email" value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="username" autoFocus fullWidth required
                      />
                      <TextField
                        label="Password" type="password" value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password" fullWidth required
                      />
                    </>
                  )}
                  {pendingMfaSetup && (
                    <Stack spacing={1} alignItems="center">
                      <Alert severity="warning">
                        This account must enroll an authenticator app before it can sign in.
                      </Alert>
                      <Box
                        component="img"
                        src={safeImageSrc(pendingMfaSetup.qrDataUrl)}
                        alt="Authenticator QR code"
                        sx={{ width: 'min(180px, 70vw)', height: 'auto', aspectRatio: '1' }}
                      />
                      <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ wordBreak: 'break-all' }}>
                        Manual key: {pendingMfaSetup.secret}
                      </Typography>
                    </Stack>
                  )}
                  {(pendingMfa || pendingMfaSetup) && (
                    <TextField
                      label="6-digit MFA code" value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      autoFocus fullWidth required
                      inputProps={{ inputMode: 'numeric', pattern: '[0-9]{6}', maxLength: 6 }}
                    />
                  )}
                  <Button type="submit" variant="outlined" size="large" disabled={loading}>
                    {loading ? <CircularProgress size={22} /> : pendingMfa || pendingMfaSetup ? 'Verify code' : 'Sign in'}
                  </Button>
                </Stack>
              </form>
            </Box>
          </Collapse>

          {localDevMode && (
            <Box mt={3}>
              <Link
                component="button"
                underline="hover"
                onClick={() => setShowTestAccounts((v) => !v)}
                sx={{ display: 'block', textAlign: 'center', width: '100%', fontSize: 13 }}
              >
                {showTestAccounts ? 'Hide test accounts' : 'Show test accounts (local dev)'}
              </Link>
              <Collapse in={showTestAccounts}>
                <Alert severity="info" variant="outlined" sx={{ mt: 1.5, py: 0 }}>
                  <Typography variant="caption" component="span">
                    Click any row to pre-fill the form. These accounts are seeded
                    automatically on first run — change passwords before any
                    non-local deployment.
                  </Typography>
                </Alert>
                <Box
                  sx={{
                    mt: 1,
                    maxHeight: { xs: '46vh', sm: 280 },
                    overflow: 'auto',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  {TEST_ACCOUNTS.map((a) => (
                    <Box
                      key={a.email}
                      component="button"
                      type="button"
                      title={a.scope}
                      onClick={() => {
                        setEmail(a.email);
                        setPassword(a.password);
                        setShowLocal(true);
                      }}
                      sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        justifyContent: 'space-between',
                        gap: 0.75,
                        width: '100%',
                        textAlign: 'left',
                        border: 0,
                        borderBottom: 1,
                        borderColor: 'divider',
                        bgcolor: 'transparent',
                        px: 1.5,
                        py: 1,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontFamily: 'monospace', fontSize: 12, overflowWrap: 'anywhere', lineHeight: 1.35 }}>
                          {a.email}
                        </Typography>
                        <Chip
                          size="small"
                          label={ROLE_LABEL[a.role]}
                          color={
                            a.role === Role.SYS_ADMIN
                              ? 'error'
                              : a.role === Role.GLOBAL_SAFETY_OFFICER || a.role === Role.HEAD_OFFICE_SHE
                                ? 'warning'
                                : a.role === Role.REGIONAL_SAFETY_OFFICER
                                  ? 'info'
                                  : a.role === Role.DISTRICT_SAFETY_OFFICER
                                    ? 'success'
                                    : 'default'
                          }
                          sx={{ mt: 0.5, fontSize: 10, height: 'auto', maxWidth: '100%', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 } }}
                        />
                      </Box>
                      <Typography sx={{ fontFamily: 'monospace', fontSize: 12, flexShrink: 0 }}>
                        {a.password}
                      </Typography>
                    </Box>
                  ))}
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ px: 1.5, py: 1 }}>
                    Every region and district also has a safety officer. Email is she.region or she.region.district, password Safety@123. For example she.ae@ecg.com.gh and she.ae.mak@ecg.com.gh.
                  </Typography>
                </Box>
              </Collapse>
            </Box>
          )}

        </CardContent>
      </Card>
    </Box>
  );
}
