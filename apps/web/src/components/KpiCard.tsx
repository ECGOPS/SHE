import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';

interface Props {
  title: string;
  value: number | string;
  subtitle?: string;
  delta?: number;
  accent?: 'primary' | 'success' | 'warning' | 'error' | 'info';
  icon?: JSX.Element;
}

const ACCENT: Record<NonNullable<Props['accent']>, string> = {
  primary: '#0B5394',
  success: '#2E7D32',
  warning: '#ED6C02',
  error: '#C62828',
  info: '#0288D1',
};

export function KpiCard({ title, value, subtitle, delta, accent = 'primary', icon }: Props) {
  return (
    <Card className="kpi-card" sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" alignItems="flex-start" spacing={2}>
          {icon && (
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                bgcolor: `${ACCENT[accent]}14`,
                color: ACCENT[accent],
                display: 'grid',
                placeItems: 'center',
              }}
            >
              {icon}
            </Box>
          )}
          <Box flex={1}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, mt: 0.5, color: 'primary.dark' }}>
              {value}
            </Typography>
            {(subtitle || typeof delta === 'number') && (
              <Stack direction="row" alignItems="center" spacing={0.5} mt={0.5}>
                {typeof delta === 'number' && (
                  <>
                    {delta >= 0 ? (
                      <TrendingUpRoundedIcon fontSize="small" color="success" />
                    ) : (
                      <TrendingDownRoundedIcon fontSize="small" color="error" />
                    )}
                    <Typography variant="caption" color={delta >= 0 ? 'success.main' : 'error.main'} fontWeight={600}>
                      {delta >= 0 ? '+' : ''}
                      {delta}%
                    </Typography>
                  </>
                )}
                {subtitle && (
                  <Typography variant="caption" color="text.secondary">
                    {subtitle}
                  </Typography>
                )}
              </Stack>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
