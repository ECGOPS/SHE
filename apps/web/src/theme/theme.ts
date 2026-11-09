import { createTheme } from '@mui/material/styles';

/** Strong ease-out for UI that enters or responds to a press. */
export const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

const PRESS_SCALE = {
  '&:active:not(.Mui-disabled)': { transform: 'scale(0.97)' },
  '@media (prefers-reduced-motion: reduce)': {
    '&:active:not(.Mui-disabled)': { transform: 'none' },
  },
} as const;

/**
 * Cards that open a record: hover lift only on mouse devices (a tap would
 * leave it stuck on touch screens) and a small press-in on every device.
 */
export const pressableCardSx = {
  cursor: 'pointer',
  transition: `transform 160ms ${EASE_OUT}, box-shadow 200ms ease`,
  '@media (hover: hover) and (pointer: fine)': {
    '&:hover': { boxShadow: 3 },
  },
  '&:active': { transform: 'scale(0.98)' },
  '@media (prefers-reduced-motion: reduce)': {
    '&:active': { transform: 'none' },
  },
} as const;

/**
 * Enterprise theme inspired by ECG corporate identity.
 * Deep navy primary, gold accent, professional surfaces.
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0B5394', dark: '#0B1A2B', light: '#1F77BD', contrastText: '#ffffff' },
    secondary: { main: '#FBB040', contrastText: '#0B1A2B' },
    success: { main: '#2E7D32' },
    warning: { main: '#ED6C02' },
    error: { main: '#C62828' },
    info: { main: '#0288D1' },
    background: { default: '#F4F6FA', paper: '#ffffff' },
    text: { primary: '#0B1A2B', secondary: '#4B5C70' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter Variable", Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h1: { fontWeight: 700, letterSpacing: -0.5 },
    h2: { fontWeight: 700 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'linear-gradient(90deg, #0B1A2B 0%, #0B5394 100%)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: ({ theme: t }) => ({
          borderRadius: 10,
          transition: [
            t.transitions.create(['background-color', 'box-shadow', 'border-color', 'color'], {
              duration: t.transitions.duration.short,
            }),
            `transform 160ms ${EASE_OUT}`,
          ].join(', '),
          ...PRESS_SCALE,
        }),
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: ({ theme: t }) => ({
          transition: [
            t.transitions.create('background-color', { duration: t.transitions.duration.shortest }),
            `transform 160ms ${EASE_OUT}`,
          ].join(', '),
          ...PRESS_SCALE,
        }),
      },
    },
    MuiCard: {
      styleOverrides: {
        // One crisp edge (hairline ring + soft shadow) instead of border + shadow.
        root: { boxShadow: '0 0 0 1px rgba(11, 26, 43, 0.06), 0 1px 2px rgba(11, 26, 43, 0.06)' },
      },
    },
  },
});
