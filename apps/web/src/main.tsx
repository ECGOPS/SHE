import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from './theme/theme';
import { App } from './App';
import { checkForAppUpdate } from './pwa/check-for-update';
import { OFFLINE_QUEUE_EVENT } from './offline/sync-events';
import '@fontsource-variable/inter';
import './index.css';

checkForAppUpdate();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      // Try the request even when the device reports offline: the service
      // worker can answer from its cache (regions, districts, recent lists).
      networkMode: 'offlineFirst',
    },
    mutations: {
      // The forms queue reports on the device themselves when there's no
      // connection. React Query's default ('online') pauses every save while
      // offline, which left the submit button stuck on "Saving…" and the
      // report never reached the offline queue.
      networkMode: 'always',
    },
  },
});

// Reports saved offline were just sent: reload lists and counts so they appear.
window.addEventListener(OFFLINE_QUEUE_EVENT, () => {
  void queryClient.invalidateQueries();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
