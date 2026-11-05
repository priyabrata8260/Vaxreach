import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout.jsx'
import { ASHAWorkersPage, ChildFormPage, ChildProfilePage, ChildrenPage, DashboardPage, OutreachPage, ReportsPage, SettingsPage, VaccinationTrackerPage } from './pages'

function App() {
  return <Routes><Route element={<AppLayout />}><Route index element={<DashboardPage />} /><Route path="children" element={<ChildrenPage />} /><Route path="children/new" element={<ChildFormPage />} /><Route path="children/:childId/edit" element={<ChildFormPage />} /><Route path="children/:childId" element={<ChildProfilePage />} /><Route path="vaccination-tracker" element={<VaccinationTrackerPage />} /><Route path="asha-workers" element={<ASHAWorkersPage />} /><Route path="outreach" element={<OutreachPage />} /><Route path="reports" element={<ReportsPage />} /><Route path="settings" element={<SettingsPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Route></Routes>
}

export default App
