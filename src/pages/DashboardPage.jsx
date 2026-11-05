import { Activity, Syringe, Users, UserRound, CalendarDays, MapPin } from 'lucide-react'
import DataTable from '../components/DataTable.jsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { dashboardStats, recentActivity } from '../data/dashboard.js'

const statIcons = [Users, Syringe, CalendarDays, UserRound]
const activityColumns = [
  { key: 'child', label: 'Child' },
  { key: 'area', label: 'Service area' },
  { key: 'vaccine', label: 'Vaccine / dose' },
  { key: 'date', label: 'Date' },
  { key: 'worker', label: 'ASHA worker' },
  { key: 'status', label: 'Status', render: (status) => <StatusBadge status={status} /> },
]

function DashboardPage() {
  return <section className="dashboard-page" aria-labelledby="page-title">
    <div className="page-heading dashboard-heading"><div><p className="eyebrow">THURSDAY, 05 NOVEMBER 2026 <span className="eyebrow-separator">/</span> DISTRICT OVERVIEW</p><h1 id="page-title">Programme overview</h1><p className="page-description">A clear view of immunisation activity across your service areas.</p></div><div className="location-chip"><MapPin size={15} /><span>All service areas</span></div></div>
    <div className="demo-notice"><span className="demo-indicator" /> Demo workspace <span className="demo-divider">·</span> Sample records for prototype preview</div>
    <div className="stat-grid">{dashboardStats.map((stat, index) => <StatCard key={stat.label} {...stat} Icon={statIcons[index]} />)}</div>
    <div className="dashboard-lower"><DataTable title="Recent vaccination activity" description="Latest immunisation records from your service areas" columns={activityColumns} rows={recentActivity} caption="Sample recent vaccination activity" /><aside className="summary-panel"><div className="summary-icon"><Activity size={18} /></div><p className="summary-kicker">THIS WEEK</p><h2>Keep every child on schedule</h2><p className="summary-description">Follow-up reminders help families stay up to date with their child’s immunisation schedule.</p><div className="summary-metric"><span>Follow-ups due</span><strong>42</strong></div><div className="summary-progress" role="img" aria-label="58 percent of weekly follow-ups completed"><span /></div><p className="summary-footnote">24 of 42 follow-ups completed</p></aside></div>
    <p className="data-disclaimer">Illustrative sample data only. No real patient records are shown.</p>
  </section>
}

export default DashboardPage
