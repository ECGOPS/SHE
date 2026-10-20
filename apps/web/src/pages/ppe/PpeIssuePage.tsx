import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Autocomplete, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { endpoints } from '../../api/endpoints';
import { SupervisorField } from '../jsa/ChoiceFields';

const REASONS = ['NEW_HIRE', 'REPLACEMENT', 'ROUTINE_REFRESH', 'DAMAGED_REPLACEMENT'];
const SIZED = new Set(['HAND', 'FOOT', 'BODY', 'FALL_PROTECTION']);
const SERIALISED = new Set(['INSULATING', 'FALL_PROTECTION']);

function errorMessage(err: unknown): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? (err as Error)?.message ?? 'Request failed';
}

function words(value: string): string {
  return value.replaceAll('_', ' ');
}

export function PpeIssuePage() {
  const navigate = useNavigate();
  const [itemSearch, setItemSearch] = useState('');
  const [itemText, setItemText] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setItemSearch(itemText.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [itemText]);
  const items = useQuery({
    queryKey: ['ppe-items', itemSearch],
    queryFn: () => endpoints.ppeItems({ search: itemSearch || undefined, pageSize: 25 }),
  });
  const people = useQuery({ queryKey: ['ppe-people'], queryFn: endpoints.ppePeople });
  const catalogue = (items.data?.items ?? []) as Array<{ id: string; name: string; sku: string; category: string; stockOnHand: number }>;
  const [ppeItemId, setPpeItemId] = useState('');
  const [chosenItem, setChosenItem] = useState<(typeof catalogue)[number] | null>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [issuedOn, setIssuedOn] = useState(new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState('1');
  const [size, setSize] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [issueReason, setIssueReason] = useState('ROUTINE_REFRESH');
  const [inspectionResult, setInspectionResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  const item = catalogue.find((row) => row.id === ppeItemId) ?? (chosenItem?.id === ppeItemId ? chosenItem : undefined);
  const serialised = !!item && SERIALISED.has(item.category);
  const sized = !!item && SIZED.has(item.category);

  const save = useMutation({
    mutationFn: () => endpoints.issuePpe({
      ppeItemId,
      employeeId,
      issuedOn,
      quantity: serialised ? 1 : Number(quantity),
      size: sized ? size.trim() : undefined,
      serialNumber: serialised ? serialNumber.trim() : undefined,
      batchNumber: batchNumber.trim() || undefined,
      issueReason,
      inspectionResult,
    }),
    onSuccess: (row) => navigate(`/ppe/${row.ppeItemId}`),
    onError: (err) => setError(errorMessage(err)),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!employeeId) {
      setError('Choose a person from the list.');
      return;
    }
    if (inspectionResult !== 'PASS') {
      setError('A pair that fails the pre-use check is not issued.');
      return;
    }
    save.mutate();
  };

  return (
    <Stack spacing={2} component="form" onSubmit={onSubmit}>
      <Typography variant="h5" fontWeight={700}>Issue PPE</Typography>
      <Typography variant="body2" color="text.secondary">
        Stock goes down by the quantity issued. A failed pre-use check stays in the store.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Autocomplete
              options={chosenItem && !catalogue.some((row) => row.id === chosenItem.id) ? [chosenItem, ...catalogue] : catalogue}
              value={catalogue.find((row) => row.id === ppeItemId) ?? (chosenItem?.id === ppeItemId ? chosenItem : null)}
              loading={items.isFetching}
              onInputChange={(_, text) => setItemText(text)}
              onChange={(_, row) => { setChosenItem(row); setPpeItemId(row?.id ?? ''); }}
              getOptionLabel={(row) => `${row.name} · ${row.sku} · ${row.stockOnHand} in stock`}
              isOptionEqualToValue={(option, current) => option.id === current.id}
              renderInput={(params) => <TextField {...params} label="Item" required helperText="Search by name or part code." />}
            />
            <SupervisorField label="Issued to" people={people.data ?? []} value={employeeId} onChange={setEmployeeId} helperText="Search by name." />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField label="Date" type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} required fullWidth InputLabelProps={{ shrink: true }} />
              <TextField label="Quantity" type="number" value={serialised ? '1' : quantity} onChange={(e) => setQuantity(e.target.value)} required fullWidth disabled={serialised} inputProps={{ min: 1 }} />
            </Stack>
            {sized && <TextField label="Size" value={size} onChange={(e) => setSize(e.target.value)} required fullWidth />}
            {serialised && <TextField label="Serial number" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} required fullWidth helperText="One pair or one harness. A damaged serial can be withdrawn later." />}
            <TextField select label="Reason" value={issueReason} onChange={(e) => setIssueReason(e.target.value)} fullWidth>
              {REASONS.map((reason) => <MenuItem key={reason} value={reason}>{words(reason)}</MenuItem>)}
            </TextField>
            <TextField label="Batch" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} fullWidth />
            <TextField select label="Pre-use inspection" value={inspectionResult} onChange={(e) => setInspectionResult(e.target.value)} required fullWidth helperText="Only a pass can be issued.">
              <MenuItem value="PASS">Pass</MenuItem>
              <MenuItem value="FAIL">Fail</MenuItem>
            </TextField>
            <Button type="submit" variant="contained" disabled={save.isPending || !employeeId}>Issue</Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
