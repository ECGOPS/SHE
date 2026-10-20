import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { NFPA_70E_PPE_CATEGORY, PPE_ANSI_STANDARDS, PPE_EN_STANDARDS, isDistrictScope, isRegionalScope, isSafetyOfficer } from '@ecg-she/shared';
import { endpoints } from '../../api/endpoints';
import { useAuthStore } from '../../stores/auth.store';

const CATEGORIES = ['HEAD', 'EYE', 'EAR', 'HAND', 'FOOT', 'BODY', 'FALL_PROTECTION', 'RESPIRATORY', 'INSULATING'];
const VOLTAGE = ['CLASS_00', 'CLASS_0', 'CLASS_1', 'CLASS_2', 'CLASS_3', 'CLASS_4'];

function errorMessage(err: unknown): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? (err as Error)?.message ?? 'Request failed';
}

function words(value: string): string {
  return value.replaceAll('_', ' ');
}

export function PpeItemNewPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.session?.user.role);
  const session = useAuthStore((s) => s.session);
  const lockedToRegion = !!role && isSafetyOfficer(role) && (isRegionalScope(role) || isDistrictScope(role));
  const lockedToDistrict = !!role && isSafetyOfficer(role) && isDistrictScope(role);
  const [regionId, setRegionId] = useState(session?.user.regionId ?? '');
  const [districtId, setDistrictId] = useState(session?.user.districtId ?? '');
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('HAND');
  const [stockOnHand, setStockOnHand] = useState('0');
  const [reorderLevel, setReorderLevel] = useState('0');
  const [shelfLifeMonths, setShelfLifeMonths] = useState('');
  const [retestIntervalMonths, setRetestIntervalMonths] = useState('');
  const [voltageClass, setVoltageClass] = useState('');
  const [enStandard, setEnStandard] = useState('');
  const [ansiStandard, setAnsiStandard] = useState('');
  const [nfpaArcCategory, setNfpaArcCategory] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const regions = useQuery({ queryKey: ['regions'], queryFn: endpoints.regions });
  const districts = useQuery({ queryKey: ['districts', regionId], queryFn: () => endpoints.districts(regionId), enabled: !!regionId });
  const needsRetest = category === 'INSULATING' || category === 'FALL_PROTECTION';
  const arcMarked = /61482|F1959|F2178|arc-flash|Arc-rated/i.test(`${enStandard} ${ansiStandard}`);

  const save = useMutation({
    mutationFn: () => endpoints.createPpeItem({
      sku: sku.trim(),
      name: name.trim(),
      category,
      stockOnHand: Number(stockOnHand),
      reorderLevel: reorderLevel ? Number(reorderLevel) : undefined,
      shelfLifeMonths: shelfLifeMonths ? Number(shelfLifeMonths) : undefined,
      retestIntervalMonths: needsRetest ? Number(retestIntervalMonths) : undefined,
      voltageClass: category === 'INSULATING' ? voltageClass : undefined,
      enStandard: enStandard || undefined,
      ansiStandard: ansiStandard || undefined,
      nfpaArcCategory: nfpaArcCategory || undefined,
      manufacturer: manufacturer.trim() || undefined,
      modelNumber: modelNumber.trim() || undefined,
      regionId,
      districtId: districtId || undefined,
    }),
    onSuccess: (item) => navigate(`/ppe/${item.id}`),
    onError: (err) => setError(errorMessage(err)),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  return (
    <Stack spacing={2} component="form" onSubmit={onSubmit}>
      <Typography variant="h5" fontWeight={700}>New PPE item</Typography>
      <Typography variant="body2" color="text.secondary">
        This is the part in the store. Issuing it to a person happens on the next screen.
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField select label="Region" value={regionId} onChange={(e) => { setRegionId(e.target.value); setDistrictId(''); }} required fullWidth disabled={lockedToRegion}>
                {(regions.data ?? []).map((region) => <MenuItem key={region.id} value={region.id}>{region.name}</MenuItem>)}
              </TextField>
              <TextField select label="District" value={districtId} onChange={(e) => setDistrictId(e.target.value)} fullWidth disabled={lockedToDistrict || !regionId}>
                <MenuItem value="">Whole region</MenuItem>
                {(districts.data ?? []).map((district) => <MenuItem key={district.id} value={district.id}>{district.name}</MenuItem>)}
              </TextField>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField label="Part code" value={sku} onChange={(e) => setSku(e.target.value)} required fullWidth />
              <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required fullWidth />
            </Stack>
            <TextField select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} required fullWidth>
              {CATEGORIES.map((item) => <MenuItem key={item} value={item}>{words(item)}</MenuItem>)}
            </TextField>
            {category === 'INSULATING' && (
              <TextField select label="Voltage class" value={voltageClass} onChange={(e) => setVoltageClass(e.target.value)} required fullWidth>
                {VOLTAGE.map((item) => <MenuItem key={item} value={item}>{words(item)}</MenuItem>)}
              </TextField>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField label="In stock" type="number" value={stockOnHand} onChange={(e) => setStockOnHand(e.target.value)} required fullWidth inputProps={{ min: 0 }} />
              <TextField label="Reorder at" type="number" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} fullWidth inputProps={{ min: 0 }} helperText="A warning is sent when stock falls to this number." />
              <TextField label="Shelf life (months)" type="number" value={shelfLifeMonths} onChange={(e) => setShelfLifeMonths(e.target.value)} fullWidth inputProps={{ min: 1 }} />
            </Stack>
            {needsRetest && (
              <TextField label="Months between tests" type="number" value={retestIntervalMonths} onChange={(e) => setRetestIntervalMonths(e.target.value)} required fullWidth inputProps={{ min: 1 }} helperText="Insulating gloves and harnesses need a next test date." />
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField select label="EN standard" value={enStandard} onChange={(e) => setEnStandard(e.target.value)} fullWidth>
                <MenuItem value="">None</MenuItem>
                {PPE_EN_STANDARDS.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </TextField>
              <TextField select label="ANSI / ASTM" value={ansiStandard} onChange={(e) => setAnsiStandard(e.target.value)} fullWidth>
                <MenuItem value="">None</MenuItem>
                {PPE_ANSI_STANDARDS.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField select label="Arc category" value={nfpaArcCategory} onChange={(e) => setNfpaArcCategory(e.target.value)} required={arcMarked} fullWidth helperText={arcMarked ? 'Required for arc-rated clothing.' : 'Set this for arc-rated clothing.'}>
              <MenuItem value="">None</MenuItem>
              {NFPA_70E_PPE_CATEGORY.map((item) => <MenuItem key={item} value={item}>{words(item)}</MenuItem>)}
            </TextField>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField label="Manufacturer" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} fullWidth />
              <TextField label="Model" value={modelNumber} onChange={(e) => setModelNumber(e.target.value)} fullWidth />
            </Stack>
            <Button type="submit" variant="contained" disabled={save.isPending}>Save item</Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
