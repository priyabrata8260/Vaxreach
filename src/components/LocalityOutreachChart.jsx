function LocalityOutreachChart({ localities }) {
  const max = Math.max(1, ...localities.flatMap((item) => [item.overdueChildren, item.upcomingDoses]))

  return <section className="chart-panel outreach-locality-panel" aria-labelledby="outreach-locality-title">
    <div className="chart-heading"><div><p className="chart-kicker">SERVICE AREA BREAKDOWN</p><h2 id="outreach-locality-title">Missed vaccinations by locality</h2></div><div className="outreach-chart-legend"><span><i className="legend-overdue" /> Children overdue</span><span><i className="legend-upcoming" /> Doses due soon</span></div></div>
    <div className="outreach-locality-list">{localities.map(({ locality, registeredChildren, overdueChildren, upcomingDoses }) => <div className="outreach-locality-row" key={locality}>
      <div className="outreach-locality-name"><strong>{locality}</strong><small>{registeredChildren} children</small></div>
      <div className="outreach-bars"><div className="outreach-bar-line" aria-label={`${overdueChildren} children overdue`}><span className="outreach-bar-value">{overdueChildren}</span><span className="outreach-bar-track"><i className="legend-overdue" style={{ width: `${(overdueChildren / max) * 100}%` }} /></span></div><div className="outreach-bar-line" aria-label={`${upcomingDoses} upcoming doses`}><span className="outreach-bar-value">{upcomingDoses}</span><span className="outreach-bar-track"><i className="legend-upcoming" style={{ width: `${(upcomingDoses / max) * 100}%` }} /></span></div></div>
    </div>)}</div>
    <p className="outreach-chart-caption">Bars scale to the largest value in the displayed localities. Upcoming dose window: 30 days from the sample reference date.</p>
  </section>
}

export default LocalityOutreachChart
