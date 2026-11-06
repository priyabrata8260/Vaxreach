import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ASHA_WORKER_ROSTER } from '../data/syntheticChildren.js'
import { useAuth } from './useAuth.js'
import { isSupabaseConfigured } from '../lib/supabase.js'
import * as repository from '../lib/supabaseRepository.js'
import { hasPermission, PERMISSIONS } from '../utils/permissions.js'
import { useChildren } from './useChildren.js'

const WorkersContext = createContext(null)
const STORAGE_KEY = 'vaxreach-asha-workers-v1'
const initialWorkers = ASHA_WORKER_ROSTER.map((worker, index) => ({ ...worker, active: true, locality: '', email: '', phone: '', joinedDate: `2025-${String(index % 12 + 1).padStart(2, '0')}-01` }))

function readLocalWorkers() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null')
    if (Array.isArray(saved) && saved.every((worker) => worker?.workerId && worker?.name)) return saved
  } catch { /* Use the synthetic roster if local storage is unavailable. */ }
  return initialWorkers
}

export function WorkersProvider({ children }) {
  const { profile, session } = useAuth()
  const { refreshChildren } = useChildren()
  const [workers, setWorkers] = useState(() => isSupabaseConfigured ? [] : readLocalWorkers())
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState('')
  useEffect(() => {
    if (isSupabaseConfigured) return
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workers)) } catch { /* Keep session state usable. */ }
  }, [workers])
  useEffect(() => {
    if (!isSupabaseConfigured) return
    if (!session) { setWorkers([]); setLoading(false); return }
    let current = true
    setLoading(true)
    repository.listWorkers().then((rows) => { if (current) { setWorkers(rows); setError(''); setLoading(false) } }).catch(() => { if (current) { setError('Unable to load ASHA workers.'); setLoading(false) } })
    return () => { current = false }
  }, [session])

  const saveWorker = useCallback(async (workerId, details) => {
    if (!hasPermission(PERMISSIONS.MANAGE_ASSIGNMENTS, isSupabaseConfigured ? profile : undefined)) return { ok: false, message: 'Administrator access is required to manage workers.' }
    try {
      if (isSupabaseConfigured) {
        const saved = workerId ? await repository.updateWorker(workerId, details) : await repository.createWorker(details)
        const rows = await repository.listWorkers(); setWorkers(rows)
        if (workerId) await refreshChildren()
        return { ok: true, worker: rows.find((worker) => worker.workerId === saved.workerId) ?? saved }
      }
      const nextId = workerId || `ASHA-${String(workers.reduce((max, worker) => Math.max(max, Number(worker.workerId.match(/\d+$/)?.[0] || 0)), 0) + 1).padStart(3, '0')}`
      const saved = { ...(workers.find((worker) => worker.workerId === workerId) || {}), ...details, workerId: nextId }
      setWorkers((current) => {
        return workerId ? current.map((worker) => worker.workerId === workerId ? saved : worker) : [...current, saved]
      })
      return { ok: true, worker: saved }
    } catch (cause) { return { ok: false, message: cause.message || 'Unable to save worker.' } }
  }, [profile, workers, refreshChildren])

  const value = useMemo(() => ({ workers, loading, error, saveWorker }), [workers, loading, error, saveWorker])
  return <WorkersContext.Provider value={value}>{children}</WorkersContext.Provider>
}

export function useWorkers() {
  const context = useContext(WorkersContext)
  if (!context) throw new Error('useWorkers must be used inside WorkersProvider')
  return context
}
