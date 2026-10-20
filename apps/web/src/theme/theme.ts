import { createTheme } from '@mui/material/styles';

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
    fontFamily: 'Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
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
      styleOverrides: { root: { borderRadius: 10 } },
    },
    MuiCard: {
      styleOverrides: { root: { boxShadow: '0 1px 3px rgba(11, 26, 43, 0.08)' } },
    },
  },
});
