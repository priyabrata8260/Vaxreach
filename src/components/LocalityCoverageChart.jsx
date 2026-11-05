function LocalityCoverageChart({ localities }) {
  return <section className="chart-panel" aria-labelledby="locality-chart-title"><div className="chart-heading"><div><p className="chart-kicker">BY SERVICE AREA</p><h2 id="locality-chart-title">Locality-wise coverage</h2></div><span className="chart-legend"><span /> Fully immunised</span></div><div className="locality-chart">{localities.map(({ locality, total, fullyImmunised, coverage }) => <div className="locality-row" key={locality}><div className="locality-label"><span>{locality}</span><span>{coverage}% <small>({fullyImmunised}/{total})</small></span></div><div className="coverage-track" role="img" aria-label={`${locality}: ${fullyImmunised} of ${total} children fully immunised, ${coverage} percent`}><span style={{ width: `${coverage}%` }} /></div></div>)}</div><div className="chart-axis"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div></section>
}

export default LocalityCoverageChart
