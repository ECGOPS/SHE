import { useState, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu,
  Stack,
  Tooltip,
  Typography,
  Chip,
} from '@mui/material';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import { useNotificationsStore, InboxNotification } from '../stores/notifications.store';

function priorityColor(p: InboxNotification['priority']): 'default' | 'info' | 'warning' | 'error' {
  switch (p) {
    case 'CRITICAL':
      return 'error';
    case 'HIGH':
      return 'warning';
    case 'NORMAL':
      return 'info';
    default:
      return 'default';
  }
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Bell-icon dropdown that lives in the AppBar. Reads from
 * `useNotificationsStore` (populated on connect by `useRealtime`) and
 * renders the inbox + unread count. Clicking a notification marks it
 * read and navigates to the linked module page when `payload.route`
 * is provided.
 */
export function NotificationsBell() {
  const navigate = useNavigate();
  const items = useNotificationsStore((s) => s.items);
  const unread = useNotificationsStore((s) => s.unread);
  const loading = useNotificationsStore((s) => s.loading);
  const fetched = useNotificationsStore((s) => s.fetched);
  const fetch = useNotificationsStore((s) => s.fetch);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (e: MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    if (!fetched) void fetch();
  };

  const handleClick = async (n: InboxNotification) => {
    if (!n.read) await markRead(n.id);
    const route = (n.payload as { route?: string } | undefined)?.route;
    setAnchorEl(null);
    if (route) navigate(route);
  };

  return (
    <>
      <Tooltip title={unread ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'Notifications'}>
        <IconButton color="inherit" onClick={handleOpen}>
          <Badge color="secondary" badgeContent={unread} max={99} overlap="circular">
            {unread > 0 ? <NotificationsActiveRoundedIcon /> : <NotificationsNoneRoundedIcon />}
          </Badge>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        slotProps={{
          paper: {
            sx: { width: 380, maxHeight: 520, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
          },
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}
        >
          <Typography variant="subtitle1" fontWeight={700}>
            Notifications
          </Typography>
          <Button
            size="small"
            startIcon={<DoneAllRoundedIcon fontSize="small" />}
            disabled={unread === 0}
            onClick={() => void markAllRead()}
          >
            Mark all read
          </Button>
        </Stack>

        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {loading && !items.length && (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={20} />
            </Stack>
          )}

          {!loading && !items.length && (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 4, px: 2 }}>
              <NotificationsNoneRoundedIcon color="disabled" sx={{ fontSize: 40, mb: 1 }} />
              <Typography variant="body2" color="text.secondary" textAlign="center">
                You&apos;re all caught up — no notifications yet.
              </Typography>
              <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ mt: 0.5 }}>
                New incidents, hazards and overdue actions will appear here in real time.
              </Typography>
            </Stack>
          )}

          {items.length > 0 && (
            <List dense disablePadding>
              {items.map((n, idx) => (
                <Box key={n.id}>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => void handleClick(n)}
                      sx={{
                        alignItems: 'flex-start',
                        py: 1.25,
                        backgroundColor: n.read ? 'transparent' : 'action.hover',
                        borderLeft: 3,
                        borderColor: n.read ? 'transparent' : `${priorityColor(n.priority)}.main`,
                      }}
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography
                              variant="body2"
                              fontWeight={n.read ? 500 : 700}
                              sx={{ flex: 1, lineHeight: 1.3 }}
                              noWrap
                            >
                              {n.title}
                            </Typography>
                            {n.priority !== 'NORMAL' && n.priority !== 'LOW' && (
                              <Chip
                                size="small"
                                label={n.priority}
                                color={priorityColor(n.priority)}
                                sx={{ height: 18, fontSize: 10 }}
                              />
                            )}
                          </Stack>
                        }
                        secondary={
                          <Stack spacing={0.25} sx={{ mt: 0.25 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
                              {n.body}
                            </Typography>
                            <Typography variant="caption" color="text.disabled">
                              {relativeTime(n.createdAt)}
                            </Typography>
                          </Stack>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                  {idx < items.length - 1 && <Divider component="li" />}
                </Box>
              ))}
            </List>
          )}
        </Box>
      </Menu>
    </>
  );
}
