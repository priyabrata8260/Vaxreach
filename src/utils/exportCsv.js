export function exportCsv(filename, rows) {
  if (!rows.length) return false
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]
  const encode = (value) => {
    const safe = String(value ?? '').replaceAll('"', '""')
    return `"${safe}"`
  }
  const csv = [columns.map(encode).join(','), ...rows.map((row) => columns.map((column) => encode(row[column])).join(','))].join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename; anchor.click()
  URL.revokeObjectURL(url)
  return true
}
