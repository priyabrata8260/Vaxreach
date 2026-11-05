import { Check, CircleAlert, PenLine } from 'lucide-react'

function DoseRecordAction({ row, canRecord, isOpen, dateValue, error, onOpen, onClose, onDateChange, onSubmit }) {
  if (row.status === 'Completed') return <span className="dose-action-complete"><Check size={14} /> Recorded</span>
  if (!canRecord) return <span className="dose-action-readonly">Read only</span>
  if (row.scheduledDate > row.referenceDate) return <span className="dose-action-readonly">Not due yet</span>

  if (!isOpen) return <button className="dose-record-trigger" type="button" onClick={() => onOpen(row)}><PenLine size={13} /> Record dose</button>

  return <form className="dose-entry-form" onSubmit={onSubmit}>
    <label><span className="sr-only">Actual vaccination date for {row.childName}, {row.vaccineName} dose {row.doseNumber}</span><input type="date" value={dateValue} min={row.scheduledDate} max={row.referenceDate} required onChange={(event) => onDateChange(event.target.value)} /></label>
    {error && <span className="dose-entry-error" role="alert"><CircleAlert size={12} />{error}</span>}
    <div className="dose-entry-controls"><button className="dose-save-button" type="submit">Save</button><button className="dose-cancel-button" type="button" onClick={onClose}>Cancel</button></div>
  </form>
}

export default DoseRecordAction
