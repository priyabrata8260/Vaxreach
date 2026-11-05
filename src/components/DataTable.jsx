function DataTable({ title, description, columns, rows, caption, emptyMessage = 'No records to display.' }) {
  return <section className="data-panel"><div className="panel-heading"><div><h2>{title}</h2><p>{description}</p></div><span className="record-count">{rows.length} records</span></div><div className="table-scroll"><table><caption className="sr-only">{caption ?? title}</caption><thead><tr>{columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={row.id ?? row.childId}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row[column.key], row) : row[column.key]}</td>)}</tr>) : <tr><td className="table-empty" colSpan={columns.length}>{emptyMessage}</td></tr>}</tbody></table></div></section>
}

export default DataTable
