import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { useAuthStore } from './stores/auth.store';
import { msalInstance, ENTRA_ENABLED } from './auth/msal';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { PrivacyNoticePage } from './pages/PrivacyNoticePage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { DashboardPage } from './pages/DashboardPage';
import { SafetyOfficerConsolePage } from './pages/SafetyOfficerConsolePage';
import { IncidentsListPage } from './pages/incidents/IncidentsListPage';
import { IncidentNewPage } from './pages/incidents/IncidentNewPage';
import { IncidentDetailPage } from './pages/incidents/IncidentDetailPage';
import { HazardsPage } from './pages/HazardsPage';
import { HazardDetailPage } from './pages/hazards/HazardDetailPage';
import { NearMissPage } from './pages/NearMissPage';
import { NearMissDetailPage } from './pages/near-miss/NearMissDetailPage';
import { JsaPage } from './pages/JsaPage';
import { JsaNewPage } from './pages/jsa/JsaNewPage';
import { JsaDetailPage } from './pages/jsa/JsaDetailPage';
import { PtwPage } from './pages/PtwPage';
import { PtwNewPage } from './pages/ptw/PtwNewPage';
import { PtwDetailPage } from './pages/ptw/PtwDetailPage';
import { InspectionsPage } from './pages/InspectionsPage';
import { InspectionNewPage } from './pages/inspections/InspectionNewPage';
import { InspectionDetailPage } from './pages/inspections/InspectionDetailPage';
import { AuditsPage } from './pages/AuditsPage';
import { AuditNewPage } from './pages/audits/AuditNewPage';
import { AuditDetailPage } from './pages/audits/AuditDetailPage';
import { EnvironmentalPage } from './pages/EnvironmentalPage';
import { EnvironmentalDetailPage } from './pages/environmental/EnvironmentalDetailPage';
import { HealthPage } from './pages/HealthPage';
import { HealthNewPage } from './pages/health/HealthNewPage';
import { HealthDetailPage } from './pages/health/HealthDetailPage';
import { TrainingPage } from './pages/TrainingPage';
import { TrainingCourseNewPage } from './pages/training/TrainingCourseNewPage';
import { TrainingClassPage } from './pages/training/TrainingClassPage';
import { TrainingCoursePage } from './pages/training/TrainingCoursePage';
import { PpePage } from './pages/PpePage';
import { PpeItemNewPage } from './pages/ppe/PpeItemNewPage';
import { PpeIssuePage } from './pages/ppe/PpeIssuePage';
import { PpeItemPage } from './pages/ppe/PpeItemPage';
import { CapaPage } from './pages/CapaPage';
import { CapaNewPage } from './pages/capa/CapaNewPage';
import { CapaDetailPage } from './pages/capa/CapaDetailPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditTrailPage } from './pages/AuditTrailPage';
import { AdminPage } from './pages/AdminPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { ManagementSystemPage } from './pages/ManagementSystemPage';
import { OfflineSyncBanner } from './components/OfflineSyncBanner';
import { useRealtime } from './hooks/useRealtime';
import { Role } from '@ecg-she/shared';
import { canSeePath, homePath } from './layouts/nav-access';
import { PRIVACY_READ_KEY } from './components/PrivacyAcknowledgement';

function ProtectedShell() {
  const session = useAuthStore((s) => s.session);
  const restoring = useAuthStore((s) => s.restoring);
  const { pathname } = useLocation();
  if (restoring) return null;
  if (!session) {
    const readNotice = sessionStorage.getItem(PRIVACY_READ_KEY);
    return <Navigate to={readNotice ? '/login' : '/notice'} replace />;
  }
  const role = session.user.role ?? Role.STAFF;
  if (pathname !== '/' && !canSeePath(role, pathname)) {
    return <Navigate to={homePath(role)} replace />;
  }
  return <AppLayout />;
}

function HomeRedirect() {
  const role = useAuthStore((s) => s.session?.user.role) ?? Role.STAFF;
  return <Navigate to={homePath(role)} replace />;
}

function AppRoutes() {
  const restore = useAuthStore((s) => s.restore);
  useEffect(() => {
    void restore();
  }, [restore]);

  useRealtime();

  return (
    <>
      <OfflineSyncBanner />
      <Routes>
        <Route path="/notice" element={<PrivacyNoticePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route element={<ProtectedShell />}>
          <Route index element={<HomeRedirect />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/console" element={<SafetyOfficerConsolePage />} />
          <Route path="/incidents" element={<IncidentsListPage />} />
          <Route path="/incidents/new" element={<IncidentNewPage />} />
          <Route path="/incidents/:id" element={<IncidentDetailPage />} />
          <Route path="/hazards" element={<HazardsPage />} />
          <Route path="/hazards/:id" element={<HazardDetailPage />} />
          <Route path="/near-miss" element={<NearMissPage />} />
          <Route path="/near-miss/:id" element={<NearMissDetailPage />} />
          <Route path="/jsa" element={<JsaPage />} />
          <Route path="/jsa/new" element={<JsaNewPage />} />
          <Route path="/jsa/:id" element={<JsaDetailPage />} />
          <Route path="/ptw" element={<PtwPage />} />
          <Route path="/ptw/new" element={<PtwNewPage />} />
          <Route path="/ptw/:id" element={<PtwDetailPage />} />
          <Route path="/inspections" element={<InspectionsPage />} />
          <Route path="/inspections/new" element={<InspectionNewPage />} />
          <Route path="/inspections/:id" element={<InspectionDetailPage />} />
          <Route path="/audits" element={<AuditsPage />} />
          <Route path="/management" element={<ManagementSystemPage />} />
          <Route path="/audits/new" element={<AuditNewPage />} />
          <Route path="/audits/:id" element={<AuditDetailPage />} />
          <Route path="/environmental" element={<EnvironmentalPage />} />
          <Route path="/environmental/:id" element={<EnvironmentalDetailPage />} />
          <Route path="/health" element={<HealthPage />} />
          <Route path="/health/new" element={<HealthNewPage />} />
          <Route path="/health/:id" element={<HealthDetailPage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/training/new" element={<TrainingCourseNewPage />} />
          <Route path="/training/classes/new" element={<TrainingClassPage />} />
          <Route path="/training/:id" element={<TrainingCoursePage />} />
          <Route path="/ppe" element={<PpePage />} />
          <Route path="/ppe/new" element={<PpeItemNewPage />} />
          <Route path="/ppe/issue" element={<PpeIssuePage />} />
          <Route path="/ppe/:id" element={<PpeItemPage />} />
          <Route path="/capa" element={<CapaPage />} />
          <Route path="/capa/new" element={<CapaNewPage />} />
          <Route path="/capa/:id" element={<CapaDetailPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/audit-trail" element={<AuditTrailPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export function App() {
  // Wrap with MsalProvider only when Entra ID is configured for this build.
  if (ENTRA_ENABLED && msalInstance) {
    return (
      <MsalProvider instance={msalInstance}>
        <AppRoutes />
      </MsalProvider>
    );
  }
  return <AppRoutes />;
}
