import { useState } from 'react'
import { Activity, BarChart3, ClipboardList, HeartPulse, Map, Menu, Settings, ShieldCheck, Syringe, Upload, UserRound, Users, X, LogOut } from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { ErrorState } from '../components/ui.jsx'
import { isSupabaseConfigured } from '../lib/supabase.js'
import { useChildren } from '../hooks/useChildren.js'
import { useOutreach } from '../hooks/useOutreach.js'

const adminNav = [
  ['Dashboard', '/admin/dashboard', HeartPulse], ['Children', '/admin/children', Users], ['ASHA Workers', '/admin/asha-workers', UserRound],
  ['Vaccination Tracker', '/admin/vaccination-tracker', ClipboardList], ['Outreach', '/admin/outreach', Activity], ['Reports', '/admin/reports', BarChart3],
  ['Geographic Map', '/admin/geographic-map', Map], ['CSV Import', '/admin/csv-import', Upload], ['Settings', '/admin/settings', Settings],
]
const ashaNav = [
  ['My Dashboard', '/asha/dashboard', HeartPulse], ['My Children', '/asha/children', Users], ['Assigned Tasks', '/asha/follow-ups', Activity],
  ['Vaccination Records', '/asha/vaccination-tracker', ClipboardList], ['My Locality', '/asha/locality-map', Map], ['My Profile', '/asha/profile', UserRound],
]
const demoNav = [['Dashboard', '/', HeartPulse], ['Children', '/children', Users], ['Vaccination Tracker', '/vaccination-tracker', ClipboardList], ['ASHA Workers', '/asha-workers', UserRound], ['Outreach', '/outreach', Activity], ['Reports', '/reports', BarChart3], ['Settings', '/settings', Settings]]

function AppLayout({ role }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [authError, setAuthError] = useState('')
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const childrenData = useChildren()
  const outreachData = useOutreach()
  const cloudError = isSupabaseConfigured ? childrenData.error || outreachData.error : ''
  const navItems = !isSupabaseConfigured ? demoNav : role === 'administrator' ? adminNav : ashaNav
  const roleLabel = isSupabaseConfigured ? role === 'administrator' ? 'Administrator' : 'ASHA Worker' : 'Synthetic demonstration'
  const homePath = !isSupabaseConfigured ? '/' : role === 'administrator' ? '/admin/dashboard' : '/asha/dashboard'
  const profilePath = role === 'administrator' ? '/admin/profile' : '/asha/profile'
  const profileName = profile?.workerName || profile?.full_name || 'Prototype administrator'
  const initials = profileName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  const handleSignOut = async () => {
    setAuthError('')
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (cause) { setAuthError(cause.message || 'Unable to sign out. Please retry.') }
  }

  return <div className={`app-shell${role === 'asha_worker' ? ' app-shell--asha' : ' app-shell--admin'}`}>
    <aside className={`sidebar${menuOpen ? ' sidebar--open' : ''}`}>
      <NavLink className="brand" to={homePath} aria-label="VaxReach home" onClick={() => setMenuOpen(false)}><span className="brand-mark"><Syringe size={21} strokeWidth={2.2} /></span><span>Vax<span className="brand-accent">Reach</span><small>Immunisation outreach</small></span></NavLink>
      <p className="nav-label">{role === 'asha_worker' ? 'FIELD WORKSPACE' : 'ADMIN WORKSPACE'}</p>
      <nav className="primary-nav" aria-label="Main navigation">{navItems.map(([label, path, Icon]) => <NavLink key={path} to={path} className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`} onClick={() => setMenuOpen(false)}><Icon size={18} strokeWidth={1.8} /><span>{label}</span></NavLink>)}</nav>
      {role === 'asha_worker' && <button className="nav-link sidebar-logout" type="button" onClick={handleSignOut}><LogOut size={18} strokeWidth={1.8} /><span>Logout</span></button>}
      <div className="sidebar-note"><ShieldCheck size={17} /><span>{role === 'asha_worker' ? 'Your assigned community workspace' : 'Supporting healthier communities'}</span></div>
    </aside>
    {menuOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <div className="main-column">
      <header className="topbar"><button className="icon-button menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button><div className="topbar-context"><span className="context-dot" />{role === 'asha_worker' ? 'Community health field team' : 'District immunisation programme'}</div><div className="topbar-account">{isSupabaseConfigured ? <Link className="topbar-profile" to={profilePath} aria-label={`View profile for ${profileName}`}><span className="avatar">{initials}</span><span className="topbar-profile-copy"><strong>{profileName}</strong><small className="role-caption">{roleLabel}</small></span></Link> : <div className="topbar-profile" aria-label="Synthetic demonstration profile"><span className="avatar">VR</span><span className="topbar-profile-copy"><strong>{profileName}</strong><small className="role-caption">{roleLabel}</small></span></div>}{isSupabaseConfigured && <button className="signout-button" onClick={handleSignOut}><LogOut size={14} /><span>Sign out</span></button>}</div></header>
      {authError && <div className="cloud-data-error" role="alert">{authError}</div>}
      {cloudError && <div className="app-data-error"><ErrorState compact title="Workspace data could not be loaded" description={cloudError} /></div>}
      {(childrenData.loading || outreachData.loading) && <div className="cloud-data-loading" role="status">Loading VaxReach records…</div>}
      <main className="page-content"><Outlet /></main><footer className="app-footer">VaxReach <span>·</span> {roleLabel} workspace</footer>
    </div>
  </div>
}

export default AppLayout
