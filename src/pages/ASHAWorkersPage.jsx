import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ClipboardCheck, MapPinned, Plus, Search, UsersRound } from 'lucide-react'
import DataTable from '../components/DataTable.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import WorkerEditor from '../components/WorkerEditor.jsx'
import { deriveAshaWorkers } from '../data/ashaWorkerStats.js'
import { LOCALITIES } from '../data/syntheticChildren.js'
import { useChildren } from '../hooks/useChildren.js'
import { useOutreach } from '../hooks/useOutreach.js'
import { useWorkers } from '../hooks/WorkersContext.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { hasPermission, PERMISSIONS } from '../utils/permissions.js'
import { workspacePath } from '../utils/accessControl.js'

function ASHAWorkersPage() {
  const { profile, cloudEnabled } = useAuth()
  const path = (id) => workspacePath(`asha-workers/${id}`, profile?.role, cloudEnabled)
  const { children } = useChildren()
  const { tasks } = useOutreach()
  const { workers, loading, error } = useWorkers()
  const [search, setSearch] = useState('')
  const [locality, setLocality] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const canManage = hasPermission(PERMISSIONS.MANAGE_ASSIGNMENTS, cloudEnabled ? profile : undefined)
  const workerStats = useMemo(() => deriveAshaWorkers(children, tasks, workers), [children, tasks, workers])
  const visibleWorkers = workerStats.filter((worker) => {
    const query = search.trim().toLowerCase()
    return (!query || worker.name.toLowerCase().includes(query) || worker.workerId.toLowerCase().includes(query))
      && (!locality || worker.localityLabel.split(', ').includes(locality))
      && (!activeFilter || (activeFilter === 'Active' ? worker.active !== false : worker.active === false))
  })
  const stats = [
    { label: 'ASHA worker profiles', value: workers.length, note: 'Operational worker records', Icon: UsersRound, tone: 'teal' },
    { label: 'Assigned children', value: workerStats.reduce((sum, worker) => sum + worker.assignedChildCount, 0), note: 'Linked to a worker', Icon: ClipboardCheck, tone: 'green' },
    { label: 'Children with overdue doses', value: workerStats.reduce((sum, worker) => sum + worker.overdueChildCount, 0), note: 'Across assigned caseloads', Icon: AlertTriangle, tone: 'amber' },
    { label: 'Open outreach tasks', value: workerStats.reduce((sum, worker) => sum + worker.openTaskCount, 0), note: 'Assigned for follow-up', Icon: MapPinned, tone: 'blue' },
  ]
  const columns = [
    { key: 'name', label: 'ASHA worker', render: (name, worker) => <Link className="worker-name-link" to={path(worker.workerId)}><span className="worker-avatar">{name.split(' ').map((part) => part[0]).join('').replace('.', '').slice(0, 2)}</span><span><strong>{name}</strong><small>{worker.workerId}</small></span></Link> },
    { key: 'localityLabel', label: 'Assigned locality' },
    { key: 'assignedChildCount', label: 'Children assigned' },
    { key: 'overdueChildCount', label: 'Children overdue', render: (count) => <strong className={count ? 'worker-number-alert' : ''}>{count}</strong> },
    { key: 'openTaskCount', label: 'Open tasks' },
    { key: 'active', label: 'Status', render: (active) => <StatusBadge status={active === false ? 'Inactive' : 'Active'} /> },
  ]
  return <section className="asha-page" aria-labelledby="page-title">
    <div className="page-heading dashboard-heading"><div><p className="eyebrow">VAXREACH WORKSPACE <span className="eyebrow-separator">/</span> COMMUNITY HEALTH TEAM</p><h1 id="page-title">ASHA workers</h1><p className="page-description">Worker identification, service areas, caseloads and follow-up performance.</p></div>{canManage && <button className="primary-action" type="button" onClick={() => setEditorOpen(true)}><Plus size={16} /> Create worker</button>}</div>
    <div className="stat-grid stat-grid--six asha-overview-stats">{stats.map((stat) => <StatCard key={stat.label} {...stat} value={new Intl.NumberFormat('en-IN').format(stat.value)} />)}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="worker-directory-filters"><label className="search-field"><Search size={16} /><span className="sr-only">Search workers by name or worker code</span><input type="search" placeholder="Search name or worker code" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="filter-field"><span>Assigned locality</span><select value={locality} onChange={(event) => setLocality(event.target.value)}><option value="">All localities</option>{LOCALITIES.map((item) => <option key={item}>{item}</option>)}</select></label><label className="filter-field"><span>Worker status</span><select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}><option value="">All statuses</option><option>Active</option><option>Inactive</option></select></label></div>
    <DataTable title="Worker directory" description={`${visibleWorkers.length} of ${workers.length} profiles · open a profile to manage child assignments and outreach`} columns={columns} rows={visibleWorkers} caption="ASHA worker profiles and dynamically calculated caseloads" emptyMessage={loading ? 'Loading worker records…' : 'No workers match these search and filter settings.'} />
    <p className="data-disclaimer">Performance totals are derived from current child assignments and outreach tasks. Worker accounts and role assignments are managed through secure backend provisioning.</p>
    <WorkerEditor open={editorOpen} localities={LOCALITIES} onClose={() => setEditorOpen(false)} onSaved={() => setEditorOpen(false)} />
  </section>
}

export default ASHAWorkersPage
