import { useState } from 'react';
import { Alert, Button, Stack } from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';

export function ExportReportButton({
  filename,
  download,
}: {
  filename: string;
  download: () => Promise<{ data: Blob }>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await download();
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('The report could not be prepared.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={1} alignItems={{ sm: 'flex-end' }}>
      <Button
        variant="contained"
        startIcon={<DownloadRoundedIcon />}
        disabled={busy}
        onClick={() => void run()}
      >
        {busy ? 'Preparing report…' : 'Export PDF report'}
      </Button>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Stack>
  );
}
