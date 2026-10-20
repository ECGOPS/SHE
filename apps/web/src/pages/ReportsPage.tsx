import { useState } from 'react';
import { Alert, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import { endpoints } from '../api/endpoints';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function errorMessage(err: unknown): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? (err as Error)?.message ?? 'The report could not be prepared';
}

export function ReportsPage() {
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(yearStart);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'excel' | 'pdf') => {
    setError(null);
    setBusy(kind);
    try {
      const response = kind === 'excel' ? await endpoints.reportRegisterExcel(from, to) : await endpoints.reportRegisterPdf(from, to);
      downloadBlob(response.data, kind === 'excel' ? 'she-activity-register.xlsx' : 'she-activity-summary.pdf');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h5" fontWeight={700}>Reports</Typography>
        <Typography variant="body2" color="text.secondary">
          One pack for the period you choose. It includes incidents, near-misses, hazards, job briefings, permits, inspections, audits, environmental events, corrective actions, training, PPE, and health certificates. A district officer sees that district. A regional officer sees the region. Head Office sees every region. Clinical notes are left out.
        </Typography>
      </Stack>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
              <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="contained" startIcon={<DownloadRoundedIcon />} disabled={!!busy} onClick={() => void run('excel')}>
                {busy === 'excel' ? 'Preparing the register…' : 'Download the full register'}
              </Button>
              <Button variant="outlined" startIcon={<DownloadRoundedIcon />} disabled={!!busy} onClick={() => void run('pdf')}>
                {busy === 'pdf' ? 'Preparing the summary…' : 'Download the summary'}
              </Button>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              The register is a workbook with one sheet per activity. The summary is the counts and the items still open, for a management review.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
