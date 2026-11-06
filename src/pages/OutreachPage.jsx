import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, AlertTriangle, CalendarClock, CheckCheck, CircleAlert, Plus, Search, UsersRound } from 'lucide-react'
import DataTable from '../components/DataTable.jsx'
import LocalityOutreachChart from '../components/LocalityOutreachChart.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { deriveOutreachData } from '../data/outreachOverview.js'
import { DATA_AS_OF } from '../data/syntheticChildren.js'
import { useWorkers } from '../hooks/WorkersContext.jsx'
import { useChildren } from '../hooks/useChildren.js'
import { useOutreach } from '../hooks/useOutreach.js'
import { hasPermission, PERMISSIONS } from '../utils/permissions.js'
import { useAuth } from '../hooks/useAuth.js'
import { workspacePath } from '../utils/accessControl.js'
import { Modal } from '../components/ui.jsx'

const dateLabel = (value) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
const reasonStatus = { 'Overdue vaccination': 'Overdue', 'Upcoming vaccination': 'Upcoming', 'Migrated family': 'Migrated out', 'Unreachable family': 'Unreachable' }

function OutreachPage() {
  const { children, loading: childrenLoading, error: childrenError } = useChildren()
  const { workers } = useWorkers()
  const { profile, cloudEnabled } = useAuth()
  const childPath = (id) => workspacePath(`children/${id}`, profile?.role, cloudEnabled)
  const { tasks, addTask, setTaskCompletion, loading: tasksLoading, error: tasksError } = useOutreach()
  const { followUpQueue, localityStats, stats } = useMemo(() => deriveOutreachData(children, tasks), [children, tasks])
  const [query, setQuery] = useState('')
  const [localityFilter, setLocalityFilter] = useState('')
  const [reasonFilter, setReasonFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [taskStatusFilter, setTaskStatusFilter] = useState('')
  const [taskQuery, setTaskQuery] = useState('')
  const [taskStatusListFilter, setTaskStatusListFilter] = useState('')
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [taskDraft, setTaskDraft] = useState({ childId: '', title: '', dueDate: DATA_AS_OF, assignedTo: workers.find((worker) => worker.active !== false)?.name ?? '', priority: 'Normal' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const canManageTasks = hasPermission(PERMISSIONS.MANAGE_OUTREACH, cloudEnabled ? profile : undefined)

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

  if (cloudEnabled && profile?.role === 'asha_worker') return <AssignedTasksView childRecords={children} childrenLoading={childrenLoading} childrenError={childrenError} tasks={tasks} tasksLoading={tasksLoading} tasksError={tasksError} setTaskCompletion={setTaskCompletion} />

  const openTaskForm = (child = null) => {
    setTaskDraft({
      childId: child?.childId ?? '',
      title: child ? `Follow up: ${child.reasonText}`.slice(0, 120) : '',
      dueDate: DATA_AS_OF,
      assignedTo: profile?.role === 'asha_worker' ? profile.workerName : child?.assignedAshaWorker ?? workers.find((worker) => worker.active !== false)?.name ?? '',
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
    <div className="demo-notice"><span className="demo-indicator" /> {cloudEnabled ? 'Child and outreach records connected to the VaxReach database' : 'Synthetic records stored in this browser'} <span className="demo-divider">·</span> {profile?.role === 'asha_worker' ? 'ASHA worker access' : 'Administrator access'} · Rule-based priorities, no AI predictions</div>
    <div className="stat-grid stat-grid--six outreach-stat-grid">{statCards.map((stat) => <StatCard key={stat.label} {...stat} value={new Intl.NumberFormat('en-IN').format(stat.value)} />)}</div>
    <details className="priority-rules"><summary><AlertTriangle size={15} /> How priorities are assigned</summary><div className="priority-rule-list"><p><StatusBadge status="High" /> <span>Any overdue dose, unreachable family, or migrated family needing review.</span></p><p><StatusBadge status="Medium" /> <span>At least one dose due within the next 30 days, with no high-priority condition.</span></p><p>Children may have several risk factors; all applicable factors appear in the follow-up queue.</p></div></details>
    {message && <p className="outreach-notice" role="status"><CheckCheck size={15} />{message}</p>}{error && <p className="form-error outreach-error" role="alert">{error}</p>}
    <div className="outreach-chart-layout"><LocalityOutreachChart localities={localityStats} /><aside className="outreach-method-panel"><span className="outreach-method-icon"><Activity size={18} /></span><p className="chart-kicker">OUTREACH SNAPSHOT</p><h2>{new Intl.NumberFormat('en-IN').format(followUpQueue.length)} children in the follow-up queue</h2><p>Queue includes overdue doses, a dose due soon, a migrated family, or an unreachable household. Priorities use these visible rules and the synthetic reference date.</p><div className="outreach-method-stat"><span>Registered children</span><strong>{new Intl.NumberFormat('en-IN').format(stats.registeredChildren)}</strong></div><div className="outreach-method-stat"><span>Scheduled dose records</span><strong>{new Intl.NumberFormat('en-IN').format(stats.scheduledDoseCount)}</strong></div><div className="outreach-method-stat"><span>Completed follow-up tasks</span><strong>{new Intl.NumberFormat('en-IN').format(stats.completedTasks)}</strong></div></aside></div>
    {taskFormOpen && <section className="worker-management-panel outreach-task-form-panel" aria-labelledby="task-form-title"><div className="worker-panel-heading"><div><h2 id="task-form-title">Create a follow-up task</h2><p>Choose a child, assignee, due date, and priority. The task is saved to shared records.</p></div><button className="task-toggle task-toggle--reopen" type="button" onClick={() => setTaskFormOpen(false)}>Cancel</button></div><form className="task-create-form outreach-task-form" onSubmit={handleCreateTask}><label className="form-field"><span>Child</span><select required value={taskDraft.childId} onChange={(event) => { const child = children.find((item) => item.childId === event.target.value); setTaskDraft((current) => ({ ...current, childId: event.target.value, assignedTo: profile?.role === 'asha_worker' ? profile.workerName : child?.assignedAshaWorker ?? current.assignedTo })) }}><option value="">Select a child</option>{children.map((child) => <option key={child.childId} value={child.childId}>{child.name} · {child.childId} · {child.locality}</option>)}</select></label><label className="form-field"><span>Task description</span><input required minLength={3} maxLength={120} value={taskDraft.title} onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Describe the follow-up" /></label>{profile?.role === 'asha_worker' ? <label className="form-field"><span>Assigned ASHA worker</span><input value={profile.workerName} readOnly /></label> : <label className="form-field"><span>Assigned ASHA worker</span><select required value={taskDraft.assignedTo} onChange={(event) => setTaskDraft((current) => ({ ...current, assignedTo: event.target.value }))}>{workers.filter((worker) => worker.active !== false).map((worker) => <option key={worker.workerId} value={worker.name}>{worker.name}</option>)}</select></label>}<label className="form-field"><span>Due date</span><input required type="date" min={DATA_AS_OF} value={taskDraft.dueDate} onChange={(event) => setTaskDraft((current) => ({ ...current, dueDate: event.target.value }))} /></label><label className="form-field"><span>Priority</span><select value={taskDraft.priority} onChange={(event) => setTaskDraft((current) => ({ ...current, priority: event.target.value }))}><option>Normal</option><option>High</option></select></label><button className="primary-action" type="submit" disabled={!canManageTasks}><Plus size={15} /> Create task</button></form></section>}
    <section className="outreach-list-section outreach-queue-section"><div className="outreach-section-heading"><div><p className="chart-kicker">CHILDREN TO CONTACT</p><h2>Priority follow-up queue</h2><p>Filter by reason, locality, priority, and existing task status.</p></div><span className="record-count">{queueRows.length} of {followUpQueue.length}</span></div>
      <div className="outreach-filters"><label className="search-field"><Search size={16} /><span className="sr-only">Search child name or ID</span><input type="search" placeholder="Search child or ID" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="filter-field"><span>Locality</span><select value={localityFilter} onChange={(event) => setLocalityFilter(event.target.value)}><option value="">All localities</option>{localityStats.map(({ locality }) => <option key={locality}>{locality}</option>)}</select></label><label className="filter-field"><span>Reason</span><select value={reasonFilter} onChange={(event) => setReasonFilter(event.target.value)}><option value="">All reasons</option><option>Overdue</option><option>Upcoming</option><option>Migrated</option><option>Unreachable</option></select></label><label className="filter-field"><span>Priority</span><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="">All priorities</option><option>High</option><option>Medium</option></select></label><label className="filter-field"><span>Task status</span><select value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value)}><option value="">Any task status</option><option>Open</option><option>Completed</option><option>No task</option></select></label></div>
      <DataTable title="Follow-up candidates" description="One row per child; all matching risk factors are shown" columns={queueColumns} rows={queueRows} caption="Rule-based outreach priority queue" emptyMessage="No children match these outreach filters." />
    </section>
    <section className="outreach-list-section outreach-task-list-section"><div className="outreach-section-heading"><div><p className="chart-kicker">FOLLOW-UP WORKFLOW</p><h2>Outreach tasks</h2><p>Review assignments and update task completion status.</p></div><span className="record-count">{tasks.length} tasks</span></div><div className="outreach-filters outreach-task-filters"><label className="search-field"><Search size={16} /><span className="sr-only">Search task or child</span><input type="search" placeholder="Search task or child" value={taskQuery} onChange={(event) => setTaskQuery(event.target.value)} /></label><label className="filter-field"><span>Follow-up status</span><select value={taskStatusListFilter} onChange={(event) => setTaskStatusListFilter(event.target.value)}><option value="">All tasks</option><option>Open</option><option>Completed</option></select></label></div><DataTable title="Follow-up task list" description={`${taskRows.length} of ${tasks.length} tasks`} columns={taskColumns} rows={taskRows} caption="Outreach task assignments and completion status" emptyMessage="No outreach tasks match these filters." /></section>
    <p className="data-disclaimer">{cloudEnabled ? 'Child, worker, and outreach task records are loaded from the connected VaxReach database; task changes are submitted to that database.' : 'Synthetic child and worker details and task changes are stored in this browser.'} Priority reflects explicit dose, migration, contact, and timing rules—not a prediction of future behavior. The prototype reference date is {dateLabel(DATA_AS_OF)}.</p>
  </section>
}

function AssignedTasksView({ childRecords, childrenLoading, childrenError, tasks, tasksLoading, tasksError, setTaskCompletion }) {
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [selectedTask, setSelectedTask] = useState(null)
  const [completionNotes, setCompletionNotes] = useState('')
  const [followUpOutcome, setFollowUpOutcome] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [todayISO] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  })
  const loading = childrenLoading || tasksLoading
  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const overdue = task.status !== 'Completed' && task.dueDate < todayISO
    const matchesFilter = filter === 'All' || filter === 'Pending' && task.status === 'Open' && !overdue || filter === 'Overdue' && overdue || filter === 'Completed' && task.status === 'Completed'
    const child = childRecords.find((item) => item.childId === task.childId)
    const term = query.trim().toLocaleLowerCase()
    return matchesFilter && (!term || task.title.toLocaleLowerCase().includes(term) || child?.name.toLocaleLowerCase().includes(term) || task.childId.toLocaleLowerCase().includes(term))
  }), [tasks, childRecords, filter, query, todayISO])

  const openDetails = (task) => {
    setSelectedTask(task)
    setCompletionNotes(task.completionNotes ?? '')
    setFollowUpOutcome(task.followUpOutcome ?? '')
    setActionError('')
    setNotice('')
  }
  const saveTask = async (complete) => {
    if (!selectedTask) return
    setBusy(true)
    setActionError('')
    const result = await setTaskCompletion(selectedTask.taskId, complete, { completionNotes: completionNotes.trim(), followUpOutcome: followUpOutcome.trim() })
    setBusy(false)
    if (!result.ok) return setActionError('The task could not be updated. Please refresh and try again.')
    setSelectedTask(null)
    setNotice(complete ? 'Task marked complete.' : 'Task reopened.')
  }
  const statusFor = (task) => task.status === 'Completed' ? 'Completed' : task.dueDate < todayISO ? 'Overdue' : 'Pending'

  return <section className="outreach-page" aria-labelledby="page-title">
    <div className="page-heading dashboard-heading"><div><p className="eyebrow">FIELD WORKSPACE <span className="eyebrow-separator">/</span> TASKS</p><h1 id="page-title">Assigned Tasks</h1><p className="page-description">Review and update outreach tasks assigned to your account.</p></div></div>
    {loading ? <p className="cloud-data-loading" role="status">Loading assigned children and tasks…</p> : <>
      {childrenError && <p className="cloud-data-error" role="alert">Children data could not be loaded. Refresh the page or try again later.</p>}
      {tasksError && <p className="cloud-data-error" role="alert">Outreach tasks could not be loaded. Refresh the page or try again later.</p>}
      {notice && <p className="outreach-notice" role="status">{notice}</p>}
      {!childrenError && !tasksError && <>
        <div className="outreach-filters"><label className="search-field"><Search size={16} /><span className="sr-only">Search assigned tasks</span><input type="search" placeholder="Search task, child or ID" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
        <div className="task-filter-bar" role="group" aria-label="Filter assigned tasks">{['All', 'Pending', 'In Progress', 'Completed', 'Overdue'].map((item) => <button key={item} type="button" className={`task-toggle${filter === item ? ' task-toggle--active' : ''}`} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div>
        {filter === 'In Progress' && <p className="outreach-muted">The current task status model does not define an In Progress status.</p>}
        <section className="outreach-list-section outreach-task-list-section"><div className="outreach-section-heading"><div><p className="chart-kicker">YOUR CASELOAD</p><h2>{filter} tasks</h2><p>Task details are limited to records available to your account.</p></div><span className="record-count">{filteredTasks.length} tasks</span></div>
          {filteredTasks.length ? <div className="assigned-task-grid">{filteredTasks.map((task) => {
            const child = childRecords.find((item) => item.childId === task.childId)
            const status = statusFor(task)
            return <article className="assigned-task-card" key={task.taskId}><div className="assigned-task-card-heading"><div><p className="chart-kicker">{task.taskType}</p><h3>{task.title}</h3></div><StatusBadge status={status} /></div><p className="assigned-task-child"><Link to={`/asha/children/${encodeURIComponent(task.childId)}`}>{child?.name ?? task.childId}</Link><span>{child?.locality ?? 'Locality unavailable'}</span></p><div className="assigned-task-meta"><span><strong>Due</strong> {dateLabel(task.dueDate)}</span><span><strong>Priority</strong> {task.priority}</span></div><button className="secondary-action" type="button" onClick={() => openDetails(task)}>View details and update</button></article>
          })}</div> : <p className="outreach-empty-state">{filter === 'In Progress' ? 'No tasks use this status in the current task model.' : tasks.length === 0 ? 'No assigned tasks are available.' : 'No tasks match this filter.'}</p>}
        </section>
      </>}
    </>}
    <Modal open={Boolean(selectedTask)} onClose={() => setSelectedTask(null)} title={selectedTask?.title ?? 'Task details'} description="Review this assigned task and record the follow-up outcome." footer={<><button className="secondary-action" type="button" onClick={() => setSelectedTask(null)} disabled={busy}>Cancel</button><button className="primary-action" type="button" onClick={() => saveTask(selectedTask?.status !== 'Completed')} disabled={busy}>{busy ? 'Saving…' : selectedTask?.status === 'Completed' ? 'Save and reopen' : 'Save and mark complete'}</button></>}>
      {selectedTask && <div className="assigned-task-detail"><p><strong>Child:</strong> {childRecords.find((item) => item.childId === selectedTask.childId)?.name ?? selectedTask.childId}</p><p><strong>Locality:</strong> {childRecords.find((item) => item.childId === selectedTask.childId)?.locality ?? 'Unavailable'}</p><p><strong>Due:</strong> {dateLabel(selectedTask.dueDate)} · <strong>Priority:</strong> {selectedTask.priority} · <strong>Status:</strong> {statusFor(selectedTask)}</p><label className="form-field"><span>Completion notes</span><textarea maxLength={2000} value={completionNotes} onChange={(event) => setCompletionNotes(event.target.value)} /></label><label className="form-field"><span>Follow-up outcome</span><textarea maxLength={500} value={followUpOutcome} onChange={(event) => setFollowUpOutcome(event.target.value)} /></label>{actionError && <p className="form-error" role="alert">{actionError}</p>}</div>}
    </Modal>
  </section>
}

export default OutreachPage
