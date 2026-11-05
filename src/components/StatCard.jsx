function StatCard({ label, value, note, Icon, tone = 'teal' }) {
  return <article className="stat-card"><div className={`stat-icon stat-icon--${tone}`}><Icon size={19} strokeWidth={1.9} /></div><p className="stat-label">{label}</p><p className="stat-value">{value}</p><p className="stat-note">{note}</p></article>
}

export default StatCard
