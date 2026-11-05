import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, CheckCheck, MapPin, Plus, UsersRound } from 'lucide-react'
import DataTable from '../components/DataTable.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { deriveAshaWorkers } from '../data/ashaWorkerStats.js'
import { DATA_AS_OF, ASHA_WORKER_ROSTER } from '../data/syntheticChildren.js'
import { useChildren } from '../hooks/useChildren.js'
import { useOutreach } from '../hooks/useOutreach.js'
import { hasPermission, PERMISSIONS } from '../utils/permissions.js'
import { useAuth } from '../hooks/useAuth.js'
import { workspacePath } from '../utils/accessControl.js'

const formatDate = (value) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
const dateOptions = { min: DATA_AS_OF }

function ASHAWorkerProfilePage() {
  const { workerId } = useParams()
  const { children } = useChildren()
  const { profile, cloudEnabled } = useAuth()
  const path = (target) => workspacePath(target, profile?.role, cloudEnabled)
  const { tasks, assignChildToWorker, addTask, assignTask, setTaskCompletion } = useOutreach()
  const workers = useMemo(() => deriveAshaWorkers(children, tasks), [children, tasks])
  const worker = workers.find((item) => item.workerId === workerId)
  const [assignmentChildId, setAssignmentChildId] = useState('')
  const [taskForm, setTaskForm] = useState({ childId: '', title: '', dueDate: DATA_AS_OF, priority: 'Normal' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const canManage = hasPermission(PERMISSIONS.MANAGE_ASSIGNMENTS, cloudEnabled ? profile : undefined)
  const canManageTasks = hasPermission(PERMISSIONS.MANAGE_OUTREACH, cloudEnabled ? profile : undefined)
    && (profile?.role !== 'asha_worker' || profile.workerCode === workerId)

  if (!worker && !ASHA_WORKER_ROSTER.some((item) => item.workerId === workerId)) return <Navigate to={path('asha-workers')} replace />
  if (!worker) return null

  const stats = [
    { label: 'Children assigned', value: worker.assignedChildCount, note: `${worker.localities.length} assigned localities`, Icon: UsersRound, tone: 'teal' },
    { label: 'Children with overdue doses', value: worker.overdueChildCount, note: 'Need vaccination follow-up', Icon: CalendarClock, tone: 'amber' },
    { label: 'Upcoming follow-ups', value: worker.upcomingFollowUpCount, note: 'Open tasks due within 30 days', Icon: CheckCheck, tone: 'blue' },
    { label: 'Unreachable families', value: worker.unreachableFamilyCount, note: 'Contact status from child records', Icon: UsersRound, tone: 'amber' },
    { label: 'Migrated families', value: worker.migratedFamilyCount, note: 'Marked migrated out', Icon: MapPin, tone: 'blue' },
    { label: 'Open outreach tasks', value: worker.openTaskCount, note: `${worker.completedTaskCount} completed`, Icon: CheckCheck, tone: 'green' },
  ]

  const childColumns = [
    { key: 'name', label: 'Child', render: (name, child) => <Link className="worker-child-link" to={path(`children/${child.childId}`)}><strong>{name}</strong><small>{child.childId}</small></Link> },
    { key: 'locality', label: 'Locality' },
    { key: 'age', label: 'Age', render: (age) => age.label },
    { key: 'doseSummary', label: 'Vaccination follow-up', render: (_, child) => child.overdueDoses.length ? <span className="worker-number-alert">{child.overdueDoses.length} overdue dose{child.overdueDoses.length === 1 ? '' : 's'}</span> : <StatusBadge status={child.followUpStatus} /> },
    { key: 'migrationStatus', label: 'Migration', render: (value) => <StatusBadge status={value} /> },
    { key: 'familyReachability', label: 'Family contact', render: (value) => <StatusBadge status={value} /> },
    { key: 'assignment', label: 'Assigned worker', render: (_, child) => canManage ? <select className="inline-assignment-select" aria-label={`Assign ${child.name} to an ASHA worker`} value={child.assignedAshaWorker} onChange={(event) => assignChildToWorker(child.childId, event.target.value)}>{ASHA_WORKER_ROSTER.map((item) => <option key={item.workerId} value={item.name}>{item.name}</option>)}</select> : child.assignedAshaWorker },
  ]

  const workerTasks = worker.tasks.map((task) => ({ ...task, childName: children.find((child) => child.childId === task.childId)?.name ?? 'Unknown child' }))
  const taskColumns = [
    { key: 'title', label: 'Follow-up task', render: (title, task) => <div className="task-title-cell"><strong>{title}</strong><small>{task.taskType}</small></div> },
    { key: 'childName', label: 'Child', render: (name, task) => <Link className="worker-child-link" to={path(`children/${task.childId}`)}><strong>{name}</strong><small>{task.childId}</small></Link> },
    { key: 'dueDate', label: 'Due date', render: (date, task) => <span className={task.status === 'Open' && date < DATA_AS_OF ? 'task-date-overdue' : ''}>{formatDate(date)}</span> },
    { key: 'priority', label: 'Priority', render: (value) => <span className={`priority-pill priority-pill--${value.toLowerCase()}`}>{value}</span> },
    { key: 'assignedTo', label: 'Assigned worker', render: (value, task) => task.status === 'Open' && canManage ? <select className="inline-assignment-select" aria-label={`Assign task ${task.taskId}`} value={value} onChange={(event) => { assignTask(task.taskId, event.target.value).then((result) => { setMessage(result.ok ? 'Task assignment updated.' : ''); setError(result.ok ? '' : result.message) }) }}>{ASHA_WORKER_ROSTER.map((item) => <option key={item.workerId} value={item.name}>{item.name}</option>)}</select> : value },
    { key: 'status', label: 'Completion', render: (status) => <StatusBadge status={status} /> },
    { key: 'action', label: 'Action', render: (_, task) => canManageTasks ? <button className={`task-toggle ${task.status === 'Completed' ? 'task-toggle--reopen' : ''}`} type="button" onClick={() => { setTaskCompletion(task.taskId, task.status !== 'Completed').then((result) => { setMessage(result.ok ? `Task marked ${task.status === 'Completed' ? 'open' : 'completed'}.` : ''); setError(result.ok ? '' : result.message) }) }}>{task.status === 'Completed' ? 'Reopen' : 'Mark complete'}</button> : <span className="task-readonly">Read only</span> },
  ]

  const handleAssignChild = async (event) => {
    event.preventDefault()
    if (!assignmentChildId) return setError('Select a child to assign.')
    const result = await assignChildToWorker(assignmentChildId, worker.name)
    if (!result.ok) return setError(result.message)
    setAssignmentChildId('')
    setError('')
    setMessage(`${result.child.name} assigned to ${worker.name}. Open tasks for this child were transferred too.`)
  }

  const handleAddTask = async (event) => {
    event.preventDefault()
    const result = await addTask({ ...taskForm, assignedTo: worker.name })
    if (!result.ok) return setError(result.message)
    setTaskForm({ childId: '', title: '', dueDate: DATA_AS_OF, priority: 'Normal' })
    setError('')
    setMessage('Follow-up task created and assigned.')
  }

  return <section className="asha-profile-page" aria-labelledby="page-title">
    <Link className="back-link" to={path('asha-workers')}><ArrowLeft size={16} /> ASHA worker directory</Link>
    <div className="page-heading worker-profile-heading"><div><p className="eyebrow">COMMUNITY HEALTH TEAM <span className="eyebrow-separator">/</span> {worker.workerId}</p><h1 id="page-title">{worker.name}</h1><p className="page-description">Assigned locality: {worker.localityLabel}</p></div><span className="worker-role-pill">Prototype ASHA profile</span></div>
    <div className="stat-grid stat-grid--six asha-profile-stats">{stats.map((stat) => <StatCard key={stat.label} {...stat} value={new Intl.NumberFormat('en-IN').format(stat.value)} />)}</div>
    {message && <p className="worker-notice" role="status">{message}</p>}{error && <p className="form-error worker-error" role="alert">{error}</p>}
    {canManage && <section className="worker-management-panel"><div className="worker-panel-heading"><div><h2>Assign a child</h2><p>Move an existing child record to this ASHA worker.</p></div></div><form className="worker-inline-form" onSubmit={handleAssignChild}><label className="filter-field"><span>Child record</span><select value={assignmentChildId} onChange={(event) => setAssignmentChildId(event.target.value)}><option value="">Select a child</option>{children.filter((child) => child.assignedAshaWorker !== worker.name).map((child) => <option key={child.childId} value={child.childId}>{child.name} · {child.childId} · {child.locality}</option>)}</select></label><button className="primary-action" type="submit" disabled={!children.some((child) => child.assignedAshaWorker !== worker.name)}><UsersRound size={15} /> Assign child</button></form></section>}
    <DataTable title="Assigned children" description={`${worker.assignedChildCount} children · assignment changes update this child registry`} columns={childColumns} rows={worker.assignedChildren} caption={`Children currently assigned to ${worker.name}`} emptyMessage="No children are currently assigned to this worker." />
    {canManageTasks && <section className="worker-management-panel task-create-panel"><div className="worker-panel-heading"><div><h2>Create a follow-up task</h2><p>New tasks are assigned to {worker.name}.</p></div></div><form className="task-create-form" onSubmit={handleAddTask}><label className="form-field"><span>Child</span><select required value={taskForm.childId} onChange={(event) => setTaskForm((current) => ({ ...current, childId: event.target.value }))}><option value="">Select a child</option>{children.map((child) => <option key={child.childId} value={child.childId}>{child.name} · {child.childId}</option>)}</select></label><label className="form-field"><span>Task description</span><input required minLength={3} maxLength={120} value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Confirm family availability" /></label><label className="form-field"><span>Due date</span><input required type="date" min={dateOptions.min} value={taskForm.dueDate} onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))} /></label><label className="form-field"><span>Priority</span><select value={taskForm.priority} onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value }))}><option>Normal</option><option>High</option></select></label><button className="primary-action" type="submit"><Plus size={15} /> Add task</button></form></section>}
    <DataTable title="Outreach task management" description={`${worker.openTaskCount} open · ${worker.completedTaskCount} completed`} columns={taskColumns} rows={workerTasks} caption={`Outreach tasks assigned to ${worker.name}`} emptyMessage="No follow-up tasks are assigned to this worker." />
    <p className="data-disclaimer">Worker and child records are synthetic. Assignments and task progress are saved in this browser only.</p>
  </section>
}

export default ASHAWorkerProfilePage
