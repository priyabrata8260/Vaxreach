import { useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, CircleAlert, Download, Printer, Syringe, UsersRound } from 'lucide-react'
import DataTable from '../components/DataTable.jsx'
import ReportBarChart from '../components/ReportBarChart.jsx'
import ReportMonthlyChart from '../components/ReportMonthlyChart.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { VACCINATION_SCHEDULE } from '../data/syntheticChildren.js'
import { deriveReportsData, getReportDateBounds } from '../data/reports.js'
import { useChildren } from '../hooks/useChildren.js'
import { useOutreach } from '../hooks/useOutreach.js'
import { exportCsv } from '../utils/exportCsv.js'

const dateLabel = (value) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)) : '—'
const percent = (value) => `${value}%`

function ReportsPage() {
  const { children, loading: childrenLoading, error: childrenError } = useChildren()
  const { tasks, loading: tasksLoading, error: tasksError } = useOutreach()
  const bounds = useMemo(() => getReportDateBounds(children), [children])
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', locality: '', vaccine: '', ashaWorker: '', vaccinationStatus: '' })
  const activeFilters = { ...filters, dateFrom: filters.dateFrom || bounds.min, dateTo: filters.dateTo || bounds.max }
  const report = deriveReportsData(children, tasks, activeFilters)
  const localities = useMemo(() => [...new Set(children.map((child) => child.locality))].sort(), [children])
  const workers = useMemo(() => [...new Set(children.map((child) => child.assignedAshaWorker))].sort(), [children])
  const loading = childrenLoading || tasksLoading

  const setFilter = (name, value) => setFilters((current) => ({ ...current, [name]: value }))
  const clearFilters = () => setFilters({ dateFrom: '', dateTo: '', locality: '', vaccine: '', ashaWorker: '', vaccinationStatus: '' })
  const downloadCsv = () => exportCsv(`vaxreach-report-${activeFilters.dateFrom}-to-${activeFilters.dateTo}.csv`, report.visibleDoseEvents.map((event) => ({
    report_date_from: activeFilters.dateFrom,
    report_date_to: activeFilters.dateTo,
    child_id: event.childId,
    child_name: event.childName,
    locality: event.locality,
    asha_worker: event.assignedAshaWorker,
    vaccine: event.vaccine,
    dose_number: event.doseNumber,
    scheduled_date: event.dueDate,
    vaccination_status: event.status,
    administered_date: event.administeredDate,
    migration_status: event.migrationStatus,
    family_reachability: event.familyReachability,
    child_follow_up_status: event.followUpStatus,
    follow_up_task: event.taskTitle,
    follow_up_due_date: event.taskDueDate,
    follow_up_task_status: event.taskStatus,
  })))

  const doseColumns = [
    { key: 'childName', label: 'Child', render: (name, row) => <div className="report-child-cell"><strong>{name}</strong><small>{row.childId}</small></div> },
    { key: 'locality', label: 'Locality' },
    { key: 'vaccine', label: 'Vaccine / dose', render: (name, row) => `${name} · ${row.doseNumber}` },
    { key: 'dueDate', label: 'Scheduled', render: dateLabel },
    { key: 'administeredDate', label: 'Administered', render: (value) => value ? dateLabel(value) : '—' },
    { key: 'status', label: 'Status', render: (value) => <StatusBadge status={value} /> },
    { key: 'assignedAshaWorker', label: 'ASHA worker' },
    { key: 'taskTitle', label: 'Follow-up', render: (title, row) => <span className="report-follow-up-cell">{title || row.followUpStatus}<small>{row.taskDueDate ? `Due ${dateLabel(row.taskDueDate)}` : row.taskStatus}</small></span> },
  ]

  const zeroDoseRows = report.zeroDoseChildren.map((child) => ({
    ...child,
    eligibleOverdueCount: report.missedDoseEvents.filter((event) => event.childId === child.childId).length,
    openTask: tasks.find((task) => task.childId === child.childId && task.status === 'Open'),
  }))
  const zeroDoseColumns = [
    { key: 'name', label: 'Child', render: (name, row) => <div className="report-child-cell"><strong>{name}</strong><small>{row.childId}</small></div> },
    { key: 'locality', label: 'Locality' },
    { key: 'assignedAshaWorker', label: 'ASHA worker' },
    { key: 'registrationDate', label: 'Registered', render: dateLabel },
    { key: 'completedDoseCount', label: 'Doses by report date', render: () => '0' },
    { key: 'eligibleOverdueCount', label: 'Overdue in selection' },
    { key: 'openTask', label: 'Follow-up task', render: (task) => task ? `${task.title} · ${dateLabel(task.dueDate)}` : 'No open task' },
  ]
  const localityColumns = [
    { key: 'name', label: 'Locality' }, { key: 'total', label: 'Eligible doses' },
    { key: 'completed', label: 'Completed by end date' }, { key: 'coverage', label: 'Coverage', render: percent },
    { key: 'overdue', label: 'Overdue doses' },
  ]
  const workerColumns = [
    { key: 'name', label: 'ASHA worker' }, { key: 'assignedChildren', label: 'Children in selection' },
    { key: 'doses', label: 'Eligible doses' }, { key: 'completed', label: 'Completed' },
    { key: 'overdue', label: 'Overdue' }, { key: 'coverage', label: 'Dose coverage', render: percent },
  ]
  const familyRows = report.familyRecords.map((child) => ({
    ...child,
    reportReasons: [child.migrationStatus === 'Migrated out' ? 'Migrated out' : '', child.familyReachability === 'Unreachable' ? 'Unreachable' : ''].filter(Boolean).join(' · '),
    overdueInSelection: report.missedDoseEvents.filter((event) => event.childId === child.childId).length,
    activeTask: tasks.find((task) => task.childId === child.childId && task.status === 'Open'),
  }))
  const familyColumns = [
    { key: 'name', label: 'Child', render: (name, row) => <div className="report-child-cell"><strong>{name}</strong><small>{row.childId}</small></div> },
    { key: 'locality', label: 'Locality' }, { key: 'assignedAshaWorker', label: 'ASHA worker' },
    { key: 'reportReasons', label: 'Family status' }, { key: 'overdueInSelection', label: 'Overdue doses' },
    { key: 'activeTask', label: 'Follow-up', render: (task) => task ? <span className="report-follow-up-cell">{task.title}<small>Due {dateLabel(task.dueDate)}</small></span> : <StatusBadge status="No open task" /> },
  ]

  if (loading) return <section className="reports-page" aria-busy="true"><div className="reports-loading"><span className="report-loading-dot" /> Loading report data from the shared registry…</div></section>

  const coverageChartRows = report.vaccineCoverage.map((item) => ({ ...item, label: item.label }))
  const localityChartRows = report.localityCoverage.map((item) => ({ ...item, label: item.name }))
  const missedChartRows = report.missedDistribution.map((item) => ({ ...item, value: item.count }))

  return <section className="reports-page" aria-labelledby="reports-title">
    <div className="page-heading reports-heading"><div><p className="eyebrow">PROGRAMME INSIGHTS</p><h1 id="reports-title">Reports</h1><p className="page-description">Explore vaccination coverage, missed doses and follow-up needs from the shared child registry.</p></div><div className="reports-heading-actions"><span className="synthetic-report-label"><span /> Synthetic demonstration data</span><button className="report-action-button" type="button" onClick={downloadCsv} disabled={!report.visibleDoseEvents.length}><Download size={15} /> Export CSV</button><button className="report-action-button" type="button" onClick={() => window.print()}><Printer size={15} /> Print</button></div></div>

    <section className="report-filter-panel" aria-label="Report filters">
      <div className="report-filter-heading"><div><CalendarDays size={16} /><div><strong>Report filters</strong><small>Filters recalculate every report from shared records.</small></div></div><button type="button" className="report-clear-button" onClick={clearFilters}>Clear filters</button></div>
      <div className="report-filter-grid">
        <label className="report-filter"><span>Scheduled date from</span><input type="date" value={activeFilters.dateFrom} max={activeFilters.dateTo} onChange={(event) => setFilter('dateFrom', event.target.value)} /></label>
        <label className="report-filter"><span>Scheduled date to</span><input type="date" value={activeFilters.dateTo} min={activeFilters.dateFrom} onChange={(event) => setFilter('dateTo', event.target.value)} /></label>
        <label className="report-filter"><span>Locality</span><select value={filters.locality} onChange={(event) => setFilter('locality', event.target.value)}><option value="">All localities</option>{localities.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="report-filter"><span>Vaccine</span><select value={filters.vaccine} onChange={(event) => setFilter('vaccine', event.target.value)}><option value="">All vaccines</option>{[...new Set(VACCINATION_SCHEDULE.map((dose) => dose.name))].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="report-filter"><span>ASHA worker</span><select value={filters.ashaWorker} onChange={(event) => setFilter('ashaWorker', event.target.value)}><option value="">All workers</option>{workers.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="report-filter"><span>Vaccination status</span><select value={filters.vaccinationStatus} onChange={(event) => setFilter('vaccinationStatus', event.target.value)}><option value="">All statuses</option><option>Completed</option><option>Pending</option><option>Overdue</option></select></label>
      </div>
      {!report.validRange && <p className="report-range-error" role="alert">The start date must be on or before the end date.</p>}
      <p className="report-filter-note">Date range selects scheduled doses; status is measured at the selected end date (capped at the latest dataset date). Coverage is completed records divided by dose records matching all selected filters. A Completed-only selection therefore shows 100%.</p>
    </section>

    <div className="stat-grid report-stat-grid">
      <StatCard label="Children in selection" value={report.eligibleChildren.length} note="Children with an eligible scheduled dose" Icon={UsersRound} tone="teal" />
      <StatCard label="Dose coverage" value={percent(report.coveragePercentage)} note={`${report.completedDoseCount} completed / ${report.visibleDoseEvents.length} selected doses`} Icon={CheckCircle2} tone="green" />
      <StatCard label="Missed / overdue doses" value={report.missedDoseEvents.length} note="Past scheduled date, not completed by end date" Icon={CircleAlert} tone="amber" />
      <StatCard label="Zero-dose children" value={report.zeroDoseChildren.length} note="No schedule dose completed by end date" Icon={Syringe} tone="blue" />
    </div>

    <details className="report-methodology"><summary>Metric definitions and calculations</summary><div className="report-methodology-grid">
      <p><strong>Eligible dose:</strong> one child × one schedule dose whose scheduled date falls within the selected range and matches locality, ASHA worker and vaccine filters.</p>
      <p><strong>Dose status at report end:</strong> Completed when an administration record exists on or before the end date; Overdue when its due date is earlier than the end date and no such record exists; otherwise Pending.</p>
      <p><strong>Dose coverage:</strong> completed selected dose records ÷ all selected dose records × 100. The vaccination-status filter also narrows this denominator.</p>
      <p><strong>Zero-dose child:</strong> a child in the selected cohort with no dose in the sample schedule recorded by the report end date.</p>
      <p><strong>Locality and ASHA coverage:</strong> completed selected doses ÷ selected doses in that locality or assigned worker group × 100. Assigned children are unique children represented in the selected dose cohort.</p>
      <p><strong>Monthly trend:</strong> selected completed doses grouped by actual administration month and limited to the selected date range.</p>
      <p><strong>Missed-dose distribution:</strong> selected overdue doses grouped by vaccine and dose number.</p>
      <p><strong>Migrated / unreachable:</strong> children in the selected dose cohort whose shared registry family status is Migrated out or Unreachable; follow-up comes from open outreach tasks.</p>
    </div></details>

    {(childrenError || tasksError) && <p className="report-load-error" role="alert">Unable to load report data: {childrenError || tasksError}</p>}
    {!children.length && !childrenError ? <div className="report-empty-state"><div><UsersRound size={22} /></div><h2>No child records yet</h2><p>Reports will appear when the shared registry contains child records.</p></div> : children.length > 0 && <>
      <div className="report-chart-grid">
        <ReportBarChart title="Vaccination coverage" eyebrow="BY VACCINE / DOSE" items={coverageChartRows} mode="coverage" />
        <ReportBarChart title="Locality comparison" eyebrow="DOSE COVERAGE" items={localityChartRows} mode="coverage" />
        <ReportMonthlyChart months={report.monthlyTrend} />
        <ReportBarChart title="Missed vaccination distribution" eyebrow="OVERDUE DOSES" items={missedChartRows} emptyMessage="No overdue doses match these filters." />
      </div>

      <div className="report-section-heading"><div><p className="report-eyebrow">REPORT DETAILS</p><h2>Filtered records</h2><p>All counts below are derived from the dose schedule and vaccination history.</p></div><span className="report-selection-count">{report.visibleDoseEvents.length} dose records</span></div>

      <DataTable title="Vaccination coverage by vaccine" description="Eligible scheduled doses with completion counted through the selected end date." columns={[{ key: 'label', label: 'Vaccine / dose' }, { key: 'total', label: 'Eligible doses' }, { key: 'completed', label: 'Completed' }, { key: 'coverage', label: 'Coverage', render: percent }]} rows={coverageChartRows} caption="Vaccination coverage by vaccine and dose" emptyMessage="No scheduled doses fall within this report selection." />
      <DataTable title="Missed and overdue vaccination" description="Dose was scheduled before the selected end date and has no completion record by that date." columns={doseColumns} rows={report.missedDoseEvents} caption="Missed and overdue vaccination records" emptyMessage="No missed or overdue doses match these filters." />
      <DataTable title="Zero-dose children" description="Children in the selected dose cohort with no recorded schedule dose by the end date." columns={zeroDoseColumns} rows={zeroDoseRows} caption="Children with no recorded vaccination doses" emptyMessage="No zero-dose children match these filters." />
      <DataTable title="Locality-wise coverage" description="Coverage is completed eligible doses divided by eligible scheduled doses." columns={localityColumns} rows={report.localityCoverage} caption="Locality-wise vaccination coverage" emptyMessage="No locality records match these filters." />
      <DataTable title="ASHA worker performance" description="Dose coverage and overdue counts for each worker's assigned child records." columns={workerColumns} rows={report.workerPerformance} caption="ASHA worker performance report" emptyMessage="No worker records match these filters." />
      <DataTable title="Migrated and unreachable families" description="Family status among children with a scheduled dose in the selected reporting cohort." columns={familyColumns} rows={familyRows} caption="Migrated or unreachable families and their follow-up" emptyMessage="No migrated or unreachable families match these filters." />
      <p className="report-disclaimer">Synthetic demonstration data · No real personal health information. This simplified schedule and its coverage measures are for prototype demonstration only.</p>
    </>}
  </section>
}

export default ReportsPage
