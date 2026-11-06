import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { DATA_AS_OF, VACCINATION_SCHEDULE } from '../data/syntheticChildren.js'
import { useWorkers } from '../hooks/WorkersContext.jsx'
import { useChildren } from '../hooks/useChildren.js'
import { useOutreach } from '../hooks/useOutreach.js'
import { useAuth } from '../hooks/useAuth.js'
import { workspacePath } from '../utils/accessControl.js'
import { useToast } from '../components/ui.jsx'

function ChildFormPage() {
  const { childId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { children, addChild } = useChildren()
  const { workers } = useWorkers()
  const { updateChildDetails } = useOutreach()
  const { profile, cloudEnabled } = useAuth()
  const path = (target) => workspacePath(target, profile?.role, cloudEnabled)
  const existing = childId ? children.find((child) => child.childId === childId) : null
  const isEditing = Boolean(childId)
  const localities = useMemo(() => [...new Set(children.map((child) => child.locality))].sort(), [children])
  const workerNames = workers.filter((worker) => worker.active !== false).map((worker) => worker.name)
  const [form, setForm] = useState(() => ({
    name: existing?.name ?? '',
    dateOfBirth: existing?.dateOfBirth ?? '',
    locality: existing?.locality ?? localities[0] ?? '',
    assignedAshaWorker: existing?.assignedAshaWorker ?? workerNames[0] ?? '',
    registrationDate: existing?.registrationDate ?? DATA_AS_OF,
    migrationStatus: existing?.migrationStatus ?? 'Resident',
    familyReachability: existing?.familyReachability ?? 'Reachable',
  }))
  const [error, setError] = useState('')

  if (isEditing && !existing) return <Navigate to={path('children')} replace />

  const setField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const name = form.name.trim()
    if (name.length < 2) return setError('Enter a child name with at least two characters.')
    if (!form.dateOfBirth || !form.registrationDate || !form.locality || !form.assignedAshaWorker) return setError('Complete all required fields before saving.')
    if (form.dateOfBirth > DATA_AS_OF) return setError('Date of birth cannot be after the application reference date.')
    if (form.registrationDate < form.dateOfBirth || form.registrationDate > DATA_AS_OF) return setError('Registration date must be on or after birth and on or before the reference date.')

    if (existing) {
      const invalidHistory = existing.vaccinationHistory.some((dose) => {
        const scheduleDose = VACCINATION_SCHEDULE.find((item) => item.id === dose.id)
        if (!scheduleDose) return false
        const scheduledDate = new Date(`${form.dateOfBirth}T00:00:00Z`)
        scheduledDate.setUTCDate(scheduledDate.getUTCDate() + scheduleDose.dueAfterDays)
        return dose.administeredDate < scheduledDate.toISOString().slice(0, 10)
      })
      if (invalidHistory) return setError('This birth date would place a recorded vaccination before its scheduled date. Review the vaccination history before changing it.')
    }

    const details = { ...form, name }
    const updateResult = existing ? await updateChildDetails(existing.childId, details) : null
    if (updateResult && !updateResult.ok) return setError(updateResult.message)
    const savedChild = existing ? updateResult.child : await addChild({ ...details, vaccinationHistory: [] })
    if (!savedChild) return setError('The child record could not be saved. Please try again.')
    toast({ title: existing ? 'Child details saved' : 'Child registered', message: `${savedChild.name}'s record is ready.` })
    navigate(path(`children/${savedChild.childId}`))
  }

  return <section className="child-form-page" aria-labelledby="page-title">
    <Link className="back-link" to={existing ? path(`children/${existing.childId}`) : path('children')}><ArrowLeft size={16} /> {existing ? 'Back to profile' : 'Child registry'}</Link>
    <div className="page-heading form-heading"><div><p className="eyebrow">CHILD REGISTRY</p><h1 id="page-title">{existing ? 'Edit child information' : 'Register a child'}</h1><p className="page-description">{existing ? `Update the registry details for ${existing.name}.` : cloudEnabled ? 'Register a child in the connected VaxReach database.' : 'Add a fictional child record to the local prototype registry.'}</p></div></div>
    <form className="child-form" onSubmit={handleSubmit} noValidate>
      <div className="form-section-heading"><h2>Child details</h2><p>Fields marked required must be completed.</p></div>
      <div className="form-grid">
        <label className="form-field form-field--wide"><span>Child name <b>Required</b></span><input name="name" value={form.name} onChange={setField} maxLength={80} autoComplete="off" required placeholder="Enter a fictional name" /></label>
        <label className="form-field"><span>Date of birth <b>Required</b></span><input type="date" name="dateOfBirth" value={form.dateOfBirth} onChange={setField} max={DATA_AS_OF} required /></label>
        <label className="form-field"><span>Registration date <b>Required</b></span><input type="date" name="registrationDate" value={form.registrationDate} onChange={setField} min={form.dateOfBirth || undefined} max={DATA_AS_OF} required /></label>
        <label className="form-field"><span>Locality <b>Required</b></span><select name="locality" value={form.locality} onChange={setField} required>{localities.map((locality) => <option key={locality} value={locality}>{locality}</option>)}</select></label>
        <label className="form-field"><span>Assigned ASHA worker <b>Required</b></span><select name="assignedAshaWorker" value={form.assignedAshaWorker} onChange={setField} required>{workerNames.map((worker) => <option key={worker} value={worker}>{worker}</option>)}</select></label>
        <label className="form-field"><span>Migration status</span><select name="migrationStatus" value={form.migrationStatus} onChange={setField}><option value="Resident">Resident</option><option value="Migrated out">Migrated out</option></select></label>
        <label className="form-field"><span>Family reachability</span><select name="familyReachability" value={form.familyReachability} onChange={setField}><option value="Reachable">Reachable</option><option value="Unreachable">Unreachable</option></select></label>
      </div>
      {existing && <div className="form-note">Vaccination history is preserved when registry information is edited. Change the date of birth only when the recorded dose dates remain valid for the sample schedule.</div>}
      {!existing && <div className="form-note">A unique child ID will be assigned automatically. No vaccination doses are prefilled; due, pending and overdue doses are calculated from the sample schedule.</div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><Link className="secondary-action" to={existing ? path(`children/${existing.childId}`) : path('children')}>Cancel</Link><button className="primary-action" type="submit"><Save size={16} /> {existing ? 'Save changes' : 'Register child'}</button></div>
    </form>
    <p className="data-disclaimer">{cloudEnabled ? 'Child details are saved to the connected VaxReach database. This prototype uses a fixed application reference date for date fields and dose calculations.' : 'Local prototype only. Synthetic records are stored in this browser and do not sync to a server.'}</p>
  </section>
}

export default ChildFormPage
