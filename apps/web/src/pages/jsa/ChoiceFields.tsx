import { useEffect, useState } from 'react';
import { Autocomplete, Box, Button, Checkbox, Chip, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material';

const OTHER = '__other__';

export function SupervisorField({
  people,
  value,
  onChange,
  helperText,
  label = 'Supervisor',
}: {
  people: Array<{ id: string; fullName: string }>;
  value: string;
  onChange: (id: string) => void;
  helperText?: string;
  label?: string;
}) {
  const selected = people.find((person) => person.id === value) ?? null;
  return (
    <Autocomplete
      options={people}
      value={selected}
      onChange={(_, person) => onChange(person?.id ?? '')}
      getOptionLabel={(person) => person.fullName}
      isOptionEqualToValue={(option, current) => option.id === current.id}
      fullWidth
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder="Search by name" helperText={helperText} />
      )}
    />
  );
}

export function CrewPersonField({
  people,
  userId,
  name,
  onChange,
  label = 'Person',
}: {
  people: Array<{ id: string; fullName: string }>;
  userId: string;
  name: string;
  onChange: (next: { userId: string; name: string }) => void;
  label?: string;
}) {
  const selected = people.find((person) => person.id === userId) ?? null;
  return (
    <Autocomplete
      freeSolo
      options={people}
      value={selected}
      inputValue={name}
      onChange={(_, next) => {
        if (!next) {
          onChange({ userId: '', name: '' });
          return;
        }
        if (typeof next === 'string') {
          onChange({ userId: '', name: next });
          return;
        }
        onChange({ userId: next.id, name: next.fullName });
      }}
      onInputChange={(_, input, reason) => {
        if (reason === 'input') onChange({ userId: '', name: input });
        if (reason === 'clear') onChange({ userId: '', name: '' });
      }}
      getOptionLabel={(option) => (typeof option === 'string' ? option : option.fullName)}
      isOptionEqualToValue={(option, current) => typeof current !== 'string' && option.id === current.id}
      fullWidth
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder="Search by name, or type a name" />
      )}
    />
  );
}

export function ListedTextField({
  label,
  value,
  options,
  onChange,
  required,
  helperText = 'Choose from the list, or Other to type your own.',
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  required?: boolean;
  helperText?: string;
}) {
  const known = options.includes(value);
  const [other, setOther] = useState(() => Boolean(value) && !known);

  useEffect(() => {
    if (options.includes(value)) setOther(false);
    else if (value) setOther(true);
  }, [value, options]);

  return (
    <Stack spacing={1} sx={{ width: '100%' }}>
      <TextField
        select
        label={label}
        value={other ? OTHER : value}
        required={required}
        fullWidth
        helperText={other ? undefined : helperText}
        onChange={(event) => {
          const next = event.target.value;
          if (next === OTHER) {
            setOther(true);
            if (options.includes(value)) onChange('');
            return;
          }
          setOther(false);
          onChange(next);
        }}
      >
        <MenuItem value="">— select —</MenuItem>
        {options.map((option) => (
          <MenuItem key={option} value={option} sx={{ whiteSpace: 'normal' }}>
            {option}
          </MenuItem>
        ))}
        <MenuItem value={OTHER}>Other</MenuItem>
      </TextField>
      {other && (
        <TextField
          label={`${label} — type your own`}
          value={known ? '' : value}
          required={required}
          fullWidth
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Stack>
  );
}

export function ListedMultiField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string[];
  options: readonly string[];
  onChange: (value: string[]) => void;
}) {
  const extras = value.filter((item) => !options.includes(item));
  const [draft, setDraft] = useState('');

  const toggle = (option: string, checked: boolean) => {
    onChange(checked ? [...value, option] : value.filter((item) => item !== option));
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="subtitle2">{label}</Typography>
      <Typography variant="caption" color="text.secondary">
        Tick what applies, or add your own.
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, mt: 0.5 }}>
        {options.map((option) => (
          <FormControlLabel
            key={option}
            control={<Checkbox size="small" checked={value.includes(option)} onChange={(event) => toggle(option, event.target.checked)} />}
            label={option}
          />
        ))}
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mt={1} alignItems={{ sm: 'center' }}>
        <TextField size="small" label="Other" value={draft} onChange={(event) => setDraft(event.target.value)} fullWidth />
        <Button
          variant="outlined"
          disabled={!draft.trim()}
          onClick={() => {
            const next = draft.trim();
            if (!value.includes(next)) onChange([...value, next]);
            setDraft('');
          }}
        >
          Add
        </Button>
      </Stack>
      {extras.length > 0 && (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" mt={1}>
          {extras.map((item) => (
            <Chip key={item} label={item} onDelete={() => onChange(value.filter((entry) => entry !== item))} />
          ))}
        </Stack>
      )}
    </Box>
  );
}
