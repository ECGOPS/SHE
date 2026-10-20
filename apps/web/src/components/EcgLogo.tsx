import { Box } from '@mui/material';

/** Electricity Company of Ghana crest. */
export function EcgLogo({ size = 40 }: { size?: number | { xs: number; sm: number } }) {
  return (
    <Box
      component="img"
      src="/ecg-logo.png"
      alt="Electricity Company of Ghana"
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        display: 'block',
        flexShrink: 0,
      }}
    />
  );
}
