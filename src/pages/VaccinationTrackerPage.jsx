import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, CheckCheck, CircleAlert, Syringe } from 'lucide-react'
import DataTable from '../components/DataTable.jsx'
import DoseRecordAction from '../components/DoseRecordAction.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { DATA_AS_OF, VACCINATION_SCHEDULE } from '../data/syntheticChildren.js'
import { useChildren } from '../hooks/useChildren.js'
import { hasPermission, PERMISSIONS } from '../utils/permissions.js'
import { useAuth } from '../hooks/useAuth.js'
import { workspacePath } from '../utils/accessControl.js'

const formatDate = (value) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
const localityOptions = (children) => [...new Set(children.map((child) => child.locality))].sort()

function VaccinationTrackerPage() {
  const { children, recordDose } = useChildren()
  const { profile, cloudEnabled } = useAuth()
  const childPath = (id) => workspacePath(`children/${id}`, profile?.role, cloudEnabled)
  const [search, setSearch] = useState('')
  const [locality, setLocality] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [activeRowId, setActiveRowId] = useState('')
  const [draftDates, setDraftDates] = useState({})
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')
  const canRecord = hasPermission(PERMISSIONS.RECORD_VACCINATION, cloudEnabled ? profile : undefined)

  const allRows = useMemo(() => children.flatMap((child) => VACCINATION_SCHEDULE.map((dose) => {
    const scheduledDate = new Date(`${child.dateOfBirth}T00:00:00Z`)
    scheduledDate.setUTCDate(scheduledDate.getUTCDate() + dose.dueAfterDays)
    const scheduledDateValue = scheduledDate.toISOString().slice(0, 10)
    const historyEntry = child.vaccinationHistory.find((entry) => entry.id === dose.id)
    const status = historyEntry ? 'Completed' : scheduledDateValue < DATA_AS_OF ? 'Overdue' : 'Pending'
    return {
      id: `${child.childId}-${dose.id}`,
      childId: child.childId,
      doseId: dose.id,
      childName: child.name,
      locality: child.locality,
      vaccineName: dose.name,
      doseNumber: dose.doseNumber,
      scheduledDate: scheduledDateValue,
      scheduledDateLabel: formatDate(scheduledDateValue),
      actualDate: historyEntry?.administeredDate ?? '',
      actualDateLabel: historyEntry ? formatDate(historyEntry.administeredDate) : '—',
      administeredBy: historyEntry?.administeredBy ?? '',
      status,
      referenceDate: DATA_AS_OF,
    }
  })), [children])

  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return allRows.filter((row) => {
      const matchesSearch = !query || row.childName.toLocaleLowerCase().includes(query) || row.childId.toLocaleLowerCase().includes(query)
      return matchesSearch && (!locality || row.locality === locality) && (!statusFilter || row.status === statusFilter)
    })
  }, [allRows, search, locality, statusFilter])

  const doseCounts = useMemo(() => allRows.reduce((counts, row) => {
    counts[row.status] += 1
    return counts
  }, { Completed: 0, Pending: 0, Overdue: 0 }), [allRows])

  const openRecordForm = (row) => {
    setActiveRowId(row.id)
    setDraftDates((current) => ({ ...current, [row.id]: DATA_AS_OF }))
    setErrors((current) => ({ ...current, [row.id]: '' }))
    setNotice('')
  }

  const recordDoseForRow = (row) => async (event) => {
    event.preventDefault()
    const result = await recordDose(row.childId, row.doseId, draftDates[row.id] ?? '')
    if (!result.ok) {
      setErrors((current) => ({ ...current, [row.id]: result.message }))
      return
    }
    setErrors((current) => ({ ...current, [row.id]: '' }))
    setActiveRowId('')
    setNotice(`${row.vaccineName} dose ${row.doseNumber} recorded for ${row.childName}.`)
  }

  const columns = [
    { key: 'childName', label: 'Child', render: (name, row) => <Link className="tracker-child-link" to={childPath(row.childId)}><strong>{name}</strong><small>{row.childId}</small></Link> },
    { key: 'locality', label: 'Locality' },
    { key: 'vaccineName', label: 'Vaccine / dose', render: (name, row) => <strong className="tracker-dose-name">{name}<span>Dose {row.doseNumber}</span></strong> },
    { key: 'scheduledDateLabel', label: 'Scheduled date' },
    { key: 'actualDateLabel', label: 'Actual date' },
    { key: 'status', label: 'Status', render: (status) => <StatusBadge status={status} /> },
    { key: 'action', label: 'Action', render: (_, row) => <DoseRecordAction row={row} canRecord={canRecord} isOpen={activeRowId === row.id} dateValue={draftDates[row.id] ?? DATA_AS_OF} error={errors[row.id]} onOpen={openRecordForm} onClose={() => setActiveRowId('')} onDateChange={(value) => { setDraftDates((current) => ({ ...current, [row.id]: value })); setErrors((current) => ({ ...current, [row.id]: '' })) }} onSubmit={recordDoseForRow(row)} /> },
  ]

  const statCards = [
    { label: 'Completed doses', value: doseCounts.Completed, note: 'Recorded in child histories', Icon: CheckCheck, tone: 'green' },
    { label: 'Pending doses', value: doseCounts.Pending, note: 'Not completed yet', Icon: CalendarClock, tone: 'blue' },
    { label: 'Overdue doses', value: doseCounts.Overdue, note: 'Past scheduled date', Icon: CircleAlert, tone: 'amber' },
  ]

  return <section className="tracker-page" aria-labelledby="page-title">
    <div className="page-heading dashboard-heading"><div><p className="eyebrow">VAXREACH WORKSPACE <span className="eyebrow-separator">/</span> AS OF {new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${DATA_AS_OF}T00:00:00Z`)).toUpperCase()}</p><h1 id="page-title">Vaccination tracker</h1><p className="page-description">Review every scheduled dose and record completed vaccinations.</p></div><span className="tracker-schedule-label"><Syringe size={15} /> {VACCINATION_SCHEDULE.length}-dose sample schedule</span></div>
    <div className="demo-notice"><span className="demo-indicator" /> Prototype access: Administrator <span className="demo-divider">·</span> Changes update this browser’s registry</div>
    <div className="stat-grid stat-grid--three">{statCards.map((stat) => <StatCard key={stat.label} {...stat} value={new Intl.NumberFormat('en-IN').format(stat.value)} />)}</div>
    {notice && <p className="tracker-notice" role="status"><CheckCheck size={15} />{notice}</p>}
    <div className="tracker-filters"><label className="search-field"><Syringe size={16} /><span className="sr-only">Search child name or ID</span><input type="search" placeholder="Search child name or ID" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="filter-field"><span>Locality</span><select value={locality} onChange={(event) => setLocality(event.target.value)}><option value="">All localities</option>{localityOptions(children).map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="filter-field"><span>Dose status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option><option>Completed</option><option>Pending</option><option>Overdue</option></select></label></div>
    <DataTable title="Scheduled doses" description={`${rows.length} of ${allRows.length} child-dose records`} columns={columns} rows={rows} caption="Vaccination doses for all registered synthetic children" emptyMessage="No doses match these search and filter settings." />
    <p className="data-disclaimer">Dose status is calculated against each child’s date of birth and the sample schedule. An actual date must be on or after the scheduled date and no later than {DATA_AS_OF}. Synthetic data only.</p>
  </section>
}

export default VaccinationTrackerPage
