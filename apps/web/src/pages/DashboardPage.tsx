import { useQuery } from '@tanstack/react-query';
import { Box, Card, CardContent, Grid2 as Grid, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { PieChart } from '@mui/x-charts/PieChart';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded';
import BuildCircleRoundedIcon from '@mui/icons-material/BuildCircleRounded';
import HealingRoundedIcon from '@mui/icons-material/HealingRounded';
import EnergySavingsLeafRoundedIcon from '@mui/icons-material/EnergySavingsLeafRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import { ROLE_LABEL } from '@ecg-she/shared';
import { KpiCard } from '../components/KpiCard';
import { endpoints } from '../api/endpoints';
import { useAuthStore } from '../stores/auth.store';

export function DashboardPage() {
  const session = useAuthStore((s) => s.session);
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('sm'));
  const pieSize = narrow ? 200 : 260;
  const { data: kpis } = useQuery({ queryKey: ['kpis'], queryFn: endpoints.kpis });
  const { data: trends } = useQuery({ queryKey: ['trends', 30], queryFn: () => endpoints.trends(30) });
  const { data: heat } = useQuery({ queryKey: ['heatmap'], queryFn: endpoints.heatmap });
  const { data: capaStats } = useQuery({ queryKey: ['capa-stats'], queryFn: endpoints.capaStats });

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" fontWeight={700} sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
          Welcome back, {session?.user.fullName.split(' ')[0]}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Real-time operational SHE picture across your scope ·{' '}
          {session?.user.role ? ROLE_LABEL[session.user.role] : ''}
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Total Incidents"
            value={kpis?.totalIncidents ?? '—'}
            subtitle="last 12 months"
            icon={<ReportProblemRoundedIcon />}
            accent="primary"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="LTIFR"
            value={kpis?.ltifr ?? '—'}
            subtitle="per 200,000 hrs"
            icon={<HealingRoundedIcon />}
            accent="warning"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="TRIR"
            value={kpis?.trir ?? '—'}
            subtitle="per 200,000 hrs"
            icon={<HealingRoundedIcon />}
            accent="warning"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Fatalities"
            value={kpis?.fatalities ?? '—'}
            subtitle="cumulative"
            icon={<LocalFireDepartmentRoundedIcon />}
            accent="error"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Near Misses"
            value={kpis?.nearMisses ?? '—'}
            icon={<VisibilityRoundedIcon />}
            accent="info"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Hazard Reports"
            value={kpis?.hazardReports ?? '—'}
            icon={<WarningAmberRoundedIcon />}
            accent="warning"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Open Corrective Actions"
            value={kpis?.openCorrectiveActions ?? '—'}
            subtitle={`${capaStats?.overdue ?? 0} overdue`}
            icon={<BuildCircleRoundedIcon />}
            accent="error"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            title="Environmental Cases"
            value={kpis?.environmentalCases ?? '—'}
            icon={<EnergySavingsLeafRoundedIcon />}
            accent="success"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ height: { xs: 'auto', lg: 360 }, overflow: 'hidden' }}>
            <CardContent sx={{ height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                30-day SHE event trend
              </Typography>
              <Box sx={{ width: '100%', minWidth: 0, overflowX: 'auto' }}>
                <LineChart
                  height={280}
                  series={[
                    { data: (trends ?? []).map((t) => t.incidents), label: 'Incidents', color: '#C62828' },
                    { data: (trends ?? []).map((t) => t.nearMisses), label: 'Near misses', color: '#0288D1' },
                    { data: (trends ?? []).map((t) => t.hazards), label: 'Hazards', color: '#ED6C02' },
                  ]}
                  xAxis={[{
                    data: (trends ?? []).map((t) => t.date),
                    scaleType: 'point',
                    tickLabelInterval: (_value, index) => index % 5 === 0,
                  }]}
                  grid={{ horizontal: true }}
                  margin={{ top: 10, right: 16, bottom: 36, left: 36 }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ height: 360 }}>
            <CardContent
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                p: 2,
                '&:last-child': { pb: 2 },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <EmojiEventsRoundedIcon color="secondary" />
                <Typography variant="h6">Safety Performance</Typography>
              </Stack>
              {/*
                Donut + score number need to occupy the same visual centre.
                Using an explicit relative wrapper with an absolute-positioned
                overlay keeps them aligned at any card width and avoids the
                brittle negative-top hack that broke when the card is resized.
              */}
              <Box
                sx={{
                  position: 'relative',
                  flex: 1,
                  minHeight: pieSize,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PieChart
                  width={pieSize}
                  height={pieSize}
                  series={[
                    {
                      data: [
                        { id: 'score', value: kpis?.safetyPerformanceScore ?? 0, label: 'Score' },
                        { id: 'rest', value: 100 - (kpis?.safetyPerformanceScore ?? 0), label: 'Gap' },
                      ],
                      innerRadius: pieSize * 0.31,
                      outerRadius: pieSize * 0.46,
                      paddingAngle: 2,
                      cx: pieSize / 2,
                      cy: pieSize / 2,
                    },
                  ]}
                  slotProps={{ legend: { hidden: true } }}
                  margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <Typography variant="h3" fontWeight={800} color="primary.dark" lineHeight={1}>
                    {kpis?.safetyPerformanceScore ?? '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    out of 100
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Incidents by region
              </Typography>
              <Box sx={{ width: '100%', minWidth: 0, overflowX: 'auto' }}>
                <BarChart
                  height={300}
                  sx={{ minWidth: Math.max(280, (heat?.length ?? 1) * 72) }}
                  xAxis={[{ data: (heat ?? []).map((h) => h.regionName ?? '—'), scaleType: 'band' }]}
                  series={[{ data: (heat ?? []).map((h) => h.count), label: 'Incidents', color: '#0B5394' }]}
                  grid={{ horizontal: true }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
