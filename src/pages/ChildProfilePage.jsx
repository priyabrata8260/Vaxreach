import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, MapPin, Pencil, ShieldCheck, UserRound } from 'lucide-react'
import DataTable from '../components/DataTable.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { DATA_AS_OF, VACCINATION_SCHEDULE } from '../data/syntheticChildren.js'
import { useChildren } from '../hooks/useChildren.js'

const formatDate = (value) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) : '—'
const historyColumns = [
  { key: 'name', label: 'Vaccine / dose', render: (name, dose) => `${name} dose ${dose.doseNumber}` },
  { key: 'scheduledDate', label: 'Scheduled date', render: formatDate },
  { key: 'administeredDate', label: 'Date given', render: formatDate },
  { key: 'administeredBy', label: 'Administered by' },
  { key: 'recordedBy', label: 'Recorded by', render: (value) => value || 'Sample record' },
  { key: 'status', label: 'Record status', render: () => <StatusBadge status="Complete" /> },
]
const doseColumns = [
  { key: 'name', label: 'Vaccine / dose' },
  { key: 'dueDate', label: 'Due date', render: formatDate },
  { key: 'status', label: 'Status', render: (status) => <StatusBadge status={status} /> },
]

function ChildProfilePage() {
  const { childId } = useParams()
  const { children } = useChildren()
  const child = children.find((record) => record.childId === childId)
  if (!child) return <Navigate to="/children" replace />

  const pendingDoses = child.pendingDoses.map((dose) => ({ ...dose, status: dose.status === 'Due today' ? 'Pending' : 'Scheduled' }))
  const overdueDoses = child.overdueDoses.map((dose) => ({ ...dose, status: 'Overdue' }))

  return <section className="profile-page" aria-labelledby="page-title">
    <div className="profile-toolbar"><Link className="back-link" to="/children"><ArrowLeft size={16} /> Child registry</Link><Link className="secondary-action" to={`/children/${child.childId}/edit`}><Pencil size={15} /> Edit information</Link></div>
    <div className="page-heading profile-heading"><div><p className="eyebrow">CHILD PROFILE <span className="eyebrow-separator">/</span> {child.childId}</p><h1 id="page-title">{child.name}</h1><p className="page-description">Age {child.age.label} <span className="profile-dot">·</span> Registered {formatDate(child.registrationDate)}</p></div><StatusBadge status={child.followUpStatus} /></div>
    <div className="profile-info-grid">
      <article className="profile-info-card"><span className="profile-info-icon"><CalendarDays size={17} /></span><div><small>Date of birth</small><strong>{formatDate(child.dateOfBirth)}</strong></div></article>
      <article className="profile-info-card"><span className="profile-info-icon"><MapPin size={17} /></span><div><small>Locality</small><strong>{child.locality}</strong></div></article>
      <article className="profile-info-card"><span className="profile-info-icon"><UserRound size={17} /></span><div><small>Assigned ASHA worker</small><strong>{child.assignedAshaWorker}</strong></div></article>
      <article className="profile-info-card"><span className="profile-info-icon"><ShieldCheck size={17} /></span><div><small>Family status</small><strong>{child.migrationStatus} · {child.familyReachability}</strong></div></article>
    </div>
    <div className="profile-dose-summary"><div><small>Completed doses</small><strong>{child.completedDoseCount} <span>/ {VACCINATION_SCHEDULE.length}</span></strong></div><div><small>Pending doses</small><strong>{child.pendingDoses.length}</strong></div><div><small>Overdue doses</small><strong className={child.overdueDoses.length ? 'text-overdue' : ''}>{child.overdueDoses.length}</strong></div></div>
    <div className="profile-tables"><DataTable title="Vaccination history" description="All doses recorded for this child" columns={historyColumns} rows={child.vaccinationHistory} caption={`Vaccination history for ${child.name}`} emptyMessage="No doses have been recorded for this child." /><div className="profile-dose-tables"><DataTable title="Pending doses" description="Not yet due or due today" columns={doseColumns} rows={pendingDoses} caption={`Pending doses for ${child.name}`} /><DataTable title="Overdue doses" description="Due before the sample reference date" columns={doseColumns} rows={overdueDoses} caption={`Overdue doses for ${child.name}`} /></div></div>
    <p className="data-disclaimer">Synthetic prototype record. Reference date: {formatDate(DATA_AS_OF)}. No real patient information is shown.</p>
  </section>
}

export default ChildProfilePage
