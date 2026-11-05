import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ClipboardCheck, MapPinned, UsersRound } from 'lucide-react'
import DataTable from '../components/DataTable.jsx'
import StatCard from '../components/StatCard.jsx'
import { deriveAshaWorkers } from '../data/ashaWorkerStats.js'
import { useChildren } from '../hooks/useChildren.js'
import { useOutreach } from '../hooks/useOutreach.js'
import { useAuth } from '../hooks/useAuth.js'
import { workspacePath } from '../utils/accessControl.js'

function ASHAWorkersPage() {
  const { profile, cloudEnabled } = useAuth()
  const workerPath = (id) => workspacePath(`asha-workers/${id}`, profile?.role, cloudEnabled)
  const { children } = useChildren()
  const { tasks } = useOutreach()
  const workers = useMemo(() => deriveAshaWorkers(children, tasks), [children, tasks])
  const stats = [
    { label: 'ASHA worker profiles', value: workers.length, note: 'In the synthetic roster', Icon: UsersRound, tone: 'teal' },
    { label: 'Assigned children', value: workers.reduce((sum, worker) => sum + worker.assignedChildCount, 0), note: 'Linked to a worker', Icon: ClipboardCheck, tone: 'green' },
    { label: 'Children with overdue doses', value: workers.reduce((sum, worker) => sum + worker.overdueChildCount, 0), note: 'Across assigned caseloads', Icon: AlertTriangle, tone: 'amber' },
    { label: 'Open outreach tasks', value: workers.reduce((sum, worker) => sum + worker.openTaskCount, 0), note: 'Assigned for follow-up', Icon: MapPinned, tone: 'blue' },
  ]

  const columns = [
    { key: 'name', label: 'ASHA worker', render: (name, worker) => <Link className="worker-name-link" to={workerPath(worker.workerId)}><span className="worker-avatar">{name.split(' ').map((part) => part[0]).join('').replace('.', '').slice(0, 2)}</span><span><strong>{name}</strong><small>{worker.workerId}</small></span></Link> },
    { key: 'localityLabel', label: 'Assigned locality' },
    { key: 'assignedChildCount', label: 'Children assigned' },
    { key: 'overdueChildCount', label: 'Children overdue', render: (count) => <strong className={count ? 'worker-number-alert' : ''}>{count}</strong> },
    { key: 'upcomingFollowUpCount', label: 'Upcoming follow-ups' },
    { key: 'unreachableFamilyCount', label: 'Unreachable' },
    { key: 'migratedFamilyCount', label: 'Migrated' },
    { key: 'openTaskCount', label: 'Open tasks' },
  ]

  return <section className="asha-page" aria-labelledby="page-title">
    <div className="page-heading dashboard-heading"><div><p className="eyebrow">VAXREACH WORKSPACE <span className="eyebrow-separator">/</span> COMMUNITY HEALTH TEAM</p><h1 id="page-title">ASHA workers</h1><p className="page-description">Worker caseloads, follow-up priorities and outreach task progress.</p></div><span className="synthetic-pill">Synthetic worker roster</span></div>
    <div className="stat-grid stat-grid--six asha-overview-stats">{stats.map((stat) => <StatCard key={stat.label} {...stat} value={new Intl.NumberFormat('en-IN').format(stat.value)} />)}</div>
    <DataTable title="Worker directory" description={`${workers.length} ASHA worker profiles · select a profile to manage assignments and outreach`} columns={columns} rows={workers} caption="ASHA worker profiles and dynamically calculated caseloads" emptyMessage="No workers are in the synthetic roster." />
    <p className="data-disclaimer">Caseload counts are derived from current child assignments. Task counts come from the local outreach task list.</p>
  </section>
}

export default ASHAWorkersPage
