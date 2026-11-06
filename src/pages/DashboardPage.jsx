import { CalendarClock, CheckCheck, CircleAlert, Syringe, Users, UsersRound, MapPin, Activity } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DataTable from '../components/DataTable.jsx'
import LocalityCoverageChart from '../components/LocalityCoverageChart.jsx'
import MonthlyTrendChart from '../components/MonthlyTrendChart.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { DATA_AS_OF, deriveDashboardData, VACCINATION_SCHEDULE } from '../data/dashboard.js'
import { deriveAshaWorkers } from '../data/ashaWorkerStats.js'
import { useChildren } from '../hooks/useChildren.js'
import { useAuth } from '../hooks/useAuth.js'
import { useOutreach } from '../hooks/useOutreach.js'
import { useWorkers } from '../hooks/WorkersContext.jsx'
import { EmptyState, ErrorState, Skeleton } from '../components/ui.jsx'
import { APP_ROLES, workspacePath } from '../utils/accessControl.js'
import * as repository from '../lib/supabaseRepository.js'

const numberFormat = new Intl.NumberFormat('en-IN')
const dateLabel = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${DATA_AS_OF}T00:00:00Z`))
const activityColumns = [
  { key: 'child', label: 'Child' },
  { key: 'locality', label: 'Locality' },
  { key: 'vaccine', label: 'Vaccine / dose' },
  { key: 'dateLabel', label: 'Date given' },
  { key: 'ashaWorker', label: 'ASHA worker' },
  { key: 'status', label: 'Status', render: () => <StatusBadge status="Complete" /> },
]

const followUpColumns = [
  { key: 'name', label: 'Child' },
  { key: 'age', label: 'Age', render: (age) => age.label },
  { key: 'locality', label: 'Locality' },
  { key: 'overdueDoseNames', label: 'Follow-up need' },
  { key: 'dueDateLabel', label: 'Due date' },
  { key: 'migrationStatus', label: 'Migration' },
  { key: 'familyReachability', label: 'Family contact' },
  { key: 'followUpStatus', label: 'Follow-up status', render: (status) => <StatusBadge status={status} /> },
]

function DashboardPage() {
  const { children, loading, error: childrenError } = useChildren()
  const { profile, cloudEnabled } = useAuth()
  const { tasks, loading: outreachLoading, error: outreachError } = useOutreach()
  const { workers, loading: workersLoading, error: workersError } = useWorkers()
  const isAdministrator = !cloudEnabled || profile?.role === APP_ROLES.ADMINISTRATOR
  const { dashboardSummary, localityCoverage, monthlyVaccinationTrend, recentVaccinationActivity, immediateFollowUps } = useMemo(() => deriveDashboardData(children), [children])
  const ashaWorkers = useMemo(() => deriveAshaWorkers(children, tasks), [children, tasks])
  const pathFor = (path) => workspacePath(path, profile?.role ?? APP_ROLES.ADMINISTRATOR, cloudEnabled)
  const statCards = [
    { label: 'Registered children', value: dashboardSummary.totalChildren, note: `Across ${localityCoverage.length} service areas`, Icon: Users, tone: 'blue', to: pathFor('children') },
    { label: 'Fully immunised', value: dashboardSummary.fullyImmunised, note: 'All scheduled doses recorded', Icon: CheckCheck, tone: 'green', to: pathFor('children?status=Fully%20immunised') },
    { label: 'Partially immunised', value: dashboardSummary.partiallyImmunised, note: 'One or more doses remaining', Icon: Syringe, tone: 'teal', to: pathFor('children?status=Partially%20immunised') },
    { label: 'Overdue vaccinations', value: dashboardSummary.overdueVaccinations, note: 'Doses past their scheduled date', Icon: CircleAlert, tone: 'amber', to: pathFor('children?status=Overdue') },
    { label: 'Upcoming vaccinations', value: dashboardSummary.upcomingVaccinations, note: 'Doses due in the next 30 days', Icon: CalendarClock, tone: 'blue', to: pathFor('children?status=Upcoming') },
    { label: 'Vaccination coverage', value: `${dashboardSummary.coveragePercentage}%`, note: `${dashboardSummary.fullyImmunised} of ${dashboardSummary.totalChildren} children`, Icon: UsersRound, tone: 'green', to: pathFor('children?status=Fully%20immunised') },
  ]
  if (cloudEnabled && profile?.role === APP_ROLES.ASHA_WORKER) return <ASHAWorkerDashboard />
  if (loading || outreachLoading || (isAdministrator && workersLoading)) return <section className="dashboard-page" aria-label="Loading dashboard" aria-busy="true"><p className="cloud-data-loading" role="status">Loading dashboard data{isAdministrator ? ' (children, outreach tasks, and workers)' : ' (children and outreach tasks)'}…</p><div className="page-heading"><div><Skeleton width="130px" height="12px" /><div style={{ marginTop: 12 }}><Skeleton width="280px" height="34px" /></div></div></div><div className="stat-grid stat-grid--six">{statCards.map((stat) => <article className="stat-card vr-stat-skeleton" key={stat.label}><Skeleton width="38px" height="38px" /><Skeleton width="70%" height="12px" /><Skeleton width="45%" height="25px" /></article>)}</div><div className="chart-grid"><Skeleton className="vr-panel-skeleton" height="270px" /><Skeleton className="vr-panel-skeleton" height="270px" /></div></section>
  return <section className="dashboard-page" aria-labelledby="page-title">
    <div className="page-heading dashboard-heading"><div><p className="eyebrow">{profile?.role === 'asha_worker' ? 'MY FIELD WORK' : 'PROGRAMME OVERVIEW'} <span className="eyebrow-separator">/</span> AS OF {dateLabel.toUpperCase()}</p><h1 id="page-title">{profile?.role === 'asha_worker' ? 'My immunisation dashboard' : 'Immunisation dashboard'}</h1><p className="page-description">{profile?.role === 'asha_worker' ? 'Your assigned children, vaccination coverage and follow-up priorities.' : 'Coverage, upcoming doses and follow-up priorities across your service areas.'}</p></div><div className="location-chip"><MapPin size={15} /><span>{profile?.role === 'asha_worker' ? [...new Set(children.map((child) => child.locality))].join(', ') || 'My assigned localities' : 'All service areas'}</span></div></div>
    <div className="demo-notice"><span className="demo-indicator" /> {cloudEnabled ? 'Records connected to the VaxReach database' : 'Synthetic demonstration data stored in this browser'} <span className="demo-divider">·</span> {cloudEnabled ? 'Access scoped by your account role · prototype vaccination schedule' : 'Local prototype data'}</div>
    {childrenError && <ErrorState title="Children data could not be loaded" description="The child registry is temporarily unavailable. Please refresh the page or try again later." />}
    {outreachError && <ErrorState title="Outreach tasks could not be loaded" description="Outreach task data is temporarily unavailable. Please refresh the page or try again later." />}
    {workersError && <ErrorState title="ASHA worker data could not be loaded" description="Worker information is temporarily unavailable. Please refresh the page or try again later." />}
    {!childrenError && cloudEnabled && children.length === 0 && <EmptyState Icon={Users} title="No child records available" description="The child registry query succeeded, but no child records are available to this account." />}
    {!childrenError && (!cloudEnabled || children.length > 0) && <>
    <div className="stat-grid stat-grid--six">{statCards.map((stat) => <StatCard key={stat.label} {...stat} value={typeof stat.value === 'number' ? numberFormat.format(stat.value) : stat.value} />)}</div>
    <div className="chart-grid"><LocalityCoverageChart localities={localityCoverage} /><MonthlyTrendChart months={monthlyVaccinationTrend} /></div>
    {isAdministrator && !workersError && !outreachError && (!cloudEnabled || workers.length > 0) && <section className="dashboard-worker-panel" aria-labelledby="worker-performance-title"><div className="dashboard-panel-heading"><div><p className="chart-kicker">COMMUNITY HEALTH TEAM</p><h2 id="worker-performance-title">ASHA worker performance</h2><p>Caseload and outreach task progress from the current dataset.</p></div><Link className="dashboard-panel-link" to={pathFor('asha-workers')}>View worker directory <span aria-hidden="true">→</span></Link></div><div className="dashboard-worker-grid">{ashaWorkers.map((worker) => {
      const totalTasks = worker.openTaskCount + worker.completedTaskCount
      const taskCompletion = totalTasks ? Math.round((worker.completedTaskCount / totalTasks) * 100) : 0
      const fullyImmunised = worker.assignedChildren.filter((child) => child.completedDoseCount >= VACCINATION_SCHEDULE.length).length
      return <Link className="dashboard-worker-card" key={worker.workerId} to={pathFor(`asha-workers/${worker.workerId}`)}><span className="dashboard-worker-avatar" aria-hidden="true">{worker.name.split(' ').map((part) => part[0]).join('').replace('.', '').slice(0, 2)}</span><span className="dashboard-worker-main"><strong>{worker.name}</strong><small>{worker.localities.length ? worker.localities.join(', ') : 'No locality assigned'}</small><span className="dashboard-worker-track" role="img" aria-label={`${taskCompletion}% of outreach tasks completed`}><i style={{ width: `${taskCompletion}%` }} /></span></span><span className="dashboard-worker-metrics"><strong>{numberFormat.format(fullyImmunised)}<small> / {numberFormat.format(worker.assignedChildCount)} immunised</small></strong><span>{numberFormat.format(worker.openTaskCount)} open · {numberFormat.format(worker.completedTaskCount)} done</span></span></Link>
    })}</div></section>}
    <div className="table-grid"><DataTable title="Recent vaccination activity" description={cloudEnabled ? 'Latest doses recorded in connected VaxReach records' : 'Latest recorded doses in the synthetic demo dataset'} columns={activityColumns} rows={recentVaccinationActivity} caption={cloudEnabled ? 'Recent vaccination activity from connected records' : 'Recent synthetic vaccination activity'} /><DataTable title="Critical follow-up alerts" description="Overdue doses, migrated families and unreachable households" columns={followUpColumns} rows={immediateFollowUps} caption={cloudEnabled ? 'Child records requiring follow-up from connected records' : 'Synthetic child records requiring critical follow-up'} /></div>
    <p className="data-disclaimer">{cloudEnabled ? 'Child and vaccination records are loaded from the connected VaxReach database. Coverage and due-dose calculations use the prototype schedule and reference date.' : 'All names, dates and vaccination records are synthetic and stored in this browser for demonstration. Coverage and due-dose calculations use the prototype schedule.'} {numberFormat.format(children.length)} {cloudEnabled ? 'child records currently available to this account.' : 'sample child records in the dashboard dataset.'}</p>
    </>}
  </section>
}

function ASHAWorkerDashboard() {
  const { children, loading: childrenLoading, error: childrenError } = useChildren()
  const { tasks, loading: tasksLoading, error: tasksError } = useOutreach()
  const [schedule, setSchedule] = useState([])
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [scheduleError, setScheduleError] = useState(false)
  useEffect(() => {
    let active = true
    repository.listVaccinationSchedule().then((rows) => {
      if (active) setSchedule(rows)
    }).catch(() => {
      if (active) setScheduleError(true)
    }).finally(() => {
      if (active) setScheduleLoading(false)
    })
    return () => { active = false }
  }, [])

  const [todayISO] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  })
  const cutoffDate = new Date(`${todayISO}T00:00:00Z`)
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() + 30)
  const cutoffISO = cutoffDate.toISOString().slice(0, 10)
  const metrics = useMemo(() => {
    const taskCounts = tasks.reduce((counts, task) => {
      if (task.status === 'Completed') counts.completed += 1
      else if (task.dueDate < todayISO) counts.overdue += 1
      else counts.pending += 1
      return counts
    }, { pending: 0, completed: 0, overdue: 0 })
    const upcoming = []
    const activities = []
    for (const child of children) {
      const history = child.vaccinationHistory ?? []
      for (const dose of schedule) {
        const due = new Date(`${child.dateOfBirth}T00:00:00Z`)
        due.setUTCDate(due.getUTCDate() + dose.due_after_days)
        const dueDate = due.toISOString().slice(0, 10)
        if (dueDate >= todayISO && dueDate <= cutoffISO && !history.some((record) => record.id === dose.code)) {
          upcoming.push({ child, dose, dueDate })
        }
      }
      for (const record of history) activities.push({ type: 'vaccination', child, date: record.administeredDate, label: `${record.vaccine_name ?? record.vaccineName ?? record.name ?? record.id} recorded` })
    }
    for (const task of tasks) if (task.status === 'Completed') activities.push({ type: 'task', child: children.find((item) => item.childId === task.childId), date: task.completedAt ?? task.dueDate, label: task.title })
    return { taskCounts, upcoming, activities: activities.filter((item) => item.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6) }
  }, [children, tasks, schedule, todayISO, cutoffISO])
  const loading = childrenLoading || tasksLoading || scheduleLoading
  const errors = [childrenError && 'Children', tasksError && 'Outreach tasks', scheduleError && 'Vaccination schedule'].filter(Boolean)
  if (loading) return <section className="dashboard-page" aria-busy="true"><p className="cloud-data-loading" role="status">Loading your assigned children, tasks, and vaccination schedule…</p><div className="stat-grid stat-grid--six">{Array.from({ length: 6 }, (_, index) => <article className="stat-card vr-stat-skeleton" key={index}><Skeleton width="70%" height="12px" /><Skeleton width="45%" height="25px" /></article>)}</div></section>
  if (errors.length) return <section className="dashboard-page" aria-labelledby="page-title"><div className="page-heading"><div><p className="eyebrow">MY FIELD WORK</p><h1 id="page-title">My immunisation dashboard</h1></div></div>{errors.map((source) => <ErrorState key={source} title={`${source} data could not be loaded`} description="This information is temporarily unavailable. Please refresh the page or try again later." />)}</section>
  const statCards = [
    { label: 'Assigned children', value: children.length, note: 'Children available to your account', Icon: Users, tone: 'blue', to: '/asha/children' },
    { label: 'Pending tasks', value: metrics.taskCounts.pending, note: 'Open tasks not yet overdue', Icon: Activity, tone: 'teal', to: '/asha/follow-ups' },
    { label: 'Completed tasks', value: metrics.taskCounts.completed, note: 'Tasks marked complete', Icon: CheckCheck, tone: 'green', to: '/asha/follow-ups' },
    { label: 'Overdue tasks', value: metrics.taskCounts.overdue, note: 'Open tasks past their due date', Icon: CircleAlert, tone: 'amber', to: '/asha/follow-ups' },
    { label: 'Upcoming vaccinations', value: metrics.upcoming.length, note: 'Unrecorded doses due in 30 days', Icon: CalendarClock, tone: 'blue', to: '/asha/vaccination-tracker' },
    { label: 'Vaccination records', value: children.reduce((sum, child) => sum + (child.vaccinationHistory?.length ?? 0), 0), note: 'Recorded doses for assigned children', Icon: Syringe, tone: 'green', to: '/asha/vaccination-tracker' },
  ]
  return <section className="dashboard-page" aria-labelledby="page-title">
    <div className="page-heading dashboard-heading"><div><p className="eyebrow">MY FIELD WORK <span className="eyebrow-separator">/</span> LIVE DATABASE</p><h1 id="page-title">My immunisation dashboard</h1><p className="page-description">Your assigned children, vaccination schedule and follow-up tasks.</p></div><div className="location-chip"><MapPin size={15} /><span>{[...new Set(children.map((child) => child.locality).filter(Boolean))].join(', ') || 'No assigned locality records'}</span></div></div>
    <div className="demo-notice"><span className="demo-indicator" /> Live records scoped to your ASHA account</div>
    <div className="stat-grid stat-grid--six">{statCards.map((stat) => <StatCard key={stat.label} {...stat} value={numberFormat.format(stat.value)} />)}</div>
    <div className="table-grid">
      <section className="outreach-list-section"><div className="outreach-section-heading"><div><p className="chart-kicker">VACCINATION ACTIVITY</p><h2>Recent activity</h2><p>Latest recorded vaccinations and completed tasks.</p></div></div>{metrics.activities.length ? <ul className="asha-activity-list">{metrics.activities.map((item, index) => <li key={`${item.type}-${item.child?.childId ?? 'child'}-${item.date}-${index}`}><strong>{item.child?.name ?? 'Child record'}</strong><span>{item.label}</span><small>{item.child?.locality ?? ''} · {dateLabelForASHA(item.date)}</small></li>)}</ul> : <EmptyState Icon={Activity} title="No recent activity" description="No vaccination records or completed tasks are available yet." />}</section>
      <section className="outreach-list-section"><div className="outreach-section-heading"><div><p className="chart-kicker">NEXT 30 DAYS</p><h2>Upcoming vaccinations</h2></div></div>{metrics.upcoming.length ? <ul className="asha-activity-list">{metrics.upcoming.slice(0, 8).map(({ child, dose, dueDate }) => <li key={`${child.childId}-${dose.code}`}><Link to={`/asha/children/${encodeURIComponent(child.childId)}`}><strong>{child.name}</strong></Link><span>{dose.vaccine_name} · dose {dose.dose_number}</span><small>{child.locality} · Due {dateLabelForASHA(dueDate)}</small></li>)}</ul> : <EmptyState Icon={CalendarClock} title="No upcoming doses" description="No unrecorded doses are scheduled in the next 30 days for your assigned children." />}</section>
    </div>
    <p className="data-disclaimer">Children, vaccinations, tasks and schedule are loaded from VaxReach database records visible to your account.</p>
  </section>
}

function dateLabelForASHA(value) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
}

export default DashboardPage
