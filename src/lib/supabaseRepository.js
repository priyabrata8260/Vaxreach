import { supabase } from './supabase.js'
import { VACCINATION_SCHEDULE, createChildRecord } from '../data/syntheticChildren.js'

const fail = (error) => { if (error) throw error }
const today = () => new Date().toISOString().slice(0, 10)
const toScheduleId = (code) => code

function mapChild(row) {
  const history = (row.vaccination_records ?? []).map((record) => ({
    ...(record.schedule ?? VACCINATION_SCHEDULE.find((dose) => dose.id === record.schedule_code)),
    id: record.schedule_code,
    scheduledDate: record.scheduled_date,
    administeredDate: record.administered_date,
    administeredBy: record.administering_worker?.name ?? 'Health worker',
    recordedBy: record.recorder?.full_name ?? '',
  }))
  const base = createChildRecord({
    childId: row.child_id, name: row.name, dateOfBirth: row.date_of_birth,
    registrationDate: row.registration_date, locality: row.locality?.name ?? '',
    assignedAshaWorker: row.assigned_worker?.name ?? '', vaccinationHistory: history,
    migrationStatus: row.migration_status, familyReachability: row.family_reachability,
  })
  return { ...base, _dbId: row.id }
}

const childSelect = 'id,child_id,name,date_of_birth,registration_date,migration_status,family_reachability,locality:localities!children_locality_id_fkey(name),assigned_worker:asha_workers!children_assigned_worker_id_fkey(id,name),vaccination_records(id,schedule_code,scheduled_date,administered_date,administering_worker:asha_workers!vaccination_records_administered_by_worker_id_fkey(name),recorder:profiles!vaccination_records_recorded_by_fkey(full_name),schedule:vaccination_schedule!vaccination_records_schedule_code_fkey(code,vaccine_name,dose_number,due_after_days))'
async function referenceIds(localityName, workerName) {
  const [{ data: locality, error: localityError }, { data: worker, error: workerError }] = await Promise.all([
    supabase.from('localities').select('id').eq('name', localityName).single(),
    supabase.from('asha_workers').select('id').eq('name', workerName).single(),
  ])
  fail(localityError); fail(workerError)
  return { localityId: locality.id, workerId: worker.id }
}

export async function listChildren() {
  const { data, error } = await supabase.from('children').select(childSelect).order('created_at', { ascending: false })
  fail(error)
  return (data ?? []).map(mapChild)
}

export async function createChild(details, userId) {
  const { localityId, workerId } = await referenceIds(details.locality, details.assignedAshaWorker)
  const { data, error } = await supabase.from('children').insert({
    child_id: details.childId, name: details.name.trim(), date_of_birth: details.dateOfBirth,
    registration_date: details.registrationDate, locality_id: localityId, assigned_worker_id: workerId,
    migration_status: details.migrationStatus, family_reachability: details.familyReachability, created_by: userId,
  }).select('id').single()
  fail(error)
  return data
}

export async function updateChild(childId, details) {
  const { localityId, workerId } = await referenceIds(details.locality, details.assignedAshaWorker)
  const { error } = await supabase.from('children').update({
    name: details.name.trim(), date_of_birth: details.dateOfBirth, registration_date: details.registrationDate,
    locality_id: localityId, assigned_worker_id: workerId, migration_status: details.migrationStatus,
    family_reachability: details.familyReachability, updated_at: new Date().toISOString(),
  }).eq('child_id', childId)
  fail(error)
}

export async function recordVaccination(child, doseId, administeredDate, userId) {
  const dose = VACCINATION_SCHEDULE.find((item) => item.id === doseId)
  if (!dose) throw new Error('This dose is not part of the sample schedule.')
  const dueDate = new Date(`${child.dateOfBirth}T00:00:00Z`)
  dueDate.setUTCDate(dueDate.getUTCDate() + dose.dueAfterDays)
  const scheduledDate = dueDate.toISOString().slice(0, 10)
  if (child.vaccinationHistory.some((item) => item.id === doseId)) throw new Error('This dose has already been recorded for this child.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(administeredDate) || Number.isNaN(new Date(`${administeredDate}T00:00:00Z`).getTime())) throw new Error('Enter a valid vaccination date.')
  if (administeredDate < scheduledDate || administeredDate > today()) throw new Error('Vaccination date must be on or after the scheduled date and cannot be in the future.')
  const { data: worker, error: workerError } = await supabase.from('asha_workers').select('id').eq('name', child.assignedAshaWorker).single()
  fail(workerError)
  const { error } = await supabase.from('vaccination_records').insert({
    child_id: child._dbId, schedule_code: toScheduleId(doseId), scheduled_date: scheduledDate,
    administered_date: administeredDate, administered_by_worker_id: worker.id, recorded_by: userId,
  })
  fail(error)
}

export async function listTasks() {
  const { data, error } = await supabase.from('outreach_tasks').select('id,task_code,child:children!outreach_tasks_child_id_fkey(child_id),worker:asha_workers!outreach_tasks_assigned_worker_id_fkey(name),title,task_type,due_date,priority,status,completion_notes,follow_up_outcome,created_at,completed_at').order('due_date')
  fail(error)
  return (data ?? []).map((row) => ({ taskId: row.task_code, _dbId: row.id, childId: row.child.child_id, assignedTo: row.worker.name, title: row.title, taskType: row.task_type, dueDate: row.due_date, priority: row.priority, status: row.status, completionNotes: row.completion_notes ?? '', followUpOutcome: row.follow_up_outcome ?? '', createdAt: row.created_at.slice(0, 10), completedAt: row.completed_at?.slice(0, 10) ?? null }))
}

export async function createTask(task, child, userId) {
  const { data: worker, error: workerError } = await supabase.from('asha_workers').select('id').eq('name', task.assignedTo).single()
  fail(workerError)
  const taskCode = `TASK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
  const { data, error } = await supabase.from('outreach_tasks').insert({
    task_code: taskCode, child_id: child._dbId, assigned_worker_id: worker.id, title: task.title,
    task_type: task.taskType, due_date: task.dueDate, priority: task.priority, created_by: userId,
  }).select('id').single()
  fail(error)
  return { ...data, taskId: taskCode }
}

export async function updateTask(taskId, patch, children) {
  const current = await listTasks()
  const task = current.find((item) => item.taskId === taskId)
  if (!task) throw new Error('Follow-up task was not found.')
  const child = children.find((item) => item.childId === task.childId)
  const update = {}
  if (patch.assignedTo && patch.assignedTo !== task.assignedTo) {
    const { data: worker, error: workerError } = await supabase.from('asha_workers').select('id').eq('name', patch.assignedTo).single()
    fail(workerError)
    update.assigned_worker_id = worker.id
  }
  if (patch.status) update.status = patch.status
  if (patch.completionNotes !== undefined) update.completion_notes = patch.completionNotes
  if (patch.followUpOutcome !== undefined) update.follow_up_outcome = patch.followUpOutcome
  if (!Object.keys(update).length) return child
  const { error } = await supabase.from('outreach_tasks').update(update).eq('task_code', taskId)
  fail(error)
  return child
}

export async function deleteChild(childId) {
  const { data, error } = await supabase.from('children').delete().eq('child_id', childId).select('id').single()
  fail(error)
  return data
}

export async function deleteVaccination(childDbId, doseCode) {
  const { data, error } = await supabase.from('vaccination_records').delete()
    .eq('child_id', childDbId).eq('schedule_code', doseCode).select('id').single()
  fail(error)
  return data
}

export async function deleteTask(taskCode) {
  const { data, error } = await supabase.from('outreach_tasks').delete().eq('task_code', taskCode).select('id').single()
  fail(error)
  return data
}
