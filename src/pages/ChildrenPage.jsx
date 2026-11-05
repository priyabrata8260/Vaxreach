import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import DataTable from '../components/DataTable.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { DATA_AS_OF, VACCINATION_SCHEDULE } from '../data/syntheticChildren.js'
import { useChildren } from '../hooks/useChildren.js'
import { useAuth } from '../hooks/useAuth.js'
import { hasPermission, PERMISSIONS } from '../utils/permissions.js'
import { workspacePath } from '../utils/accessControl.js'

const upcomingCutoff = new Date(`${DATA_AS_OF}T00:00:00Z`)
upcomingCutoff.setUTCDate(upcomingCutoff.getUTCDate() + 30)

function ChildrenPage() {
  const { children } = useChildren()
  const { profile, cloudEnabled } = useAuth()
  const path = (target) => workspacePath(target, profile?.role, cloudEnabled)
  const canEditRegistry = hasPermission(PERMISSIONS.MANAGE_ASSIGNMENTS, cloudEnabled ? profile : undefined)
  const [search, setSearch] = useState('')
  const [locality, setLocality] = useState('')
  const [vaccinationStatus, setVaccinationStatus] = useState('')
  const [migrationStatus, setMigrationStatus] = useState('')
  const localities = useMemo(() => [...new Set(children.map((child) => child.locality))].sort(), [children])

  const filteredChildren = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return children.filter((child) => {
      const matchesSearch = !query || child.name.toLocaleLowerCase().includes(query) || child.childId.toLocaleLowerCase().includes(query)
      const matchesLocality = !locality || child.locality === locality
      const matchesMigration = !migrationStatus || child.migrationStatus === migrationStatus
      const isFullyImmunised = child.completedDoseCount >= VACCINATION_SCHEDULE.length
      const isUpcoming = child.pendingDoses.some(({ dueDate }) => {
        const due = new Date(`${dueDate}T00:00:00Z`)
        return due >= new Date(`${DATA_AS_OF}T00:00:00Z`) && due <= upcomingCutoff
      })
      const matchesVaccination = !vaccinationStatus
        || (vaccinationStatus === 'Fully immunised' && isFullyImmunised)
        || (vaccinationStatus === 'Partially immunised' && !isFullyImmunised)
        || (vaccinationStatus === 'Overdue' && child.overdueDoses.length > 0)
        || (vaccinationStatus === 'Upcoming' && isUpcoming)
        || (vaccinationStatus === 'Up to date' && child.followUpStatus === 'Up to date')
      return matchesSearch && matchesLocality && matchesMigration && matchesVaccination
    })
  }, [children, search, locality, vaccinationStatus, migrationStatus])

  const columns = [
    { key: 'name', label: 'Child', render: (name, child) => <div className="registry-child"><span className="registry-avatar">{name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><span><strong>{name}</strong><small>{child.childId}</small></span></div> },
    { key: 'age', label: 'Age', render: (age) => age.label },
    { key: 'locality', label: 'Locality' },
    { key: 'completedDoseCount', label: 'Doses', render: (count, child) => <div className="dose-progress"><strong>{count} / {VACCINATION_SCHEDULE.length}</strong><small>{child.overdueDoses.length ? `${child.overdueDoses.length} overdue` : `${child.pendingDoses.length} pending`}</small></div> },
    { key: 'followUpStatus', label: 'Follow-up', render: (status) => <StatusBadge status={status} /> },
    { key: 'migrationStatus', label: 'Migration', render: (status) => <StatusBadge status={status} /> },
    { key: 'actions', label: 'Actions', render: (_, child) => <div className="registry-actions"><Link to={path(`children/${child.childId}`)}>View</Link>{canEditRegistry && <Link to={path(`children/${child.childId}/edit`)}>Edit</Link>}</div> },
  ]

  return <section className="registry-page" aria-labelledby="page-title">
    <div className="page-heading"><div><p className="eyebrow">VAXREACH WORKSPACE</p><h1 id="page-title">{profile?.role === 'asha_worker' ? 'My assigned children' : 'Child registry'}</h1><p className="page-description">{profile?.role === 'asha_worker' ? 'Children assigned to your ASHA worker account.' : 'Search and manage registered children and their immunisation records.'}</p></div>{canEditRegistry && <Link className="primary-action" to={path('children/new')}><Plus size={17} /> Add child</Link>}</div>
    <div className="registry-summary"><span className="registry-summary-icon">{children.length}</span><span><strong>Registered children</strong><small>All records are stored in this browser’s prototype registry.</small></span><span className="synthetic-pill">Synthetic demo data</span></div>
    <div className="registry-filters" aria-label="Filter child records">
      <label className="search-field"><Search size={17} /><span className="sr-only">Search by child name or ID</span><input type="search" placeholder="Search name or child ID" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label className="filter-field"><span>Locality</span><select value={locality} onChange={(event) => setLocality(event.target.value)}><option value="">All localities</option>{localities.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="filter-field"><span>Vaccination status</span><select value={vaccinationStatus} onChange={(event) => setVaccinationStatus(event.target.value)}><option value="">All statuses</option><option>Fully immunised</option><option>Partially immunised</option><option>Overdue</option><option>Upcoming</option><option>Up to date</option></select></label>
      <label className="filter-field"><span>Migration</span><select value={migrationStatus} onChange={(event) => setMigrationStatus(event.target.value)}><option value="">All families</option><option value="Resident">Resident</option><option value="Migrated out">Migrated out</option></select></label>
    </div>
    <DataTable title="Registered children" description={`${filteredChildren.length} of ${children.length} records`} columns={columns} rows={filteredChildren} caption="Searchable child registry" emptyMessage="No children match these search and filter settings." />
  </section>
}

export default ChildrenPage
