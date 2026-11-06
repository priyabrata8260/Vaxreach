import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { Button, Modal } from './ui.jsx'
import { useWorkers } from '../hooks/WorkersContext.jsx'

export default function WorkerEditor({ open, worker = null, localities = [], onClose, onSaved }) {
  const { saveWorker } = useWorkers()
  const [form, setForm] = useState({ workerId: '', name: '', locality: '', active: true })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setForm({ workerId: worker?.workerId ?? '', name: worker?.name ?? '', locality: worker?.locality?.split(', ')[0] ?? '', active: worker?.active !== false })
    setError('')
  }, [worker, open])
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }))
  const submit = async (event) => {
    event.preventDefault()
    if (form.name.trim().length < 2) { setError('Enter the worker’s full name.'); return }
    if (!worker && !/^ASHA-[A-Z0-9-]{2,20}$/i.test(form.workerId.trim())) { setError('Enter a worker code such as ASHA-013.'); return }
    setBusy(true); setError('')
    const result = await saveWorker(worker?.workerId ?? '', { ...form, workerId: form.workerId.trim().toUpperCase(), name: form.name.trim() })
    setBusy(false)
    if (!result.ok) { setError(result.message); return }
    onSaved?.(result.worker)
  }
  return <Modal open={open} onClose={() => !busy && onClose?.()} title={worker ? 'Edit worker information' : 'Create worker profile'} description="Manage the operational worker record and service area.">
    <form className="worker-editor-form" onSubmit={submit}>
      {!worker && <label className="form-field"><span>Worker code <b>Required</b></span><input name="workerId" value={form.workerId} onChange={update} placeholder="ASHA-013" required /></label>}
      {worker && <div className="worker-editor-code"><small>Worker code</small><strong>{worker.workerId}</strong></div>}
      <label className="form-field"><span>Full name <b>Required</b></span><input name="name" value={form.name} onChange={update} maxLength={100} required /></label>
      <label className="form-field"><span>Assigned locality</span><select name="locality" value={form.locality} onChange={update}><option value="">No locality assigned</option>{localities.map((locality) => <option key={locality} value={locality}>{locality}</option>)}</select></label>
      <label className="worker-active-field"><input type="checkbox" name="active" checked={form.active} onChange={update} /><span>Worker is active</span></label>
      <p className="worker-security-note">This form manages the worker record only. Sign-in account creation and ASHA role assignment must be completed through secure backend provisioning.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="vr-modal-footer"><Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}><Save size={15} /> {busy ? 'Saving…' : worker ? 'Save worker' : 'Create worker'}</Button></div>
    </form>
  </Modal>
}
