import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Autocomplete, TextField } from '@mui/material';
import { endpoints } from '../../api/endpoints';

interface PermitOption {
  id: string;
  referenceCode?: string;
  workDescription?: string;
  regionId?: string | null;
}

export function PermitField({
  value,
  onChange,
  regionId,
  initial,
}: {
  value: string;
  onChange: (id: string) => void;
  regionId?: string | null;
  initial?: PermitOption | null;
}) {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [chosen, setChosen] = useState<PermitOption | null>(initial ?? null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(input.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [input]);

  const permits = useQuery({
    queryKey: ['ptw-pick', search, regionId],
    queryFn: () => endpoints.ptw({ search: search || undefined, status: 'APPROVED,ACTIVE', pageSize: 25 }),
  });

  const options = ((permits.data?.items ?? []) as PermitOption[]).filter(
    (permit) => !regionId || !permit.regionId || permit.regionId === regionId,
  );
  const selected = options.find((permit) => permit.id === value) ?? (chosen?.id === value ? chosen : null);
  const shown = selected && !options.some((permit) => permit.id === selected.id) ? [selected, ...options] : options;

  return (
    <Autocomplete
      options={shown}
      value={selected}
      loading={permits.isFetching}
      onInputChange={(_, text) => setInput(text)}
      onChange={(_, permit) => {
        setChosen(permit);
        onChange(permit?.id ?? '');
      }}
      getOptionLabel={(permit) => `${permit.referenceCode ?? 'Permit'} — ${permit.workDescription ?? ''}`}
      isOptionEqualToValue={(option, current) => option.id === current.id}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Permit"
          helperText="Search by reference or the work. A high-risk briefing needs a permit."
        />
      )}
    />
  );
}
