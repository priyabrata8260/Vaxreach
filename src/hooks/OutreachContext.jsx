import { useCallback, useEffect, useMemo, useState } from 'react'
import { createSyntheticOutreachTasks } from '../data/outreachTasks.js'
import { ASHA_WORKER_ROSTER, DATA_AS_OF } from '../data/syntheticChildren.js'
import { useChildren } from './useChildren.js'
import { OutreachContext } from './outreachContext.js'
import { hasPermission, PERMISSIONS } from '../utils/permissions.js'
import { useAuth } from './useAuth.js'
import { isSupabaseConfigured } from '../lib/supabase.js'
import * as repository from '../lib/supabaseRepository.js'

const TASK_STORAGE_KEY = 'vaxreach-outreach-tasks-v1'

function nextTaskId(tasks) {
  const highestId = tasks.reduce((highest, task) => {
    const match = task.taskId.match(/^TASK-(\d+)$/)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
  return `TASK-${String(highestId + 1).padStart(4, '0')}`
}

function readTasks(children) {
  try {
    const saved = window.localStorage.getItem(TASK_STORAGE_KEY)
    const parsed = saved ? JSON.parse(saved) : null
    if (Array.isArray(parsed) && parsed.every((task) => task && typeof task.taskId === 'string')) return parsed
  } catch {
    // Regenerate a usable synthetic task list if browser storage is unavailable.
  }
  return createSyntheticOutreachTasks(children)
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function OutreachProvider({ children: appChildren }) {
  const { session, profile, cloudEnabled } = useAuth()
  const { children, updateChild } = useChildren()
  const [tasks, setTasks] = useState(() => isSupabaseConfigured ? [] : readTasks(children))
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isSupabaseConfigured) {
      if (!session) return undefined
      let active = true
      repository.listTasks().then((rows) => { if (active) { setTasks(rows); setError('') } })
        .catch((cause) => { if (active) setError(cause.message || 'Unable to load outreach tasks.') })
        .finally(() => { if (active) setLoading(false) })
      return () => { active = false }
    }
    return undefined
  }, [session])

  useEffect(() => {
    if (isSupabaseConfigured) return
    try {
      window.localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks))
    } catch {
      // Task operations still work for this session when storage is unavailable.
    }
  }, [tasks])

  const assignChildToWorker = useCallback(async (childId, workerName) => {
    if (!hasPermission(PERMISSIONS.MANAGE_ASSIGNMENTS, cloudEnabled ? profile : undefined)) return { ok: false, message: 'Administrator access is required to assign children.' }
    if (!ASHA_WORKER_ROSTER.some((worker) => worker.name === workerName)) return { ok: false, message: 'Select a valid ASHA worker.' }
    const child = children.find((record) => record.childId === childId)
    if (!child) return { ok: false, message: 'Child record was not found.' }
    const updatedChild = await updateChild(childId, { assignedAshaWorker: workerName })
    if (!updatedChild) return { ok: false, message: 'Child assignment could not be saved.' }
    setTasks((current) => current.map((task) => task.childId === childId && task.status === 'Open' ? { ...task, assignedTo: workerName } : task))
    return { ok: true, child: updatedChild }
  }, [children, updateChild, profile, cloudEnabled])

  const updateChildDetails = useCallback(async (childId, details) => {
    if (!hasPermission(PERMISSIONS.MANAGE_ASSIGNMENTS, cloudEnabled ? profile : undefined)) return { ok: false, message: 'Administrator access is required to edit child assignments.' }
    const currentChild = children.find((child) => child.childId === childId)
    if (!currentChild) return { ok: false, message: 'Child record was not found.' }
    if (!ASHA_WORKER_ROSTER.some((worker) => worker.name === details.assignedAshaWorker)) return { ok: false, message: 'Select a valid ASHA worker.' }
    const updatedChild = await updateChild(childId, details)
    if (!updatedChild) return { ok: false, message: 'Child record could not be updated.' }
    if (currentChild.assignedAshaWorker !== updatedChild.assignedAshaWorker) {
      setTasks((current) => current.map((task) => task.childId === childId && task.status === 'Open' ? { ...task, assignedTo: updatedChild.assignedAshaWorker } : task))
    }
    return { ok: true, child: updatedChild }
  }, [children, updateChild, profile, cloudEnabled])

  const addTask = useCallback(async (details) => {
    if (!hasPermission(PERMISSIONS.MANAGE_OUTREACH, cloudEnabled ? profile : undefined)) return { ok: false, message: 'Your account cannot add follow-up tasks.' }
    const child = children.find((record) => record.childId === details.childId)
    if (!child) return { ok: false, message: 'Select a registered child.' }
    if (!ASHA_WORKER_ROSTER.some((worker) => worker.name === details.assignedTo)) return { ok: false, message: 'Select a valid ASHA worker.' }
    const title = (details.title ?? '').trim()
    if (title.length < 3) return { ok: false, message: 'Enter a task description of at least three characters.' }
    if (!validDate(details.dueDate) || details.dueDate < DATA_AS_OF) return { ok: false, message: 'Task due date must be a valid date on or after the reference date.' }

    const task = {
      taskId: nextTaskId(tasks),
      childId: child.childId,
      title,
      taskType: 'Follow-up',
      dueDate: details.dueDate,
      priority: details.priority === 'High' ? 'High' : 'Normal',
      assignedTo: details.assignedTo,
      status: 'Open',
      createdAt: DATA_AS_OF,
      completedAt: null,
    }
    if (isSupabaseConfigured) {
      try {
        await repository.createTask(task, child, session.user.id)
        setTasks(await repository.listTasks())
        return { ok: true, task }
      } catch (cause) { setError(cause.message || 'Unable to create outreach task.'); return { ok: false, message: cause.message || 'Unable to create outreach task.' } }
    }
    setTasks((current) => [task, ...current])
    return { ok: true, task }
  }, [children, tasks, session, profile, cloudEnabled])

  const assignTask = useCallback(async (taskId, workerName) => {
    if (!hasPermission(PERMISSIONS.MANAGE_ASSIGNMENTS, cloudEnabled ? profile : undefined)) return { ok: false, message: 'Administrator access is required to reassign tasks.' }
    if (!ASHA_WORKER_ROSTER.some((worker) => worker.name === workerName)) return { ok: false, message: 'Select a valid ASHA worker.' }
    const task = tasks.find((record) => record.taskId === taskId)
    if (!task) return { ok: false, message: 'Follow-up task was not found.' }
    if (task.status !== 'Open') return { ok: false, message: 'Reopen this task before changing its assignment.' }
    if (isSupabaseConfigured) {
      try { await repository.updateTask(taskId, { assignedTo: workerName }, children); setTasks(await repository.listTasks()); return { ok: true } }
      catch (cause) { return { ok: false, message: cause.message || 'Unable to reassign task.' } }
    }
    setTasks((current) => current.map((record) => record.taskId === taskId ? { ...record, assignedTo: workerName } : record))
    return { ok: true }
  }, [tasks, children, profile, cloudEnabled])

  const setTaskCompletion = useCallback(async (taskId, completed) => {
    if (!hasPermission(PERMISSIONS.MANAGE_OUTREACH, cloudEnabled ? profile : undefined)) return { ok: false, message: 'Your account cannot update outreach tasks.' }
    const task = tasks.find((record) => record.taskId === taskId)
    if (!task) return { ok: false, message: 'Follow-up task was not found.' }
    const status = completed ? 'Completed' : 'Open'
    if (isSupabaseConfigured) {
      try { await repository.updateTask(taskId, { status }, children); setTasks(await repository.listTasks()); return { ok: true } }
      catch (cause) { return { ok: false, message: cause.message || 'Unable to update task.' } }
    }
    setTasks((current) => current.map((record) => record.taskId === taskId ? { ...record, status, completedAt: completed ? DATA_AS_OF : null } : record))
    return { ok: true }
  }, [tasks, children, profile, cloudEnabled])

  const value = useMemo(() => ({ tasks, assignChildToWorker, updateChildDetails, addTask, assignTask, setTaskCompletion, loading, error }), [tasks, assignChildToWorker, updateChildDetails, addTask, assignTask, setTaskCompletion, loading, error])
  return <OutreachContext.Provider value={value}>{appChildren}</OutreachContext.Provider>
}

