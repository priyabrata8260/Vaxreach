const statusClasses = {
  Complete: 'status-badge--complete',
  Scheduled: 'status-badge--scheduled',
  'Follow-up': 'status-badge--follow-up',
  Pending: 'status-badge--pending',
  Overdue: 'status-badge--overdue',
}

function StatusBadge({ status }) {
  return <span className={`status-badge ${statusClasses[status] ?? 'status-badge--pending'}`}><span />{status}</span>
}

export default StatusBadge
