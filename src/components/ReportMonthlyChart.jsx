function ReportMonthlyChart({ months }) {
  const max = Math.max(1, ...months.map((month) => month.count))
  return <section className="report-panel report-month-panel">
    <div className="report-panel-heading"><div><p className="report-eyebrow">ADMINISTERED DATE</p><h2>Monthly vaccination trend</h2></div><span className="report-unit">Completed doses</span></div>
    {months.length ? <div className="report-month-chart" role="img" aria-label={`Monthly completed doses: ${months.map(({ label, count }) => `${label}: ${count}`).join(', ')}`}>
      {months.map((month) => <div className="report-month-column" key={month.key} title={`${month.label}: ${month.count} completed doses`}><strong>{month.count}</strong><i style={{ height: `${Math.max(month.count ? 3 : 0, month.count / max * 100)}%` }} /><span>{month.label}</span></div>)}
    </div> : <p className="report-empty-chart">No vaccination activity matches this selection.</p>}
  </section>
}

export default ReportMonthlyChart
