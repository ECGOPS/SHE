import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Typography,
} from '@mui/material';
import { api, unwrap } from '../api/client';
import { PrivacyNoticeBody, type PrivacyNoticeSection } from './PrivacyNoticeBody';

export const PRIVACY_READ_KEY = 'ecg-she-privacy-read';

export function recordPrivacyConsent(optionalContact: boolean) {
  return unwrap(api.post('/privacy/me/consent', { accepted: true, optionalContact }));
}

interface PrivacyProfile {
  acceptedAt: string | null;
  acceptedVersion: string | null;
  noticeVersion: string;
}

interface PrivacyNotice {
  effectiveDate: string;
  sections: PrivacyNoticeSection[];
  contact: string;
}

/**
 * Shown only when a signed-in person has not already read the notice on the login page.
 * The notice itself is presented before sign-in.
 */
export function PrivacyAcknowledgement() {
  const queryClient = useQueryClient();
  const [optionalContact, setOptionalContact] = useState(false);
  const [saving, setSaving] = useState(false);
  const readBeforeLogin = sessionStorage.getItem(PRIVACY_READ_KEY);
  const profile = useQuery({
    queryKey: ['privacy-me'],
    queryFn: () => unwrap<PrivacyProfile>(api.get('/privacy/me')),
  });
  const needsNotice = profile.isSuccess
    && (profile.data.acceptedAt == null || profile.data.acceptedVersion !== profile.data.noticeVersion);
  const notice = useQuery({
    queryKey: ['privacy-notice'],
    queryFn: () => unwrap<PrivacyNotice>(api.get('/privacy/notice')),
    enabled: needsNotice && !readBeforeLogin,
  });

  useEffect(() => {
    if (!readBeforeLogin || !profile.isSuccess || !needsNotice) return;
    void recordPrivacyConsent(readBeforeLogin === 'optional')
      .then(() => {
        sessionStorage.removeItem(PRIVACY_READ_KEY);
        return queryClient.invalidateQueries({ queryKey: ['privacy-me'] });
      })
      .catch(() => undefined);
  }, [needsNotice, profile.isSuccess, queryClient, readBeforeLogin]);

  if (!needsNotice || readBeforeLogin) return null;

  return (
    <Dialog open fullWidth maxWidth="sm">
      <DialogTitle>Privacy notice</DialogTitle>
      <DialogContent>
        {notice.data && (
          <PrivacyNoticeBody effectiveDate={notice.data.effectiveDate} sections={notice.data.sections} />
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Questions: {notice.data?.contact ?? 'she@ecg.com.gh'}
        </Typography>
        <FormControlLabel
          control={<Checkbox checked={optionalContact} onChange={(e) => setOptionalContact(e.target.checked)} />}
          label="Send me optional notices beyond the safety messages my job requires"
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          disabled={saving}
          onClick={() => {
            setSaving(true);
            void unwrap(api.post('/privacy/me/consent', { accepted: true, optionalContact }))
              .then(() => queryClient.invalidateQueries({ queryKey: ['privacy-me'] }))
              .finally(() => setSaving(false));
          }}
        >
          I have read this notice
        </Button>
      </DialogActions>
    </Dialog>
  );
}
