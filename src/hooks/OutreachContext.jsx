import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createSyntheticOutreachTasks } from '../data/outreachTasks.js'
import { DATA_AS_OF } from '../data/syntheticChildren.js'
import { useWorkers } from './WorkersContext.jsx'
import { useChildren } from './useChildren.js'
import { OutreachContext } from './outreachContext.js'
import { hasPermission, PERMISSIONS } from '../utils/permissions.js'
import { useAuth } from './useAuth.js'
import { isSupabaseConfigured } from '../lib/supabase.js'
import * as repository from '../lib/supabaseRepository.js'

const TASK_STORAGE_KEY = 'vaxreach-outreach-tasks-v1'
const EMPTY_TASKS = []

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
  const { session, sessionRevision } = useAuth()
  const scopeKey = isSupabaseConfigured ? `${session?.user?.id ?? 'signed-out'}:${sessionRevision}` : 'local'
  return <ScopedOutreachProvider key={scopeKey}>{appChildren}</ScopedOutreachProvider>
}

function ScopedOutreachProvider({ children: appChildren }) {
  const { session, profile, cloudEnabled } = useAuth()
  const { children, updateChild } = useChildren()
  const { workers } = useWorkers()
  const userId = session?.user?.id ?? null
  const ownerId = isSupabaseConfigured ? userId : 'local'
  const [taskState, setTaskState] = useState(() => isSupabaseConfigured
    ? { ownerId: null, tasks: [], loading: true, error: '' }
    : { ownerId: 'local', tasks: readTasks(children), loading: false, error: '' })
  const ownsTaskState = taskState.ownerId === ownerId
  const tasks = ownsTaskState ? taskState.tasks : EMPTY_TASKS
  const loading = isSupabaseConfigured ? Boolean(userId) && (!ownsTaskState || taskState.loading) : false
  const error = userId && ownsTaskState ? taskState.error : ''
  const taskRequest = useRef(0)

  const updateTaskState = useCallback((forOwnerId, update) => {
    setTaskState((current) => {
      const base = current.ownerId === forOwnerId
        ? current
        : { ownerId: forOwnerId, tasks: [], loading: false, error: '' }
      const changes = typeof update === 'function' ? update(base) : update
      return { ...base, ...changes, ownerId: forOwnerId }
    })
  }, [])
  const isCurrentOwner = useCallback((forOwnerId) => ownerId === forOwnerId, [ownerId])

  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return undefined
    const requestId = ++taskRequest.current
    repository.listTasks().then((rows) => {
      if (requestId === taskRequest.current) setTaskState({ ownerId, tasks: rows, loading: false, error: '' })
    }).catch(() => {
      if (requestId === taskRequest.current) setTaskState({ ownerId, tasks: [], loading: false, error: 'Unable to load outreach tasks.' })
    })
    return () => { if (taskRequest.current === requestId) taskRequest.current += 1 }
  }, [userId, ownerId])

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
    const operationOwnerId = ownerId
    if (!workers.some((worker) => worker.name === workerName && worker.active !== false)) return { ok: false, message: 'Select an active ASHA worker.' }
    const child = children.find((record) => record.childId === childId)
    if (!child) return { ok: false, message: 'Child record was not found.' }
    const updatedChild = await updateChild(childId, { assignedAshaWorker: workerName })
    if (!updatedChild) return { ok: false, message: 'Child assignment could not be saved.' }
    updateTaskState(operationOwnerId, (current) => ({ tasks: current.tasks.map((task) => task.childId === childId && task.status === 'Open' ? { ...task, assignedTo: workerName } : task) }))
    return { ok: true, child: updatedChild }
  }, [children, updateChild, profile, cloudEnabled, ownerId, updateTaskState, workers])

  const updateChildDetails = useCallback(async (childId, details) => {
    if (!hasPermission(PERMISSIONS.MANAGE_ASSIGNMENTS, cloudEnabled ? profile : undefined)) return { ok: false, message: 'Administrator access is required to edit child assignments.' }
    const operationOwnerId = ownerId
    const currentChild = children.find((child) => child.childId === childId)
    if (!currentChild) return { ok: false, message: 'Child record was not found.' }
    if (!workers.some((worker) => worker.name === details.assignedAshaWorker && worker.active !== false)) return { ok: false, message: 'Select an active ASHA worker.' }
    const updatedChild = await updateChild(childId, details)
    if (!updatedChild) return { ok: false, message: 'Child record could not be updated.' }
    if (currentChild.assignedAshaWorker !== updatedChild.assignedAshaWorker) {
      updateTaskState(operationOwnerId, (current) => ({ tasks: current.tasks.map((task) => task.childId === childId && task.status === 'Open' ? { ...task, assignedTo: updatedChild.assignedAshaWorker } : task) }))
    }
    return { ok: true, child: updatedChild }
  }, [children, updateChild, profile, cloudEnabled, ownerId, updateTaskState, workers])

  const addTask = useCallback(async (details) => {
    if (!hasPermission(PERMISSIONS.MANAGE_OUTREACH, cloudEnabled ? profile : undefined)) return { ok: false, message: 'Your account cannot add follow-up tasks.' }
    const operationOwnerId = ownerId
    const operationUserId = userId
    if (isSupabaseConfigured && !operationUserId) return { ok: false, message: 'Your session has ended. Sign in again to continue.' }
    const child = children.find((record) => record.childId === details.childId)
    if (!child) return { ok: false, message: 'Select a registered child.' }
    if (!workers.some((worker) => worker.name === details.assignedTo && worker.active !== false)) return { ok: false, message: 'Select an active ASHA worker.' }
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
        await repository.createTask(task, child, operationUserId)
        if (!isCurrentOwner(operationOwnerId)) return { ok: false, message: 'Your session changed before the task finished loading.' }
        const rows = await repository.listTasks()
        if (!isCurrentOwner(operationOwnerId)) return { ok: false, message: 'Your session changed before the task finished loading.' }
        updateTaskState(operationOwnerId, { tasks: rows, loading: false, error: '' })
        return { ok: true, task }
      } catch (cause) { if (isCurrentOwner(operationOwnerId)) updateTaskState(operationOwnerId, { error: cause.message || 'Unable to create outreach task.' }); return { ok: false, message: cause.message || 'Unable to create outreach task.' } }
    }
    updateTaskState(operationOwnerId, (current) => ({ tasks: [task, ...current.tasks] }))
    return { ok: true, task }
  }, [children, tasks, userId, ownerId, profile, cloudEnabled, isCurrentOwner, updateTaskState, workers])

  const assignTask = useCallback(async (taskId, workerName) => {
    if (!hasPermission(PERMISSIONS.MANAGE_ASSIGNMENTS, cloudEnabled ? profile : undefined)) return { ok: false, message: 'Administrator access is required to reassign tasks.' }
    const operationOwnerId = ownerId
    if (!workers.some((worker) => worker.name === workerName && worker.active !== false)) return { ok: false, message: 'Select an active ASHA worker.' }
    const task = tasks.find((record) => record.taskId === taskId)
    if (!task) return { ok: false, message: 'Follow-up task was not found.' }
    if (task.status !== 'Open') return { ok: false, message: 'Reopen this task before changing its assignment.' }
    if (isSupabaseConfigured) {
      try {
        await repository.updateTask(taskId, { assignedTo: workerName }, children)
        if (!isCurrentOwner(operationOwnerId)) return { ok: false, message: 'Your session changed before the task finished loading.' }
        const rows = await repository.listTasks()
        if (!isCurrentOwner(operationOwnerId)) return { ok: false, message: 'Your session changed before the task finished loading.' }
        updateTaskState(operationOwnerId, { tasks: rows, loading: false, error: '' })
        return { ok: true }
      } catch (cause) { return { ok: false, message: cause.message || 'Unable to reassign task.' } }
    }
    updateTaskState(operationOwnerId, (current) => ({ tasks: current.tasks.map((record) => record.taskId === taskId ? { ...record, assignedTo: workerName } : record) }))
    return { ok: true }
  }, [tasks, children, profile, cloudEnabled, ownerId, isCurrentOwner, updateTaskState, workers])

  const setTaskCompletion = useCallback(async (taskId, completed, taskUpdates = {}) => {
    if (!hasPermission(PERMISSIONS.UPDATE_ASSIGNED_TASKS, cloudEnabled ? profile : undefined)) return { ok: false, message: 'Your account cannot update outreach tasks.' }
    const operationOwnerId = ownerId
    const task = tasks.find((record) => record.taskId === taskId)
    if (!task) return { ok: false, message: 'Follow-up task was not found.' }
    const status = completed ? 'Completed' : 'Open'
    if (isSupabaseConfigured) {
      try {
        await repository.updateTask(taskId, { ...taskUpdates, status }, children)
        if (!isCurrentOwner(operationOwnerId)) return { ok: false, message: 'Your session changed before the task finished loading.' }
        const rows = await repository.listTasks()
        if (!isCurrentOwner(operationOwnerId)) return { ok: false, message: 'Your session changed before the task finished loading.' }
        updateTaskState(operationOwnerId, { tasks: rows, loading: false, error: '' })
        return { ok: true }
      }
      catch (cause) { return { ok: false, message: cause.message || 'Unable to update task.' } }
    }
    updateTaskState(operationOwnerId, (current) => ({ tasks: current.tasks.map((record) => record.taskId === taskId ? { ...record, ...taskUpdates, status, completedAt: completed ? DATA_AS_OF : null } : record) }))
    return { ok: true }
  }, [tasks, children, profile, cloudEnabled, ownerId, isCurrentOwner, updateTaskState])

  const value = useMemo(() => ({ tasks, assignChildToWorker, updateChildDetails, addTask, assignTask, setTaskCompletion, loading, error }), [tasks, assignChildToWorker, updateChildDetails, addTask, assignTask, setTaskCompletion, loading, error])
  return <OutreachContext.Provider value={value}>{appChildren}</OutreachContext.Provider>
}
