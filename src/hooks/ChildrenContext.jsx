import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DATA_AS_OF, createChildRecord, syntheticChildren, VACCINATION_SCHEDULE } from '../data/syntheticChildren.js'
import { ChildrenContext } from './childrenContext.js'
import { hasPermission, PERMISSIONS, PROTOTYPE_USER } from '../utils/permissions.js'

const REGISTRY_STORAGE_KEY = 'vaxreach-child-registry-v1'
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
  const [children, setChildren] = useState(readRegistry)
  const recordedDoseKeys = useRef(new Set(children.flatMap((child) => child.vaccinationHistory.map((dose) => `${child.childId}:${dose.id}`))))

  useEffect(() => {
    try {
      window.localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(children))
    } catch {
      // Registry changes still work for this session when storage is unavailable.
    }
  }, [children])

  const addChild = useCallback((details) => {
    const child = createChildRecord({ ...details, childId: nextChildId(children) })
    setChildren((current) => [child, ...current])
    return child
  }, [children])

  const updateChild = useCallback((childId, details) => {
    const currentChild = children.find((child) => child.childId === childId)
    if (!currentChild) return null
    const updatedChild = createChildRecord({ ...currentChild, ...details, childId })
    setChildren((current) => current.map((child) => child.childId === childId ? updatedChild : child))
    return updatedChild
  }, [children])

  const recordDose = useCallback((childId, doseId, administeredDate) => {
    if (!hasPermission(PERMISSIONS.RECORD_VACCINATION)) return { ok: false, message: 'Your prototype role cannot record vaccinations.' }
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
    recordedDoseKeys.current.add(recordKey)
    setChildren((current) => current.map((record) => record.childId === childId ? updatedChild : record))
    return { ok: true, child: updatedChild }
  }, [children])

  const value = useMemo(() => ({ children, addChild, updateChild, recordDose }), [children, addChild, updateChild, recordDose])
  return <ChildrenContext.Provider value={value}>{appChildren}</ChildrenContext.Provider>
}
