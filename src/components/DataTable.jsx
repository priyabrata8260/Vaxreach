function DataTable({ title, description, columns, rows, caption }) {
  return <section className="data-panel"><div className="panel-heading"><div><h2>{title}</h2><p>{description}</p></div><span className="record-count">{rows.length} records</span></div><div className="table-scroll"><table><caption className="sr-only">{caption ?? title}</caption><thead><tr>{columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row[column.key], row) : row[column.key]}</td>)}</tr>)}</tbody></table></div></section>
}

export default DataTable
