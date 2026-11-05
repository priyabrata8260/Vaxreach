import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, AlertTriangle, CalendarClock, CheckCheck, CircleAlert, Plus, Search, UsersRound } from 'lucide-react'
import DataTable from '../components/DataTable.jsx'
import LocalityOutreachChart from '../components/LocalityOutreachChart.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { deriveOutreachData } from '../data/outreachOverview.js'
import { ASHA_WORKER_ROSTER, DATA_AS_OF } from '../data/syntheticChildren.js'
import { useChildren } from '../hooks/useChildren.js'
import { useOutreach } from '../hooks/useOutreach.js'
import { hasPermission, PERMISSIONS } from '../utils/permissions.js'
import { useAuth } from '../hooks/useAuth.js'
import { workspacePath } from '../utils/accessControl.js'

const dateLabel = (value) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
const reasonStatus = { 'Overdue vaccination': 'Overdue', 'Upcoming vaccination': 'Upcoming', 'Migrated family': 'Migrated out', 'Unreachable family': 'Unreachable' }

function OutreachPage() {
  const { children } = useChildren()
  const { profile, cloudEnabled } = useAuth()
  const childPath = (id) => workspacePath(`children/${id}`, profile?.role, cloudEnabled)
  const { tasks, addTask, assignTask, setTaskCompletion } = useOutreach()
  const { followUpQueue, localityStats, stats } = useMemo(() => deriveOutreachData(children, tasks), [children, tasks])
  const [query, setQuery] = useState('')
  const [localityFilter, setLocalityFilter] = useState('')
  const [reasonFilter, setReasonFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [taskStatusFilter, setTaskStatusFilter] = useState('')
  const [taskQuery, setTaskQuery] = useState('')
  const [taskStatusListFilter, setTaskStatusListFilter] = useState('')
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [taskDraft, setTaskDraft] = useState({ childId: '', title: '', dueDate: DATA_AS_OF, assignedTo: ASHA_WORKER_ROSTER[0]?.name ?? '', priority: 'Normal' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const canManageTasks = hasPermission(PERMISSIONS.MANAGE_OUTREACH, cloudEnabled ? profile : undefined)
  const canAssignTasks = hasPermission(PERMISSIONS.MANAGE_ASSIGNMENTS, cloudEnabled ? profile : undefined)

  const queueRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return followUpQueue.filter((child) => {
      const matchesSearch = !normalizedQuery || child.name.toLocaleLowerCase().includes(normalizedQuery) || child.childId.toLocaleLowerCase().includes(normalizedQuery)
      const matchesLocality = !localityFilter || child.locality === localityFilter
      const matchesReason = !reasonFilter || child.reasons.some((reason) => reasonStatus[reason] === reasonFilter)
      const matchesPriority = !priorityFilter || child.priority === priorityFilter
      const matchesTaskStatus = !taskStatusFilter || child.taskStatus === taskStatusFilter
      return matchesSearch && matchesLocality && matchesReason && matchesPriority && matchesTaskStatus
    })
  }, [followUpQueue, query, localityFilter, reasonFilter, priorityFilter, taskStatusFilter])

  const taskRows = useMemo(() => {
    const normalizedQuery = taskQuery.trim().toLocaleLowerCase()
    return tasks.filter((task) => {
      const child = children.find((item) => item.childId === task.childId)
      const matchesSearch = !normalizedQuery || task.title.toLocaleLowerCase().includes(normalizedQuery) || child?.name.toLocaleLowerCase().includes(normalizedQuery) || task.childId.toLocaleLowerCase().includes(normalizedQuery)
      return matchesSearch && (!taskStatusListFilter || task.status === taskStatusListFilter)
    }).map((task) => ({ ...task, childName: children.find((child) => child.childId === task.childId)?.name ?? 'Unknown child' }))
  }, [tasks, children, taskQuery, taskStatusListFilter])

  const openTaskForm = (child = null) => {
    setTaskDraft({
      childId: child?.childId ?? '',
      title: child ? `Follow up: ${child.reasonText}`.slice(0, 120) : '',
      dueDate: DATA_AS_OF,
      assignedTo: profile?.role === 'asha_worker' ? profile.workerName : child?.assignedAshaWorker ?? ASHA_WORKER_ROSTER[0]?.name ?? '',
      priority: child?.priority === 'High' ? 'High' : 'Normal',
    })
    setError('')
    setMessage('')
    setTaskFormOpen(true)
  }

  const handleCreateTask = async (event) => {
    event.preventDefault()
    const result = await addTask(taskDraft)
    if (!result.ok) return setError(result.message)
    setMessage(`Follow-up task created for ${children.find((child) => child.childId === taskDraft.childId)?.name ?? 'the selected child'}.`)
    setError('')
    setTaskFormOpen(false)
  }

  const handleTaskCompletion = async (task) => {
    const completed = task.status !== 'Completed'
    const result = await setTaskCompletion(task.taskId, completed)
    setMessage(result.ok ? `Task ${completed ? 'marked complete' : 'reopened'}.` : '')
    setError(result.ok ? '' : result.message)
  }

  const queueColumns = [
    { key: 'name', label: 'Child', render: (name, child) => <Link className="outreach-child-link" to={childPath(child.childId)}><strong>{name}</strong><small>{child.childId}</small></Link> },
    { key: 'locality', label: 'Locality' },
    { key: 'reasonText', label: 'Why follow up', render: (reason) => <span className="outreach-reason">{reason}</span> },
    { key: 'reasons', label: 'Risk factors', render: (reasons) => <div className="reason-badges">{reasons.map((reason) => <StatusBadge key={reason} status={reasonStatus[reason]} />)}</div> },
    { key: 'nextDose', label: 'Dose / due date', render: (dose) => dose ? <div className="outreach-dose-cell"><strong>{dose.name} dose {dose.doseNumber}</strong><small>{dateLabel(dose.dueDate)}</small></div> : <span className="outreach-muted">Contact review</span> },
    { key: 'priority', label: 'Priority', render: (priority) => <StatusBadge status={priority} /> },
    { key: 'assignedAshaWorker', label: 'ASHA worker' },
    { key: 'taskStatus', label: 'Follow-up task', render: (status) => <StatusBadge status={status} /> },
    { key: 'action', label: 'Action', render: (_, child) => canManageTasks ? <button className="outreach-create-trigger" type="button" onClick={() => openTaskForm(child)}><Plus size={13} /> Create task</button> : <span className="outreach-muted">Read only</span> },
  ]

  const taskColumns = [
    { key: 'title', label: 'Task', render: (title, task) => <div className="outreach-task-title"><strong>{title}</strong><small>{task.taskId}</small></div> },
    { key: 'childName', label: 'Child', render: (name, task) => <Link className="outreach-child-link" to={childPath(task.childId)}><strong>{name}</strong><small>{task.childId}</small></Link> },
    { key: 'dueDate', label: 'Due date', render: (date, task) => <span className={task.status === 'Open' && date < DATA_AS_OF ? 'outreach-overdue-date' : ''}>{dateLabel(date)}</span> },
    { key: 'priority', label: 'Priority', render: (priority) => <span className={`priority-pill priority-pill--${priority.toLowerCase()}`}>{priority}</span> },
    { key: 'assignedTo', label: 'Assigned worker', render: (worker, task) => task.status === 'Open' && canAssignTasks ? <select className="inline-assignment-select" aria-label={`Assign ${task.taskId}`} value={worker} onChange={(event) => { assignTask(task.taskId, event.target.value).then((result) => { setMessage(result.ok ? 'Task assignment updated.' : ''); setError(result.ok ? '' : result.message) }) }}>{ASHA_WORKER_ROSTER.map((item) => <option key={item.workerId} value={item.name}>{item.name}</option>)}</select> : worker },
    { key: 'status', label: 'Follow-up status', render: (status) => <StatusBadge status={status} /> },
    { key: 'action', label: 'Update status', render: (_, task) => canManageTasks ? <button className={`task-toggle ${task.status === 'Completed' ? 'task-toggle--reopen' : ''}`} type="button" onClick={() => handleTaskCompletion(task)}>{task.status === 'Completed' ? 'Reopen' : 'Mark complete'}</button> : <span className="outreach-muted">Read only</span> },
  ]

  const statCards = [
    { label: 'High-priority children', value: stats.highPriorityChildren, note: 'Overdue, unreachable or migrated', Icon: AlertTriangle, tone: 'amber' },
    { label: 'Overdue vaccination doses', value: stats.overdueDoses, note: `Across ${stats.overdueChildren} children`, Icon: CircleAlert, tone: 'amber' },
    { label: 'Upcoming vaccinations', value: stats.upcomingDoses, note: 'Due within 30 days', Icon: CalendarClock, tone: 'blue' },
    { label: 'Migrated families', value: stats.migratedFamilies, note: 'Review service area assignment', Icon: UsersRound, tone: 'teal' },
    { label: 'Unreachable families', value: stats.unreachableFamilies, note: 'Contact attempt required', Icon: Activity, tone: 'blue' },
    { label: 'Open follow-up tasks', value: stats.openTasks, note: `${stats.completedTasks} completed`, Icon: CheckCheck, tone: 'green' },
  ]

  return <section className="outreach-page" aria-labelledby="page-title">
    <div className="page-heading dashboard-heading"><div><p className="eyebrow">VAXREACH WORKSPACE <span className="eyebrow-separator">/</span> AS OF {dateLabel(DATA_AS_OF).toUpperCase()}</p><h1 id="page-title">Outreach & follow-up</h1><p className="page-description">Find children who may miss a dose and coordinate a timely family follow-up.</p></div><button className="primary-action" type="button" onClick={() => openTaskForm()} disabled={!canManageTasks}><Plus size={16} /> New follow-up task</button></div>
    <div className="demo-notice"><span className="demo-indicator" /> Synthetic records <span className="demo-divider">·</span> Prototype administrator permissions · Rule-based priorities, no AI predictions</div>
    <div className="stat-grid stat-grid--six outreach-stat-grid">{statCards.map((stat) => <StatCard key={stat.label} {...stat} value={new Intl.NumberFormat('en-IN').format(stat.value)} />)}</div>
    <details className="priority-rules"><summary><AlertTriangle size={15} /> How priorities are assigned</summary><div className="priority-rule-list"><p><StatusBadge status="High" /> <span>Any overdue dose, unreachable family, or migrated family needing review.</span></p><p><StatusBadge status="Medium" /> <span>At least one dose due within the next 30 days, with no high-priority condition.</span></p><p>Children may have several risk factors; all applicable factors appear in the follow-up queue.</p></div></details>
    {message && <p className="outreach-notice" role="status"><CheckCheck size={15} />{message}</p>}{error && <p className="form-error outreach-error" role="alert">{error}</p>}
    <div className="outreach-chart-layout"><LocalityOutreachChart localities={localityStats} /><aside className="outreach-method-panel"><span className="outreach-method-icon"><Activity size={18} /></span><p className="chart-kicker">OUTREACH SNAPSHOT</p><h2>{new Intl.NumberFormat('en-IN').format(followUpQueue.length)} children in the follow-up queue</h2><p>Queue includes overdue doses, a dose due soon, a migrated family, or an unreachable household. Priorities use these visible rules and the synthetic reference date.</p><div className="outreach-method-stat"><span>Registered children</span><strong>{new Intl.NumberFormat('en-IN').format(stats.registeredChildren)}</strong></div><div className="outreach-method-stat"><span>Scheduled dose records</span><strong>{new Intl.NumberFormat('en-IN').format(stats.scheduledDoseCount)}</strong></div><div className="outreach-method-stat"><span>Completed follow-up tasks</span><strong>{new Intl.NumberFormat('en-IN').format(stats.completedTasks)}</strong></div></aside></div>
    {taskFormOpen && <section className="worker-management-panel outreach-task-form-panel" aria-labelledby="task-form-title"><div className="worker-panel-heading"><div><h2 id="task-form-title">Create a follow-up task</h2><p>Choose a child, assignee, due date, and priority. The task is saved to shared records.</p></div><button className="task-toggle task-toggle--reopen" type="button" onClick={() => setTaskFormOpen(false)}>Cancel</button></div><form className="task-create-form outreach-task-form" onSubmit={handleCreateTask}><label className="form-field"><span>Child</span><select required value={taskDraft.childId} onChange={(event) => { const child = children.find((item) => item.childId === event.target.value); setTaskDraft((current) => ({ ...current, childId: event.target.value, assignedTo: profile?.role === 'asha_worker' ? profile.workerName : child?.assignedAshaWorker ?? current.assignedTo })) }}><option value="">Select a child</option>{children.map((child) => <option key={child.childId} value={child.childId}>{child.name} · {child.childId} · {child.locality}</option>)}</select></label><label className="form-field"><span>Task description</span><input required minLength={3} maxLength={120} value={taskDraft.title} onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Describe the follow-up" /></label>{profile?.role === 'asha_worker' ? <label className="form-field"><span>Assigned ASHA worker</span><input value={profile.workerName} readOnly /></label> : <label className="form-field"><span>Assigned ASHA worker</span><select required value={taskDraft.assignedTo} onChange={(event) => setTaskDraft((current) => ({ ...current, assignedTo: event.target.value }))}>{ASHA_WORKER_ROSTER.map((worker) => <option key={worker.workerId} value={worker.name}>{worker.name}</option>)}</select></label>}<label className="form-field"><span>Due date</span><input required type="date" min={DATA_AS_OF} value={taskDraft.dueDate} onChange={(event) => setTaskDraft((current) => ({ ...current, dueDate: event.target.value }))} /></label><label className="form-field"><span>Priority</span><select value={taskDraft.priority} onChange={(event) => setTaskDraft((current) => ({ ...current, priority: event.target.value }))}><option>Normal</option><option>High</option></select></label><button className="primary-action" type="submit" disabled={!canManageTasks}><Plus size={15} /> Create task</button></form></section>}
    <section className="outreach-list-section outreach-queue-section"><div className="outreach-section-heading"><div><p className="chart-kicker">CHILDREN TO CONTACT</p><h2>Priority follow-up queue</h2><p>Filter by reason, locality, priority, and existing task status.</p></div><span className="record-count">{queueRows.length} of {followUpQueue.length}</span></div>
      <div className="outreach-filters"><label className="search-field"><Search size={16} /><span className="sr-only">Search child name or ID</span><input type="search" placeholder="Search child or ID" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="filter-field"><span>Locality</span><select value={localityFilter} onChange={(event) => setLocalityFilter(event.target.value)}><option value="">All localities</option>{localityStats.map(({ locality }) => <option key={locality}>{locality}</option>)}</select></label><label className="filter-field"><span>Reason</span><select value={reasonFilter} onChange={(event) => setReasonFilter(event.target.value)}><option value="">All reasons</option><option>Overdue</option><option>Upcoming</option><option>Migrated</option><option>Unreachable</option></select></label><label className="filter-field"><span>Priority</span><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="">All priorities</option><option>High</option><option>Medium</option></select></label><label className="filter-field"><span>Task status</span><select value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value)}><option value="">Any task status</option><option>Open</option><option>Completed</option><option>No task</option></select></label></div>
      <DataTable title="Follow-up candidates" description="One row per child; all matching risk factors are shown" columns={queueColumns} rows={queueRows} caption="Rule-based outreach priority queue" emptyMessage="No children match these outreach filters." />
    </section>
    <section className="outreach-list-section outreach-task-list-section"><div className="outreach-section-heading"><div><p className="chart-kicker">FOLLOW-UP WORKFLOW</p><h2>Outreach tasks</h2><p>Review assignments and update task completion status.</p></div><span className="record-count">{tasks.length} tasks</span></div><div className="outreach-filters outreach-task-filters"><label className="search-field"><Search size={16} /><span className="sr-only">Search task or child</span><input type="search" placeholder="Search task or child" value={taskQuery} onChange={(event) => setTaskQuery(event.target.value)} /></label><label className="filter-field"><span>Follow-up status</span><select value={taskStatusListFilter} onChange={(event) => setTaskStatusListFilter(event.target.value)}><option value="">All tasks</option><option>Open</option><option>Completed</option></select></label></div><DataTable title="Follow-up task list" description={`${taskRows.length} of ${tasks.length} tasks`} columns={taskColumns} rows={taskRows} caption="Outreach task assignments and completion status" emptyMessage="No outreach tasks match these filters." /></section>
    <p className="data-disclaimer">All child and worker details are synthetic. Priority reflects explicit dose, migration, contact, and timing rules—not a prediction of future behavior.</p>
  </section>
}

export default OutreachPage
