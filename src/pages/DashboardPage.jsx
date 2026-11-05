import { CalendarClock, CheckCheck, CircleAlert, Syringe, Users, UsersRound, MapPin } from 'lucide-react'
import DataTable from '../components/DataTable.jsx'
import LocalityCoverageChart from '../components/LocalityCoverageChart.jsx'
import MonthlyTrendChart from '../components/MonthlyTrendChart.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { DASHBOARD_AS_OF, DOSE_SCHEDULE, dashboardChildren, dashboardSummary, immediateFollowUps, localityCoverage, monthlyVaccinationTrend, recentVaccinationActivity } from '../data/dashboard.js'

const numberFormat = new Intl.NumberFormat('en-IN')
const dateLabel = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${DASHBOARD_AS_OF}T00:00:00Z`))
const statCards = [
  { label: 'Registered children', value: dashboardSummary.totalChildren, note: `Across ${localityCoverage.length} service areas`, Icon: Users, tone: 'blue' },
  { label: 'Fully immunised', value: dashboardSummary.fullyImmunised, note: 'All scheduled doses recorded', Icon: CheckCheck, tone: 'green' },
  { label: 'Partially immunised', value: dashboardSummary.partiallyImmunised, note: 'One or more doses remaining', Icon: Syringe, tone: 'teal' },
  { label: 'Overdue vaccinations', value: dashboardSummary.overdueVaccinations, note: 'Past their scheduled date', Icon: CircleAlert, tone: 'amber' },
  { label: 'Upcoming vaccinations', value: dashboardSummary.upcomingVaccinations, note: 'Due in the next 30 days', Icon: CalendarClock, tone: 'blue' },
  { label: 'Vaccination coverage', value: `${dashboardSummary.coveragePercentage}%`, note: `${dashboardSummary.fullyImmunised} of ${dashboardSummary.totalChildren} children`, Icon: UsersRound, tone: 'green' },
]

const activityColumns = [
  { key: 'child', label: 'Child' },
  { key: 'locality', label: 'Locality' },
  { key: 'vaccine', label: 'Vaccine / dose' },
  { key: 'dateLabel', label: 'Date given' },
  { key: 'ashaWorker', label: 'ASHA worker' },
  { key: 'status', label: 'Status', render: () => <StatusBadge status="Complete" /> },
]

const followUpColumns = [
  { key: 'name', label: 'Child' },
  { key: 'locality', label: 'Locality' },
  { key: 'nextVaccine', label: 'Dose due' },
  { key: 'dueDateLabel', label: 'Due date' },
  { key: 'overdueDays', label: 'Days overdue', render: (days) => <strong className="overdue-days">{numberFormat.format(days)} days</strong> },
  { key: 'dueStatus', label: 'Priority', render: (status) => <StatusBadge status={status} /> },
]

const followUpRows = immediateFollowUps.map((child) => ({ ...child, nextVaccine: DOSE_SCHEDULE[child.completedDoses] }))

function DashboardPage() {
  return <section className="dashboard-page" aria-labelledby="page-title">
    <div className="page-heading dashboard-heading"><div><p className="eyebrow">PROGRAMME OVERVIEW <span className="eyebrow-separator">/</span> AS OF {dateLabel.toUpperCase()}</p><h1 id="page-title">Immunisation dashboard</h1><p className="page-description">Coverage, upcoming doses and follow-up priorities across your service areas.</p></div><div className="location-chip"><MapPin size={15} /><span>All service areas</span></div></div>
    <div className="demo-notice"><span className="demo-indicator" /> Synthetic demo data <span className="demo-divider">·</span> Not linked to patient records</div>
    <div className="stat-grid stat-grid--six">{statCards.map((stat) => <StatCard key={stat.label} {...stat} value={typeof stat.value === 'number' ? numberFormat.format(stat.value) : stat.value} />)}</div>
    <div className="chart-grid"><LocalityCoverageChart localities={localityCoverage} /><MonthlyTrendChart months={monthlyVaccinationTrend} /></div>
    <div className="table-grid"><DataTable title="Recent vaccination activity" description="Latest recorded doses in the demo dataset" columns={activityColumns} rows={recentVaccinationActivity} caption="Recent synthetic vaccination activity" /><DataTable title="Immediate follow-up" description="Children with doses past their scheduled date" columns={followUpColumns} rows={followUpRows} caption="Children requiring immediate vaccination follow-up" /></div>
    <p className="data-disclaimer">All names, dates and vaccination records are entirely synthetic and for prototype demonstration only. {numberFormat.format(dashboardChildren.length)} sample child records in the dashboard dataset.</p>
  </section>
}

export default DashboardPage
