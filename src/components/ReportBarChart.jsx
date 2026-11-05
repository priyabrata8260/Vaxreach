function ReportBarChart({ title, eyebrow, items, mode = 'count', emptyMessage = 'No matching records for this selection.' }) {
  const max = Math.max(1, ...items.map((item) => mode === 'coverage' ? 100 : item.value ?? item.count ?? 0))
  return <section className="report-panel report-chart-panel">
    <div className="report-panel-heading"><div><p className="report-eyebrow">{eyebrow}</p><h2>{title}</h2></div>{mode === 'coverage' && <span className="report-legend"><i /> Completed</span>}</div>
    {items.length ? <div className="report-bars">{items.map((item) => {
      const value = mode === 'coverage' ? item.coverage : item.value ?? item.count ?? 0
      const width = Math.max(value > 0 ? 1 : 0, value / max * 100)
      const detail = mode === 'coverage' ? `${item.completed} of ${item.total} · ${item.coverage}%` : `${value}${item.total != null ? ` / ${item.total}` : ''}`
      return <div className="report-bar-row" key={item.id ?? item.name ?? item.label}>
        <div className="report-bar-label"><span>{item.label ?? item.name}</span><strong>{detail}</strong></div>
        <div className="report-bar-track" role="img" aria-label={`${item.label ?? item.name}: ${detail}`}><i className={mode === 'coverage' ? 'report-bar-fill report-bar-fill--coverage' : 'report-bar-fill'} style={{ width: `${width}%` }} /></div>
      </div>
    })}</div> : <p className="report-empty-chart">{emptyMessage}</p>}
  </section>
}

export default ReportBarChart
