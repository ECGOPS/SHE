import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { Permission } from '@ecg-she/shared';
import { endpoints } from '../../api/endpoints';
import { useAuthStore } from '../../stores/auth.store';

function words(value: unknown): string {
  return String(value ?? '').replaceAll('_', ' ');
}

function errorMessage(err: unknown): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? (err as Error)?.message ?? 'Request failed';
}

export function PpeItemPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canManage = (useAuthStore((s) => s.session?.user.permissions) ?? []).includes(Permission.PPE_MANAGE);
  const [error, setError] = useState<string | null>(null);
  const item = useQuery({ queryKey: ['ppe-item', id], queryFn: () => endpoints.ppeItem(id!), enabled: !!id });
  const data = item.data as {
    name?: string;
    sku?: string;
    category?: string;
    stockOnHand?: number;
    reorderLevel?: number;
    stockLow?: boolean;
    voltageClass?: string | null;
    retestIntervalMonths?: number | null;
    shelfLifeMonths?: number | null;
    enStandard?: string | null;
    nfpaArcCategory?: string | null;
    issues?: Array<{
      id: string;
      status: string;
      state: string;
      quantity: number;
      size?: string | null;
      serialNumber?: string | null;
      issuedOn?: string | null;
      expiresOn?: string | null;
      nextTestOn?: string | null;
      employee?: { fullName?: string };
    }>;
  } | undefined;

  const withdraw = useMutation({
    mutationFn: ({ issueId, status }: { issueId: string; status: string }) => endpoints.withdrawPpe(issueId, { status }),
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ['ppe-item', id] });
      await qc.invalidateQueries({ queryKey: ['ppe-due'] });
      await qc.invalidateQueries({ queryKey: ['ppe-items'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  if (item.isLoading || !data) return <Typography>Loading...</Typography>;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
        <Stack spacing={0.5}>
          <Typography variant="h5" fontWeight={700}>{data.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {data.sku} · {words(data.category)}
            {data.voltageClass ? ` · ${words(data.voltageClass)}` : ''}
          </Typography>
        </Stack>
        {canManage && <Button variant="contained" onClick={() => navigate('/ppe/issue')}>Issue PPE</Button>}
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {data.stockLow && <Alert severity="warning">{data.stockOnHand} in stock. Reorder at {data.reorderLevel}.</Alert>}
      <Card>
        <CardContent>
          <Typography variant="body2">In stock: {data.stockOnHand}</Typography>
          <Typography variant="body2">Reorder at: {data.reorderLevel ?? 0}</Typography>
          {data.shelfLifeMonths ? <Typography variant="body2">Shelf life: {data.shelfLifeMonths} months</Typography> : null}
          {data.retestIntervalMonths ? <Typography variant="body2">Retest every {data.retestIntervalMonths} months</Typography> : null}
          {data.enStandard ? <Typography variant="body2">{data.enStandard}</Typography> : null}
          {data.nfpaArcCategory ? <Typography variant="body2">Arc category {words(data.nfpaArcCategory)}</Typography> : null}
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={700}>Who has it</Typography>
          {!data.issues?.length && <Alert severity="info" sx={{ mt: 1 }}>Nobody has been issued this item.</Alert>}
          <Stack spacing={1.5} mt={1}>
            {(data.issues ?? []).map((row) => (
              <Stack key={row.id} spacing={0.5}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {row.employee?.fullName ?? 'Worker'} · {row.quantity}
                    {row.size ? ` · size ${row.size}` : ''}
                    {row.serialNumber ? ` · ${row.serialNumber}` : ''}
                    {row.issuedOn ? ` · issued ${row.issuedOn}` : ''}
                    {row.nextTestOn ? ` · test ${row.nextTestOn}` : ''}
                    {row.expiresOn ? ` · expires ${row.expiresOn}` : ''}
                  </Typography>
                  <Chip size="small" label={words(row.state === 'CLOSED' ? row.status : row.state)} color={row.state === 'CURRENT' ? 'success' : row.state === 'EXPIRING' || row.state === 'TEST_SOON' ? 'warning' : row.state === 'CLOSED' ? 'default' : 'error'} />
                </Stack>
                {canManage && row.status === 'ISSUED' && (
                  <Stack direction="row" spacing={1}>
                    <Button size="small" onClick={() => withdraw.mutate({ issueId: row.id, status: 'RETURNED' })}>Returned</Button>
                    <Button size="small" color="warning" onClick={() => withdraw.mutate({ issueId: row.id, status: 'DAMAGED' })}>Damaged</Button>
                    <Button size="small" color="warning" onClick={() => withdraw.mutate({ issueId: row.id, status: 'LOST' })}>Lost</Button>
                  </Stack>
                )}
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
