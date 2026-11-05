function MonthlyTrendChart({ months }) {
  const max = Math.max(1, ...months.map(({ count }) => count))
  const chartWidth = 600
  const chartHeight = 205
  const chartTop = 18
  const chartBottom = 160
  const chartRange = chartBottom - chartTop
  const gridValues = [0, Math.ceil(max / 3), Math.ceil((max * 2) / 3), max]
  const barWidth = 44
  const chartLeft = 50
  const chartRight = 590
  const gap = (chartRight - chartLeft - months.length * barWidth) / (months.length - 1)

  return <section className="chart-panel" aria-labelledby="monthly-chart-title"><div className="chart-heading"><div><p className="chart-kicker">DOSES ADMINISTERED</p><h2 id="monthly-chart-title">Monthly vaccination trend</h2></div><span className="chart-period">Last 6 months</span></div><div className="trend-chart-wrap"><svg className="trend-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={`Monthly doses administered: ${months.map(({ month, count }) => `${month} ${count}`).join(', ')}`}>
    {gridValues.map((value, index) => {
      const y = chartBottom - (value / max) * chartRange
      return <g key={`${value}-${index}`}><line x1="42" x2="590" y1={y} y2={y} className="chart-grid-line" /><text x="32" y={y + 3} textAnchor="end" className="chart-tick">{value}</text></g>
    })}
    {months.map(({ month, count }, index) => {
      const x = chartLeft + index * (barWidth + gap)
      const height = count ? Math.max(4, (count / max) * chartRange) : 0
      const y = chartBottom - height
      return <g key={`${month}-${index}`}><rect x={x} y={y} width={barWidth} height={height} rx="5" className={index === months.length - 1 ? 'trend-bar trend-bar--current' : 'trend-bar'} /><text x={x + barWidth / 2} y={y - 8} textAnchor="middle" className="chart-value">{count}</text><text x={x + barWidth / 2} y="184" textAnchor="middle" className="chart-month">{month}</text></g>
    })}
  </svg></div></section>
}

export default MonthlyTrendChart
