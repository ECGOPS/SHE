import { useEffect, useState } from 'react';
import { Button, Stack, TextField, Typography } from '@mui/material';
import { GridPaginationModel } from '@mui/x-data-grid';

export interface PageQuery {
  page: number;
  pageSize: number;
  search?: string;
  [key: string]: unknown;
}

export function useServerPage(initialSize = 25) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialSize);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      setSearch((current) => (current === next ? current : next));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
  }, [search]);

  const query: PageQuery = { page: page + 1, pageSize, ...(search ? { search } : {}) };

  return {
    page,
    pageSize,
    search,
    searchInput,
    setSearchInput,
    setPage,
    query,
    onPaginationModelChange: (model: GridPaginationModel) => {
      setPage(model.page);
      setPageSize(model.pageSize);
    },
  };
}

export function RecordSearch({
  value,
  onChange,
  placeholder = 'Search reference or title',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <TextField
      size="small"
      label="Search"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      sx={{ minWidth: { sm: 260 } }}
    />
  );
}

export function MobilePageBar({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between">
      <Button disabled={page <= 0} onClick={() => onPage(page - 1)}>Previous</Button>
      <Typography variant="body2" color="text.secondary">
        {total === 0 ? 'No records' : `${start}–${end} of ${total}`}
      </Typography>
      <Button disabled={end >= total} onClick={() => onPage(page + 1)}>Next</Button>
    </Stack>
  );
}
