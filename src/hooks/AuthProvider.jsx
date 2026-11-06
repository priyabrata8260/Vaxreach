import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AuthContext } from './AuthContext.js'
import { isSupabaseConfigured, supabase } from '../lib/supabase.js'
import { APP_ROLES } from '../utils/accessControl.js'

const portalMismatchMessage = 'Your account does not have permission to sign in through this portal.'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [profileLoading, setProfileLoading] = useState(isSupabaseConfigured)
  const [roleCheckLoading, setRoleCheckLoading] = useState(false)
  const [error, setError] = useState('')
  const [sessionRevision, setSessionRevision] = useState(0)
  const previousSessionUserIdRef = useRef(null)
  const activeSessionRevisionRef = useRef(0)
  const profileLoadRequest = useRef(0)
  const sessionUserId = session?.user?.id ?? null
  const publishSession = useCallback((nextSession) => {
    const nextUserId = nextSession?.user?.id ?? null
    const previousUserId = previousSessionUserIdRef.current
    if (previousUserId !== nextUserId || !nextUserId) {
      activeSessionRevisionRef.current += 1
      setSessionRevision(activeSessionRevisionRef.current)
    }
    previousSessionUserIdRef.current = nextUserId
    setSession(nextSession)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    let mounted = true
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return
      if (sessionError) setError(sessionError.message)
      publishSession(data?.session ?? null)
      setLoading(false)
      setProfileLoading(Boolean(data?.session))
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      publishSession(nextSession)
      setProfile(null)
      setProfileLoading(Boolean(nextSession))
      setLoading(false)
      setError('')
    })
    return () => { mounted = false; listener.subscription.unsubscribe() }
  }, [publishSession])

  useEffect(() => {
    if (!sessionUserId) return undefined
    const userId = sessionUserId
    const requestId = ++profileLoadRequest.current
    const requestRevision = sessionRevision
    supabase.from('profiles').select('id, full_name, role').eq('id', userId).single()
      .then(async ({ data, error: profileError }) => {
        if (profileLoadRequest.current !== requestId || activeSessionRevisionRef.current !== requestRevision) return
        if (profileError) { setError('Your account profile could not be loaded. Contact an administrator.'); setProfileLoading(false); return }
        if (data?.role === 'asha_worker') {
          const { data: worker, error: workerError } = await supabase.from('asha_workers').select('worker_code,name,active').eq('profile_id', data.id).eq('active', true).maybeSingle()
          if (profileLoadRequest.current !== requestId || activeSessionRevisionRef.current !== requestRevision) return
          if (workerError) setError(workerError.message)
          setProfile({ ...data, workerCode: worker?.worker_code, workerName: worker?.name, workerActive: worker?.active === true })
        } else setProfile(data ?? null)
        setProfileLoading(false)
      })
      .catch(() => {
        if (profileLoadRequest.current === requestId && activeSessionRevisionRef.current === requestRevision) {
          setError('Your account profile could not be loaded. Contact an administrator.')
          setProfileLoading(false)
        }
      })
    return () => { if (profileLoadRequest.current === requestId) profileLoadRequest.current += 1 }
  }, [sessionUserId, sessionRevision])

  const visibleProfile = profile?.id === session?.user?.id ? profile : null

  const value = useMemo(() => ({
    session, sessionRevision, profile: visibleProfile, loading, profileLoading, roleCheckLoading, error, cloudEnabled: isSupabaseConfigured,
    signIn: async (identifier, password, selectedRole) => {
      if (![APP_ROLES.ADMINISTRATOR, APP_ROLES.ASHA_WORKER].includes(selectedRole)) throw new Error('Choose a valid sign-in portal.')
      setRoleCheckLoading(true)
      try {
        const cleanIdentifier = identifier.trim()
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanIdentifier)
        if (isEmail) {
          const { error: signInError } = await supabase.auth.signInWithPassword({ email: cleanIdentifier, password })
          if (signInError) throw signInError
        } else {
          const { data, error: functionError } = await supabase.functions.invoke('login-by-id', { body: { userId: cleanIdentifier, password } })
          if (functionError) throw new Error('Invalid user ID or password.')
          const { error: sessionError } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
          if (sessionError) throw sessionError
        }

        const { data: sessionData, error: currentSessionError } = await supabase.auth.getSession()
        if (currentSessionError || !sessionData.session?.user?.id) throw currentSessionError || new Error('The authenticated session could not be loaded.')
        const { data: accountProfile, error: profileLookupError } = await supabase.from('profiles')
          .select('id, role').eq('id', sessionData.session.user.id).maybeSingle()
        if (profileLookupError || accountProfile?.role !== selectedRole) {
          await supabase.auth.signOut({ scope: 'local' })
          throw new Error(portalMismatchMessage)
        }
        if (selectedRole === APP_ROLES.ASHA_WORKER) {
          const { data: worker, error: workerError } = await supabase.from('asha_workers')
            .select('worker_code').eq('profile_id', sessionData.session.user.id).eq('active', true).maybeSingle()
          if (workerError || !worker?.worker_code) {
            await supabase.auth.signOut({ scope: 'local' })
            throw new Error(portalMismatchMessage)
          }
        }
        setError('')
      } finally {
        setRoleCheckLoading(false)
      }
    },
    signOut: async () => { const { error: signOutError } = await supabase.auth.signOut(); if (signOutError) throw signOutError },
  }), [session, sessionRevision, visibleProfile, loading, profileLoading, roleCheckLoading, error])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
