import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout.jsx'
import { ASHAWorkerProfilePage, ASHAWorkersPage, ChildFormPage, ChildProfilePage, ChildrenPage, DashboardPage, OutreachPage, ReportsPage, SettingsPage, VaccinationTrackerPage } from './pages'
import { isSupabaseConfigured } from './lib/supabase.js'
import { useAuth } from './hooks/useAuth.js'
import CloudSignIn from './components/CloudSignIn.jsx'
import { APP_ROLES, dashboardPathForRole, hasRoleAccess } from './utils/accessControl.js'
import PagePlaceholder from './components/PagePlaceholder.jsx'

function RequireRoles({ roles }) {
  const { profile, session, cloudEnabled } = useAuth()
  if (cloudEnabled && !session) return <Navigate to="/login" replace />
  if (cloudEnabled && !hasRoleAccess(profile?.role, roles)) return <Navigate to={dashboardPathForRole(profile?.role)} replace />
  return <Outlet />
}

function App() {
  const { session, profile, loading, profileLoading, roleCheckLoading, error, signOut } = useAuth()
  if (isSupabaseConfigured && loading) return <main className="cloud-auth-page" role="status">Restoring secure session…</main>
  if (isSupabaseConfigured && roleCheckLoading) return <main className="cloud-auth-page" role="status">Checking account permissions…</main>
  if (isSupabaseConfigured && !session) return <Routes><Route path="/login" element={<CloudSignIn />} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>
  if (isSupabaseConfigured && profileLoading) return <main className="cloud-auth-page" role="status">Loading account permissions…</main>
  if (isSupabaseConfigured && (!profile || ![APP_ROLES.ADMINISTRATOR, APP_ROLES.ASHA_WORKER].includes(profile.role) || (profile.role === APP_ROLES.ASHA_WORKER && !profile.workerCode))) {
    return <main className="cloud-auth-page"><section className="cloud-auth-card" role="alert"><div className="cloud-auth-icon">!</div><h1>Workspace access is not ready</h1><p>{error || 'Your account role or ASHA worker assignment is missing. Contact a VaxReach administrator.'}</p><button className="login-submit" type="button" onClick={() => signOut()}>Sign out</button></section></main>
  }

  const activeRole = isSupabaseConfigured ? profile.role : APP_ROLES.ADMINISTRATOR
  return <Routes>
    <Route path="/admin" element={<RequireRoles roles={[APP_ROLES.ADMINISTRATOR]} />}>
      <Route element={<AppLayout role={APP_ROLES.ADMINISTRATOR} />}>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} /><Route path="children" element={<ChildrenPage />} />
        <Route path="children/new" element={<ChildFormPage />} /><Route path="children/:childId/edit" element={<ChildFormPage />} /><Route path="children/:childId" element={<ChildProfilePage />} />
        <Route path="asha-workers" element={<ASHAWorkersPage />} /><Route path="asha-workers/:workerId" element={<ASHAWorkerProfilePage />} />
        <Route path="vaccination-tracker" element={<VaccinationTrackerPage />} /><Route path="outreach" element={<OutreachPage />} />
        <Route path="reports" element={<ReportsPage />} /><Route path="settings" element={<SettingsPage />} />
        <Route path="geographic-map" element={<PagePlaceholder title="Geographic Map" description="Locality coverage mapping will appear here." />} />
        <Route path="csv-import" element={<PagePlaceholder title="CSV Import" description="Secure child and vaccination data imports will appear here." />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Route>
    </Route>
    <Route path="/asha" element={<RequireRoles roles={[APP_ROLES.ASHA_WORKER]} />}>
      <Route element={<AppLayout role={APP_ROLES.ASHA_WORKER} />}>
        <Route index element={<Navigate to="/asha/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} /><Route path="children" element={<ChildrenPage />} /><Route path="children/:childId" element={<ChildProfilePage />} />
        <Route path="vaccination-tracker" element={<VaccinationTrackerPage />} /><Route path="follow-ups" element={<OutreachPage />} /><Route path="outreach" element={<OutreachPage />} />
        <Route path="locality-map" element={<PagePlaceholder title="My Locality Map" description="Your assigned locality map will appear here." />} />
        <Route path="profile" element={<PagePlaceholder title="My Profile" description="Your worker profile details will appear here." />} />
        <Route path="*" element={<Navigate to="/asha/dashboard" replace />} />
      </Route>
    </Route>
    {!isSupabaseConfigured && <Route element={<AppLayout role={activeRole} />}>
      <Route path="/" element={<DashboardPage />} /><Route path="/children" element={<ChildrenPage />} />
      <Route path="/children/new" element={<ChildFormPage />} /><Route path="/children/:childId/edit" element={<ChildFormPage />} /><Route path="/children/:childId" element={<ChildProfilePage />} />
      <Route path="/vaccination-tracker" element={<VaccinationTrackerPage />} /><Route path="/asha-workers" element={<ASHAWorkersPage />} /><Route path="/asha-workers/:workerId" element={<ASHAWorkerProfilePage />} />
      <Route path="/outreach" element={<OutreachPage />} /><Route path="/reports" element={<ReportsPage />} /><Route path="/settings" element={<SettingsPage />} />
    </Route>}
    <Route path="/" element={<Navigate to={dashboardPathForRole(profile?.role || activeRole)} replace />} />
    <Route path="/login" element={<Navigate to={dashboardPathForRole(profile?.role || activeRole)} replace />} />
    <Route path="*" element={<Navigate to={dashboardPathForRole(profile?.role || activeRole)} replace />} />
  </Routes>
}

export default App
