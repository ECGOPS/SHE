import type { ReactElement } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import PolicyRoundedIcon from '@mui/icons-material/PolicyRounded';
import EnergySavingsLeafRoundedIcon from '@mui/icons-material/EnergySavingsLeafRounded';
import LocalHospitalRoundedIcon from '@mui/icons-material/LocalHospitalRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import HardwareRoundedIcon from '@mui/icons-material/HardwareRounded';
import BuildCircleRoundedIcon from '@mui/icons-material/BuildCircleRounded';
import SummarizeRoundedIcon from '@mui/icons-material/SummarizeRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import { EcgLogo } from '../components/EcgLogo';
import { useAuthStore } from '../stores/auth.store';
import { Role } from '@ecg-she/shared';
import { canSeePath } from './nav-access';

interface NavItem {
  to: string;
  label: string;
  icon: ReactElement;
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <DashboardRoundedIcon /> },
  { to: '/console', label: 'Safety Officer Console', icon: <ShieldRoundedIcon /> },
  { to: '/incidents', label: 'Incidents', icon: <ReportProblemRoundedIcon /> },
  { to: '/near-miss', label: 'Near Miss', icon: <VisibilityRoundedIcon /> },
  { to: '/hazards', label: 'Hazards', icon: <WarningAmberRoundedIcon /> },
  { to: '/jsa', label: 'Job Safety Analysis', icon: <AssignmentTurnedInRoundedIcon /> },
  { to: '/ptw', label: 'Permit-to-Work', icon: <VerifiedUserRoundedIcon /> },
  { to: '/inspections', label: 'Inspections', icon: <ChecklistRoundedIcon /> },
  { to: '/audits', label: 'Audits', icon: <FactCheckRoundedIcon /> },
  { to: '/management', label: 'Management system', icon: <PolicyRoundedIcon /> },
  { to: '/environmental', label: 'Environmental', icon: <EnergySavingsLeafRoundedIcon /> },
  { to: '/health', label: 'Occupational Health', icon: <LocalHospitalRoundedIcon /> },
  { to: '/training', label: 'Training', icon: <SchoolRoundedIcon /> },
  { to: '/ppe', label: 'PPE', icon: <HardwareRoundedIcon /> },
  { to: '/capa', label: 'Corrective Actions', icon: <BuildCircleRoundedIcon /> },
  { to: '/reports', label: 'Reports', icon: <SummarizeRoundedIcon /> },
  { to: '/audit-trail', label: 'Audit Trail', icon: <HistoryRoundedIcon /> },
  { to: '/admin', label: 'Administration', icon: <SettingsRoundedIcon /> },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const session = useAuthStore((s) => s.session);
  const role = session?.user.role ?? Role.STAFF;
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <EcgLogo size={40} />
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            ECG SHE
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Enterprise Edition
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      <List sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
        {NAV.filter((n) => canSeePath(role, n.to)).map((n) => (
          <ListItemButton
            key={n.to}
            component={NavLink}
            to={n.to}
            onClick={onNavigate}
            sx={{
              mx: 1,
              my: 0.25,
              borderRadius: 2,
              color: 'rgba(255,255,255,0.78)',
              '&.active': {
                bgcolor: 'rgba(251, 176, 64, 0.16)',
                color: 'white',
                '& .MuiListItemIcon-root': { color: 'secondary.main' },
              },
              '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 36 }}>{n.icon}</ListItemIcon>
            <ListItemText primary={n.label} primaryTypographyProps={{ fontSize: 14 }} />
          </ListItemButton>
        ))}
      </List>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      <Box sx={{ p: 2, fontSize: 12, opacity: 0.6, textAlign: 'center' }}>
        © {new Date().getFullYear()} Electricity Company of Ghana
      </Box>
    </Box>
  );
}
