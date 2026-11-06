import { ArrowRight, BarChart3, CheckCircle2, CircleAlert, ClipboardList, FileUp, MapPin, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import DataTable from '../components/DataTable.jsx'
import LocalityCoverageChart from '../components/LocalityCoverageChart.jsx'
import StatCard from '../components/StatCard.jsx'
import { DATA_AS_OF, VACCINATION_SCHEDULE } from '../data/syntheticChildren.js'
import { useAuth } from '../hooks/useAuth.js'
import { useChildren } from '../hooks/useChildren.js'
import { useOutreach } from '../hooks/useOutreach.js'
import { EmptyState } from '../components/ui.jsx'

const numberFormat = new Intl.NumberFormat('en-IN')
const dateLabel = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${DATA_AS_OF}T00:00:00Z`))

function PageHeading({ eyebrow, title, description, children }) {
  return <div className="page-heading workspace-page-heading"><div><p className="eyebrow">{eyebrow}</p><h1 id="page-title">{title}</h1><p className="page-description">{description}</p></div>{children}</div>
}

function WorkspaceNotice({ Icon = ShieldCheck, title, children, tone = 'info' }) {
  return <aside className={`workspace-notice workspace-notice--${tone}`}><span className="workspace-notice-icon"><Icon size={19} /></span><div><strong>{title}</strong><p>{children}</p></div></aside>
}

export function GeographicMapPage() {
  const { children } = useChildren()
  const { localityCoverage } = deriveLocalityStats(children)
  const rows = localityCoverage.map((item) => ({ ...item, id: item.locality }))
  const columns = [
    { key: 'locality', label: 'Service area' },
    { key: 'total', label: 'Registered children', render: numberFormat.format },
    { key: 'fullyImmunised', label: 'Fully immunised', render: numberFormat.format },
    { key: 'overdueChildren', label: 'Children with overdue doses', render: (value) => <span className={value ? 'workspace-number-alert' : ''}>{numberFormat.format(value)}</span> },
    { key: 'coverage', label: 'Coverage', render: (value) => `${value}%` },
  ]

  return <section className="workspace-detail-page" aria-labelledby="page-title">
    <PageHeading eyebrow="ADMIN WORKSPACE / SERVICE AREAS" title="Geographic overview" description="Compare child registration and immunisation coverage across the service areas in the current dataset." />
    <WorkspaceNotice Icon={MapPin} title="Locality overview, not a geographic map">The current records contain locality names but no map coordinates. This page summarizes coverage by locality; it does not place families or workers on a map.</WorkspaceNotice>
    {children.length ? <>
      <LocalityCoverageChart localities={localityCoverage} />
      <DataTable title="Service area coverage" description={`Synthetic records as of ${dateLabel}`} columns={columns} rows={rows} caption="Immunisation coverage by service area" emptyMessage="No locality data is available." />
    </> : <EmptyWorkspace icon={UsersRound} title="No child records available" text="Service area summaries will appear when the current account can read child records." />}
    <p className="data-disclaimer">All figures use the currently available records and the prototype vaccination schedule.</p>
  </section>
}

export function LocalityMapPage() {
  const { children } = useChildren()
  const { tasks } = useOutreach()
  const { profile } = useAuth()
  const assignedChildren = children.filter((child) => child.assignedAshaWorker === profile?.workerName)
  const localityMap = new Map()
  for (const child of assignedChildren) {
    const entry = localityMap.get(child.locality) ?? { locality: child.locality, children: 0, overdue: 0, pending: 0, followUps: 0 }
    entry.children += 1
    entry.overdue += child.overdueDoses.length ? 1 : 0
    entry.pending += child.pendingDoses.length
    localityMap.set(child.locality, entry)
  }
  for (const task of tasks) {
    if (task.status !== 'Open' || task.assignedTo !== profile?.workerName) continue
    const child = assignedChildren.find((record) => record.childId === task.childId)
    if (child) localityMap.get(child.locality).followUps += 1
  }
  const rows = [...localityMap.values()].sort((a, b) => a.locality.localeCompare(b.locality)).map((row) => ({ ...row, id: row.locality }))
  const columns = [
    { key: 'locality', label: 'My service area' },
    { key: 'children', label: 'Assigned children', render: numberFormat.format },
    { key: 'overdue', label: 'Children with overdue doses', render: (value) => <span className={value ? 'workspace-number-alert' : ''}>{numberFormat.format(value)}</span> },
    { key: 'pending', label: 'Pending doses', render: numberFormat.format },
    { key: 'followUps', label: 'Open follow-ups', render: numberFormat.format },
  ]
  return <section className="workspace-detail-page" aria-labelledby="page-title">
    <PageHeading eyebrow="FIELD WORKSPACE / MY SERVICE AREAS" title="My locality overview" description="A summary of the localities represented by your assigned children and open follow-ups." />
    <WorkspaceNotice Icon={MapPin} title="Locality overview, not a geographic map">The current records do not include coordinates. This view summarizes your assigned caseload by locality without showing household locations.</WorkspaceNotice>
    <div className="stat-grid stat-grid--three workspace-stats">
      <StatCard label="Assigned children" value={numberFormat.format(assignedChildren.length)} note="Visible in your current workspace" Icon={UsersRound} tone="blue" />
      <StatCard label="Children needing follow-up" value={numberFormat.format(assignedChildren.filter((child) => child.overdueDoses.length > 0).length)} note="At least one overdue dose" Icon={CircleAlert} tone="amber" />
      <StatCard label="Open outreach tasks" value={numberFormat.format(tasks.filter((task) => task.status === 'Open' && task.assignedTo === profile?.workerName).length)} note="Assigned to your worker profile" Icon={ClipboardList} tone="teal" />
    </div>
    <DataTable title="Locality workload" description="Counts are derived from your assigned records" columns={columns} rows={rows} caption="Assigned children and follow-ups by locality" emptyMessage="No assigned children are available for this account." />
    <p className="data-disclaimer">Locality counts do not identify household addresses. All records are synthetic or scoped by the connected account.</p>
  </section>
}

export function CsvImportPage() {
  return <section className="workspace-detail-page" aria-labelledby="page-title">
    <PageHeading eyebrow="ADMIN WORKSPACE / DATA MANAGEMENT" title="CSV import" description="Review the current data import capability before preparing a file." />
    <WorkspaceNotice Icon={FileUp} title="CSV upload is not available yet">This project currently supports CSV export from Reports. It does not include an import form, file validation, or a safe row-by-row review flow. No file will be uploaded from this page.</WorkspaceNotice>
    <div className="workspace-action-card"><span className="workspace-action-icon"><BarChart3 size={20} /></span><div><h2>Need a spreadsheet export?</h2><p>Open Reports to filter the synthetic dataset and export the currently available report data.</p></div><Link className="primary-action" to="/admin/reports">Open reports <ArrowRight size={15} /></Link></div>
    <div className="workspace-info-grid"><article><h2>What is available</h2><p>Reports can export filtered vaccination, locality, worker, and follow-up data as CSV.</p></article><article><h2>What is not implemented</h2><p>There is no CSV upload, column mapping, duplicate check, or import preview in this version.</p></article></div>
  </section>
}

export function ASHAProfilePage() {
  const { profile, session } = useAuth()
  const fields = [
    ['Name', profile?.workerName || profile?.full_name || 'Not provided'],
    ['Portal role', 'ASHA / Health Worker'],
    ['Worker code', profile?.workerCode || 'Not assigned'],
    ['Email address', session?.user?.email || 'Not available'],
    ['Profile status', profile?.workerCode ? 'Linked to an active worker record' : 'Worker assignment required'],
  ]
  return <section className="workspace-detail-page" aria-labelledby="page-title">
    <PageHeading eyebrow="FIELD WORKSPACE / ACCOUNT" title="My profile" description="Account and worker details available to this signed-in session." />
    <WorkspaceNotice Icon={UserRound} title="Profile details are read-only">Profile editing is not available in this version. Contact your VaxReach administrator to correct account or worker assignment details.</WorkspaceNotice>
    <section className="profile-details-card" aria-label="Account details"><div className="profile-details-heading"><span className="profile-details-avatar">{(profile?.workerName || profile?.full_name || 'A').split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div><h2>{profile?.workerName || profile?.full_name || 'ASHA worker'}</h2><p>Community health worker account</p></div></div><dl>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
  </section>
}

export function AdminProfilePage() {
  const { profile, session } = useAuth()
  const name = profile?.full_name || 'Administrator'
  const fields = [
    ['Name', name],
    ['Portal role', 'Administrator'],
    ['Email address', session?.user?.email || 'Not available'],
    ['Account status', session?.user ? 'Signed in' : 'Local demonstration'],
  ]
  return <section className="workspace-detail-page" aria-labelledby="page-title">
    <PageHeading eyebrow="ADMIN WORKSPACE / ACCOUNT" title="My profile" description="Account details available to this signed-in session." />
    <WorkspaceNotice Icon={UserRound} title="Profile details are read-only">Profile editing is not available in this version. Use the sign-out control in the top bar to end your session.</WorkspaceNotice>
    <section className="profile-details-card" aria-label="Administrator account details"><div className="profile-details-heading"><span className="profile-details-avatar">{name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><div><h2>{name}</h2><p>VaxReach administrator account</p></div></div><dl>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
  </section>
}

export function WorkspaceSettingsPage() {
  const { cloudEnabled, profile } = useAuth()
  return <section className="workspace-detail-page" aria-labelledby="page-title">
    <PageHeading eyebrow="ADMIN WORKSPACE / PREFERENCES" title="Settings" description="A clear view of the current workspace setup and account context." />
    <div className="workspace-settings-grid">
      <article className="workspace-setting-card"><span><ShieldCheck size={19} /></span><div><small>Data connection</small><h2>{cloudEnabled ? 'Supabase workspace' : 'Local demonstration'}</h2><p>{cloudEnabled ? 'Records are requested from the connected project and scoped by the signed-in account.' : 'Synthetic records are stored in this browser for demonstration.'}</p></div></article>
      <article className="workspace-setting-card"><span><UserRound size={19} /></span><div><small>Current access role</small><h2>{profile?.role === 'administrator' ? 'Administrator' : profile?.role === 'asha_worker' ? 'ASHA / Health Worker' : 'Demonstration administrator'}</h2><p>Access is determined by the account profile and database policies.</p></div></article>
      <article className="workspace-setting-card"><span><CheckCircle2 size={19} /></span><div><small>Prototype reference date</small><h2>{dateLabel}</h2><p>Sample coverage, due dates, and follow-up indicators use this fixed reference date.</p></div></article>
    </div>
    <WorkspaceNotice title="Workspace preferences are not configurable here">This version has no profile, notification, or schedule controls. Authentication and data access are managed through the existing Supabase setup.</WorkspaceNotice>
  </section>
}

function EmptyWorkspace({ icon: Icon, title, text }) {
  return <EmptyState Icon={Icon} title={title} description={text} />
}

function deriveLocalityStats(children) {
  const grouped = new Map()
  for (const child of children) {
    const row = grouped.get(child.locality) ?? { locality: child.locality, total: 0, fullyImmunised: 0, overdueChildren: 0 }
    row.total += 1
    row.fullyImmunised += child.completedDoseCount >= VACCINATION_SCHEDULE.length ? 1 : 0
    row.overdueChildren += child.overdueDoses.length ? 1 : 0
    grouped.set(child.locality, row)
  }
  const localityCoverage = [...grouped.values()].map((row) => ({ ...row, coverage: row.total ? Math.round((row.fullyImmunised / row.total) * 100) : 0 })).sort((a, b) => a.locality.localeCompare(b.locality))
  return { localityCoverage }
}
