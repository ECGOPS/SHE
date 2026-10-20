import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { api, unwrap } from '../api/client';
import { PrivacyNoticeBody, type PrivacyNoticeSection } from '../components/PrivacyNoticeBody';

interface PrivacyProfile {
  fullName: string;
  email: string;
  phone: string | null;
  acceptedAt: string | null;
  optionalContactConsent: boolean;
  erasedAt: string | null;
}

interface PrivacyCategory {
  data: string;
  purpose: string;
  lawfulBasis: string;
  whoCanSeeIt: string;
  retention: string;
}

interface PrivacyNotice {
  version: string;
  effectiveDate: string;
  controller: string;
  law: string;
  contact: string;
  sections: PrivacyNoticeSection[];
  categories: PrivacyCategory[];
  rights: string[];
  thirdParties: Array<{ party: string; purpose: string; crossBorder: string }>;
  consent: string;
}

export function PrivacyPage() {
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ['privacy-me'],
    queryFn: () => unwrap<PrivacyProfile>(api.get('/privacy/me')),
  });
  const notice = useQuery({
    queryKey: ['privacy-notice'],
    queryFn: () => unwrap<PrivacyNotice>(api.get('/privacy/notice')),
  });
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const correct = useMutation({
    mutationFn: () => unwrap(api.patch('/privacy/me', { fullName: fullName || undefined, phone })),
    onSuccess: () => {
      setMessage('Your name and phone were updated.');
      void queryClient.invalidateQueries({ queryKey: ['privacy-me'] });
    },
  });

  const withdraw = useMutation({
    mutationFn: () => unwrap(api.post('/privacy/me/withdraw')),
    onSuccess: () => {
      setMessage('Optional contact is off. Safety notices for your job still apply.');
      void queryClient.invalidateQueries({ queryKey: ['privacy-me'] });
    },
  });

  const erase = useMutation({
    mutationFn: () => unwrap(api.post('/privacy/me/erasure')),
    onSuccess: async () => {
      setMessage('Your account identifiers and clinical notes were erased. Sign in has ended.');
      const { useAuthStore } = await import('../stores/auth.store');
      await useAuthStore.getState().logout();
    },
  });

  async function downloadExport() {
    const pack = await unwrap<Record<string, unknown>>(api.get('/privacy/me/export'));
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ecg-she-my-data.json';
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Your copy was downloaded. It stays on this device.');
  }

  const me = profile.data;
  const info = notice.data;

  return (
    <Stack spacing={3} sx={{ maxWidth: 840 }}>
      <Box>
        <Typography variant="h5" fontWeight={700}>Your information</Typography>
        <Typography color="text.secondary">
          {info ? `${info.controller} · ${info.law}` : 'Privacy notice'}
        </Typography>
      </Box>
      {message && <Alert severity="success">{message}</Alert>}
      {(correct.error || withdraw.error || erase.error) && (
        <Alert severity="error">The request was not completed. Sign in again if a privileged action asked for a fresh password.</Alert>
      )}
      {info && (
        <Stack spacing={1.5}>
          <PrivacyNoticeBody effectiveDate={info.effectiveDate} sections={info.sections} />
          <Typography fontWeight={700}>Record of processing</Typography>
          <Typography>{info.consent}</Typography>
          {info.categories.map((category) => (
            <Box key={category.data} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
              <Typography fontWeight={700}>{category.data}</Typography>
              <Typography variant="body2">Purpose: {category.purpose}</Typography>
              <Typography variant="body2">Lawful basis: {category.lawfulBasis}</Typography>
              <Typography variant="body2">Who can see it: {category.whoCanSeeIt}</Typography>
              <Typography variant="body2">Retention: {category.retention}</Typography>
            </Box>
          ))}
          <Typography fontWeight={700}>Your rights</Typography>
          {info.rights.map((right) => (
            <Typography key={right} variant="body2">{right}</Typography>
          ))}
          <Typography fontWeight={700}>Other organisations</Typography>
          {info.thirdParties.map((party) => (
            <Typography key={party.party} variant="body2">
              {party.party}. {party.purpose}. {party.crossBorder}
            </Typography>
          ))}
          <Typography variant="body2">Questions: {info.contact}</Typography>
        </Stack>
      )}
      {me && (
        <Stack spacing={2}>
          <Typography>Signed in as {me.fullName} · {me.email}</Typography>
          <Typography variant="body2">
            Notice {me.acceptedAt ? `accepted ${new Date(me.acceptedAt).toLocaleString()}` : 'not yet accepted'}.
            Optional contact is {me.optionalContactConsent ? 'on' : 'off'}.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField label="Corrected name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <TextField label="Corrected phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button variant="contained" disabled={correct.isPending} onClick={() => correct.mutate()}>Save correction</Button>
          </Stack>
          <Button variant="outlined" onClick={() => void downloadExport()}>Download my data</Button>
          <Button variant="outlined" disabled={withdraw.isPending || !me.optionalContactConsent} onClick={() => withdraw.mutate()}>
            Withdraw optional contact
          </Button>
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
            <Typography fontWeight={700}>Erase my account</Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              This removes your name, email, phone, and clinical notes, and signs you out. Incident investigations stay on the safety record.
            </Typography>
            <TextField label="Type ERASE" value={confirm} onChange={(e) => setConfirm(e.target.value)} sx={{ mr: 1 }} />
            <Button color="error" variant="contained" disabled={confirm !== 'ERASE' || erase.isPending} onClick={() => erase.mutate()}>
              Erase
            </Button>
          </Box>
        </Stack>
      )}
    </Stack>
  );
}
