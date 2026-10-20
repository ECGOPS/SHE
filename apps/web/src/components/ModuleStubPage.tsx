import { Box, Card, CardContent, Stack, Typography, Chip } from '@mui/material';
import ConstructionRoundedIcon from '@mui/icons-material/ConstructionRounded';

interface Props {
  title: string;
  subtitle: string;
  features: string[];
}

/**
 * Renders a placeholder page for an SHE module that has been scaffolded on
 * the backend (entities + REST endpoints) but does not yet have a full UI.
 * The supporting API endpoints are live, so the surface can be progressively
 * replaced as work proceeds module-by-module.
 */
export function ModuleStubPage({ title, subtitle, features }: Props) {
  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5" fontWeight={700}>{title}</Typography>
        <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
      </Box>
      <Card sx={{ borderLeft: '4px solid #FBB040' }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" mb={2}>
            <ConstructionRoundedIcon color="secondary" />
            <Typography variant="subtitle1" fontWeight={600}>
              Backend ready · UI in progress
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" mb={2}>
            The REST and WebSocket endpoints for this module are live and enforce hierarchical RBAC.
            A dedicated user interface ships in the next iteration. Capabilities currently exposed via API:
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1}>
            {features.map((f) => (
              <Chip key={f} label={f} variant="outlined" />
            ))}
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}
