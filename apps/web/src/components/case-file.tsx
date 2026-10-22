import { type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid2 as Grid,
  Skeleton,
  Stack,
  Typography,
  type ChipProps,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';

export const CASE_FILE_CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
} as const;

export type CaseFileChip = {
  label: string;
  color?: ChipProps['color'];
  variant?: ChipProps['variant'];
};

export type CaseFileMetaItem = {
  icon?: ReactNode;
  label: string;
  value: string;
};

export function titleCase(value?: string | null): string {
  if (!value) return '—';
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDay(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function placeName(
  region?: { name?: string | null } | null,
  district?: { name?: string | null } | null,
): string {
  const value = [region?.name, district?.name].filter(Boolean).join(' / ');
  return value || 'Place not recorded';
}

export function CaseFileSkeleton() {
  return (
    <Stack spacing={2.5}>
      <Skeleton variant="rounded" height={168} />
      <Skeleton variant="rounded" height={220} />
      <Skeleton variant="rounded" height={160} />
    </Stack>
  );
}

export function CaseFileSectionTitle({ children }: { children: ReactNode }) {
  return (
    <Typography
      variant="overline"
      color="text.secondary"
      sx={{ letterSpacing: 1, fontWeight: 700, display: 'block' }}
    >
      {children}
    </Typography>
  );
}

export function CaseFileMeta({ icon, label, value }: CaseFileMetaItem) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      {icon && <Box sx={{ color: 'primary.main', mt: '2px' }}>{icon}</Box>}
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}
        >
          {label}
        </Typography>
        <Typography fontWeight={600} sx={{ wordBreak: 'break-word' }}>
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}

export function CaseFileMetric({
  label,
  value,
  alert,
}: {
  label: string;
  value: string | number;
  alert?: boolean;
}) {
  return (
    <Box
      sx={{
        height: '100%',
        px: 1.5,
        py: 1.25,
        borderRadius: 2,
        border: '1px solid',
        borderColor: alert ? 'error.light' : 'divider',
        bgcolor: alert ? 'rgba(198, 40, 40, 0.06)' : 'rgba(11, 83, 148, 0.04)',
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={700} color={alert ? 'error.main' : 'text.primary'} sx={{ mt: 0.25 }}>
        {value}
      </Typography>
    </Box>
  );
}

export function CaseFileCard({
  title,
  hint,
  extra,
  children,
}: {
  title?: string;
  hint?: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card sx={CASE_FILE_CARD_SX}>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        {(title || extra) && (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            {title && <CaseFileSectionTitle>{title}</CaseFileSectionTitle>}
            {extra}
          </Stack>
        )}
        {hint && (
          <Typography variant="body2" color="text.secondary" mt={title || extra ? 0.75 : 0}>
            {hint}
          </Typography>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

export function CaseFileHeader({
  backTo,
  backLabel,
  reference,
  title,
  chips = [],
  actions,
  meta = [],
}: {
  backTo: string;
  backLabel: string;
  reference?: string | null;
  title: string;
  chips?: CaseFileChip[];
  actions?: ReactNode;
  meta?: CaseFileMetaItem[];
}) {
  const columns = meta.length >= 4 ? { xs: 12, sm: 6, md: 3 } : meta.length === 3 ? { xs: 12, sm: 4 } : { xs: 12, sm: 6 };

  return (
    <Card sx={{ ...CASE_FILE_CARD_SX, overflow: 'hidden' }}>
      <Box sx={{ height: 4, bgcolor: 'primary.main' }} />
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack
          direction="row"
          spacing={1.5}
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <Button
            component={RouterLink}
            to={backTo}
            startIcon={<ArrowBackRoundedIcon />}
            size="small"
            sx={{ color: 'text.secondary', ml: -0.5 }}
          >
            {backLabel}
          </Button>
          {actions}
        </Stack>
        {reference && (
          <Typography
            variant="overline"
            color="primary.main"
            sx={{ letterSpacing: 1.2, fontWeight: 700, display: 'block', mt: 1.5 }}
          >
            {reference}
          </Typography>
        )}
        <Typography
          variant="h4"
          component="h1"
          sx={{ mt: reference ? 0.25 : 1.5, fontSize: { xs: '1.5rem', md: '2rem' }, lineHeight: 1.25 }}
        >
          {title}
        </Typography>
        {chips.length > 0 && (
          <Stack direction="row" spacing={0.75} mt={1.5} flexWrap="wrap" useFlexGap>
            {chips.map((chip, index) => (
              <Chip
                key={`${chip.label}-${index}`}
                size="small"
                label={chip.label}
                color={chip.color ?? 'default'}
                variant={chip.variant}
              />
            ))}
          </Stack>
        )}
        {meta.length > 0 && (
          <>
            <Divider sx={{ my: 2.5 }} />
            <Grid container spacing={2}>
              {meta.map((item) => (
                <Grid key={item.label} size={columns}>
                  <CaseFileMeta {...item} />
                </Grid>
              ))}
            </Grid>
          </>
        )}
      </CardContent>
    </Card>
  );
}
