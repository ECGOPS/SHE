import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import { ROLE_LABEL } from '@ecg-she/shared';
import { EcgLogo } from '../components/EcgLogo';
import { useAuthStore } from '../stores/auth.store';
import { Sidebar } from './Sidebar';
import { NotificationsBell } from '../components/NotificationsBell';
import { NotificationsToast } from '../components/NotificationsToast';
import { SessionsDialog } from '../components/SessionsDialog';
import { PrivacyAcknowledgement } from '../components/PrivacyAcknowledgement';

const DRAWER_WIDTH = 264;

export function AppLayout() {
  const theme = useTheme();
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', maxWidth: '100%', overflowX: 'clip' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { xs: '100%', md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
        }}
      >
        <Toolbar sx={{ gap: { xs: 0.5, sm: 1 }, px: { xs: 1, sm: 2 } }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ display: { md: 'none' } }}
            aria-label="Open navigation"
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <EcgLogo size={36} />
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h6"
                noWrap
                sx={{ fontWeight: 700, lineHeight: 1.1, fontSize: { xs: '1rem', sm: '1.25rem' } }}
              >
                ECG · SHE
              </Typography>
              <Typography variant="caption" noWrap sx={{ opacity: 0.85, display: { xs: 'none', sm: 'block' } }}>
                Safety, Health &amp; Environment Management System
              </Typography>
            </Box>
          </Box>
          <NotificationsBell />
          <Tooltip title="Help">
            <IconButton color="inherit">
              <HelpOutlineRoundedIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title={session?.user.fullName ?? ''}>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
              <Avatar sx={{ bgcolor: 'secondary.main', color: 'primary.dark', width: 36, height: 36, fontWeight: 700 }}>
                {(session?.user.fullName ?? '?')
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled>
              <Box>
                <Typography fontWeight={600}>{session?.user.fullName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {session?.user.role ? ROLE_LABEL[session.user.role] : ''}
                </Typography>
              </Box>
            </MenuItem>
            <MenuItem onClick={() => { setAnchorEl(null); setSessionsOpen(true); }}>Sessions</MenuItem>
            <MenuItem onClick={() => { setAnchorEl(null); navigate('/privacy'); }}>Your information</MenuItem>
            <MenuItem onClick={() => void logout()}>Sign out</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <SessionsDialog open={sessionsOpen} onClose={() => setSessionsOpen(false)} />
      <PrivacyAcknowledgement />

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        {isMobile ? (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{ '& .MuiDrawer-paper': { width: 'min(264px, 86vw)', bgcolor: 'primary.dark', color: 'white' } }}
          >
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </Drawer>
        ) : (
          <Drawer
            variant="permanent"
            sx={{
              '& .MuiDrawer-paper': {
                width: DRAWER_WIDTH,
                bgcolor: 'primary.dark',
                color: 'white',
                borderRight: 'none',
              },
            }}
            open
          >
            <Sidebar />
          </Drawer>
        )}
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          maxWidth: '100%',
          width: { xs: '100%', md: `calc(100% - ${DRAWER_WIDTH}px)` },
        }}
      >
        <Toolbar />
        <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, maxWidth: '100%', minWidth: 0 }}>
          <Outlet />
        </Box>
      </Box>

      {/* Global toast for live realtime notifications. */}
      <NotificationsToast />
    </Box>
  );
}
