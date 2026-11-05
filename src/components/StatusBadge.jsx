const statusClasses = {
  Complete: 'status-badge--complete',
  Completed: 'status-badge--complete',
  Scheduled: 'status-badge--scheduled',
  'Follow-up': 'status-badge--follow-up',
  Pending: 'status-badge--pending',
  Overdue: 'status-badge--overdue',
  'Immediate follow-up': 'status-badge--overdue',
  Migrated: 'status-badge--scheduled',
  Unreachable: 'status-badge--follow-up',
  'Up to date': 'status-badge--complete',
  'Migrated out': 'status-badge--follow-up',
  Resident: 'status-badge--complete',
  Reachable: 'status-badge--complete',
  Open: 'status-badge--scheduled',
  Upcoming: 'status-badge--scheduled',
  High: 'status-badge--overdue',
  Medium: 'status-badge--follow-up',
  'No task': 'status-badge--pending',
}

function StatusBadge({ status }) {
  return <span className={`status-badge ${statusClasses[status] ?? 'status-badge--pending'}`}><span />{status}</span>
}

export default StatusBadge
