import { useState } from 'react'
import { ArrowLeft, Eye, EyeOff, HeartPulse, LoaderCircle, Mail, ShieldCheck, Syringe } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { APP_ROLES } from '../utils/accessControl.js'
import { supabase } from '../lib/supabase.js'
import { Button, Field, useToast } from './ui.jsx'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const roleOptions = [
  { role: APP_ROLES.ADMINISTRATOR, label: 'Administrator' },
  { role: APP_ROLES.ASHA_WORKER, label: 'ASHA Worker' },
]

export default function CloudSignIn() {
  const { signIn, error: profileError, roleCheckLoading } = useAuth()
  const toast = useToast()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [feedback, setFeedback] = useState('')
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [diagnostics, setDiagnostics] = useState(['Waiting for login interaction'])

  function addDiagnostic(message) {
    setDiagnostics((current) => [...current, message])
  }

  async function submit(event) {
    event.preventDefault()
    addDiagnostic('Form submit event received')
    setError('')
    setFeedback('')
    setFieldErrors({})
    addDiagnostic('Validation started')
    if (recoveryMode) {
      if (!emailPattern.test(identifier.trim())) {
        setFieldErrors({ email: 'Enter the email address associated with your VaxReach account.' })
        addDiagnostic('Validation finished: failed (invalid email)')
        return
      }
      addDiagnostic('Validation finished: passed')
      addDiagnostic('Authentication request started')
      setBusy(true)
      try {
        const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(identifier.trim())
        if (recoveryError) throw recoveryError
        setFeedback('If an account exists for this email, a password reset link will be sent using the configured Supabase email settings.')
      } catch (cause) {
        setError(cause.message || 'Unable to request a password reset. Please try again.')
      } finally {
        setBusy(false)
      }
      return
    }
    if (!selectedRole) {
      setError('Choose a portal to continue.')
      addDiagnostic('Validation finished: failed (portal not selected)')
      return
    }
    if (!emailPattern.test(identifier.trim())) {
      setFieldErrors({ email: 'Enter a valid email address.' })
      addDiagnostic('Validation finished: failed (invalid email)')
      return
    }
    if (!password) {
      setFieldErrors({ password: 'Enter your password.' })
      addDiagnostic('Validation finished: failed (password missing)')
      return
    }
    addDiagnostic('Validation finished: passed')
    addDiagnostic('Authentication request started')
    setBusy(true)
    try {
      await signIn(identifier, password, selectedRole)
      addDiagnostic('Sign-in succeeded')
      toast({ title: 'Sign-in verified', message: 'Your account role was confirmed. Opening your VaxReach workspace.' })
    }
    catch (cause) {
      setError(cause.message || 'Sign in failed. Check your credentials and try again.')
      // Keep diagnostic output independent from provider supplied error text.
      // This prevents credentials or tokens echoed by a backend from reaching the panel.
      addDiagnostic('Sign-in failed: Authentication could not be completed. Check the account credentials or access.')
    }
    finally { setBusy(false) }
  }

  return <main className="cloud-auth-page">
    <div className="cloud-auth-layout">
      <aside className="cloud-auth-story" aria-label="VaxReach platform overview">
        <div className="cloud-auth-story-brand"><span className="login-brand-mark"><Syringe size={22} /></span><span>Vax<span>Reach</span><small>Immunisation outreach</small></span></div>
        <div className="health-visual" aria-hidden="true"><div className="health-visual-ring health-visual-ring--outer" /><div className="health-visual-ring health-visual-ring--inner" /><span className="health-visual-cross">+</span><span className="health-visual-heart"><HeartPulse size={38} strokeWidth={1.5} /></span><span className="health-visual-dot health-visual-dot--one" /><span className="health-visual-dot health-visual-dot--two" /></div>
        <p className="cloud-auth-story-kicker">CARE, COORDINATED</p>
        <h2>Every dose starts with a connected community.</h2>
        <p className="cloud-auth-story-copy">A secure workspace for immunisation teams to coordinate child records, vaccination schedules and outreach follow-ups.</p>
        <div className="cloud-auth-story-footer"><ShieldCheck size={16} /><span>Access is provisioned by your VaxReach administrator.</span></div>
      </aside>
      <form className={`cloud-auth-card${recoveryMode ? ' cloud-auth-card--recovery' : ''}`} onSubmit={submit} noValidate aria-busy={busy}>
      <div className="cloud-auth-title"><div className="cloud-auth-icon">{recoveryMode ? <Mail size={22} /> : <ShieldCheck size={22} />}</div><p className="eyebrow">{recoveryMode ? 'ACCOUNT RECOVERY' : 'SECURE WORKFORCE ACCESS'}</p><h1>{recoveryMode ? 'Reset your password' : 'Welcome to VaxReach'}</h1><p>{recoveryMode ? 'Enter your account email and we will send a password reset link if an account is found.' : 'Immunisation Tracking and Outreach Management System'}</p></div>
      {!recoveryMode && <><fieldset className="portal-selector" aria-label="Select your portal">
        <legend>Sign in as</legend>
        <div className="portal-segment-group" role="group" aria-label="Account portal">
          {roleOptions.map(({ role, label }) => <button key={role} type="button" className={`portal-segment${selectedRole === role ? ' portal-segment--selected' : ''}`} aria-pressed={selectedRole === role} disabled={busy} onClick={() => { setSelectedRole(role); setError('') }}>{label}</button>)}
        </div>
      </fieldset>
      <p className="portal-helper">Your account role is checked after sign-in. This selection does not grant access.</p>
      </>}
      <Field label="Email address" htmlFor="vaxreach-email" error={fieldErrors.email}><input id="vaxreach-email" type="email" autoComplete="username" inputMode="email" required value={identifier} onChange={(event) => { setIdentifier(event.target.value); setFieldErrors((current) => ({ ...current, email: '' })) }} placeholder="name@organisation.org" /></Field>
      {!recoveryMode && <Field label="Password" htmlFor="vaxreach-password" error={fieldErrors.password}><span className="password-input-wrap"><input id="vaxreach-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? 'vaxreach-password-error' : undefined} onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: '' })) }} placeholder="Enter your password" /><button type="button" className="password-visibility" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></Field>}
      {(error || profileError) && <div className="cloud-auth-error" role="alert">{error || profileError}</div>}
      {feedback && <div className="cloud-auth-success" role="status"><Mail size={16} /><span>{feedback}</span></div>}
      {roleCheckLoading && <div className="cloud-auth-success" role="status">Checking account permissions...</div>}
      <Button type="submit" className="login-submit" disabled={busy || roleCheckLoading} onClick={() => addDiagnostic('Submit button clicked')}>{busy ? <><LoaderCircle size={16} className="login-spinner" />{recoveryMode ? 'Sending link...' : 'Verifying account...'}</> : recoveryMode ? 'Send reset link' : 'Sign in'}</Button>
      {recoveryMode ? <button className="login-text-action recovery-back" type="button" disabled={busy} onClick={() => { setRecoveryMode(false); setError(''); setFeedback('') }}><ArrowLeft size={15} /> Back to sign in</button> : <button className="login-text-action forgot-password" type="button" disabled={busy} onClick={() => { setRecoveryMode(true); setError(''); setFeedback('') }}>Forgot password?</button>}
      <div className="cloud-auth-footnote"><ShieldCheck size={14} /><small>Accounts are provisioned by your VaxReach administrator. Public registration is disabled.</small></div>
      <section aria-label="Login diagnostics" role="status" style={{ padding: '8px 10px', border: '1px solid #b8d5d2', borderRadius: 7, background: '#f1f8f7', color: '#315b59', fontSize: 10, lineHeight: 1.45 }}>
        <strong>Temporary diagnostics</strong>
        <ol style={{ margin: '4px 0 0', paddingLeft: 18 }}>{diagnostics.map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}</ol>
      </section>
      </form>
    </div>
  </main>
}
