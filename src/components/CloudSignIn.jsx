import { useState } from 'react'
import { Eye, EyeOff, HeartPulse, ShieldCheck, Syringe } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { APP_ROLES } from '../utils/accessControl.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const roleOptions = [
  { role: APP_ROLES.ADMINISTRATOR, label: 'Administrator' },
  { role: APP_ROLES.ASHA_WORKER, label: 'ASHA / Health Worker' },
]

export default function CloudSignIn() {
  const { signIn, error: profileError } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!selectedRole) {
      setError('Choose a portal to continue.')
      return
    }
    if (!emailPattern.test(identifier.trim())) {
      setError('Enter a valid email address.')
      return
    }
    if (!password) { setError('Enter your password.'); return }
    setBusy(true)
    try { await signIn(identifier, password, selectedRole) }
    catch (cause) { setError(cause.message || 'Sign in failed. Check your credentials and try again.') }
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
      <form className="cloud-auth-card" onSubmit={submit} noValidate>
      <div className="cloud-auth-title"><div className="cloud-auth-icon"><ShieldCheck size={22} /></div><p className="eyebrow">Secure workforce access</p><h1>Welcome to VaxReach</h1><p>Immunisation Tracking and Outreach Management System</p></div>
      <fieldset className="portal-selector" aria-label="Select your portal">
        <legend>Sign in as</legend>
        <div className="portal-segment-group" role="group" aria-label="Account portal">
          {roleOptions.map(({ role, label }) => <button key={role} type="button" className={`portal-segment${selectedRole === role ? ' portal-segment--selected' : ''}`} aria-pressed={selectedRole === role} disabled={busy} onClick={() => { setSelectedRole(role); setError('') }}>{label}</button>)}
        </div>
      </fieldset>
      <p className="portal-helper">Your account role is checked after sign-in. This selection does not grant access.</p>
      <label>Email address<input type="email" autoComplete="username" inputMode="email" required value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="name@organisation.org" /></label>
      <label>Password<span className="password-input-wrap"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" /><button type="button" className="password-visibility" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
      {(error || profileError) && <div className="cloud-auth-error" role="alert">{error || profileError}</div>}
      <button className="button button-primary login-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <div className="cloud-auth-footnote"><ShieldCheck size={14} /><small>Accounts are provisioned by your VaxReach administrator. Public registration is disabled.</small></div>
      </form>
    </div>
  </main>
}
