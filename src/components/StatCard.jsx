import { Link } from 'react-router-dom'

function StatCard({ label, value, note, Icon, tone = 'teal', to }) {
  const content = <><div className={`stat-icon stat-icon--${tone}`}><Icon size={19} strokeWidth={1.9} /></div><p className="stat-label">{label}</p><p className="stat-value">{value}</p><p className="stat-note">{note}</p>{to && <span className="stat-card-action">View details <span aria-hidden="true">→</span></span>}</>
  return to
    ? <Link className="stat-card stat-card-link" to={to} aria-label={`${label}: ${value}. ${note}. View details`}>{content}</Link>
    : <article className="stat-card">{content}</article>
}

export default StatCard
