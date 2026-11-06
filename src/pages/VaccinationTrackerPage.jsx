import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, CheckCheck, CircleAlert, Eye, Syringe } from 'lucide-react'
import DataTable from '../components/DataTable.jsx'
import DoseRecordAction from '../components/DoseRecordAction.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { ConfirmDialog, Modal, Button } from '../components/ui.jsx'
import { DATA_AS_OF, VACCINATION_SCHEDULE } from '../data/syntheticChildren.js'
import { useChildren } from '../hooks/useChildren.js'
import { hasPermission, PERMISSIONS } from '../utils/permissions.js'
import { useAuth } from '../hooks/useAuth.js'
import { workspacePath } from '../utils/accessControl.js'

const formatDate = (value) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) : '—'
const localityOptions = (children) => [...new Set(children.map((child) => child.locality))].sort()

function VaccinationTrackerPage() {
  const { children, recordDose, correctDose } = useChildren()
  const { profile, cloudEnabled } = useAuth()
  const childPath = (id) => workspacePath(`children/${id}`, profile?.role, cloudEnabled)
  const [search, setSearch] = useState('')
  const [locality, setLocality] = useState('')
  const [vaccine, setVaccine] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateField, setDateField] = useState('scheduledDate')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [activeRowId, setActiveRowId] = useState('')
  const [draftDates, setDraftDates] = useState({})
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')
  const [detailRow, setDetailRow] = useState(null)
  const [correctionDate, setCorrectionDate] = useState('')
  const [confirmCorrection, setConfirmCorrection] = useState(false)
  const [correctionBusy, setCorrectionBusy] = useState(false)
  const [correctionError, setCorrectionError] = useState('')
  const canRecord = hasPermission(PERMISSIONS.RECORD_VACCINATION, cloudEnabled ? profile : undefined)
  const canCorrect = hasPermission(PERMISSIONS.MANAGE_ASSIGNMENTS, cloudEnabled ? profile : undefined)

  const allRows = useMemo(() => children.flatMap((child) => VACCINATION_SCHEDULE.map((dose) => {
    const scheduledDate = new Date(`${child.dateOfBirth}T00:00:00Z`)
    scheduledDate.setUTCDate(scheduledDate.getUTCDate() + dose.dueAfterDays)
    const scheduledDateValue = scheduledDate.toISOString().slice(0, 10)
    const historyEntry = child.vaccinationHistory.find((entry) => entry.id === dose.id)
    const status = historyEntry ? 'Completed' : scheduledDateValue < DATA_AS_OF ? 'Overdue' : 'Pending'
    return { id: `${child.childId}-${dose.id}`, childId: child.childId, doseId: dose.id, childName: child.name, locality: child.locality, vaccineName: dose.name, doseNumber: dose.doseNumber, scheduledDate: scheduledDateValue, actualDate: historyEntry?.administeredDate ?? '', administeredBy: historyEntry?.administeredBy ?? '', recordedBy: historyEntry?.recordedBy ?? '', status, referenceDate: DATA_AS_OF }
  })), [children])

  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return allRows.filter((row) => {
      const matchesSearch = !query || row.childName.toLocaleLowerCase().includes(query) || row.childId.toLocaleLowerCase().includes(query) || row.vaccineName.toLocaleLowerCase().includes(query)
      const relevantDate = row[dateField]
      return matchesSearch && (!locality || row.locality === locality) && (!vaccine || row.vaccineName === vaccine) && (!statusFilter || row.status === statusFilter)
        && (!dateFrom || (relevantDate && relevantDate >= dateFrom)) && (!dateTo || (relevantDate && relevantDate <= dateTo))
    })
  }, [allRows, search, locality, vaccine, statusFilter, dateField, dateFrom, dateTo])
  const doseCounts = useMemo(() => allRows.reduce((counts, row) => { counts[row.status] += 1; return counts }, { Completed: 0, Pending: 0, Overdue: 0 }), [allRows])
  const historyRows = rows.filter((row) => row.status === 'Completed')

  const openRecordForm = (row) => { setActiveRowId(row.id); setDraftDates((current) => ({ ...current, [row.id]: DATA_AS_OF })); setErrors((current) => ({ ...current, [row.id]: '' })); setNotice('') }
  const recordDoseForRow = (row) => async (event) => {
    event.preventDefault()
    const result = await recordDose(row.childId, row.doseId, draftDates[row.id] ?? '')
    if (!result.ok) { setErrors((current) => ({ ...current, [row.id]: result.message })); return }
    setErrors((current) => ({ ...current, [row.id]: '' })); setActiveRowId(''); setNotice(`${row.vaccineName} dose ${row.doseNumber} recorded for ${row.childName}.`)
  }
  const beginCorrection = (row) => { setDetailRow(row); setCorrectionDate(row.actualDate); setCorrectionError('') }
  const saveCorrection = async () => {
    if (!detailRow) return
    setCorrectionBusy(true); setCorrectionError('')
    const result = await correctDose(detailRow.childId, detailRow.doseId, correctionDate)
    setCorrectionBusy(false); setConfirmCorrection(false)
    if (!result.ok) { setCorrectionError(result.message); return }
    setNotice(`Vaccination record updated for ${detailRow.childName}.`); setDetailRow(null)
  }

  const columns = [
    { key: 'vaccineName', label: 'Vaccine / dose', render: (name, row) => <strong className="tracker-dose-name">{name}<span>Dose {row.doseNumber}</span></strong> },
    { key: 'childName', label: 'Child', render: (name, row) => <Link className="tracker-child-link" to={childPath(row.childId)}><strong>{name}</strong><small>{row.childId} · {row.locality}</small></Link> },
    { key: 'scheduledDate', label: 'Scheduled date', render: formatDate },
    { key: 'actualDate', label: 'Actual vaccination date', render: formatDate },
    { key: 'status', label: 'Status', render: (status) => <span className="tracker-status"><StatusBadge status={status} />{status === 'Overdue' && <small>Past scheduled date</small>}{status === 'Pending' && <small>Not yet administered</small>}</span> },
    { key: 'action', label: 'Record / details', render: (_, row) => <div className="tracker-row-actions">{row.status === 'Completed' ? <button className="dose-record-trigger" type="button" onClick={() => setDetailRow(row)}><Eye size={13} /> Details</button> : <DoseRecordAction row={row} canRecord={canRecord} isOpen={activeRowId === row.id} dateValue={draftDates[row.id] ?? DATA_AS_OF} error={errors[row.id]} onOpen={openRecordForm} onClose={() => setActiveRowId('')} onDateChange={(value) => { setDraftDates((current) => ({ ...current, [row.id]: value })); setErrors((current) => ({ ...current, [row.id]: '' })) }} onSubmit={recordDoseForRow(row)} />}</div> },
  ]
  const historyColumns = [
    { key: 'vaccineName', label: 'Vaccine / dose', render: (name, row) => `${name} · Dose ${row.doseNumber}` },
    { key: 'childName', label: 'Child', render: (name, row) => <Link className="tracker-child-link" to={childPath(row.childId)}><strong>{name}</strong><small>{row.childId}</small></Link> },
    { key: 'scheduledDate', label: 'Scheduled date', render: formatDate },
    { key: 'actualDate', label: 'Actual vaccination date', render: formatDate },
    { key: 'administeredBy', label: 'Administered by' },
    { key: 'recordedBy', label: 'Recorded by', render: (value) => value || 'Sample record' },
  ]
  const statCards = [
    { label: 'Completed doses', value: doseCounts.Completed, note: 'Recorded in child histories', Icon: CheckCheck, tone: 'green' },
    { label: 'Pending doses', value: doseCounts.Pending, note: 'Not completed yet', Icon: CalendarClock, tone: 'blue' },
    { label: 'Overdue doses', value: doseCounts.Overdue, note: 'Past scheduled date', Icon: CircleAlert, tone: 'amber' },
  ]

  return <section className="tracker-page" aria-labelledby="page-title">
    <div className="page-heading dashboard-heading"><div><p className="eyebrow">VAXREACH WORKSPACE <span className="eyebrow-separator">/</span> AS OF {formatDate(DATA_AS_OF).toUpperCase()}</p><h1 id="page-title">Vaccination tracker</h1><p className="page-description">Review scheduled doses, actual vaccination records, and corrections.</p></div><span className="tracker-schedule-label"><Syringe size={15} /> {VACCINATION_SCHEDULE.length}-dose sample schedule</span></div>
    <div className="demo-notice"><span className="demo-indicator" /> {cloudEnabled ? 'Vaccination records connected to the VaxReach database' : 'Synthetic vaccination records stored in this browser'} <span className="demo-divider">·</span> {cloudEnabled ? 'The schedule and reference date are prototype values' : 'Local demonstration mode'}</div>
    <div className="stat-grid stat-grid--three">{statCards.map((stat) => <StatCard key={stat.label} {...stat} value={new Intl.NumberFormat('en-IN').format(stat.value)} />)}</div>
    {notice && <p className="tracker-notice" role="status"><CheckCheck size={15} />{notice}</p>}
    <div className="tracker-filters"><label className="search-field"><Syringe size={16} /><span className="sr-only">Search child, identifier, or vaccine</span><input type="search" placeholder="Search child, ID, or vaccine" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="filter-field"><span>Locality</span><select value={locality} onChange={(event) => setLocality(event.target.value)}><option value="">All localities</option>{localityOptions(children).map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="filter-field"><span>Vaccine</span><select value={vaccine} onChange={(event) => setVaccine(event.target.value)}><option value="">All vaccines</option>{[...new Set(VACCINATION_SCHEDULE.map((dose) => dose.name))].map((name) => <option key={name}>{name}</option>)}</select></label><label className="filter-field"><span>Dose status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option><option>Completed</option><option>Pending</option><option>Overdue</option></select></label><label className="filter-field"><span>Date range applies to</span><select value={dateField} onChange={(event) => setDateField(event.target.value)}><option value="scheduledDate">Scheduled date</option><option value="actualDate">Actual vaccination date</option></select></label><label className="filter-field"><span>From</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label><label className="filter-field"><span>To</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label></div>
    <DataTable title="Vaccination records" description={`${rows.length} of ${allRows.length} scheduled dose records`} columns={columns} rows={rows} caption={cloudEnabled ? 'Vaccination records for children in the connected database' : 'Synthetic vaccination records for demonstration children'} emptyMessage="No doses match these search and filter settings." />
    <div className="tracker-history"><DataTable title="Vaccination history" description={`${historyRows.length} completed records in the current filtered view`} columns={historyColumns} rows={historyRows} caption="Recorded vaccination history" emptyMessage="No completed vaccination records match these filters." /></div>
    <p className="data-disclaimer">Scheduled date is calculated from the child’s date of birth and prototype schedule. Actual vaccination date is the recorded administration date. {cloudEnabled ? 'Records are connected to VaxReach database data; database rules validate vaccination dates.' : 'Synthetic records and changes are stored in this browser; database date rules do not run in demo mode.'}</p>
    <Modal open={Boolean(detailRow)} onClose={() => { setDetailRow(null); setCorrectionError('') }} title="Vaccination record details" description="Scheduled and actual dates are shown separately.">
      {detailRow && <div className="vaccination-detail"><div><small>Vaccine / dose</small><strong>{detailRow.vaccineName} · Dose {detailRow.doseNumber}</strong></div><div><small>Child</small><Link to={childPath(detailRow.childId)} onClick={() => setDetailRow(null)}>{detailRow.childName} ({detailRow.childId})</Link></div><div><small>Scheduled date</small><strong>{formatDate(detailRow.scheduledDate)}</strong></div><div><small>Actual vaccination date</small><strong>{formatDate(detailRow.actualDate)}</strong></div><div><small>Administered by</small><strong>{detailRow.administeredBy || 'Not specified'}</strong></div>{canCorrect && <div className="correction-field"><label htmlFor="correction-date">Correct actual vaccination date</label><input id="correction-date" type="date" value={correctionDate} onChange={(event) => setCorrectionDate(event.target.value)} /><small>Saving submits this correction to the database, where date rules are enforced.</small></div>}{correctionError && <p className="form-error" role="alert">{correctionError}</p>}</div>}
      {canCorrect && <div className="vr-modal-footer"><Button variant="secondary" onClick={() => setDetailRow(null)}>Close</Button><Button onClick={() => setConfirmCorrection(true)} disabled={!detailRow || correctionDate === detailRow.actualDate}>Review correction</Button></div>}
    </Modal>
    <ConfirmDialog open={confirmCorrection} onClose={() => !correctionBusy && setConfirmCorrection(false)} onConfirm={saveCorrection} title="Confirm vaccination correction" description={`Update the actual vaccination date for ${detailRow?.childName ?? 'this child'}’s ${detailRow?.vaccineName ?? ''} dose from ${formatDate(detailRow?.actualDate)} to ${formatDate(correctionDate)}?`} confirmLabel="Save correction" busy={correctionBusy} />
  </section>
}

export default VaccinationTrackerPage
