import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DATA_AS_OF, createChildRecord, syntheticChildren, VACCINATION_SCHEDULE } from '../data/syntheticChildren.js'
import { ChildrenContext } from './childrenContext.js'
import { hasPermission, PERMISSIONS, PROTOTYPE_USER } from '../utils/permissions.js'
import { useAuth } from './useAuth.js'
import { isSupabaseConfigured } from '../lib/supabase.js'
import * as repository from '../lib/supabaseRepository.js'

const REGISTRY_STORAGE_KEY = 'vaxreach-child-registry-v1'
const EMPTY_CHILDREN = []
function readRegistry() {
  try {
    const saved = window.localStorage.getItem(REGISTRY_STORAGE_KEY)
    const parsed = saved ? JSON.parse(saved) : null
    if (Array.isArray(parsed) && parsed.every((child) => child && typeof child.childId === 'string' && Array.isArray(child.vaccinationHistory))) {
      return parsed.map((child) => createChildRecord(child))
    }
  } catch {
    // Storage may be unavailable; the generated sample remains usable in memory.
  }
  return syntheticChildren
}

function nextChildId(children) {
  const highestId = children.reduce((highest, child) => {
    const match = child.childId.match(/^VXR-(\d+)$/)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)
  return `VXR-${String(highestId + 1).padStart(4, '0')}`
}

function isValidISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function ChildrenProvider({ children: appChildren }) {
  const { session, sessionRevision } = useAuth()
  const scopeKey = isSupabaseConfigured ? `${session?.user?.id ?? 'signed-out'}:${sessionRevision}` : 'local'
  return <ScopedChildrenProvider key={scopeKey}>{appChildren}</ScopedChildrenProvider>
}

function ScopedChildrenProvider({ children: appChildren }) {
  const { session, profile, cloudEnabled } = useAuth()
  const userId = session?.user?.id ?? null
  const ownerId = isSupabaseConfigured ? userId : 'local'
  const [registryState, setRegistryState] = useState(() => isSupabaseConfigured
    ? { ownerId: null, children: [], loading: true, error: '' }
    : { ownerId: 'local', children: readRegistry(), loading: false, error: '' })
  const ownsRegistry = registryState.ownerId === ownerId
  const children = ownsRegistry ? registryState.children : EMPTY_CHILDREN
  const loading = isSupabaseConfigured ? Boolean(userId) && (!ownsRegistry || registryState.loading) : false
  const error = userId && ownsRegistry ? registryState.error : ''
  const loadRequest = useRef(0)
  const recordedDoseKeys = useRef(new Set(children.flatMap((child) => child.vaccinationHistory.map((dose) => `${child.childId}:${dose.id}`))))
  const updateRegistryState = useCallback((forUserId, update) => {
    setRegistryState((current) => {
      const base = current.ownerId === forUserId
        ? current
        : { ownerId: forUserId, children: [], loading: false, error: '' }
      const changes = typeof update === 'function' ? update(base) : update
      return { ...base, ...changes, ownerId: forUserId }
    })
  }, [])
  const isCurrentOwner = useCallback((forUserId) => ownerId === forUserId, [ownerId])

  useEffect(() => {
    if (!isSupabaseConfigured || !userId) return undefined
    const requestId = ++loadRequest.current
    recordedDoseKeys.current = new Set()
    repository.listChildren().then((rows) => {
      if (requestId !== loadRequest.current) return
      setRegistryState({ ownerId: userId, children: rows, loading: false, error: '' })
      recordedDoseKeys.current = new Set(rows.flatMap((child) => child.vaccinationHistory.map((dose) => `${child.childId}:${dose.id}`)))
    }).catch((cause) => {
      if (requestId === loadRequest.current) {
        setRegistryState({ ownerId: userId, children: [], loading: false, error: cause.message || 'Unable to load child records.' })
      }
    })
    return () => { if (loadRequest.current === requestId) loadRequest.current += 1 }
  }, [userId, ownerId])

  useEffect(() => {
    if (isSupabaseConfigured) return
    try {
      window.localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(children))
    } catch {
      // Registry changes still work for this session when storage is unavailable.
    }
  }, [children])

  const addChild = useCallback(async (details) => {
    if (!hasPermission(PERMISSIONS.MANAGE_ASSIGNMENTS, cloudEnabled ? profile : undefined)) return null
    const operationOwnerId = ownerId
    if (isSupabaseConfigured && !userId) return null
    const child = createChildRecord({ ...details, childId: nextChildId(children) })
    if (isSupabaseConfigured) {
      try {
        await repository.createChild({ ...details, childId: child.childId }, userId)
        if (!isCurrentOwner(operationOwnerId)) return null
        const rows = await repository.listChildren()
        if (!isCurrentOwner(operationOwnerId)) return null
        updateRegistryState(operationOwnerId, { children: rows, loading: false, error: '' })
        return rows.find((row) => row.childId === child.childId) ?? child
      } catch (cause) { if (isCurrentOwner(operationOwnerId)) updateRegistryState(operationOwnerId, { error: cause.message || 'Unable to save child.' }); return null }
    }
    updateRegistryState(operationOwnerId, (current) => ({ children: [child, ...current.children] }))
    return child
  }, [children, userId, ownerId, profile, cloudEnabled, isCurrentOwner, updateRegistryState])

  const updateChild = useCallback(async (childId, details) => {
    if (!hasPermission(PERMISSIONS.MANAGE_ASSIGNMENTS, cloudEnabled ? profile : undefined)) return null
    const operationOwnerId = ownerId
    if (isSupabaseConfigured && !userId) return null
    const currentChild = children.find((child) => child.childId === childId)
    if (!currentChild) return null
    const updatedChild = createChildRecord({ ...currentChild, ...details, childId })
    if (isSupabaseConfigured) {
      try {
        await repository.updateChild(childId, { ...currentChild, ...details })
        if (!isCurrentOwner(operationOwnerId)) return null
        const rows = await repository.listChildren()
        if (!isCurrentOwner(operationOwnerId)) return null
        updateRegistryState(operationOwnerId, { children: rows, loading: false, error: '' })
        return rows.find((row) => row.childId === childId) ?? updatedChild
      } catch (cause) { if (isCurrentOwner(operationOwnerId)) updateRegistryState(operationOwnerId, { error: cause.message || 'Unable to update child.' }); return null }
    }
    updateRegistryState(operationOwnerId, (current) => ({ children: current.children.map((child) => child.childId === childId ? updatedChild : child) }))
    return updatedChild
  }, [children, userId, ownerId, profile, cloudEnabled, isCurrentOwner, updateRegistryState])

  const recordDose = useCallback(async (childId, doseId, administeredDate) => {
    if (!hasPermission(PERMISSIONS.RECORD_VACCINATION, cloudEnabled ? profile : undefined)) return { ok: false, message: 'Your account cannot record vaccinations.' }
    const operationOwnerId = ownerId
    if (isSupabaseConfigured && !userId) return { ok: false, message: 'Your session has ended. Sign in again to continue.' }
    const child = children.find((record) => record.childId === childId)
    if (!child) return { ok: false, message: 'Child record was not found.' }
    const dose = VACCINATION_SCHEDULE.find((item) => item.id === doseId)
    if (!dose) return { ok: false, message: 'This dose is not part of the sample schedule.' }
    const recordKey = `${childId}:${doseId}`
    if (recordedDoseKeys.current.has(recordKey) || child.vaccinationHistory.some((entry) => entry.id === doseId)) return { ok: false, message: 'This dose has already been recorded for this child.' }
    if (!isValidISODate(administeredDate)) return { ok: false, message: 'Enter a valid vaccination date.' }

    const dueEntry = [...child.pendingDoses, ...child.overdueDoses].find((entry) => entry.id === doseId)
    if (!dueEntry) return { ok: false, message: 'The scheduled dose could not be found for this child.' }
    if (dueEntry.dueDate > DATA_AS_OF) return { ok: false, message: 'A future dose cannot be recorded before its scheduled date.' }
    if (administeredDate < dueEntry.dueDate) return { ok: false, message: 'Vaccination date cannot be earlier than the scheduled date.' }
    if (administeredDate > DATA_AS_OF) return { ok: false, message: 'Vaccination date cannot be after the prototype reference date.' }

    const vaccinationHistory = [...child.vaccinationHistory, {
      ...dose,
      scheduledDate: dueEntry.dueDate,
      administeredDate,
      administeredBy: child.assignedAshaWorker,
      recordedBy: PROTOTYPE_USER.displayName,
    }]
    const updatedChild = createChildRecord({ ...child, vaccinationHistory })
    if (isSupabaseConfigured) {
      try {
        await repository.recordVaccination(child, doseId, administeredDate, userId)
        if (!isCurrentOwner(operationOwnerId)) return { ok: false, message: 'Your session changed before the record finished loading.' }
        const rows = await repository.listChildren()
        if (!isCurrentOwner(operationOwnerId)) return { ok: false, message: 'Your session changed before the record finished loading.' }
        updateRegistryState(operationOwnerId, { children: rows, loading: false, error: '' })
        recordedDoseKeys.current.add(recordKey)
        return { ok: true, child: rows.find((row) => row.childId === childId) ?? updatedChild }
      } catch (cause) { return { ok: false, message: cause.message || 'Unable to save vaccination.' } }
    }
    recordedDoseKeys.current.add(recordKey)
    updateRegistryState(operationOwnerId, (current) => ({ children: current.children.map((record) => record.childId === childId ? updatedChild : record) }))
    return { ok: true, child: updatedChild }
  }, [children, userId, ownerId, profile, cloudEnabled, isCurrentOwner, updateRegistryState])

  const refreshChildren = useCallback(async () => {
    if (!isSupabaseConfigured || !userId) return
    const requestId = ++loadRequest.current
    const requestOwnerId = ownerId
    updateRegistryState(requestOwnerId, { children: [], loading: true, error: '' })
    try {
      const rows = await repository.listChildren()
      if (!isCurrentOwner(requestOwnerId) || requestId !== loadRequest.current) return
      updateRegistryState(requestOwnerId, { children: rows, loading: false, error: '' })
      recordedDoseKeys.current = new Set(rows.flatMap((child) => child.vaccinationHistory.map((dose) => `${child.childId}:${dose.id}`)))
    } catch (cause) {
      if (isCurrentOwner(requestOwnerId) && requestId === loadRequest.current) updateRegistryState(requestOwnerId, { children: [], loading: false, error: cause.message || 'Unable to load child records.' })
    }
  }, [userId, ownerId, isCurrentOwner, updateRegistryState])

  const value = useMemo(() => ({ children, addChild, updateChild, recordDose, loading, error, refreshChildren }), [children, addChild, updateChild, recordDose, loading, error, refreshChildren])
  return <ChildrenContext.Provider value={value}>{appChildren}</ChildrenContext.Provider>
}
